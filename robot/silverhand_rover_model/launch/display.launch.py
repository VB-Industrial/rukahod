import subprocess
import tempfile

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import FindExecutable, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def _is_true(value):
    return value.lower() in {"1", "true", "yes", "on"}


def _launch_setup(context, *args, **kwargs):
    model_path = LaunchConfiguration("model").perform(context)
    use_joint_state_gui = LaunchConfiguration("use_joint_state_gui").perform(context)
    use_rviz = LaunchConfiguration("use_rviz").perform(context)
    rviz_config = PathJoinSubstitution(
        [FindPackageShare("silverhand_rover_model"), "rviz", "silverhand_rover.rviz"]
    ).perform(context)
    xacro_executable = FindExecutable(name="xacro").perform(context)

    urdf_content = subprocess.check_output(
        [xacro_executable, model_path],
        text=True,
    )
    with tempfile.NamedTemporaryFile(
        mode="w",
        prefix="silverhand_rover_",
        suffix=".urdf",
        delete=False,
    ) as urdf_file:
        urdf_file.write(urdf_content)
        urdf_path = urdf_file.name

    robot_description = {"robot_description": urdf_content}
    nodes = []

    joint_state_parameters = [
        robot_description,
        {
            "publish_default_positions": True,
            "rate": 10.0,
        },
    ]

    if _is_true(use_joint_state_gui):
        nodes.append(
            Node(
                package="joint_state_publisher_gui",
                executable="joint_state_publisher_gui",
                name="joint_state_publisher_gui",
                parameters=joint_state_parameters,
                output="screen",
            )
        )
    else:
        nodes.append(
            Node(
                package="joint_state_publisher",
                executable="joint_state_publisher",
                name="joint_state_publisher",
                parameters=joint_state_parameters,
                output="screen",
            )
        )

    nodes.append(
        Node(
            package="robot_state_publisher",
            executable="robot_state_publisher",
            name="robot_state_publisher",
            parameters=[robot_description],
            output="screen",
        )
    )

    if _is_true(use_rviz):
        nodes.append(
            Node(
                package="rviz2",
                executable="rviz2",
                name="rviz2",
                arguments=["-d", rviz_config],
                output="screen",
            )
        )

    return nodes


def generate_launch_description():
    default_model_path = PathJoinSubstitution(
        [FindPackageShare("silverhand_rover_model"), "urdf", "silverhand_rover.urdf.xacro"]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "model",
                default_value=default_model_path,
                description="Absolute path to the robot xacro file.",
            ),
            DeclareLaunchArgument(
                "use_joint_state_gui",
                default_value="false",
                description="Launch joint_state_publisher_gui instead of joint_state_publisher.",
            ),
            DeclareLaunchArgument(
                "use_rviz",
                default_value="true",
                description="Launch RViz together with the model publishers.",
            ),
            OpaqueFunction(function=_launch_setup),
        ]
    )
