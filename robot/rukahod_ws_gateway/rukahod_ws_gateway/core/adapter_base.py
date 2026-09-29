from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from typing import Any


EventSink = Callable[[dict[str, Any]], Awaitable[None]]


class RobotAdapter(ABC):
    server_name: str
    groups: tuple[str, ...]

    async def is_ready(self) -> bool:
        return True

    async def on_disconnect(self) -> None:
        """Stop commands owned by a lost operator session."""

    async def on_connect(self) -> None:
        """Publish current state to a newly connected operator."""

    @abstractmethod
    async def start(self, event_sink: EventSink) -> None:
        raise NotImplementedError

    @abstractmethod
    async def stop(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def handle_message(self, message: dict[str, Any]) -> None:
        raise NotImplementedError
