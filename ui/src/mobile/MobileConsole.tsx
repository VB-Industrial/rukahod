import { useEffect, useRef, useState } from "preact/hooks";
import { language, setLanguage, t } from "../i18n";
import { ExecutePanel } from "../panels/ExecutePanel";
import { PosePresetPanel } from "../panels/PosePresetPanel";
import { JointControlPanel } from "../panels/JointControlPanel";
import { TcpControlPanel } from "../panels/TcpControlPanel";
import { ServicePanel } from "../panels/ServicePanel";
import { CameraTile } from "../panels/CameraTile";
import { cameraStates } from "../camera/cameraStore";
import { forwardKinematicsRuka2, type JointVector } from "../kinematics";
import { previewTarget, realTarget, resetAllTcpOrientationRates, syncPreviewTcpPoseFromModel, syncRealTcpPoseFromModel } from "../store/appState";
import { armTelemetryReady, sendStopToRobot as stopArm } from "../transport/robotConnectionStore";
import { batteryLabel, commandedAngularRadS, commandedLinearMps, headlightsEnabled, motionBlocked, safetyState, setCommand, setInputSource, speedKph, speedPreset, stopCommand, stopModeActive, telemetry } from "../rover/store/appState";
import { resetGyrocompassFromUi, applySpeedPresetFromUi, robotConnectionState, robotConnectionError, robotConnectionGroups, sendCmdVelToRobot, setStopModeFromUi, toggleHeadlightsFromUi } from "../rover/transport/robotConnectionStore";

type Tab = "settings" | "cameras" | "rover" | "arm";
function stopAll() { resetAllTcpOrientationRates(); setStopModeFromUi(true); stopArm(); }
const TABS: Array<[Tab, string]> = [["settings", "Настройки"], ["cameras", "Камеры"], ["rover", "Ровер"], ["arm", "Рука"]];

export function MobileConsole() {
  useEffect(() => () => resetAllTcpOrientationRates(), []);
  const [tab, setTab] = useState<Tab>("rover");
  const [armMode, setArmMode] = useState<"joint" | "tcp">("joint");
  const [camera, setCamera] = useState<"driver" | "wrist">("driver");
  // The desktop scene normally supplies FK readouts. Mobile uses the same URDF-derived chain, without WebGL.
  const realJoints = realTarget.value.joints.join(",");
  const targetJoints = previewTarget.value.joints.join(",");
  useEffect(() => {
    const pose = forwardKinematicsRuka2(realTarget.peek().joints as JointVector);
    syncRealTcpPoseFromModel([pose.position.x, pose.position.y, pose.position.z], pose.orientationQuaternion);
  }, [realJoints]);
  useEffect(() => {
    const pose = forwardKinematicsRuka2(previewTarget.peek().joints as JointVector);
    syncPreviewTcpPoseFromModel([pose.position.x, pose.position.y, pose.position.z], pose.orientationQuaternion);
  }, [targetJoints]);
  const selectTab = (next: Tab) => { resetAllTcpOrientationRates(); setTab(next); };
  return <main className="mobile-console">
    <header className="mobile-header panel">
      <h1>{t("РукаХод")}</h1>
      <nav aria-label={t("Разделы пульта")}>
        {TABS.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => selectTab(id)}>{t(label)}</button>)}
      </nav>
      <div className="language-switch" role="group" aria-label={t("Язык интерфейса")}>
        {(["ru", "en"] as const).map(locale => <button type="button" key={locale} aria-pressed={language.value === locale} onClick={() => setLanguage(locale)}>{locale.toUpperCase()}</button>)}
      </div>
      <span className={`mobile-ready ${robotConnectionState.value === "connected" && safetyState.value.roverReady ? "ready" : ""}`} title={t("Ровер")}>R</span>
      <span className={`mobile-ready ${armTelemetryReady.value ? "ready" : ""}`} title={t("Манипулятор")}>A</span>
      <span className="mobile-battery">{batteryLabel.value}</span>
    </header>
    <section className="mobile-content">
      {tab === "rover" ? <MobileRover /> : null}
      {tab === "arm" ? <div className="mobile-arm">
        <div className="mobile-subtabs" role="group" aria-label={t("Режим управления")}>
          <button type="button" aria-pressed={armMode === "joint"} onClick={() => { resetAllTcpOrientationRates(); setArmMode("joint"); }}>{t("По звеньям")}</button>
          <button type="button" aria-pressed={armMode === "tcp"} onClick={() => setArmMode("tcp")}>{t("Рабочая точка")}</button>
        </div>
        <div className="mobile-arm-actions"><ExecutePanel /><PosePresetPanel /></div>
        <div className="mobile-arm-sliders">{armMode === "joint" ? <JointControlPanel /> : <TcpControlPanel />}</div>
      </div> : null}
      {tab === "settings" ? <div className="mobile-settings"><ServicePanel /><button type="button" className="mobile-stop" onClick={stopAll}>{t("СТОП")}</button></div> : null}
      {tab === "cameras" ? <div className="mobile-cameras">
        <div className="mobile-subtabs" role="group" aria-label={t("Камеры")}>
          {(["driver", "wrist"] as const).map(id => <button type="button" key={id} aria-pressed={camera === id} onClick={() => setCamera(id)}>{t(cameraStates.value[id].title)}</button>)}
          <button type="button" className="mobile-stop" onClick={stopAll}>{t("СТОП")}</button>
        </div>
        <CameraTile key={camera} cameraId={camera} />
      </div> : null}
    </section>
  </main>;
}

function MobileRover() {
  const ready = robotConnectionState.value === "connected" && robotConnectionGroups.value.includes("rover") && safetyState.value.roverReady && safetyState.value.controlActive && safetyState.value.noFaults && !safetyState.value.estopActive;
  return <div className="mobile-rover">
    <section className="mobile-rover-status panel">
      <div className="mobile-speed"><strong>{Math.round(speedKph.value)}</strong><span>{t("км/ч")}</span></div>
      <div className="mobile-rover-facts"><span>{t("Курс")} {telemetry.value.headingDeg.toFixed(0)}°</span><span>{telemetry.value.batteryVoltage.toFixed(1)} {t("В")} · {telemetry.value.batteryCurrent.toFixed(1)} A</span></div>
      <button type="button" className="mobile-gyro-reset" disabled={!telemetry.value.imuValid || robotConnectionState.value !== "connected"} onClick={resetGyrocompassFromUi}>{t("Сброс гирокомпаса")}</button>
      <div className="mobile-command-readout"><span>{t("Линейная")} {commandedLinearMps.value.toFixed(2)} {t("м/с")}</span><span>{t("Угловая")} {commandedAngularRadS.value.toFixed(2)} {t("рад/с")}</span></div>
      <button type="button" className={`mobile-stop ${stopModeActive.value ? "active" : ""}`} aria-pressed={stopModeActive.value} onClick={() => setStopModeFromUi(!stopModeActive.value)}>{t("СТОП")}</button>
      <button type="button" className={`mobile-light ${headlightsEnabled.value ? "active" : ""}`} aria-pressed={headlightsEnabled.value} onClick={toggleHeadlightsFromUi}>{t("Свет")}</button>
    </section>
    <section className="mobile-gears panel"><h2>{t("Скорость")}</h2>
      {(["3", "2", "1", "P"] as const).map((preset, index) => <button type="button" key={preset} aria-pressed={speedPreset.value === preset} onClick={() => applySpeedPresetFromUi(preset)}><strong>{preset}</strong><span>{[t("Макс."), `0.5 ${t("м/с")}`, `0.1 ${t("м/с")}`, t("Парковка")][index]}</span></button>)}
    </section>
    <TouchJoystick enabled={ready && !motionBlocked.value} />
  </div>;
}

function TouchJoystick({ enabled }: { enabled: boolean }) {
  const pad = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const command = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const release = () => {
    const held = pointer.current !== null;
    pointer.current = null;
    command.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
    if (held) { stopCommand(); sendCmdVelToRobot(); }
  };
  useEffect(() => {
    if (!enabled) release();
  }, [enabled]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (pointer.current !== null) {
        setInputSource("keyboard_mouse");
        setCommand(-command.current.y, -command.current.x, false);
        sendCmdVelToRobot();
      }
    }, 50);
    const hidden = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", hidden);
    return () => { clearInterval(tick); release(); window.removeEventListener("blur", release); window.removeEventListener("pagehide", release); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const update = (event: PointerEvent) => {
    if (pointer.current !== event.pointerId || !enabled || !pad.current) return;
    const rect = pad.current.getBoundingClientRect();
    const radius = rect.width * .36;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    command.current = length < .08 ? { x: 0, y: 0 } : { x, y };
    setKnob({ x: x * radius, y: y * radius });
    setInputSource("keyboard_mouse");
    setCommand(-command.current.y, -command.current.x, false);
    sendCmdVelToRobot();
  };
  return <section className={`mobile-joystick-panel panel ${enabled ? "" : "disabled"}`}>
    <h2>{t("Движение")}</h2>
    <div className="touch-joystick" ref={pad} aria-label={t("Джойстик движения")} aria-disabled={!enabled}
      onPointerDown={event => { if (!enabled || pointer.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
      onPointerMove={update} onPointerUp={event => { if (pointer.current === event.pointerId) release(); }}
      onPointerCancel={event => { if (pointer.current === event.pointerId) release(); }} onLostPointerCapture={event => { if (pointer.current === event.pointerId) release(); }}>
      <span className="joystick-arrow up">▲</span><span className="joystick-arrow down">▼</span><span className="joystick-arrow left">◀</span><span className="joystick-arrow right">▶</span>
      <span className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    <p>{t(robotConnectionError.value || (enabled ? "Удерживайте для движения" : motionBlocked.value ? "Выберите скорость и снимите СТОП" : "Ровер не готов"))}</p>
  </section>;
}
