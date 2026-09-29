import { cameraSummary } from "../camera/cameraStore";
import { safetyState as armSafety } from "../store/appState";
import { settingsOpen, toggleSettings } from "../store/uiState";
import { robotConnectionState as armConnection, robotConnectionGroups as armGroups } from "../transport/robotConnectionStore";
import { safetyState as roverSafety } from "../rover/store/appState";
import { robotConnectionState as roverConnection, robotConnectionGroups as roverGroups } from "../rover/transport/robotConnectionStore";

export function HeaderBar() {
  const cameraCount = cameraSummary.value.liveCount;
  const cameraTotal = cameraSummary.value.totalPrimary;
  const armReady = armConnection.value === "connected" && armGroups.value.includes("arm") && armSafety.value.noFaults;
  const roverReady = roverConnection.value === "connected" && roverGroups.value.includes("rover") && roverSafety.value.roverReady && roverSafety.value.noFaults;
  const hasErrors = cameraSummary.value.hasErrors || armConnection.value === "error" || roverConnection.value === "error" || !armSafety.value.noFaults || !roverSafety.value.noFaults;

  return (
    <header className="topbar panel">
      <div className="topbar-brand"><h1>РукаХод</h1></div>
      <div className="topbar-status">
        <HeaderBadge label="Камеры" value={`${cameraCount}/${cameraTotal} live`} accent={cameraCount === cameraTotal ? "green" : cameraCount === 0 ? "red" : "amber"} />
        <HeaderBadge label="Манипулятор" value={armReady ? "Готов" : armConnection.value === "connected" ? "Ожидание руки" : "Нет связи"} accent={armReady ? "green" : armConnection.value === "error" ? "red" : "amber"} />
        <HeaderBadge label="Ровер" value={roverReady ? "Готов" : roverConnection.value === "connected" ? "Ожидание ровера" : "Нет связи"} accent={roverReady ? "green" : roverConnection.value === "error" ? "red" : "amber"} />
        <HeaderBadge label="Ошибки" value={hasErrors ? "Есть" : "Нет"} accent={hasErrors ? "red" : "green"} />
        <button className={`header-badge settings-toggle ${settingsOpen.value ? "is-active" : ""}`} onClick={toggleSettings} aria-pressed={settingsOpen.value} type="button">
          <span>Настройка</span>
          <strong>{settingsOpen.value ? "К камерам" : "Открыть"}</strong>
        </button>
      </div>
    </header>
  );
}

function HeaderBadge(props: { label: string; value: string; accent: "green" | "amber" | "red" }) {
  return <div className={`header-badge ${props.accent}`}><span>{props.label}</span><strong>{props.value}</strong></div>;
}
