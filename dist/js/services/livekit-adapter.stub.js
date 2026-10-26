/**
 * Integration seam for the production voice layer.
 * Intended responsibilities: token exchange, room join/leave, participant tracks,
 * push-to-talk permissions, active-speaker events, and reconnection callbacks.
 */
export class LiveKitAdapter {
  async connect(_roomToken) {
    throw new Error("LiveKit is not connected in the front-end prototype.");
  }

  async setMicrophoneEnabled(_enabled) {
    throw new Error("Voice is mocked in this build.");
  }

  async disconnect() {}
}
