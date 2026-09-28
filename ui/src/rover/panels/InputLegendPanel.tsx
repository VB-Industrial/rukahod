import { gamepadHint, keyboardHint } from "../input/controlStore";

export function InputLegendPanel() {
  return (
    <section className="panel legend-panel">
      <div className="panel-head">
        <h2>Шпаргалка</h2>
        <span className="muted-text">операторский набор</span>
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
      <strong>{props.title}</strong>
      <span>{props.text}</span>
    </div>
  );
}
