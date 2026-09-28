import { useEffect } from "preact/hooks";

import { ActionPresetPanel } from "../panels/ActionPresetPanel";
import { CameraPanel } from "../panels/CameraPanel";
import { HeaderBar } from "../panels/HeaderBar";
import { ServicePanel } from "../panels/ServicePanel";
import { SpeedPresetPanel } from "../panels/SpeedPresetPanel";
import { TelemetryPanel } from "../panels/TelemetryPanel";
import { initializeInputController } from "../input/inputController";
import { ageTelemetry, tickMock } from "../store/appState";
import { initializeRobotConnection } from "../transport/robotConnectionStore";

export function App() {
  useEffect(() => initializeRobotConnection(), []);

  useEffect(() => initializeInputController(), []);

  useEffect(() => {
    let previous = performance.now();
    let frame = 0;

    const loop = (now: number) => {
      const dtSec = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      tickMock(dtSec);
      ageTelemetry(dtSec);
      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="console-shell">
      <HeaderBar />

      <section className="workspace-grid">
        <CameraPanel cameraId="front" variant="hero" />

        <section className="dashboard-row">
          <CameraPanel cameraId="rear" />
          <ActionPresetPanel />
          <TelemetryPanel />
          <SpeedPresetPanel />
          <CameraPanel cameraId="panoramic" />
        </section>

        <section className="service-row">
          <ServicePanel />
        </section>
      </section>
    </main>
  );
}
