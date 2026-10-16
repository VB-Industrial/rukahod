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

## Рама антенн

Общая параметрическая геометрия — `urdf/antenna_frame.urdf.xacro`, параметры
и привязка — `config/antenna_frame.yaml`. Три профиля 20×20 мм представлены
коробками, две антенны — цилиндрами. Visual и collision используют одинаковые
размеры. Номинальные размеры из замеров: ширина 490 мм, высота до верхней грани перекладины над поверхностью корпуса 350 мм,
длина антенн 300 мм, заглубление относительно верха перекладины 50 мм.
Наружная ширина, высота до верха перекладины и диаметр антенн 25 мм
подтверждены 2026-10-15.

Геометрия включена (`enabled: true`). Стойки стоят на 125 мм позади оси
основного рокера: X=0.100−0.125=−0.025 м в текущей модели. Продольное
расстояние задано по приблизительному физическому замеру. `mount_x/y/z` задают точку по центру между основаниями стоек
в системе base_link (X вперёд, Y влево, Z вверх). Значение Z=0.161 соответствует
верхней поверхности текущего Body.stl. Антенны размещены снаружи стоек,
без дополнительного зазора до профиля; реальный вынос кронштейнов требует
проверки. Габариты центральной камеры и кронштейнов в эту модель не включены.

При изменении крепления скорректируйте конфигурацию. Одна конфигурация используется:

- в URDF ровера и его robot_state_publisher;
- в генерируемой модели UI после `npm run build`;
- в модели MoveIt при `arm_system_ros.launch.py`.

В MoveIt добавляются отдельные фиксированные звенья с префиксом
`arm_antenna_frame`, чтобы не дублировать TF-имена ровера. Положение пересчитано
из base_link в arm_base_link согласно текущему креплению руки (0.324, 0, -0.076).
Исключены только столкновения между деталями самой неподвижной рамы;
все пары «рука–рама/антенна» остаются включёнными. Корпус и подвеска ровера
этим изменением в модель MoveIt не добавляются.

Проверка геометрии на синтетических размерах (без оборудования):

```bash
source /opt/ros/jazzy/setup.bash
python3 robot/silverhand_rover_model/test/test_antenna_frame.py
```
