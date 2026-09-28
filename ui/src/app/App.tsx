import { useEffect } from "preact/hooks";
import { CameraTile } from "../panels/CameraTile";
import { ExecutePanel } from "../panels/ExecutePanel";
import { HeaderBar } from "../panels/HeaderBar";
import { JointControlPanel } from "../panels/JointControlPanel";
import { KinematicViewportPanel } from "../panels/KinematicViewportPanel";
import { PosePresetPanel } from "../panels/PosePresetPanel";
import { TcpControlPanel } from "../panels/TcpControlPanel";
import { ActionPresetPanel } from "../rover/panels/ActionPresetPanel";
import { TelemetryPanel } from "../rover/panels/TelemetryPanel";
import { SpeedPresetPanel } from "../rover/panels/SpeedPresetPanel";
import { initializeInputController } from "../rover/input/inputController";
import { ageTelemetry, tickMock } from "../rover/store/appState";

export function App() {
  useEffect(() => initializeInputController(), []);
  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dtSec = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      tickMock(dtSec);
      ageTelemetry(dtSec);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="console-shell rukahod-shell">
      <HeaderBar />

      <section className="unified-workspace">
        <div className="unified-cameras">
          <CameraTile cameraId="wrist" />
          <CameraTile cameraId="driver" />
        </div>
        <div className="unified-controls">
          <section className="arm-controls">
          <JointControlPanel />
          <KinematicViewportPanel />
          <div className="action-stack">
            <ExecutePanel />
            <PosePresetPanel />
          </div>
          <TcpControlPanel />
          </section>
          <section className="rover-controls">
            <ActionPresetPanel />
            <TelemetryPanel />
            <SpeedPresetPanel />
          </section>
        </div>
      </section>
    </main>
  );
}
