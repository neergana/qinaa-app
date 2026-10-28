const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = { overview: null, users: [], rooms: [], games: [], admins: [], audit: [], activeTab: "overview" };
const titles = { overview: "نظرة عامة", users: "المستخدمون", rooms: "الغرف", seo: "صفحات الألعاب وSEO", settings: "التحكم بالموقع", admins: "المشرفون", audit: "سجل الإدارة" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", ...(includeTime ? { timeStyle: "short" } : {}) }).format(date);
}

let toastTimer;
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "تعذر تنفيذ العملية.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function showGate(name) {
  $("#loginGate").hidden = name !== "login";
  $("#deniedGate").hidden = name !== "denied";
  $("#adminApp").hidden = name !== "app";
}

function switchTab(tab) {
  state.activeTab = tab;
  $$('[data-admin-tab]').forEach((button) => button.classList.toggle("is-active", button.dataset.adminTab === tab));
  $$('[data-admin-view]').forEach((view) => view.classList.toggle("is-active", view.dataset.adminView === tab));
  $("#pageTitle").textContent = titles[tab] || "لوحة الإدارة";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderOverview() {
  const stats = state.overview.stats;
  const cards = [
    ["المستخدمون", stats.users, `${stats.newUsersToday} جدد اليوم`],
    ["الجلسات النشطة", stats.activeSessions, "جلسات دخول غير منتهية"],
    ["الغرف الجارية", stats.activeRooms, "متاحة الآن"],
    ["الجولات المنتهية", stats.completedRooms, "منذ بدء المنصة"],
    ["الرسائل الحالية", stats.storedMessages, "تُحذف مع نهاية الجولة"],
    ["المشرفون", stats.admins, "حسابات بصلاحية الإدارة"],
  ];
  $("#statsGrid").innerHTML = cards.map(([label, value, note]) => `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value).toLocaleString("ar-MA")}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  const admin = state.overview.admin;
  $("#adminName").textContent = admin.name;
  $("#adminRole").textContent = admin.role === "owner" ? "مالك المنصة" : "مشرف";
  $("#adminInitial").textContent = (admin.name || "ق").charAt(0);
  $("#adminInvitePanel").hidden = admin.role !== "owner";
}

function providerLabel(provider) {
  return provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : provider;
}

function renderUsers(data) {
  state.users = data.users;
  $("#usersTotal").textContent = `${data.total.toLocaleString("ar-MA")} حساب`;
  $("#usersList").innerHTML = state.users.length ? state.users.map((user) => `
    <article class="data-row">
      <div class="data-user"><span class="user-avatar">${escapeHtml(user.displayName?.charAt(0) || "؟")}</span><div><strong>${escapeHtml(user.displayName)}</strong><small dir="ltr">@${escapeHtml(user.username)}</small></div></div>
      <div class="data-meta"><strong dir="ltr">${escapeHtml(user.email)}</strong><small>الميلاد: ${escapeHtml(user.birthDate || "غير مكتمل")} · التسجيل: ${formatDate(user.createdAt)}</small></div>
      <div class="chips"><span class="chip ${user.accountStatus}">${user.accountStatus === "active" ? "نشط" : "موقوف"}</span>${user.adminRole ? `<span class="chip ${escapeHtml(user.adminRole)}">${user.adminRole === "owner" ? "مالك" : "مشرف"}</span>` : ""}${user.providers.map((provider) => `<span class="chip">${escapeHtml(providerLabel(provider))}</span>`).join("")}<span class="chip">${user.hasPassword ? "كلمة مرور مشفرة" : "دخول اجتماعي"}</span></div>
      <div class="row-actions"><button data-edit-user="${user.id}">تفاصيل وتعديل</button></div>
    </article>`).join("") : '<div class="empty-state">لا توجد حسابات مطابقة.</div>';
}

async function loadUsers() {
  const query = encodeURIComponent($("#userSearch").value.trim());
  const status = encodeURIComponent($("#userStatusFilter").value);
  renderUsers(await api(`/api/admin/users?q=${query}&status=${status}&limit=100`));
}

function renderRooms(data) {
  state.rooms = data.rooms;
  $("#roomsList").innerHTML = state.rooms.length ? state.rooms.map((room) => `
    <article class="data-row">
      <div class="data-user"><span class="user-avatar">${room.private ? "♜" : "⌂"}</span><div><strong>${escapeHtml(room.name)}</strong><small dir="ltr">${escapeHtml(room.code)}</small></div></div>
      <div class="data-meta"><strong>${escapeHtml(room.hostName)}</strong><small dir="ltr">${escapeHtml(room.hostEmail)}</small></div>
      <div class="chips"><span class="chip">${room.gameType === "imposter" ? "الدخيل" : "أفراد الظل"}</span><span class="chip ${room.endedAt ? "" : "active"}">${room.endedAt ? "منتهية" : "نشطة"}</span><span class="chip">${room.members} لاعب</span><span class="chip">${room.messages} رسالة</span></div>
      <div class="row-actions">${room.endedAt ? `<button class="danger" data-delete-room="${room.id}">حذف السجل</button>` : `<button class="danger" data-end-room="${room.id}">إنهاء الغرفة</button>`}</div>
    </article>`).join("") : '<div class="empty-state">لا توجد غرف بعد.</div>';
}

async function loadRooms() { renderRooms(await api("/api/admin/rooms")); }

function renderSeoPages(data) {
  state.games = data.games || [];
  $("#seoPages").innerHTML = state.games.map((game) => `<form class="panel seo-form" data-seo-game="${escapeHtml(game.gameType)}">
    <div class="panel-title"><div><span>${escapeHtml(game.gameType === "mafia" ? "لعبة أفراد الظل" : "لعبة الدخيل")}</span><h2>${escapeHtml(game.name)}</h2></div><a href="/games/${encodeURIComponent(game.slug)}" target="_blank" rel="noopener">معاينة الصفحة ↗</a></div>
    <div class="seo-grid">
      <label><span>اسم اللعبة</span><input name="name" value="${escapeHtml(game.name)}" required maxlength="60" /></label>
      <label><span>الرابط المختصر Slug</span><input name="slug" value="${escapeHtml(game.slug)}" dir="ltr" required pattern="[a-z0-9-]+" /></label>
      <label><span>العبارة فوق العنوان</span><input name="eyebrow" value="${escapeHtml(game.eyebrow)}" maxlength="100" /></label>
      <label class="seo-wide"><span>وصف صفحة اللعبة</span><textarea name="shortDescription" rows="3" maxlength="240">${escapeHtml(game.shortDescription)}</textarea></label>
      <label class="seo-wide"><span>عنوان نتائج البحث</span><input name="metaTitle" value="${escapeHtml(game.metaTitle)}" maxlength="70" required /></label>
      <label class="seo-wide"><span>وصف نتائج البحث</span><textarea name="metaDescription" rows="3" maxlength="170" required>${escapeHtml(game.metaDescription)}</textarea></label>
      <label class="seo-wide"><span>الكلمات المفتاحية</span><textarea name="keywords" rows="2" maxlength="300">${escapeHtml(game.keywords)}</textarea></label>
      <label><span>عنوان المشاركة</span><input name="ogTitle" value="${escapeHtml(game.ogTitle)}" maxlength="100" /></label>
      <label><span>وصف المشاركة</span><textarea name="ogDescription" rows="3" maxlength="200">${escapeHtml(game.ogDescription)}</textarea></label>
    </div>
    <button class="primary-button" type="submit">حفظ صفحة ${escapeHtml(game.name)}</button>
  </form>`).join("");
}

async function loadSeoPages() { renderSeoPages(await api("/api/admin/games")); }

function fillSettings(settings) {
  $("#maintenanceMode").checked = settings.maintenanceMode;
  $("#registrationEnabled").checked = settings.registrationEnabled;
  $("#roomCreationEnabled").checked = settings.roomCreationEnabled;
  $("#maintenanceMessage").value = settings.maintenanceMessage;
}

function renderAdmins(data) {
  state.admins = data.admins;
  const isOwner = state.overview.admin.role === "owner";
  $("#adminsList").innerHTML = state.admins.length ? state.admins.map((admin) => `
    <article class="data-row">
      <div class="data-user"><span class="user-avatar">${escapeHtml(admin.name?.charAt(0) || "؟")}</span><div><strong>${escapeHtml(admin.name)}</strong><small dir="ltr">@${escapeHtml(admin.username)}</small></div></div>
      <div class="data-meta"><strong dir="ltr">${escapeHtml(admin.email)}</strong><small>منذ ${formatDate(admin.createdAt)}</small></div>
      <div class="chips"><span class="chip ${escapeHtml(admin.role)}">${admin.role === "owner" ? "مالك" : "مشرف"}</span><span class="chip ${escapeHtml(admin.status)}">${admin.status === "active" ? "نشط" : "موقوف"}</span></div>
      <div class="row-actions">${isOwner && admin.id !== state.overview.admin.id ? `<button class="danger" data-remove-admin="${admin.id}">إزالة الصلاحية</button>` : ""}</div>
    </article>`).join("") : '<div class="empty-state">لا توجد حسابات إدارة.</div>';
}

async function loadAdmins() { renderAdmins(await api("/api/admin/admins")); }

const actionLabels = {
  "user.update": "تعديل مستخدم", "user.delete": "حذف مستخدم", "user.sessions.revoke": "إلغاء جلسات",
  "room.end": "إنهاء غرفة", "room.delete": "حذف غرفة", "site.settings.update": "تحديث الموقع",
  "game.seo.update": "تحديث صفحة لعبة وSEO",
  "admin.upsert": "تحديث مشرف", "admin.remove": "إزالة مشرف",
};

function renderAudit(data) {
  state.audit = data.entries;
  $("#auditList").innerHTML = state.audit.length ? state.audit.map((entry) => `
    <article class="audit-item"><div><strong>${escapeHtml(entry.adminName)}</strong><small dir="ltr">${escapeHtml(entry.adminEmail)}</small></div><div><strong class="audit-action">${escapeHtml(actionLabels[entry.action] || entry.action)}</strong><small>${escapeHtml(entry.targetType)} · ${escapeHtml(entry.targetId || "—")}</small></div><time>${formatDate(entry.createdAt, true)}</time></article>`).join("") : '<div class="empty-state">لا توجد إجراءات مسجلة بعد.</div>';
}

async function loadAudit() { renderAudit(await api("/api/admin/audit")); }

async function loadDashboard() {
  state.overview = await api("/api/admin/overview");
  showGate("app");
  renderOverview();
  fillSettings(state.overview.settings);
  const [users, rooms, games, admins, audit] = await Promise.all([
    api("/api/admin/users?limit=100"), api("/api/admin/rooms"), api("/api/admin/games"), api("/api/admin/admins"), api("/api/admin/audit"),
  ]);
  renderUsers(users); renderRooms(rooms); renderSeoPages(games); renderAdmins(admins); renderAudit(audit);
}

function openUserDialog(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  $("#editUserId").value = user.id;
  $("#editDisplayName").value = user.displayName || "";
  $("#editUsername").value = user.username || "";
  $("#editEmail").value = user.email || "";
  $("#editBirthDate").value = user.birthDate || "";
  $("#editAccountStatus").value = user.accountStatus;
  $("#editStatusReason").value = user.statusReason || "";
  $("#passwordNote").textContent = user.hasPassword
    ? "كلمة المرور محفوظة كبصمة مشفرة غير قابلة للعرض أو الاسترجاع. يمكن فقط إلغاء الجلسات النشطة."
    : `هذا الحساب يستعمل تسجيل الدخول الاجتماعي${user.providers.length ? ` عبر ${user.providers.map(providerLabel).join(" و")}` : ""} ولا يملك كلمة مرور محلية.`;
  $("#userDialog").showModal();
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  location.href = "/admindash";
}

function bindEvents() {
  $$('[data-admin-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.adminTab)));
  $$('[data-go-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.goTab)));
  $("#logoutButton").addEventListener("click", logout);
  $("#deniedLogout").addEventListener("click", logout);
  $("#refreshButton").addEventListener("click", async () => { await loadDashboard(); toast("تم تحديث لوحة الإدارة"); });
  $("#searchUsersButton").addEventListener("click", () => loadUsers().catch((error) => toast(error.message)));
  $("#userSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") loadUsers().catch((error) => toast(error.message)); });
  $("#reloadRoomsButton").addEventListener("click", () => loadRooms().catch((error) => toast(error.message)));
  $("#reloadAuditButton").addEventListener("click", () => loadAudit().catch((error) => toast(error.message)));

  $("#seoPages").addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-seo-game]");
    if (!form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await api(`/api/admin/games/${form.dataset.seoGame}`, { method: "PATCH", body: JSON.stringify(values) });
      await loadSeoPages(); await loadAudit(); toast("تم حفظ صفحة اللعبة وبيانات SEO");
    } catch (error) { toast(error.message); }
    finally { if (button) button.disabled = false; }
  });

  $("#adminLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("#adminLoginError").textContent = "";
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ login: $("#adminLoginIdentity").value.trim(), password: $("#adminLoginPassword").value }) });
      await loadDashboard();
    } catch (error) { $("#adminLoginError").textContent = error.message; }
  });

  $("#usersList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-user]");
    if (button) openUserDialog(button.dataset.editUser);
  });
  $("#closeUserDialog").addEventListener("click", () => $("#userDialog").close());

  $("#userEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#editUserId").value;
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ displayName: $("#editDisplayName").value, username: $("#editUsername").value, email: $("#editEmail").value, birthDate: $("#editBirthDate").value, accountStatus: $("#editAccountStatus").value, statusReason: $("#editStatusReason").value }) });
      $("#userDialog").close(); await loadUsers(); await loadAudit(); toast("تم حفظ بيانات الحساب");
    } catch (error) { toast(error.message); }
  });

  $("#revokeSessionsButton").addEventListener("click", async () => {
    const id = $("#editUserId").value;
    if (!confirm("إلغاء كل جلسات هذا المستخدم؟")) return;
    try { await api(`/api/admin/users/${id}/revoke-sessions`, { method: "POST" }); await loadUsers(); toast("تم إلغاء جلسات المستخدم"); } catch (error) { toast(error.message); }
  });

  $("#deleteUserButton").addEventListener("click", async () => {
    const id = $("#editUserId").value;
    const user = state.users.find((item) => item.id === id);
    if (!confirm(`حذف حساب ${user?.displayName || "المستخدم"} نهائياً مع غرفه وبياناته؟`)) return;
    try { await api(`/api/admin/users/${id}`, { method: "DELETE" }); $("#userDialog").close(); await loadUsers(); await loadRooms(); await loadAudit(); toast("تم حذف الحساب نهائياً"); } catch (error) { toast(error.message); }
  });

  $("#roomsList").addEventListener("click", async (event) => {
    const endButton = event.target.closest("[data-end-room]");
    const deleteButton = event.target.closest("[data-delete-room]");
    try {
      if (endButton && confirm("إنهاء الغرفة الآن وحذف رسائل جولتها؟")) await api(`/api/admin/rooms/${endButton.dataset.endRoom}/end`, { method: "POST" });
      else if (deleteButton && confirm("حذف سجل هذه الغرفة نهائياً؟")) await api(`/api/admin/rooms/${deleteButton.dataset.deleteRoom}`, { method: "DELETE" });
      else return;
      await loadRooms(); await loadAudit(); toast("تم تنفيذ العملية");
    } catch (error) { toast(error.message); }
  });

  $("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ maintenanceMode: $("#maintenanceMode").checked, registrationEnabled: $("#registrationEnabled").checked, roomCreationEnabled: $("#roomCreationEnabled").checked, maintenanceMessage: $("#maintenanceMessage").value }) });
      state.overview.settings = data.settings; fillSettings(data.settings); await loadAudit(); toast("تم حفظ إعدادات الموقع");
    } catch (error) { toast(error.message); }
  });

  $("#addAdminForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/admin/admins", { method: "POST", body: JSON.stringify({ email: $("#newAdminEmail").value.trim(), role: $("#newAdminRole").value }) });
      event.target.reset(); await loadAdmins(); await loadAudit(); toast("تم تحديث صلاحية الحساب");
    } catch (error) { toast(error.message); }
  });

  $("#adminsList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-admin]");
    if (!button || !confirm("إزالة صلاحية الإدارة من هذا الحساب؟")) return;
    try { await api(`/api/admin/admins/${button.dataset.removeAdmin}`, { method: "DELETE" }); await loadAdmins(); await loadAudit(); toast("تمت إزالة الصلاحية"); } catch (error) { toast(error.message); }
  });
}

async function bootstrap() {
  bindEvents();
  try {
    const auth = await api("/api/auth/me");
    if (!auth.user) return showGate("login");
    try { await loadDashboard(); } catch (error) { if (error.status === 403) showGate("denied"); else throw error; }
  } catch (error) {
    if (error.status === 401) showGate("login");
    else { showGate("login"); $("#adminLoginError").textContent = error.message; }
  }
  const authStatus = new URLSearchParams(location.search).get("auth");
  if (authStatus === "success") toast("تم تسجيل الدخول بنجاح");
  else if (authStatus) toast("تعذر إكمال تسجيل الدخول");
}

bootstrap();
