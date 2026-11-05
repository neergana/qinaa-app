import {
  state,
  loadLocalState,
  saveOptions,
  formatTime,
  resetForNight,
  startDay,
  startVote,
} from "./state.js?v=44";
import { roomChat } from "./services/room-chat.js?v=40";
import { liveKitVoice } from "./services/livekit-voice.js?v=21";
import { gameAudio } from "./services/game-audio.js?v=44";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const gameContent = $("#gameContent");
let gameTicker = null;
let toastTimer = null;
let pendingAccountAction = null;
let roleRevealTimer = null;
let roleRevealRemaining = 30;
let currentAuthMode = "login";
let lobbyPoller = null;
let voiceErrorKey = "";
let nightAudioTransition = false;
let narratedNightRound = null;
let scheduledBotVoteKey = "";
let selectedProfileAvatar = "mask-01";
let gameRenderDeferred = false;
const chatDrafts = { public: "", mafia: "", dead: "" };
const MAFIA_ROLE = "المافيا";
const WOLF_ROLE = "الذئب";
const LEGACY_ROLE_NAMES = new Map([
  ["عضو المافيا", MAFIA_ROLE], ["أفراد الظل", MAFIA_ROLE], ["المُنقذ", "الطبيب"], ["البريء", "المواطن الصالح"],
]);

function isMafiaRole(role) {
  return normalizedRole(role) === MAFIA_ROLE;
}

function isWolfRole(role) {
  return normalizedRole(role) === WOLF_ROLE;
}

function isPredatorRole(role) {
  return isMafiaRole(role) || isWolfRole(role);
}

function normalizedRole(role) {
  return LEGACY_ROLE_NAMES.get(role) || role;
}

const gameDefaults = {
  mafia: { gameType: "mafia", slug: "mafia", name: "المافيا", eyebrow: "لعبة الأدوار والاستنتاج", shortDescription: "اكشف أعضاء المافيا عبر النقاش والأدوار السرية قبل أن يسيطروا على الجولة." },
  wolf: { gameType: "wolf", slug: "loup-garou", name: "ذئاب القرية", eyebrow: "القرية تنام… والذئاب تستيقظ", shortDescription: "احمِ القرية، اكشف الذئاب واستعمل قدراتك السرية قبل أن يبتلع الليل الجميع." },
  imposter: { gameType: "imposter", slug: "aldakhil", name: "الدخيل", eyebrow: "كلمة واحدة وشكوك كثيرة", shortDescription: "يعرف الجميع الكلمة إلا الدخيل. اسألوا بعضكم واكشفوه قبل أن يخمّن السر." },
  bluff: { gameType: "bluff", slug: "bluff-card", name: "بطاقة الخداع", eyebrow: "تُصدّق الادعاء… أم تكشف الكذبة؟", shortDescription: "مرّر البطاقة مقلوبة وادّعِ ما تشاء. اكشف كذب خصومك، وتجنّب تراكم البطاقات أمامك." },
};

const icon = (name) => {
  const icons = {
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    vote: '<svg viewBox="0 0 24 24"><path d="M12 3v18M5 8h14M7 8l-3 6h6L7 8Zm10 0-3 6h6l-3-6Z"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/></svg>',
    micOff: '<svg viewBox="0 0 24 24"><path d="M9 9v2a3 3 0 005 2.6M15 9V6a3 3 0 00-5.6-1.5M5 11a7 7 0 0011.9 5M19 11a7 7 0 01-.7 3M12 18v3M9 21h6M3 3l18 18"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    skull: '<svg viewBox="0 0 24 24"><path d="M8 19v2M16 19v2M9 15h6M9 11h.01M15 11h.01"/><path d="M12 2a8 8 0 00-8 8c0 3 1.5 5.5 4 7h8c2.5-1.5 4-4 4-7a8 8 0 00-8-8Z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4v8Z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8ZM22 21v-2a4 4 0 00-3-3.9"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  };
  return icons[name] || "";
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const avatarPalettes = [
  ["#8f3fc4", "#e9b94f"], ["#ff526d", "#5ce0bd"], ["#3b8bff", "#e9b94f"], ["#b76cff", "#ff8d68"], ["#2fb998", "#e9f0ff"],
  ["#f5a623", "#4d2f74"], ["#ff6b9a", "#291b45"], ["#50a7ff", "#101c42"], ["#7ed957", "#342053"], ["#e45cff", "#ffe174"],
];

function presetAvatarSvg(value = "mask-01") {
  const index = Math.max(0, Math.min(9, Number(value.split("-")[1] || 1) - 1));
  const [first, second] = avatarPalettes[index];
  const eye = index % 2 ? "M18 24h5M37 24h5" : "M18 24h4M38 24h4";
  return `<svg viewBox="0 0 60 60" aria-hidden="true"><defs><linearGradient id="g${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs><circle cx="30" cy="30" r="29" fill="url(#g${index})"/><path d="M12 19c6 2 11-1 18-8 7 7 12 10 18 8l-4 25c-8 7-20 7-28 0Z" fill="#100a18" fill-opacity=".82"/><path d="${eye}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 37c4 3 8 3 12 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

function profileAvatar(profile, className = "") {
  if (profile?.avatarType === "upload") {
    const source = profile.avatarUrl || `/api/profile/avatar/${profile.rawId || profile.id}`;
    return `<span class="profile-avatar ${className}"><img src="${escapeHtml(source)}" alt="" /></span>`;
  }
  return `<span class="profile-avatar ${className}">${presetAvatarSvg(profile?.avatarValue)}</span>`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options, headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "تعذر الاتصال بالخادم.");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function avatar(player, extra = "") {
  if (player.avatarType) return profileAvatar(player, `avatar ${extra}`);
  return `<span class="avatar ${player.accent || ""} ${extra}">${escapeHtml(player.initial || player.name?.charAt(0) || "؟")}</span>`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

function activeRoomCode() {
  return state.rooms.find((room) => room.id === state.activeRoomId)?.code || $("#roomCode")?.textContent || "";
}

function activeGameType() {
  const roomType = state.rooms.find((room) => room.id === state.activeRoomId)?.gameType;
  return roomType || state.imposterGame?.gameType || state.bluffGame?.gameType || state.selectedGameType || "mafia";
}

function isImposterRoom() {
  return activeGameType() === "imposter";
}

function isBluffRoom() {
  return activeGameType() === "bluff";
}

function isWolfRoom() {
  return activeGameType() === "wolf";
}

function normalizeRoomCode(value) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/\D/g, "")
    .slice(0, 6);
}

function gamePage(gameType = state.selectedGameType) {
  return state.gamePages.find((page) => page.gameType === gameType) || gameDefaults[gameType] || gameDefaults.mafia;
}

function updateDocumentMeta(page = null) {
  const title = page?.metaTitle || "قِناع | QINAA";
  const description = page?.metaDescription || "قِناع — لعبة استنتاج اجتماعي عربية. الحقيقة خلف القناع.";
  const canonical = page?.url || "https://qinaaapp.com/";
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", page?.ogTitle || title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", page?.ogDescription || description);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
}

function pathForRoute(route) {
  const code = encodeURIComponent(activeRoomCode());
  if (route === "lobby") return `/room/${code}`;
  if (route === "game") return `/room/${code}/game`;
  if (route === "profile") return "/profile";
  if (route === "rules") return "/rules";
  if (route === "game-landing") return `/games/${encodeURIComponent(gamePage().slug)}`;
  return "/";
}

function updateHeader(route) {
  const hasBack = !["home", "game"].includes(route);
  $("#siteHeader")?.classList.toggle("has-back", hasBack);
  const backButton = $("#headerBackButton");
  if (backButton) backButton.hidden = !hasBack;
}

function goBackFromHeader() {
  if (state.route === "lobby") return navigate("game-landing");
  navigate("home");
}

function routeFromPath(pathname = location.pathname) {
  if (/^\/room\/[^/]+\/game\/?$/i.test(pathname)) return "game";
  if (/^\/room\/[^/]+\/?$/i.test(pathname)) return "lobby";
  if (/^\/profile\/?$/i.test(pathname)) return "profile";
  if (/^\/rules\/?$/i.test(pathname)) return "rules";
  const gameMatch = pathname.match(/^\/games\/([^/]+)\/?$/i);
  if (gameMatch) {
    const matched = state.gamePages.find((page) => page.slug === decodeURIComponent(gameMatch[1])) || Object.values(gameDefaults).find((page) => page.slug === decodeURIComponent(gameMatch[1]));
    if (matched) {
      state.selectedGameType = matched.gameType;
      return "game-landing";
    }
  }
  return "home";
}

async function loadGamePages() {
  try {
    const data = await apiRequest("/api/games");
    state.gamePages = data.games || [];
  } catch (_) {
    state.gamePages = Object.values(gameDefaults);
  }
}

async function syncRoomFromPath(pathname = location.pathname) {
  const match = pathname.match(/^\/room\/([^/]+)/i);
  if (!match) return true;
  const code = decodeURIComponent(match[1]).toUpperCase();
  try {
    await loadRoom(code);
    return true;
  } catch (error) {
    history.replaceState({ route: "home" }, "", "/");
    showToast(error.data?.ended ? "انتهت الجولة، رجعناك للرئيسية" : error.message);
    return false;
  }
}

function syncPlayersFromRoom(members = []) {
  state.players = members.map((member, index) => {
    const previous = state.players.find((player) => player.rawId === member.id || (player.id === "me" && member.id === state.account?.id));
    return {
      id: member.id === state.account?.id ? "me" : member.id,
      rawId: member.id,
      name: member.name,
      initial: member.bot ? "◉" : member.name?.charAt(0) || "؟",
      accent: `a${(index % 6) + 1}`,
      host: member.host,
      alive: member.alive,
      connected: true,
      bot: Boolean(member.bot),
      role: normalizedRole(member.role || previous?.role || "المواطن الصالح"),
      avatarType: member.avatarType,
      avatarValue: member.avatarValue,
      avatarUrl: member.avatarType === "upload" ? `/api/profile/avatar/${member.id}` : null,
    };
  });
}

async function loadRooms() {
  const active = state.rooms.find((room) => room.id === state.activeRoomId);
  const data = await apiRequest("/api/rooms");
  state.rooms = data.rooms || [];
  if (active && !state.rooms.some((room) => room.id === active.id)) state.rooms.unshift(active);
  renderRoomDirectory();
}

async function loadRoom(code) {
  const data = await apiRequest(`/api/rooms/${encodeURIComponent(code)}`);
  const existing = state.rooms.findIndex((room) => room.id === data.room.id);
  if (existing >= 0) state.rooms[existing] = data.room;
  else state.rooms.unshift(data.room);
  selectRoom(data.room.id);
  state.selectedGameType = data.room.gameType || "mafia";
  if (typeof data.viewerMember === "boolean") state.spectator = !data.viewerMember;
  syncPlayersFromRoom(data.members || []);
  if (state.route === "lobby") renderLobby();
  return data;
}

function connectCurrentRoomChat() {
  const me = state.players.find((player) => player.id === "me");
  if (activeRoomCode()) roomChat.connect(activeRoomCode(), { name: state.spectator ? "مشاهد" : me?.name || state.account?.displayName || "لاعب" });
}

function releaseMicrophone() {
  liveKitVoice.setMicrophoneEnabled(false).catch(() => {});
  state.micOn = false;
}

function desiredVoiceChannel() {
  if (state.route !== "game" || !activeRoomCode()) return null;
  if (isImposterRoom()) return "public";
  const me = state.players.find((player) => player.id === "me");
  if (state.phase === "night") return !state.spectator && me?.alive && isPredatorRole(me.role) ? "shadow" : null;
  return "public";
}

async function syncVoiceRoom(force = false) {
  const channel = desiredVoiceChannel();
  if (!channel) {
    if (liveKitVoice.room || liveKitVoice.connecting) await liveKitVoice.disconnect();
    state.voiceStatus = "disconnected";
    return;
  }
  try {
    await liveKitVoice.connect(activeRoomCode(), channel, force);
    voiceErrorKey = "";
  } catch (error) {
    state.voiceStatus = "error";
    const key = `${channel}:${error.message}`;
    if (voiceErrorKey !== key) {
      voiceErrorKey = key;
      showToast(error.message);
    }
  }
}

async function toggleMicrophonePermission() {
  const me = state.players.find((player) => player.id === "me");
  if (state.spectator || !me?.alive || state.speaker && state.speaker.id !== "me") {
    showToast("الميكروفون غير متاح في وضعك الحالي");
    return;
  }

  if (state.micOn) {
    await liveKitVoice.setMicrophoneEnabled(false).catch(() => {});
    state.micOn = false;
    showToast("الميكروفون مطفأ — لا أحد يسمعك");
    renderGame();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    state.micPermission = "unsupported";
    showToast("هذا المتصفح لا يدعم الوصول إلى الميكروفون");
    renderGame();
    return;
  }

  try {
    await syncVoiceRoom(true);
    await liveKitVoice.startAudio().catch(() => false);
    await liveKitVoice.setMicrophoneEnabled(true);
    state.micPermission = "granted";
    state.micOn = true;
    showToast("الميكروفون مباشر الآن داخل الغرفة");
  } catch (error) {
    releaseMicrophone();
    state.micPermission = error?.name === "NotAllowedError" || error?.name === "NotAllowed" ? "denied" : "error";
    showToast(state.micPermission === "denied" ? "رُفض إذن الميكروفون — يمكنك تغييره من إعدادات المتصفح" : error.message || "تعذر تشغيل الميكروفون");
  }
  renderGame();
}

function micStatus() {
  if (state.spectator) return { title: "وضع المشاهدة", detail: "يمكنك القراءة والاستماع فقط", button: "غير متاح" };
  const me = state.players.find((player) => player.id === "me");
  if (!me?.alive) return { title: "الميكروفون غير متاح", detail: "بعد الإقصاء تصبح مشاركتك نصية فقط", button: "غير متاح" };
  if (state.voiceStatus === "connecting" || state.voiceStatus === "reconnecting") return { title: "جارٍ ربط الصوت", detail: "ثوانٍ قليلة وتصبح الغرفة جاهزة", button: "انتظر" };
  if (state.voiceStatus === "error") return { title: "تعذر ربط الصوت", detail: "اضغط لإعادة المحاولة", button: "إعادة الاتصال" };
  if (state.micOn) return { title: "الميكروفون مفتوح", detail: "اضغط لإطفائه حتى لا يسمعك الآخرون", button: "إطفاء" };
  if (state.micPermission === "denied") return { title: "إذن الميكروفون مرفوض", detail: "فعّله من إعدادات المتصفح ثم حاول مجدداً", button: "إعادة المحاولة" };
  if (state.micPermission === "granted") return { title: "الميكروفون مطفأ", detail: "لا أحد يسمعك الآن", button: "تشغيل" };
  return { title: "الميكروفون مطفأ افتراضياً", detail: "لن يُطلب الإذن حتى تضغط على تشغيل", button: "السماح والتشغيل" };
}

function voiceParticipantProfile(participant) {
  const player = state.players.find((item) => (item.rawId || item.id) === participant.identity)
    || state.imposterGame?.players?.find((item) => item.id === participant.identity)
    || state.bluffGame?.players?.find((item) => item.id === participant.identity);
  if (player) return player;
  return {
    id: participant.identity,
    name: participant.name?.replace(" · مشاهد", "") || "لاعب",
    initial: participant.name?.charAt(0) || "؟",
    accent: "a3",
  };
}

function voiceParticipantsMarkup() {
  const active = new Set(state.activeSpeakers || []);
  const participants = [...(state.voiceParticipants || [])]
    .sort((first, second) => Number(active.has(second.identity)) - Number(active.has(first.identity)));
  if (!participants.length) {
    const copy = state.voiceStatus === "connected" ? "لا يوجد لاعب متصل بالصوت الآن." : "جارٍ تجهيز قائمة الصوت…";
    return `<div class="voice-participants-head"><strong>المشاركون صوتياً</strong><span>0</span></div><div class="voice-participants-empty">${copy}</div>`;
  }
  return `<div class="voice-participants-head"><strong>المشاركون صوتياً</strong><span>${participants.length}</span></div>
    <div class="voice-participant-grid">${participants.map((participant) => {
      const profile = voiceParticipantProfile(participant);
      const speaking = active.has(participant.identity);
      const microphoneOn = speaking || participant.microphoneOn;
      const status = speaking ? "يتحدث الآن" : microphoneOn ? "الميكروفون مفتوح" : "الميكروفون مطفأ";
      return `<article class="voice-participant-card ${speaking ? "is-speaking" : ""} ${microphoneOn ? "has-mic" : "is-muted"}" aria-label="${escapeHtml(profile.name)}، ${status}">
        <div class="voice-participant-avatar">${avatar(profile)}</div>
        <div class="voice-participant-copy"><strong>${escapeHtml(profile.name)}</strong><small>${status}</small></div>
        <span class="voice-mic-state">${icon(microphoneOn ? "mic" : "micOff")}</span>
        ${speaking ? '<span class="speaker-frequency" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : ""}
      </article>`;
    }).join("")}</div>`;
}

function voiceParticipantsTemplate() {
  return `<section class="voice-participants" data-voice-participants>${voiceParticipantsMarkup()}</section>`;
}

function refreshVoiceParticipants() {
  $$('[data-voice-participants]').forEach((container) => { container.innerHTML = voiceParticipantsMarkup(); });
}

const roleDetails = {
  "المافيا": { label: "أنت من المافيا", symbol: "♛", description: "تتفق سراً مع فريقك ليلاً على الهدف، وتحاول إبعاد الشك عنك نهاراً." },
  "المواطن الصالح": { label: "أنت المواطن الصالح", symbol: "◆", description: "راقب الكلام والتصويت، واكشف المافيا قبل أن تسيطر على الجولة." },
  "الطبيب": { label: "أنت الطبيب", symbol: "+", description: "تحمي لاعباً واحداً كل ليلة من هجوم المافيا. اختر بحذر ولا تكشف نفسك." },
  "الشيخ": { label: "أنت الشيخ — كاشف الأسرار", symbol: "⌕", description: "تفحص لاعباً واحداً كل ليلة لتعرف إن كان عضواً في المافيا." },
  "الذئب": { label: "أنت الذئب", symbol: "🐺", description: "اتفق مع الذئاب ليلاً على ضحية، واخفِ حقيقتك وسط سكان القرية نهاراً." },
  "ساكن القرية": { label: "أنت ساكن القرية", symbol: "⌂", description: "لا تملك قدرة ليلية؛ راقب النقاش والتصويت واكشف الذئاب." },
  "العرّافة": { label: "أنت العرّافة", symbol: "◉", description: "تفحص لاعباً واحداً كل ليلة لتعرف سراً إن كان ذئباً." },
  "الساحرة": { label: "أنت الساحرة", symbol: "✦", description: "لديك جرعة إنقاذ وجرعة إقصاء؛ كل جرعة تُستعمل مرة واحدة." },
  "الصياد": { label: "أنت الصياد", symbol: "⌁", description: "حدّد هدفك كل ليلة؛ إن متّ يخرج الهدف الذي علّمته معك." },
  "عين الليل": { label: "أنت عين الليل", symbol: "◐", description: "راقب لاعباً لتعرف إن كان يستيقظ ليلاً، من دون كشف دوره الحقيقي." },
  "رابطة القلوب": { label: "أنت رابطة القلوب", symbol: "♥", description: "في الليلة الأولى اربط لاعبين؛ إذا مات أحدهما لحق به الآخر." },
  "الملعون": { label: "أنت الملعون", symbol: "☾", description: "إن هاجمتك الذئاب أول مرة لا تموت، بل تتحول إلى ذئب." },
  "العجوز": { label: "أنت العجوز", symbol: "◇", description: "تنجو من أول هجوم للذئاب، لكن الهجوم الثاني يقضي عليك." },
};

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function distributeRoles() {
  const count = state.players.length;
  const mafiaCount = count >= 16 ? 4 : count >= 12 ? 3 : count >= 8 ? 2 : 1;
  const deck = Array(mafiaCount).fill(isWolfRoom() ? WOLF_ROLE : MAFIA_ROLE);
  if (isWolfRoom()) {
    ["العرّافة", "الساحرة", "الصياد", "عين الليل", "رابطة القلوب", "الملعون", "العجوز"].forEach((role, index) => {
      if (count >= index + 5 && deck.length < count) deck.push(role);
    });
    while (deck.length < count) deck.push("ساكن القرية");
  } else {
    if (count >= 5) deck.push("الطبيب", "الشيخ");
    while (deck.length < count) deck.push("المواطن الصالح");
  }
  const distributed = shuffle(deck);
  state.players.forEach((player, index) => { player.role = distributed[index]; });
}

function prepareRoleReveal(serverRole = null, serverPartners = []) {
  window.clearInterval(roleRevealTimer);
  void gameAudio.play("rolesReady");
  const me = state.players.find((player) => player.id === "me");
  if (!me) return;
  if (serverRole) me.role = normalizedRole(serverRole);
  if (isPredatorRole(serverRole)) {
    serverPartners.forEach((partner) => {
      const player = state.players.find((item) => item.rawId === partner.id);
      if (player) player.role = serverRole === WOLF_ROLE ? WOLF_ROLE : MAFIA_ROLE;
    });
  }
  const details = roleDetails[me?.role] || roleDetails[isWolfRoom() ? "ساكن القرية" : "المواطن الصالح"];
  const partners = state.players.filter((player) => player.id !== "me" && isPredatorRole(player.role));
  $("#revealedRoleName").textContent = details.label;
  $("#revealedRoleDescription").textContent = details.description;
  $("#roleSymbol").textContent = details.symbol;
  $("#rolePartner").innerHTML = isPredatorRole(me?.role) && partners.length ? `<div class="partner"><span class="avatar ${partners[0].accent}">${escapeHtml(partners[0].initial)}</span><div><small>${isWolfRole(me?.role) ? "شركاؤك من الذئاب" : "شركاؤك في المافيا"}</small><strong>${partners.map((player) => escapeHtml(player.name)).join("، ")}</strong></div><span class="online-dot"></span></div>` : "";
  $("#roleDialog").classList.remove("is-revealed");
  $("#roleRevealActions").hidden = true;
  roleRevealRemaining = 30;
  $("#roleCountdown").textContent = "00:30";
  $("#roleDialog").showModal();
}

function revealRole() {
  const dialog = $("#roleDialog");
  if (dialog.classList.contains("is-revealed")) return;
  dialog.classList.add("is-revealed");
  $("#roleRevealActions").hidden = false;
  roleRevealTimer = window.setInterval(() => {
    roleRevealRemaining = Math.max(0, roleRevealRemaining - 1);
    $("#roleCountdown").textContent = formatTime(roleRevealRemaining);
    if (roleRevealRemaining === 0) enterGameAfterRole();
  }, 1000);
}

async function enterGameAfterRole() {
  window.clearInterval(roleRevealTimer);
  roleRevealTimer = null;
  if ($("#roleDialog").open) $("#roleDialog").close();
  try {
    await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/ready`, { method: "POST", body: "{}" });
    await loadMafiaState();
    navigate("game");
  } catch (error) { showToast(error.message); }
}

function currentPlayerRole() {
  return state.players.find((player) => player.id === "me")?.role || (isWolfRoom() ? "ساكن القرية" : "المواطن الصالح");
}

async function beginNightNarration() {
  if (state.spectator || state.phase !== "night" || narratedNightRound === state.round) return;
  narratedNightRound = state.round;
  nightAudioTransition = true;
  await gameAudio.play("nightStart");
  if (state.route !== "game" || state.phase !== "night") {
    nightAudioTransition = false;
    return;
  }
  if (state.nightChoiceConfirmed) return;
  await gameAudio.playRoleWake(currentPlayerRole());
  if (!state.nightChoiceConfirmed) nightAudioTransition = false;
}

function beginDayWithNarration() {
  if (state.phase !== "night") return;
  nightAudioTransition = false;
  startDay();
  showToast("أشرقت الشمس — بدأ النقاش الحر");
  renderGame();
  void gameAudio.play("daybreak");
}

function renderDrawerProfile() {
  const account = state.account;
  $("#drawerProfile").innerHTML = account ? `
    <div class="drawer-profile-card">${profileAvatar(account)}<div><strong>${escapeHtml(account.displayName)}</strong><small>@${escapeHtml(account.username)}</small></div></div>
    <div class="drawer-profile-actions"><button data-profile-edit type="button">إدارة الملف</button><button data-logout type="button">خروج</button></div>
  ` : `<button class="drawer-login" data-login-open type="button"><span>تسجيل الدخول</span><small>أو إنشاء حساب جديد للعب</small></button>`;
}

function setAccount(user) {
  state.account = user || null;
  const me = state.players.find((player) => player.id === "me");
  if (me && user) {
    me.name = user.displayName;
    me.initial = user.displayName.charAt(0);
    me.avatarType = user.avatarType;
    me.avatarValue = user.avatarValue;
    me.avatarUrl = user.avatarUrl;
  }
  renderDrawerProfile();
}

function populateBirthDateFields() {
  const day = $("#accountBirthDay");
  const month = $("#accountBirthMonth");
  const year = $("#accountBirthYear");
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1939 }, (_, index) => currentYear - index);

  day.innerHTML = '<option value="">اليوم</option>';
  month.innerHTML = `<option value="">الشهر</option>${monthNames.map((name, index) => `<option value="${index + 1}">${name}</option>`).join("")}`;
  year.innerHTML = years.map((value) => `<option value="${value}">${value}</option>`).join("");
  year.value = "2000";
  syncBirthDays();
}

function populateProfileBirthDateFields() {
  const day = $("#profileBirthDay");
  const month = $("#profileBirthMonth");
  const year = $("#profileBirthYear");
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
  const currentYear = new Date().getFullYear();
  day.innerHTML = '<option value="">اليوم</option>';
  month.innerHTML = `<option value="">الشهر</option>${monthNames.map((name, index) => `<option value="${index + 1}">${name}</option>`).join("")}`;
  year.innerHTML = Array.from({ length: currentYear - 1939 }, (_, index) => currentYear - index).map((value) => `<option value="${value}">${value}</option>`).join("");
  year.value = "2000";
  syncProfileBirthDays();
}

function syncProfileBirthDays(preferredDay = $("#profileBirthDay").value) {
  const day = $("#profileBirthDay");
  const month = Number($("#profileBirthMonth").value || 1);
  const year = Number($("#profileBirthYear").value || 2000);
  const totalDays = new Date(year, month, 0).getDate();
  day.innerHTML = `<option value="">اليوم</option>${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}`;
  if (preferredDay && Number(preferredDay) <= totalDays) day.value = String(Number(preferredDay));
}

function syncBirthDays(preferredDay = $("#accountBirthDay").value) {
  const day = $("#accountBirthDay");
  const month = Number($("#accountBirthMonth").value || 1);
  const year = Number($("#accountBirthYear").value || 2000);
  const totalDays = new Date(year, month, 0).getDate();
  day.innerHTML = `<option value="">اليوم</option>${Array.from({ length: totalDays }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("")}`;
  if (preferredDay && Number(preferredDay) <= totalDays) day.value = String(Number(preferredDay));
}

function accountFormData() {
  const birthDay = $("#accountBirthDay").value;
  const birthMonth = $("#accountBirthMonth").value;
  const birthYear = $("#accountBirthYear").value;
  return {
    displayName: $("#accountNameInput").value.trim(),
    username: $("#accountUsernameInput").value.trim(),
    email: $("#accountEmailInput").value.trim(),
    password: $("#accountPasswordInput").value,
    passwordConfirm: $("#accountPasswordConfirmInput").value,
    birthDay,
    birthMonth,
    birthYear,
    birthDate: birthDay && birthMonth && birthYear ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : "",
  };
}

function validateAccountData(data) {
  const emailInput = $("#accountEmailInput");
  if (!$("#displayNameField").hidden && data.displayName.length < 2) return "اكتب اسماً ظاهراً من حرفين على الأقل.";
  if (!$("#usernameField").hidden && !/^[\p{L}\p{N}._-]{3,24}$/u.test(data.username)) return "اسم المستخدم غير صالح. استعمل من 3 إلى 24 حرفاً أو رقماً، ويمكن إضافة النقطة أو الشرطة فقط.";
  if (!$("#emailField").hidden && (!emailInput.validity.valid || !data.email)) return "اكتب بريداً إلكترونياً صالحاً.";
  if (!$("#passwordField").hidden) {
    if (data.password.length < 8) return "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.";
    if (data.password !== data.passwordConfirm) return "تأكيد كلمة المرور غير مطابق.";
  }
  if (!$("#birthField").hidden) {
    const parsed = data.birthDate ? new Date(`${data.birthDate}T00:00:00`) : null;
    const valid = parsed && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(data.birthYear) && parsed.getMonth() + 1 === Number(data.birthMonth) && parsed.getDate() === Number(data.birthDay);
    if (!valid || data.birthDate >= new Date().toISOString().slice(0, 10)) return "اختر يوم وشهر وسنة ميلاد صحيحة.";
  }
  return "";
}

function validateAccountField(input) {
  if (!input || input.closest("[hidden]")) return "";
  const data = accountFormData();
  if (input.id === "accountNameInput" && data.displayName.length < 2) return "اكتب اسماً ظاهراً من حرفين على الأقل.";
  if (input.id === "accountUsernameInput" && !/^[\p{L}\p{N}._-]{3,24}$/u.test(data.username)) return "اسم المستخدم غير صالح. استعمل من 3 إلى 24 حرفاً أو رقماً، ويمكن إضافة النقطة أو الشرطة فقط.";
  if (input.id === "accountEmailInput" && (!input.validity.valid || !data.email)) return "اكتب بريداً إلكترونياً صالحاً.";
  if (input.id === "accountPasswordInput" && data.password.length < 8) return "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.";
  if (input.id === "accountPasswordConfirmInput" && data.password !== data.passwordConfirm) return "تأكيد كلمة المرور غير مطابق.";
  return "";
}

function showAuthMode(mode) {
  currentAuthMode = mode;
  const editing = mode === "profile";
  const completingSocial = mode === "social-complete";
  const registering = mode === "register";
  const missing = new Set(state.account?.missingFields || []);
  $("#loginPanel").classList.toggle("is-active", mode === "login");
  $("#registerPanel").classList.toggle("is-active", registering || editing || completingSocial);
  $("#accountDialogTitle").textContent = editing ? "الملف الشخصي" : completingSocial ? "أكمل حسابك" : registering ? "إنشاء حساب جديد" : "تسجيل الدخول";
  $("#accountDialogKicker").textContent = editing ? "هويتك داخل قِناع" : completingSocial ? "أدخل المعلومات الناقصة فقط" : registering ? "حساب واحد للانضمام إلى اللعب" : "مرحباً بعودتك";
  $("#saveAccountButton").textContent = editing ? "حفظ الملف الشخصي" : completingSocial ? "حفظ ودخول قِناع" : "إنشاء الحساب";
  $("#registerSocialAuth").hidden = !registering;
  $("#registerAuthDivider").hidden = !registering;
  $("#registerLoginPrompt").hidden = editing || completingSocial;
  $("#displayNameField").hidden = completingSocial && !missing.has("displayName");
  $("#usernameField").hidden = completingSocial && !missing.has("username");
  $("#emailField").hidden = completingSocial && !missing.has("email");
  [$("#accountUsernameInput"), $("#accountEmailInput")].forEach((input) => { input.disabled = editing; });
  $("#birthField").hidden = editing || (completingSocial && !missing.has("birthDate"));
  $("#passwordField").hidden = editing || (completingSocial && !missing.has("password"));
  $("#confirmPasswordField").hidden = $("#passwordField").hidden;
  $("#accountPasswordInput").required = !$("#passwordField").hidden;
  $("#accountPasswordConfirmInput").required = !$("#confirmPasswordField").hidden;
  $("#accountSafeCopy").textContent = completingSocial ? "سنحفظ هذه المعلومات مرة واحدة، ولن نطلبها منك في الدخول القادم." : "الحساب محفوظ بأمان في قاعدة QINAA، والجلسة محمية داخل المتصفح.";
  $("#accountError").textContent = "";
  $("#loginError").textContent = "";
}

function openAccountDialog(afterSave = null, preferredMode = null) {
  pendingAccountAction = afterSave;
  const account = state.account;
  showAuthMode(preferredMode || (account ? "profile" : "login"));
  $("#accountNameInput").value = account?.displayName || "";
  $("#accountUsernameInput").value = account?.username || "";
  $("#accountEmailInput").value = account?.email || "";
  const [birthYear = "2000", birthMonth = "", birthDay = ""] = account?.birthDate?.split("-") || [];
  $("#accountBirthYear").value = birthYear || "2000";
  $("#accountBirthMonth").value = birthMonth ? String(Number(birthMonth)) : "";
  syncBirthDays(birthDay);
  $("#accountPasswordInput").value = "";
  $("#accountPasswordConfirmInput").value = "";
  $("#accountError").textContent = "";
  $("#loginError").textContent = "";
  $("#accountDialog").showModal();
}

function renderProfilePage() {
  const account = state.account;
  if (!account || account.profileComplete === false) {
    navigate("home", { replace: true });
    openAccountDialog(null, account ? "social-complete" : "login");
    return;
  }
  selectedProfileAvatar = account.avatarType === "preset" ? account.avatarValue || "mask-01" : "mask-01";
  $("#profileAvatarPreview").innerHTML = profileAvatar(account, "profile-page-avatar");
  $("#profileSummaryName").textContent = account.displayName;
  $("#profileSummaryEmail").textContent = account.email;
  $("#profileNameInput").value = account.displayName || "";
  $("#profileUsernameInput").value = account.username || "";
  $("#profileEmailInput").value = account.email || "";
  const [year = "2000", month = "", day = ""] = account.birthDate?.split("-") || [];
  $("#profileBirthYear").value = year || "2000";
  $("#profileBirthMonth").value = month ? String(Number(month)) : "";
  syncProfileBirthDays(day);
  $("#profileCurrentPassword").value = "";
  $("#profileNewPassword").value = "";
  $("#profileConfirmPassword").value = "";
  $("#profileError").textContent = "";
  $("#profileAvatarPicker").innerHTML = Array.from({ length: 10 }, (_, index) => {
    const value = `mask-${String(index + 1).padStart(2, "0")}`;
    return `<button class="profile-avatar-option ${value === selectedProfileAvatar ? "is-selected" : ""}" type="button" data-profile-avatar="${value}" role="radio" aria-checked="${value === selectedProfileAvatar}">${presetAvatarSvg(value)}</button>`;
  }).join("");
}

function requireAccount(action) {
  if (state.account && state.account.profileComplete !== false) {
    action();
    return;
  }
  openAccountDialog(action, state.account ? "social-complete" : "login");
}

function selectRoom(roomId) {
  const room = state.rooms.find((item) => item.id === roomId) || state.rooms[0];
  if (!room) return null;
  state.activeRoomId = room.id;
  state.options.privateRoom = Boolean(room.private);
  $("#roomCode").textContent = room.code;
  return room;
}

async function joinRoomAsPlayer(roomId) {
  const room = selectRoom(roomId);
  if (!room) return;
  await apiRequest(`/api/rooms/${encodeURIComponent(room.code)}/join`, { method: "POST" });
  await loadRoom(room.code);
  state.spectator = false;
  navigate("lobby");
  if (!isImposterRoom()) void gameAudio.play("welcome");
  showToast(`انضممت لاعباً إلى ${room.name}`);
}

async function watchRoom(roomId) {
  const room = selectRoom(roomId);
  if (!room) return;
  if (room.private) {
    showToast("هذه الغرفة خاصة ولا تسمح بالمشاهدة");
    return;
  }
  const data = await loadRoom(room.code);
  state.spectator = true;
  state.currentTab = "arena";
  if (data.room.status === "بانتظار اللاعبين") {
    navigate("lobby");
    showToast(`تشاهد ${room.name} وهي في انتظار بدء الجولة`);
    return;
  }
  resetForNight();
  navigate("game");
  showToast(`تشاهد ${room.name} كضيف بلا حساب`);
}

async function leaveCurrentRoom() {
  const code = activeRoomCode();
  if (!code) return navigate("home", { replace: true });
  try {
    if (!state.spectator && state.account) await apiRequest(`/api/rooms/${encodeURIComponent(code)}/leave`, { method: "DELETE" });
    state.messages = { public: [], mafia: [], dead: [] };
    state.players = [];
    state.activeRoomId = null;
    state.spectator = false;
    navigate("home", { replace: true });
    await loadRooms();
    showToast("غادرت الغرفة");
  } catch (error) {
    showToast(error.message);
  }
}

function renderRoomDirectory() {
  const directory = $("#roomDirectory");
  if (!directory) return;
  const publicRooms = state.rooms.filter((room) => !room.private && (room.gameType || "mafia") === state.selectedGameType);
  $("#liveRoomsCount").textContent = `${publicRooms.length} غرف`;
  const quickWatch = $("#watchLiveRoomButton");
  quickWatch.hidden = !publicRooms.length;
  if (publicRooms.length) quickWatch.dataset.watchRoom = publicRooms[0].id;
  directory.innerHTML = publicRooms.length ? publicRooms.map((room) => {
    const full = room.players >= room.capacity;
    const started = room.status === "جولة جارية";
    return `<article class="room-card">
      <div class="room-card-top"><div><span class="room-status"><i></i>${escapeHtml(room.status)}</span><h3>${escapeHtml(room.name)}</h3></div><span class="room-code-mini">${escapeHtml(room.code)}</span></div>
      <div class="room-card-meta"><span>${icon("users")} ${room.players} / ${room.capacity} لاعبين</span><span>${icon("eye")} ${room.spectators} مشاهدين</span></div>
      <div class="room-card-actions"><button class="button button-secondary" data-watch-room="${room.id}" type="button">${icon("eye")} مشاهدة</button><button class="button button-primary" data-join-room="${room.id}" type="button" ${full || started ? "disabled" : ""}>${full ? "مكتملة" : started ? "بدأت الجولة" : "انضم لاعباً"}</button></div>
    </article>`;
  }).join("") : '<div class="rooms-empty">لا توجد غرف عامة الآن. يمكنك إنشاء غرفة جديدة.</div>';
}

function renderGameLanding() {
  const page = gamePage();
  const imposter = state.selectedGameType === "imposter";
  const bluff = state.selectedGameType === "bluff";
  const wolf = state.selectedGameType === "wolf";
  $("#gameLandingHero").classList.toggle("imposter", imposter);
  $("#gameLandingHero").classList.toggle("bluff", bluff);
  $("#gameLandingHero").classList.toggle("wolf", wolf);
  $("#gameLandingSymbol").textContent = imposter ? "؟" : bluff ? "▰" : wolf ? "🐺" : "♛";
  $("#gameLandingEyebrow").textContent = page.eyebrow;
  $("#gameLandingTitle").textContent = page.name;
  $("#gameLandingDescription").textContent = page.shortDescription;
  $("#gameRulesPreview").innerHTML = (imposter ? [
    ["الكلمة", "يراها أهل الكلمة فقط، بينما يحاول الدخيل اكتشافها."],
    ["الأسئلة", "دور عشوائي بلا مؤقّت عبر الصوت أو الدردشة."],
    ["التصويت", "30 ثانية بسرية كاملة، ثم تظهر النتيجة الإجمالية."],
  ] : bluff ? [
    ["ادّعِ", "مرّر بطاقة مقلوبة وقل الحقيقة أو غيّر نوعها كما تشاء."],
    ["احكم أو مرّر", "اكشف صدق الادعاء، أو شاهد البطاقة ومرّرها للاعب جديد."],
    ["تجنّب العقوبات", "تُقصى عند جمع أربع بطاقات من نوع واحد أو الأنواع الثمانية."],
  ] : wolf ? [
    ["الليل", "تستيقظ الذئاب والأدوار الخاصة، ويتخذ كل دور قراره سراً."],
    ["القرية", "ناقشوا الشكوك واستعملوا قدرات العرّافة والساحرة وعين الليل."],
    ["التصويت", "اطردوا ذئباً قبل أن يصبح عدد الذئاب مساوياً لبقية السكان."],
  ] : [
    ["الليل", "تتحرك الأدوار سراً ويتخذ كل دور قراره."],
    ["النقاش", "صوت ودردشة وطابور منظم للكلام."],
    ["التصويت", "قرار مباشر، والدفاع يظهر عند التعادل فقط."],
  ]).map(([title, text]) => `<article class="game-rule-mini"><b>${title}</b><span>${text}</span></article>`).join("");
  renderRoomDirectory();
  updateDocumentMeta(page);
}

function stopLobbyPolling() {
  window.clearInterval(lobbyPoller);
  lobbyPoller = null;
}

async function loadImposterState() {
  const data = await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter`);
  const previousRound = state.imposterGame?.round;
  state.imposterGame = data;
  state.selectedGameType = "imposter";
  gameAudio.stop();
  if (previousRound && previousRound !== data.round) {
    state.imposterRoleRevealed = false;
    state.imposterVoteSelections = [];
    state.imposterWordChoice = null;
  }
  if (data.me?.voteConfirmed) state.imposterVoteSelections = [...(data.me.voteSelections || [])];
  if (data.me?.wordConfirmed) state.imposterWordChoice = data.me.wordChoice;
  return data;
}

async function loadBluffState() {
  const data = await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/bluff`);
  const previousVersion = state.bluffGame?.version;
  state.bluffGame = data;
  state.selectedGameType = "bluff";
  gameAudio.stop();
  if (previousVersion !== data.version) {
    state.bluffSelectedCard = null;
    state.bluffSelectedTarget = null;
    state.bluffSelectedClaim = null;
  }
  return data;
}

function mafiaClientId(rawId) {
  return rawId === state.account?.id ? "me" : rawId;
}

async function loadMafiaState() {
  const data = await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia`);
  if (data.me?.role) data.me.role = normalizedRole(data.me.role);
  const previous = state.mafiaGame;
  state.mafiaGame = data;
  state.selectedGameType = data.gameType || "mafia";
  state.round = data.round || 1;
  state.phase = data.phase;
  state.phaseRemaining = data.speakerId ? data.speakerSeconds : data.secondsRemaining;
  state.phaseSeconds = data.phase === "day" ? 240 : data.phase === "vote" ? 60 : data.phase === "defense" ? 90 : data.phase === "reveal" ? 30 : 75;
  state.players = (data.players || []).map((player, index) => {
    const old = state.players.find((entry) => (entry.rawId || entry.id) === player.id);
    return { ...old, id: mafiaClientId(player.id), rawId: player.id, name: player.name, initial: player.bot ? "◉" : player.name?.charAt(0) || "؟", accent: `a${(index % 6) + 1}`, alive: player.alive, connected: true, bot: player.bot, role: normalizedRole(player.role) || null, avatarType: player.avatarType, avatarValue: player.avatarValue };
  });
  state.selectedTarget = data.me?.selectedTarget ? mafiaClientId(data.me.selectedTarget) : null;
  state.scoutTargets = (data.me?.selectedTargets || []).map(mafiaClientId);
  state.nightChoiceConfirmed = Boolean(data.me?.actionConfirmed);
  state.scoutResult = null;
  state.voteRound = data.voteRound || 1;
  state.voteRemaining = data.secondsRemaining || 0;
  state.voteConfirmed = Boolean(data.me?.voteConfirmed);
  state.myVote = data.me?.voteTarget ? mafiaClientId(data.me.voteTarget) : null;
  state.voteConfirmations = data.voteConfirmations || 0;
  state.voteClosed = false;
  state.votes = Object.fromEntries(Object.entries(data.voteCounts || {}).map(([id, count]) => [mafiaClientId(id), count]));
  state.voteVoters = {};
  state.revoteCandidates = (data.defenseOrder || []).map(mafiaClientId);
  state.defenseCandidates = (data.defenseOrder || []).map(mafiaClientId);
  state.defenseIndex = data.defenseIndex || 0;
  state.defenseRemaining = data.secondsRemaining || 0;
  state.defenseStarted = data.phase === "defense";
  state.speaker = data.speakerId ? state.players.find((player) => player.rawId === data.speakerId) || null : null;
  state.speakerRemaining = data.speakerSeconds || 0;
  state.discussionRemaining = data.speakerId ? Number(data.discussionRemainingSeconds || 0) : data.secondsRemaining || 0;
  if (previous?.round && previous.round !== data.round) state.mafiaRoleRevealed = false;
  const resultKey = data.lastResult ? JSON.stringify(data.lastResult) : "";
  if (resultKey && resultKey !== previous?._resultKey) {
    const eliminatedNames = (data.lastResult.eliminatedIds || [data.lastResult.eliminatedId]).filter(Boolean).map((id) => state.players.find((player) => player.rawId === id)?.name).filter(Boolean);
    const attackName = data.gameType === "wolf" ? "الذئاب" : "المافيا";
    const resultText = data.lastResult.transformedId ? "هاجمت الذئاب الملعون فتحوّل إلى ذئب." : data.lastResult.elderSurvivedId ? "نجا العجوز من الهجوم الأول." : data.lastResult.protected ? `أُحبط هجوم ${attackName}.` : eliminatedNames.length ? `${eliminatedNames.join(" و")} خرجوا من الجولة.` : "لم يُقصَ أي لاعب.";
    state.history.push({ round: data.round, title: data.lastResult.type === "night" ? "نتيجة الليل" : "التصويت العام", result: resultText, voters: [], tie: data.lastResult.type?.includes("tie") });
  }
  state.mafiaGame._resultKey = resultKey;
  return data;
}

function startLobbyPolling() {
  stopLobbyPolling();
  const poll = async () => {
    if (!["lobby", "game"].includes(state.route) || !activeRoomCode()) return;
    try {
      await loadRoom(activeRoomCode());
      if (state.route === "game") {
        if (isImposterRoom()) await loadImposterState();
        if (isBluffRoom()) await loadBluffState();
        if (!isImposterRoom() && !isBluffRoom()) await loadMafiaState();
        renderGame();
        return;
      }
      const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
      if (state.spectator && activeRoom?.status === "جولة جارية") {
        if (!isImposterRoom() && !isBluffRoom()) await loadMafiaState();
        navigate("game");
        showToast("بدأت الجولة — انتقلت إلى المشاهدة");
        return;
      }
      if (state.account && !state.spectator) {
        const mine = await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/me`);
        if (mine.status === "playing" && ["imposter", "bluff"].includes(mine.gameType)) {
          if (mine.gameType === "imposter") await loadImposterState();
          else await loadBluffState();
          navigate("game");
        } else if (mine.status === "playing" && mine.role && !$("#roleDialog").open && !state.mafiaGame?.me?.ready) prepareRoleReveal(mine.role, mine.partners || []);
      }
    } catch (error) {
      if (error.data?.ended) {
        stopLobbyPolling();
        navigate("home", { replace: true });
        await loadRooms();
        showToast("انتهت الجولة، رجعناك للرئيسية");
      }
    }
  };
  lobbyPoller = window.setInterval(poll, 2500);
}

function navigate(route, { fromHistory = false, replace = false } = {}) {
  const leavingGame = state.route === "game" && route !== "game";
  if (leavingGame) state.route = route;
  if (leavingGame) {
    gameAudio.stop();
    nightAudioTransition = false;
    narratedNightRound = null;
    gameRenderDeferred = false;
    Object.keys(chatDrafts).forEach((channel) => { chatDrafts[channel] = ""; });
    state.voiceParticipants = [];
    state.activeSpeakers = [];
    releaseMicrophone();
    liveKitVoice.disconnect();
    roomChat.disconnect();
  }
  if (!["lobby", "game"].includes(route)) stopLobbyPolling();
  if (!leavingGame && (route === "home" || route === "rules")) gameAudio.stop();
  state.route = route;
  if (!fromHistory) {
    const path = pathForRoute(route);
    const nextUrl = `${path}${location.search}`;
    if (replace) history.replaceState({ route }, "", nextUrl);
    else if (location.pathname !== path) history.pushState({ route }, "", nextUrl);
  }
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === route));
  $$(".bottom-nav [data-route]").forEach((button) => button.classList.toggle("is-active", button.dataset.route === route));
  document.body.classList.toggle("game-mode", route === "game");
  updateHeader(route);
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (route === "lobby") { renderLobby(); startLobbyPolling(); }
  if (route === "home") updateDocumentMeta();
  if (route === "game-landing") renderGameLanding();
  if (route === "profile") renderProfilePage();
  if (route === "game") {
    connectCurrentRoomChat();
    renderGame();
    syncVoiceRoom();
    startTicker();
    startLobbyPolling();
    if (isImposterRoom()) {
      gameAudio.stop();
      loadImposterState().then(renderGame).catch((error) => showToast(error.message));
    } else if (isBluffRoom()) {
      gameAudio.stop();
      loadBluffState().then(renderGame).catch((error) => showToast(error.message));
    } else {
      loadMafiaState().then(() => { renderGame(); void beginNightNarration(); }).catch((error) => showToast(error.message));
    }
  }
}

function renderLobby() {
  const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
  const imposter = activeRoom?.gameType === "imposter";
  const bluff = activeRoom?.gameType === "bluff";
  const wolf = activeRoom?.gameType === "wolf";
  const isHost = Boolean(state.account && activeRoom?.hostUserId === state.account.id);
  const hasTwoRings = state.players.length > 10;
  const firstRingCount = hasTwoRings ? Math.ceil(state.players.length / 2) : state.players.length;
  $("#lobbyPlayers").innerHTML = state.players.map((player, index) => {
    const innerRing = hasTwoRings && index >= firstRingCount;
    const ringIndex = innerRing ? index - firstRingCount : index;
    const ringCount = innerRing ? state.players.length - firstRingCount : firstRingCount;
    const angle = (ringIndex / Math.max(1, ringCount)) * 360;
    return `<div class="table-seat ${innerRing ? "is-inner" : ""}" data-player-id="${player.id}" style="--seat-angle:${angle}deg;--seat-counter:${-angle}deg">
      ${avatar(player, player.bot ? "is-bot" : "")}
      <strong>${escapeHtml(player.name)}${player.id === "me" ? " · أنت" : ""}</strong>
      <small>${player.bot ? "روبوت تلقائي" : player.host ? "♛ المضيف" : "داخل الغرفة"}</small>
      ${isHost && !player.host && !player.bot ? `<button class="seat-kick" data-kick="${escapeHtml(player.rawId || player.id)}" aria-label="إزالة ${escapeHtml(player.name)}">×</button>` : ""}
    </div>`;
  }).join("");
  $("#playerCount").textContent = state.players.length;
  $(".player-total span").textContent = `/ ${activeRoom?.capacity || (imposter ? 18 : bluff ? 5 : 20)}`;
  $("#tablePlayerCount").textContent = state.players.length;
  $("#lobbyRoomName").textContent = activeRoom?.name || (imposter ? "مجلس الدخيل" : bluff ? "طاولة بطاقة الخداع" : wolf ? "قرية الذئاب" : "مجلس قِناع");
  $("#lobbyRoomKicker").textContent = imposter ? "غرفة الدخيل" : bluff ? "غرفة بطاقة الخداع" : wolf ? "غرفة ذئاب القرية" : "غرفة المافيا";
  $("#settingsTitle").textContent = imposter ? "قواعد الدخيل" : bluff ? "قواعد بطاقة الخداع" : wolf ? "أدوار ذئاب القرية" : "إعدادات الجولة";
  $("#settingsSubtitle").textContent = imposter || bluff ? "تتكيّف تلقائياً مع عدد اللاعبين" : "توزيع ذكي حسب العدد";
  $$('[data-mafia-setting]').forEach((row) => { row.hidden = imposter || bluff || wolf; });
  $$('[data-wolf-setting]').forEach((row) => { row.hidden = !wolf; });
  $$('[data-imposter-setting]').forEach((row) => { row.hidden = !imposter; });
  $$('[data-bluff-setting]').forEach((row) => { row.hidden = !bluff; });
  const minimum = imposter ? 4 : bluff ? 3 : 5;
  $("#minimumHint").textContent = state.spectator ? "الجولة لم تبدأ بعد؛ ستنتقل إلى المشاهدة عند بدئها" : !isHost ? "في انتظار أن يبدأ المضيف الجولة" : state.players.length >= minimum ? `كل شيء جاهز · ${state.players.length} لاعبين` : `سيضيف قِناع ${minimum - state.players.length} روبوتات تلقائياً عند البدء`;
  $("#startGameButton").disabled = !isHost || state.spectator;
  $("#startGameButton span").textContent = imposter ? "بدء لعبة الدخيل" : bluff ? "بدء بطاقة الخداع" : wolf ? "بدء ذئاب القرية" : "بدء المافيا";
  $("#leaveLobbyButton").textContent = state.spectator ? "مغادرة المشاهدة" : "مغادرة الغرفة";
  $(".host-note").hidden = !isHost || state.spectator;
  $("#privateRoomToggle").checked = state.options.privateRoom;
  $("#spectatorCount").textContent = state.spectators.length;
  $("#spectatorList").innerHTML = state.spectators.length ? state.spectators.map((spectator) => `
    <div class="spectator-row">
      <span class="spectator-avatar">${escapeHtml(spectator.name.charAt(0))}</span>
      <div><strong>${escapeHtml(spectator.name)}</strong><small>${spectator.guest ? "ضيف بلا حساب" : "مشاهد مسجّل"}</small></div>
      <button class="kick-button" data-kick-spectator="${spectator.id}" aria-label="إخراج ${escapeHtml(spectator.name)} من الغرفة"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
  `).join("") : '<div class="spectator-empty">لا يشاهد الغرفة أحد الآن.</div>';
}

function openDrawer() {
  $("#drawer").classList.add("is-open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("is-visible");
  $("#menuButton").setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  $("#drawer").classList.remove("is-open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("is-visible");
  $("#menuButton").setAttribute("aria-expanded", "false");
}

function startTicker() {
  if (gameTicker) return;
  gameTicker = window.setInterval(() => {
    if (state.route !== "game") return;
    if (isBluffRoom()) {
      if (["respond", "pass"].includes(state.bluffGame?.phase) && Number.isFinite(state.bluffGame?.actionSecondsRemaining)) {
        state.bluffGame.actionSecondsRemaining = Math.max(0, state.bluffGame.actionSecondsRemaining - 1);
        const remaining = state.bluffGame.actionSecondsRemaining;
        const timer = $("#timerValue");
        const actionClock = $("#bluffActionClock");
        if (timer) timer.textContent = formatTime(remaining);
        if (actionClock) actionClock.textContent = formatTime(remaining);
        $("#phaseProgress").style.width = `${Math.max(0, Math.min(100, (remaining / 59) * 100))}%`;
        if (remaining === 0) {
          state.bluffGame.actionSecondsRemaining = null;
          loadBluffState().then(renderGame).catch(() => {});
        }
      }
      return;
    }
    if (isImposterRoom()) {
      if (state.imposterGame?.phase === "vote" && Number.isFinite(state.imposterGame.voteSecondsRemaining)) {
        state.imposterGame.voteSecondsRemaining = Math.max(0, state.imposterGame.voteSecondsRemaining - 1);
        const timer = $("#timerValue");
        const voteClock = $("#imposterVoteClock");
        if (timer) timer.textContent = formatTime(state.imposterGame.voteSecondsRemaining);
        if (voteClock) voteClock.textContent = formatTime(state.imposterGame.voteSecondsRemaining);
        if (state.imposterGame.voteSecondsRemaining === 0) loadImposterState().then(renderGame).catch(() => {});
      }
      return;
    }
    if (state.mafiaGame) {
      if (state.mafiaGame.speakerId) {
        state.speakerRemaining = Math.max(0, state.speakerRemaining - 1);
        state.phaseRemaining = state.speakerRemaining;
      } else {
        state.phaseRemaining = Math.max(0, state.phaseRemaining - 1);
        if (state.phase === "vote") state.voteRemaining = state.phaseRemaining;
        if (state.phase === "defense") state.defenseRemaining = state.phaseRemaining;
        if (state.phase === "day") state.discussionRemaining = state.phaseRemaining;
      }
      updateTimers();
      if (state.phaseRemaining === 0) loadMafiaState().then(renderGame).catch(() => {});
      return;
    }
    if (state.phase === "night") {
      if (nightAudioTransition) return;
      state.phaseRemaining = Math.max(0, state.phaseRemaining - 1);
      if (state.phaseRemaining === 0) {
        beginDayWithNarration();
      }
    } else if (state.phase === "day") {
      if (state.speaker) {
        state.speakerRemaining = Math.max(0, state.speakerRemaining - 1);
        if (state.speakerRemaining === 0) {
          finishCurrentSpeech(true);
        }
      } else {
        state.discussionRemaining = Math.max(0, state.discussionRemaining - 1);
        state.phaseRemaining = state.discussionRemaining;
        if (state.discussionRemaining === 0) {
          startVote();
          scheduleBotVotes();
          showToast("انتهى النقاش — فُتح التصويت");
          renderGame();
        }
      }
    } else if (state.phase === "defense") {
      if (state.defenseStarted) {
        state.defenseRemaining = Math.max(0, state.defenseRemaining - 1);
        state.phaseRemaining = state.defenseRemaining;
        if (state.defenseRemaining === 0) completeDefenseTurn(true);
      }
    } else if (state.phase === "vote" && !state.voteClosed) {
      state.voteRemaining = Math.max(0, state.voteRemaining - 1);
      state.phaseRemaining = state.voteRemaining;
      if (state.voteRemaining === 0) closeVote();
    }
    updateTimers();
  }, 1000);
}

function updateTimers() {
  if (state.route !== "game") return;
  const value = state.phase === "day" && state.speaker ? state.speakerRemaining : state.phaseRemaining;
  $("#timerValue").textContent = formatTime(value);
  const total = state.phase === "day" && state.speaker ? (state.speakerIndex <= 1 ? 120 : 60) : state.phaseSeconds;
  $("#phaseProgress").style.width = `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
  const discussionClock = $("#discussionClock");
  if (discussionClock) discussionClock.textContent = formatTime(state.discussionRemaining);
  const speakerClock = $("#speakerClock");
  if (speakerClock) speakerClock.textContent = formatTime(state.speakerRemaining);
  const voteClock = $("#voteClock");
  if (voteClock) voteClock.textContent = formatTime(state.voteRemaining);
  const defenseClock = $("#defenseClock");
  if (defenseClock) defenseClock.textContent = formatTime(state.defenseRemaining);
}

function imposterPlayer(id) {
  return state.imposterGame?.players?.find((player) => player.id === id) || state.players.find((player) => (player.rawId || player.id) === id);
}

function formatVoteCount(countValue) {
  const count = Number(countValue || 0);
  if (count === 0) return "لا أصوات";
  if (count === 1) return "صوت واحد";
  if (count === 2) return "صوتان";
  if (count <= 10) return `${count} أصوات`;
  return `${count} صوتاً`;
}

function imposterVoiceChat() {
  const mic = micStatus();
  return `<div class="imposter-voice-chat">
    <div class="voice-bar"><div><span class="voice-visual"><i></i><i></i><i></i></span><span><strong>${state.spectator ? "الاستماع إلى الغرفة" : "الصوت العام"}</strong><small>${state.voiceStatus === "connected" ? "متصل عبر LiveKit" : "جارٍ الاتصال بالصوت…"}</small></span></div><button class="mic-button ${state.micOn ? "" : "is-muted"}" data-action="toggle-mic" ${state.spectator ? "disabled" : ""}>${icon(state.micOn ? "mic" : "micOff")}</button></div>
    ${voiceParticipantsTemplate()}
    ${channelTemplate("public")}
  </div>`;
}

function imposterTemplate() {
  const game = state.imposterGame;
  if (!game) return '<div class="imposter-stage"><div class="turn-wait">جارٍ تحميل حالة لعبة الدخيل…</div></div>';
  const me = game.me;
  const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
  const isHost = Boolean(state.account && activeRoom?.hostUserId === state.account.id);
  if (game.phase === "reveal") {
    if (!me) return `<div class="imposter-stage"><section class="imposter-hero"><small>مرحلة سرية</small><h1>اللاعبون يكشفون بطاقاتهم</h1><p>بصفتك مشاهداً، لن ترى الكلمات أو الأدوار السرية.</p></section>${imposterVoiceChat()}</div>`;
    const revealed = state.imposterRoleRevealed;
    const roleText = me.role === "الدخيل" ? "أنت الدخيل" : "أنت من أهل الكلمة";
    const roleHelp = me.role === "الدخيل" ? "لا تعرف الكلمة. استمع إلى الأسئلة وحاول اكتشافها من دون أن تنكشف." : "احمِ الكلمة في أسئلتك وأجوبتك، وحاول كشف الدخيل.";
    return `<div class="imposter-stage">
      <button class="imposter-role-card ${revealed ? "is-revealed" : ""}" data-imposter-action="reveal-role" type="button">
        <span class="card-mark">${revealed ? (me.role === "الدخيل" ? "؟" : "✓") : "؟"}</span>
        <h2>${revealed ? roleText : "اكشف بطاقتك"}</h2>
        <p>${revealed ? roleHelp : "اضغط على البطاقة وحدك لتعرف دورك في هذه الجولة."}</p>
        ${revealed && me.secretWord ? `<div class="secret-word-card"><span>الكلمة السرية</span><strong>${escapeHtml(me.secretWord)}</strong></div>` : ""}
      </button>
      ${revealed ? `<button class="button button-primary button-large full" data-imposter-action="ready" ${me.ready ? "disabled" : ""}>${me.ready ? "تم التأكيد · ننتظر البقية" : "رأيت دوري، أنا مستعد"}</button>` : ""}
    </div>`;
  }

  if (game.phase === "questions") {
    const asker = imposterPlayer(game.askerId);
    const answerer = imposterPlayer(game.answererId);
    const myRawId = state.account?.id;
    const canFinishQuestion = me && myRawId === game.askerId && game.turnStage === "question";
    const canFinishAnswer = me && myRawId === game.answererId && game.turnStage === "answer";
    return `<div class="imposter-stage">
      <section class="imposter-hero"><small>الأسئلة بلا مؤقّت</small><h1>${game.turnStage === "question" ? "دور السؤال" : "دور الجواب"}</h1><p>يمكنكم الكلام بالصوت أو الكتابة في المحادثة. ينتقل الدور فقط بعد تأكيد اللاعب المعني.</p></section>
      ${me?.secretWord ? `<div class="secret-word-card"><span>تذكير بالكلمة السرية</span><strong>${escapeHtml(me.secretWord)}</strong></div>` : me ? '<div class="turn-wait">أنت الدخيل — استنتج الكلمة من الأسئلة والأجوبة.</div>' : ""}
      <section class="question-pair"><div class="question-pair-head"><span>الدور ${game.currentIndex + 1} من ${game.totalTurns}</span><b>${game.turnStage === "question" ? "بانتظار السؤال" : "بانتظار الجواب"}</b></div>
        <div class="question-flow"><div class="question-person">${profileAvatar(asker, "avatar")}<strong>${escapeHtml(asker?.name || "السائل")}</strong><small>يسأل</small></div><span class="question-arrow">←</span><div class="question-person">${profileAvatar(answerer, "avatar")}<strong>${escapeHtml(answerer?.name || "المجيب")}</strong><small>يجيب</small></div></div>
        <div class="turn-actions">
          ${canFinishQuestion ? '<button class="button button-primary full" data-imposter-action="question-done">انتهيت من السؤال</button>' : ""}
          ${canFinishAnswer ? '<button class="button button-primary full" data-imposter-action="answer-done">انتهيت من الجواب</button>' : ""}
          ${!canFinishQuestion && !canFinishAnswer ? `<div class="turn-wait">${game.turnStage === "question" ? `ننتظر سؤال ${escapeHtml(asker?.name || "اللاعب")}` : `ننتظر جواب ${escapeHtml(answerer?.name || "اللاعب")}`}</div>` : ""}
        </div>
      </section>${imposterVoiceChat()}
    </div>`;
  }

  if (game.phase === "vote") {
    if (!me) return `<div class="imposter-stage"><section class="imposter-hero"><small>تصويت سري</small><h1>اللاعبون يصوّتون الآن</h1><p>الهويات والاختيارات مخفية حتى إغلاق الصندوق.</p></section><div class="secret-word-card"><span>الوقت المتبقي</span><strong id="imposterVoteClock">${formatTime(game.voteSecondsRemaining || 0)}</strong></div>${imposterVoiceChat()}</div>`;
    const selected = state.imposterVoteSelections;
    const voteLocked = me.voteConfirmed;
    return `<div class="imposter-stage">
      <section class="imposter-hero"><small>30 ثانية فقط</small><h1>من هو الدخيل؟</h1><p>اختر ${game.imposterCount} ثم أكّد. لا تظهر هوية أي مصوّت، ولا يمكن تغيير الصوت بعد التأكيد.</p></section>
      <div class="secret-word-card"><span>الوقت المتبقي</span><strong id="imposterVoteClock">${formatTime(game.voteSecondsRemaining || 0)}</strong></div>
      <div class="imposter-vote-grid">${game.players.filter((player) => player.id !== state.account?.id).map((player) => `<button class="imposter-vote-option ${selected.includes(player.id) ? "is-selected" : ""}" data-imposter-vote="${player.id}" ${voteLocked ? "disabled" : ""}>${profileAvatar(player, "avatar")}<strong>${escapeHtml(player.name)}</strong></button>`).join("")}</div>
      <button class="button button-primary full" data-imposter-action="confirm-vote" ${voteLocked || selected.length !== game.imposterCount ? "disabled" : ""}>${voteLocked ? "تم تأكيد صوتك" : `تأكيد ${game.imposterCount} من المشتبه بهم`}</button>
      ${me.role === "الدخيل" ? `<div class="section-label"><h2>خمّن الكلمة</h2><span>اختيار واحد نهائي</span></div><div class="word-choice-grid">${me.candidates.map((word) => `<button class="word-choice ${state.imposterWordChoice === word ? "is-selected" : ""}" data-imposter-word="${escapeHtml(word)}" ${me.wordConfirmed ? "disabled" : ""}>${escapeHtml(word)}</button>`).join("")}</div><button class="button button-secondary full" data-imposter-action="confirm-word" ${me.wordConfirmed || !state.imposterWordChoice ? "disabled" : ""}>${me.wordConfirmed ? "تم تأكيد الكلمة" : "تأكيد تخمين الكلمة"}</button>` : ""}
      <p class="vote-lock-note">تُعرض الأعداد الإجمالية بعد الإغلاق فقط، ولا تُكشف هوية من صوّت لمن.</p>
    </div>`;
  }

  const results = game.results || {};
  const winnerLabel = results.winner === "knowers" ? "فاز أهل الكلمة" : "فاز الدخلاء";
  const standings = game.standings || [];
  return `<div class="imposter-stage"><section class="imposter-hero"><small>انتهت الجولة</small><h1>كُشفت الحقيقة</h1><p>ظهرت النتيجة الإجمالية من دون كشف هوية المصوّتين.</p></section>
    <div class="imposter-results"><div class="result-banner"><span>${escapeHtml(results.secretWord || "")}</span><strong>${winnerLabel}</strong></div>
      <div class="result-list">${game.players.map((player) => `<div class="result-row"><span>${escapeHtml(player.name)}${results.imposters?.includes(player.id) ? " · الدخيل" : ""}</span><small>${formatVoteCount(results.voteCounts?.[player.id])}</small></div>`).join("")}</div>
      ${results.tieAtCutoff ? '<div class="turn-wait">حدث تعادل عند حدّ الاختيار، لذلك لم يُعتبر المتعادلون مكشوفين.</div>' : ""}
      ${standings.length ? `<section class="imposter-standings"><div class="section-label"><h2>ترتيب الغرفة</h2><span>يتراكم بعد كل جولة</span></div>${standings.map((entry) => `<div class="result-row"><span><b>${entry.rank}</b> · ${escapeHtml(entry.name)}</span><small>${entry.points} نقطة · ${entry.wins} فوز</small></div>`).join("")}</section>` : ""}
      <div class="imposter-result-actions">
        ${isHost ? '<button class="button button-primary full" data-imposter-action="next-round">بدء جولة جديدة</button><button class="button button-secondary full" data-action="end-round">إنهاء الغرفة والعودة للرئيسية</button>' : '<div class="turn-wait">ننتظر المضيف لبدء جولة جديدة.</div>'}
        <button class="button button-secondary full" data-action="leave-room">مغادرة الغرفة</button>
      </div>
    </div></div>`;
}

function renderImposterGame() {
  gameAudio.stop();
  const game = state.imposterGame;
  const labels = { reveal: "كشف البطاقات", questions: "الأسئلة والأجوبة", vote: "التصويت السري", results: "نتيجة الجولة" };
  $("#roundLabel").textContent = `الدخيل · الجولة ${game?.round || 1}`;
  $("#phaseLabel").textContent = labels[game?.phase] || "جارٍ التحضير";
  $("#phaseIcon").innerHTML = game?.phase === "vote" ? icon("vote") : icon("chat");
  $("#mainTimer").hidden = game?.phase !== "vote";
  $("#timerValue").textContent = formatTime(game?.voteSecondsRemaining || 0);
  $("#phaseProgress").style.width = game?.phase === "vote" ? `${Math.max(0, Math.min(100, ((game.voteSecondsRemaining || 0) / 30) * 100))}%` : "0%";
  $$('[data-game-tab]').forEach((button) => { button.hidden = button.dataset.gameTab !== "arena"; button.classList.toggle("is-active", button.dataset.gameTab === "arena"); });
  state.currentTab = "arena";
  gameContent.innerHTML = imposterTemplate();
  refreshPublicChat();
  syncVoiceRoom();
}

function bluffPlayer(id) {
  return state.bluffGame?.players?.find((player) => player.id === id) || null;
}

function bluffCardTemplate(card, selectable = false) {
  const selected = state.bluffSelectedCard === card.id;
  return `<button class="bluff-card ${selectable ? "is-selectable" : ""} ${selected ? "is-selected" : ""}" style="--card-color:${escapeHtml(card.color || "#8f5cff")}" ${selectable ? `data-bluff-card="${escapeHtml(card.id)}"` : "disabled"} type="button">
    <span class="bluff-card-pattern">${escapeHtml(card.symbol || "◆")}</span>
    <b>${escapeHtml(card.name || "بطاقة")}</b><small>${card.count ? `${card.count} بطاقات` : "البطاقة الحقيقية"}</small>${card.count ? `<strong class="bluff-card-count">${card.count}</strong>` : ""}
  </button>`;
}

function bluffHandGroups(hand = []) {
  const groups = new Map();
  hand.forEach((card) => {
    const current = groups.get(card.type) || { ...card, count: 0 };
    current.count += 1;
    groups.set(card.type, current);
  });
  return [...groups.values()];
}

function bluffCardBack() {
  return `<div class="bluff-card-back" aria-label="بطاقة مقلوبة"><span>قِناع</span><b>؟</b><small>البطاقة مخفية</small></div>`;
}

function bluffActionTimer(game) {
  if (!["respond", "pass"].includes(game.phase)) return "";
  return `<div class="bluff-action-timer"><span>أجب أو مرّر قبل انتهاء الوقت</span><strong id="bluffActionClock">${formatTime(game.actionSecondsRemaining || 0)}</strong></div>`;
}

function bluffPublicTransit(game, sender, receiver) {
  if (!["respond", "pass"].includes(game.phase)) return "";
  const status = game.phase === "pass"
    ? `${receiver?.name || "اللاعب"} شاهد البطاقة ويختار لمن يمرّرها.`
    : `${sender?.name || "المرسل"} يدّعي أنها ${game.claim?.name || "بطاقة أخرى"}، و${receiver?.name || "المستلم"} يحكم الآن.`;
  return `${bluffActionTimer(game)}<div class="bluff-hidden-card">${bluffCardBack()}</div><p>${escapeHtml(status)}</p>`;
}

function bluffSeatLayout(count) {
  const layouts = {
    3: [[50, 88], [82, 24], [18, 24]],
    4: [[50, 88], [84, 48], [50, 11], [16, 48]],
    5: [[50, 88], [84, 65], [77, 15], [23, 15], [16, 65]],
  };
  return layouts[count] || layouts[5];
}

function bluffOrderedPlayers(game) {
  const players = [...game.players];
  const anchorId = game.me?.id || game.currentPlayerId || players[0]?.id;
  const anchorIndex = Math.max(0, players.findIndex((player) => player.id === anchorId));
  return [...players.slice(anchorIndex), ...players.slice(0, anchorIndex)];
}

function bluffTableCenter(game) {
  const current = bluffPlayer(game.currentPlayerId);
  const sender = bluffPlayer(game.senderId);
  const receiver = bluffPlayer(game.receiverId);
  let eyebrow = `الجولة ${game.round || 1}`;
  let title = current ? `الدور عند ${current.name}` : "بطاقة الخداع";

  if (game.phase === "respond") {
    eyebrow = `${sender?.name || "المرسل"} مرّر بطاقة`;
    title = `يدّعي: ${game.claim?.name || "نوع مخفي"}`;
  } else if (game.phase === "pass") {
    eyebrow = `${receiver?.name || "المستلم"} شاهد البطاقة`;
    title = "البطاقة ما زالت سرية";
  } else if (game.phase === "results") {
    eyebrow = "انتهت الجولة";
    title = "كُشف آخر ادعاء";
  }

  return `<div class="bluff-table-center ${["respond", "pass"].includes(game.phase) ? "has-live-card" : ""}">
    <div class="bluff-center-card">${["respond", "pass"].includes(game.phase) ? bluffCardBack() : '<div class="bluff-deck-stack"><i></i><i></i><i></i><b>قِناع</b></div>'}</div>
    <small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong>
  </div>`;
}

function bluffPlayersTemplate(game) {
  const players = bluffOrderedPlayers(game);
  const positions = bluffSeatLayout(players.length);
  const activeCount = players.filter((player) => !player.eliminated).length;
  return `<section class="bluff-players players-${players.length}">
    <header class="bluff-table-heading"><div><small>الجولة ${game.round || 1}</small><strong>طاولة بطاقة الخداع</strong></div><span>${activeCount} لاعبين مستمرين</span></header>
    <div class="bluff-table-surface">${bluffTableCenter(game)}</div>
    <div class="bluff-player-grid">${players.map((player, index) => {
    const speaking = state.activeSpeakers.includes(player.id);
    const current = player.id === game.currentPlayerId || player.id === game.receiverId;
    const penalties = player.penalties || [];
    const voice = state.voiceParticipants.find((participant) => participant.identity === player.id);
    const [seatX, seatY] = positions[index] || positions[0];
    return `<article class="bluff-player seat-${index} ${index === 0 ? "seat-bottom" : ""} ${current ? "is-current" : ""} ${player.eliminated ? "is-eliminated" : ""} ${speaking ? "is-speaking" : ""}" style="--seat-x:${seatX}%;--seat-y:${seatY}%">
      <div class="bluff-player-head">${profileAvatar(player, "avatar")}<div><strong>${escapeHtml(player.name)}${player.id === game.me?.id ? " · أنت" : ""}</strong><small>${player.eliminated ? `المركز ${player.placement || "—"}` : current ? "دوره الآن" : `${player.handCount} في اليد`}</small></div><span class="bluff-mic ${speaking ? "is-live" : ""}" title="${speaking ? "يتكلم الآن" : voice?.microphoneOn ? "الميكروفون مفتوح" : "الميكروفون مغلق"}">${speaking ? ")))" : voice?.microphoneOn ? "•" : "×"}</span></div>
      <div class="bluff-hand-stack" aria-label="${player.handCount} بطاقة في اليد"><i></i><i></i><i></i><b>${player.handCount}</b></div>
      <div class="bluff-floor-cards">${penalties.length ? penalties.map((penalty) => {
        const type = game.cardTypes.find((item) => item.id === penalty.type) || {};
        return `<span style="--floor-color:${escapeHtml(penalty.color)}" title="${escapeHtml(penalty.name)}"><i>${escapeHtml(type.symbol || "◆")}</i><strong>×${penalty.count}</strong></span>`;
      }).join("") : '<small>لا عقوبات</small>'}</div>
    </article>`;
  }).join("")}</div></section>`;
}

function bluffClaimChoices(game) {
  return `<div class="bluff-claim-grid">${game.cardTypes.map((type) => `<button class="bluff-claim ${state.bluffSelectedClaim === type.id ? "is-selected" : ""}" style="--claim-color:${escapeHtml(type.color)}" data-bluff-claim="${type.id}" type="button"><span>${escapeHtml(type.symbol)}</span>${escapeHtml(type.name)}</button>`).join("")}</div>`;
}

function bluffTargetChoices(ids) {
  return `<div class="bluff-target-grid">${ids.map((id) => {
    const player = bluffPlayer(id);
    return `<button class="bluff-target ${state.bluffSelectedTarget === id ? "is-selected" : ""}" data-bluff-target="${id}" type="button">${profileAvatar(player, "avatar")}<strong>${escapeHtml(player?.name || "لاعب")}</strong></button>`;
  }).join("")}</div>`;
}

function bluffLastResult(game) {
  const result = game.lastResult;
  if (!result) return "";
  const loser = bluffPlayer(result.penaltyUserId);
  const type = game.cardTypes.find((item) => item.id === result.cardType) || {};
  return `<div class="bluff-last-result ${result.eliminatedUserId ? "is-elimination" : ""}"><div class="bluff-result-flip"><div class="bluff-result-flip-inner"><div class="bluff-result-face back">${bluffCardBack()}</div><div class="bluff-result-face front" style="--card-color:${escapeHtml(type.color || "#8f5cff")}"><span>${escapeHtml(type.symbol || "◆")}</span><b>${escapeHtml(result.cardName)}</b></div></div></div><div><span>${result.claimWasTrue ? "كان الادعاء صحيحاً" : "كان الادعاء كاذباً"}</span><strong>${escapeHtml(result.cardName)} · العقوبة على ${escapeHtml(loser?.name || "اللاعب")}</strong>${result.eliminatedUserId ? "<small>خرج من الجولة، وأعيدت بطاقاته إلى الرزمة.</small>" : ""}</div></div>`;
}

function bluffPenaltySummary(game) {
  if (!game.me?.penalties?.length) return "";
  return `<div class="bluff-penalties"><b>عقوباتك</b>${game.me.penalties.map((penalty) => `<span style="--penalty-color:${escapeHtml(penalty.color)}">${escapeHtml(penalty.name)} × ${penalty.count}</span>`).join("")}</div>`;
}

function bluffTemplate() {
  const game = state.bluffGame;
  if (!game) return '<div class="bluff-stage"><div class="turn-wait">جارٍ تحميل بطاقة الخداع…</div></div>';
  const me = game.me;
  const current = bluffPlayer(game.currentPlayerId);
  const sender = bluffPlayer(game.senderId);
  const receiver = bluffPlayer(game.receiverId);
  const isHost = state.rooms.find((room) => room.id === state.activeRoomId)?.hostUserId === state.account?.id;
  let action = "";

  if (game.phase === "results") {
    const winner = bluffPlayer(game.winnerUserId);
    action = `<section class="bluff-action-card result"><small>انتهت الجولة</small><h1>نجا ${escapeHtml(winner?.name || "الفائز")}</h1><p>آخر لاعب بقي من دون إقصاء هو الفائز ببطاقة الخداع.</p>${winner ? profileAvatar(winner, "avatar winner") : ""}<div class="imposter-result-actions">${isHost ? '<button class="button button-primary full" data-action="end-round">إنهاء الغرفة والعودة للرئيسية</button>' : ""}<button class="button button-secondary full" data-action="leave-room">مغادرة الغرفة</button></div></section>`;
  } else if (!me) {
    action = `<section class="bluff-action-card"><small>مشاهدة فقط</small><h1>سلسلة الادعاء مستمرة</h1>${bluffPublicTransit(game, sender, receiver) || "<p>ترى مسار اللعب والأعداد، لكن البطاقة الحقيقية تبقى مخفية.</p>"}</section>`;
  } else if (me.eliminated) {
    action = `<section class="bluff-action-card"><small>خرجت من الجولة</small><h1>تابع الخداع حتى النهاية</h1>${bluffPublicTransit(game, sender, receiver) || "<p>بطاقاتك عادت إلى الرزمة، ويمكنك الاستماع والكتابة في محادثة الخارجين.</p>"}</section>`;
  } else if (game.phase === "select") {
    if (game.currentPlayerId !== me.id) {
      action = `<section class="bluff-action-card"><small>بداية سلسلة جديدة</small><h1>الدور عند ${escapeHtml(current?.name || "لاعب آخر")}</h1><p>يختار بطاقة من يده، ثم يرسلها مقلوبة مع ادعاء.</p></section>`;
    } else {
      const ready = state.bluffSelectedCard && state.bluffSelectedTarget && state.bluffSelectedClaim;
      const handGroups = bluffHandGroups(me.hand);
      action = `<section class="bluff-action-card"><small>دورك الآن</small><h1>مرّر بطاقة وادّعِ نوعها</h1><p>اختر نوعاً من يدك، ثم لاعباً واسم النوع الذي ستقوله. سترسل بطاقة واحدة من المجموعة، ويمكنك قول الحقيقة أو الكذب.</p>
        <div class="section-label"><h2>1 · اختر نوع البطاقة</h2><span>${me.hand.length} بطاقة · ${handGroups.length} أنواع</span></div><div class="bluff-hand">${handGroups.map((card) => bluffCardTemplate(card, true)).join("")}</div>
        <div class="section-label"><h2>2 · اختر المستلم</h2></div>${bluffTargetChoices(me.selectTargets)}
        <div class="section-label"><h2>3 · اختر الادعاء</h2></div>${bluffClaimChoices(game)}
        <button class="button button-primary button-large full" data-bluff-action="play" ${ready ? "" : "disabled"}>مرّر البطاقة مقلوبة</button>
      </section>`;
    }
  } else if (game.phase === "respond") {
    const claimName = game.claim?.name || "نوع مجهول";
    if (game.receiverId !== me.id) {
      action = `<section class="bluff-action-card">${bluffActionTimer(game)}<small>${escapeHtml(sender?.name || "لاعب")} يدّعي</small><h1>هذه البطاقة: ${escapeHtml(claimName)}</h1><div class="bluff-hidden-card">${bluffCardBack()}</div><p>${escapeHtml(receiver?.name || "المستلم")} يقرر الآن: يجيب أو يشاهد ويمرّر.</p></section>`;
    } else {
      action = `<section class="bluff-action-card">${bluffActionTimer(game)}<small>${escapeHtml(sender?.name || "المرسل")} يقول</small><h1>«هذه البطاقة ${escapeHtml(claimName)}»</h1><div class="bluff-hidden-card">${bluffCardBack()}</div><p>احكم من دون كشف البطاقة، أو شاهدها سراً ومرّرها إذا بقي لاعب لم يرها.</p>
        <div class="bluff-answer-grid"><button class="button button-primary" data-bluff-action="answer-true">نعم، هي ${escapeHtml(claimName)}</button><button class="button button-danger" data-bluff-action="answer-false">لا، إنه يكذب</button></div>
        ${me.canPeek ? '<button class="button button-secondary full" data-bluff-action="peek">شاهد البطاقة ومرّرها</button>' : '<div class="turn-wait">أنت آخر من لم يرها، لذلك يجب أن تحكم الآن.</div>'}
      </section>`;
    }
  } else if (game.phase === "pass") {
    if (game.receiverId !== me.id) {
      action = `<section class="bluff-action-card">${bluffActionTimer(game)}<small>كشف سري</small><h1>${escapeHtml(receiver?.name || "اللاعب")} شاهد البطاقة</h1><div class="bluff-hidden-card">${bluffCardBack()}</div><p>سيختار لاعباً جديداً وادعاءً جديداً، من دون كشف الحقيقة.</p></section>`;
    } else {
      const ready = state.bluffSelectedTarget && state.bluffSelectedClaim;
      action = `<section class="bluff-action-card">${bluffActionTimer(game)}<small>رأيت الحقيقة</small><h1>البطاقة هي ${escapeHtml(me.activeCard?.name || "—")}</h1><p>اختر لاعباً لم يرها بعد، وقل له أي نوع من الأنواع الثمانية.</p>
        ${me.activeCard ? `<div class="bluff-revealed-card">${bluffCardTemplate(me.activeCard)}</div>` : ""}
        <div class="section-label"><h2>اختر المستلم الجديد</h2></div>${bluffTargetChoices(me.passTargets)}
        <div class="section-label"><h2>اختر الادعاء الجديد</h2></div>${bluffClaimChoices(game)}
        <button class="button button-primary button-large full" data-bluff-action="pass" ${ready ? "" : "disabled"}>مرّر باسم جديد</button>
      </section>`;
    }
  }

  return `<div class="bluff-stage">${bluffLastResult(game)}${bluffPlayersTemplate(game)}${action}${bluffPenaltySummary(game)}${imposterVoiceChat()}</div>`;
}

function renderBluffGame() {
  gameAudio.stop();
  const game = state.bluffGame;
  const labels = { select: "اختيار البطاقة", respond: "الحكم على الادعاء", pass: "تمرير البطاقة", results: "نتيجة الجولة" };
  $("#roundLabel").textContent = `بطاقة الخداع · الجولة ${game?.round || 1}`;
  $("#phaseLabel").textContent = labels[game?.phase] || "جارٍ التحضير";
  $("#phaseIcon").innerHTML = icon(game?.phase === "respond" ? "eye" : "chat");
  const timed = ["respond", "pass"].includes(game?.phase);
  $("#mainTimer").hidden = !timed;
  $("#timerValue").textContent = formatTime(game?.actionSecondsRemaining || 0);
  $("#phaseProgress").style.width = timed ? `${Math.max(0, Math.min(100, ((game?.actionSecondsRemaining || 0) / 59) * 100))}%` : "0%";
  $$('[data-game-tab]').forEach((button) => { button.hidden = button.dataset.gameTab !== "arena"; button.classList.toggle("is-active", button.dataset.gameTab === "arena"); });
  state.currentTab = "arena";
  gameContent.innerHTML = bluffTemplate();
  refreshPublicChat();
  syncVoiceRoom();
}

function chatComposerFocused() {
  return document.activeElement?.matches?.('#gameContent [data-chat-form] input[name="message"]');
}

function mafiaRevealWaitingTemplate() {
  const me = state.mafiaGame?.me;
  return `<div class="game-stage"><section class="stage-hero spectator-night"><span class="mock-flag">كشف سري</span><div class="eyebrow"><span></span> تجهيز الجولة</div><h1>${state.spectator ? "اللاعبون يكشفون أدوارهم" : "تم تأكيد دورك"}</h1><p>${state.spectator ? "لن تظهر لك الأدوار السرية. تبدأ الليلة بعد استعداد اللاعبين." : "ننتظر بقية اللاعبين، أو تبدأ الجولة تلقائياً عند انتهاء 30 ثانية."}</p></section><div class="spectator-wait">${icon("lock")}<strong>${me?.ready ? "أنت مستعد" : "جارٍ تجهيز الجولة"}</strong><small>${formatTime(state.phaseRemaining)}</small></div></div>`;
}

function mafiaResultsTemplate() {
  const shadowsWon = state.mafiaGame?.winner === "shadows";
  const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
  const isHost = Boolean(state.account && activeRoom?.hostUserId === state.account.id);
  const wolfGame = isWolfRoom();
  const predatorName = wolfGame ? "الذئاب" : "المافيا";
  const villageName = wolfGame ? "سكان القرية" : "المواطنون الصالحون";
  return `<div class="game-stage"><section class="stage-hero"><span class="mock-flag">انتهت الجولة</span><div class="eyebrow"><span></span> كُشفت الأدوار</div><h1>${shadowsWon ? `فازت ${predatorName}` : `فاز ${villageName}`}</h1><p>${shadowsWon ? `وصلت ${predatorName} إلى السيطرة على الجولة.` : `نجح ${villageName} في إقصاء جميع ${predatorName}.`}</p></section><div class="roster-grid">${state.players.map((player) => `<div class="roster-card ${player.alive ? "" : "is-dead"}">${avatar(player)}<div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(normalizedRole(player.role) || "دور مخفي")}</small></div></div>`).join("")}</div><div class="imposter-result-actions">${isHost ? '<button class="button button-primary full" data-action="end-round">إنهاء الغرفة والعودة للرئيسية</button>' : ""}<button class="button button-secondary full" data-action="leave-room">مغادرة الغرفة</button></div></div>`;
}

function renderGame() {
  if (chatComposerFocused()) {
    gameRenderDeferred = true;
    return;
  }
  gameRenderDeferred = false;
  const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
  if (isImposterRoom()) return renderImposterGame();
  if (isBluffRoom()) return renderBluffGame();
  $("#mainTimer").hidden = false;
  $$('[data-game-tab]').forEach((button) => { button.hidden = false; });
  if (state.currentTab === "chat") state.currentTab = "arena";
  const labels = {
    reveal: { label: "كشف الأدوار", icon: "lock" },
    night: { label: "حلّ الليل", icon: "moon" },
    day: { label: "وقت النقاش", icon: "sun" },
    defense: { label: "دفاع المتعادلين", icon: "shield" },
    vote: { label: state.voteRound > 1 ? "إعادة التصويت" : "وقت التصويت", icon: "vote" },
    results: { label: "نتيجة الجولة", icon: "shield" },
  };
  const current = labels[state.phase];
  $("#roundLabel").textContent = `الجولة ${state.round === 1 ? "الأولى" : state.round}`;
  $("#phaseLabel").textContent = current.label;
  $("#phaseIcon").innerHTML = icon(current.icon);
  $("#timerValue").textContent = formatTime(state.phaseRemaining);
  $$("[data-game-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.gameTab === state.currentTab));

  let content = "";
  if (state.currentTab === "arena") {
    content = state.phase === "reveal" ? mafiaRevealWaitingTemplate() : state.phase === "results" ? mafiaResultsTemplate() : state.phase === "night" ? nightTemplate() : state.phase === "day" ? dayTemplate() : state.phase === "defense" ? defenseTemplate() : voteTemplate();
  } else if (state.currentTab === "players") {
    content = playersTemplate();
  } else {
    content = historyTemplate();
  }
  const spectatorNotice = state.spectator ? `<div class="spectator-banner">${icon("eye")}<div><strong>أنت تشاهد ${escapeHtml(activeRoom?.name || "الغرفة")}</strong><small>دخول بلا حساب · استماع فقط بلا تصويت أو أسرار الأدوار</small></div><button data-action="start-audio" type="button">تشغيل الصوت</button><button data-route="home" type="button">خروج</button></div>` : "";
  gameContent.innerHTML = spectatorNotice + content;
  updateTimers();
  syncVoiceRoom();
}

function nightTemplate() {
  const wolfGame = isWolfRoom();
  const enemyName = wolfGame ? "الذئاب" : "المافيا";
  if (state.spectator) {
    return `<div class="game-stage"><section class="stage-hero spectator-night"><span class="mock-flag">معلومات محجوبة</span><div class="eyebrow"><span></span> الليل جارٍ</div><h1>اللاعبون نائمون</h1><p>أنت تشاهد فقط. اختيارات الأدوار والقنوات السرية مخفية حتى لا تنكشف اللعبة.</p></section><div class="spectator-wait">${icon("lock")}<strong>ننتظر شروق النهار</strong><small>ستنتقل المشاهدة تلقائياً عند انتهاء المرحلة.</small></div></div>`;
  }
  const me = state.players.find((player) => player.id === "me");
  const roleActions = {
    "المافيا": { eyebrow: "قناة المافيا الخاصة", title: "اختاروا هدف الليلة", description: "لا يرى هذا القرار سوى المافيا. اختاروا لاعباً ثم أكدوا القرار.", target: "الهدف المقترح" },
    "الذئب": { eyebrow: "عواء الذئاب", title: "اختاروا ضحية الليلة", description: "لا يرى هذا القرار سوى الذئاب. اختاروا ساكناً ثم أكدوا القرار.", target: "الضحية المقترحة" },
    "الطبيب": { eyebrow: "قرار الطبيب", title: "من ستحمي الليلة؟", description: "اختر لاعباً واحداً لحمايته من هجوم المافيا هذه الليلة.", target: "اللاعب المحمي" },
    "الشيخ": { eyebrow: "كشف الأسرار", title: "من ستفحص الليلة؟", description: "اختَر لاعباً واحداً لتتحقق سراً إن كان عضواً في المافيا.", target: "هدف الكشف" },
    "العرّافة": { eyebrow: "رؤية العرّافة", title: "من ستكشفين الليلة؟", description: "اختاري لاعباً واحداً لتعرفي سراً إن كان ذئباً.", target: "هدف الرؤية" },
    "الصياد": { eyebrow: "رصاصة أخيرة", title: "من ستأخذه معك؟", description: "حدّد هدفاً سرياً؛ إن متّ قبل الليلة المقبلة يخرج معك.", target: "الهدف المعلّم" },
    "عين الليل": { eyebrow: "مراقبة صامتة", title: "من ستراقب الليلة؟", description: "ستعرف هل استيقظ هذا اللاعب ليلاً، من دون معرفة دوره.", target: "هدف المراقبة" },
    "رابطة القلوب": { eyebrow: "الليلة الأولى", title: "اربط قلبين بمصير واحد", description: "اختر لاعبين اثنين. إذا مات أحدهما لحق به الآخر.", target: "القلبان المرتبطان" },
  };
  if (me?.role === "الساحرة") {
    const witch = state.mafiaGame?.me?.witch || {};
    const victim = state.players.find((player) => player.rawId === witch.victimId);
    const targets = state.players.filter((player) => player.id !== "me" && player.alive);
    return `<div class="game-stage">
      <section class="stage-hero"><span class="mock-flag">قرار سري</span><div class="eyebrow"><span></span> حارسة الجرعات</div><h1>قرار الساحرة</h1><p>${victim ? `اختارت الذئاب ${escapeHtml(victim.name)}. يمكنك إنقاذه، تسميم لاعب آخر، أو تمرير دورك.` : "لم يكتمل قرار الذئاب بعد. يمكنك الانتظار أو تمرير دورك."}</p></section>
      <div class="section-label"><h2>هدف جرعة الإقصاء</h2><span>${state.selectedTarget ? "تم اختيار هدف" : "اختياري"}</span></div>
      <div class="target-grid">${targets.map((player) => `<button class="target-card ${state.selectedTarget === player.id ? "is-selected" : ""} ${state.nightChoiceConfirmed ? "is-locked" : ""}" data-target="${player.id}" ${state.nightChoiceConfirmed ? "disabled" : ""}>${avatar(player)}<strong>${escapeHtml(player.name)}</strong><small>حيّ · متصل</small></button>`).join("")}</div>
      <div class="confirmation-panel ${state.nightChoiceConfirmed ? "is-complete" : ""}"><div class="confirmation-copy"><span class="confirmation-icon">${state.nightChoiceConfirmed ? "✓" : "✦"}</span><div><strong>${state.nightChoiceConfirmed ? "تم تأكيد قرار الساحرة" : "اختر جرعة واحدة أو مرّر"}</strong><small>جرعة الإنقاذ وجرعة الإقصاء متاحتان مرة واحدة لكل مباراة.</small></div></div>
        <div class="confirmation-footer"><b>${state.nightChoiceConfirmed ? "القرار مقفل" : "قرار واحد"}</b><div class="witch-actions"><button class="button button-secondary" data-action="witch-save" ${state.nightChoiceConfirmed || !witch.canSave || !witch.victimId ? "disabled" : ""}>إنقاذ ${victim ? escapeHtml(victim.name) : "الضحية"}</button><button class="button button-primary" data-action="witch-poison" ${state.nightChoiceConfirmed || !witch.canPoison || !state.selectedTarget ? "disabled" : ""}>استعمال السم</button><button class="button button-secondary" data-action="witch-pass" ${state.nightChoiceConfirmed ? "disabled" : ""}>تمرير</button></div></div>
      </div></div>`;
  }
  const actionCopy = roleActions[me?.role];
  if (!actionCopy) {
    const fallbackRole = wolfGame ? "ساكن القرية" : "المواطن الصالح";
    const details = roleDetails[me?.role] || roleDetails[fallbackRole];
    return `<div class="game-stage"><section class="stage-hero spectator-night"><span class="mock-flag">${escapeHtml(me?.role || fallbackRole)}</span><div class="eyebrow"><span></span> الليل مستمر</div><h1>لا قرار لك هذه الليلة</h1><p>${escapeHtml(details.description)}</p></section><div class="spectator-wait">${icon("moon")}<strong>راقب وانتظر شروق النهار</strong><small>ستنتقل المرحلة تلقائياً عند انتهاء قرارات الأدوار.</small></div></div>`;
  }
  const isPredator = isPredatorRole(me?.role);
  const isHeart = me?.role === "رابطة القلوب";
  const requiredConfirmations = isPredator ? Math.max(1, state.players.filter((player) => isPredatorRole(player.role) && player.alive).length) : 1;
  const targets = state.players.filter((player) => player.id !== "me" && player.alive && (!isPredator || !isPredatorRole(player.role)));
  const selectionReady = isHeart ? state.scoutTargets.length === 2 : Boolean(state.selectedTarget);
  const targetName = isHeart ? state.scoutTargets.map((id) => state.players.find((player) => player.id === id)?.name).filter(Boolean).join("، ") : state.selectedTarget ? state.players.find((player) => player.id === state.selectedTarget)?.name : "";
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">قرار سري</span>
        <div class="eyebrow"><span></span> ${actionCopy.eyebrow}</div>
        <h1>${actionCopy.title}</h1>
        <p>${actionCopy.description}</p>
      </section>
      <div class="section-label"><h2>${actionCopy.target}</h2><span>${state.nightChoiceConfirmed ? "اختيارك مقفل" : isHeart ? `${state.scoutTargets.length} من 2` : state.selectedTarget ? "بانتظار التأكيد" : "اختر لاعباً واحداً"}</span></div>
      <div class="target-grid">
        ${targets.map((player) => `<button class="target-card ${(isHeart ? state.scoutTargets.includes(player.id) : state.selectedTarget === player.id) ? "is-selected" : ""} ${state.nightChoiceConfirmed ? "is-locked" : ""}" data-target="${player.id}" ${state.nightChoiceConfirmed ? "disabled" : ""}>${avatar(player)}<strong>${escapeHtml(player.name)}</strong><small>حيّ · متصل</small></button>`).join("")}
      </div>
      <div class="confirmation-panel ${state.nightChoiceConfirmed ? "is-complete" : ""}">
        <div class="confirmation-copy"><span class="confirmation-icon">${state.nightChoiceConfirmed ? "✓" : icon("lock")}</span><div><strong>${state.nightChoiceConfirmed ? `تم تأكيد ${escapeHtml(targetName)}` : "أكّد اختيارك النهائي"}</strong><small>${state.nightChoiceConfirmed ? "اكتمل قرار الدور؛ تنتقل المرحلة تلقائياً." : isHeart ? "اختر لاعبين اثنين بالضبط ثم أكّد الرابطة." : "لن تنتظر نهاية الوقت بعد اكتمال التأكيدات."}</small></div></div>
        <div class="confirmation-progress"><span style="--confirmed:${state.nightChoiceConfirmed ? 100 : 50}%"></span></div>
        <div class="confirmation-footer"><b>${state.nightChoiceConfirmed ? requiredConfirmations : isPredator ? Math.min(state.nightConfirmations, requiredConfirmations) : 0} من ${requiredConfirmations} أكدوا</b><button class="button button-primary" data-action="confirm-night" ${!selectionReady || state.nightChoiceConfirmed ? "disabled" : ""}>${state.nightChoiceConfirmed ? "تم التأكيد" : isHeart ? "تأكيد الرابطة" : "تأكيد الهدف"}</button></div>
      </div>
      ${isPredator ? `<div class="section-label"><h2>${wolfGame ? "عواء الذئاب" : "همس المافيا"}</h2><span>خاص ومباشر</span></div>${channelTemplate("mafia")}<div class="voice-bar">
        <div><span class="voice-visual"><i></i><i></i><i></i></span><span><strong>قناة الصوت الخاصة</strong><small>${state.voiceStatus === "connected" ? "متصلة عبر LiveKit" : "جارٍ ربط القناة السرية…"}</small></span></div>
        <button class="mic-button ${state.micOn ? "" : "is-muted"}" data-action="toggle-mic" aria-label="${state.micOn ? "كتم الميكروفون" : "تشغيل الميكروفون"}">${icon(state.micOn ? "mic" : "micOff")}</button>
      </div>${voiceParticipantsTemplate()}` : ""}
      <div class="automation-note">${icon("shield")}<p><strong>الانتقال آلي.</strong> لكل دور اختياره وزر تأكيده الخاص، ولا يستطيع المضيف اتخاذ القرار بدلاً منه.</p></div>
    </div>`;
}

function dayTemplate() {
  const queue = state.speechQueue.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
  const me = state.players.find((player) => player.id === "me");
  const isMyTurn = !state.spectator && state.speaker?.id === "me";
  const requestDisabled = state.spectator || !me?.alive || Boolean(state.speaker?.id === "me");
  const mic = micStatus();
  const micDisabled = state.spectator || !me?.alive || Boolean(state.speaker && !isMyTurn);
  const chatChannel = me?.alive || state.spectator ? "public" : "dead";
  const roleResult = state.mafiaGame?.me?.privateResult;
  const inspectedFaction = isWolfRoom() ? "ذئب" : "من المافيا";
  const roleResultCopy = !roleResult ? "" : roleResult.type === "inspect"
    ? (roleResult.shadow ? `نتيجة الكشف: اللاعب ${inspectedFaction}.` : `نتيجة الكشف: اللاعب ليس ${inspectedFaction}.`)
    : roleResult.type === "spy"
      ? (roleResult.wokeAtNight ? "عين الليل: اللاعب الذي راقبته استيقظ ليلاً." : "عين الليل: اللاعب الذي راقبته لم يستيقظ ليلاً.")
      : roleResult.type === "heart" ? "تم ربط القلبين بمصير واحد." : roleResult.type === "elder_survival" ? "نجوت من هجوم الذئاب الأول." : "";
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">صوت مباشر</span>
        <div class="eyebrow"><span></span> النقاش مفتوح</div>
        <h1>من تتهم اليوم؟</h1>
        <p>أربع دقائق للنقاش. يتوقف المؤقت تلقائياً أثناء مداخلة المتحدث، ثم يستأنف من حيث توقف.</p>
      </section>
      ${roleResultCopy ? `<div class="prototype-note"><span>نتيجة سرية</span><p><strong>${escapeHtml(roleResultCopy)}</strong> لا يراها أي لاعب آخر.</p></div>` : ""}
      <div class="section-label"><h2>مؤقت النقاش</h2><span>${state.speaker ? "متوقف أثناء المداخلة" : "يعمل الآن"}</span></div>
      <div class="discussion-timer">
        <div class="discussion-top"><strong>${state.speaker ? "المؤقت متوقف مؤقتاً" : "النقاش الحر"}</strong><span id="discussionClock">${formatTime(state.discussionRemaining)}</span></div>
        <p>${state.speaker ? "ينتقل الدور تلقائياً إلى التالي. المتحدث وحده يستطيع إنهاء مداخلته قبل انتهاء الوقت." : "أول من يطلب الكلام يبدأ فوراً، ثم يعمل الطابور تلقائياً."}</p>
        ${state.speaker ? `<div class="speaker-card">${avatar(state.speaker)}<div><strong>${escapeHtml(state.speaker.name)} يتحدث الآن</strong><small>${state.speakerIndex === 1 ? "المداخلة الأولى · دقيقتان" : "مداخلة · دقيقة واحدة"}</small></div><b class="speaker-clock" id="speakerClock">${formatTime(state.speakerRemaining)}</b></div>` : ""}
        ${state.speaker ? `<button class="self-stop ${isMyTurn ? "" : "is-locked"}" data-action="self-stop" ${isMyTurn ? "" : "disabled"}>${isMyTurn ? "إنهاء مداخلتي وتمرير الدور" : `التحكم لدى ${escapeHtml(state.speaker.name)} وحده`}</button>` : ""}
      </div>
      <div class="section-label"><h2>طابور المتحدثين</h2><span>${queue.length} في الانتظار</span></div>
      <div class="queue-list">${queue.length ? queue.map((player, index) => `<div class="queue-item">${avatar(player)}<strong>${escapeHtml(player.name)}${player.id === "me" ? " (أنت)" : ""}</strong><b>#${index + 1}</b></div>`).join("") : '<div class="queue-empty">لا أحد ينتظر الآن</div>'}</div>
      <button class="button ${state.requestedToSpeak || isMyTurn ? "button-secondary" : "button-primary"} full" data-action="request-speech" type="button" ${requestDisabled ? "disabled" : ""}>${state.spectator ? "المشاهدة فقط — لا يمكن طلب الكلام" : !me?.alive ? "بعد الإقصاء: محادثة نصية فقط" : isMyTurn ? "أنت تتحدث الآن" : state.requestedToSpeak ? "إلغاء طلبي من الطابور" : "طلب الكلام والبدء تلقائياً"}</button>
      <div class="automation-note">${icon("users")}<p><strong>طابور آلي بالكامل.</strong> لا يختار المضيف المتحدث ولا ينهي مداخلته. ينتقل الدور عند ضغط المتحدث على الإنهاء أو انتهاء وقته.</p></div>
      <section class="arena-comms">
        <div class="arena-comms-head"><div><small>${chatChannel === "dead" ? "نص فقط بعد الإقصاء" : "الصوت والنص في المكان نفسه"}</small><h2>${chatChannel === "dead" ? "مجلس الموتى" : "مجلس قِناع"}</h2></div><span class="chat-live-status status-${state.chatStatus}" id="publicChatStatus">${chatStatusLabel()}</span></div>
        ${chatChannel === "public" ? `<div class="voice-control-card ${state.micOn ? "is-live" : ""}"><span class="voice-control-icon">${icon(state.micOn ? "mic" : "micOff")}</span><div><strong>${state.speaker && !isMyTurn ? `الدور عند ${escapeHtml(state.speaker.name)}` : mic.title}</strong><small>${state.speaker && !isMyTurn ? "لا يستطيع أحد قطع مداخلته" : mic.detail}</small></div><button class="mic-control-button" data-action="toggle-mic" type="button" ${micDisabled ? "disabled" : ""}>${mic.button}</button></div>` : ""}
        ${chatChannel === "public" ? voiceParticipantsTemplate() : ""}
        ${channelTemplate(chatChannel)}
        <div class="realtime-note"><i></i><p><strong>الصوت والنص مباشران الآن.</strong> الميكروفون مطفأ افتراضياً ولا يطلب الإذن إلا بعد ضغطك على تشغيل.</p></div>
      </section>
    </div>`;
}

function defenseTemplate() {
  const candidate = state.players.find((player) => player.id === state.defenseCandidates[state.defenseIndex]);
  if (!candidate) return '<div class="empty-state"><h2>انتهت الدفاعات</h2><p>تبدأ إعادة التصويت الآن.</p></div>';
  const isMyDefense = !state.spectator && candidate.id === "me";
  return `
    <div class="game-stage">
      <section class="stage-hero defense-hero">
        <span class="mock-flag">تعادل في الأصوات</span>
        <div class="eyebrow"><span></span> دفاع ${state.defenseIndex + 1} من ${state.defenseCandidates.length}</div>
        <h1>الدور عند ${escapeHtml(candidate.name)}</h1>
        <p>تسعون ثانية كحد أقصى. لا يوجد طابور كلام في هذه المرحلة، ولا يُسمح بالكلام صوتياً إلا لصاحب الدفاع.</p>
      </section>
      <div class="defense-order">
        ${state.defenseCandidates.map((id, index) => {
          const player = state.players.find((item) => item.id === id);
          const status = index < state.defenseIndex ? "اكتمل" : index === state.defenseIndex ? "يدافع الآن" : "التالي";
          return `<div class="defense-chip ${index === state.defenseIndex ? "is-active" : ""} ${index < state.defenseIndex ? "is-done" : ""}">${avatar(player)}<span><strong>${escapeHtml(player.name)}</strong><small>${status}</small></span></div>`;
        }).join("")}
      </div>
      <div class="defense-chamber">
        <div class="defense-person">${avatar(candidate)}<div><small>صاحب الدفاع</small><strong>${escapeHtml(candidate.name)}</strong></div><b id="defenseClock">${formatTime(state.defenseRemaining)}</b></div>
        <div class="defense-voice ${state.defenseStarted ? "is-live" : ""}">${icon(state.defenseStarted ? "mic" : "micOff")}<div><strong>${state.defenseStarted ? "الدفاع جارٍ الآن" : "لم يبدأ الدفاع بعد"}</strong><small>${isMyDefense ? "أنت وحدك تتحكم في الميكروفون والإنهاء" : `التحكم لدى ${escapeHtml(candidate.name)} وحده`}</small></div></div>
        ${voiceParticipantsTemplate()}
        ${isMyDefense ? `<button class="button button-primary full" data-action="${state.defenseStarted ? "finish-defense" : "begin-defense"}">${state.defenseStarted ? "إنهاء دفاعي" : "بدء دفاعي"}</button>` : `<div class="defense-readonly">${state.defenseStarted ? `بدأ ${escapeHtml(candidate.name)} دفاعه. لا يمكن للمضيف أو أي لاعب آخر إيقافه.` : `ننتظر ${escapeHtml(candidate.name)} ليبدأ دفاعه.`}</div>`}
      </div>
      <div class="automation-note">${icon("shield")}<p><strong>لا طابور ولا تدخل من المضيف.</strong> بعد انتهاء دفاع جميع المتعادلين تبدأ إعادة التصويت تلقائياً.</p></div>
    </div>`;
}

function voteTemplate() {
  const candidateIds = state.voteRound > 1 && state.revoteCandidates.length
    ? state.revoteCandidates
    : state.players.filter((player) => player.alive).map((player) => player.id);
  const candidates = candidateIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
  const totalVotes = Object.values(state.votes).reduce((sum, value) => sum + value, 0) || 1;
  const aliveCount = state.players.filter((player) => player.alive).length;
  const confirmationPercent = Math.round((state.voteConfirmations / Math.max(1, aliveCount)) * 100);
  const result = getVoteResult();
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">تفاعل محلي</span>
        <div class="eyebrow"><span></span> ${state.voteRound > 1 ? "الإعادة الحاسمة" : "قرار اللاعبين"}</div>
        <h1>${state.voteClosed ? "أُغلق صندوق التصويت" : "صوّت قبل انتهاء الوقت"}</h1>
        <p>تظهر الأعداد مباشرة للجميع، بينما تبقى أسماء المصوّتين مخفية حتى إغلاق الصندوق.</p>
      </section>
      <div class="section-label"><h2>المرشحون</h2><span id="voteClock">${formatTime(state.voteRemaining)}</span></div>
      <div class="vote-grid">
        ${candidates.map((player) => {
          const count = state.votes[player.id] || 0;
          const percent = Math.round((count / totalVotes) * 100);
          return `<button class="vote-row ${state.myVote === player.id ? "is-my-vote" : ""} ${state.voteConfirmed ? "is-locked" : ""}" style="--vote-width:${percent}%" data-vote="${player.id}" ${state.spectator || state.voteClosed || state.voteConfirmed || player.id === "me" ? "disabled" : ""}>${avatar(player, player.bot ? "is-bot" : "")}<div><strong>${escapeHtml(player.name)}${player.id === "me" ? " · أنت" : ""}</strong><small>${state.voteClosed && state.revealVoters ? voteIdentities(player.id) : player.id === "me" ? "لا يمكنك التصويت لنفسك" : state.voteConfirmed && state.myVote === player.id ? "تم تأكيد صوتك" : "هويات المصوّتين مخفية"}</small></div><b class="vote-count">${count} ${count === 1 ? "صوت" : "أصوات"}</b></button>`;
        }).join("")}
      </div>
      <p class="vote-note">${state.voteClosed ? "أُغلق الصندوق وكُشفت هويات المصوّتين." : state.spectator ? "ترى عدد الأصوات مباشرة، لكن المشاهدة لا تسمح لك بالتصويت." : "يمكنك تغيير اختيارك قبل التأكيد. بعد التأكيد يصبح صوتك نهائياً."}</p>
      ${!state.spectator && !state.voteClosed ? `<div class="confirmation-panel ${state.voteConfirmed ? "is-complete" : ""}"><div class="confirmation-copy"><span class="confirmation-icon">${state.voteConfirmed ? "✓" : icon("vote")}</span><div><strong>${state.voteConfirmed ? "تم تأكيد صوتك" : state.myVote ? `اختيارك: ${escapeHtml(state.players.find((p) => p.id === state.myVote)?.name || "")}` : "اختر مرشحاً ثم أكّد"}</strong><small>${state.voteConfirmed ? "اكتملت التأكيدات؛ يُغلق الصندوق تلقائياً." : `${state.voteConfirmations} لاعبين أكدوا. لن ننتظر نهاية الوقت بعد تأكيدك.`}</small></div></div><div class="confirmation-progress"><span style="--confirmed:${state.voteConfirmed ? 100 : confirmationPercent}%"></span></div><div class="confirmation-footer"><b>${state.voteConfirmed ? aliveCount : state.voteConfirmations} من ${aliveCount} أكدوا</b><button class="button button-primary" data-action="confirm-vote" ${!state.myVote || state.voteConfirmed ? "disabled" : ""}>${state.voteConfirmed ? "تم التأكيد" : "تأكيد صوتي"}</button></div></div>` : ""}
      ${state.voteClosed ? resultTemplate(result) : ""}
      <div class="automation-note">${icon("shield")}<p><strong>لا إغلاق يدوي للصندوق.</strong> يُغلق تلقائياً عند تأكيد الجميع أو انتهاء الـ60 ثانية.</p></div>
    </div>`;
}

function resultTemplate(result) {
  if (!result.ids.length) return `<div class="prototype-note"><span>لا إقصاء</span><p>لم يُسجّل أي صوت، لذلك تبدأ الليلة التالية من دون إقصاء.</p></div>`;
  if (result.tie) {
    if (state.voteRound >= 2) {
      return `<div class="prototype-note"><span>لا إقصاء</span><p><strong>استمر التعادل بعد الإعادة.</strong> أُلغيت النتيجة، وسيبدأ الليل التالي تلقائياً.</p></div>`;
    }
    return `<div class="prototype-note"><span>تعادل</span><p>تعادل ${result.names.join(" و")} في عدد الأصوات. لكل واحد دفاع منفرد حتى 90 ثانية، ثم تبدأ إعادة التصويت تلقائياً.</p></div>`;
  }
  return `<div class="prototype-note"><span>تم الإقصاء</span><p><strong>${escapeHtml(result.names[0])}</strong> حصل على أعلى عدد من الأصوات وأُقصي مباشرةً. لا توجد مرحلة دفاع عند غياب التعادل.</p></div>`;
}

function playersTemplate() {
  const me = state.players.find((player) => player.id === "me");
  return `
    <div class="section-label" style="padding:0 1.1rem"><h2>اللاعبون</h2><span>${state.players.filter((player) => player.alive).length} أحياء</span></div>
    <div class="roster-grid">
      ${state.players.map((player) => `<div class="roster-card ${player.alive ? "" : "is-dead"} ${player.bot || (player.id === "me" && state.botActive) ? "is-bot" : ""}">${avatar(player, player.bot ? "is-bot" : "")}<div><strong>${escapeHtml(player.name)}${player.host ? " · مضيف" : ""}</strong><small>${player.alive ? player.bot ? "روبوت · ينفذ دوره ويصوّت تلقائياً" : player.id === "me" && state.botActive ? "الروبوت يلعب مؤقتاً" : "حيّ · متصل" : "مُقصى · نص فقط"}</small></div></div>`).join("")}
    </div>
    ${state.spectator || !me?.host ? "" : `<div class="game-stage">
      <div class="host-controls">
        <div class="host-controls-head"><strong>إدارة الجولة</strong><span>أدوات المضيف مستمرة بعد الإقصاء</span></div>
        <div class="host-controls-actions">
          <button class="small-button danger" data-action="end-round">إنهاء الجولة وحذف رسائلها</button>
        </div>
      </div>
    </div>`}`;
}

function historyTemplate() {
  const items = [...state.history].reverse();
  return `<div class="section-label" style="padding:0 1.1rem"><h2>سجل التصويت</h2><span>الهويات تظهر بعد الإغلاق</span></div><div class="history-list">${items.map((entry) => `<article class="history-item"><header><strong>${escapeHtml(entry.title)}</strong><span>${entry.round ? `الجولة ${entry.round}` : "نموذج"}</span></header><p>${escapeHtml(entry.result)}</p><div class="voters">${entry.voters.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></article>`).join("")}</div>`;
}

function channelTemplate(channel) {
  const isPublic = channel === "public";
  const title = isPublic ? "المحادثة العامة" : channel === "mafia" ? "قناة سرية" : "محادثة الموتى";
  const readOnly = isPublic && state.spectator;
  return `<div class="mafia-channel ${isPublic ? "public-channel" : ""}"><div class="channel-head"><div>${icon(isPublic ? "chat" : channel === "mafia" ? "lock" : "skull")}<strong>${title}</strong></div><span class="channel-mode">${readOnly ? "قراءة فقط" : "محفوظ في الجولة"}</span></div><div class="messages" id="messageList-${channel}">${messageMarkup(channel)}</div>${readOnly ? '<div class="chat-readonly">يمكنك متابعة المحادثة بلا حساب. أنشئ حساب لاعب لتشارك.</div>' : `<form class="chat-compose" data-chat-form="${channel}"><input name="message" value="${escapeHtml(chatDrafts[channel] || "")}" maxlength="${isPublic ? 180 : 120}" placeholder="اكتب رسالة قصيرة…" autocomplete="off" aria-label="رسالة"><button type="submit" aria-label="إرسال">${icon("send")}</button></form>`}</div>`;
}

function messageMarkup(channel) {
  return (state.messages[channel] || []).map((message) => `<div class="message ${message.mine ? "mine" : ""}">${avatar(message)}<div class="message-bubble"><b>${escapeHtml(message.sender || "لاعب")}</b>${escapeHtml(message.body)}<small>${escapeHtml(message.time)}</small></div></div>`).join("");
}

function chatStatusLabel() {
  if (state.chatStatus === "connected") return "متصل الآن";
  if (state.chatStatus === "connecting") return "جارٍ الاتصال…";
  return "إعادة الاتصال…";
}

function formatChatTime(value) {
  try {
    return new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch (_) {
    return "الآن";
  }
}

function normalizeChatMessage(message) {
  return {
    ...message,
    sender: message.sender || "لاعب",
    initial: message.initial || (message.sender || "ل").charAt(0),
    accent: message.accent || "a3",
    time: formatChatTime(message.time),
    mine: message.userId === state.account?.id,
  };
}

function refreshPublicChat() {
  ["public", "mafia", "dead"].forEach((channel) => {
    const list = $(`#messageList-${channel}`);
    if (list) {
      list.innerHTML = messageMarkup(channel);
      list.scrollTop = list.scrollHeight;
    }
  });
  const status = $("#publicChatStatus");
  if (status) {
    status.className = `chat-live-status status-${state.chatStatus}`;
    status.textContent = chatStatusLabel();
  }
}

function getVoteResult() {
  const countedVotes = Object.entries(state.votes).filter(([, count]) => count > 0);
  if (!countedVotes.length) return { tie: true, names: [], ids: [] };
  const max = Math.max(...countedVotes.map(([, count]) => count));
  const leaderIds = countedVotes.filter(([, count]) => count === max).map(([id]) => id);
  return { tie: leaderIds.length > 1, names: leaderIds.map((id) => state.players.find((p) => p.id === id)?.name || id), ids: leaderIds };
}

function voteIdentities(candidateId) {
  return (state.voteVoters[candidateId] || []).join("، ") || "لا أحد";
}

function deterministicIndex(seed, length) {
  let hash = 0;
  for (const character of seed) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % Math.max(1, length);
}

function scheduleBotVotes() {
  const key = `${state.round}:${state.voteRound}`;
  if (scheduledBotVoteKey === key) return;
  scheduledBotVoteKey = key;
  const bots = state.players.filter((player) => player.alive && player.bot);
  bots.forEach((bot, index) => {
    window.setTimeout(() => {
      if (state.phase !== "vote" || state.voteClosed || `${state.round}:${state.voteRound}` !== key) return;
      const allowedIds = state.voteRound > 1 && state.revoteCandidates.length
        ? state.revoteCandidates.filter((id) => id !== bot.id)
        : state.players.filter((player) => player.alive && player.id !== bot.id).map((player) => player.id);
      if (!allowedIds.length) return;
      const targetId = allowedIds[deterministicIndex(`${bot.rawId || bot.id}:${key}`, allowedIds.length)];
      state.votes[targetId] = (state.votes[targetId] || 0) + 1;
      state.voteVoters[targetId] = [...(state.voteVoters[targetId] || []), bot.name];
      state.voteConfirmations = Math.min(state.players.filter((player) => player.alive).length, state.voteConfirmations + 1);
      renderGame();
      if (state.voteConfirmations >= state.players.filter((player) => player.alive).length) window.setTimeout(closeVote, 400);
    }, 650 + index * 420);
  });
}

function closeVote() {
  if (state.voteClosed) return;
  if (!state.voteConfirmed) state.myVote = null;
  state.voteClosed = true;
  state.revealVoters = true;
  state.phaseRemaining = state.voteRemaining;
  const result = getVoteResult();
  if (!result.tie) {
    const eliminated = state.players.find((player) => player.id === result.ids[0]);
    if (eliminated) eliminated.alive = false;
  } else if (state.voteRound === 1 && result.ids.length) {
    state.revoteCandidates = [...result.ids];
  }
  state.history.push({
    round: state.round,
    title: state.voteRound > 1 ? "إعادة التصويت" : "التصويت العام",
    result: !result.ids.length ? "لم يُسجّل أي صوت؛ لا إقصاء." : result.tie ? (state.voteRound > 1 ? "استمر التعادل؛ لا إقصاء." : "تعادل؛ دفاع منفرد لكل مرشح ثم إعادة.") : `${result.names[0]} أُقصي مباشرةً بأعلى الأصوات.`,
    voters: Object.entries(state.voteVoters).flatMap(([candidateId, voters]) => voters.map((voter) => `${voter} ← ${state.players.find((player) => player.id === candidateId)?.name || candidateId}`)),
    tie: result.tie,
  });
  showToast("أُغلق التصويت وكُشفت هويات المصوّتين");
  renderGame();
  if (result.tie && result.ids.length && state.voteRound === 1) {
    window.setTimeout(() => startTieDefense(result.ids), 1100);
  } else {
    window.setTimeout(() => goToNextNight(), 1900);
  }
}

function startTieDefense(candidateIds) {
  if (state.phase !== "vote" || !state.voteClosed) return;
  state.phase = "defense";
  state.phaseSeconds = 90;
  state.phaseRemaining = 90;
  state.defenseCandidates = [...candidateIds];
  state.defenseIndex = 0;
  state.defenseRemaining = 90;
  state.speaker = null;
  state.speechQueue = [];
  state.requestedToSpeak = false;
  state.micOn = false;
  releaseMicrophone();
  state.currentTab = "arena";
  const first = state.players.find((player) => player.id === state.defenseCandidates[0]);
  state.defenseStarted = first?.id !== "me";
  showToast(`بدأ دفاع ${first?.name || "المرشح الأول"} — 90 ثانية كحد أقصى`);
  renderGame();
}

function completeDefenseTurn(fromTimer = false) {
  const finished = state.players.find((player) => player.id === state.defenseCandidates[state.defenseIndex]);
  if (finished?.id === "me") releaseMicrophone();
  state.defenseIndex += 1;
  if (state.defenseIndex < state.defenseCandidates.length) {
    const next = state.players.find((player) => player.id === state.defenseCandidates[state.defenseIndex]);
    state.defenseRemaining = 90;
    state.phaseRemaining = 90;
    state.defenseStarted = next?.id !== "me";
    state.micOn = false;
    showToast(`${fromTimer ? `انتهى وقت ${finished?.name || "الدفاع"}` : "انتهى الدفاع"} — الدور عند ${next?.name || "المرشح التالي"}`);
    renderGame();
    return;
  }
  state.voteRound = 2;
  startVote(true);
  scheduleBotVotes();
  showToast("انتهت الدفاعات — بدأت إعادة التصويت تلقائياً");
  renderGame();
}

function goToNextNight() {
  if (state.phase !== "vote" || !state.voteClosed) return;
  state.round += 1;
  state.voteRound = 1;
  resetForNight();
  showToast("بدأت الليلة التالية");
  renderGame();
  void beginNightNarration();
}

function startNextSpeaker() {
  if (state.speaker || !state.speechQueue.length) return;
  const nextId = state.speechQueue.shift();
  state.speakerIndex += 1;
  state.speaker = state.players.find((player) => player.id === nextId);
  if (!state.speaker) return startNextSpeaker();
  state.speakerRemaining = state.speakerIndex === 1 ? 120 : 60;
  state.phaseRemaining = state.speakerRemaining;
  state.micOn = false;
  showToast(state.speakerIndex === 1 ? "بدأت أول مداخلة — دقيقتان" : "بدأت المداخلة — دقيقة واحدة");
  renderGame();
}

function finishCurrentSpeech(fromTimer = false) {
  if (!state.speaker) return;
  const finished = state.speaker;
  if (finished.id === "me") releaseMicrophone();
  if (finished.id === "me") state.requestedToSpeak = false;
  state.speaker = null;
  state.speakerRemaining = 0;
  state.micOn = false;
  if (state.speechQueue.length) {
    showToast(fromTimer ? `انتهى وقت ${finished.name} — انتقل الدور تلقائياً` : "انتهت مداخلتك — انتقل الدور تلقائياً");
    startNextSpeaker();
  } else {
    state.phaseRemaining = state.discussionRemaining;
    showToast(fromTimer ? "انتهت المداخلة — استؤنف مؤقت النقاش" : "انتهت مداخلتك — استؤنف النقاش الحر");
    renderGame();
  }
}

async function handleGameAction(action, target) {
  if (state.spectator && ["toggle-mic", "request-speech", "self-stop", "confirm-night", "confirm-vote", "begin-defense", "finish-defense", "toggle-death", "toggle-connection"].includes(action)) {
    showToast("وضع المشاهدة للمتابعة فقط");
    return;
  }
  if (action === "leave-room") {
    await leaveCurrentRoom();
    return;
  } else if (["witch-save", "witch-poison", "witch-pass"].includes(action)) {
    const mode = action.replace("witch-", "");
    const selected = state.selectedTarget ? (state.players.find((player) => player.id === state.selectedTarget)?.rawId || state.selectedTarget) : null;
    try {
      await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/night`, { method: "POST", body: JSON.stringify({ mode, targetUserId: mode === "poison" ? selected : null }) });
      await loadMafiaState();
      renderGame();
      showToast(mode === "save" ? "استُعملت جرعة الإنقاذ" : mode === "poison" ? "استُعملت جرعة الإقصاء" : "مرّرت الساحرة دورها");
    } catch (error) { showToast(error.message); }
    return;
  } else if (action === "toggle-mic") {
    await toggleMicrophonePermission();
    return;
  } else if (action === "start-audio") {
    try {
      await syncVoiceRoom(true);
      await liveKitVoice.startAudio();
      showToast("تم تشغيل صوت الغرفة");
    } catch (error) { showToast(error.message || "تعذر تشغيل الصوت"); }
    return;
  } else if (action === "request-speech") {
    if (state.mafiaGame) {
      try {
        await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/speech`, { method: "POST", body: JSON.stringify({ action: "request" }) });
        state.requestedToSpeak = true;
        await loadMafiaState();
        renderGame();
      } catch (error) { showToast(error.message); }
      return;
    }
    if (state.speaker?.id === "me") return;
    state.requestedToSpeak = !state.requestedToSpeak;
    if (state.requestedToSpeak) {
      if (!state.speechQueue.includes("me")) state.speechQueue.push("me");
      if (!state.speaker) startNextSpeaker();
      if (state.speaker?.id === "me" && !state.micOn) await toggleMicrophonePermission();
      window.setTimeout(() => {
        if (state.phase !== "day") return;
        ["layan", "youssef"].forEach((id) => {
          if (state.speaker?.id !== id && !state.speechQueue.includes(id)) state.speechQueue.push(id);
        });
        if (state.route === "game" && state.currentTab === "arena") renderGame();
      }, 450);
      return;
    } else {
      state.speechQueue = state.speechQueue.filter((id) => id !== "me");
    }
  } else if (action === "self-stop") {
    if (state.speaker?.id !== "me") return;
    if (state.mafiaGame) {
      try {
        await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/speech`, { method: "POST", body: JSON.stringify({ action: "end" }) });
        releaseMicrophone();
        await loadMafiaState();
        renderGame();
      } catch (error) { showToast(error.message); }
      return;
    }
    finishCurrentSpeech(false);
    return;
  } else if (action === "confirm-night") {
    const me = state.players.find((player) => player.id === "me");
    const isHeart = me?.role === "رابطة القلوب";
    const choiceReady = isHeart ? state.scoutTargets.length === 2 : Boolean(state.selectedTarget);
    if (!choiceReady || state.nightChoiceConfirmed) return;
    if (state.mafiaGame) {
      try {
        const targetUserId = state.selectedTarget ? (state.players.find((player) => player.id === state.selectedTarget)?.rawId || state.selectedTarget) : null;
        const targetUserIds = state.scoutTargets.map((id) => state.players.find((player) => player.id === id)?.rawId || id);
        await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/night`, { method: "POST", body: JSON.stringify({ targetUserId, targetUserIds }) });
        await loadMafiaState();
        renderGame();
        showToast("تم تأكيد قرارك — ننتظر بقية الأدوار");
      } catch (error) { showToast(error.message); }
      return;
    }
    const requiredConfirmations = isPredatorRole(me?.role) ? Math.max(1, state.players.filter((player) => isPredatorRole(player.role) && player.alive).length) : 1;
    state.nightChoiceConfirmed = true;
    state.nightConfirmations = requiredConfirmations;
    nightAudioTransition = true;
    renderGame();
    showToast("اكتمل قرار دورك — ننتظر بقية الأدوار");
    void (async () => {
      const sleepCuePlayed = await gameAudio.playRoleSleep(me?.role);
      if (!sleepCuePlayed) await new Promise((resolve) => window.setTimeout(resolve, isScout ? 2600 : 650));
      if (state.phase !== "night" || !state.nightChoiceConfirmed) return;
      beginDayWithNarration();
    })();
    return;
  } else if (action === "confirm-vote") {
    if (!state.myVote || state.voteConfirmed || state.voteClosed) return;
    if (state.mafiaGame) {
      try {
        const targetUserId = state.players.find((player) => player.id === state.myVote)?.rawId || state.myVote;
        await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/vote`, { method: "POST", body: JSON.stringify({ targetUserId }) });
        await loadMafiaState();
        renderGame();
        showToast("تم تأكيد صوتك نهائياً");
      } catch (error) { showToast(error.message); }
      return;
    }
    state.voteConfirmed = true;
    state.votes[state.myVote] = (state.votes[state.myVote] || 0) + 1;
    const voterName = state.players.find((player) => player.id === "me")?.name || "أنت";
    state.voteVoters[state.myVote] = [...(state.voteVoters[state.myVote] || []), voterName];
    const aliveCount = state.players.filter((player) => player.alive).length;
    state.voteConfirmations = Math.min(aliveCount, state.voteConfirmations + 1);
    renderGame();
    if (state.voteConfirmations >= aliveCount) {
      showToast("أكد الجميع أصواتهم — يُغلق الصندوق الآن");
      window.setTimeout(() => { if (!state.voteClosed && state.voteConfirmed) closeVote(); }, 650);
    } else {
      showToast("تم تأكيد صوتك — ننتظر بقية اللاعبين");
    }
    return;
  } else if (action === "begin-defense") {
    const candidateId = state.defenseCandidates[state.defenseIndex];
    if (candidateId !== "me" || state.defenseStarted) return;
    state.defenseStarted = true;
    state.micOn = false;
    showToast("بدأ دفاعك — لديك 90 ثانية كحد أقصى");
    await toggleMicrophonePermission();
  } else if (action === "finish-defense") {
    const candidateId = state.defenseCandidates[state.defenseIndex];
    if (candidateId !== "me" || !state.defenseStarted) return;
    releaseMicrophone();
    if (state.mafiaGame) {
      try {
        await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/mafia/defense`, { method: "POST", body: "{}" });
        await loadMafiaState();
        renderGame();
      } catch (error) { showToast(error.message); }
    } else completeDefenseTurn(false);
    return;
  } else if (action === "end-round") {
    try {
      await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/end`, { method: "POST" });
      state.messages = { public: [], mafia: [], dead: [] };
      await liveKitVoice.disconnect();
      roomChat.disconnect();
      navigate("home", { replace: true });
      await loadRooms();
      showToast("انتهت الجولة وحُذفت رسائلها");
    } catch (error) { showToast(error.message); }
    return;
  } else if (action === "next-night") {
    if (state.mafiaGame) return;
    goToNextNight();
    return;
  }
  renderGame();
}

async function handleImposterAction(action) {
  try {
    if (action === "reveal-role") {
      state.imposterRoleRevealed = true;
      renderGame();
      return;
    }
    if (action === "ready") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/ready`, { method: "POST" });
    else if (action === "question-done") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/turn`, { method: "POST", body: JSON.stringify({ action: "question_done" }) });
    else if (action === "answer-done") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/turn`, { method: "POST", body: JSON.stringify({ action: "answer_done" }) });
    else if (action === "confirm-vote") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/vote`, { method: "POST", body: JSON.stringify({ selections: state.imposterVoteSelections }) });
    else if (action === "confirm-word") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/word`, { method: "POST", body: JSON.stringify({ word: state.imposterWordChoice }) });
    else if (action === "next-round") await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/imposter/next`, { method: "POST", body: "{}" });
    await loadImposterState();
    renderGame();
  } catch (error) {
    showToast(error.message);
  }
}

async function handleBluffAction(action) {
  const base = `/api/rooms/${encodeURIComponent(activeRoomCode())}/bluff`;
  try {
    if (action === "play") {
      await apiRequest(`${base}/play`, { method: "POST", body: JSON.stringify({ cardId: state.bluffSelectedCard, targetUserId: state.bluffSelectedTarget, claim: state.bluffSelectedClaim }) });
    } else if (action === "peek") {
      await apiRequest(`${base}/peek`, { method: "POST", body: "{}" });
    } else if (action === "pass") {
      await apiRequest(`${base}/pass`, { method: "POST", body: JSON.stringify({ targetUserId: state.bluffSelectedTarget, claim: state.bluffSelectedClaim }) });
    } else if (action === "answer-true" || action === "answer-false") {
      await apiRequest(`${base}/answer`, { method: "POST", body: JSON.stringify({ answer: action === "answer-true" }) });
    }
    state.bluffSelectedCard = null;
    state.bluffSelectedTarget = null;
    state.bluffSelectedClaim = null;
    await loadBluffState();
    renderGame();
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("#headerBackButton")) {
      goBackFromHeader();
      return;
    }
    const bluffCard = event.target.closest("[data-bluff-card]");
    if (bluffCard) {
      state.bluffSelectedCard = bluffCard.dataset.bluffCard;
      renderGame();
      return;
    }
    const bluffTarget = event.target.closest("[data-bluff-target]");
    if (bluffTarget) {
      state.bluffSelectedTarget = bluffTarget.dataset.bluffTarget;
      renderGame();
      return;
    }
    const bluffClaim = event.target.closest("[data-bluff-claim]");
    if (bluffClaim) {
      state.bluffSelectedClaim = bluffClaim.dataset.bluffClaim;
      renderGame();
      return;
    }
    const bluffActionButton = event.target.closest("[data-bluff-action]");
    if (bluffActionButton && !bluffActionButton.disabled) {
      handleBluffAction(bluffActionButton.dataset.bluffAction);
      return;
    }
    const gameChoice = event.target.closest("[data-open-game]");
    if (gameChoice) {
      state.selectedGameType = gameChoice.dataset.openGame;
      navigate("game-landing");
      return;
    }
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      const route = routeButton.dataset.route;
      if (route === "lobby") requireAccount(() => {
        if (!activeRoomCode()) return showToast("اختر غرفة أو أنشئ غرفة أولاً");
        state.spectator = false;
        navigate("lobby");
      });
      else navigate(route);
    }

    const watchButton = event.target.closest("[data-watch-room]");
    if (watchButton) watchRoom(watchButton.dataset.watchRoom).catch((error) => showToast(error.message));

    const joinButton = event.target.closest("[data-join-room]");
    if (joinButton && !joinButton.disabled) requireAccount(() => joinRoomAsPlayer(joinButton.dataset.joinRoom).catch((error) => showToast(error.message)));

    if (event.target.closest("[data-login-open]")) { closeDrawer(); openAccountDialog(null, "login"); }
    if (event.target.closest("[data-profile-edit]")) {
      closeDrawer();
      if (state.account?.profileComplete === false) openAccountDialog(null, "social-complete");
      else navigate("profile");
    }
    if (event.target.closest("[data-logout]")) {
      apiRequest("/api/auth/logout", { method: "POST" }).then(() => {
        setAccount(null);
        closeDrawer();
        if (state.route === "profile") navigate("home", { replace: true });
        showToast("تم تسجيل الخروج");
      }).catch((error) => showToast(error.message));
    }

    const authMode = event.target.closest("[data-auth-mode]");
    if (authMode) showAuthMode(authMode.dataset.authMode);

    const avatarChoice = event.target.closest("[data-profile-avatar]");
    if (avatarChoice) {
      selectedProfileAvatar = avatarChoice.dataset.profileAvatar;
      $$("[data-profile-avatar]").forEach((button) => {
        const selected = button.dataset.profileAvatar === selectedProfileAvatar;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-checked", String(selected));
      });
      $("#profileAvatarPreview").innerHTML = profileAvatar({ avatarType: "preset", avatarValue: selectedProfileAvatar }, "profile-page-avatar");
    }

    const tabButton = event.target.closest("[data-game-tab]");
    if (tabButton) {
      state.currentTab = tabButton.dataset.gameTab;
      renderGame();
    }

    const targetButton = event.target.closest("[data-target]");
    if (targetButton && !state.spectator && !state.nightChoiceConfirmed) {
      const me = state.players.find((player) => player.id === "me");
      if (me?.role === "رابطة القلوب") {
        const targetId = targetButton.dataset.target;
        if (state.scoutTargets.includes(targetId)) state.scoutTargets = state.scoutTargets.filter((id) => id !== targetId);
        else if (state.scoutTargets.length < 2) state.scoutTargets.push(targetId);
        else showToast("يمكن ربط لاعبين اثنين فقط");
        if (state.scoutTargets.length < 2) showToast(`اختير ${state.scoutTargets.length} من 2`);
        else showToast("اكتمل القلبان — أكّد الرابطة");
      } else {
        state.selectedTarget = targetButton.dataset.target;
        showToast(`اختيار مبدئي: ${state.players.find((p) => p.id === state.selectedTarget).name} — أكّد للمتابعة`);
      }
      renderGame();
    }

    const voteButton = event.target.closest("[data-vote]");
    if (voteButton && !state.spectator && !state.voteClosed && !state.voteConfirmed) {
      state.myVote = voteButton.dataset.vote;
      renderGame();
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleGameAction(actionButton.dataset.action, actionButton);

    const imposterVote = event.target.closest("[data-imposter-vote]");
    if (imposterVote && !state.imposterGame?.me?.voteConfirmed) {
      const userId = imposterVote.dataset.imposterVote;
      const selected = state.imposterVoteSelections;
      if (selected.includes(userId)) state.imposterVoteSelections = selected.filter((id) => id !== userId);
      else if (selected.length < Number(state.imposterGame?.imposterCount || 1)) state.imposterVoteSelections = [...selected, userId];
      else showToast(`يمكنك اختيار ${state.imposterGame?.imposterCount || 1} فقط`);
      renderGame();
    }

    const imposterWord = event.target.closest("[data-imposter-word]");
    if (imposterWord && !state.imposterGame?.me?.wordConfirmed) {
      state.imposterWordChoice = imposterWord.dataset.imposterWord;
      renderGame();
    }

    const imposterAction = event.target.closest("[data-imposter-action]");
    if (imposterAction) handleImposterAction(imposterAction.dataset.imposterAction);
  });

  $("#menuButton").addEventListener("click", openDrawer);
  $("#closeMenuButton").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", closeDrawer);
  $("#leaveLobbyButton").addEventListener("click", leaveCurrentRoom);
  $("#leaveGameButton").addEventListener("click", leaveCurrentRoom);
  $("#closeAccountDialog").addEventListener("click", () => {
    pendingAccountAction = null;
    $("#accountDialog").close();
  });
  $("#accountBirthMonth").addEventListener("change", () => syncBirthDays());
  $("#accountBirthYear").addEventListener("change", () => syncBirthDays());
  $("#profileBirthMonth").addEventListener("change", () => syncProfileBirthDays());
  $("#profileBirthYear").addEventListener("change", () => syncProfileBirthDays());
  $("#accountForm").addEventListener("input", () => { $("#accountError").textContent = ""; });
  $("#accountForm").addEventListener("focusout", (event) => {
    const message = validateAccountField(event.target);
    if (message) $("#accountError").textContent = message;
  });
  $("#loginForm").addEventListener("input", () => { $("#loginError").textContent = ""; });

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#loginError").textContent = "";
    const identity = $("#loginIdentity").value.trim();
    const password = $("#loginPassword").value;
    if (!identity) {
      $("#loginError").textContent = "اكتب البريد الإلكتروني أو اسم المستخدم.";
      $("#loginIdentity").focus();
      return;
    }
    if (!password) {
      $("#loginError").textContent = "اكتب كلمة المرور.";
      $("#loginPassword").focus();
      return;
    }
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;
    try {
      const data = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ login: identity, password }) });
      setAccount(data.user);
      $("#accountDialog").close();
      showToast("مرحباً بعودتك");
      const action = pendingAccountAction;
      pendingAccountAction = null;
      if (action) await action();
    } catch (error) {
      $("#loginError").textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("#accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const completingSocial = currentAuthMode === "social-complete";
    const wasEditing = currentAuthMode === "profile";
    const formData = accountFormData();
    const error = validateAccountData(formData);
    if (error) {
      $("#accountError").textContent = error;
      return;
    }
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;
    try {
      const endpoint = completingSocial ? "/api/auth/complete-profile" : state.account ? "/api/profile" : "/api/auth/register";
      const method = completingSocial ? "POST" : state.account ? "PATCH" : "POST";
      const data = await apiRequest(endpoint, { method, body: JSON.stringify({ displayName: formData.displayName, username: formData.username, email: formData.email, birthDate: formData.birthDate, password: formData.password }) });
      setAccount(data.user);
      $("#accountDialog").close();
      renderLobby();
      showToast(wasEditing ? "تم حفظ الملف الشخصي" : completingSocial ? "اكتمل حسابك، مرحباً بك" : "تم إنشاء الحساب");
      const action = pendingAccountAction;
      pendingAccountAction = null;
      if (action) await action();
    } catch (apiError) {
      $("#accountError").textContent = apiError.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayName = $("#profileNameInput").value.trim();
    const username = $("#profileUsernameInput").value.trim();
    const day = $("#profileBirthDay").value;
    const month = $("#profileBirthMonth").value;
    const year = $("#profileBirthYear").value;
    const birthDate = day && month && year ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
    const currentPassword = $("#profileCurrentPassword").value;
    const newPassword = $("#profileNewPassword").value;
    const confirmPassword = $("#profileConfirmPassword").value;
    let error = "";
    if (displayName.length < 2) error = "اكتب اسماً ظاهراً من حرفين على الأقل.";
    else if (!/^[\p{L}\p{N}._-]{3,24}$/u.test(username)) error = "اسم المستخدم غير صالح.";
    else {
      const parsed = birthDate ? new Date(`${birthDate}T00:00:00`) : null;
      const validDate = parsed && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(year) && parsed.getMonth() + 1 === Number(month) && parsed.getDate() === Number(day);
      if (!validDate || birthDate >= new Date().toISOString().slice(0, 10)) error = "اختر تاريخ ميلاد صحيحاً.";
    }
    if (!error && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword) error = "اكتب كلمة المرور الحالية أولاً.";
      else if (newPassword.length < 8) error = "كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.";
      else if (newPassword !== confirmPassword) error = "تأكيد كلمة المرور الجديدة غير مطابق.";
    }
    if (error) {
      $("#profileError").textContent = error;
      return;
    }
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;
    try {
      const data = await apiRequest("/api/profile", { method: "PATCH", body: JSON.stringify({ displayName, username, birthDate, avatarValue: selectedProfileAvatar, currentPassword, newPassword }) });
      setAccount(data.user);
      renderProfilePage();
      showToast("تم حفظ الملف الشخصي");
    } catch (apiError) {
      $("#profileError").textContent = apiError.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $("#createRoomButton").addEventListener("click", () => {
    requireAccount(async () => {
      try {
        const data = await apiRequest("/api/rooms", { method: "POST", body: JSON.stringify({ private: state.options.privateRoom, gameType: state.selectedGameType }) });
        state.spectator = false;
        state.rooms.unshift(data.room);
        await loadRoom(data.room.code);
        navigate("lobby");
        if (!isImposterRoom()) void gameAudio.play("welcome");
        showToast(`أُنشئت غرفة ${gamePage(state.selectedGameType).name}`);
      } catch (error) { showToast(error.message); }
    });
  });
  $("#joinRoomButton").addEventListener("click", () => requireAccount(() => {
    $("#joinError").textContent = "";
    $("#roomCodeInput").value = "";
    $("#joinDialog").showModal();
  }));
  $("#closeJoinDialog").addEventListener("click", () => {
    $("#joinError").textContent = "";
    $("#joinDialog").close();
  });
  $("#roomCodeInput").addEventListener("input", (event) => {
    event.target.value = normalizeRoomCode(event.target.value);
    $("#joinError").textContent = "";
  });
  $("#joinForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = normalizeRoomCode($("#roomCodeInput").value);
    $("#roomCodeInput").value = code;
    if (!/^[0-9]{6}$/.test(code)) {
      $("#joinError").textContent = "اكتب رمز الغرفة المكوّن من 6 أرقام.";
      return;
    }
    try {
      await apiRequest(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST" });
      await loadRoom(code);
      state.spectator = false;
      $("#joinDialog").close();
      $("#joinError").textContent = "";
      navigate("lobby");
      if (!isImposterRoom()) void gameAudio.play("welcome");
      showToast("دخلت الغرفة بنجاح");
    } catch (error) { $("#joinError").textContent = error.message; }
  });

  $("#copyCodeButton").addEventListener("click", async () => {
    const code = $("#roomCode").textContent;
    try { await navigator.clipboard.writeText(code); } catch (_) { /* Clipboard may be unavailable in local previews. */ }
    $("#copyCodeButton span").textContent = "نُسخ";
    showToast(`نُسخ الرمز ${code}`);
    window.setTimeout(() => { $("#copyCodeButton span").textContent = "نسخ"; }, 1400);
  });

  $("#lobbyPlayers").addEventListener("click", async (event) => {
    const kick = event.target.closest("[data-kick]");
    if (!kick) return;
    try {
      await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/members/${encodeURIComponent(kick.dataset.kick)}`, { method: "DELETE" });
      await loadRoom(activeRoomCode());
      showToast("تم إخراج اللاعب من الغرفة");
    } catch (error) { showToast(error.message); }
  });
  $("#spectatorList").addEventListener("click", (event) => {
    const kick = event.target.closest("[data-kick-spectator]");
    if (!kick) return;
    const removed = state.spectators.find((spectator) => spectator.id === kick.dataset.kickSpectator);
    state.spectators = state.spectators.filter((spectator) => spectator.id !== kick.dataset.kickSpectator);
    renderLobby();
    showToast(`أخرج المضيف ${removed?.name || "المشاهد"} من الغرفة`);
  });
  $("#privateRoomToggle").addEventListener("change", async (event) => {
    state.options.privateRoom = event.target.checked;
    const activeRoom = state.rooms.find((room) => room.id === state.activeRoomId);
    if (activeRoom) activeRoom.private = state.options.privateRoom;
    saveOptions();
    try {
      if (activeRoomCode()) await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}`, { method: "PATCH", body: JSON.stringify({ private: state.options.privateRoom }) });
      await loadRooms();
      showToast(state.options.privateRoom ? "أصبحت الغرفة خاصة ومخفية عن المشاهدين" : "أصبحت الغرفة عامة وقابلة للمشاهدة");
    } catch (error) { showToast(error.message); }
  });
  $("#startGameButton").addEventListener("click", () => requireAccount(async () => {
    try {
      const data = await apiRequest(`/api/rooms/${encodeURIComponent(activeRoomCode())}/start`, { method: "POST", body: JSON.stringify({ options: state.options }) });
      await loadRoom(activeRoomCode());
      if (data.gameType === "imposter") {
        state.imposterRoleRevealed = false;
        state.imposterVoteSelections = [];
        state.imposterWordChoice = null;
        await loadImposterState();
        navigate("game");
        if (data.botsAdded) showToast(`أضيف ${data.botsAdded} من الروبوتات لإكمال العدد`);
      } else if (data.gameType === "bluff") {
        state.bluffGame = null;
        state.bluffSelectedCard = null;
        state.bluffSelectedTarget = null;
        state.bluffSelectedClaim = null;
        await loadBluffState();
        navigate("game");
        if (data.botsAdded) showToast(`أضيف ${data.botsAdded} من الروبوتات لإكمال العدد`);
      } else {
        prepareRoleReveal(data.role, data.partners || []);
        if (data.botsAdded) showToast(`أضيف ${data.botsAdded} من الروبوتات لإكمال الجولة`);
      }
    } catch (error) { showToast(error.message); }
  }));
  $("#roleFlipButton").addEventListener("click", revealRole);
  $("#roleFlipButton").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      revealRole();
    }
  });
  $("#roleDialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#enterGameButton").addEventListener("click", enterGameAfterRole);

  gameContent.addEventListener("input", (event) => {
    const input = event.target.closest('[data-chat-form] input[name="message"]');
    if (!input) return;
    const form = input.closest("[data-chat-form]");
    chatDrafts[form.dataset.chatForm] = input.value;
  });

  gameContent.addEventListener("focusout", (event) => {
    if (!event.target.matches?.('[data-chat-form] input[name="message"]')) return;
    window.setTimeout(() => {
      if (chatComposerFocused() || !gameRenderDeferred || state.route !== "game") return;
      gameRenderDeferred = false;
      renderGame();
    }, 0);
  });

  gameContent.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-chat-form]");
    if (!form) return;
    event.preventDefault();
    if (state.spectator) return showToast("المشاهدة لا تسمح بإرسال الرسائل");
    const input = form.elements.message;
    const body = input.value.trim();
    if (!body) return;
    const channel = form.dataset.chatForm;
    if (!roomChat.send(body, channel)) {
      showToast("المحادثة تعيد الاتصال — حاول بعد لحظة");
      return;
    }
    chatDrafts[channel] = "";
    input.value = "";
  });

  roomChat.addEventListener("status", (event) => {
    state.chatStatus = event.detail;
    refreshPublicChat();
  });

  roomChat.addEventListener("histories", (event) => {
    ["public", "mafia", "dead"].forEach((channel) => { state.messages[channel] = (event.detail[channel] || []).map(normalizeChatMessage); });
    refreshPublicChat();
  });

  roomChat.addEventListener("message", (event) => {
    const channel = event.detail.channel || "public";
    state.messages[channel].push(normalizeChatMessage(event.detail));
    state.messages[channel] = state.messages[channel].slice(-60);
    refreshPublicChat();
  });

  roomChat.addEventListener("chat-error", (event) => showToast(event.detail));
  roomChat.addEventListener("game-sync", async (event) => {
    if (!["mafia", "wolf", "imposter", "bluff"].includes(event.detail?.gameType) || state.route !== "game" || !activeRoomCode()) return;
    try {
      await loadRoom(activeRoomCode());
      if (event.detail.gameType === "imposter") await loadImposterState();
      else if (event.detail.gameType === "bluff") await loadBluffState();
      else await loadMafiaState();
      renderGame();
    } catch (error) {
      if (error.data?.ended) navigate("home", { replace: true });
    }
  });
  liveKitVoice.addEventListener("status", (event) => {
    state.voiceStatus = event.detail;
    if (state.route === "game") renderGame();
  });
  liveKitVoice.addEventListener("microphone", (event) => {
    state.micOn = Boolean(event.detail);
    if (state.route === "game") renderGame();
  });
  liveKitVoice.addEventListener("participants", (event) => {
    state.voiceParticipants = Array.isArray(event.detail) ? event.detail : [];
    if (state.route === "game") refreshVoiceParticipants();
  });
  liveKitVoice.addEventListener("active-speakers", (event) => {
    state.activeSpeakers = Array.isArray(event.detail) ? event.detail : [];
    if (state.route === "game") refreshVoiceParticipants();
  });
  liveKitVoice.addEventListener("audio-blocked", (event) => {
    if (event.detail) showToast("اضغط على تشغيل الصوت ليسمح المتصفح بالاستماع");
  });
  roomChat.addEventListener("round-ended", async () => {
    state.messages = { public: [], mafia: [], dead: [] };
    navigate("home", { replace: true });
    await loadRooms();
    showToast("انتهت الجولة، رجعناك للرئيسية");
  });
  roomChat.addEventListener("membership-ended", async () => {
    state.messages = { public: [], mafia: [], dead: [] };
    navigate("home", { replace: true });
    await loadRooms();
    showToast("غادرت الغرفة، رجعناك للرئيسية");
  });

  window.addEventListener("popstate", async () => {
    const valid = await syncRoomFromPath();
    navigate(valid ? routeFromPath() : "home", { fromHistory: true });
  });
}

function showMaintenance(message) {
  document.body.innerHTML = `
    <main class="maintenance-screen">
      <section>
        <span class="maintenance-mark">ق</span>
        <small>QINAA</small>
        <h1>نعود بعد قليل</h1>
        <p>${escapeHtml(message || "قِناع في صيانة قصيرة. سنعود قريباً.")}</p>
        <a href="/admindash">دخول الإدارة</a>
      </section>
    </main>`;
}

async function bootstrap() {
  populateBirthDateFields();
  populateProfileBirthDateFields();
  loadLocalState();
  bindEvents();
  let authUser = null;
  try {
    const auth = await apiRequest("/api/auth/me");
    authUser = auth.user;
    setAccount(authUser);
  } catch (_) { setAccount(null); }
  try {
    const config = await apiRequest("/api/site/config");
    if (config.maintenanceMode && !authUser?.adminRole) return showMaintenance(config.maintenanceMessage);
  } catch (_) { /* Keep the public site available if config cannot be loaded. */ }
  await loadGamePages();
  try { await loadRooms(); } catch (error) { showToast(error.message); }

  const oauthStatus = new URLSearchParams(location.search).get("auth");
  if (oauthStatus?.includes("not-configured")) showToast("الدخول الاجتماعي يحتاج مفاتيح المنصة أولاً");
  else if (oauthStatus === "failed") showToast("تعذر إكمال تسجيل الدخول الاجتماعي");
  else if (oauthStatus === "success") showToast("تم تسجيل الدخول بنجاح");
  if (oauthStatus) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("auth");
    history.replaceState(history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }
  if (state.account?.profileComplete === false) openAccountDialog(null, "social-complete");

  const requestedRoute = routeFromPath();
  const valid = await syncRoomFromPath();
  if (!valid) navigate("home", { replace: true });
  else {
    if (requestedRoute === "game") state.spectator = !state.players.some((player) => player.id === "me");
    navigate(requestedRoute, { replace: true });
  }
}

bootstrap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
