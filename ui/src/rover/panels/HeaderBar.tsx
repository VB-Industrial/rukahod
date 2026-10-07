import { t } from "../../i18n";
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
        <HeaderBadge label={t("Скорость")} value={speedPresetLabel.value} accent="amber" />
        <HeaderBadge
          label={t("Источник")}
          value={inputSource.value === "joystick" ? t("Джойстик") : inputSource.value === "mock_autonomy" ? "Mock" : t("Клав. + мышь")}
          accent="blue"
        />
        <HeaderBadge label={t("Связь")} value={robotConnectionState.value === "connected" ? t("ОК") : t("НЕТ")} accent={linkAccent} />
        <HeaderBadge label={t("Ровер")} value={safetyState.value.roverReady ? t("готов") : t("не готов")} accent={safetyState.value.roverReady ? "green" : "red"} />
        <HeaderBadge label={t("Аккумулятор")} value={batteryLabel.value} accent={batteryLabel.value === "0%" ? "red" : "green"} />
        <HeaderBadge label={t("Ошибки")} value={safetyState.value.noFaults ? t("нет ошибок") : t("есть fault")} accent={safetyState.value.noFaults ? "green" : "red"} />
      </div>
    </header>
  );
}

function HeaderBadge(props: { label: string; value: string; accent: "green" | "amber" | "red" | "blue" }) {
  return (
    <div className={`header-badge ${props.accent}`}>
      <span>{props.label}</span>
      <strong>{t(props.value)}</strong>
    </div>
  );
}
