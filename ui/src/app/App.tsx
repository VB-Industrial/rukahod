import { useEffect } from "preact/hooks";
import { CameraTile } from "../panels/CameraTile";
import { cameraStates } from "../camera/cameraStore";
import { ExecutePanel } from "../panels/ExecutePanel";
import { HeaderBar } from "../panels/HeaderBar";
import { JointControlPanel } from "../panels/JointControlPanel";
import { KinematicViewportPanel } from "../panels/KinematicViewportPanel";
import { PosePresetPanel } from "../panels/PosePresetPanel";
import { ServicePanel } from "../panels/ServicePanel";
import { TcpControlPanel } from "../panels/TcpControlPanel";
import { ActionPresetPanel } from "../rover/panels/ActionPresetPanel";
import { TelemetryPanel } from "../rover/panels/TelemetryPanel";
import { SpeedPresetPanel } from "../rover/panels/SpeedPresetPanel";
import { initializeInputController } from "../rover/input/inputController";
import { ageTelemetry, tickMock } from "../rover/store/appState";
import { initializeRobotConnection as initializeArmConnection } from "../transport/robotConnectionStore";
import { initializeRobotConnection as initializeRoverConnection } from "../rover/transport/robotConnectionStore";
import { healthClock, settingsOpen } from "../store/uiState";

export function App() {
  const wristCollapsed = cameraStates.value.wrist.collapsed;
  const frontCollapsed = cameraStates.value.driver.collapsed;
  const oneCollapsed = wristCollapsed || frontCollapsed;
  useEffect(() => {
    const stopArm = initializeArmConnection();
    const stopRover = initializeRoverConnection();
    const timer = window.setInterval(() => { healthClock.value = Date.now(); }, 1000);
    return () => {
      window.clearInterval(timer);
      stopArm();
      stopRover();
    };
  }, []);
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
        <div className="top-stage">
          <div className={`unified-cameras${oneCollapsed ? " has-collapsed" : ""}${settingsOpen.value ? " settings-hidden" : ""}`}>
            <div className={`camera-slot ${wristCollapsed ? "is-collapsed side-left" : oneCollapsed ? "is-primary" : ""}`}>
              <CameraTile cameraId="wrist" compact={wristCollapsed} />
            </div>
            <div className={`camera-slot ${frontCollapsed ? "is-collapsed side-right" : oneCollapsed ? "is-primary" : ""}`}>
              <CameraTile cameraId="driver" compact={frontCollapsed} />
            </div>
          </div>
          {settingsOpen.value ? <ServicePanel /> : null}
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
