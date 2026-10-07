# silverhand_rover_control

Пакет ROS 2 Jazzy для слоя управления rover SilverHand.

Пакет:
- `silverhand_rover_control`

В этом репозитории намеренно оставлены только нижний и средний слои управления:
- `ros2_control`
- hardware interface
- controller bringup

Геометрия робота, меши и базовая визуализация rover живут в `silverhand_rover_model`.

## Требования

```bash
sudo apt-get update
sudo apt-get install -y \
  ros-jazzy-ros2-control \
  ros-jazzy-ros2-controllers \
  ros-jazzy-controller-manager \
  ros-jazzy-diff-drive-controller \
  ros-jazzy-joint-state-broadcaster \
  ros-jazzy-robot-state-publisher \
  ros-jazzy-xacro
```

## Клонирование

Клонируйте control-стек в workspace, где уже есть `libcxxcanard`:

```bash
cd ~/silver_ws/src
git clone https://github.com/VB-Industrial/libcxxcanard.git
git clone <silverhand_rover_control_repo_url>
```

Рядом в том же workspace клонируйте модель rover:

```bash
cd ~/silver_ws/src
git clone https://github.com/VB-Industrial/silverhand_rover_model.git
```

Ожидаемый путь к реальной Cyphal-серверной части:

```bash
~/silver_ws/src/libcxxcanard
```

## Структура workspace

Минимальный общий workspace для bringup:

```bash
~/silver_ws/src/silverhand_rover_model
~/silver_ws/src/libcxxcanard
~/silver_ws/src/silverhand_rover_control
```

Расширенный workspace:

```bash
~/silver_ws/src/silverhand_rover_model
~/silver_ws/src/libcxxcanard
~/silver_ws/src/silverhand_rover_control
~/silver_ws/src/silverhand_system_bringup
~/silver_ws/src/silverhand_system_description
```

## Сборка

```bash
cd ~/silver_ws
source /opt/ros/jazzy/setup.bash
colcon build --packages-up-to \
  silverhand_rover_model \
  silverhand_rover_control
source ~/silver_ws/install/setup.bash
```

## Проверка пакетов

```bash
ros2 pkg list | rg silverhand_rover
```

Ожидаемый пакет из этого репозитория:
- `silverhand_rover_control`

## Запуск

Mock-режим:

```bash
ros2 launch silverhand_rover_control silverhand_rover_mock.launch.py
```

Этот запуск поднимает:
- `ros2_control` на `mock_components/GenericSystem`
- `power_board_node` в mock-режиме без CAN/железа
- mock `BatteryState` публикуется с периодом `50 ms` (`20 Hz`) по умолчанию

Заглушка для реального железа:

```bash
ros2 launch silverhand_rover_control silverhand_rover_real.launch.py can_iface:=vcan1 node_id:=110
```

Реальное железо с принудительным fallback на wheel odometry:

```bash
ros2 launch silverhand_rover_control silverhand_rover_real.launch.py \
  use_imu_odometry:=false
```

Универсальный bringup:

```bash
ros2 launch silverhand_rover_control silverhand_rover_bringup.launch.py \
  use_mock_hardware:=true
```

## Вспомогательные скрипты

```bash
cd ~/silver_ws/src/silverhand_rover_control
./scripts/start_rover_mock.sh
./scripts/start_rover_real.sh
```

Поддерживаемые переменные окружения:

- `ROS_WS`
- `ROS_DISTRO`
- `SILVERHAND_ROVER_CAN_IFACE`
- `SILVERHAND_ROVER_NODE_ID`
- `SILVERHAND_ROVER_QUEUE_LEN`

## systemd

Шаблон systemd-сервиса:

- `systemd/system/silverhand-rover-control@.service`

Установка:

```bash
sudo install -Dm644 systemd/system/silverhand-rover-control@.service /etc/systemd/system/silverhand-rover-control@.service
sudo systemctl daemon-reload
```

Запуск:

```bash
sudo systemctl enable --now silverhand-rover-control@mock.service
sudo systemctl enable --now silverhand-rover-control@real.service
```

Автозапуск без логина не нужен: system-сервис стартует без пользовательской сессии.

Логи:

```bash
journalctl -u silverhand-rover-control@mock.service -f
```

## Параметры

- `use_mock_hardware`: use `mock_components/GenericSystem` for permanent debug bringup
- `can_iface`: CAN or VCAN interface for the future Cyphal transport, default `vcan1`
- `node_id`: Cyphal node id for the rover hardware plugin, default `110`
- `queue_len`: reserved queue length for the future Cyphal transport, default `1000`
- `use_imu_odometry`: `auto`, `true`, or `false` for IMU+EKF versus wheel-only odometry
- `power_board_client_node_id`: Cyphal node id used by `power_board_node`, default `111`
- `power_board_node.use_mock`: publish synthetic battery data and accept headlights commands without Cyphal/CAN access
- `power_board_node.mock_battery_*`: parameters for mock battery telemetry values and publish period

## Тайминги power board

- real `power_board_node`: Cyphal polling loop runs every `50 ms` (`20 Hz`)
- real `power_board_node`: Cyphal heartbeat is emitted at approximately `1 Hz`
- mock `power_board_node`: synthetic battery telemetry is published every `50 ms` (`20 Hz`) by default

## Примечания

- `silverhand_rover_control` does not duplicate the rover model. It includes `silverhand_rover_model/urdf/silverhand_rover.urdf.xacro` and appends the `ros2_control` block.
- `libcxxcanard` - отдельная зависимость workspace, его следует клонировать в `~/silver_ws/src/libcxxcanard`.
- Реальный аппаратный плагин теперь ожидает команды на моторы колес на subject'ах `3000 + motor_id`, а обратную связь - на `3000 - motor_id`.
- `power_board_node` is a separate Cyphal-facing ROS node for battery telemetry and headlights, keeping power/HMI concerns outside `ros2_control`.
- `diff_drive_controller` is used as the first integration step. A custom rover controller can replace it later without changing the package split.


## Проверенный профиль РукаХод / Topton

Проверен на `brovermax` (ROS 2 Jazzy):

| Назначение | Интерфейс | Узлы / subjects |
|---|---|---|
| Шесть приводов | `vcan2.0` | HB 1–6; команды 3001–3006, feedback 2999–2994 |
| Плата питания | `vcan2.1` | Узел 9, BatteryState 7993 |
| Фары | `vcan2.2` | Узел 7; AngularVelocity 1000, float32 1/0 |

Все `direction_multiplier=+1`, включая левую сторону, по текущей конфигурации
прошивки. Геометрия и motor ID сохранены из SilverHand Rover. Входящие heartbeat
проверяются при активации и каждые 100 циклов write. При 20 Гц и timeout 3 с
потеря может обнаружиться спустя почти 8 с после последнего HB. При потере HB,
деактивации и закрытии HW отправляются нулевые скорости. Собственный heartbeat
хоста публикуется приблизительно раз в секунду, независимо от периода проверки.

Запуск (workspace уже собран):

```bash
source /opt/ros/jazzy/setup.bash
source ~/rukahod_ws/install/setup.bash
unset FASTRTPS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
export ROS_DOMAIN_ID=49
ros2 launch silverhand_rover_control silverhand_rover_real.launch.py use_imu_odometry:=false
```

HW сначала конфигурируется в inactive; ROS CLI активирует его после
проверки HB. Только после успешной активации запускаются контроллеры. Без HB
manager остаётся доступен, аппаратный компонент неактивен, контроллеры не стартуют.
После подключения оборудования можно повторить активацию и spawner:

```bash
ros2 control set_hardware_component_state SilverhandRoverSystem active -c /rover_controller_manager
ros2 run controller_manager spawner joint_state_broadcaster rover_base_controller -c /rover_controller_manager
```

Контракт движения сохранён: `/rover_base_controller/cmd_vel_unstamped`
(`geometry_msgs/msg/Twist`), linear.x в м/с, angular.z в рад/с. В Jazzy
`cmd_vel_stamper` добавляет timestamp и передаёт команду на
`/rover_base_controller/cmd_vel` (`TwistStamped`). Преобразователь ничего не
повторяет: при отсутствии входящих команд diff_drive останавливается через 0,5 с.

Фары: `/power_board/set_headlights` (`std_srvs/srv/SetBool`). `use_headlights`
позволяет запускать фары отдельно от платы питания (`use_power_board`). Ответ
success подтверждает постановку CAN команды, а не физическое включение лампы.

Диагностика:

```bash
ros2 control list_hardware_components -c /rover_controller_manager
ros2 control list_controllers -c /rover_controller_manager
ros2 topic echo /joint_states --once
ros2 topic echo /battery_state --once
```

Контрактный тест использует настоящие HW plugin и контроллеры, но только
изолированные VCAN. Он проверяет feedback, направление без инверсии, движение,
поворот, таймаут, фары и отсутствие/потерю HB. На физических шинах его запускать
нельзя; имена тестовых шин фиксированы, а подключение к EtherCAN проверяется.

```bash
for iface in vcan_rtest vcan_ptest vcan_ltest; do
  sudo ip link add "$iface" type vcan
  sudo ip link set "$iface" up
done
python3 ~/rukahod_ws/src/silverhand_rover_control/scripts/rover_contract_test.py
```
