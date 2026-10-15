import { t } from "../i18n";
import { applyFoldedPreset, applyUnfoldedPreset, editingDisabled } from "../store/appState";

export function PosePresetPanel({ embedded = false }: { embedded?: boolean }) {
  return (
    <section className={embedded ? "pose-preset-panel embedded" : "panel pose-preset-panel"}>
      <button className="preset-action" disabled={editingDisabled.value} onClick={applyFoldedPreset} type="button">
        {t("Сложить")}
        </button>
      <button className="preset-action" disabled={editingDisabled.value} onClick={applyUnfoldedPreset} type="button">
        {t("Разложить")}
        </button>
    </section>
  );
}
