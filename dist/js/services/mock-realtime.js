/**
 * Local-only transport used by the prototype.
 * Replace this adapter with WebSocket events and a LiveKit room without changing UI state calls.
 */
class MockRealtimeAdapter extends EventTarget {
  constructor() {
    super();
    this.kind = "mock";
    this.voiceKind = "interface-only";
  }

  connect() {
    this.dispatchEvent(new CustomEvent("connection", { detail: { connected: true } }));
  }

  disconnect() {
    this.dispatchEvent(new CustomEvent("connection", { detail: { connected: false, takeover: "robot" } }));
  }

  send(channel, payload) {
    this.dispatchEvent(new CustomEvent("message", { detail: { channel, payload } }));
  }

  simulateReply(channel) {
    window.setTimeout(() => {
      const body = channel === "mafia" ? "موافق، سأصوّت معه حتى لا نشكّل ثنائياً واضحاً." : "مرحباً بك في مقاعد المتفرجين.";
      this.dispatchEvent(new CustomEvent("remote-message", {
        detail: { channel, payload: { id: Date.now(), sender: "نور", initial: "ن", accent: "a2", body, time: "الآن", mine: false } },
      }));
    }, 850);
  }
}

export const realtime = new MockRealtimeAdapter();
