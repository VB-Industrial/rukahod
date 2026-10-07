import { t } from "../../i18n";
import { gamepadHint, keyboardHint } from "../input/controlStore";

export function InputLegendPanel() {
  return (
    <section className="panel legend-panel">
      <div className="panel-head">
        <h2>{t("Шпаргалка")}</h2>
        <span className="muted-text">{t("операторский набор")}</span>
      </div>

      <div className="legend-grid">
        <LegendCard title={keyboardHint.value.title} text={keyboardHint.value.text} />
        <LegendCard title={gamepadHint.value.title} text={gamepadHint.value.text} />
      </div>
    </section>
  );
}

function LegendCard(props: { title: string; text: string }) {
  return (
    <div className="legend-card">
      <strong>{t(props.title)}</strong>
      <span>{t(props.text)}</span>
    </div>
  );
}
