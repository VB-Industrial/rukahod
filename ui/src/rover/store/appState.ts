import { computed, signal } from "@preact/signals";

import type { DriveMode, InputSource } from "../transport/protocol";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
export type LinkQuality = "offline" | "weak" | "stable" | "strong";
export type SpeedPreset = "P" | "1" | "2" | "3";

export type TelemetryState = {
  speedMps: number;
  turnRateRadS: number;
  headingDeg: number;
  xMeters: number;
  yMeters: number;
  rollDeg: number;
  pitchDeg: number;
  batteryPercent: number;
  batteryVoltage: number;
  odometerKm: number;
  commandAgeMs: number;
};

export type SafetyState = {
  roverReady: boolean;
  controlActive: boolean;
  noFaults: boolean;
  estopActive: boolean;
};

export const driveMode = signal<DriveMode>("manual");
export const speedPreset = signal<SpeedPreset>("P");
export const inputSource = signal<InputSource>("keyboard_mouse");
export const connectionState = signal<ConnectionState>("disconnected");
export const linkQuality = signal<LinkQuality>("offline");
export const wsConnected = computed(() => connectionState.value === "connected");
export const commandLinear = signal(0);
export const commandAngular = signal(0);
export const commandTurbo = signal(false);
export const stopModeActive = signal(false);
export const headlightsEnabled = signal(false);
export const mockEnabled = signal(true);
export const telemetry = signal<TelemetryState>({
  speedMps: 0,
  turnRateRadS: 0,
  headingDeg: 0,
  xMeters: 2.8,
  yMeters: -1.4,
  rollDeg: 2.5,
  pitchDeg: -1.2,
  batteryPercent: 86,
  batteryVoltage: 25.4,
  odometerKm: 16.9,
  commandAgeMs: 0,
});
export const safetyState = signal<SafetyState>({
  roverReady: true,
  controlActive: true,
  noFaults: true,
  estopActive: false,
});

export const speedKph = computed(() => telemetry.value.speedMps * 3.6);
export const batteryLabel = computed(() => `${Math.round(telemetry.value.batteryPercent)}%`);
export const modeLabel = computed(() => translateDriveMode(driveMode.value));
export const sourceLabel = computed(() => translateInputSource(inputSource.value));
export const speedPresetLabel = computed(() => translateSpeedPreset(speedPreset.value));
export const speedPresetMaxMps = computed(() => {
  switch (speedPreset.value) {
    case "P":
      return 0;
    case "1":
      return 0.1;
    case "2":
      return 0.5;
    case "3":
    default:
      return 1.0;
  }
});
export const speedPresetMaxAngularRadS = computed(() => {
  switch (speedPreset.value) {
    case "P":
      return 0;
    case "1":
      return 0.1;
    case "2":
      return 0.5;
    case "3":
    default:
      return 1;
  }
});
export const maxLinearSpeed = computed(() => {
  switch (driveMode.value) {
    case "precision":
      return 0.6;
    case "docking":
      return 0.35;
    case "crab":
      return 1.4;
    case "manual":
    default:
      return 1.8;
  }
});
export const maxAngularSpeed = computed(() => {
  switch (driveMode.value) {
    case "precision":
      return 0.8;
    case "docking":
      return 0.55;
    case "crab":
      return 1.1;
    case "manual":
    default:
      return 1.5;
  }
});
export const motionBlocked = computed(
  () => speedPreset.value === "P" || stopModeActive.value || safetyState.value.estopActive,
);
export const commandedLinearMps = computed(() => (motionBlocked.value ? 0 : commandLinear.value * speedPresetMaxMps.value));
export const commandedAngularRadS = computed(() =>
  motionBlocked.value ? 0 : commandAngular.value * Math.min(maxAngularSpeed.value, speedPresetMaxAngularRadS.value),
);

export function setSpeedPreset(preset: SpeedPreset): void {
  speedPreset.value = preset;
  if (preset === "P") {
    stopCommand();
  }
}

export function cycleSpeedPreset(step: 1 | -1): SpeedPreset {
  const presets: SpeedPreset[] = ["P", "1", "2", "3"];
  const currentIndex = presets.indexOf(speedPreset.value);
  const nextIndex = clamp(currentIndex + step, 0, presets.length - 1);
  const nextPreset = presets[nextIndex];
  setSpeedPreset(nextPreset);
  return nextPreset;
}

export function setDriveMode(mode: DriveMode): void {
  driveMode.value = mode;
}

export function cycleDriveMode(step: 1 | -1): void {
  const modes: DriveMode[] = ["manual", "crab", "precision", "docking"];
  const currentIndex = modes.indexOf(driveMode.value);
  const nextIndex = (currentIndex + step + modes.length) % modes.length;
  driveMode.value = modes[nextIndex];
}

export function setInputSource(source: InputSource): void {
  inputSource.value = source;
}

export function setCommand(linear: number, angular: number, turbo: boolean): void {
  if (motionBlocked.value) {
    stopCommand();
    return;
  }
  commandLinear.value = clamp(linear, -1, 1);
  commandAngular.value = clamp(angular, -1, 1);
  commandTurbo.value = turbo;
}

export function stopCommand(): void {
  commandLinear.value = 0;
  commandAngular.value = 0;
  commandTurbo.value = false;
}

export function setStopMode(active: boolean): void {
  stopModeActive.value = active;
  if (active) {
    stopCommand();
  }
}

export function toggleStopMode(): boolean {
  const next = !stopModeActive.value;
  setStopMode(next);
  return next;
}

export function setHeadlightsEnabled(enabled: boolean): void {
  headlightsEnabled.value = enabled;
}

export function toggleHeadlightsEnabled(): boolean {
  const next = !headlightsEnabled.value;
  headlightsEnabled.value = next;
  return next;
}

export function setConnectionState(nextState: ConnectionState): void {
  connectionState.value = nextState;
  if (nextState !== "connected") {
    linkQuality.value = nextState === "connecting" ? "weak" : "offline";
  }
}

export function setLinkQuality(nextQuality: LinkQuality): void {
  linkQuality.value = nextQuality;
}

export function setBattery(percent: number, voltage = telemetry.value.batteryVoltage): void {
  telemetry.value = {
    ...telemetry.value,
    batteryPercent: clamp(percent, 0, 100),
    batteryVoltage: voltage,
  };
}

export function applyOdometry(
  speedMps: number,
  turnRateRadS: number,
  headingDeg: number,
  odometerKm?: number,
  xMeters?: number,
  yMeters?: number,
  rollDeg?: number,
  pitchDeg?: number,
): void {
  telemetry.value = {
    ...telemetry.value,
    speedMps,
    turnRateRadS,
    headingDeg: normalizeHeading(headingDeg),
    xMeters: xMeters ?? telemetry.value.xMeters,
    yMeters: yMeters ?? telemetry.value.yMeters,
    rollDeg: rollDeg ?? telemetry.value.rollDeg,
    pitchDeg: pitchDeg ?? telemetry.value.pitchDeg,
    odometerKm: odometerKm ?? telemetry.value.odometerKm,
    commandAgeMs: 0,
  };
}

export function setRoverReady(ready: boolean): void {
  safetyState.value = {
    ...safetyState.value,
    roverReady: ready,
  };
}

export function setControlActive(active: boolean): void {
  safetyState.value = {
    ...safetyState.value,
    controlActive: active,
  };
}

export function setFault(active: boolean): void {
  safetyState.value = {
    ...safetyState.value,
    noFaults: !active,
  };
}

export function activateEstop(): void {
  safetyState.value = {
    ...safetyState.value,
    estopActive: true,
    controlActive: false,
  };
  stopCommand();
}

export function resetEstop(): void {
  safetyState.value = {
    ...safetyState.value,
    estopActive: false,
    controlActive: true,
  };
}

export function setMockEnabled(enabled: boolean): void {
  mockEnabled.value = enabled;
}

export function tickMock(dtSec: number): void {
  if (!mockEnabled.value || connectionState.value === "connected") {
    return;
  }

  if (!safetyState.value.controlActive || motionBlocked.value) {
    telemetry.value = {
      ...telemetry.value,
      speedMps: telemetry.value.speedMps * Math.max(0, 1 - dtSec * 2.8),
      turnRateRadS: telemetry.value.turnRateRadS * Math.max(0, 1 - dtSec * 3.2),
      commandAgeMs: telemetry.value.commandAgeMs + dtSec * 1000,
    };
    return;
  }

  const speedTarget = commandedLinearMps.value;
  const turnTarget = commandedAngularRadS.value;
  const nextSpeed = approach(telemetry.value.speedMps, speedTarget, dtSec * 1.9);
  const nextTurn = approach(telemetry.value.turnRateRadS, turnTarget, dtSec * 3.8);
  const nextHeading = normalizeHeading(telemetry.value.headingDeg + radToDeg(nextTurn) * dtSec);
  const nextRoll = Math.sin(Date.now() / 900) * 7 + nextTurn * 9;
  const nextPitch = Math.sin(Date.now() / 1300) * 4 + nextSpeed * 3.5;
  const distanceKm = Math.abs(nextSpeed) * dtSec / 1000;
  const headingRad = (nextHeading * Math.PI) / 180;
  const batteryDrain = Math.abs(nextSpeed) * dtSec * 0.018 + (commandTurbo.value ? dtSec * 0.008 : 0);

  telemetry.value = {
    ...telemetry.value,
    speedMps: nextSpeed,
    turnRateRadS: nextTurn,
    headingDeg: nextHeading,
    xMeters: telemetry.value.xMeters + Math.sin(headingRad) * nextSpeed * dtSec,
    yMeters: telemetry.value.yMeters + Math.cos(headingRad) * nextSpeed * dtSec,
    rollDeg: clamp(nextRoll, -25, 25),
    pitchDeg: clamp(nextPitch, -20, 20),
    odometerKm: telemetry.value.odometerKm + distanceKm,
    batteryPercent: clamp(telemetry.value.batteryPercent - batteryDrain, 0, 100),
    batteryVoltage: 22 + telemetry.value.batteryPercent * 0.04,
    commandAgeMs: 0,
  };
}

export function ageTelemetry(dtSec: number): void {
  telemetry.value = {
    ...telemetry.value,
    commandAgeMs: telemetry.value.commandAgeMs + dtSec * 1000,
  };
}

function translateDriveMode(mode: DriveMode): string {
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

function translateInputSource(source: InputSource): string {
  switch (source) {
    case "keyboard_mouse":
      return "Клавиатура + мышь";
    case "joystick":
      return "Джойстик";
    case "mock_autonomy":
      return "Mock backend";
    default:
      return source;
  }
}

function translateSpeedPreset(preset: SpeedPreset): string {
  switch (preset) {
    case "P":
      return "Парковка";
    case "1":
      return "До 0.1 м/с";
    case "2":
      return "До 0.5 м/с";
    case "3":
      return "Максимум";
    default:
      return preset;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHeading(value: number): number {
  let next = value % 360;
  if (next < 0) {
    next += 360;
  }
  return next;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function approach(current: number, target: number, delta: number): number {
  if (current < target) {
    return Math.min(current + delta, target);
  }
  return Math.max(current - delta, target);
}
