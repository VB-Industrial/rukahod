import { t } from "../i18n";
import { activateEstop, estopActive, resetEstop } from "../store/appState";

export function KillSwitchPanel() {
  return (
    <section className="panel kill-card">
      <div className="panel-head">
        <h2>{t("Аварийная остановка")}</h2>
        <span className={estopActive.value ? "status-dot red" : "status-dot muted"}>
          {estopActive.value ? t("Активен") : t("Не активен")}
        </span>
      </div>

      <button className="kill-switch" onClick={activateEstop} type="button">
        <span>{t("АВАРИЙНЫЙ СТОП")}</span>
        <small>KILL SWITCH</small>
      </button>

      <button
        className="secondary-action danger-outline"
        disabled={!estopActive.value}
        onClick={resetEstop}
        type="button"
      >
        {t("Сброс аварийного стопа")}
        </button>
    </section>
  );
}
