import {
  canExecute,
  canReset,
  canStop,
  estopActive,
  resetState,
} from "../store/appState";
import { sendEstopToRobot, sendLockedTargetToRobot, sendResetEstopToRobot, sendStopToRobot } from "../transport/robotConnectionStore";

export function ExecutePanel() {
  return (
    <section className="panel execute-panel">
      <div className="panel-head">
        <h2>Манипулятор</h2>
      </div>

      <div className="execution-actions">
        <button className="execute-action" disabled={!canExecute.value} onClick={sendLockedTargetToRobot} type="button">
          Движение
        </button>
        <button className="secondary-action" disabled={!canStop.value} onClick={sendStopToRobot} type="button">
          Стоп
        </button>
        <button className="secondary-action" disabled={!canReset.value} onClick={resetState} type="button">
          Сброс
        </button>
      </div>

      <div className="estop-actions">
        <button className="kill-switch inline" onClick={sendEstopToRobot} type="button">
          <span>Авария</span>
        </button>
        <button
          className="secondary-action danger-outline"
          disabled={!estopActive.value}
          onClick={sendResetEstopToRobot}
          type="button"
        >
          Сброс Аварии
        </button>
      </div>
    </section>
  );
}
