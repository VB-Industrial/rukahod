import { headlightsEnabled, stopModeActive } from "../store/appState";
import { toggleHeadlightsFromUi, toggleStopModeFromUi } from "../transport/robotConnectionStore";

export function ActionPresetPanel() {
  return (
    <section className="panel action-preset-panel">
      <div className="action-preset-stack">
        <button
          className={stopModeActive.value ? "action-preset-chip active active-stop" : "action-preset-chip"}
          onClick={() => toggleStopModeFromUi()}
          type="button"
        >
          <strong>STOP</strong>
          <span>Space</span>
        </button>

        <button
          className={headlightsEnabled.value ? "action-preset-chip active active-light" : "action-preset-chip"}
          onClick={() => toggleHeadlightsFromUi()}
          type="button"
        >
          <strong>Свет</strong>
          <span>F</span>
        </button>
      </div>
    </section>
  );
}
