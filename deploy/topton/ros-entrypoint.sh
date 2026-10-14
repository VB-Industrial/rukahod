#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/jazzy/setup.bash
source "${RUKAHOD_ROS_WS:-/home/rosuser/rukahod_ws}/install/setup.bash"
unset FASTRTPS_DEFAULT_PROFILES_FILE FASTDDS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
entrypoint_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export FASTRTPS_DEFAULT_PROFILES_FILE="${RUKAHOD_DDS_PROFILE:-$entrypoint_dir/fastdds-udp.xml}"
export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-49}"
exec "$@"
