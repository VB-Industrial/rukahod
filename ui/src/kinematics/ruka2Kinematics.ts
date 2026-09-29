import * as THREE from "three";
import { RUKA2_CHAIN, RUKA2_TOOL } from "./ruka2Chain.generated";
import { RUKA2_JOINT_LIMITS_RAD } from "./ruka2Limits.generated";
import { normalizeQuaternion } from "./quaternion";
import { selectBestSolution } from "./selectBestSolution";
import { ARM_JOINT_NAMES, type AnalyticIkCandidate, type AnalyticIkResult, type AnalyticIkSolver, type JointVector, type TcpPose } from "./types";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const POSITION_TOLERANCE = 0.0005;
const ORIENTATION_TOLERANCE = 0.01;
const ORIENTATION_WEIGHT = 0.35;

const joints = RUKA2_CHAIN.map(({ xyz, rpy, axis }) => ({
  origin: transformFromUrdf(xyz, rpy),
  axis: new THREE.Vector3(...axis).normalize(),
}));
const toolTransform = transformFromUrdf(RUKA2_TOOL.xyz, RUKA2_TOOL.rpy);
const lowerLimits = ARM_JOINT_NAMES.map((name) => RUKA2_JOINT_LIMITS_RAD[name].min);
const upperLimits = ARM_JOINT_NAMES.map((name) => RUKA2_JOINT_LIMITS_RAD[name].max);

function transformFromUrdf(xyz: readonly number[], rpy: readonly number[]): THREE.Matrix4 {
  const orientation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rpy[0], rpy[1], rpy[2], "ZYX"),
  );
  return new THREE.Matrix4().compose(
    new THREE.Vector3(xyz[0], xyz[1], xyz[2]),
    orientation,
    new THREE.Vector3(1, 1, 1),
  );
}

function forwardRad(q: readonly number[]): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const transform = new THREE.Matrix4();
  joints.forEach((joint, index) => {
    transform.multiply(joint.origin);
    transform.multiply(new THREE.Matrix4().makeRotationAxis(joint.axis, q[index]));
  });
  transform.multiply(toolTransform);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  transform.decompose(position, quaternion, new THREE.Vector3());
  return { position, quaternion };
}

export function forwardKinematicsRuka2(jointsDeg: JointVector): TcpPose {
  const pose = forwardRad(jointsDeg.map((value) => value * DEG_TO_RAD));
  return {
    position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
    orientationQuaternion: [pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w],
  };
}

function orientationError(current: THREE.Quaternion, target: THREE.Quaternion): THREE.Vector3 {
  const delta = target.clone().multiply(current.clone().invert()).normalize();
  if (delta.w < 0) {
    delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  }
  const imaginaryLength = Math.hypot(delta.x, delta.y, delta.z);
  if (imaginaryLength < 1e-10) {
    return new THREE.Vector3(2 * delta.x, 2 * delta.y, 2 * delta.z);
  }
  const angle = 2 * Math.atan2(imaginaryLength, delta.w);
  return new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(angle / imaginaryLength);
}

function poseError(
  current: ReturnType<typeof forwardRad>,
  target: ReturnType<typeof forwardRad>,
): number[] {
  const position = target.position.clone().sub(current.position);
  const rotation = orientationError(current.quaternion, target.quaternion);
  return [position.x, position.y, position.z,
    rotation.x * ORIENTATION_WEIGHT, rotation.y * ORIENTATION_WEIGHT, rotation.z * ORIENTATION_WEIGHT];
}

function errorNorm(error: number[]): number {
  return Math.hypot(...error);
}

function targetAsThree(target: TcpPose): ReturnType<typeof forwardRad> {
  const [x, y, z, w] = normalizeQuaternion(target.orientationQuaternion);
  return {
    position: new THREE.Vector3(target.position.x, target.position.y, target.position.z),
    quaternion: new THREE.Quaternion(x, y, z, w),
  };
}

function clampToLimits(q: readonly number[]): JointVector {
  return q.map((value, index) => Math.min(upperLimits[index], Math.max(lowerLimits[index], value))) as JointVector;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < 6; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 6; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let col = column; col <= 6; col += 1) rows[column][col] /= divisor;
    for (let row = 0; row < 6; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let col = column; col <= 6; col += 1) rows[row][col] -= factor * rows[column][col];
    }
  }
  return rows.map((row) => row[6]);
}

function solveFromSeed(target: ReturnType<typeof forwardRad>, seed: JointVector): JointVector | null {
  let q = clampToLimits(seed.map((value) => value * DEG_TO_RAD));
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const current = forwardRad(q);
    const error = poseError(current, target);
    if (Math.hypot(error[0], error[1], error[2]) < POSITION_TOLERANCE &&
      Math.hypot(error[3], error[4], error[5]) / ORIENTATION_WEIGHT < ORIENTATION_TOLERANCE) {
      return q.map((value) => value * RAD_TO_DEG) as JointVector;
    }

    const step = 1e-4;
    const columns = q.map((_, index) => {
      const moved = [...q];
      moved[index] += step;
      const movedPose = forwardRad(moved);
      const position = movedPose.position.clone().sub(current.position).divideScalar(step);
      const rotation = orientationError(current.quaternion, movedPose.quaternion).multiplyScalar(ORIENTATION_WEIGHT / step);
      return [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z];
    });
    const normal = columns.map((left, row) =>
      columns.map((right, col) => left.reduce((sum, value, axis) => sum + value * right[axis], row === col ? 1e-3 : 0)));
    const projected = columns.map((column) => column.reduce((sum, value, axis) => sum + value * error[axis], 0));
    const delta = solveLinearSystem(normal, projected);
    if (!delta) return null;
    const scale = Math.min(1, 0.25 / Math.max(1e-9, Math.hypot(...delta)));
    let improved = false;
    for (const fraction of [1, 0.5, 0.25, 0.125]) {
      const next = clampToLimits(q.map((value, index) => value + delta[index] * scale * fraction));
      if (errorNorm(poseError(forwardRad(next), target)) < errorNorm(error) - 1e-8) {
        q = next;
        improved = true;
        break;
      }
    }
    if (!improved) return null;
  }
  return null;
}

function candidate(target: ReturnType<typeof forwardRad>, seed: JointVector, branchId: string): AnalyticIkCandidate | null {
  const jointsDeg = solveFromSeed(target, seed);
  return jointsDeg ? { jointsDeg, branchId } : null;
}

export function createRuka2IkSolver(): AnalyticIkSolver {
  const seeds: JointVector[] = [
    [0, -10, 10, 0, 0, 0],
    [0, -90, 90, 0, 0, 0],
    [90, -90, 90, 0, 0, 0],
    [-90, -90, 90, 0, 0, 0],
  ];
  return (targetPose) => {
    const target = targetAsThree(targetPose);
    return seeds.flatMap((seed, index) => {
      const result = candidate(target, seed, `seed_${index}`);
      return result ? [result] : [];
    });
  };
}

export function solveAnalyticIkPreview(
  targetPose: TcpPose,
  options: { currentJointsDeg: JointVector; solver: AnalyticIkSolver | null; maxJumpDeg?: number },
): AnalyticIkResult {
  if (!options.solver) {
    return { status: "solver_unavailable", selected: null, candidates: [], message: "IK solver is unavailable." };
  }
  const current = candidate(targetAsThree(targetPose), options.currentJointsDeg, "current_seed");
  const currentSelection = current
    ? selectBestSolution([current], options.currentJointsDeg, { maxJumpDeg: options.maxJumpDeg })
    : null;
  if (currentSelection?.selected) {
    return { status: "ok", selected: currentSelection.selected, candidates: [currentSelection.selected], message: "" };
  }
  const candidates = [...(current ? [current] : []), ...options.solver(targetPose)];
  if (candidates.length === 0) {
    return { status: "unreachable", selected: null, candidates, message: "Target pose is unreachable." };
  }
  const selection = selectBestSolution(candidates, options.currentJointsDeg, { maxJumpDeg: options.maxJumpDeg });
  if (!selection.selected) {
    return { status: "jump_rejected", selected: null, candidates, message: "No IK solution within joint limits and jump threshold." };
  }
  return { status: "ok", selected: selection.selected, candidates, message: "" };
}
