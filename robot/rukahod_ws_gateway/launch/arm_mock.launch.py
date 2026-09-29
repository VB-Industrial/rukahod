from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackagePrefix


def generate_launch_description() -> LaunchDescription:
    args = [
        "--domain", "arm", "--mode", "mock",
        "--host", LaunchConfiguration("host"),
        "--port", LaunchConfiguration("port"),
    ]
    return LaunchDescription([
        DeclareLaunchArgument("host", default_value="0.0.0.0"),
        DeclareLaunchArgument("port", default_value="8765"),
        ExecuteProcess(cmd=[PathJoinSubstitution([FindPackagePrefix("rukahod_ws_gateway"), "lib", "rukahod_ws_gateway", "gateway"]), *args], output="screen"),
    ])
