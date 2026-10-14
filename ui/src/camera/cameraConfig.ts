import type { CameraConfig, CameraId } from "./cameraTypes";

function savedCameraUrl(id: CameraId, fallback: string): string {
  const saved = window.localStorage.getItem(`rukahod.camera.${id}.url`);
  if ((id === "driver" && saved === "http://192.168.20.20:8889/stream3/whep") ||
      (id === "wrist" && saved === "http://192.168.20.20:8889/stream4/whep")) {
    window.localStorage.removeItem(`rukahod.camera.${id}.url`);
    return fallback;
  }
  return saved ?? fallback;
}

const frontDefault = import.meta.env.VITE_CAMERA_FRONT_WHEP_URL || `http://${window.location.hostname}:8889/cam1/whep`;
const armDefault = import.meta.env.VITE_CAMERA_ARM_WHEP_URL || `http://${window.location.hostname}:8889/cam2/whep`;

export const cameraConfigs: CameraConfig[] = [
  {
    id: "driver",
    title: "Камера 2",
    whepUrl: savedCameraUrl("driver", frontDefault),
    enabledByDefault: true,
    optional: false,
    reconnectDelayMs: 2000,
    connectTimeoutMs: 8000,
    tone: "driver",
  },
  {
    id: "wrist",
    title: "Камера 1",
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
