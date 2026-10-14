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

## Реальный ровер: проверенная сборка на Топтоне

На `10.8.49.237` используются ROS Jazzy и `ROS_DOMAIN_ID=49`:

```bash
source /opt/ros/jazzy/setup.bash
source ~/rukahod_ws/install/setup.bash
unset FASTRTPS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
export ROS_DOMAIN_ID=49
ros2 launch rukahod_ws_gateway rover_system_ros.launch.py
```

Этот launch запускает аппаратный интерфейс, контроллеры, преобразователь старой
Twist-темы в TwistStamped и WS ровера. Если аппаратный launch уже работает,
запускайте только `rover_ros.launch.py`, чтобы не создавать второй controller manager.

Собранная страница обслуживается отдельно:

```bash
bash ~/rukahod/robot/rukahod_ws_gateway/scripts/serve_ui.sh
```

Пульт: `http://10.8.49.237:4175/`, WS: `ws://10.8.49.237:8766`.
Если в браузере сохранён старый адрес, замените его в настройках. Рука в этой
конфигурации не запущена; отсутствие соединения с портом 8765 ожидаемо.

На стенде 2026-10-07 проверены движение вперёд и назад, оба направления поворота,
отправка нулевой скорости, ROS-телеметрия шести колёс. Через реальный WS проверены
hello/ping, готовность, одометрия, напряжение батареи и включение/выключение фар.
Автоматическая проверка WS не отправляла ненулевые команды движения.
Процент заряда и ток сейчас приходят от прошивки как ноль; доступно реальное напряжение.
После некоторых остановок у левого среднего колеса замечено значение ±0,205 рад/с;
причина ещё не установлена. USB IMU подключена через `/imu_sensor_broadcaster/imu`; крен, тангаж и курс
передаются в UI. Для текущего монтажа применён поворот датчика +90° вокруг Y.

Рабочие логи на Топтоне: `/tmp/rukahod-rover-real.log`,
`/tmp/rukahod-rover-gateway.log`, `/tmp/rukahod-ui.log`.

PowerBoard передаёт `current_a`, `charge_ah`, `capacity_ah`, `present` и
`percent_valid` вместе с напряжением. При неизвестной ёмкости UI показывает
заряд как «—», а не 0%. `imu_valid` указывает на свежую корректную ориентацию
IMU; при отсутствии данных больше секунды авиагоризонт показывает «Нет IMU»,
курс берётся из одометрии.

### Монтаж IMU

`rover_ros.launch.py` задаёт `imu_mount_roll_deg:=0 imu_mount_pitch_deg:=90
imu_mount_yaw_deg:=0` для установленного на Топтоне датчика. Это ориентация
системы координат датчика относительно ровера (ZYX Euler). Гейтвей применяет
`q_world_rover = q_world_sensor * inverse(q_rover_sensor)` перед вычислением
крена, тангажа и курса. Сырые ROS-данные не изменяются. Для другого монтажа
задайте соответствующие launch-аргументы; при запуске gateway напрямую
используйте `--rover-imu-mount-pitch-deg 90` и аналогичные аргументы roll/yaw.
Монтажная поправка не является калибровкой абсолютного курса или нуля датчика.

Кнопка «Сброс гирокомпаса» / «Reset gyrocompass» (desktop и mobile) отправляет
`reset_gyrocompass`. При свежей IMU гейтвей сохраняет скорректированный кватернион
как опорный и применяет `inverse(q_reference) * q_current`. Обнуляются курс,
крен и тангаж; установка сохраняется до перезапуска гейтвея. Сырые ROS-темы
не меняются. При отсутствии свежего измерения сброс отклоняется.


### Рука: калиброванные ограничения и MoveIt

Все обмены HW-интерфейса идут через типизированные Cyphal-сообщения
libcxxcanard: Heartbeat, Planar и Register Access. Сырые CAN-кадры остаются
транспортом библиотеки; HW не разбирает их самостоятельно.

Регистр `limits` — `real32[9]`: localized, physical_lower, hard_lower,
soft_lower, soft_upper, hard_upper, physical_upper, recovery_state,
recovery_target. `cal_data` — `int32[8]`, первый элемент подтверждает
валидность калибровки. Рабочий диапазон — пересечение физических и мягких
ограничений, а не старые границы URDF.

Перед запуском после калибровки обновите снимок (команда только читает регистры):

```bash
source /opt/ros/jazzy/setup.bash
source ~/rukahod_ws/install/setup.bash
unset FASTRTPS_DEFAULT_PROFILES_FILE ROS_DISCOVERY_SERVER
export ROS_DOMAIN_ID=49
ros2 run rukahod_ws_gateway sync_arm_limits.py \
  --interface vcan1.0 \
  --output ~/rukahod/config/calibrated_arm_limits.json
ros2 launch rukahod_ws_gateway arm_system_ros.launch.py
```

В другом терминале с тем же ROS-окружением:

```bash
ros2 launch rukahod_ws_gateway arm_ros.launch.py
```

`limits_file:=...` переопределяет путь в обоих launch. Снимок заменяется
атомарно только после успешного чтения всех шести узлов 21–26.
HW отдельно читает актуальные лимиты в `on_activate` (транспорт уже создан
в `on_configure`), до активации требует валидные лимиты, heartbeat и feedback.
Чтение регистров не выполняется в каждом read/write. Конечная позиционная
команда ограничивается перед отправкой в Cyphal.

Launch передаёт один снимок в URDF, ros2_control и MoveIt. Gateway сверяет
его с диагностикой HW; при несовпадении управление через WS недоступно.
Лимиты передаются клиенту событием `joint_limits` и применяются к ползункам
настольного/мобильного UI и численному IK. После повторной калибровки нужно
обновить снимок и перезапустить arm stack и gateway.

Начальной активацией и запуском контроллеров владеет `arm_system_ros.launch.py`.
Gateway наблюдает запуск, а затем восстанавливает потерянную готовность.
При неуспешном первоначальном запуске устраните причину и перезапустите launch.
Планирование использует `/plan_kinematic_path`; исполнение — существующий
FollowJointTrajectory. При ошибке планирования прямой обход MoveIt отсутствует.

На текущем этапе MoveIt использует модель руки; геометрия корпуса ровера
не добавлена как препятствие. TF крепления согласован с UI, но это не
обеспечивает проверку столкновений с корпусом. Реальное исполнение после
интеграции ещё предстоит проверить на стенде.
