import { batteryLabel, inputSource, safetyState, speedPresetLabel } from "../store/appState";
import { robotConnectionState } from "../transport/robotConnectionStore";

export function HeaderBar() {
  const linkAccent =
    robotConnectionState.value === "connected"
      ? "green"
      : robotConnectionState.value === "connecting"
        ? "amber"
        : "red";

  return (
    <header className="topbar panel">
      <div className="topbar-status">
        <HeaderBadge label="Скорость" value={speedPresetLabel.value} accent="amber" />
        <HeaderBadge
          label="Источник"
          value={inputSource.value === "joystick" ? "Джойстик" : inputSource.value === "mock_autonomy" ? "Mock" : "Клав. + мышь"}
          accent="blue"
        />
        <HeaderBadge label="Связь" value={robotConnectionState.value === "connected" ? "ОК" : "НЕТ"} accent={linkAccent} />
        <HeaderBadge label="Ровер" value={safetyState.value.roverReady ? "готов" : "не готов"} accent={safetyState.value.roverReady ? "green" : "red"} />
        <HeaderBadge label="Аккумулятор" value={batteryLabel.value} accent={batteryLabel.value === "0%" ? "red" : "green"} />
        <HeaderBadge label="Ошибки" value={safetyState.value.noFaults ? "нет ошибок" : "есть fault"} accent={safetyState.value.noFaults ? "green" : "red"} />
      </div>
    </header>
  );
}

function HeaderBadge(props: { label: string; value: string; accent: "green" | "amber" | "red" | "blue" }) {
  return (
    <div className={`header-badge ${props.accent}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
