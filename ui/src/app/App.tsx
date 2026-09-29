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
import { useWorkspaceLayout, type ResizeAxis } from "./useWorkspaceLayout";

export function App() {
  const { workspaceRef, layout, start, move, stop, keyboardResize, reset } = useWorkspaceLayout();
  const wristCollapsed = cameraStates.value.wrist.collapsed;
  const frontCollapsed = cameraStates.value.driver.collapsed;
  const oneCollapsed = wristCollapsed || frontCollapsed;
  const commonCameraHeight = Math.max(layout.leftY, layout.rightY);
  const leftHeight = oneCollapsed || settingsOpen.value ? commonCameraHeight : layout.leftY;
  const rightHeight = oneCollapsed || settingsOpen.value ? commonCameraHeight : layout.rightY;
  const layoutStyle = `--top-split:${layout.topX * 100}%;--bottom-split:${layout.bottomX * 100}%;` +
    `--left-split:${leftHeight * 100}%;--right-split:${rightHeight * 100}%;`;
  const resizeHandle = (axis: ResizeAxis, label: string) => (
    <button
      aria-label={label}
      aria-orientation={axis.endsWith("Vertical") ? "vertical" : "horizontal"}
      aria-valuenow={Math.round((axis === "topVertical" ? layout.topX : axis === "bottomVertical" ? layout.bottomX :
        axis === "leftHorizontal" ? layout.leftY : layout.rightY) * 100)}
      className={`workspace-resizer resizer-${axis}`}
      onDblClick={reset}
      onKeyDown={(event) => keyboardResize(axis, event)}
      onPointerCancel={stop}
      onPointerDown={(event) => start(axis, event)}
      onPointerMove={move}
      onPointerUp={stop}
      role="separator"
      tabIndex={0}
      title="Перетащить для изменения размера. Двойной щелчок — сброс."
      type="button"
    />
  );
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

      <section className="unified-workspace" ref={workspaceRef} style={layoutStyle}>
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
        {resizeHandle("topVertical", "Ширина камер")}
        {resizeHandle("bottomVertical", "Ширина панелей управления")}
        {resizeHandle("leftHorizontal", "Высота камеры манипулятора")}
        {resizeHandle("rightHorizontal", "Высота фронтальной камеры")}
      </section>
    </main>
  );
}
