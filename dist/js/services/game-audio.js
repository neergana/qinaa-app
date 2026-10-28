export const NARRATION_CUES = Object.freeze({
  welcome: "/assets/audio/game-welcome.mp3",
  rolesReady: "/assets/audio/game-roles-ready.mp3",
  nightStart: "/assets/audio/night-start-mix.mp3",
  shadowWake: "/assets/audio/night-shadow-wake.mp3",
  shadowSleep: "/assets/audio/night-shadow-sleep.mp3",
  rescuerWake: "/assets/audio/night-rescuer-wake.mp3",
  rescuerSleep: "/assets/audio/night-rescuer-sleep.mp3",
  sheikhWake: "/assets/audio/night-sheikh-wake.mp3",
  sheikhSleep: "/assets/audio/night-sheikh-sleep.mp3",
  witchWake: "/assets/audio/night-witch-wake.mp3",
  witchSleep: "/assets/audio/night-witch-sleep.mp3",
  matchmakerWake: "/assets/audio/night-matchmaker-wake.mp3",
  matchmakerSleep: "/assets/audio/night-matchmaker-sleep.mp3",
  daybreak: "/assets/audio/daybreak-all-wake.mp3",
  victimReveal: "/assets/audio/daybreak-victim-reveal.mp3",
});

const ROLE_CUES = Object.freeze({
  "أفراد الظل": { wake: "shadowWake", sleep: "shadowSleep" },
  "المُنقذ": { wake: "rescuerWake", sleep: "rescuerSleep" },
  "الشيخ": { wake: "sheikhWake", sleep: "sheikhSleep" },
  "الساحرة": { wake: "witchWake", sleep: "witchSleep" },
  "الخطّابة": { wake: "matchmakerWake", sleep: "matchmakerSleep" },
});

class GameAudio {
  constructor() {
    this.active = null;
    this.playId = 0;
  }

  stop() {
    this.playId += 1;
    if (!this.active) return;
    const audio = this.active;
    this.active = null;
    audio.dispatchEvent(new Event("qinaa-stop"));
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  play(cue, { volume = 1 } = {}) {
    const source = NARRATION_CUES[cue];
    if (!source) return Promise.resolve(false);

    this.stop();
    const playId = this.playId;
    const audio = new Audio(source);
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, volume));
    this.active = audio;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (played) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        audio.removeEventListener("qinaa-stop", onStop);
        if (this.active === audio) this.active = null;
        resolve(played);
      };
      const onEnded = () => finish(playId === this.playId);
      const onError = () => finish(false);
      const onStop = () => finish(false);
      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.addEventListener("qinaa-stop", onStop, { once: true });
      audio.play().catch(() => finish(false));
    });
  }

  async playSequence(cues) {
    for (const cue of cues) {
      const completed = await this.play(cue);
      if (!completed) return false;
    }
    return true;
  }

  playRoleWake(role) {
    return this.play(ROLE_CUES[role]?.wake);
  }

  playRoleSleep(role) {
    return this.play(ROLE_CUES[role]?.sleep);
  }
}

export const gameAudio = new GameAudio();
