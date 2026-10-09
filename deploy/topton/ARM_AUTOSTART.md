# Автозапуск руки

Службы `rukahod-arm-control` и `rukahod-arm-gateway` запускаются при загрузке
компьютера в ROS domain 49. Перед запуском контроллера читаются текущие лимиты
с узлов руки на vcan1.0. Без успешного чтения контроллер не запускается.

```bash
sudo cp deploy/topton/rukahod-arm-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rukahod-arm-control rukahod-arm-gateway
```

Включение служб в автозагрузку не запускает их немедленно. Запуск контроллера
активирует реальные приводы и удержание положения. Перед запуском и загрузкой
компьютера обеспечьте безопасное положение руки и свободную зону движения.
Ручные launch одновременно со службами запускать нельзя.

```bash
sudo systemctl start rukahod-arm-control rukahod-arm-gateway
systemctl status rukahod-arm-control rukahod-arm-gateway
journalctl -u rukahod-arm-control -u rukahod-arm-gateway -n 100 --no-pager
sudo systemctl stop rukahod-arm-gateway rukahod-arm-control
```

Обе службы используют Restart=always и RestartSec=5. Завершение контроллера,
MoveIt или arm gateway завершает соответствующий launch, чтобы systemd мог
перезапустить службу. При перезапуске контроллера калибровка читается снова.
Программный аварийный стоп gateway не сохраняется при перезапуске процесса.
Остановка службы командой systemctl stop не вызывает автоматический рестарт.
