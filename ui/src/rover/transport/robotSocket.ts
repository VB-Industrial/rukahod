import type {
  GUIToRobotMessage,
  ProtocolSequence,
  ProtocolTimestampSec,
  RobotProtocolMessage,
} from "./protocol";

type RobotSocketCallbacks = {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: RobotProtocolMessage) => void;
};

export class RobotSocketClient {
  private socket: WebSocket | null = null;
  private suppressLifecycleCallbacks = false;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;
  private connectedAt = 0;
  private pendingPings = new Set<string>();
  private seq: ProtocolSequence = 1;

  constructor(
    private readonly url: string,
    private readonly callbacks: RobotSocketCallbacks,
  ) {}

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.suppressLifecycleCallbacks = false;
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.connectedAt = Date.now();
    this.lastPongAt = this.connectedAt;
    this.pendingPings.clear();
    this.clearHealthTimer();
    this.healthTimer = setInterval(() => {
      if (this.socket !== socket) return;
      const age = Date.now() - (socket.readyState === WebSocket.CONNECTING ? this.connectedAt : this.lastPongAt);
      if (age > (socket.readyState === WebSocket.CONNECTING ? 10000 : 12000)) {
        this.failConnection(socket);
      }
    }, 1000);
    socket.addEventListener("open", () => {
      if (this.socket === socket && !this.suppressLifecycleCallbacks) {
        this.callbacks.onOpen?.();
      }
    });
    socket.addEventListener("close", (event) => {
      if (this.socket === socket && !this.suppressLifecycleCallbacks) {
        this.clearHealthTimer();
        this.callbacks.onClose?.(event);
      }
    });
    socket.addEventListener("error", (event) => {
      if (this.socket === socket && !this.suppressLifecycleCallbacks) {
        this.failConnection(socket, event);
      }
    });
    socket.addEventListener("message", (event) => {
      if (this.socket !== socket || this.suppressLifecycleCallbacks) return;
      try {
        const parsed = JSON.parse(String(event.data)) as RobotProtocolMessage;
        if (parsed.type === "pong" && this.pendingPings.has(parsed.payload.heartbeat_id)) {
          this.lastPongAt = Date.now();
          this.pendingPings.clear();
        }
        this.callbacks.onMessage?.(parsed);
      } catch {
        // Ignore malformed messages in mock mode.
      }
    });
  }

  private clearHealthTimer() {
    if (this.healthTimer !== null) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  private failConnection(socket: WebSocket, event: Event = new Event("error")) {
    if (this.socket !== socket) return;
    this.clearHealthTimer();
    this.socket = null;
    this.pendingPings.clear();
    socket.close();
    if (!this.suppressLifecycleCallbacks) this.callbacks.onError?.(event);
  }

  disconnect() {
    this.clearHealthTimer();
    if (!this.socket) {
      return;
    }
    this.suppressLifecycleCallbacks = true;
    this.socket.close();
    this.socket = null;
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send<T extends GUIToRobotMessage["type"]>(
    type: T,
    payload: Extract<GUIToRobotMessage, { type: T }>["payload"],
  ) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message: GUIToRobotMessage = {
      type,
      seq: this.nextSeq(),
      ts: nowSec(),
      payload,
    } as GUIToRobotMessage;

    if (type === "ping") {
      const heartbeatId = (payload as { heartbeat_id: string }).heartbeat_id;
      this.pendingPings.add(heartbeatId);
    }
    try {
      this.socket.send(JSON.stringify(message));
    } catch {
      this.failConnection(this.socket);
      return false;
    }
    return true;
  }

  private nextSeq() {
    const current = this.seq;
    this.seq += 1;
    return current;
  }
}

function nowSec(): ProtocolTimestampSec {
  return Date.now() / 1000;
}
