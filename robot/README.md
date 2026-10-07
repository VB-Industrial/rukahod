# Аппаратные ROS-пакеты

WS gateway для руки и ровера находится в [rukahod_ws_gateway/](rukahod_ws_gateway/README.md). Он собирается вместе с пакетами `robot/` и запускается в двух независимых процессах.

`RUKA2` подключён как Git-сабмодуль и является единственным источником `ruka2_control` и `ruka2_description`. `silverhand_rover_control` пока перенесён из одноимённого проекта. Имена ROS-пакетов сохранены для совместимости с исходным кодом. Зависимость `libcxxcanard` должна быть доступна в ROS workspace; условия использования указаны в `package.xml` исходных пакетов.

`ruka2_control` уже принимает входящие Cyphal heartbeat и feedback узлов `21–26`, проверяет их при активации в течение заданного `activation_timeout` и публикует диагностику. В активном режиме проверка свежести выполняется каждый сотый цикл `read()`; его `controller_manager` настроен на 100 Гц. В запуске РукаХода захват отключается явными аргументами `use_end_effector:=false end_effector_type:=none`; исходные варианты RUKA2 остаются доступными.

После обновления сабмодуля браузерная URDF, лимиты, начальная поза и кинематическая цепочка для FK/IK автоматически пересобираются из RUKA2 при `npm run dev` или `npm run build` в `ui/`. Генератор требует ROS 2 Jazzy с `xacro`; результаты генерируются локально и не хранятся в Git.

Ровер принимает входящие `uavcan.node.Heartbeat`. В реальном профиле `heartbeat_node_ids` по умолчанию равен `1,2,3,4,5,6`: эти узлы подтверждены на Топтоне. `heartbeat_timeout_ms` по умолчанию равен `3000`. В активном режиме свежесть проверяется каждый сотый цикл `write()`; текущая конфигурация ровера работает на 20 Гц.

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

Для реального ровера используйте `ros2 launch silverhand_rover_control silverhand_rover_real.launch.py`. Профиль Топтона: приводы `vcan2.0`, питание `vcan2.1`, фары `vcan2.2`. На другом оборудовании переопределите интерфейсы и `heartbeat_node_ids`. Пакет геометрии `silverhand_rover_model` включён в `robot/`.
