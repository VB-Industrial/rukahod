#!/usr/bin/env python3
"""Exercise the real HW plugin on isolated VCAN, never on EtherCAN buses.

Requires pre-created vcan_rtest / vcan_ptest / vcan_ltest and the installed ROS workspace.
Tests actual ROS controllers, CAN serialization, feedback, lights and heartbeat loss.
"""
import math
import os
from pathlib import Path
import signal
import socket
import struct
import subprocess
import time

import rclpy
from controller_manager_msgs.srv import ListControllers, ListHardwareComponents
from geometry_msgs.msg import Twist
from sensor_msgs.msg import JointState
from std_srvs.srv import SetBool

INTERFACES = ('vcan_rtest', 'vcan_ptest', 'vcan_ltest')
# Refuse any interface currently used by an Ethernet-CAN bridge.
for proc in Path('/proc').glob('[0-9]*/cmdline'):
    try:
        args = proc.read_bytes().replace(b'\0', b' ').decode(errors='replace')
    except OSError:
        continue
    if '/bin/ethernet-can ' in args and any(name in args for name in INTERFACES):
        raise RuntimeError('Test interface is connected to a physical EtherCAN bridge')

os.environ['ROS_DOMAIN_ID'] = '50'
os.environ.pop('FASTRTPS_DEFAULT_PROFILES_FILE', None)
os.environ.pop('ROS_DISCOVERY_SERVER', None)
rclpy.init()
node = rclpy.create_node('rover_contract_test')
publisher = node.create_publisher(Twist, '/rover_base_controller/cmd_vel_unstamped', 1)
controllers = node.create_client(ListControllers, '/rover_controller_manager/list_controllers')
hardware = node.create_client(ListHardwareComponents, '/rover_controller_manager/list_hardware_components')
lights = node.create_client(SetBool, '/power_board/set_headlights')
joint_state = None

def feedback(message):
    global joint_state
    joint_state = message

subscription = node.create_subscription(JointState, '/joint_states', feedback, 10)
sockets = {}
for name in INTERFACES:
    sock = socket.socket(socket.AF_CAN, socket.SOCK_RAW, socket.CAN_RAW)
    sock.setsockopt(socket.SOL_CAN_RAW, 5, 1)
    sock.bind((name,))
    sock.setblocking(False)
    sockets[name] = sock
seq = {}
commands = {}
light_values = []
heartbeat_enabled = True
next_heartbeat = next_feedback = next_command = 0.0
velocity = None

def send(subject, remote, payload):
    key = (subject, remote)
    tid = seq.get(key, 0)
    seq[key] = (tid + 1) % 32
    payload += bytes([0xe0 | tid])
    cid = 0x80000000 | (4 << 26) | 0x00600000 | (subject << 8) | remote
    sockets['vcan_rtest'].send(struct.pack('=IBB2x64s', cid, len(payload), 1, payload))

def pump():
    global next_heartbeat, next_feedback, next_command
    now = time.monotonic()
    if heartbeat_enabled and now >= next_heartbeat:
        for remote in range(1, 7):
            send(7509, remote, struct.pack('<IBBB', int(now) % (2**32), 0, 0, 0))
        next_heartbeat = now + .5
    if now >= next_feedback:
        for remote in range(1, 7):
            send(3000 - remote, remote, struct.pack('<f', 3.0))
        next_feedback = now + .05
    if velocity is not None and now >= next_command:
        message = Twist()
        message.linear.x, message.angular.z = velocity
        publisher.publish(message)
        next_command = now + .05
    rclpy.spin_once(node, timeout_sec=.01)
    for name in ('vcan_rtest', 'vcan_ltest'):
        while True:
            try:
                raw = sockets[name].recv(72)
            except BlockingIOError:
                break
            cid, length = struct.unpack_from('=IB', raw)
            subject = (cid >> 8) & 8191
            if length >= 5 and cid & 127 == 110 and 3001 <= subject <= 3006:
                commands[subject - 3000] = (struct.unpack_from('<f', raw, 8)[0], time.monotonic())
            if name == 'vcan_ltest' and subject == 3000 and length >= 5:
                light_values.append(tuple(struct.unpack_from('<bb', raw, 10)) if struct.unpack_from('<H', raw, 8)[0] == 2 else None)

def until(predicate, timeout, description):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        pump()
        if predicate():
            return
    raise AssertionError(description)

def call(client, request):
    until(lambda: client.service_is_ready(), 20, 'Service unavailable: ' + client.srv_name)
    future = client.call_async(request)
    until(future.done, 10, 'Service call timed out: ' + client.srv_name)
    return future.result()

def assert_commands(left, right, fresh_since):
    return all(remote in commands and commands[remote][1] >= fresh_since and
               math.isclose(commands[remote][0], left if remote <= 3 else right, abs_tol=.005)
               for remote in range(1, 7))

log = open('/tmp/rukahod-rover-contract-test.log', 'w')
launch_args = ['ros2', 'launch', 'silverhand_rover_control', 'silverhand_rover_real.launch.py',
               'can_iface:=vcan_rtest', 'power_board_can_iface:=vcan_ptest',
               'headlights_can_iface:=vcan_ltest', 'use_imu_odometry:=false']
process = subprocess.Popen(launch_args, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
try:
    until(lambda: controllers.service_is_ready(), 25, 'Controller manager did not start')
    until(lambda: all(x.state == 'active' for x in call(controllers, ListControllers.Request()).controller)
          and len(call(controllers, ListControllers.Request()).controller) == 2, 25, 'Controllers not active')
    components = call(hardware, ListHardwareComponents.Request()).component
    assert len(components) == 1 and components[0].state.id == 3, components
    until(lambda: joint_state is not None and len(joint_state.velocity) == 6
          and all(math.isclose(v, 3.0, abs_tol=.005) for v in joint_state.velocity), 3, 'Feedback or polarity mismatch')
    print('PASS hardware active, both controllers active, six feedback channels without inversion', flush=True)
    for linear, angular, left, right in ((.15, 0., 1., 1.), (0., .5, -.5*.64/2/.15, .5*.64/2/.15)):
        since = time.monotonic()
        velocity = (linear, angular)
        until(lambda: assert_commands(left, right, since), 4, 'CAN velocity commands mismatch')
    print('PASS forward and rotation: Twist -> TwistStamped -> diff_drive -> subjects 3001..3006', flush=True)
    since = time.monotonic()
    velocity = None
    until(lambda: assert_commands(0., 0., since), 2, 'cmd_vel timeout did not stop all wheels')
    print('PASS command timeout sends six zero velocities', flush=True)
    for value in (True, False):
        light_values.clear()
        request = SetBool.Request(); request.data = value
        result = call(lights, request)
        assert result.success, result.message
        until(lambda: (int(value), int(value)) in light_values, 2, 'Missing CAN headlights command')
    print('PASS headlights SetBool -> subject 3000, Integer8 array [1,1]/[0,0]', flush=True)
    # Hold a simulated command so heartbeat loss must override a real nonzero setpoint.
    velocity = (.15, 0.)
    until(lambda: assert_commands(1., 1., time.monotonic() - .2), 2, 'No command before heartbeat loss')
    heartbeat_enabled = False
    since = time.monotonic()
    until(lambda: assert_commands(0., 0., since), 10, 'Heartbeat loss did not send zero commands')
    velocity = None
    until(lambda: call(hardware, ListHardwareComponents.Request()).component[0].state.id != 3,
          3, 'Hardware remained active after heartbeat loss')
    print('PASS heartbeat loss stops hardware and sends zero commands (check every 100 writes)', flush=True)
    os.killpg(process.pid, signal.SIGINT)
    process.wait(timeout=15)
    process = subprocess.Popen(launch_args, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        pump()
    components = call(hardware, ListHardwareComponents.Request()).component
    assert components[0].state.id == 2, components
    assert not call(controllers, ListControllers.Request()).controller
    assert process.poll() is None
    print('PASS startup without heartbeat leaves HW inactive and manager alive, no controllers', flush=True)
finally:
    velocity = None
    os.killpg(process.pid, signal.SIGINT)
    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    for sock in sockets.values():
        sock.close()
    node.destroy_node()
    rclpy.shutdown()
    log.close()
