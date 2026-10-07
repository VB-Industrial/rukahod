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
