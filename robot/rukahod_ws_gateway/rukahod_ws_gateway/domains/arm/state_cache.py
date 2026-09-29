from __future__ import annotations

from dataclasses import dataclass, field

from .protocol import GROUP_ARM


ARM_JOINT_NAMES = (
    "joint_1", "joint_2", "joint_3", "joint_4", "joint_5", "joint_6",
)

@dataclass(slots=True)
class GroupJointState:
    group_name: str
    names: tuple[str, ...]
    positions_rad: list[float]
    velocities_rad_s: list[float]
    pending_positions_rad: list[float] | None = None


@dataclass(slots=True)
class GatewayStateCache:
    groups: dict[str, GroupJointState] = field(default_factory=dict)
    planning_state: str = "idle"
    execution_state: str = "idle"
    estop_active: bool = False

    @classmethod
    def create_default(cls) -> "GatewayStateCache":
        return cls(
            groups={
                GROUP_ARM: GroupJointState(
                    group_name=GROUP_ARM,
                    names=ARM_JOINT_NAMES,
                    positions_rad=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                    velocities_rad_s=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
                ),
            }
        )
