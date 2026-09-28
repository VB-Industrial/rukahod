import { signal } from "@preact/signals";

import {
  activateEstop,
  applyOdometry,
  connectionState,
  commandedAngularRadS,
  commandedLinearMps,
  cycleSpeedPreset,
  driveMode,
  setHeadlightsEnabled,
  inputSource,
  mockEnabled,
  resetEstop,
  setBattery,
  setConnectionState,
  setControlActive,
  setDriveMode,
  setFault,
  setInputSource,
  setLinkQuality,
  setMockEnabled,
  setRoverReady,
  setSpeedPreset,
  setStopMode,
  stopCommand,
  toggleHeadlightsEnabled,
  toggleStopMode,
  type SpeedPreset,
} from "../store/appState";
import {
  ROBOT_PROTOCOL_VERSION,
  type RobotGroupName,
  type RobotProtocolMessage,
} from "./protocol";
import { RobotSocketClient } from "./robotSocket";

type BackendLogLevel = "info" | "warn" | "error";
export type BackendLogEntry = {
  timestamp: number;
  level: BackendLogLevel;
  text: string;
};

const STORAGE_KEY = "silverhand.rover_ws_url";
const DEFAULT_URL = (import.meta.env as { VITE_ROBOT_WS_URL?: string }).VITE_ROBOT_WS_URL ?? "ws://192.168.20.5:8766";
const HEARTBEAT_INTERVAL_MS = 3000;
const RECONNECT_INTERVAL_MS = 30000;

export const robotConnectionUrl = signal(readInitialUrl());
export const robotConnectionState = connectionState;
export const robotConnectionServerName = signal("");
export const robotConnectionGroups = signal<RobotGroupName[]>([]);
export const robotLastMessageTs = signal<number | null>(null);
export const robotBackendStatus = signal("");
export const robotBackendLog = signal<BackendLogEntry[]>([]);
export const robotConnectionError = signal("");

let client: RobotSocketClient | null = null;
let heartbeatTimer = 0;
let reconnectTimer: ReturnType<typeof window.setTimeout> | null = null;
let heartbeatCounter = 1;
let manuallyDisconnected = false;

export function initializeRobotConnection() {
  connectRobot();
  return () => {
    disconnectRobot();
  };
}

export function setRobotConnectionUrl(nextUrl: string) {
  robotConnectionUrl.value = nextUrl;
  localStorage.setItem(STORAGE_KEY, nextUrl);
}

export function connectRobot() {
  const url = robotConnectionUrl.value.trim();
  if (!url) {
    setConnectionState("error");
    robotConnectionError.value = "Не задан URL websocket.";
    return;
  }

  disconnectRobot(false);
  clearReconnectTimer();
  manuallyDisconnected = false;
  setConnectionState("connecting");
  robotConnectionError.value = "";
  robotBackendStatus.value = "Подключение к rover gateway...";

  client = new RobotSocketClient(url, {
    onOpen: () => {
      clearReconnectTimer();
      setConnectionState("connected");
      setLinkQuality("strong");
      robotConnectionError.value = "";
      pushBackendLog("info", `WS подключён: ${url}`);
      sendHello();
      startHeartbeat();
    },
    onClose: () => {
      stopHeartbeat();
      setLinkQuality("offline");
      setConnectionState(manuallyDisconnected ? "disconnected" : "error");
      if (!manuallyDisconnected) {
        robotConnectionError.value = "Соединение закрыто.";
        pushBackendLog("warn", "Соединение с rover gateway закрыто.");
        scheduleReconnect();
      } else {
        pushBackendLog("info", "WS отключён вручную.");
      }
    },
    onError: () => {
      setConnectionState("error");
      setLinkQuality("offline");
      robotConnectionError.value = "Ошибка websocket.";
      pushBackendLog("error", "Ошибка websocket.");
      if (!manuallyDisconnected) {
        scheduleReconnect();
      }
    },
    onMessage: handleRobotMessage,
  });

  client.connect();
}

export function disconnectRobot(manual = true) {
  manuallyDisconnected = manual;
  stopHeartbeat();
  clearReconnectTimer();
  client?.disconnect();
  client = null;
  setLinkQuality("offline");
  if (manual) {
    setConnectionState("disconnected");
    robotBackendStatus.value = "WS отключён.";
  }
}

export function reconnectRobot() {
  connectRobot();
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (manuallyDisconnected || reconnectTimer !== null) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectRobot();
  }, RECONNECT_INTERVAL_MS);
  pushBackendLog("warn", "Повторная попытка подключения через 30 секунд.");
}

export function sendCmdVelToRobot(): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("cmd_vel", {
    command_id: createCommandId("cmd-vel"),
    frame_id: "base_link",
    linear_m_s: commandedLinearMps.value,
    angular_rad_s: commandedAngularRadS.value,
    source: inputSource.value,
    turbo: Math.abs(commandedLinearMps.value) > 1.8,
  });
}

export function sendStopToRobot(): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("stop", {
    command_id: createCommandId("stop"),
    group_name: "rover",
  });
}

export function sendEstopToRobot(): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("estop", {
    command_id: createCommandId("estop"),
  });
}

export function sendResetEstopToRobot(): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("reset_estop", {
    command_id: createCommandId("reset-estop"),
  });
}

export function sendDriveModeToRobot(): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("set_drive_mode", {
    command_id: createCommandId("mode"),
    mode: driveMode.value,
  });
}

export function sendHeadlightsToRobot(enabled: boolean): boolean {
  if (!client?.isConnected()) {
    return false;
  }

  return client.send("set_headlights", {
    command_id: createCommandId("headlights"),
    enabled,
  });
}

function handleRobotMessage(message: RobotProtocolMessage) {
  robotLastMessageTs.value = Date.now();
  setLinkQuality("strong");

  switch (message.type) {
    case "hello_ack":
      robotConnectionServerName.value = message.payload.server_name;
      robotConnectionGroups.value = message.payload.groups;
      pushBackendLog("info", `Handshake ok: ${message.payload.server_name}`);
      return;
    case "pong":
      return;
    case "odometry":
      applyOdometry(
        message.payload.linear_m_s,
        message.payload.angular_rad_s,
        message.payload.heading_deg,
        message.payload.odometer_km,
        message.payload.x_m,
        message.payload.y_m,
        message.payload.roll_deg,
        message.payload.pitch_deg,
      );
      return;
    case "battery_state":
      setBattery(message.payload.percent, message.payload.voltage_v);
      return;
    case "rover_state":
      setDriveMode(message.payload.mode);
      setRoverReady(message.payload.ready);
      setControlActive(message.payload.control_active);
      setHeadlightsEnabled(message.payload.headlights_enabled);
      setInputSource(message.payload.input_source);
      setLinkQuality(message.payload.signal_quality);
      return;
    case "fault_state":
      setFault(message.payload.active);
      if (message.payload.active) {
        robotConnectionError.value = message.payload.message;
      }
      pushBackendLog(
        message.payload.severity === "error" || message.payload.severity === "fatal" ? "error" : "warn",
        `Fault: ${message.payload.message}`,
      );
      return;
    default:
      return;
  }
}

function sendHello() {
  client?.send("hello", {
    protocol_version: ROBOT_PROTOCOL_VERSION,
    client_name: "silverhand_rover_teleop_ui",
    requested_groups: ["rover"],
  });
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    client?.send("ping", {
      heartbeat_id: `hb-${heartbeatCounter++}`,
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }
}

function pushBackendLog(level: BackendLogLevel, text: string) {
  robotBackendStatus.value = text;
  const previous = robotBackendLog.value[0];
  if (previous && previous.text === text && previous.level === level) {
    robotBackendLog.value = [
      { ...previous, timestamp: Date.now() },
      ...robotBackendLog.value.slice(1),
    ];
    return;
  }

  robotBackendLog.value = [
    { timestamp: Date.now(), level, text },
    ...robotBackendLog.value,
  ].slice(0, 6);
}

function readInitialUrl(): string {
  if (typeof window === "undefined") {
    return DEFAULT_URL;
  }
  const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
  if (!saved || saved === "ws://127.0.0.1:8766" || saved === "ws://localhost:8766") {
    window.localStorage.setItem(STORAGE_KEY, DEFAULT_URL);
    return DEFAULT_URL;
  }
  return saved;
}

function createCommandId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function simulateFault(): void {
  setFault(true);
  pushBackendLog("warn", "Mock fault включён.");
}

export function resetFault(): void {
  setFault(false);
  pushBackendLog("info", "Mock fault сброшен.");
}

export function toggleMockBackend(): void {
  setMockEnabled(!mockEnabled.value);
  pushBackendLog("info", mockEnabled.value ? "Mock backend активирован." : "Mock backend выключен.");
}

export function activateEstopFromUi(): void {
  activateEstop();
  void sendEstopToRobot();
  pushBackendLog("warn", "E-STOP активирован оператором.");
}

export function resetEstopFromUi(): void {
  resetEstop();
  void sendResetEstopToRobot();
  pushBackendLog("info", "E-STOP сброшен.");
}

export function stopMotionFromUi(): void {
  stopCommand();
  void sendStopToRobot();
  pushBackendLog("info", "Команда stop отправлена.");
}

export function applySpeedPresetFromUi(preset: SpeedPreset): void {
  setSpeedPreset(preset);
  if (preset === "P") {
    void sendStopToRobot();
    pushBackendLog("info", "Режим P активирован.");
  }
}

export function cycleSpeedPresetFromUi(step: 1 | -1): void {
  const nextPreset = cycleSpeedPreset(step);
  if (nextPreset === "P") {
    void sendStopToRobot();
    pushBackendLog("info", "Режим P активирован.");
  }
}

export function toggleStopModeFromUi(): void {
  const next = toggleStopMode();
  if (next) {
    void sendStopToRobot();
    pushBackendLog("warn", "STOP режим активирован.");
    return;
  }
  pushBackendLog("info", "STOP режим снят.");
}

export function setStopModeFromUi(active: boolean): void {
  setStopMode(active);
  if (active) {
    void sendStopToRobot();
  }
}

export function toggleHeadlightsFromUi(): void {
  const next = toggleHeadlightsEnabled();
  if (!sendHeadlightsToRobot(next)) {
    pushBackendLog("warn", "Команда света локально применена, но не отправлена в gateway.");
    return;
  }
  pushBackendLog("info", next ? "Фары включены." : "Фары выключены.");
}

export function setHeadlightsFromUi(enabled: boolean): void {
  setHeadlightsEnabled(enabled);
  if (!sendHeadlightsToRobot(enabled)) {
    pushBackendLog("warn", "Состояние света локально применено, но не отправлено в gateway.");
    return;
  }
  pushBackendLog("info", enabled ? "Фары включены." : "Фары выключены.");
}
