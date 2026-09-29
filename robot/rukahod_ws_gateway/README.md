# РукаХод WS gateway

Один ROS-пакет содержит два независимых WebSocket-сервера. Порт `8765` обслуживает манипулятор, `8766` — ровер. Каждый порт допускает одну операторскую сессию. Протокол совместим с текущим пультом в `ui/`.

## Сборка

Из корня репозитория:

```bash
source /opt/ros/jazzy/setup.bash
colcon build --base-paths robot --packages-select rukahod_ws_gateway
source install/setup.bash
```

Нужен системный пакет `python3-websockets`. Режимы `mock` работают без ROS-адаптеров; режимы `ros` требуют активного ROS 2 окружения.

## Запуск

```bash
ros2 launch rukahod_ws_gateway arm_mock.launch.py
ros2 launch rukahod_ws_gateway rover_mock.launch.py
```

Для подключения к работающим `ros2_control`:

```bash
ros2 launch rukahod_ws_gateway arm_ros.launch.py
ros2 launch rukahod_ws_gateway rover_ros.launch.py
```

Адрес и порт меняются через аргументы launch: `host:=0.0.0.0 port:=8765`. У ровера есть `cmd_vel_topic:=/rover_base_controller/cmd_vel_unstamped`. Процессы можно запускать раздельно: отсутствие питания руки не затрагивает порт ровера.

В режиме `ros` gateway опрашивает `/controller_manager` для руки или `/rover_controller_manager` для ровера. Порт открывается, только если аппаратный компонент (`Ruka2System` или `SilverhandRoverSystem`) и соответствующий контроллер активны. При потере готовности порт и соединение закрываются; gateway пытается восстановить lifecycle и снова открыть порт. Проверку физических Cyphal heartbeat выполняют сами аппаратные компоненты при активации и во время работы. Режимы `mock` открывают порты сразу.

Текущий ROS-контракт руки: `joint_1`–`joint_6`, action `/ruka_arm_controller/follow_joint_trajectory`, тема `/joint_states`. Ровер публикует `geometry_msgs/Twist` в `/rover_base_controller/cmd_vel_unstamped`. При потере WS-сессии gateway посылает нулевую скорость; контроллер ровера дополнительно имеет `cmd_vel_timeout: 0.5` секунды.

## Проверка

```bash
python3 robot/rukahod_ws_gateway/scripts/mock_smoke_test.py --domain arm --url ws://127.0.0.1:8765
python3 robot/rukahod_ws_gateway/scripts/mock_smoke_test.py --domain rover --url ws://127.0.0.1:8766
```

Адреса в операторском UI редактируются в сервисной панели. До проверки на реальном ровере нужно указать реальные `heartbeat_node_ids` в `silverhand_rover_control` и проверить задержку отключения привода при потере heartbeat.

Собранный UI можно отдать с той же машины без отдельного фреймворка: `cd ui && npm run build`, затем из корня репозитория `robot/rukahod_ws_gateway/scripts/serve_ui.sh`. Страница будет доступна на порту `4175`; браузер по умолчанию подключится к WS-портам на том же хосте.
