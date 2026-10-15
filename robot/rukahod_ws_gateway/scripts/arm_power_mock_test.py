#!/usr/bin/env python3
"""Power command/result/state contract on localhost mock; no ROS or physical CAN."""
import asyncio
import json
import websockets
from rukahod_ws_gateway.core.config import GatewayConfig
from rukahod_ws_gateway.core.server import GatewayServer
from rukahod_ws_gateway.domains.rover.mock_adapter import MockRoverAdapter


async def receive(ws, kind, predicate=lambda payload: True):
    for _ in range(100):
        message = json.loads(await asyncio.wait_for(ws.recv(), 3))
        if message['type'] == kind and predicate(message['payload']):
            return message['payload']
    raise AssertionError(kind)


async def main():
    cfg = GatewayConfig(domain='rover', mode='mock', host='127.0.0.1', port=18976)
    adapter = MockRoverAdapter(cfg)
    server = GatewayServer(cfg, adapter)
    task = asyncio.create_task(server.run_forever())
    await asyncio.sleep(.1)
    try:
        async with websockets.connect('ws://127.0.0.1:18976') as ws:
            await receive(ws, 'arm_power_state', lambda p: p['available'])
            for enabled in (True, False, True):
                command_id = f'power-{enabled}'
                await ws.send(json.dumps({'type': 'set_arm_power', 'payload': {'enabled': enabled, 'command_id': command_id}}))
                result = await receive(ws, 'arm_power_result', lambda p: p['command_id'] == command_id)
                assert result['success'] and result['enabled'] is enabled
                await receive(ws, 'arm_power_state', lambda p: p['commanded_enabled'] is enabled)
            await ws.send(json.dumps({'type': 'set_headlights', 'payload': {'enabled': True}}))
            await receive(ws, 'arm_power_state', lambda p: p['commanded_enabled'] is True)
        await asyncio.sleep(.1)
        async with websockets.connect('ws://127.0.0.1:18976') as ws:
            state = await receive(ws, 'arm_power_state')
            assert state['commanded_enabled'] is True
        print('PASS power on/off acknowledgments, independent lights, reconnect preserves power')
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await server.shutdown()


asyncio.run(main())
