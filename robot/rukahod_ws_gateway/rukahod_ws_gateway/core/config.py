from dataclasses import dataclass


@dataclass(slots=True)
class GatewayConfig:
    domain: str = "arm"
    mode: str = "mock"
    host: str = "0.0.0.0"
    port: int = 8765
    heartbeat_interval_s: float = 3.0
    mock_step_s: float = 0.05
    mock_steps_per_execute: int = 20
    mock_max_joint_velocity_rad_s: float = 1.2
    arm_use_moveit: bool = False
    arm_limits_file: str = ""
    rover_cmd_vel_topic: str = "/rover_base_controller/cmd_vel_unstamped"
    rover_odom_topic: str = "/rover_base_controller/odom"
    rover_imu_mount_roll_deg: float = 0.0
    rover_imu_mount_pitch_deg: float = 0.0
    rover_imu_mount_yaw_deg: float = 0.0
    rover_imu_topic: str = "/imu_sensor_broadcaster/imu"
    rover_battery_topic: str = "/battery_state"
    rover_headlights_service: str = "/power_board/set_headlights"
    rover_cmd_vel_max_hz: float = 20.0
    rover_telemetry_max_hz: float = 20.0
