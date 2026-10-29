import { Room, RoomEvent, Track } from "https://esm.sh/livekit-client@2.23.0?bundle";

class LiveKitVoice extends EventTarget {
  constructor() {
    super();
    this.room = null;
    this.roomCode = null;
    this.channel = null;
    this.canPublish = false;
    this.connecting = null;
    this.generation = 0;
    this.audioElements = new Set();
    this.closingRooms = new WeakSet();
    this.retryKey = null;
    this.retryAfter = 0;
    this.retryError = null;
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async connect(roomCode, channel = "public", force = false) {
    if (!roomCode || !channel) return this.disconnect();
    if (this.room && this.roomCode === roomCode && this.channel === channel) return this.room;
    if (this.connecting?.roomCode === roomCode && this.connecting?.channel === channel) return this.connecting.promise;
    const retryKey = `${roomCode}:${channel}`;
    if (!force && this.retryKey === retryKey && Date.now() < this.retryAfter) throw this.retryError || new Error("تعذر ربط الصوت مؤقتاً.");

    const generation = ++this.generation;
    await this.disconnect(false);
    this.emit("status", "connecting");
    const promise = this.open(roomCode, channel, generation);
    this.connecting = { roomCode, channel, promise };
    try {
      const room = await promise;
      this.retryKey = null;
      this.retryAfter = 0;
      this.retryError = null;
      return room;
    } catch (error) {
      this.retryKey = retryKey;
      this.retryAfter = Date.now() + 10000;
      this.retryError = error;
      this.emit("status", "error");
      throw error;
    } finally { if (this.connecting?.promise === promise) this.connecting = null; }
  }

  async open(roomCode, channel, generation) {
    const response = await fetch("/api/livekit/token", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, channel }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "تعذر دخول الغرفة الصوتية.");
    if (generation !== this.generation) return null;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.autoplay = true;
      element.dataset.qinaaVoice = "true";
      element.hidden = true;
      document.body.append(element);
      this.audioElements.add(element);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((element) => { this.audioElements.delete(element); element.remove(); });
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!room.canPlaybackAudio) this.emit("audio-blocked", true);
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => this.emit("active-speakers", speakers.map((speaker) => speaker.identity)));
    room.on(RoomEvent.Reconnecting, () => this.emit("status", "reconnecting"));
    room.on(RoomEvent.Reconnected, () => this.emit("status", "connected"));
    room.on(RoomEvent.Disconnected, () => {
      if (this.closingRooms.has(room)) return;
      if (this.room === room) {
        this.room = null;
        this.roomCode = null;
        this.channel = null;
        this.canPublish = false;
      }
      this.emit("status", "disconnected");
    });

    await room.connect(data.server_url, data.participant_token, { autoSubscribe: true });
    if (generation !== this.generation) { room.disconnect(); return null; }
    this.room = room;
    this.roomCode = roomCode;
    this.channel = channel;
    this.canPublish = Boolean(data.can_publish);
    this.emit("status", "connected");
    this.emit("channel", channel);
    return room;
  }

  async startAudio() {
    if (!this.room) return false;
    await this.room.startAudio();
    this.emit("audio-blocked", false);
    return true;
  }

  async setMicrophoneEnabled(enabled) {
    if (!this.room) throw new Error("الغرفة الصوتية ما زالت تتصل.");
    if (enabled && !this.canPublish) throw new Error("وضعك يسمح بالاستماع فقط.");
    await this.room.localParticipant.setMicrophoneEnabled(Boolean(enabled), {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    this.emit("microphone", Boolean(enabled));
    return Boolean(enabled);
  }

  async disconnect(invalidate = true) {
    if (invalidate) this.generation += 1;
    this.connecting = null;
    const room = this.room;
    this.room = null;
    this.roomCode = null;
    this.channel = null;
    this.canPublish = false;
    this.audioElements.forEach((element) => element.remove());
    this.audioElements.clear();
    if (room) {
      try { await room.localParticipant.setMicrophoneEnabled(false); } catch (_) { /* Already disconnected. */ }
      this.closingRooms.add(room);
      room.disconnect();
    }
    if (invalidate) {
      this.emit("microphone", false);
      this.emit("status", "disconnected");
    }
  }
}

export const liveKitVoice = new LiveKitVoice();
