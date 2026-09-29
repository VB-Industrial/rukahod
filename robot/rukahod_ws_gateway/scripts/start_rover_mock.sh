#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROS_WS="${ROS_WS:-$(cd "${SCRIPT_DIR}/../../.." && pwd)}"
source "/opt/ros/${ROS_DISTRO:-jazzy}/setup.bash"
source "${ROS_WS}/install/setup.bash"
exec ros2 run rukahod_ws_gateway gateway --domain rover --mode mock \
  --host "${RUKAHOD_WS_HOST:-0.0.0.0}" --port "${RUKAHOD_WS_PORT:-8766}" \
  --log-level "${RUKAHOD_WS_LOG_LEVEL:-INFO}"
