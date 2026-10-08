from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackagePrefix


def generate_launch_description() -> LaunchDescription:
    args = [
        "--domain", "arm", "--mode", "ros", "--arm-use-moveit",
        "--host", LaunchConfiguration("host"),
        "--port", LaunchConfiguration("port"),
    ]
    args += ["--arm-limits-file", LaunchConfiguration("limits_file")]
    return LaunchDescription([
        DeclareLaunchArgument("limits_file", default_value="/home/rosuser/rukahod/config/calibrated_arm_limits.json"),
        DeclareLaunchArgument("host", default_value="0.0.0.0"),
        DeclareLaunchArgument("port", default_value="8765"),
        ExecuteProcess(cmd=[PathJoinSubstitution([FindPackagePrefix("rukahod_ws_gateway"), "lib", "rukahod_ws_gateway", "gateway"]), *args], output="screen"),
    ])
