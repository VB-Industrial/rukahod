import { t, tr } from "../i18n";
import { useState } from "preact/hooks";
import { formatNumber } from "../app/viewModel";
import { KinematicScene } from "../scene/KinematicScene";
import {
  gripperGoalPercent,
  consumeGizmoWristPreset,
  gizmoWristPresetArmed,
  interactionMode,
  previewTarget,
  realTarget,
  setControlMode,
  syncRealTcpPoseFromModel,
  syncPreviewTcpPoseFromModel,
  syncTcpPoseFromModel,
  updateTcpQuaternionFromGizmo,
  updateTcpPositionFromGizmo,
} from "../store/appState";

export function KinematicViewportPanel() {
  const [tcpPosition, setTcpPosition] = useState({
    real: [realTarget.value.tcp[0], realTarget.value.tcp[1], realTarget.value.tcp[2]] as [number, number, number],
    target: [previewTarget.value.tcp[0], previewTarget.value.tcp[1], previewTarget.value.tcp[2]] as [number, number, number],
  });

  const currentOrientation = tr`Крен ${formatNumber(realTarget.value.tcp[3])} / Тангаж ${formatNumber(realTarget.value.tcp[4])} / Рыскание ${formatNumber(
    realTarget.value.tcp[5],
  )}°`;
  const targetOrientation = tr`Крен ${formatNumber(previewTarget.value.tcp[3])} / Тангаж ${formatNumber(
    previewTarget.value.tcp[4],
  )} / Рыскание ${formatNumber(previewTarget.value.tcp[5])}°`;

  return (
    <div
      className={interactionMode.value === "planner_gizmo" ? "panel model-panel active-control-panel" : "panel model-panel"}
      onPointerDown={() => {
        setControlMode("tcp");
      }}
    >
      <div className="model-placeholder">
        <KinematicScene
          realGripperPercent={realTarget.value.gripper}
          targetGripperPercent={gripperGoalPercent.value}
          realJoints={realTarget.value.joints}
          targetJoints={previewTarget.value.joints}
          targetTcp={[previewTarget.value.tcp[0], previewTarget.value.tcp[1], previewTarget.value.tcp[2]]}
          targetQuaternion={previewTarget.value.orientationQuaternion}
          gizmoWristPresetArmed={gizmoWristPresetArmed.value}
          interactionMode={interactionMode.value}
          onTcpPositionChange={setTcpPosition}
          onInitialTargetSync={syncTcpPoseFromModel}
          onRealJointPoseSync={syncRealTcpPoseFromModel}
          onTargetJointPoseSync={syncPreviewTcpPoseFromModel}
          onConsumeGizmoWristPreset={consumeGizmoWristPreset}
          onTargetQuaternionChange={updateTcpQuaternionFromGizmo}
          onTargetTcpChange={updateTcpPositionFromGizmo}
        />
        <div className="pose-readout current">
          <span className="pose-tag current">{t("Текущее положение")}</span>
          <div className="pose-inline-card">
            <strong>
              X {formatNumber(tcpPosition.real[0])} / Y {formatNumber(tcpPosition.real[1])} / Z {formatNumber(tcpPosition.real[2])} {t("м")}</strong>
            <small>{currentOrientation}</small>
          </div>
        </div>
        <div className="pose-readout target">
          <span className="pose-tag target">{t("Цель")}</span>
          <div className="pose-inline-card target">
            <strong>
              X {formatNumber(tcpPosition.target[0])} / Y {formatNumber(tcpPosition.target[1])} / Z {formatNumber(tcpPosition.target[2])} {t("м")}</strong>
            <small>{targetOrientation}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
