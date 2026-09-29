from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from websockets.exceptions import ConnectionClosed
from websockets.server import WebSocketServerProtocol, serve

from .adapter_base import RobotAdapter
from .config import GatewayConfig
from .protocol import dumps_message, loads_message, make_fault_state, make_hello_ack, make_pong


LOGGER = logging.getLogger("rukahod_ws_gateway")


def summarize_message(message: dict[str, Any]) -> str:
    message_type = message.get("type", "<unknown>")
    payload = message.get("payload", {})
    if not isinstance(payload, dict):
        return str(message_type)

    if message_type in {"set_joint_goal", "set_pose_goal"}:
        goal = payload.get("goal", payload)
        if isinstance(goal, dict):
            group_name = goal.get("group_name", "?")
            return f"{message_type} group={group_name}"
    if message_type in {"execute", "plan", "stop"}:
        group_name = payload.get("group_name") or payload.get("options", {}).get("group_name")
        return f"{message_type} group={group_name}"
    if message_type in {"hello", "ping"}:
        return str(message_type)
    return f"{message_type} payload_keys={sorted(payload.keys())}"


class GatewayServer:
    def __init__(self, config: GatewayConfig, adapter: RobotAdapter) -> None:
        self._config = config
        self._adapter = adapter
        self._clients: set[WebSocketServerProtocol] = set()
        self._operator: WebSocketServerProtocol | None = None

    async def run_forever(self) -> None:
        await self._adapter.start(self.broadcast)
        listener = None
        try:
            while True:
                try:
                    ready = await self._adapter.is_ready()
                except Exception:
                    LOGGER.exception("Readiness check failed for %s", self._config.domain)
                    ready = False
                if ready and listener is None:
                    listener = await serve(self._handle_client, self._config.host, self._config.port, ping_interval=None)
                    LOGGER.info("Gateway listening on ws://%s:%s domain=%s mode=%s",
                                self._config.host, self._config.port, self._config.domain, self._config.mode)
                elif not ready and listener is not None:
                    listener.close()
                    for client in tuple(self._clients):
                        await client.close(code=1012, reason="Controller unavailable")
                    await listener.wait_closed()
                    listener = None
                    await self._adapter.on_disconnect()
                    LOGGER.warning("Gateway port closed: %s controller unavailable", self._config.domain)
                await asyncio.sleep(0.5)
        finally:
            if listener is not None:
                listener.close()
            for client in tuple(self._clients):
                await client.close(code=1001, reason="Gateway shutdown")
            if listener is not None:
                await listener.wait_closed()

    async def shutdown(self) -> None:
        await self._adapter.stop()

    async def broadcast(self, message: dict[str, Any]) -> None:
        LOGGER.debug("Broadcast -> %d client(s): %s", len(self._clients), summarize_message(message))
        if not self._clients:
            return
        encoded = dumps_message(message)
        stale_clients: list[WebSocketServerProtocol] = []
        for client in tuple(self._clients):
            try:
                await client.send(encoded)
            except ConnectionClosed:
                stale_clients.append(client)
        for client in stale_clients:
            self._clients.discard(client)

    async def _handle_client(self, websocket: WebSocketServerProtocol) -> None:
        if self._operator is not None:
            await websocket.close(code=1013, reason="Operator already connected")
            return
        self._operator = websocket
        self._clients.add(websocket)
        LOGGER.info("Client connected: %s", websocket.remote_address)
        try:
            await self._adapter.on_connect()
            async for raw_message in websocket:
                try:
                    message = loads_message(raw_message)
                    await self._dispatch_message(websocket, message)
                except Exception as exc:  # noqa: BLE001
                    LOGGER.exception("Failed to process message")
                    await websocket.send(
                        dumps_message(
                            make_fault_state(
                                "bad_message",
                                str(exc),
                                severity="error",
                                active=True,
                            )
                        )
                    )
        finally:
            self._clients.discard(websocket)
            if self._operator is websocket:
                self._operator = None
                await self._adapter.on_disconnect()
            LOGGER.info("Client disconnected: %s", websocket.remote_address)

    async def _dispatch_message(self, websocket: WebSocketServerProtocol, message: dict[str, Any]) -> None:
        message_type = message.get("type")
        payload = message.get("payload", {})
        LOGGER.info("Received <- %s from %s", summarize_message(message), websocket.remote_address)

        if message_type == "hello":
            await websocket.send(dumps_message(make_hello_ack(self._adapter.server_name, self._adapter.groups)))
            return
        if message_type == "ping":
            pong_payload = payload if isinstance(payload, dict) else {}
            await websocket.send(dumps_message(make_pong(pong_payload)))
            return

        await self._adapter.handle_message(message)


async def run_gateway(config: GatewayConfig, adapter_factory: Callable[[GatewayConfig], RobotAdapter]) -> None:
    server = GatewayServer(config, adapter_factory(config))
    try:
        await server.run_forever()
    finally:
        with contextlib.suppress(Exception):
            await server.shutdown()
