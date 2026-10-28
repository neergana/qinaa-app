export const initialPlayers = [
  { id: "me", name: "سامي", initial: "س", accent: "a1", host: true, alive: true, connected: true, role: "أفراد الظل" },
  { id: "noor", name: "نور", initial: "ن", accent: "a2", alive: true, connected: true, role: "أفراد الظل" },
  { id: "layan", name: "ليان", initial: "ل", accent: "a3", alive: true, connected: true, role: "المُنقذ" },
  { id: "omar", name: "عمر", initial: "ع", accent: "a4", alive: true, connected: true, role: "الشيخ" },
  { id: "mariam", name: "مريم", initial: "م", accent: "a5", alive: true, connected: true, role: "الكشّاف" },
  { id: "youssef", name: "يوسف", initial: "ي", accent: "a6", alive: true, connected: true, role: "البريء" },
  { id: "salma", name: "سلمى", initial: "س", accent: "a2", alive: true, connected: true, role: "البريء" },
  { id: "ziad", name: "زياد", initial: "ز", accent: "a3", alive: true, connected: true, role: "البريء" },
];

export const initialRooms = [
  { id: "majlis", name: "مجلس قِناع", code: "QNA-728", status: "وقت النقاش", phase: "day", players: 8, capacity: 20, spectators: 14, private: false },
  { id: "rabat", name: "سهرة الرباط", code: "QNA-314", status: "بانتظار اللاعبين", phase: "day", players: 5, capacity: 12, spectators: 3, private: false },
  { id: "ghosts", name: "نادي الأشباح", code: "QNA-991", status: "حلّ الليل", phase: "night", players: 12, capacity: 12, spectators: 21, private: false },
];

export const state = {
  route: "home",
  players: [],
  rooms: [],
  activeRoomId: null,
  account: null,
  spectator: false,
  spectators: [],
  options: { cupid: false, witch: false, privateRoom: false },
  connected: true,
  botActive: false,
  currentTab: "arena",
  phase: "night",
  round: 1,
  phaseSeconds: 75,
  phaseRemaining: 75,
  selectedTarget: null,
  scoutTargets: [],
  scoutResult: null,
  nightChoiceConfirmed: false,
  nightConfirmations: 1,
  micOn: false,
  requestedToSpeak: false,
  speaker: null,
  speakerIndex: 0,
  speakerRemaining: 0,
  speechQueue: [],
  discussionRemaining: 240,
  defenseCandidates: [],
  defenseIndex: 0,
  defenseRemaining: 90,
  defenseStarted: false,
  revoteCandidates: [],
  voteRemaining: 60,
  voteRound: 1,
  voteClosed: false,
  voteConfirmed: false,
  voteConfirmations: 7,
  myVote: null,
  votes: {},
  voteVoters: {},
  revealVoters: false,
  micPermission: "prompt",
  voiceStatus: "disconnected",
  chatStatus: "disconnected",
  messages: {
    public: [],
    mafia: [],
    dead: [],
  },
  history: [],
};

export function setPlayerName(name) {
  const player = state.players.find((item) => item.id === "me");
  if (!player) return;
  player.name = name;
  player.initial = name.trim().charAt(0) || "س";
}

export function loadLocalState() {
  try {
    const options = JSON.parse(localStorage.getItem("mafia-room-options") || "null");
    if (options) state.options = { ...state.options, ...options };
  } catch (_) {
    // Keep safe defaults when local browser data is malformed.
  }
}

export function saveOptions() {
  localStorage.setItem("mafia-room-options", JSON.stringify(state.options));
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function resetForNight() {
  state.phase = "night";
  state.phaseSeconds = 75;
  state.phaseRemaining = 75;
  state.currentTab = "arena";
  state.selectedTarget = null;
  state.scoutTargets = [];
  state.scoutResult = null;
  state.nightChoiceConfirmed = false;
  state.nightConfirmations = 1;
  state.micOn = false;
}

export function startDay() {
  state.phase = "day";
  state.phaseSeconds = 240;
  state.phaseRemaining = 240;
  state.discussionRemaining = 240;
  state.currentTab = "arena";
  state.speaker = null;
  state.speechQueue = [];
  state.speakerIndex = 0;
  state.speakerRemaining = 0;
  state.requestedToSpeak = false;
  state.micOn = false;
  state.defenseCandidates = [];
  state.defenseIndex = 0;
  state.defenseRemaining = 90;
  state.defenseStarted = false;
}

export function startVote(isRevote = false) {
  state.phase = "vote";
  state.phaseSeconds = 60;
  state.phaseRemaining = 60;
  state.voteRemaining = 60;
  state.voteClosed = false;
  state.voteConfirmed = false;
  state.voteConfirmations = 0;
  state.revealVoters = false;
  state.myVote = null;
  state.voteVoters = {};
  if (!isRevote) state.revoteCandidates = [];
  state.votes = {};
  state.currentTab = "arena";
}
