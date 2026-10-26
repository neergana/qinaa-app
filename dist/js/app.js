import {
  state,
  loadLocalState,
  saveOptions,
  setPlayerName,
  formatTime,
  resetForNight,
  startDay,
  startVote,
} from "./state.js";
import { realtime } from "./services/mock-realtime.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const gameContent = $("#gameContent");
let gameTicker = null;
let toastTimer = null;

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
  };
  return icons[name] || "";
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function avatar(player, extra = "") {
  return `<span class="avatar ${player.accent || ""} ${extra}">${escapeHtml(player.initial || player.name.charAt(0))}</span>`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

function navigate(route) {
  state.route = route;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === route));
  $$(".bottom-nav [data-route]").forEach((button) => button.classList.toggle("is-active", button.dataset.route === route));
  document.body.classList.toggle("game-mode", route === "game");
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (route === "lobby") renderLobby();
  if (route === "game") {
    renderGame();
    startTicker();
  }
}

function renderLobby() {
  const me = state.players.find((player) => player.id === "me");
  $("#lobbyPlayers").innerHTML = state.players.map((player) => `
    <div class="player-row" data-player-id="${player.id}">
      ${avatar(player)}
      <div><strong>${escapeHtml(player.name)}${player.id === "me" ? " (أنت)" : ""}</strong><small>${player.connected ? "متصل وجاهز" : "منقطع · الروبوت يتولى دوره"}</small></div>
      ${player.host ? '<span class="host-badge">المضيف</span>' : `<button class="kick-button" data-kick="${player.id}" aria-label="إزالة ${escapeHtml(player.name)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}
    </div>
  `).join("");
  $("#playerCount").textContent = state.players.length;
  $("#minimumHint").textContent = state.players.length >= 5 ? `كل شيء جاهز · ${state.players.length} لاعبين متصلين` : `نحتاج ${5 - state.players.length} لاعبين إضافيين`;
  $("#startGameButton").disabled = state.players.length < 5;
  $("#cupidToggle").checked = state.options.cupid;
  $("#witchToggle").checked = state.options.witch;
  $("#playerNameInput").value = me.name;
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
    if (state.phase === "night") {
      state.phaseRemaining = Math.max(0, state.phaseRemaining - 1);
      if (state.phaseRemaining === 0) {
        startDay();
        showToast("أشرقت الشمس — بدأ النقاش الحر");
        renderGame();
      }
    } else if (state.phase === "day") {
      if (state.speaker) {
        state.speakerRemaining = Math.max(0, state.speakerRemaining - 1);
        if (state.speakerRemaining === 0) {
          state.speaker = null;
          state.micOn = false;
          showToast("انتهت المداخلة — استؤنف مؤقت النقاش");
          renderGame();
        }
      } else {
        state.discussionRemaining = Math.max(0, state.discussionRemaining - 1);
        state.phaseRemaining = state.discussionRemaining;
        if (state.discussionRemaining === 0) {
          startVote();
          showToast("انتهى النقاش — فُتح التصويت");
          renderGame();
        }
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
}

function renderGame() {
  const labels = {
    night: { label: "حلّ الليل", icon: "moon" },
    day: { label: "نهار الحارة", icon: "sun" },
    vote: { label: state.voteRound > 1 ? "إعادة التصويت" : "وقت التصويت", icon: "vote" },
  };
  const current = labels[state.phase];
  $("#roundLabel").textContent = `الجولة ${state.round === 1 ? "الأولى" : state.round}`;
  $("#phaseLabel").textContent = current.label;
  $("#phaseIcon").innerHTML = icon(current.icon);
  $("#timerValue").textContent = formatTime(state.phaseRemaining);
  $$("[data-game-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.gameTab === state.currentTab));
  $("#chatBadge").textContent = state.phase === "night" ? state.messages.mafia.length : state.players.find((p) => p.id === "me").alive ? "•" : state.messages.dead.length;

  if (state.currentTab === "arena") {
    gameContent.innerHTML = state.phase === "night" ? nightTemplate() : state.phase === "day" ? dayTemplate() : voteTemplate();
  } else if (state.currentTab === "players") {
    gameContent.innerHTML = playersTemplate();
  } else if (state.currentTab === "chat") {
    gameContent.innerHTML = chatTabTemplate();
  } else {
    gameContent.innerHTML = historyTemplate();
  }
  updateTimers();
}

function nightTemplate() {
  const targets = state.players.filter((player) => !["me", "noor"].includes(player.id) && player.alive);
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">صوت تجريبي</span>
        <div class="eyebrow"><span></span> قناة المافيا الخاصة</div>
        <h1>اختاروا هدف الليلة</h1>
        <p>لا يسمع هذه القناة ولا يرى رسائلها سوى أعضاء المافيا. الصوت هنا واجهة محاكاة فقط.</p>
      </section>
      <div class="section-label"><h2>الهدف المقترح</h2><span>${state.selectedTarget ? "تم تثبيت اختيارك" : "اختر لاعباً واحداً"}</span></div>
      <div class="target-grid">
        ${targets.map((player) => `<button class="target-card ${state.selectedTarget === player.id ? "is-selected" : ""}" data-target="${player.id}">${avatar(player)}<strong>${escapeHtml(player.name)}</strong><small>حيّ · متصل</small></button>`).join("")}
      </div>
      <div class="section-label"><h2>همس المافيا</h2><span>مشفّر في النسخة النهائية</span></div>
      ${channelTemplate("mafia")}
      <div class="voice-bar">
        <div><span class="voice-visual"><i></i><i></i><i></i></span><span><strong>قناة الصوت الخاصة</strong><small>محاكاة واجهة — لا صوت فعلياً</small></span></div>
        <button class="mic-button ${state.micOn ? "" : "is-muted"}" data-action="toggle-mic" aria-label="${state.micOn ? "كتم الميكروفون" : "تشغيل الميكروفون"}">${icon(state.micOn ? "mic" : "micOff")}</button>
      </div>
      ${hostControlsTemplate("night")}
    </div>`;
}

function dayTemplate() {
  const queue = [
    state.players.find((p) => p.id === "layan"),
    state.players.find((p) => p.id === "youssef"),
    ...(state.requestedToSpeak ? [state.players.find((p) => p.id === "me")] : []),
  ];
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">صوت تجريبي</span>
        <div class="eyebrow"><span></span> النقاش مفتوح</div>
        <h1>من تتهم اليوم؟</h1>
        <p>أربع دقائق للنقاش. يتوقف المؤقت تلقائياً أثناء مداخلة المتحدث، ثم يستأنف من حيث توقف.</p>
      </section>
      <div class="section-label"><h2>مؤقت النقاش</h2><span>${state.speaker ? "متوقف أثناء المداخلة" : "يعمل الآن"}</span></div>
      <div class="discussion-timer">
        <div class="discussion-top"><strong>${state.speaker ? "المؤقت متوقف مؤقتاً" : "النقاش الحر"}</strong><span id="discussionClock">${formatTime(state.discussionRemaining)}</span></div>
        <p>${state.speaker ? "سيُستأنف المؤقت فور انتهاء دور المتحدث." : "يمكن للجميع التحكم في ميكروفوناتهم أثناء النقاش الحر."}</p>
        ${state.speaker ? `<div class="speaker-card">${avatar(state.speaker)}<div><strong>${escapeHtml(state.speaker.name)} يتحدث الآن</strong><small>${state.speakerIndex === 1 ? "المداخلة الأولى · دقيقتان" : "مداخلة · دقيقة واحدة"}</small></div><b class="speaker-clock" id="speakerClock">${formatTime(state.speakerRemaining)}</b></div>` : ""}
      </div>
      <div class="voice-bar">
        <div>${icon(state.micOn ? "mic" : "micOff")}<span><strong>ميكروفونك ${state.micOn ? "مفتوح" : "مكتوم"}</strong><small>التحكم بيدك · واجهة بلا بث</small></span></div>
        <button class="mic-button ${state.micOn ? "" : "is-muted"}" data-action="toggle-mic" aria-label="تبديل الميكروفون">${icon(state.micOn ? "mic" : "micOff")}</button>
      </div>
      <div class="section-label"><h2>طابور المتحدثين</h2><span>${queue.length} في الانتظار</span></div>
      <div class="queue-list">${queue.map((player, index) => `<div class="queue-item">${avatar(player)}<strong>${escapeHtml(player.name)}${player.id === "me" ? " (أنت)" : ""}</strong><b>#${index + 1}</b></div>`).join("")}</div>
      <button class="button ${state.requestedToSpeak ? "button-secondary" : "button-primary"} full" data-action="request-speech" type="button">${state.requestedToSpeak ? "إلغاء طلب الكلام" : "طلب دور للكلام"}</button>
      ${hostControlsTemplate("day")}
    </div>`;
}

function voteTemplate() {
  const candidates = ["omar", "youssef", "mariam"].map((id) => state.players.find((player) => player.id === id));
  const totalVotes = Object.values(state.votes).reduce((sum, value) => sum + value, 0) || 1;
  const result = getVoteResult();
  return `
    <div class="game-stage">
      <section class="stage-hero">
        <span class="mock-flag">تفاعل محلي</span>
        <div class="eyebrow"><span></span> ${state.voteRound > 1 ? "الإعادة الحاسمة" : "قرار الحارة"}</div>
        <h1>${state.voteClosed ? "أُغلق صندوق التصويت" : "صوّت قبل انتهاء الوقت"}</h1>
        <p>تظهر الأعداد مباشرة للجميع، بينما تبقى أسماء المصوّتين مخفية حتى إغلاق الصندوق.</p>
      </section>
      <div class="section-label"><h2>المرشحون</h2><span id="voteClock">${formatTime(state.voteRemaining)}</span></div>
      <div class="vote-grid">
        ${candidates.map((player) => {
          const count = state.votes[player.id] || 0;
          const percent = Math.round((count / totalVotes) * 100);
          return `<button class="vote-row ${state.myVote === player.id ? "is-my-vote" : ""}" style="--vote-width:${percent}%" data-vote="${player.id}" ${state.voteClosed ? "disabled" : ""}>${avatar(player)}<div><strong>${escapeHtml(player.name)}</strong><small>${state.voteClosed && state.revealVoters ? voteIdentities(player.id) : "هويات المصوّتين مخفية"}</small></div><b class="vote-count">${count} ${count === 1 ? "صوت" : "أصوات"}</b></button>`;
        }).join("")}
      </div>
      <p class="vote-note">يمكنك تغيير صوتك حتى نهاية العدّ التنازلي.</p>
      ${state.voteClosed ? resultTemplate(result) : ""}
      ${hostControlsTemplate("vote")}
    </div>`;
}

function resultTemplate(result) {
  if (result.tie) {
    if (state.voteRound >= 2) {
      return `<div class="prototype-note"><span>انتهى</span><p><strong>استمر التعادل.</strong> وفق القواعد، تُلغى عملية الإقصاء وتنتقل الحارة إلى الليلة التالية.</p></div><button class="button button-primary full" data-action="next-night">الانتقال إلى الليلة التالية</button>`;
    }
    return `<div class="prototype-note"><span>تعادل</span><p>تعادل ${result.names.join(" و")} في عدد الأصوات. تبدأ إعادة واحدة لمدة 60 ثانية.</p></div><button class="button button-primary full" data-action="start-revote">بدء إعادة التصويت</button>`;
  }
  return `<div class="prototype-note"><span>دفاع</span><p><strong>${escapeHtml(result.names[0])}</strong> حصل على أعلى الأصوات. تبدأ الآن فرصة دفاع أخيرة قبل تنفيذ قرار الحارة.</p></div><button class="button button-secondary full" data-action="start-defense">بدء دفاع لمدة 60 ثانية</button>`;
}

function playersTemplate() {
  return `
    <div class="section-label" style="padding:0 1.1rem"><h2>أهل الحارة</h2><span>${state.players.filter((player) => player.alive).length} أحياء</span></div>
    <div class="roster-grid">
      ${state.players.map((player) => `<div class="roster-card ${player.alive ? "" : "is-dead"} ${player.id === "me" && state.botActive ? "is-bot" : ""}">${avatar(player)}<div><strong>${escapeHtml(player.name)}${player.host ? " · مضيف" : ""}</strong><small>${player.alive ? (player.id === "me" && state.botActive ? "الروبوت يلعب مؤقتاً" : "حيّ · متصل") : "مُقصى · نص فقط"}</small></div></div>`).join("")}
    </div>
    <div class="game-stage">
      <div class="host-controls">
        <div class="host-controls-head"><strong>تجربة حالات النظام</strong><span>أدوات المضيف مستمرة دائماً</span></div>
        <div class="host-controls-actions">
          <button class="small-button" data-action="toggle-death">${state.players.find((p) => p.id === "me").alive ? "محاكاة إقصائي" : "إعادتي حياً"}</button>
          <button class="small-button" data-action="toggle-connection">${state.botActive ? "محاكاة عودتي" : "محاكاة انقطاعي"}</button>
        </div>
      </div>
    </div>`;
}

function chatTabTemplate() {
  const me = state.players.find((player) => player.id === "me");
  if (!me.alive) {
    return `<div class="game-stage"><section class="stage-hero"><div class="eyebrow"><span></span> مقاعد المتفرجين</div><h1>محادثة الموتى</h1><p>نص فقط. لا يمكنك العودة إلى القنوات الصوتية أو التأثير في اللاعبين الأحياء.</p></section><div class="section-label"><h2>الرسائل</h2><span>لا يراها الأحياء</span></div>${channelTemplate("dead")}</div>`;
  }
  if (state.phase === "night") return `<div class="game-stage"><div class="section-label"><h2>همس المافيا</h2><span>خاص بالأعضاء</span></div>${channelTemplate("mafia")}</div>`;
  return `<div class="empty-state">${icon("chat")}<h2>صوت النهار هو الساحة</h2><p>المحادثة النصية العامة معطّلة أثناء اللعب. استخدم الميكروفون أو اطلب دوراً في طابور المتحدثين.</p></div>`;
}

function historyTemplate() {
  const items = [...state.history].reverse();
  return `<div class="section-label" style="padding:0 1.1rem"><h2>سجل التصويت</h2><span>الهويات تظهر بعد الإغلاق</span></div><div class="history-list">${items.map((entry) => `<article class="history-item"><header><strong>${escapeHtml(entry.title)}</strong><span>${entry.round ? `الجولة ${entry.round}` : "نموذج"}</span></header><p>${escapeHtml(entry.result)}</p><div class="voters">${entry.voters.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></article>`).join("")}</div>`;
}

function channelTemplate(channel) {
  const messages = state.messages[channel];
  return `<div class="mafia-channel"><div class="channel-head"><div>${icon(channel === "mafia" ? "lock" : "skull")}<strong>${channel === "mafia" ? "قناة سرية" : "نص المتفرجين"}</strong></div><span class="voice-visual"><i></i><i></i><i></i></span></div><div class="messages" id="messageList">${messages.map((message) => `<div class="message ${message.mine ? "mine" : ""}">${avatar(message)}<div class="message-bubble">${escapeHtml(message.body)}<small>${escapeHtml(message.time)}</small></div></div>`).join("")}</div><form class="chat-compose" data-chat-form="${channel}"><input name="message" maxlength="120" placeholder="اكتب رسالة قصيرة…" autocomplete="off" aria-label="رسالة"><button type="submit" aria-label="إرسال">${icon("send")}</button></form></div>`;
}

function hostControlsTemplate(context) {
  const copy = {
    night: ["إنهاء الليل", "بدء النهار"],
    day: [state.speaker ? "إنهاء المداخلة" : "استدعاء المتحدث", "فتح التصويت"],
    vote: ["محاكاة تعادل", state.voteClosed ? "النتيجة معلنة" : "إغلاق الصندوق"],
  }[context];
  return `<div class="host-controls"><div class="host-controls-head"><strong>${icon("shield")} أدوات المضيف</strong><span>تبقى بعد الإقصاء</span></div><div class="host-controls-actions"><button class="small-button" data-action="host-primary" data-context="${context}">${copy[0]}</button><button class="small-button" data-action="host-secondary" data-context="${context}" ${context === "vote" && state.voteClosed ? "disabled" : ""}>${copy[1]}</button></div></div>`;
}

function getVoteResult() {
  const max = Math.max(...Object.values(state.votes));
  const leaderIds = Object.entries(state.votes).filter(([, count]) => count === max).map(([id]) => id);
  return { tie: leaderIds.length > 1, names: leaderIds.map((id) => state.players.find((p) => p.id === id)?.name || id), ids: leaderIds };
}

function voteIdentities(candidateId) {
  const identities = {
    omar: "سامي، سلمى، زياد",
    youssef: "ليان",
    mariam: "نور، عمر، يوسف",
  };
  return identities[candidateId] || "لا أحد";
}

function closeVote(forceTie = false) {
  if (state.voteClosed) return;
  if (forceTie) state.votes = { omar: 3, youssef: 0, mariam: 3 };
  state.voteClosed = true;
  state.revealVoters = true;
  state.phaseRemaining = state.voteRemaining;
  const result = getVoteResult();
  state.history.push({
    round: state.round,
    title: state.voteRound > 1 ? "إعادة التصويت" : "التصويت العام",
    result: result.tie ? (state.voteRound > 1 ? "استمر التعادل؛ لا إقصاء." : "تعادل؛ تقررت الإعادة.") : `${result.names[0]} إلى مرحلة الدفاع.`,
    voters: ["سامي ← عمر", "نور ← مريم", "ليان ← يوسف", "عمر ← مريم", "سلمى ← عمر"],
    tie: result.tie,
  });
  showToast("أُغلق التصويت وكُشفت هويات المصوّتين");
  renderGame();
}

function startNextSpeaker() {
  const queueIds = ["layan", "youssef", ...(state.requestedToSpeak ? ["me"] : [])];
  const nextId = queueIds[state.speakerIndex % queueIds.length];
  state.speakerIndex += 1;
  state.speaker = state.players.find((player) => player.id === nextId);
  state.speakerRemaining = state.speakerIndex === 1 ? 120 : 60;
  state.phaseRemaining = state.speakerRemaining;
  showToast(state.speakerIndex === 1 ? "بدأت أول مداخلة — دقيقتان" : "بدأت المداخلة — دقيقة واحدة");
  renderGame();
}

function handleGameAction(action, target) {
  if (action === "toggle-mic") {
    state.micOn = !state.micOn;
    showToast(state.micOn ? "فُتح الميكروفون محلياً (بلا بث)" : "كُتم الميكروفون");
  } else if (action === "request-speech") {
    state.requestedToSpeak = !state.requestedToSpeak;
  } else if (action === "host-primary") {
    const context = target.dataset.context;
    if (context === "night") startDay();
    if (context === "day") {
      if (state.speaker) { state.speaker = null; state.speakerRemaining = 0; }
      else startNextSpeaker();
    }
    if (context === "vote") { closeVote(true); return; }
  } else if (action === "host-secondary") {
    const context = target.dataset.context;
    if (context === "night") startDay();
    if (context === "day") startVote();
    if (context === "vote") { closeVote(); return; }
  } else if (action === "start-revote") {
    state.voteRound += 1;
    startVote(true);
    showToast("بدأت الإعادة — 60 ثانية");
  } else if (action === "next-night") {
    state.round += 1;
    state.voteRound = 1;
    resetForNight();
  } else if (action === "start-defense") {
    state.phase = "day";
    state.phaseSeconds = 60;
    state.phaseRemaining = 60;
    state.discussionRemaining = 0;
    state.speaker = state.players.find((p) => p.id === getVoteResult().ids[0]);
    state.speakerIndex = 2;
    state.speakerRemaining = 60;
    showToast("بدأ الدفاع — دقيقة واحدة");
  } else if (action === "toggle-death") {
    const me = state.players.find((player) => player.id === "me");
    me.alive = !me.alive;
    state.currentTab = me.alive ? "players" : "chat";
    showToast(me.alive ? "عُدت إلى قائمة الأحياء" : "أُقصيت تجريبياً — أدوات المضيف ما زالت متاحة");
  } else if (action === "toggle-connection") {
    toggleConnection();
  }
  renderGame();
}

function toggleConnection() {
  state.connected = !state.connected;
  state.botActive = !state.connected;
  const me = state.players.find((player) => player.id === "me");
  me.connected = state.connected;
  const chip = $("#connectionChip");
  chip.classList.toggle("is-offline", !state.connected);
  $(".connection-copy b", chip).textContent = state.connected ? "متصل" : "إعادة اتصال";
  $(".connection-copy small", chip).textContent = state.connected ? "محاكاة محلية" : "الروبوت يتولى دورك";
  if (state.connected) {
    realtime.connect();
    showToast("عدت إلى الغرفة واستعدت دورك من الروبوت");
  } else {
    realtime.disconnect();
    showToast("انقطع الاتصال — الروبوت يتولى دورك مؤقتاً");
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) navigate(routeButton.dataset.route);

    const tabButton = event.target.closest("[data-game-tab]");
    if (tabButton) {
      state.currentTab = tabButton.dataset.gameTab;
      renderGame();
    }

    const targetButton = event.target.closest("[data-target]");
    if (targetButton) {
      state.selectedTarget = targetButton.dataset.target;
      showToast(`ثُبّت الهدف: ${state.players.find((p) => p.id === state.selectedTarget).name}`);
      renderGame();
    }

    const voteButton = event.target.closest("[data-vote]");
    if (voteButton && !state.voteClosed) {
      if (state.myVote) state.votes[state.myVote] = Math.max(0, (state.votes[state.myVote] || 0) - 1);
      state.myVote = voteButton.dataset.vote;
      state.votes[state.myVote] = (state.votes[state.myVote] || 0) + 1;
      renderGame();
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleGameAction(actionButton.dataset.action, actionButton);
  });

  $("#menuButton").addEventListener("click", openDrawer);
  $("#closeMenuButton").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", closeDrawer);
  $("#connectionChip").addEventListener("click", () => { toggleConnection(); if (state.route === "game") renderGame(); });

  $("#createRoomButton").addEventListener("click", () => {
    $("#roomCode").textContent = `MAF-${Math.floor(100 + Math.random() * 899)}`;
    navigate("lobby");
    showToast("أُنشئت غرفة تجريبية على هذا الجهاز");
  });
  $("#joinRoomButton").addEventListener("click", () => $("#joinDialog").showModal());
  $("#joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#playerNameInput").value.trim();
    const code = $("#roomCodeInput").value.trim().toUpperCase();
    if (name.length < 2 || code.length < 4) {
      $("#joinError").textContent = "اكتب اسماً ورمز غرفة صالحاً (جرّب MAF-728).";
      return;
    }
    setPlayerName(name);
    $("#roomCode").textContent = code;
    $("#joinDialog").close();
    $("#joinError").textContent = "";
    navigate("lobby");
    showToast("دخلت الغرفة التجريبية بنجاح");
  });

  $("#copyCodeButton").addEventListener("click", async () => {
    const code = $("#roomCode").textContent;
    try { await navigator.clipboard.writeText(code); } catch (_) { /* Clipboard may be unavailable in local previews. */ }
    $("#copyCodeButton span").textContent = "نُسخ";
    showToast(`نُسخ الرمز ${code}`);
    window.setTimeout(() => { $("#copyCodeButton span").textContent = "نسخ"; }, 1400);
  });

  $("#addMockPlayer").addEventListener("click", () => {
    const names = ["هاجر", "آدم", "سارة", "أنس", "رنا", "أيوب", "دانا", "مهدي", "ريم", "بدر", "هناء", "مالك"];
    if (state.players.length >= 20) return showToast("وصلت الغرفة إلى الحد الأقصى: 20 لاعباً");
    const name = names[(state.players.length - 8) % names.length];
    state.players.push({ id: `mock-${Date.now()}`, name, initial: name.charAt(0), accent: `a${(state.players.length % 6) + 1}`, alive: true, connected: true, role: "مواطن" });
    renderLobby();
  });
  $("#lobbyPlayers").addEventListener("click", (event) => {
    const kick = event.target.closest("[data-kick]");
    if (!kick) return;
    state.players = state.players.filter((player) => player.id !== kick.dataset.kick);
    renderLobby();
  });
  $("#cupidToggle").addEventListener("change", (event) => { state.options.cupid = event.target.checked; saveOptions(); showToast(state.options.cupid ? "أُضيف كيوبيد إلى التوزيع" : "أُزيل كيوبيد"); });
  $("#witchToggle").addEventListener("change", (event) => { state.options.witch = event.target.checked; saveOptions(); showToast(state.options.witch ? "أُضيفت الساحرة إلى التوزيع" : "أُزيلت الساحرة"); });
  $("#startGameButton").addEventListener("click", () => $("#roleDialog").showModal());
  $("#enterGameButton").addEventListener("click", () => {
    $("#roleDialog").close();
    resetForNight();
    navigate("game");
  });

  gameContent.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-chat-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.elements.message;
    const body = input.value.trim();
    if (!body) return;
    const channel = form.dataset.chatForm;
    const me = state.players.find((player) => player.id === "me");
    const payload = { id: Date.now(), sender: me.name, initial: me.initial, accent: me.accent, body, time: "الآن", mine: true };
    state.messages[channel].push(payload);
    realtime.send(channel, payload);
    input.value = "";
    realtime.simulateReply(channel);
    renderGame();
  });

  realtime.addEventListener("remote-message", (event) => {
    state.messages[event.detail.channel].push(event.detail.payload);
    if (state.route === "game" && state.currentTab === "chat") renderGame();
    else showToast("وصلت رسالة تجريبية جديدة");
  });
}

loadLocalState();
bindEvents();
renderLobby();
navigate("home");
realtime.connect();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
