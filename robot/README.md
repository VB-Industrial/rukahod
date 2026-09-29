# Аппаратные ROS-пакеты

`RUKA2` подключён как Git-сабмодуль и является единственным источником `ruka2_control` и `ruka2_description`. `silverhand_rover_control` пока перенесён из одноимённого проекта. Имена ROS-пакетов сохранены для совместимости с исходным кодом. Зависимость `libcxxcanard` должна быть доступна в ROS workspace; условия использования указаны в `package.xml` исходных пакетов.

`ruka2_control` уже принимает входящие Cyphal heartbeat и feedback узлов `21–26`, проверяет их при активации в течение заданного `activation_timeout` и публикует диагностику. В активном режиме проверка свежести выполняется каждый сотый цикл `read()`; его `controller_manager` настроен на 100 Гц. В запуске РукаХода захват отключается явными аргументами `use_end_effector:=false end_effector_type:=none`; исходные варианты RUKA2 остаются доступными.

После обновления сабмодуля браузерная URDF, лимиты, начальная поза и кинематическая цепочка для FK/IK автоматически пересобираются из RUKA2 при `npm run dev` или `npm run build` в `ui/`. Генератор требует ROS 2 Jazzy с `xacro`; результаты генерируются локально и не хранятся в Git.

Ровер принимает входящие `uavcan.node.Heartbeat`. Параметр `heartbeat_node_ids` обязателен и не имеет значения по умолчанию, пока реальные ID не сверены с устройствами. `heartbeat_timeout_ms` по умолчанию равен `3000`. В активном режиме свежесть проверяется каждый сотый цикл `write()`; текущая конфигурация ровера работает на 20 Гц.

Mock-профили используют `mock_components/GenericSystem` и не требуют Cyphal.

Для отдельного запуска mock руки без захвата:

```bash
ros2 launch ruka2_control ros2_control.launch.py use_mock_hardware:=true use_end_effector:=false end_effector_type:=none
```

```bash
source /opt/ros/jazzy/setup.bash
git submodule update --init robot/RUKA2
colcon build --base-paths robot --packages-select ruka2_description ruka2_control silverhand_rover_control
```

Для реального ровера передайте подтверждённые ID через `heartbeat_node_ids` в xacro, например строкой с ID через пробел или запятую. Числа `motor_id` из текущего URDF не следует автоматически считать Cyphal node ID.
