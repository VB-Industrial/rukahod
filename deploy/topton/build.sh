#!/usr/bin/env bash
# Build from the checkout, not stale package copies in workspace/src.
set -eo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ros_ws="${RUKAHOD_ROS_WS:-$HOME/rukahod_ws}"
cyphal_src="${RUKAHOD_CYPHAL_SRC:-$ros_ws/src/libcxxcanard}"
if [[ ! -f "$cyphal_src/package.xml" ]]; then
  echo "Set RUKAHOD_CYPHAL_SRC to the existing ROS libcxxcanard package directory." >&2
  exit 1
fi
source /opt/ros/jazzy/setup.bash
unset FASTRTPS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
git -C "$repo_dir" submodule update --init robot/RUKA2
mkdir -p "$ros_ws"
cd "$ros_ws"
# A separate build directory avoids CMake caches pointing at the old source copies.
colcon build --build-base build-rukahod --base-paths \
  "$cyphal_src" \
  "$repo_dir/robot/RUKA2/ruka2_control" \
  "$repo_dir/robot/RUKA2/ruka2_description" \
  "$repo_dir/robot/RUKA2/ruka2_moveit_config" \
  "$repo_dir/robot/silverhand_rover_control" \
  "$repo_dir/robot/silverhand_rover_model" \
  "$repo_dir/robot/rukahod_ws_gateway" \
  --packages-up-to ruka2_control ruka2_moveit_config silverhand_rover_control \
    silverhand_rover_model rukahod_ws_gateway \
  --executor sequential
source "$ros_ws/install/setup.bash"
cd "$repo_dir/ui"
npm ci
npm run build
echo 'Build complete. Restart services explicitly when ready.'
