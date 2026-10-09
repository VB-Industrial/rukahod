cmake_minimum_required(VERSION 3.8)
project(rukahod_ws_gateway)

find_package(ament_cmake REQUIRED)
find_package(ament_cmake_python REQUIRED)

ament_python_install_package(${PROJECT_NAME})

install(PROGRAMS scripts/gateway
  DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch/
  DESTINATION share/${PROJECT_NAME}/launch
  FILES_MATCHING PATTERN "*_mock.launch.py" PATTERN "*_ros.launch.py")
install(FILES README.md
  DESTINATION share/${PROJECT_NAME})

ament_package()
