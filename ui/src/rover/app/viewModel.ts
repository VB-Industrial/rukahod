import type { CameraStatus } from "../camera/cameraTypes";
import type { LinkQuality } from "../store/appState";
import type { DriveMode } from "../transport/protocol";

export function formatSpeed(speedKph: number): string {
  return `${Math.round(speedKph)} км/ч`;
}

export function formatHeading(headingDeg: number): string {
  return `${Math.round(headingDeg)}°`;
}

export function formatBattery(voltage: number, percent: number): string {
  return `${percent.toFixed(0)}% / ${voltage.toFixed(1)} В`;
}

export function translateDriveMode(mode: DriveMode): string {
  switch (mode) {
    case "manual":
      return "Ручной";
    case "crab":
      return "Крабовый";
    case "precision":
      return "Точный";
    case "docking":
      return "Швартовка";
    default:
      return mode;
  }
}

export function translateLinkQuality(quality: LinkQuality): string {
  switch (quality) {
    case "offline":
      return "нет";
    case "weak":
      return "слабая";
    case "stable":
      return "стабильная";
    case "strong":
      return "сильная";
    default:
      return quality;
  }
}

export function translateCameraStatus(status: CameraStatus): string {
  switch (status) {
    case "idle":
      return "Ожидание";
    case "connecting":
      return "Подключение";
    case "live":
      return "LIVE";
    case "reconnecting":
      return "Переподключение";
    case "disabled":
      return "Выключена";
    case "error":
      return "Ошибка";
    case "unconfigured":
      return "Не настроена";
    default:
      return status;
  }
}
