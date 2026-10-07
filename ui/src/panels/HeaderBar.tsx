import { language, setLanguage, t } from "../i18n";
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
      <div className="topbar-brand">
        <h1>{t("РукаХод")}</h1>
        <div className="language-switch" role="group" aria-label={t("Язык интерфейса")}>
          {(["ru", "en"] as const).map((locale) => (
            <button type="button" key={locale} aria-pressed={language.value === locale}
              onClick={() => setLanguage(locale)}>{locale.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className="topbar-status">
        <HeaderBadge label={t("Камеры")} value={`${cameraCount}/${cameraTotal} ${t("В эфире")}`} accent={cameraCount === cameraTotal ? "green" : cameraCount === 0 ? "red" : "amber"} />
        <HeaderBadge label={t("Манипулятор")} value={armReady ? t("Готов") : armConnection.value === "connected" ? t("Ожидание руки") : t("Нет связи")} accent={armReady ? "green" : armConnection.value === "error" ? "red" : "amber"} />
        <HeaderBadge label={t("Ровер")} value={roverReady ? t("Готов") : roverConnection.value === "connected" ? t("Ожидание ровера") : t("Нет связи")} accent={roverReady ? "green" : roverConnection.value === "error" ? "red" : "amber"} />
        <HeaderBadge label={t("Ошибки")} value={hasErrors ? t("Есть") : t("Нет")} accent={hasErrors ? "red" : "green"} />
        <button className={`header-badge settings-toggle ${settingsOpen.value ? "is-active" : ""}`} onClick={toggleSettings} aria-pressed={settingsOpen.value} type="button">
          <span>{t("Настройка")}</span>
          <strong>{settingsOpen.value ? t("К камерам") : t("Открыть")}</strong>
        </button>
      </div>
    </header>
  );
}

function HeaderBadge(props: { label: string; value: string; accent: "green" | "amber" | "red" }) {
  return <div className={`header-badge ${props.accent}`}><span>{props.label}</span><strong>{props.value}</strong></div>;
}
