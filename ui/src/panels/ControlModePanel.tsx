import { t } from "../i18n";
import { controlMode, setControlMode } from "../store/appState";

export function ControlModePanel() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("Режим управления")}</h2>
      </div>
      <div className="segmented">
        <button
          className={controlMode.value === "joint" ? "segment active" : "segment"}
          onClick={() => setControlMode("joint")}
          type="button"
        >
          {t("Углы манипулятора")}
        </button>
        <button
          className={controlMode.value === "tcp" ? "segment active" : "segment"}
          onClick={() => setControlMode("tcp")}
          type="button"
        >
          {t("Декартовы координаты")}
        </button>
      </div>
    </section>
  );
}
