import { useState } from "preact/hooks";
import { cameraStates, reconnectCamera, setCameraUrl } from "../camera/cameraStore";
import type { CameraId } from "../camera/cameraTypes";
import { healthClock } from "../store/uiState";
import { safetyState as armSafety } from "../store/appState";
import {
  armTelemetryReady,
  connectRobot as connectArm,
  disconnectRobot as disconnectArm,
  robotBackendLog as armLog,
  robotConnectionError as armError,
  robotConnectionGroups as armGroups,
  robotConnectionServerName as armServer,
  robotConnectionState as armConnection,
  robotConnectionUrl as armUrl,
  armJointStateAt,
  setRobotConnectionUrl as setArmUrl,
} from "../transport/robotConnectionStore";
import { safetyState as roverSafety } from "../rover/store/appState";
import {
  connectRobot as connectRover,
  disconnectRobot as disconnectRover,
  robotBackendLog as roverLog,
  robotConnectionError as roverError,
  robotConnectionGroups as roverGroups,
  robotConnectionServerName as roverServer,
  robotConnectionState as roverConnection,
  robotConnectionUrl as roverUrl,
  roverStateAt,
  setRobotConnectionUrl as setRoverUrl,
} from "../rover/transport/robotConnectionStore";

function ageLabel(timestamp: number | null): string {
  if (timestamp === null) return "Нет данных";
  return `${Math.max(0, Math.floor((healthClock.value - timestamp) / 1000))} с назад`;
}

function connectionLabel(state: string): string {
  switch (state) {
    case "connected": return "Подключено";
    case "connecting": return "Подключение";
    case "error": return "Ошибка связи";
    default: return "Отключено";
  }
}

function cameraStatusLabel(status: string): string {
  switch (status) {
    case "live": return "В эфире";
    case "connecting": return "Подключение";
    case "reconnecting": return "Повторное подключение";
    case "disabled": return "Выключена";
    case "unconfigured": return "Не настроена";
    case "error": return "Ошибка";
    default: return "Ожидание";
  }
}

function WsCard(props: {
  title: string;
  url: string;
  state: string;
  server: string;
  groups: string[];
  telemetryAt: number | null;
  ready: boolean;
  error: string;
  logs: Array<{ timestamp: number; text: string; level: string }>;
  onSave: (url: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [draft, setDraft] = useState(props.url);
  const [validationError, setValidationError] = useState("");
  const apply = () => {
    const next = draft.trim();
    if (!/^wss?:\/\//i.test(next)) {
      setValidationError("Используйте адрес ws:// или wss://");
      return;
    }
    setValidationError("");
    props.onSave(next);
    props.onConnect();
  };

  return (
    <section className="service-card panel">
      <div className="service-card-head">
        <h2>{props.title}</h2>
        <span className={`service-state ${props.ready ? "is-ready" : props.state === "error" ? "is-error" : ""}`}>
          {props.ready ? "Готов" : connectionLabel(props.state)}
        </span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <label className="service-field">
          <span>WebSocket адрес</span>
          <input value={draft} onInput={(event) => setDraft(event.currentTarget.value)} spellcheck={false} />
        </label>
        <div className="service-buttons">
          <button className="secondary-action" type="submit">Применить и подключить</button>
          <button className="ghost-button" onClick={props.onDisconnect} type="button">Отключить</button>
        </div>
      </form>
      <div className="service-facts">
        <span>Связь: <strong>{connectionLabel(props.state)}</strong></span>
        <span>Готовность: <strong>{props.ready ? "Подтверждена" : "Не подтверждена"}</strong></span>
        <span>Телеметрия: <strong>{ageLabel(props.telemetryAt)}</strong></span>
        <span>Сервер: <strong>{props.server || "—"}</strong></span>
        <span>Группы: <strong>{props.groups.join(", ") || "—"}</strong></span>
      </div>
      {validationError || props.error ? <p className="service-error">{validationError || props.error}</p> : null}
      <div className="service-log" aria-label={`События: ${props.title}`}>
        {props.logs.slice(0, 3).map((entry) => (
          <div className={`service-log-entry service-log-entry-${entry.level}`} key={`${entry.timestamp}-${entry.text}`}>{entry.text}</div>
        ))}
      </div>
    </section>
  );
}

function CameraCard({ id }: { id: CameraId }) {
  const camera = cameraStates.value[id];
  const [draft, setDraft] = useState(camera.whepUrl);
  const [validationError, setValidationError] = useState("");
  const apply = () => {
    try {
      setCameraUrl(id, draft);
      setValidationError("");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Неверный адрес");
    }
  };

  return (
    <section className="service-card panel">
      <div className="service-card-head">
        <h2>{camera.title}</h2>
        <span className={`service-state ${camera.status === "live" ? "is-ready" : camera.status === "error" ? "is-error" : ""}`}>
          {cameraStatusLabel(camera.status)}
        </span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); apply(); }}>
        <label className="service-field">
          <span>WHEP адрес</span>
          <input value={draft} onInput={(event) => setDraft(event.currentTarget.value)} spellcheck={false} />
        </label>
        <div className="service-buttons">
          <button className="secondary-action" type="submit">Применить</button>
          <button className="ghost-button" onClick={() => reconnectCamera(id)} type="button">Переподключить</button>
        </div>
      </form>
      <div className="service-facts">
        <span>Статус: <strong>{cameraStatusLabel(camera.status)}</strong></span>
        <span>Подключена: <strong>{ageLabel(camera.connectedAt)}</strong></span>
        <span>Попытки: <strong>{camera.reconnectAttempt}</strong></span>
      </div>
      {validationError || camera.lastError ? <p className="service-error">{validationError || camera.lastError}</p> : null}
    </section>
  );
}

export function ServicePanel() {
  const armReady = armTelemetryReady.value && armSafety.value.noFaults;
  const roverReady = roverConnection.value === "connected" && roverGroups.value.includes("rover") && roverSafety.value.roverReady && roverSafety.value.noFaults;

  return (
    <section className="service-stage panel" aria-label="Настройка соединений и камер">
      <div className="service-stage-heading">
        <div>
          <h2>Настройка</h2>
          <p>Адреса сохраняются в этом браузере. При применении WebSocket соединение переподключается.</p>
        </div>
      </div>
      <div className="service-grid">
        <WsCard title="Манипулятор" url={armUrl.value} state={armConnection.value} server={armServer.value} groups={armGroups.value} telemetryAt={armJointStateAt.value} ready={armReady} error={armError.value} logs={armLog.value} onSave={setArmUrl} onConnect={connectArm} onDisconnect={disconnectArm} />
        <WsCard title="Ровер" url={roverUrl.value} state={roverConnection.value} server={roverServer.value} groups={roverGroups.value} telemetryAt={roverStateAt.value} ready={roverReady} error={roverError.value} logs={roverLog.value} onSave={setRoverUrl} onConnect={connectRover} onDisconnect={disconnectRover} />
        <CameraCard id="wrist" />
        <CameraCard id="driver" />
      </div>
    </section>
  );
}
