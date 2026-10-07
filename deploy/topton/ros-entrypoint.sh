#!/usr/bin/env bash
set -eo pipefail
source /opt/ros/jazzy/setup.bash
source "${RUKAHOD_ROS_WS:-/home/rosuser/rukahod_ws}/install/setup.bash"
unset FASTRTPS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-49}"
exec "$@"
