"""Readiness and lifecycle recovery for one ros2_control domain."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Any

from controller_manager_msgs.srv import (
    ConfigureController,
    ListControllers,
    ListHardwareComponents,
    LoadController,
    SetHardwareComponentState,
    SwitchController,
)
from lifecycle_msgs.msg import State
from rclpy.node import Node

LOGGER = logging.getLogger("rukahod_ws_gateway.controller_gate")


class ControllerGate:
    def __init__(self, node: Node, manager: str, hardware: str, controller: str, *, recover_initial: bool = True) -> None:
        prefix = manager.rstrip("/")
        self._hardware = hardware
        self._controller = controller
        self._components = node.create_client(ListHardwareComponents, f"{prefix}/list_hardware_components")
        self._controllers = node.create_client(ListControllers, f"{prefix}/list_controllers")
        self._set_hardware = node.create_client(SetHardwareComponentState, f"{prefix}/set_hardware_component_state")
        self._switch = node.create_client(SwitchController, f"{prefix}/switch_controller")
        self._load = node.create_client(LoadController, f"{prefix}/load_controller")
        self._configure = node.create_client(ConfigureController, f"{prefix}/configure_controller")
        self._recover_initial = recover_initial
        self._seen_ready = False
        self._last_recovery = 0.0
        self._recovery_task: asyncio.Task[None] | None = None

    async def stop(self) -> None:
        if self._recovery_task is not None:
            self._recovery_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._recovery_task
            self._recovery_task = None

    async def _call(self, client: Any, request: Any, timeout: float = 1.0) -> Any | None:
        if not client.service_is_ready():
            return None
        future = client.call_async(request)
        loop = asyncio.get_running_loop()
        result: asyncio.Future[Any] = loop.create_future()

        def done(source: Any) -> None:
            if result.done():
                return
            try:
                value = source.result()
            except Exception as exc:
                loop.call_soon_threadsafe(lambda error=exc: not result.done() and result.set_exception(error))
            else:
                loop.call_soon_threadsafe(lambda: not result.done() and result.set_result(value))

        future.add_done_callback(done)
        try:
            return await asyncio.wait_for(result, timeout)
        except Exception as exc:
            LOGGER.debug("Controller manager service unavailable: %s", exc)
            return None

    async def is_ready(self) -> bool:
        components = await self._call(self._components, ListHardwareComponents.Request())
        controllers = await self._call(self._controllers, ListControllers.Request())
        if components is None or controllers is None:
            return False
        hardware = next((item for item in components.component if item.name == self._hardware), None)
        controller = next((item for item in controllers.controller if item.name == self._controller), None)
        hardware_active = hardware is not None and hardware.state.id == State.PRIMARY_STATE_ACTIVE
        controller_active = controller is not None and controller.state == "active"
        if hardware_active and controller_active:
            self._seen_ready = True
            return True
        # The arm launch owns initial activation/spawning. Recover only after
        # observing its successful startup, avoiding concurrent lifecycle calls.
        if not self._recover_initial and not self._seen_ready:
            return False

        # Retry lifecycle transitions independently for each domain. Hardware activation
        # itself validates Cyphal heartbeat; an absent device cannot open the WS port.
        now = asyncio.get_running_loop().time()
        if now - self._last_recovery >= 2.0 and (self._recovery_task is None or self._recovery_task.done()):
            self._last_recovery = now
            self._recovery_task = asyncio.create_task(self._recover(hardware, controller, hardware_active, controller_active))
        return False

    async def _recover(self, hardware: Any, controller: Any, hardware_active: bool, controller_active: bool) -> None:
        try:
            await self._recover_lifecycle(hardware, controller, hardware_active, controller_active)
        except Exception:
            LOGGER.exception("Controller lifecycle recovery failed")

    async def _recover_lifecycle(self, hardware: Any, controller: Any, hardware_active: bool, controller_active: bool) -> None:
        if hardware is not None and not hardware_active:
            if hardware.state.id != State.PRIMARY_STATE_INACTIVE:
                request = SetHardwareComponentState.Request()
                request.name = self._hardware
                request.target_state.id = State.PRIMARY_STATE_INACTIVE
                request.target_state.label = "inactive"
                response = await self._call(self._set_hardware, request, timeout=3.0)
                if response is None or not response.ok:
                    return
            request = SetHardwareComponentState.Request()
            request.name = self._hardware
            request.target_state.id = State.PRIMARY_STATE_ACTIVE
            request.target_state.label = "active"
            response = await self._call(self._set_hardware, request, timeout=8.0)
            if response is None or not response.ok:
                return
        if controller is None:
            request = LoadController.Request()
            request.name = self._controller
            response = await self._call(self._load, request, timeout=3.0)
            if response is None or not response.ok:
                return
        if controller is None or controller.state == "unconfigured":
            request = ConfigureController.Request()
            request.name = self._controller
            response = await self._call(self._configure, request, timeout=3.0)
            if response is None or not response.ok:
                return
        if not controller_active:
            request = SwitchController.Request()
            request.activate_controllers = [self._controller]
            request.strictness = SwitchController.Request.STRICT
            request.activate_asap = True
            request.timeout.sec = 5
            response = await self._call(self._switch, request, timeout=6.0)
            if response is None or not response.ok:
                return
