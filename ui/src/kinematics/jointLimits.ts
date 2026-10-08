import { signal } from "@preact/signals";
import { ARM_JOINT_NAMES, type JointLimitMap, type JointVector } from "./types";
import { RUKA2_JOINT_LIMITS_RAD } from "./ruka2Limits.generated";

export const DEFAULT_JOINT_LIMITS_DEG: JointLimitMap = Object.fromEntries(
  ARM_JOINT_NAMES.map((name) => [name, {
    minDeg: RUKA2_JOINT_LIMITS_RAD[name].min * 180 / Math.PI,
    maxDeg: RUKA2_JOINT_LIMITS_RAD[name].max * 180 / Math.PI,
  }]),
) as JointLimitMap;

export function areJointLimitsSatisfied(jointsDeg: JointVector, limits: JointLimitMap = DEFAULT_JOINT_LIMITS_DEG): boolean {
  return ARM_JOINT_NAMES.every((name, index) => Number.isFinite(jointsDeg[index]) &&
    jointsDeg[index] >= limits[name].minDeg && jointsDeg[index] <= limits[name].maxDeg);
}

export function clampJointsToLimits(jointsDeg: JointVector, limits: JointLimitMap = DEFAULT_JOINT_LIMITS_DEG): JointVector {
  return ARM_JOINT_NAMES.map((name, index) =>
    Math.min(limits[name].maxDeg, Math.max(limits[name].minDeg, jointsDeg[index]))) as JointVector;
}

export const activeJointLimits = signal<JointLimitMap>({ ...DEFAULT_JOINT_LIMITS_DEG });
export function applyCalibratedJointLimits(bounds: Record<string, { min_position: number; max_position: number }>): void {
  const next = {} as JointLimitMap;
  for (const name of ARM_JOINT_NAMES) {
    const b = bounds[name];
    if (!b || !Number.isFinite(b.min_position) || !Number.isFinite(b.max_position) || b.min_position >= b.max_position) throw new Error("Invalid calibrated joint limits");
    next[name] = { minDeg: b.min_position * 180 / Math.PI, maxDeg: b.max_position * 180 / Math.PI };
  }
  Object.assign(DEFAULT_JOINT_LIMITS_DEG, next);
  activeJointLimits.value = next;
}
