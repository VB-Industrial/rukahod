import type { CameraConfig, CameraId } from "./cameraTypes";

// function envValue(key: string): string {
//   const value = import.meta.env[key];
//   return typeof value === "string" ? value.trim() : "";
// }

export const cameraConfigs: CameraConfig[] = [
  {
    id: "driver",
    title: "Фронтальная камера",
    whepUrl: 'http://192.168.20.20:8889/stream3/whep',
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "driver",
  },
  {
    id: "wrist",
    title: "Камера на манипуляторе",
    whepUrl: 'http://192.168.20.20:8889/stream4/whep',
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "wrist",
  },

];

export const cameraConfigMap = Object.fromEntries(cameraConfigs.map((config) => [config.id, config])) as Record<
  CameraId,
  CameraConfig
>;

export const primaryCameraIds: CameraId[] = ["wrist", "driver"];
