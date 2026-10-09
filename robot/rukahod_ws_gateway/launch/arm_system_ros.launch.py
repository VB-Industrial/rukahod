"""Use a single calibrated limit snapshot for ros2_control and MoveIt."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import xacro
from ament_index_python.packages import get_package_share_directory as share
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction, ExecuteProcess, RegisterEventHandler, LogInfo, Shutdown
from launch.event_handlers import OnProcessExit
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def setup(context):
    limits_path = LaunchConfiguration('limits_file').perform(context)
    bounds = json.loads(Path(limits_path).read_text())['joint_limits']
    source = Path(share('ruka2_control')) / 'config/ruka2_control.urdf.xacro'
    mappings = dict(use_mock_hardware='false', use_end_effector='false', end_effector_type='none', can_interface='vcan1.0')
    root = ET.fromstring(xacro.process_file(str(source), mappings=mappings).toxml())
    # Match the unified UI mount and avoid sharing the rover base_link frame.
    for element in root.iter():
        for attribute in ('name', 'link'):
            if element.get(attribute) == 'base_link': element.set(attribute, 'arm_base_link')
    speed_limit = root.find("ros2_control/hardware/param[@name='maximum_servo_velocity']")
    if speed_limit is None:
        raise ValueError('Ruka2System maximum_servo_velocity parameter is missing')
    speed_limit.text = '0.5'
    for name, b in bounds.items():
        lo, hi = b['min_position'], b['max_position']
        if not lo < hi: raise ValueError(f'Invalid bounds for {name}')
        joint = root.find(f"joint[@name='{name}']")
        limit = joint.find('limit');limit.set('lower',str(lo));limit.set('upper',str(hi))
        limit.set('velocity','0.5')
        cmd = root.find(f"ros2_control/joint[@name='{name}']/command_interface[@name='position']")
        for key, value in [('min',lo),('max',hi)]:
            ET.SubElement(cmd,'param',name=key).text=str(value)
    description = ET.tostring(root,encoding='unicode')
    cfg = (MoveItConfigsBuilder('ruka2',package_name='ruka2_moveit_config')
           .robot_description(mappings=mappings)
           .robot_description_semantic(file_path='config/ruka2.srdf',mappings=mappings)
           .planning_pipelines(default_planning_pipeline='ompl',pipelines=['ompl'])
           .trajectory_execution(moveit_manage_controllers=False).to_moveit_configs())
    params = cfg.to_dict();params['robot_description'] = description
    semantic = ET.fromstring(params['robot_description_semantic'])
    for child in list(semantic):
        if child.tag == 'virtual_joint': semantic.remove(child)
    for element in semantic.iter():
        for key, value in list(element.attrib.items()):
            if value == 'base_link': element.set(key, 'arm_base_link')
    params['robot_description_semantic'] = ET.tostring(semantic, encoding='unicode')
    for name,b in bounds.items():
        params['robot_description_planning']['joint_limits'][name].update(
            has_position_limits=True,min_position=b['min_position'],max_position=b['max_position'],max_velocity=0.5)
    params['moveit_simple_controller_manager']['controller_names']=['ruka_arm_controller']
    params['trajectory_execution.allowed_start_tolerance']=0.03
    controllers = str(Path(share('ruka2_control'))/'config/ros2_controllers.yaml')
    activation = ExecuteProcess(cmd=['ros2','control','set_hardware_component_state','Ruka2System','active','-c','/controller_manager'],output='screen')
    spawners = [Node(package='controller_manager',executable='spawner',arguments=[n,'-c','/controller_manager'],output='screen') for n in ['joint_state_broadcaster','ruka_arm_controller']]
    return [
        RegisterEventHandler(OnProcessExit(target_action=activation,on_exit=lambda e,_:spawners if e.returncode==0 else [LogInfo(msg='Arm activation failed; controllers not started'), Shutdown(reason='Arm activation failed')])),
        Node(package='robot_state_publisher',executable='robot_state_publisher',name='arm_robot_state_publisher',parameters=[{'robot_description':description}],remappings=[('/robot_description','/arm/robot_description')]),
        Node(package='controller_manager',executable='ros2_control_node',parameters=[controllers,{'hardware_components_initial_state':{'inactive':['Ruka2System']}}],remappings=[('/controller_manager/robot_description','/arm/robot_description'),('/robot_description','/arm/robot_description')],output='screen', on_exit=Shutdown(reason='Arm stack process exited')),
        activation,
        Node(package='tf2_ros', executable='static_transform_publisher', name='rover_to_arm',
             arguments=['--x','0.324','--y','0','--z','-0.076','--frame-id','base_link','--child-frame-id','arm_base_link']),
        Node(package='moveit_ros_move_group',executable='move_group',parameters=[params],remappings=[('/robot_description','/arm/robot_description')],output='screen', on_exit=Shutdown(reason='Arm stack process exited')),
    ]


def generate_launch_description():
    return LaunchDescription([DeclareLaunchArgument('limits_file',default_value='/home/rosuser/rukahod/config/calibrated_arm_limits.json'),OpaqueFunction(function=setup)])
