#!/usr/bin/env python3
"""Exercise real relay node serialization only on isolated vcan_relaytest/ROS 50."""
import asyncio
import os
from pathlib import Path
import subprocess
import tempfile

os.environ['ROS_DOMAIN_ID'] = '50'
import rclpy
from std_srvs.srv import SetBool
import pycyphal.presentation
import pycyphal.transport.can
from pycyphal.transport.can.media.socketcan import SocketCANMedia
from uavcan.primitive.array import Integer8_1_0

IFACE = 'vcan_relaytest'
for proc in Path('/proc').glob('[0-9]*/cmdline'):
    try:
        command = proc.read_bytes().replace(b'\0', b' ').decode(errors='replace')
    except OSError:
        continue
    if '/bin/ethernet-can ' in command and IFACE in command:
        raise RuntimeError('Test CAN is connected to EtherCAN')


async def main():
    rclpy.init()
    node = rclpy.create_node('relay_contract_test')
    lights = node.create_client(SetBool, '/power_board/set_headlights')
    power = node.create_client(SetBool, '/power_board/set_arm_power')
    presentation = pycyphal.presentation.Presentation(
        pycyphal.transport.can.CANTransport(SocketCANMedia(IFACE, 64), 122))
    subscriber = presentation.make_subscriber(Integer8_1_0, 3000)
    process = None
    executable = '/home/rosuser/rukahod_ws/install/silverhand_rover_control/lib/silverhand_rover_control/headlights_node'

    async def pump(seconds):
        deadline = asyncio.get_running_loop().time() + seconds
        while asyncio.get_running_loop().time() < deadline:
            rclpy.spin_once(node, timeout_sec=0.01)
            await asyncio.sleep(0.01)

    async def start(path):
        nonlocal process
        process = subprocess.Popen([executable, '--ros-args', '-p', f'can_iface:={IFACE}', '-p', f'relay_state_file:={path}'], stdout=subprocess.DEVNULL)
        for _ in range(100):
            await pump(0.05)
            if lights.service_is_ready() and power.service_is_ready():
                break
        assert process.poll() is None
        assert await subscriber.receive_for(0.3) is None, 'Unexpected startup command'

    async def stop():
        nonlocal process
        if process is not None:
            process.terminate()
            process.wait(timeout=5)
            process = None
        # Allow Cyphal transfer-ID sessions to expire between node restarts.
        await pump(2.2)

    async def command(client, enabled, expected):
        request = SetBool.Request(); request.data = enabled
        future = client.call_async(request)
        for _ in range(100):
            await pump(0.05)
            if future.done(): break
        assert future.done(), 'ROS service timeout'
        response = future.result()
        if expected is None:
            assert not response.success
            assert await subscriber.receive_for(0.3) is None
        else:
            assert response.success, response.message
            received = await subscriber.receive_for(2)
            assert received is not None, 'Missing Cyphal command'
            message, metadata = received
            assert metadata.source_node_id == 111
            assert list(message.value) == expected, (list(message.value), expected)
            print('PASS', expected, flush=True)

    try:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'relay.state'
            path.write_text('0 1\n')
            await start(path)
            await command(lights, False, [0, 0])
            await command(power, False, [1, 0])
            await command(lights, True, [1, 1])
            await command(power, True, [0, 1])
            await command(lights, False, [0, 0])
            await stop()
            assert path.read_text().strip() == '0 0'
            await start(path)
            await command(lights, True, [0, 1])
            await stop()
            path.unlink()
            await start(path)
            await command(lights, True, None)
            publisher = presentation.make_publisher(Integer8_1_0, 3000)
            await publisher.publish(Integer8_1_0(value=[0, 1]))
            await pump(0.5)
            while await subscriber.receive_for(0.1) is not None:
                pass
            await command(lights, False, [0, 0])
            assert path.read_text().strip() == '0 0'
            print('PASS external command observation and initialization', flush=True)
            print('PASS restart preservation, no startup publish, unknown-state rejection', flush=True)
    finally:
        await stop()
        presentation.close()
        node.destroy_node()
        rclpy.shutdown()


asyncio.run(main())
