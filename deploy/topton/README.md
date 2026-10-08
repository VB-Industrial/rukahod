# Автозагрузка ровера на Топтоне

Собранный ROS workspace: `/home/rosuser/rukahod_ws`, развёрнутый репозиторий:
`/home/rosuser/rukahod`. Пользователь и группа — `rosuser`, ROS domain — 49.
Перед установкой остановите ранее запущенные вручную launch и HTTP-сервер.

```bash
sudo cp deploy/topton/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rukahod-rover-control rukahod-rover-gateway rukahod-ui
```

EtherCAN запускается существующей службой `ethernet-can-rover.service`.
Контрол ожидает свежие Operational/Nominal heartbeat узлов 1–6 на `vcan2.0`.
Если оборудование недоступно, запуск повторяется каждые 5 секунд после таймаута.
Аппаратный интерфейс продолжает выполнять собственные проверки heartbeat.
Гейтвей открывает порт только при готовности аппаратного компонента и контроллера.
Рука не запускается. Службы не генерируют команды движения.

```bash
systemctl status rukahod-rover-control rukahod-rover-gateway rukahod-ui
journalctl -u rukahod-rover-control -u rukahod-rover-gateway -f
sudo systemctl restart rukahod-rover-gateway
sudo systemctl stop rukahod-rover-gateway rukahod-rover-control
```

UI: `http://10.8.49.237:4175/`, WS ровера: `ws://10.8.49.237:8766`.
Обновление исходников требует пересборки workspace/UI и перезапуска соответствующей
службы. Старые ручные launch параллельно с systemd запускать нельзя.

## Обновление на выставке

На Топтоне исходники первоначально копировались без `.git`. Один раз замените
копию полноценным checkout. Старый каталог сохраняется как резервная копия.
Закройте операторский пульт и остановите ручные процессы руки перед обновлением.

```bash
sudo systemctl stop rukahod-rover-gateway rukahod-rover-control rukahod-ui
cd ~
# Если ~/rukahod уже является Git checkout, эти две команды пропустите.
mv rukahod "rukahod-backup-$(date +%Y%m%d-%H%M%S)"
git clone https://github.com/VB-Industrial/rukahod.git rukahod
cd ~/rukahod
```

Для последующих обновлений:

```bash
cd ~/rukahod
git pull --ff-only
bash deploy/topton/build.sh
sudo cp deploy/topton/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart rukahod-rover-control rukahod-rover-gateway rukahod-ui
```

Перед каждой сборкой остановите службы командой из первого блока и ручные
launch руки. Не выполняйте сборку при управлении роботом.
Скрипт использует существующую ROS-версию `~/rukahod_ws/src/libcxxcanard`;
если она расположена иначе, задайте `RUKAHOD_CYPHAL_SRC=/полный/путь`.
Он собирает пакеты прямо из Git checkout, не из прежних копий `workspace/src`.
Firmware и вложенные firmware-сабмодули для этой сборки не требуются.

На текущем Топтоне ROS Jazzy, libcxxcanard, MoveIt и xacro уже установлены.
Для восстановления зависимостей на новом образе понадобятся как минимум:

```bash
sudo apt update
sudo apt install ros-jazzy-moveit ros-jazzy-xacro python3-colcon-common-extensions
```

Также нужны Node.js версии `^20.19.0` либо `>=22.12.0`, npm и доступ к GitHub/npm
на время обновления. Сборка UI генерирует модель из сабмодуля RUKA2 автоматически.
EtherCAN-службы и сетевые настройки уже установлены на машине и не заменяются
этим скриптом. Перед тестом проверьте `ethernet-can.service` и
`ethernet-can-rover.service`.

Рука пока запускается вручную: обновление калиброванных лимитов, затем
`arm_system_ros.launch.py` и `arm_ros.launch.py` по инструкции в
`robot/rukahod_ws_gateway/README.md`. Снимок в `config/` отражает последнюю
прочитанную калибровку; перед запуском руки прочитайте его заново с устройств.
После `sync_arm_limits.py` этот файл будет локально изменён: сохраните снимок
перед следующим pull (`git stash push -- config/calibrated_arm_limits.json`),
а после обновления снова прочитайте лимиты с руки.
Реальное исполнение через новый путь MoveIt ещё требует проверки на стенде.
