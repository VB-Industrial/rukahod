import { applyCalibratedJointLimits, clampJointsToLimits, type JointVector } from "../kinematics";
import { computed, signal } from "@preact/signals";
import {
  activateEstop,
  applyRemoteExecutionState,
  applyRemoteJointState,
  canExecute,
  executeTarget,
  lockedTarget,
  resetEstop,
  setConnectionReady,
  setFault,
  stopExecution,
} from "../store/appState";
import { ROBOT_PROTOCOL_VERSION, type RobotProtocolMessage, type RobotGroupName } from "./protocol";
import { ARM_JOINT_NAMES } from "../kinematics";
import { RobotSocketClient } from "./robotSocket";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type BackendLogLevel = "info" | "warn" | "error";
export type BackendLogEntry = {
  timestamp: number;
  level: BackendLogLevel;
  text: string;
};

const STORAGE_KEY = "rukahod.arm_ws_url";
const DEFAULT_URL = (import.meta.env as { VITE_ARM_WS_URL?: string }).VITE_ARM_WS_URL ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8765`;
const HEARTBEAT_INTERVAL_MS = 3000;
const RECONNECT_INTERVAL_MS = 30000;

export const robotConnectionUrl = signal(readInitialUrl());
export const robotConnectionState = signal<ConnectionState>("disconnected");
export const robotConnectionError = signal("");
export const robotConnectionServerName = signal("");
export const robotConnectionGroups = signal<RobotGroupName[]>([]);
export const robotLastMessageTs = signal<number | null>(null);
export const armJointStateAt = signal<number | null>(null);
export const armTelemetryReady = computed(() =>
  robotConnectionState.value === "connected" &&
  robotConnectionGroups.value.includes("arm"),
);
export const robotBackendStatus = signal("");
export const robotBackendLog = signal<BackendLogEntry[]>([]);

let client: RobotSocketClient | null = null;
let heartbeatTimer = 0;
let reconnectTimer: ReturnType<typeof window.setTimeout> | null = null;
let heartbeatCounter = 1;
let manuallyDisconnected = false;
let pendingJointStateFrame = 0;
let pendingArmJointState: { jointNames: string[]; positionsRad: number[] } | null = null;

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
    robotConnectionState.value = "error";
    robotConnectionError.value = "Не задан URL websocket.";
    return;
  }

  disconnectRobot(false);
  clearReconnectTimer();
  manuallyDisconnected = false;
  robotConnectionState.value = "connecting";
  robotConnectionGroups.value = [];
  armJointStateAt.value = null;
  robotConnectionError.value = "";
  robotBackendStatus.value = "Подключение к роботу...";

  client = new RobotSocketClient(url, {
    onOpen: () => {
      clearReconnectTimer();
      robotConnectionState.value = "connected";
      robotConnectionError.value = "";
      setConnectionReady(false);
      pushBackendLog("info", `WS подключён: ${url}`);
      sendHello();
      startHeartbeat();
    },
    onClose: () => {
      stopHeartbeat();
      setConnectionReady(false);
      armJointStateAt.value = null;
      robotConnectionGroups.value = [];
      robotConnectionState.value = manuallyDisconnected ? "disconnected" : "error";
      if (!manuallyDisconnected) {
        robotConnectionError.value = "Соединение закрыто.";
        pushBackendLog("warn", "Соединение с роботом закрыто.");
        scheduleReconnect();
      } else {
        pushBackendLog("info", "WS отключён вручную.");
      }
    },
    onError: () => {
      robotConnectionState.value = "error";
      robotConnectionError.value = "Ошибка websocket.";
      setConnectionReady(false);
      armJointStateAt.value = null;
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
  setConnectionReady(false);
  armJointStateAt.value = null;
  robotConnectionGroups.value = [];
  if (manual) {
    robotConnectionState.value = "disconnected";
    robotConnectionError.value = "";
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

export function sendLockedTargetToRobot() {
  if (!client?.isConnected() || !lockedTarget.value || !canExecute.value) {
    return false;
  }

  const commandId = createCommandId("goal");
  const currentTarget = lockedTarget.value;
  const sent = client.send("set_joint_goal", {
    command_id: commandId,
    goal: {
      group_name: "arm",
      joint_names: [...ARM_JOINT_NAMES],
      positions_rad: clampJointsToLimits(currentTarget.joints as JointVector).map(degToRad),
    },
  });
  if (!sent) {
    return false;
  }

  client.send("execute", {
    command_id: createCommandId("execute"),
    group_name: "arm",
  });
  executeTarget();
  return true;
}

export function sendStopToRobot() {
  if (!client?.isConnected()) {
    stopExecution();
    return false;
  }
  const sent = client.send("stop", {
    command_id: createCommandId("stop"),
    group_name: "arm",
  });
  if (sent) {
    stopExecution();
  }
  return sent;
}

export function sendEstopToRobot() {
  if (!client?.isConnected()) {
    activateEstop();
    return false;
  }
  const sent = client.send("estop", {
    command_id: createCommandId("estop"),
  });
  activateEstop();
  return sent;
}

export function sendResetEstopToRobot() {
  if (!client?.isConnected()) {
    resetEstop();
    return false;
  }
  const sent = client.send("reset_estop", {
    command_id: createCommandId("reset-estop"),
  });
  resetEstop();
  return sent;
}

function handleRobotMessage(message: RobotProtocolMessage) {
  robotLastMessageTs.value = Date.now();

  switch (message.type) {
    case "hello_ack":
      robotConnectionServerName.value = message.payload.server_name;
      robotConnectionGroups.value = message.payload.groups;
      pushBackendLog("info", `Handshake ok: ${message.payload.server_name}`);
      return;
    case "pong":
      return;
    case "joint_limits":
      applyCalibratedJointLimits(message.payload.limits);
      return;
    case "joint_state":
      if (message.payload.group_name === "arm") {
        armJointStateAt.value = Date.now();
        setConnectionReady(true);
      }
      queueRemoteJointState(message.payload.group_name, message.payload.name, message.payload.position_rad);
      return;
    case "planning_state":
      pushBackendLog(message.payload.status === "failed" ? "warn" : "info", formatBackendState("Планирование", message.payload.group_name, message.payload.status, message.payload.message));
      applyRemoteExecutionState(message.payload.status);
      return;
    case "execution_state":
      pushBackendLog(message.payload.status === "failed" || message.payload.status === "estop_active" ? "warn" : "info", formatBackendState("Выполнение", message.payload.group_name, message.payload.status, message.payload.message));
      applyRemoteExecutionState(message.payload.status);
      return;
    case "fault_state":
      setFault(message.payload.active);
      if (message.payload.active) {
        robotConnectionError.value = message.payload.message;
      } else {
        robotConnectionError.value = "";
      }
      pushBackendLog(message.payload.severity === "error" ? "error" : message.payload.severity === "warning" ? "warn" : "info", `Fault: ${message.payload.message}`);
      return;
    default:
      return;
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

function formatBackendState(scope: string, _groupName: RobotGroupName, status: string, message: string) {
  return `${scope}: Рука -> ${status}${message ? ` — ${message}` : ""}`;
}

function queueRemoteJointState(groupName: RobotGroupName, jointNames: string[], positionsRad: number[]) {
  if (groupName === "arm") {
    pendingArmJointState = {
      jointNames: [...jointNames],
      positionsRad: [...positionsRad],
    };
  } else {
    return;
  }

  if (pendingJointStateFrame !== 0) {
    return;
  }

  pendingJointStateFrame = window.requestAnimationFrame(() => {
    pendingJointStateFrame = 0;

    if (pendingArmJointState) {
      applyRemoteJointState("arm", pendingArmJointState.jointNames, pendingArmJointState.positionsRad);
      pendingArmJointState = null;
    }

  });
}

function sendHello() {
  client?.send("hello", {
    protocol_version: ROBOT_PROTOCOL_VERSION,
    client_name: "rukahod_operator_ui",
    requested_groups: ["arm"],
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
  if (heartbeatTimer !== 0) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
  }
}

function readInitialUrl() {
  const saved = localStorage.getItem(STORAGE_KEY)?.trim();
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, DEFAULT_URL);
    return DEFAULT_URL;
  }
  return saved;
}

function createCommandId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}
