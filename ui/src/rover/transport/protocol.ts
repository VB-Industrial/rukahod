export const ROBOT_PROTOCOL_VERSION = 1 as const;

export const ROVER_GROUP_NAMES = ["rover"] as const;
export type RobotGroupName = (typeof ROVER_GROUP_NAMES)[number];
export type DriveMode = "manual" | "crab" | "precision" | "docking";
export type InputSource = "keyboard_mouse" | "joystick" | "mock_autonomy";

export type ProtocolTimestampSec = number;
export type ProtocolSequence = number;
export type CommandId = string;

export type MessageEnvelope<TType extends string, TPayload> = {
  type: TType;
  seq: ProtocolSequence;
  ts: ProtocolTimestampSec;
  payload: TPayload;
};

export type HelloMessage = MessageEnvelope<
  "hello",
  {
    protocol_version: typeof ROBOT_PROTOCOL_VERSION;
    client_name: string;
    requested_groups: RobotGroupName[];
  }
>;

export type HelloAckMessage = MessageEnvelope<
  "hello_ack",
  {
    protocol_version: typeof ROBOT_PROTOCOL_VERSION;
    server_name: string;
    groups: RobotGroupName[];
  }
>;

export type PingMessage = MessageEnvelope<
  "ping",
  {
    heartbeat_id: string;
  }
>;

export type PongMessage = MessageEnvelope<
  "pong",
  {
    heartbeat_id: string;
  }
>;

export type CmdVelMessage = MessageEnvelope<
  "cmd_vel",
  {
    command_id: CommandId;
    frame_id: string;
    linear_m_s: number;
    angular_rad_s: number;
    source: InputSource;
    turbo: boolean;
  }
>;

export type StopMessage = MessageEnvelope<
  "stop",
  {
    command_id: CommandId;
    group_name: RobotGroupName;
  }
>;

export type EstopMessage = MessageEnvelope<
  "estop",
  {
    command_id: CommandId;
  }
>;

export type ResetEstopMessage = MessageEnvelope<
  "reset_estop",
  {
    command_id: CommandId;
  }
>;

export type SetDriveModeMessage = MessageEnvelope<
  "set_drive_mode",
  {
    command_id: CommandId;
    mode: DriveMode;
  }
>;

export type SetHeadlightsMessage = MessageEnvelope<
  "set_headlights",
  {
    command_id: CommandId;
    enabled: boolean;
  }
>;

export type OdometryMessage = MessageEnvelope<
  "odometry",
  {
    linear_m_s: number;
    angular_rad_s: number;
    heading_deg: number;
    odometer_km: number;
    x_m?: number;
    y_m?: number;
    roll_deg?: number;
    pitch_deg?: number;
  }
>;

export type BatteryStateMessage = MessageEnvelope<
  "battery_state",
  {
    percent: number;
    voltage_v?: number;
    current_a?: number;
  }
>;

export type RoverStateMessage = MessageEnvelope<
  "rover_state",
  {
    mode: DriveMode;
    ready: boolean;
    control_active: boolean;
    headlights_enabled: boolean;
    input_source: InputSource;
    signal_quality: "offline" | "weak" | "stable" | "strong";
    command_age_ms?: number;
  }
>;

export type FaultStateMessage = MessageEnvelope<
  "fault_state",
  {
    active: boolean;
    severity: "info" | "warning" | "error" | "fatal";
    code: string;
    message: string;
  }
>;

export type GUIToRobotMessage =
  | HelloMessage
  | PingMessage
  | CmdVelMessage
  | StopMessage
  | EstopMessage
  | ResetEstopMessage
  | SetDriveModeMessage
  | SetHeadlightsMessage;

export type RobotToGUIMessage =
  | HelloAckMessage
  | PongMessage
  | OdometryMessage
  | BatteryStateMessage
  | RoverStateMessage
  | FaultStateMessage;

export type RobotProtocolMessage = GUIToRobotMessage | RobotToGUIMessage;
