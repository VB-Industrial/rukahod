import { formatSpeed } from "../app/viewModel";
import { commandedAngularRadS, commandedLinearMps, maxAngularSpeed, speedKph, speedPresetMaxAngularRadS, telemetry } from "../store/appState";

export function TelemetryPanel() {
  const speedPercent = Math.min(Math.abs(speedKph.value) / 24, 1);
  const batteryPercent = Math.min(Math.max(telemetry.value.batteryPercent / 100, 0), 1);
  const voltagePercent = Math.min(Math.max((telemetry.value.batteryVoltage - 22) / 4, 0), 1);
  const speedAngle = -110 + speedPercent * 220;
  const angularLimit = Math.max(0.001, Math.min(maxAngularSpeed.value, speedPresetMaxAngularRadS.value));

  return (
    <section className="panel telemetry-panel">
      <div className="telemetry-cluster">
        <GaugeColumn label="Заряд" value={`${Math.round(telemetry.value.batteryPercent)}%`} fill={batteryPercent} />

        <div className="instrument-row">
          <div className="instrument-shell compass-shell">
            <div className="mini-dial compass-dial">
              <div className="mini-dial-ring" />
              <div className="compass-rose" style={{ transform: `translate(-50%, -50%) rotate(${-telemetry.value.headingDeg}deg)` }}>
                <span className="north">N</span>
                <span className="east">E</span>
                <span className="south">S</span>
                <span className="west">W</span>
              </div>
              <div className="compass-pointer" />
              <div className="mini-dial-center">
                <strong>{telemetry.value.headingDeg.toFixed(0)}°</strong>
                <span>Курс</span>
              </div>
            </div>
          </div>

          <div className="speedometer-shell">
            <div className="speedometer-arc" />
            <div className="speedometer-dial">
              <div className="speedometer-needle" style={{ transform: `translateX(-50%) rotate(${speedAngle}deg)` }} />
              <div className="speedometer-center">
                <strong>{formatSpeed(speedKph.value)}</strong>
              </div>
            </div>
          </div>

          <div className="instrument-shell inclinometer-shell">
            <div className="artificial-horizon">
              <div className="mini-dial-ring" />
              <div
                className="horizon-world"
                style={{
                  transform: `translate(-50%, calc(-50% + ${telemetry.value.pitchDeg * 1.15}px)) rotate(${telemetry.value.rollDeg}deg)`,
                }}
              >
                <div className="horizon-sky" />
                <div className="horizon-ground" />
                <div className="horizon-line" />
              </div>
              <div className="horizon-ladder" />
              <div className="rover-silhouette">
                <span className="rover-arm-base" />
                <span className="rover-arm-link" />
                <span className="rover-arm-tip" />
                <span className="rover-wheel left" />
                <span className="rover-body" />
                <span className="rover-wheel right" />
              </div>
              <div className="mini-dial-center imu-readout horizon-readout">
                <strong>{telemetry.value.rollDeg.toFixed(0)}°</strong>
                <span>{telemetry.value.pitchDeg.toFixed(0)}°</span>
              </div>
            </div>
          </div>
        </div>

        <GaugeColumn label="Вольтаж" value={`${telemetry.value.batteryVoltage.toFixed(1)} В`} fill={voltagePercent} />
      </div>

      <div className="command-mini-panel">
        <MiniCommand label="Линейная" value={`${commandedLinearMps.value.toFixed(2)} м/с`} signedPercent={Math.max(-1, Math.min(1, commandedLinearMps.value / 1.0))} />
        <MiniCommand label="Угловая" value={`${commandedAngularRadS.value.toFixed(2)} рад/с`} signedPercent={Math.max(-1, Math.min(1, -commandedAngularRadS.value / angularLimit))} />
        <MiniCommand label="X" value={`${telemetry.value.xMeters.toFixed(2)} м`} signedPercent={Math.max(-1, Math.min(1, telemetry.value.xMeters / 20))} />
        <MiniCommand label="Y" value={`${telemetry.value.yMeters.toFixed(2)} м`} signedPercent={Math.max(-1, Math.min(1, telemetry.value.yMeters / 20))} />
      </div>
    </section>
  );
}

function GaugeColumn(props: { label: string; value: string; fill: number }) {
  return (
    <div className="gauge-column">
      <strong>{props.value}</strong>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ height: `${props.fill * 100}%` }} />
      </div>
      <span>{props.label}</span>
    </div>
  );
}

function MiniCommand(props: { label: string; value: string; signedPercent?: number; progressPercent?: number }) {
  const signedPercent = props.signedPercent ?? 0;
  const widthPercent = `${Math.abs(signedPercent) * 50}%`;
  const left = signedPercent >= 0 ? "50%" : `calc(50% - ${widthPercent})`;

  return (
    <div className="mini-command">
      <span>{props.label}</span>
      <div className="mini-command-track">
        <div className="mini-command-zero" />
        {typeof props.progressPercent === "number" ? (
          <div className="mini-command-fill progress" style={{ width: `${props.progressPercent * 100}%`, left: "0" }} />
        ) : (
          <div className="mini-command-fill centered" style={{ width: widthPercent, left }} />
        )}
      </div>
      <strong>{props.value}</strong>
    </div>
  );
}
