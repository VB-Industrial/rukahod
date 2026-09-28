import type { CameraConfig, CameraId } from "./cameraTypes";

function savedCameraUrl(id: CameraId, fallback: string): string {
  return window.localStorage.getItem(`rukahod.camera.${id}.url`) ?? fallback;
}

const frontDefault = import.meta.env.VITE_CAMERA_FRONT_WHEP_URL || "http://192.168.20.20:8889/stream3/whep";
const armDefault = import.meta.env.VITE_CAMERA_ARM_WHEP_URL || "http://192.168.20.20:8889/stream4/whep";

export const cameraConfigs: CameraConfig[] = [
  {
    id: "driver",
    title: "Фронтальная камера",
    whepUrl: savedCameraUrl("driver", frontDefault),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "driver",
  },
  {
    id: "wrist",
    title: "Камера на манипуляторе",
    whepUrl: savedCameraUrl("wrist", armDefault),
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
