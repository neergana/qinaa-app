export const initialPlayers = [
  { id: "me", name: "سامي", initial: "س", accent: "a1", host: true, alive: true, connected: true, role: "مافيا" },
  { id: "noor", name: "نور", initial: "ن", accent: "a2", alive: true, connected: true, role: "مافيا" },
  { id: "layan", name: "ليان", initial: "ل", accent: "a3", alive: true, connected: true, role: "طبيبة" },
  { id: "omar", name: "عمر", initial: "ع", accent: "a4", alive: true, connected: true, role: "محقق" },
  { id: "mariam", name: "مريم", initial: "م", accent: "a5", alive: true, connected: true, role: "مواطنة" },
  { id: "youssef", name: "يوسف", initial: "ي", accent: "a6", alive: true, connected: true, role: "مواطن" },
  { id: "salma", name: "سلمى", initial: "س", accent: "a2", alive: true, connected: true, role: "مواطنة" },
  { id: "ziad", name: "زياد", initial: "ز", accent: "a3", alive: true, connected: true, role: "مواطن" },
];

export const initialRooms = [
  { id: "majlis", name: "مجلس الحارة", code: "MAF-728", status: "نهار الحارة", phase: "day", players: 8, capacity: 20, spectators: 14, private: false },
  { id: "rabat", name: "سهرة الرباط", code: "MAF-314", status: "بانتظار اللاعبين", phase: "day", players: 5, capacity: 12, spectators: 3, private: false },
  { id: "ghosts", name: "نادي الأشباح", code: "MAF-991", status: "حلّ الليل", phase: "night", players: 12, capacity: 12, spectators: 21, private: false },
];

export const state = {
  route: "home",
  players: structuredClone(initialPlayers),
  rooms: structuredClone(initialRooms),
  activeRoomId: "majlis",
  account: null,
  spectator: false,
  spectators: [
    { id: "viewer-1", name: "زائر 21", guest: true },
    { id: "viewer-2", name: "ريم", guest: false },
    { id: "viewer-3", name: "مشاهد 08", guest: true },
  ],
  options: { cupid: false, witch: false, privateRoom: false },
  connected: true,
  botActive: false,
  currentTab: "arena",
  phase: "night",
  round: 1,
  phaseSeconds: 75,
  phaseRemaining: 75,
  selectedTarget: null,
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
  votes: { omar: 3, youssef: 2, mariam: 2 },
  revealVoters: false,
  messages: {
    mafia: [
      { id: 1, sender: "نور", initial: "ن", accent: "a2", body: "أقترح عمر، أسئلته كثيرة منذ البداية.", time: "الآن", mine: false },
      { id: 2, sender: "سامي", initial: "س", accent: "a1", body: "راقبي تصويت مريم أولاً، ثم نقرر.", time: "الآن", mine: true },
    ],
    dead: [
      { id: 1, sender: "عمر", initial: "ع", accent: "a4", body: "كنت قريباً جداً من كشفهما!", time: "الجولة الماضية", mine: false },
    ],
  },
  history: [
    { round: 0, title: "تصويت تجريبي سابق", result: "لم يُقصَ أحد بعد استمرار التعادل.", voters: ["سامي ← عمر", "نور ← مريم", "عمر ← مريم", "مريم ← عمر"], tie: true },
  ],
};

export function setPlayerName(name) {
  const player = state.players.find((item) => item.id === "me");
  player.name = name;
  player.initial = name.trim().charAt(0) || "س";
  localStorage.setItem("mafia-player-name", name);
}

export function saveAccount(profile) {
  state.account = {
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    birthDate: profile.birthDate,
  };
  localStorage.setItem("mafia-account-profile", JSON.stringify(state.account));
  setPlayerName(profile.displayName);
}

export function loadLocalState() {
  const name = localStorage.getItem("mafia-player-name");
  if (name) setPlayerName(name);
  try {
    const options = JSON.parse(localStorage.getItem("mafia-room-options") || "null");
    if (options) state.options = { ...state.options, ...options };
  } catch (_) {
    // Keep safe defaults when local browser data is malformed.
  }
  try {
    const account = JSON.parse(localStorage.getItem("mafia-account-profile") || "null");
    if (account?.displayName && account?.username && account?.email && account?.birthDate) {
      state.account = account;
      setPlayerName(account.displayName);
    }
  } catch (_) {
    // Keep the visitor signed out when local browser data is malformed.
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
  state.voteConfirmations = Math.max(0, state.players.filter((player) => player.alive).length - 1);
  state.revealVoters = false;
  state.myVote = null;
  if (isRevote) {
    const [first = "omar", second = "mariam"] = state.revoteCandidates;
    state.votes = { [first]: 4, [second]: 3 };
  } else {
    state.revoteCandidates = [];
    state.votes = { omar: 3, youssef: 2, mariam: 2 };
  }
  state.currentTab = "arena";
}
