cmake_minimum_required(VERSION 3.8)
project(silverhand_rover_model)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY launch meshes rviz urdf
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
