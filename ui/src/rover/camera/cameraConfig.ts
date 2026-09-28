import type { CameraConfig, CameraId } from "./cameraTypes";


export const cameraConfigs: CameraConfig[] = [
  {
    id: "front",
    title: "Передняя камера",
    whepUrl: 'http://192.168.20.20:8889/stream3/whep',
    enabledByDefault: true,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "front",
  },
  {
    id: "rear",
    title: "Задняя панорама",
    whepUrl: 'http://192.168.20.20:8889/stream2/whep',
    enabledByDefault: false,
    reconnectDelayMs: 2500,
    connectTimeoutMs: 8000,
    tone: "rear",
  },
  {
    id: "panoramic",
    title: "Передняя панорама",
    whepUrl: 'http://192.168.20.20:8889/stream1/whep',
    enabledByDefault: false,
    reconnectDelayMs: 2500,
    connectTimeoutMs: 8000,
    tone: "panoramic",
  },
];

export const cameraConfigMap = Object.fromEntries(cameraConfigs.map((config) => [config.id, config])) as Record<
  CameraId,
  CameraConfig
>;
