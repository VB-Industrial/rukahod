from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackagePrefix


def generate_launch_description() -> LaunchDescription:
    args = [
        "--domain", "rover", "--mode", "mock",
        "--host", LaunchConfiguration("host"),
        "--port", LaunchConfiguration("port"),
    ]
    args += ["--rover-cmd-vel-topic", LaunchConfiguration("cmd_vel_topic")]
    return LaunchDescription([
        DeclareLaunchArgument("host", default_value="0.0.0.0"),
        DeclareLaunchArgument("port", default_value="8766"),
        DeclareLaunchArgument("cmd_vel_topic", default_value="/rover_base_controller/cmd_vel_unstamped"),
        ExecuteProcess(cmd=[PathJoinSubstitution([FindPackagePrefix("rukahod_ws_gateway"), "lib", "rukahod_ws_gateway", "gateway"]), *args], output="screen"),
    ])
