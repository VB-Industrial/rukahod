import { t } from "../../i18n";
import { translateDriveMode } from "../app/viewModel";
import { cycleDriveMode, driveMode, inputSource, safetyState, setDriveMode } from "../store/appState";
import type { DriveMode } from "../transport/protocol";
import { sendDriveModeToRobot } from "../transport/robotConnectionStore";

const MODES: DriveMode[] = ["manual", "crab", "precision", "docking"];

export function ControlModesPanel() {
  return (
    <section className="panel modes-panel">
      <div className="panel-head">
        <h2>{t("Режимы")}</h2>
        <span className="muted-text">{t("мышь + кнопки + Q/E")}</span>
      </div>

      <div className="mode-list">
        {MODES.map((mode) => (
          <button
            className={mode === driveMode.value ? "mode-chip active" : "mode-chip"}
            onClick={() => {
              setDriveMode(mode);
              void sendDriveModeToRobot();
            }}
            type="button"
          >
            {translateDriveMode(mode)}
          </button>
        ))}
      </div>

      <div className="mode-summary">
        <div>
          <span>{t("Источник")}</span>
          <strong>{inputSource.value === "joystick" ? t("Джойстик") : inputSource.value === "mock_autonomy" ? "Mock" : t("Клава + мышь")}</strong>
        </div>
        <div>
          <span>{t("Контроль")}</span>
          <strong>{safetyState.value.controlActive ? t("Активен") : t("Заблокирован")}</strong>
        </div>
      </div>

      <div className="mode-actions">
        <button className="secondary-action" onClick={() => cycleDriveMode(-1)} type="button">
          {t("Предыдущий")}
        </button>
        <button className="secondary-action" onClick={() => cycleDriveMode(1)} type="button">
          {t("Следующий")}
        </button>
      </div>
    </section>
  );
}
