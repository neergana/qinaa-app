class RoomChatClient extends EventTarget {
  constructor() {
    super();
    this.socket = null;
    this.room = null;
    this.profile = null;
    this.shouldReconnect = false;
    this.reconnectTimer = null;
  }

  connect(room, profile) {
    const normalizedRoom = String(room || "public-lobby").toLowerCase();
    if (this.socket?.readyState === WebSocket.OPEN && this.room === normalizedRoom && this.profile?.name === profile.name) return;
    this.disconnect(false);
    this.room = normalizedRoom;
    this.profile = profile;
    this.shouldReconnect = true;
    this.open();
  }

  open() {
    if (!this.shouldReconnect || !this.room) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ room: this.room });
    this.socket = new WebSocket(`${protocol}//${location.host}/api/chat/ws?${params}`);
    this.dispatchStatus("connecting");

    this.socket.addEventListener("open", () => this.dispatchStatus("connected"));
    this.socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "histories") this.dispatchEvent(new CustomEvent("histories", { detail: payload.histories || {} }));
        if (payload.type === "message") this.dispatchEvent(new CustomEvent("message", { detail: payload.message }));
        if (payload.type === "error") this.dispatchEvent(new CustomEvent("chat-error", { detail: payload.message }));
        if (payload.type === "game-sync") this.dispatchEvent(new CustomEvent("game-sync", { detail: payload }));
        if (payload.type === "round-ended") this.dispatchEvent(new CustomEvent("round-ended"));
      } catch (_) {
        this.dispatchEvent(new CustomEvent("chat-error", { detail: "وصلت رسالة غير صالحة من الخادم." }));
      }
    });
    this.socket.addEventListener("close", () => {
      this.dispatchStatus("disconnected");
      if (this.shouldReconnect) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => this.open(), 1600);
      }
    });
    this.socket.addEventListener("error", () => this.dispatchStatus("disconnected"));
  }

  send(body, channel = "public") {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: "message", body, channel }));
    return true;
  }

  disconnect(clearRoom = true) {
    this.shouldReconnect = false;
    window.clearTimeout(this.reconnectTimer);
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close(1000, "leaving-room");
    this.socket = null;
    if (clearRoom) this.room = null;
    this.dispatchStatus("disconnected");
  }

  dispatchStatus(status) {
    this.dispatchEvent(new CustomEvent("status", { detail: status }));
  }
}

export const roomChat = new RoomChatClient();
