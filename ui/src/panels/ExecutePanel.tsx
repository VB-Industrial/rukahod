import { t } from "../i18n";
import {
  canExecute,
  canReset,
  canStop,
  estopActive,
  resetState,
} from "../store/appState";
import { sendEstopToRobot, sendLockedTargetToRobot, sendResetEstopToRobot, sendStopToRobot } from "../transport/robotConnectionStore";
import { armTelemetryReady } from "../transport/robotConnectionStore";

export function ExecutePanel() {
  return (
    <section className="panel execute-panel">
      <div className="panel-head">
        <h2>{t("Манипулятор")}</h2>
      </div>

      <div className="execution-actions">
        <button className="execute-action" disabled={!canExecute.value || !armTelemetryReady.value} onClick={sendLockedTargetToRobot} type="button">
          {t("Движение")}
        </button>
        <button className="secondary-action" disabled={!canStop.value} onClick={sendStopToRobot} type="button">
          {t("Стоп")}
        </button>
        <button className="secondary-action" disabled={!canReset.value} onClick={resetState} type="button">
          {t("Сброс")}
        </button>
      </div>

      <div className="estop-actions">
        <button className="kill-switch inline" onClick={sendEstopToRobot} type="button">
          <span>{t("Авария")}</span>
        </button>
        <button
          className="secondary-action danger-outline"
          disabled={!estopActive.value}
          onClick={sendResetEstopToRobot}
          type="button"
        >
          {t("Сброс Аварии")}
        </button>
      </div>
    </section>
  );
}
