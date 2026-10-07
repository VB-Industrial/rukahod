# silverhand_rover_model

Минимальный ROS 2 description-пакет для визуализации модели Silverhand Rover в RViz.

## Что внутри

- `urdf/silverhand_rover.urdf.xacro` - основная xacro-модель
- `meshes/` - STL-меши корпуса, подвески, дифференциала и колес
- `launch/display.launch.py` - запуск `robot_state_publisher`, `joint_state_publisher` и `rviz2`
- `rviz/silverhand_rover.rviz` - готовая конфигурация RViz

## Использование

Клонируйте пакет в ROS 2 workspace:

```bash
cd ~/silver_ws/src
git clone https://github.com/VB-Industrial/silverhand_rover_model.git
```

Соберите workspace:

```bash
source /opt/ros/jazzy/setup.bash
cd ~/silver_ws
colcon build --symlink-install
```

Запустите визуализацию:

```bash
source /opt/ros/jazzy/setup.bash
source ~/silver_ws/install/setup.bash
ros2 launch silverhand_rover_model display.launch.py
```

Для ручного изменения нефиксированных сочленений через GUI:

```bash
ros2 launch silverhand_rover_model display.launch.py use_joint_state_gui:=true
```

## РукаХод

Пакет включён из `VB-Industrial/silverhand_rover_model`; геометрия и контракт колёс сохранены.
