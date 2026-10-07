import { t } from "../i18n";
import { applyFoldedPreset, applyUnfoldedPreset, editingDisabled } from "../store/appState";

export function PosePresetPanel() {
  return (
    <section className="panel pose-preset-panel">
      <button className="preset-action" disabled={editingDisabled.value} onClick={applyFoldedPreset} type="button">
        {t("Сложить")}
        </button>
      <button className="preset-action" disabled={editingDisabled.value} onClick={applyUnfoldedPreset} type="button">
        {t("Разложить")}
        </button>
    </section>
  );
}
