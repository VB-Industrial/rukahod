import { commandAngular, commandLinear, commandTurbo } from "../store/appState";

export function DriveCommandPanel() {
  return (
    <section className="panel command-panel">
      <div className="panel-head">
        <h2>Команда движения</h2>
        <span className="muted-text">WASD / left stick</span>
      </div>

      <div className="command-meters">
        <CommandMeter label="Линейная" value={commandLinear.value} />
        <CommandMeter label="Угловая" value={commandAngular.value} />
      </div>

      <div className="command-footer">
        <span>Boost</span>
        <strong>{commandTurbo.value ? "включён" : "выключен"}</strong>
      </div>
    </section>
  );
}

function CommandMeter(props: { label: string; value: number }) {
  const percent = `${50 + props.value * 50}%`;
  return (
    <div className="command-meter">
      <span>{props.label}</span>
      <div className="command-track">
        <div className="command-center" />
        <div className="command-fill" style={{ width: `calc(${Math.abs(props.value) * 50}% + 2px)`, left: props.value >= 0 ? "50%" : `calc(${percent} - ${Math.abs(props.value) * 50}%)` }} />
      </div>
      <strong>{props.value.toFixed(2)}</strong>
    </div>
  );
}
