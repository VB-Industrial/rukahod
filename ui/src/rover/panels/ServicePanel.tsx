import { useState } from "preact/hooks";

import { safetyState } from "../store/appState";
import {
  activateEstopFromUi,
  connectRobot,
  disconnectRobot,
  reconnectRobot,
  resetEstopFromUi,
  resetFault,
  robotBackendLog,
  robotBackendStatus,
  robotConnectionError,
  robotConnectionUrl,
  setRobotConnectionUrl,
  simulateFault,
  stopMotionFromUi,
  toggleMockBackend,
} from "../transport/robotConnectionStore";
import { connectionState, mockEnabled } from "../store/appState";

export function ServicePanel() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={collapsed ? "panel service-bar service-bar-collapsed" : "panel service-bar"}>
      <div className="service-bar-label">
        <span className="section-overline">Сервис</span>
        <strong>Mock, отладка и сеть</strong>
      </div>

      <div className="service-bar-toggle">
        <button className="secondary-action" onClick={() => setCollapsed((value) => !value)} type="button">
          {collapsed ? "Показать отладочную панель" : "Скрыть отладочную панель"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="service-actions">
            <label className="service-url-input">
              <span>WS</span>
              <input
                onInput={(event) => setRobotConnectionUrl((event.currentTarget as HTMLInputElement).value)}
                placeholder="ws://192.168.20.5:8766"
                type="text"
                value={robotConnectionUrl.value}
              />
            </label>

            <button
              className={connectionState.value === "connected" ? "secondary-action accent-amber" : "secondary-action"}
              onClick={() => {
                if (connectionState.value === "connected" || connectionState.value === "connecting") {
                  disconnectRobot();
                } else {
                  connectRobot();
                }
              }}
              type="button"
            >
              {connectionState.value === "connected" || connectionState.value === "connecting" ? "Отключить WS" : "Подключить WS"}
            </button>

            <button className="secondary-action" onClick={reconnectRobot} type="button">
              Переподключить WS
            </button>

            <button
              className={mockEnabled.value ? "secondary-action accent-amber" : "secondary-action"}
              onClick={toggleMockBackend}
              type="button"
            >
              {mockEnabled.value ? "Выключить mock" : "Включить mock"}
            </button>

            <button className="secondary-action" onClick={stopMotionFromUi} type="button">
              STOP
            </button>

            <button
              className={safetyState.value.estopActive ? "ghost-button active-danger" : "ghost-button"}
              onClick={safetyState.value.estopActive ? resetEstopFromUi : activateEstopFromUi}
              type="button"
            >
              {safetyState.value.estopActive ? "Сбросить E-STOP" : "E-STOP"}
            </button>

            <button
              className={safetyState.value.noFaults ? "ghost-button" : "ghost-button active-danger"}
              onClick={safetyState.value.noFaults ? simulateFault : resetFault}
              type="button"
            >
              {safetyState.value.noFaults ? "Сымитировать fault" : "Сбросить fault"}
            </button>
          </div>

          <div className="service-status-block">
            <span className="service-status-text">{robotConnectionError.value || robotBackendStatus.value || "Статус backend появится после первого события."}</span>
            {robotBackendLog.value.length > 0 ? (
              <div className="service-status-log">
                {robotBackendLog.value.map((entry) => (
                  <div className={`service-log-entry service-log-entry-${entry.level}`} key={`${entry.timestamp}-${entry.text}`}>
                    {entry.text}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
