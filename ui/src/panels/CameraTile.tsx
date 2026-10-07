import { t, translateMessage } from "../i18n";
import { useEffect, useRef } from "preact/hooks";

import {
  attachCameraElement,
  cameraStates,
  reconnectCamera,
  toggleCameraCollapsed,
} from "../camera/cameraStore";
import type { CameraId, CameraStatus } from "../camera/cameraTypes";

type CameraTileProps = {
  cameraId: CameraId;
  compact?: boolean;
};

export function CameraTile({ cameraId, compact = false }: CameraTileProps) {
  const state = cameraStates.value[cameraId];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachCameraElement(cameraId, compact ? null : videoRef.current);
    return () => {
      attachCameraElement(cameraId, null);
    };
  }, [cameraId, compact]);

  return (
    <section className={compact ? "panel camera-card camera-card-compact" : "panel camera-card"}>
      <div className={compact ? "panel-head camera-panel-head compact" : "panel-head camera-panel-head"}>
        <div className="camera-head-copy">
          <h2 className="camera-title">{t(state.title)}</h2>
          {compact ? null : <p className="camera-subtext">{statusLabel(state.status)}</p>}
        </div>
        <div className="camera-actions">
          <button className="ghost-button" onClick={() => toggleCameraCollapsed(cameraId)} type="button">
            {state.collapsed ? t("Развернуть") : t("Свернуть")}
          </button>
          {compact ? null : (
            <button
              className="ghost-button"
              disabled={!state.enabled || state.status === "connecting"}
              onClick={() => reconnectCamera(cameraId)}
              type="button"
            >
              {t("Переподключить")}
        </button>
          )}
        </div>
      </div>

      {compact ? null : (
        <div className={`camera-placeholder ${placeholderTone(state)}`}>
          <video className="camera-video" muted playsInline ref={videoRef} />
          <div className="camera-overlay">
            <span>{translateMessage(statusOverlay(state.status, state.lastError))}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function placeholderTone(state: typeof cameraStates.value[CameraId]): string {
  switch (state.tone) {
    case "driver":
      return "driver";
    case "wrist":
      return "wrist";
    default:
      return "offline";
  }
}

function statusLabel(status: CameraStatus): string {
  switch (status) {
    case "idle":
      return t("Готова к запуску");
    case "connecting":
      return t("Подключение");
    case "live":
      return t("Поток активен");
    case "reconnecting":
      return t("Переподключение");
    case "disabled":
      return t("Отключена");
    case "error":
      return t("Ошибка");
    case "unconfigured":
      return t("Не настроена");
    default:
      return status;
  }
}

function statusOverlay(status: CameraStatus, lastError: string | null): string {
  switch (status) {
    case "live":
      return t("В эфире");
    case "connecting":
      return t("Подключение...");
    case "reconnecting":
      return t("Переподключение...");
    case "disabled":
      return t("Камера отключена");
    case "unconfigured":
      return t("WHEP URL не настроен");
    case "error":
      return lastError ?? t("Ошибка камеры");
    case "idle":
      return t("Ожидание");
    default:
      return status;
  }
}
