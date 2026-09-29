from __future__ import annotations

from collections.abc import Callable

from .core.adapter_base import RobotAdapter
from .core.config import GatewayConfig


AdapterFactory = Callable[[GatewayConfig], RobotAdapter]


def resolve_adapter_factory(config: GatewayConfig) -> AdapterFactory:
    if config.domain == "arm":
        if config.mode == "mock":
            from .domains.arm.mock_adapter import MockRobotAdapter
            return MockRobotAdapter
        if config.mode == "ros":
            from .domains.arm.ros_adapter import RosRobotAdapter
            return RosRobotAdapter
        raise ValueError(f"Unsupported arm mode: {config.mode!r}")

    if config.domain == "rover":
        if config.mode == "mock":
            from .domains.rover.mock_adapter import MockRoverAdapter
            return MockRoverAdapter
        if config.mode == "ros":
            from .domains.rover.ros_adapter import RoverRosAdapter
            return RoverRosAdapter
        raise ValueError(f"Unsupported rover mode: {config.mode!r}")

    raise ValueError(f"Unsupported domain: {config.domain!r}")
