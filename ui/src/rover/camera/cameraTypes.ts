export type CameraId = "front" | "rear" | "panoramic";

export type CameraTone = "front" | "rear" | "panoramic";

export type CameraStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "disabled"
  | "error"
  | "unconfigured";

export type CameraConfig = {
  id: CameraId;
  title: string;
  whepUrl: string;
  enabledByDefault: boolean;
  reconnectDelayMs: number;
  connectTimeoutMs: number;
  tone: CameraTone;
};

export type CameraState = CameraConfig & {
  enabled: boolean;
  status: CameraStatus;
  lastError: string | null;
  reconnectAttempt: number;
  connectedAt: number | null;
};
