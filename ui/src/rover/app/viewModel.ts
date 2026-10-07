import { t, tr } from "../../i18n";
import type { CameraStatus } from "../camera/cameraTypes";
import type { LinkQuality } from "../store/appState";
import type { DriveMode } from "../transport/protocol";

export function formatSpeed(speedKph: number): string {
  return tr`${Math.round(speedKph)} км/ч`;
}

export function formatHeading(headingDeg: number): string {
  return `${Math.round(headingDeg)}°`;
}

export function formatBattery(voltage: number, percent: number): string {
  return tr`${percent.toFixed(0)}% / ${voltage.toFixed(1)} В`;
}

export function translateDriveMode(mode: DriveMode): string {
  switch (mode) {
    case "manual":
      return t("Ручной");
    case "crab":
      return t("Крабовый");
    case "precision":
      return t("Точный");
    case "docking":
      return t("Швартовка");
    default:
      return mode;
  }
}

export function translateLinkQuality(quality: LinkQuality): string {
  switch (quality) {
    case "offline":
      return t("нет");
    case "weak":
      return t("слабая");
    case "stable":
      return t("стабильная");
    case "strong":
      return t("сильная");
    default:
      return quality;
  }
}

export function translateCameraStatus(status: CameraStatus): string {
  switch (status) {
    case "idle":
      return t("Ожидание");
    case "connecting":
      return t("Подключение");
    case "live":
      return "LIVE";
    case "reconnecting":
      return t("Переподключение");
    case "disabled":
      return t("Выключена");
    case "error":
      return t("Ошибка");
    case "unconfigured":
      return t("Не настроена");
    default:
      return status;
  }
}
