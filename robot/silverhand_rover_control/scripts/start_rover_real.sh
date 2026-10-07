#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROS_WS="${ROS_WS:-$(cd "${REPO_DIR}/../.." && pwd)}"
ROS_DISTRO="${ROS_DISTRO:-jazzy}"

set +u
source "/opt/ros/${ROS_DISTRO}/setup.bash"
source "${ROS_WS}/install/setup.bash"
set -u

exec ros2 launch silverhand_rover_control silverhand_rover_real.launch.py \
  can_iface:="${SILVERHAND_ROVER_CAN_IFACE:-vcan2.0}" \
  power_board_can_iface:="${SILVERHAND_ROVER_POWER_BOARD_CAN_IFACE:-vcan2.1}" \
  headlights_can_iface:="${SILVERHAND_ROVER_HEADLIGHTS_CAN_IFACE:-vcan2.2}" \
  node_id:="${SILVERHAND_ROVER_NODE_ID:-110}" \
  heartbeat_node_ids:="${SILVERHAND_ROVER_HEARTBEAT_NODE_IDS:-1,2,3,4,5,6}" \
  heartbeat_timeout_ms:="${SILVERHAND_ROVER_HEARTBEAT_TIMEOUT_MS:-3000}" \
  queue_len:="${SILVERHAND_ROVER_QUEUE_LEN:-1000}" \
  use_imu_odometry:="${SILVERHAND_ROVER_USE_IMU_ODOMETRY:-false}" \
  use_power_board:="${SILVERHAND_ROVER_USE_POWER_BOARD:-true}" \
  power_board_client_node_id:="${SILVERHAND_ROVER_POWER_BOARD_CLIENT_NODE_ID:-111}" \
  "$@"
