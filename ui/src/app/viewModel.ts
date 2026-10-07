import { t } from "../i18n";
export const JOINT_LABELS = ["Звено 1", "Звено 2", "Звено 3", "Звено 4", "Звено 5", "Звено 6"];
export const TCP_LABELS = ["X", "Y", "Z", "Крен", "Тангаж", "Рыскание"];

export function translateState(state: string): string {
  switch (state) {
    case "idle":
      return t("Ожидание");
    case "preview":
      return t("Предпросмотр");
    case "target_locked":
      return t("Цель зафиксирована");
    case "executing":
      return t("Выполнение");
    case "stopped":
      return t("Остановлено");
    case "estop_active":
      return t("Аварийный стоп");
    case "fault":
      return t("Ошибка");
    default:
      return state;
  }
}

export function translateSource(source: string): string {
  switch (source) {
    case "joystick":
      return t("Джойстик");
    case "keyboard_mouse":
      return t("Клавиатура + мышь");
    case "sliders":
      return t("Слайдеры");
    default:
      return source;
  }
}

export function translateInteractionMode(mode: string): string {
  switch (mode) {
    case "idle":
      return t("Ожидание");
    case "servo_joystick":
      return t("Джойстик");
    case "planner_gizmo":
      return "Gizmo";
    case "planner_joint":
      return t("Звенья");
    case "planner_tcp":
      return t("Рабочая точка");
    default:
      return mode;
  }
}

export function stateTone(state: string): "green" | "amber" | "red" | "blue" {
  switch (state) {
    case "idle":
      return "blue";
    case "preview":
      return "amber";
    case "target_locked":
      return "amber";
    case "executing":
      return "green";
    case "stopped":
      return "amber";
    case "estop_active":
      return "red";
    case "fault":
      return "red";
    default:
      return "blue";
  }
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
