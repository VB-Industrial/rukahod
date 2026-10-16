#!/usr/bin/env python3
"""Power button readiness indication; never sends drive or relay commands."""
import asyncio
import logging
import os
import subprocess
import sys
import time

sys.path.insert(0, '/opt/cyphal/generated')
import pycyphal.presentation
import pycyphal.transport.can
from pycyphal.transport.can.media.socketcan import SocketCANMedia
import rclpy
from controller_manager_msgs.srv import ListControllers, ListHardwareComponents
from voltbro.hmi.led_service_1_0 import led_service_1_0

LOG = logging.getLogger('powerboard_ready_led')


def ready(hardware, controllers, services_ok):
    return (services_ok and hardware is not None and controllers is not None
            and any(x.name == 'SilverhandRoverSystem' and x.state.id == 3 for x in hardware.component)
            and any(x.name == 'rover_base_controller' and x.state == 'active' for x in controllers.controller))


async def main():
    rclpy.init()
    node = rclpy.create_node('powerboard_ready_led')
    hardware = node.create_client(ListHardwareComponents, '/rover_controller_manager/list_hardware_components')
    controllers = node.create_client(ListControllers, '/rover_controller_manager/list_controllers')
    presentation = pycyphal.presentation.Presentation(pycyphal.transport.can.CANTransport(
        SocketCANMedia(os.environ.get('POWERBOARD_CAN_IFACE', 'vcan2.1'), 64), 124))
    led = presentation.make_client(led_service_1_0, 172, 9)
    led.response_timeout = 1.0

    async def call(client, request):
        if not client.service_is_ready():
            return None
        future = client.call_async(request)
        deadline = time.monotonic() + 1
        try:
            while not future.done() and time.monotonic() < deadline:
                rclpy.spin_once(node, timeout_sec=0)
                await asyncio.sleep(.02)
            return future.result() if future.done() else None
        finally:
            if not future.done():
                client.remove_pending_request(future)
                future.cancel()

    async def set_color(is_ready):
        request = led_service_1_0.Request()
        request.r.value = 0 if is_ready else 255
        request.g.value = 255
        request.b.value = 0
        request.duration.second = 0
        request.frequency.hertz = 0
        request.interface.value = 0
        response = await led.call(request)
        return response is not None and response[0].accepted.value

    last_applied = None
    last_sent = 0.0
    try:
        while rclpy.ok():
            hw = await call(hardware, ListHardwareComponents.Request())
            ctrl = await call(controllers, ListControllers.Request())
            status = await asyncio.create_subprocess_exec('systemctl', 'is-active',
                'rukahod-rover-gateway.service', 'rukahod-ui.service',
                stdout=asyncio.subprocess.PIPE, stderr=subprocess.DEVNULL)
            output, _ = await status.communicate()
            services_ok = output.decode().splitlines() == ["active", "active"]
            is_ready = ready(hw, ctrl, services_ok)
            # Periodically refresh even unchanged state: PowerBoard may reboot.
            if is_ready != last_applied or time.monotonic() - last_sent >= 10:
                if await set_color(is_ready):
                    if is_ready != last_applied:
                        LOG.info('PowerBoard button: %s', 'green (rover ready)' if is_ready else 'yellow (not ready)')
                    last_applied = is_ready
                    last_sent = time.monotonic()
                else:
                    LOG.warning('PowerBoard did not accept LED command; will retry')
            await asyncio.sleep(2)
    finally:
        presentation.close()
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
