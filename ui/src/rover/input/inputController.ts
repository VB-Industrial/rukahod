import {
  activateEstop,
  commandAngular,
  commandLinear,
  inputSource,
  safetyState,
  setCommand,
  setInputSource,
  speedPreset,
  stopCommand,
  stopModeActive,
} from "../store/appState";
import {
  applySpeedPresetFromUi,
  cycleSpeedPresetFromUi,
  sendCmdVelToRobot,
  sendEstopToRobot,
  toggleHeadlightsFromUi,
  toggleStopModeFromUi,
} from "../transport/robotConnectionStore";

const pressedKeys = new Set<string>();
let animationFrame = 0;
let lastButtons: boolean[] = [];
let lastSpeedBucket = -1;
let lastGamepadId = "";
let joystickCalibration: JoystickCalibration | null = null;
let activeGamepadIndex: number | null = null;

const JOYSTICK_DEADZONE = 0.05;
const JOYSTICK_CENTER_CAPTURE_THRESHOLD = 0.2;
const JOYSTICK_STEERING_AXIS = 0;
const JOYSTICK_SPEED_AXIS = 1;
const JOYSTICK_SELECTOR_AXIS = 2;
const JOYSTICK_STOP_BUTTON = 0;
const JOYSTICK_HEADLIGHTS_BUTTON = 2;
const PREFERRED_GAMEPAD_IDS = ["pxn", "2113", "litestar"];

// TODO(r): confirm how the physical joystick is exposed on the target machine.
// If it is visible via browser Gamepad API, keep the implementation here.
// If it is only available as /dev/input/event* via evdev, add a local bridge
// instead of forcing the browser path.

export function initializeInputController(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }
    pressedKeys.add(event.code);
    setInputSource("keyboard_mouse");

    if (event.code === "Space") {
      event.preventDefault();
      toggleStopModeFromUi();
      return;
    }

    if (event.code === "KeyF") {
      event.preventDefault();
      toggleHeadlightsFromUi();
      return;
    }

    if (event.code === "KeyQ") {
      event.preventDefault();
      cycleSpeedPresetFromUi(-1);
      return;
    }

    if (event.code === "KeyE") {
      event.preventDefault();
      cycleSpeedPresetFromUi(1);
      return;
    }

    if (event.code === "KeyP") {
      applySpeedPresetFromUi("P");
      return;
    }

    if (event.code === "Digit1") {
      applySpeedPresetFromUi("1");
      return;
    }

    if (event.code === "Digit2") {
      applySpeedPresetFromUi("2");
      return;
    }

    if (event.code === "Digit3") {
      applySpeedPresetFromUi("3");
      return;
    }

    if (event.code === "KeyX") {
      activateEstop();
      void sendEstopToRobot();
      return;
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    pressedKeys.delete(event.code);
  };

  const onWindowBlur = () => {
    pressedKeys.clear();
    if (hasActiveCommand()) {
      stopCommand();
      void sendCmdVelToRobot();
      return;
    }
    stopCommand();
  };

  const onGamepadConnected = () => {
    activeGamepadIndex = pickPreferredGamepadIndex();
    lastButtons = [];
    lastSpeedBucket = -1;
    lastGamepadId = "";
    joystickCalibration = null;
  };

  const onGamepadDisconnected = () => {
    activeGamepadIndex = pickPreferredGamepadIndex();
    lastButtons = [];
    lastSpeedBucket = -1;
    lastGamepadId = "";
    joystickCalibration = null;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);

  const tick = () => {
    animationFrame = window.requestAnimationFrame(tick);
    updateFromKeyboard();
    updateFromGamepad();
  };
  animationFrame = window.requestAnimationFrame(tick);

  return () => {
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("gamepadconnected", onGamepadConnected);
    window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
  };
}

function updateFromKeyboard(): void {
  if (!hasKeyboardIntent()) {
    if (inputSource.value === "keyboard_mouse" && Math.abs(commandLinear.value) < 0.001 && Math.abs(commandAngular.value) < 0.001) {
      return;
    }
    if (inputSource.value === "keyboard_mouse" && !pressedKeys.has("ShiftLeft") && !pressedKeys.has("ShiftRight")) {
      setCommand(0, 0, false);
      void sendCmdVelToRobot();
    }
    return;
  }

  if (safetyState.value.estopActive) {
    return;
  }

  if (isMotionBlocked()) {
    if (hasActiveCommand()) {
      setCommand(0, 0, false);
      void sendCmdVelToRobot();
      return;
    }
    setCommand(0, 0, false);
    return;
  }

  const forward = pressedKeys.has("KeyW") ? 1 : 0;
  const backward = pressedKeys.has("KeyS") ? 1 : 0;
  const left = pressedKeys.has("KeyA") ? 1 : 0;
  const right = pressedKeys.has("KeyD") ? 1 : 0;
  const linear = forward - backward;
  const angular = left - right;
  const turbo = pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight");
  setCommand(linear, angular, turbo);
  void sendCmdVelToRobot();
}

function updateFromGamepad(): void {
  const gamepad = resolveActiveGamepad();
  if (!gamepad) {
    if (inputSource.value === "joystick" && hasActiveCommand()) {
      setCommand(0, 0, false);
      void sendCmdVelToRobot();
    }
    lastButtons = [];
    lastSpeedBucket = -1;
    lastGamepadId = "";
    joystickCalibration = null;
    return;
  }

  if (gamepad.id !== lastGamepadId || joystickCalibration === null) {
    joystickCalibration = createJoystickCalibration(gamepad);
    lastGamepadId = gamepad.id;
    lastSpeedBucket = -1;
  }

  const angularAxis = -normaliseJoystickAxis(gamepad.axes[JOYSTICK_STEERING_AXIS] ?? 0, joystickCalibration.steeringCenter);
  const linearAxis = -normaliseJoystickAxis(gamepad.axes[JOYSTICK_SPEED_AXIS] ?? 0, joystickCalibration.speedCenter);
  const selectorAxis = gamepad.axes[JOYSTICK_SELECTOR_AXIS] ?? 0;
  const hasIntent = Math.abs(linearAxis) > 0.001 || Math.abs(angularAxis) > 0.001;
  if (!hasIntent) {
    if (inputSource.value === "joystick") {
      setCommand(0, 0, false);
      void sendCmdVelToRobot();
    }
  } else if (!isMotionBlocked()) {
    setInputSource("joystick");
    setCommand(applyDeadzone(linearAxis), applyDeadzone(angularAxis), Boolean(gamepad.buttons[5]?.pressed));
    void sendCmdVelToRobot();
  } else if (inputSource.value === "joystick") {
    setCommand(0, 0, false);
    void sendCmdVelToRobot();
  }

  const speedBucket = bucketiseGearSelector(selectorAxis);
  if (speedBucket !== -1 && speedBucket !== lastSpeedBucket) {
    applySpeedPresetFromUi(presetFromBucket(speedBucket));
  }
  lastSpeedBucket = speedBucket;

  if (isButtonPressed(gamepad, JOYSTICK_STOP_BUTTON)) {
    toggleStopModeFromUi();
  }
  if (isButtonPressed(gamepad, JOYSTICK_HEADLIGHTS_BUTTON)) {
    toggleHeadlightsFromUi();
  }

  lastButtons = gamepad.buttons.map((button) => button.pressed);
}

function applyDeadzone(value: number): number {
  if (Math.abs(value) < 0.14) {
    return 0;
  }
  return value;
}

function hasKeyboardIntent(): boolean {
  return (
    pressedKeys.has("KeyW") ||
    pressedKeys.has("KeyA") ||
    pressedKeys.has("KeyS") ||
    pressedKeys.has("KeyD") ||
    pressedKeys.has("ShiftLeft") ||
    pressedKeys.has("ShiftRight")
  );
}

function isMotionBlocked(): boolean {
  return safetyState.value.estopActive || stopModeActive.value || speedPreset.value === "P";
}

function isButtonPressed(gamepad: Gamepad, index: number): boolean {
  const pressed = Boolean(gamepad.buttons[index]?.pressed);
  return pressed && !lastButtons[index];
}

function presetFromBucket(bucket: number): "P" | "1" | "2" | "3" {
  switch (bucket) {
    case 0:
      return "P";
    case 1:
      return "1";
    case 2:
      return "2";
    case 3:
    default:
      return "3";
  }
}

function hasActiveCommand(): boolean {
  return Math.abs(commandLinear.value) > 0.001 || Math.abs(commandAngular.value) > 0.001;
}

type JoystickCalibration = {
  steeringCenter: number;
  speedCenter: number;
};

function createJoystickCalibration(gamepad: Gamepad): JoystickCalibration {
  const steeringRaw = clampAxis(gamepad.axes[JOYSTICK_STEERING_AXIS] ?? 0);
  const speedRaw = clampAxis(gamepad.axes[JOYSTICK_SPEED_AXIS] ?? 0);

  return {
    steeringCenter: Math.abs(steeringRaw) <= JOYSTICK_CENTER_CAPTURE_THRESHOLD ? steeringRaw : 0,
    speedCenter: Math.abs(speedRaw) <= JOYSTICK_CENTER_CAPTURE_THRESHOLD ? speedRaw : 0,
  };
}

function normaliseJoystickAxis(raw: number, center: number): number {
  const value = clampAxis(raw);
  const diff = value - center;
  const rangeNeg = center + 1;
  const rangePos = 1 - center;
  const normalised = diff < 0 ? diff / Math.max(rangeNeg, 0.001) : diff / Math.max(rangePos, 0.001);

  if (Math.abs(normalised) < JOYSTICK_DEADZONE) {
    return 0;
  }

  const sign = normalised > 0 ? 1 : -1;
  return sign * (Math.abs(normalised) - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
}

function bucketiseGearSelector(value: number): number {
  if (!Number.isFinite(value)) {
    return -1;
  }

  const clamped = clampAxis(value);
  const presets = 4;
  const inverted = (1 - clamped) / 2;
  const bucket = Math.floor(inverted * presets);
  return Math.max(0, Math.min(presets - 1, bucket));
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function resolveActiveGamepad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];

  if (activeGamepadIndex !== null) {
    const active = pads[activeGamepadIndex];
    if (active && active.connected) {
      return active;
    }
  }

  activeGamepadIndex = pickPreferredGamepadIndex();
  if (activeGamepadIndex === null) {
    return null;
  }

  const selected = pads[activeGamepadIndex];
  return selected && selected.connected ? selected : null;
}

function pickPreferredGamepadIndex(): number | null {
  const pads = navigator.getGamepads?.() ?? [];
  const connected = pads.filter((pad): pad is Gamepad => Boolean(pad && pad.connected));
  if (connected.length === 0) {
    return null;
  }

  const preferred = connected.find((pad) => {
    const id = pad.id.toLowerCase();
    return PREFERRED_GAMEPAD_IDS.some((marker) => id.includes(marker));
  });

  return (preferred ?? connected[0]).index;
}
