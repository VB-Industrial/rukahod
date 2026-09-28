import { useEffect, useRef } from "preact/hooks";

import { attachCameraElement, cameraStates, reconnectCamera, toggleCameraEnabled } from "../camera/cameraStore";
import type { CameraId } from "../camera/cameraTypes";

type CameraPanelProps = {
  cameraId: CameraId;
  variant?: "hero" | "card";
};

export function CameraPanel({ cameraId, variant = "card" }: CameraPanelProps) {
  const state = cameraStates.value[cameraId];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachCameraElement(cameraId, videoRef.current);
    return () => {
      attachCameraElement(cameraId, null);
    };
  }, [cameraId]);

  return (
    <section className={variant === "hero" ? "panel camera-panel hero-camera-panel" : "panel camera-panel card-camera-panel"}>
      {variant === "hero" ? null : (
        <div className="panel-head camera-panel-head">
          <div>
            <h2>{state.title}</h2>
          </div>
          <div className="camera-actions">
            <button className="ghost-button" onClick={() => toggleCameraEnabled(cameraId)} type="button">
              {state.enabled ? "Выключить" : "Включить"}
            </button>
            <button
              className="ghost-button"
              disabled={!state.enabled || state.status === "connecting"}
              onClick={() => reconnectCamera(cameraId)}
              type="button"
            >
              Переподключить
            </button>
          </div>
        </div>
      )}

      <div className={`camera-surface camera-${state.tone}`}>
        <video className="camera-video" muted playsInline ref={videoRef} />
      </div>
    </section>
  );
}
