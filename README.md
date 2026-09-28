# РукаХод

Предварительный единый пульт оператора для манипулятора и ровера.

## Запуск интерфейса

```bash
cd ui
npm ci
npm run dev -- --host 0.0.0.0 --port 4175
```

Откройте `http://localhost:4175/`. Видеопотоки требуют доступности WHEP источников. Пульт пока служит для согласования компоновки: подключение к оборудованию в новом пакете ещё не реализовано.

Исходные панели: [манипулятор](https://github.com/VB-Industrial/silverhand_arm_teleop), [ровер](https://github.com/VB-Industrial/silverhand_rover_teleop).
