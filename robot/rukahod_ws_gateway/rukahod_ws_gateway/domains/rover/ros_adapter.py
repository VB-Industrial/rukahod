from __future__ import annotations

import asyncio
import contextlib
import logging
import math
import threading
import time
from typing import Any

import rclpy
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rclpy.client import Client
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import BatteryState, Imu
from std_srvs.srv import SetBool

from ...core.adapter_base import EventSink, RobotAdapter
from ...core.config import GatewayConfig
from ...core.controller_gate import ControllerGate
from ...core.protocol import as_dict, make_fault_state, make_message
from .protocol import GROUP_ROVER, as_drive_mode, make_rover_state, normalize_input_source


LOGGER = logging.getLogger("rukahod_ws_gateway.rover.ros")


class RoverRosAdapter(RobotAdapter):
    server_name = "rukahod_ws_gateway_rover"
    groups = (GROUP_ROVER,)

    def __init__(self, config: GatewayConfig) -> None:
        self._config = config
        self._event_sink: EventSink | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._node: Node | None = None
        self._cmd_vel_publisher: Any = None
        self._headlights_client: Client | None = None
        self._gate: ControllerGate | None = None
        self._spin_thread: threading.Thread | None = None
        self._status_task: asyncio.Task[None] | None = None
        self._stop_event = threading.Event()
        self._rclpy_owned = False
        self._drive_mode = "manual"
        self._ready = True
        self._input_source = "keyboard_mouse"
        self._estop_active = False
        self._headlights_enabled = False
        self._last_command_monotonic = time.monotonic()
        self._last_cmd_vel_publish_monotonic = 0.0
        self._last_emit_monotonic_by_type: dict[str, float] = {}
        self._odometer_km = 0.0
        self._last_xy: tuple[float, float] | None = None
        self._roll_deg = 0.0
        self._pitch_deg = 0.0
        self._imu_reference = (0.0, 0.0, 0.0, 1.0)
        self._imu_corrected = None
        self._imu_received_at = 0.0
        self._heading_deg_from_imu: float | None = None

    async def start(self, event_sink: EventSink) -> None:
        self._event_sink = event_sink
        self._loop = asyncio.get_running_loop()

        if not rclpy.ok():
            rclpy.init(args=None)
            self._rclpy_owned = True

        self._node = rclpy.create_node("rukahod_ws_gateway_rover")
        self._cmd_vel_publisher = self._node.create_publisher(Twist, self._config.rover_cmd_vel_topic, 10)
        self._gate = ControllerGate(self._node, "/rover_controller_manager", "SilverhandRoverSystem", "rover_base_controller")
        self._node.create_subscription(Odometry, self._config.rover_odom_topic, self._on_odometry, 10)
        self._node.create_subscription(Imu, self._config.rover_imu_topic, self._on_imu, qos_profile_sensor_data)
        self._node.create_subscription(BatteryState, self._config.rover_battery_topic, self._on_battery_state, 10)
        self._headlights_client = self._node.create_client(SetBool, self._config.rover_headlights_service)

        self._spin_thread = threading.Thread(target=self._spin_worker, name="rukahod_ws_gateway_rover_spin", daemon=True)
        self._spin_thread.start()
        self._status_task = asyncio.create_task(self._status_loop())

        await self._publish_rover_state()

        headlights_ready = await self._wait_for_service(self._headlights_client, timeout_s=1.0)
        if headlights_ready:
            await self._emit(
                make_fault_state(
                    "rover_adapter_ready",
                    "Rover ROS adapter connected.",
                    severity="info",
                    active=False,
                )
            )
        else:
            await self._emit(
                make_fault_state(
                    "headlights_service_unavailable",
                    f"Headlights service {self._config.rover_headlights_service} is unavailable.",
                    severity="warning",
                    active=False,
                )
            )

    async def stop(self) -> None:
        self._stop_event.set()
        self._publish_zero_twist()
        if self._gate is not None:
            await self._gate.stop()
        if self._status_task is not None:
            self._status_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._status_task
            self._status_task = None

        if self._spin_thread is not None:
            self._spin_thread.join(timeout=1.0)
            self._spin_thread = None

        if self._node is not None:
            self._node.destroy_node()
            self._node = None

        self._cmd_vel_publisher = None
        self._headlights_client = None
        self._gate = None

        if self._rclpy_owned and rclpy.ok():
            rclpy.shutdown()
            self._rclpy_owned = False

    async def is_ready(self) -> bool:
        return self._gate is not None and await self._gate.is_ready()

    async def on_disconnect(self) -> None:
        self._publish_zero_twist()

    async def on_connect(self) -> None:
        await self._publish_rover_state()

    async def handle_message(self, message: dict[str, Any]) -> None:
        message_type = message.get("type")
        payload = as_dict(message.get("payload", {}), field_name="payload")
        legacy_payload = message if isinstance(message, dict) else {}

        if message_type == "reset_gyrocompass":
            if self._imu_corrected is None or time.monotonic() - self._imu_received_at >= 1.0:
                await self._emit(make_fault_state("imu_reset_unavailable", "No fresh IMU orientation for reset.", severity="warning", active=False))
                return
            self._imu_reference = self._imu_corrected
            self._roll_deg = self._pitch_deg = self._heading_deg_from_imu = 0.0
            await self._emit(make_fault_state("imu_reset", "Gyrocompass reference reset.", severity="info", active=False))
            return
        if message_type == "cmd_vel":
            await self._handle_cmd_vel(payload or legacy_payload)
            return
        if message_type == "stop":
            await self._handle_stop()
            return
        if message_type == "estop":
            await self._handle_estop()
            return
        if message_type == "reset_estop":
            await self._handle_reset_estop()
            return
        if message_type == "set_drive_mode":
            await self._handle_set_drive_mode(payload)
            return
        if message_type == "set_headlights":
            await self._handle_set_headlights(payload)
            return

    async def _handle_cmd_vel(self, payload: dict[str, Any]) -> None:
        if self._estop_active:
            await self._emit(make_fault_state("rover_estop_active", "Ignoring cmd_vel because E-STOP is active.", severity="warning", active=True))
            await self._publish_rover_state()
            return

        linear_value = payload.get("linear_m_s", payload.get("linear", payload.get("x", 0.0)))
        angular_value = payload.get("angular_rad_s", payload.get("angular", payload.get("z", 0.0)))
        now = time.monotonic()

        self._input_source = normalize_input_source(payload, default=self._input_source)
        if not self._should_publish_cmd_vel(now):
            return

        twist = Twist()
        twist.linear.x = float(linear_value)
        twist.angular.z = float(angular_value)
        self._cmd_vel_publisher.publish(twist)

        self._last_cmd_vel_publish_monotonic = now
        self._last_command_monotonic = now
        await self._publish_rover_state()

    async def _handle_stop(self) -> None:
        self._publish_zero_twist()
        self._last_command_monotonic = time.monotonic()
        await self._publish_rover_state()

    async def _handle_estop(self) -> None:
        self._estop_active = True
        self._publish_zero_twist()
        await self._emit(make_fault_state("rover_estop_active", "Emergency stop active.", severity="fatal", active=True))
        await self._publish_rover_state()

    async def _handle_reset_estop(self) -> None:
        self._estop_active = False
        self._last_command_monotonic = time.monotonic()
        await self._emit(make_fault_state("rover_estop_active", "Emergency stop reset.", severity="info", active=False))
        await self._publish_rover_state()

    async def _handle_set_drive_mode(self, payload: dict[str, Any]) -> None:
        self._drive_mode = as_drive_mode(payload)
        await self._publish_rover_state()

    async def _handle_set_headlights(self, payload: dict[str, Any]) -> None:
        if self._headlights_client is None:
            await self._emit(make_fault_state("headlights_client_missing", "Headlights client is not ready.", severity="error", active=True))
            await self._publish_rover_state()
            return

        enabled = bool(payload.get("enabled", False))
        request = SetBool.Request()
        request.data = enabled

        if not await self._wait_for_service(self._headlights_client, timeout_s=1.0):
            await self._emit(
                make_fault_state(
                    "headlights_service_unavailable",
                    f"Headlights service {self._config.rover_headlights_service} is unavailable.",
                    severity="warning",
                    active=True,
                )
            )
            await self._publish_rover_state()
            return

        response = await self._await_rclpy_future(self._headlights_client.call_async(request))
        if not response.success:
            await self._emit(make_fault_state("headlights_call_failed", response.message or "Headlights service call failed.", severity="error", active=True))
            await self._publish_rover_state()
            return

        self._headlights_enabled = enabled
        await self._emit(make_fault_state("headlights_changed", response.message or ("Headlights enabled" if enabled else "Headlights disabled"), severity="info", active=False))
        await self._publish_rover_state()

    async def _status_loop(self) -> None:
        while True:
            await asyncio.sleep(0.2)
            await self._publish_rover_state()

    def _spin_worker(self) -> None:
        assert self._node is not None
        while rclpy.ok() and not self._stop_event.is_set():
            try:
                rclpy.spin_once(self._node, timeout_sec=0.1)
            except ExternalShutdownException:
                break

    def _on_odometry(self, message: Odometry) -> None:
        if not self._should_emit_message("odometry"):
            return
        orientation = message.pose.pose.orientation
        imu_valid = time.monotonic() - self._imu_received_at < 1.0
        heading_deg = self._heading_deg_from_imu if imu_valid else None
        if heading_deg is None:
            heading_deg = _yaw_from_quaternion_deg(orientation.x, orientation.y, orientation.z, orientation.w)
        x_m = float(message.pose.pose.position.x)
        y_m = float(message.pose.pose.position.y)

        if self._last_xy is not None:
            dx = x_m - self._last_xy[0]
            dy = y_m - self._last_xy[1]
            self._odometer_km += math.hypot(dx, dy) / 1000.0
        self._last_xy = (x_m, y_m)

        self._emit_from_thread(
            make_message(
                "odometry",
                {
                    "linear_m_s": float(message.twist.twist.linear.x),
                    "angular_rad_s": float(message.twist.twist.angular.z),
                    "heading_deg": heading_deg,
                    "odometer_km": self._odometer_km,
                    "x_m": x_m,
                    "y_m": y_m,
                    "imu_valid": imu_valid,
                    "roll_deg": self._roll_deg,
                    "pitch_deg": self._pitch_deg,
                },
            )
        )

    def _on_imu(self, message: Imu) -> None:
        q = message.orientation
        norm = math.sqrt(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w)
        if message.orientation_covariance[0] < 0 or not math.isfinite(norm) or norm < 0.5:
            return
        self._imu_received_at = time.monotonic()
        # q_world_sensor = q_world_rover * q_rover_sensor.
        # Apply the inverse mounting rotation before extracting Euler angles.
        mount = _quaternion_from_euler_deg(
            self._config.rover_imu_mount_roll_deg,
            self._config.rover_imu_mount_pitch_deg,
            self._config.rover_imu_mount_yaw_deg,
        )
        corrected = _multiply_quaternions(
            (q.x / norm, q.y / norm, q.z / norm, q.w / norm),
            (-mount[0], -mount[1], -mount[2], mount[3]),
        )
        self._imu_corrected = corrected
        ref = self._imu_reference
        relative = _multiply_quaternions((-ref[0], -ref[1], -ref[2], ref[3]), corrected)
        roll_deg, pitch_deg, heading_deg = _euler_from_quaternion_deg(*relative)
        self._roll_deg = roll_deg
        self._pitch_deg = pitch_deg
        self._heading_deg_from_imu = heading_deg

    def _on_battery_state(self, message: BatteryState) -> None:
        if not self._should_emit_message("battery_state"):
            return
        percent = float(message.percentage * 100.0) if math.isfinite(message.percentage) and message.percentage >= 0.0 else 0.0
        self._emit_from_thread(
            make_message(
                "battery_state",
                {
                    "percent": percent,
                    "percent_valid": math.isfinite(message.percentage) and message.percentage >= 0.0 and message.capacity > 0.0,
                    "charge_ah": float(message.charge),
                    "capacity_ah": float(message.capacity),
                    "present": bool(message.present),
                    "voltage_v": float(message.voltage),
                    "current_a": float(message.current),
                },
            )
        )

    def _publish_zero_twist(self) -> None:
        if self._cmd_vel_publisher is None:
            return
        twist = Twist()
        self._cmd_vel_publisher.publish(twist)

    async def _publish_rover_state(self) -> None:
        if not self._should_emit_message("rover_state"):
            return
        await self._emit(
            make_rover_state(
                mode=self._drive_mode,
                ready=self._ready,
                control_active=not self._estop_active,
                headlights_enabled=self._headlights_enabled,
                input_source=self._input_source,
                signal_quality="strong",
                command_age_ms=(time.monotonic() - self._last_command_monotonic) * 1000.0,
            )
        )

    async def _wait_for_service(self, client: Client | None, *, timeout_s: float) -> bool:
        if client is None:
            return False
        try:
            return bool(await asyncio.to_thread(client.wait_for_service, timeout_s))
        except Exception as exc:  # noqa: BLE001
            LOGGER.warning("Failed while waiting for service: %s", exc)
            return False

    async def _emit(self, message: dict[str, Any]) -> None:
        if self._event_sink is None:
            return
        await self._event_sink(message)

    def _emit_from_thread(self, message: dict[str, Any]) -> None:
        if self._event_sink is None or self._loop is None:
            return
        future = asyncio.run_coroutine_threadsafe(self._event_sink(message), self._loop)
        future.add_done_callback(_log_threadsafe_future)

    def _should_publish_cmd_vel(self, now: float) -> bool:
        max_hz = max(float(self._config.rover_cmd_vel_max_hz), 0.0)
        if max_hz <= 0.0:
            return True
        min_period_s = 1.0 / max_hz
        return (now - self._last_cmd_vel_publish_monotonic) >= min_period_s

    def _should_emit_message(self, message_type: str) -> bool:
        max_hz = max(float(self._config.rover_telemetry_max_hz), 0.0)
        if max_hz <= 0.0:
            return True
        now = time.monotonic()
        last_emit = self._last_emit_monotonic_by_type.get(message_type, 0.0)
        min_period_s = 1.0 / max_hz
        if (now - last_emit) < min_period_s:
            return False
        self._last_emit_monotonic_by_type[message_type] = now
        return True

    async def _await_rclpy_future(self, future: Any) -> Any:
        loop = asyncio.get_running_loop()
        wrapped: asyncio.Future[Any] = loop.create_future()

        def _done_callback(done_future: Any) -> None:
            try:
                result = done_future.result()
            except Exception as exc:  # noqa: BLE001
                loop.call_soon_threadsafe(wrapped.set_exception, exc)
            else:
                loop.call_soon_threadsafe(wrapped.set_result, result)

        future.add_done_callback(_done_callback)
        return await wrapped


def _yaw_from_quaternion_deg(x: float, y: float, z: float, w: float) -> float:
    _, _, yaw_deg = _euler_from_quaternion_deg(x, y, z, w)
    return yaw_deg


def _euler_from_quaternion_deg(x: float, y: float, z: float, w: float) -> tuple[float, float, float]:
    sinr_cosp = 2.0 * (w * x + y * z)
    cosr_cosp = 1.0 - 2.0 * (x * x + y * y)
    roll_rad = math.atan2(sinr_cosp, cosr_cosp)

    sinp = 2.0 * (w * y - z * x)
    if abs(sinp) >= 1.0:
        pitch_rad = math.copysign(math.pi / 2.0, sinp)
    else:
        pitch_rad = math.asin(sinp)

    siny_cosp = 2.0 * (w * z + x * y)
    cosy_cosp = 1.0 - 2.0 * (y * y + z * z)
    yaw_rad = math.atan2(siny_cosp, cosy_cosp)
    heading_deg = math.degrees(yaw_rad) % 360.0
    if heading_deg < 0.0:
        heading_deg += 360.0
    return math.degrees(roll_rad), math.degrees(pitch_rad), heading_deg


def _log_threadsafe_future(future: "concurrent.futures.Future[Any]") -> None:
    with contextlib.suppress(Exception):
        future.result()


def _quaternion_from_euler_deg(roll: float, pitch: float, yaw: float) -> tuple[float, float, float, float]:
    r, p, y = (math.radians(value) / 2 for value in (roll, pitch, yaw))
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    return (sr*cp*cy-cr*sp*sy, cr*sp*cy+sr*cp*sy, cr*cp*sy-sr*sp*cy, cr*cp*cy+sr*sp*sy)


def _multiply_quaternions(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    x, y, z, w = a
    X, Y, Z, W = b
    return (w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X, w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z)
