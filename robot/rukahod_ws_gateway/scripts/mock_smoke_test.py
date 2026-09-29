#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
from typing import Any

import websockets


async def recv_json(ws: websockets.ClientConnection) -> dict[str, Any]:
    raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
    print(raw)
    return json.loads(raw)


async def recv_until(ws: websockets.ClientConnection, expected_type: str, *, max_messages: int = 8) -> dict[str, Any]:
    for _ in range(max_messages):
        message = await recv_json(ws)
        if message.get("type") == expected_type:
            return message
    raise RuntimeError(f"Did not receive message type {expected_type!r} within {max_messages} messages")


async def recv_until_predicate(
    ws: websockets.ClientConnection,
    predicate,
    *,
    description: str,
    max_messages: int = 8,
) -> dict[str, Any]:
    for _ in range(max_messages):
        message = await recv_json(ws)
        if predicate(message):
            return message
    raise RuntimeError(f"Did not receive {description} within {max_messages} messages")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-test client for rukahod_ws_gateway mock mode")
    parser.add_argument("--url", default="ws://127.0.0.1:8765")
    parser.add_argument("--domain", choices=("arm", "rover"), default="arm")
    args = parser.parse_args()

    async with websockets.connect(args.url) as ws:
        hello_payload: dict[str, Any] = {"protocol_version": 1, "client_name": "smoke-test"}
        if args.domain == "arm":
            hello_payload["requested_groups"] = ["arm"]
        else:
            hello_payload["requested_groups"] = ["rover"]
        await ws.send(json.dumps({"type": "hello", "payload": hello_payload}))
        hello = await recv_until(ws, "hello_ack")
        assert args.domain in hello["payload"]["groups"]

        await ws.send(json.dumps({"type": "ping", "payload": {"heartbeat_id": "smoke-hb"}}))
        pong = await recv_until(ws, "pong")
        assert pong["payload"]["heartbeat_id"] == "smoke-hb"

        if args.domain == "rover":
            await ws.send(
                json.dumps(
                    {
                        "type": "cmd_vel",
                        "payload": {
                            "command_id": "rover-smoke",
                            "frame_id": "base_link",
                            "linear_m_s": 0.2,
                            "angular_rad_s": 0.1,
                            "source": "mock_autonomy",
                            "turbo": False,
                        },
                    }
                )
            )
            await recv_until_predicate(
                ws,
                lambda message: message.get("type") == "odometry"
                and message.get("payload", {}).get("linear_m_s", 0.0) > 0.0,
                description="nonzero rover odometry",
                max_messages=30,
            )

            await ws.send(
                json.dumps(
                    {
                        "type": "set_headlights",
                        "payload": {
                            "command_id": "rover-headlights",
                            "enabled": True,
                        },
                    }
                )
            )
            await recv_until_predicate(
                ws,
                lambda message: message.get("type") == "rover_state"
                and message.get("payload", {}).get("headlights_enabled") is True,
                description="rover_state with headlights_enabled=true",
            )
            return

        await ws.send(
            json.dumps(
                {
                    "type": "set_joint_goal",
                    "payload": {
                        "command_id": "smoke-goal",
                        "goal": {
                            "group_name": "arm",
                            "joint_names": [
                                "joint_1",
                                "joint_2",
                                "joint_3",
                                "joint_4",
                                "joint_5",
                                "joint_6",
                            ],
                            "positions_rad": [0.0, 1.8, -0.6, 0.0, 1.57, 0.0],
                        },
                    },
                }
            )
        )
        await recv_until_predicate(
            ws,
            lambda message: message.get("type") == "planning_state"
            and message.get("payload", {}).get("status") == "goal_set",
            description="accepted arm goal",
        )

        await ws.send(json.dumps({"type": "execute", "payload": {"command_id": "smoke-exec", "group_name": "arm"}}))
        await recv_until_predicate(
            ws,
            lambda message: message.get("type") == "execution_state"
            and message.get("payload", {}).get("status") == "executing",
            description="arm execution started",
        )
        await recv_until_predicate(
            ws,
            lambda message: message.get("type") == "joint_state"
            and any(abs(position) > 0.01 for position in message.get("payload", {}).get("position_rad", [])),
            description="moving arm joint state",
            max_messages=30,
        )


if __name__ == "__main__":
    asyncio.run(main())
