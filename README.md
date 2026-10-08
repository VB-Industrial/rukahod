# РукаХод

Предварительный единый пульт оператора для манипулятора и ровера.

## Запуск интерфейса

```bash
cd ui
npm ci
npm run dev -- --host 0.0.0.0 --port 4175
```

Откройте `http://localhost:4175/`. Кнопка «Настройка» в верхней строке открывает вместо камер сервисную панель с адресами arm/rover WebSocket, адресами двух WHEP-камер и состоянием соединений. Адреса сохраняются в браузере оператора. По умолчанию WS подключается к хосту страницы на портах `8765` и `8766`.

Интерфейс использует совместимые со старыми пультами WebSocket-протоколы. Серверы и ROS-адаптеры находятся в `robot/rukahod_ws_gateway`. Реальный ровер проверен на стенде: движение в обе стороны, повороты, остановка и фары.

Для телефона и планшета доступен горизонтальный интерфейс с вкладками настроек, камер, ровера и руки, без 3D-модели. Выбор раскладки автоматический; принудительно: `?layout=mobile` или `?layout=desktop`. Переключатель RU/EN переводит интерфейс; английское название — RukaRover.

Исходные панели: [манипулятор](https://github.com/VB-Industrial/silverhand_arm_teleop), [ровер](https://github.com/VB-Industrial/silverhand_rover_teleop).

План единого пакета описан в [архитектуре](docs/architecture.md), черновик команд и состояний — в [контракте](docs/protocol.md).

Актуальные пакеты руки из `RUKA2`, пакет ровера и два WS gateway находятся в [robot/](robot/README.md). Аппаратные интерфейсы проверяют входящие Cyphal heartbeat; ROS-режим gateway открывает порт только при активном компоненте и контроллере. Mock-режимы доступны для отладки пульта без оборудования.

## Накатывание обновлений на Топтон

Команды выполняются по SSH на ровере от пользователя `rosuser`.
Пути: репозиторий `~/rukahod`, ROS workspace `~/rukahod_ws`, ROS 2 Jazzy,
`ROS_DOMAIN_ID=49`. Перед обновлением закройте пульт и остановите ручные
launch руки. Обновление выполняйте при неподвижном роботе.

### 1. Первый переход с копии файлов на Git

На Топтоне первоначально развёрнута копия без `.git`. Если
`git -C ~/rukahod status` уже работает, переходите к следующему разделу.
Иначе сохраните старый каталог и клонируйте репозиторий:

```bash
sudo systemctl stop rukahod-rover-gateway rukahod-rover-control rukahod-ui
cd ~
mv rukahod "rukahod-backup-$(date +%Y%m%d-%H%M%S)"
git clone https://github.com/VB-Industrial/rukahod.git rukahod
```

### 2. Обновление и сборка

```bash
sudo systemctl stop rukahod-rover-gateway rukahod-rover-control rukahod-ui
cd ~/rukahod
git pull --ff-only
bash deploy/topton/build.sh
```

Для первой сборки после клонирования достаточно выполнить скрипт.
Он подтянет сабмодуль RUKA2, соберёт ROS-пакеты из репозитория в
`~/rukahod_ws` и пересоберёт UI. Старые копии пакетов в `workspace/src`
не используются, кроме установленной ROS-версии `libcxxcanard`:
`~/rukahod_ws/src/libcxxcanard`. Другой путь задаётся через
`RUKAHOD_CYPHAL_SRC`. Firmware для сборки не требуется.

Нужен доступ к GitHub/npm и Node.js `^20.19.0` либо `>=22.12.0`.
На текущем Топтоне ROS, MoveIt и xacro уже установлены; подробности зависимостей
и восстановления окружения — в [инструкции Топтона](deploy/topton/README.md).
Если сборка завершилась ошибкой, устраните её перед запуском служб.

### 3. Запуск ровера и UI

```bash
cd ~/rukahod
sudo cp deploy/topton/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart rukahod-rover-control rukahod-rover-gateway rukahod-ui
systemctl status rukahod-rover-control rukahod-rover-gateway rukahod-ui
systemctl status ethernet-can.service ethernet-can-rover.service
```

Пульт: `http://10.8.49.237:4175/`, WS ровера: порт `8766`, руки: `8765`.
Обновите страницу браузера. Для диагностики:

```bash
journalctl -u rukahod-rover-control -u rukahod-rover-gateway -n 100 --no-pager
```

### 4. Запуск руки с актуальными лимитами

Рука пока запускается вручную. Сначала прочитайте текущую калибровку:

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

Во втором терминале выполните те же команды настройки ROS-окружения
(`source`, `unset`, `export`), затем:

```bash
ros2 launch rukahod_ws_gateway arm_ros.launch.py
```

Лимиты должны совпадать между HW, MoveIt и UI; gateway проверяет это до
открытия управления. После повторной калибровки обновите снимок и перезапустите
оба launch руки. Реальное исполнение через новый путь MoveIt ещё требует
проверки на стенде; модель корпуса ровера пока не добавлена в проверку столкновений.

Чтение калибровки меняет отслеживаемый файл `config/calibrated_arm_limits.json`.
Перед последующим `git pull`, если этот файл изменён, сохраните его:

```bash
git stash push -m 'Local arm calibration' -- config/calibrated_arm_limits.json
```

После обновления снова прочитайте лимиты с устройств. Остальные локальные
изменения перед pull проверьте через `git status` и сохраните отдельно.
Подробности контракта и запуска — в [README gateway](robot/rukahod_ws_gateway/README.md).
