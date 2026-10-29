const MAX_MESSAGE_LENGTH = 180;
const SESSION_DAYS = 30;
const AVATAR_PRESETS = new Set(Array.from({ length: 10 }, (_, index) => `mask-${String(index + 1).padStart(2, "0")}`));
const BOT_NAMES = ["نادر", "سلمى", "مالك", "ليان", "ياسين", "مريم", "آدم", "نور", "سارة", "عمر", "هبة", "زياد", "رنا", "أيمن", "ندى", "أنس", "جنى", "سامي", "لمى", "كريم"];
const GAME_TYPES = new Set(["mafia", "imposter", "bluff"]);
const BLUFF_CARD_TYPES = [
  { id: "cockroach", name: "الصرصور", symbol: "▰", color: "#b9873f" },
  { id: "butterfly", name: "الفراشة", symbol: "✦", color: "#f39a3d" },
  { id: "frog", name: "الضفدع", symbol: "●", color: "#53a864" },
  { id: "fly", name: "الذبابة", symbol: "✣", color: "#55aee8" },
  { id: "bedbug", name: "البقّة", symbol: "◆", color: "#d75d66" },
  { id: "spider", name: "العنكبوت", symbol: "✳", color: "#9562d8" },
  { id: "worm", name: "الدودة", symbol: "∿", color: "#e476ad" },
  { id: "snail", name: "الحلزون", symbol: "◉", color: "#49b8ad" },
];
const BLUFF_CARD_TYPE_IDS = new Set(BLUFF_CARD_TYPES.map((type) => type.id));
const IMPOSTER_WORD_CLUSTERS = [
  ["أسد", "نمر", "فهد", "ضبع", "ذئب", "يغور", "وشق", "فهد ثلجي", "ابن آوى", "كوجر"],
  ["برتقال", "ليمون", "يوسفي", "جريب فروت", "بوملي", "ليم", "كمكوات", "أترج", "برتقال دموي", "كلمنتينا"],
  ["مطرقة", "مفك", "كماشة", "منشار", "مثقاب", "مفتاح ربط", "مبرد", "إزميل", "منجلة", "قاطعة"],
  ["قهوة", "شاي", "كاكاو", "زهورات", "زنجبيل", "قرفة", "سحلب", "يانسون", "نعناع", "بابونج"],
  ["واتساب", "تيليغرام", "سيغنال", "ماسنجر", "ديسكورد", "فايبر", "سكايب", "لاين", "وي تشات", "سلاك"],
  ["حافلة", "قطار", "ترام", "مترو", "سيارة أجرة", "عبّارة", "طائرة", "دراجة", "سفينة", "سيارة"],
];
const BOT_QUESTIONS = [
  "هل نراه كثيراً في حياتنا اليومية؟",
  "هل يحتاج إلى مكان خاص لاستعماله؟",
  "هل يرتبط أكثر بالداخل أم بالخارج؟",
  "هل يفضّله الناس عادةً أم يتجنبونه؟",
  "هل حجمه من الصفات المهمة فيه؟",
  "هل يمكن أن نستعمله أو نراه في أكثر من مكان؟",
];
const BOT_ANSWERS = [
  "غالباً نعم، لكن ذلك يعتمد على الموقف.",
  "ليس دائماً، وقد يختلف حسب طريقة الاستعمال.",
  "أراه أقرب إلى الخيار الأول، من دون أن أجزم.",
  "يمكن أن ينطبق عليه الأمران، لكن أحدهما أشهر.",
  "هذه صفة مهمة فيه، لكنها ليست الوحيدة.",
  "نعم إلى حدّ ما، ولا أريد أن أكشف الكلمة أكثر.",
];
const encoder = new TextEncoder();

function clean(value, fallback = "", max = 80) {
  const normalized = String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max);
  return normalized || fallback;
}

function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  return value < new Date().toISOString().slice(0, 10);
}

function escapeMarkup(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function pickBySeed(values, seed) {
  let hash = 0;
  for (const character of String(seed || "")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return values[Math.abs(hash) % Math.max(1, values.length)];
}

function imposterCountForPlayers(count) {
  if (count >= 13) return 3;
  if (count >= 7) return 2;
  return 1;
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get("Cookie") || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function liveKitJwt(env, { identity, name, room, canPublish, metadata }) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const encodedPayload = base64Url(encoder.encode(JSON.stringify({
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name,
    nbf: now - 5,
    exp: now + 600,
    metadata: JSON.stringify(metadata || {}),
    video: {
      roomJoin: true,
      room,
      canSubscribe: true,
      canPublish,
      canPublishData: false,
      canPublishSources: canPublish ? ["microphone"] : [],
    },
  })));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.LIVEKIT_API_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return base64(new Uint8Array(bits));
}

async function makePassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: base64(salt), hash: await passwordDigest(password, salt) };
}

async function verifyPassword(password, saltValue, expected) {
  if (!saltValue || !expected) return false;
  const actual = await passwordDigest(password, fromBase64(saltValue));
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function sessionCookie(token, request, maxAge = SESSION_DAYS * 86400) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `qinaa_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function publicUser(row, adminRole = null) {
  if (!row) return null;
  const profileComplete = Boolean(row.profile_completed);
  const missingFields = [];
  if (!profileComplete) {
    missingFields.push("username", "birthDate");
    if (!row.password_hash) missingFields.push("password");
    if (!/^\S+@\S+\.\S+$/.test(row.email || "") || row.email.endsWith("@qinaa.invalid")) missingFields.push("email");
    if (!clean(row.display_name, "", 40)) missingFields.push("displayName");
  }
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    birthDate: row.birth_date,
    avatarType: row.avatar_type,
    avatarValue: row.avatar_value,
    avatarUrl: row.avatar_type === "upload" ? `/api/profile/avatar/${row.id}?v=${encodeURIComponent(row.updated_at || "1")}` : null,
    profileComplete,
    hasPassword: Boolean(row.password_hash),
    adminRole,
    missingFields,
  };
}

async function getUser(request, env) {
  const token = parseCookies(request).qinaa_session;
  if (!token) return null;
  const sessionId = await sha256(token);
  return env.DB.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ? AND u.account_status = 'active' LIMIT 1
  `).bind(sessionId, new Date().toISOString()).first();
}

async function createSession(userId, request, env) {
  const token = randomToken();
  const sessionId = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, userId, expires.toISOString(), now.toISOString()).run();
  return sessionCookie(token, request);
}

function safeReturnPath(value) {
  const path = clean(value, "/", 120);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function bootstrapAdminEmails(env) {
  return new Set(String(env.ADMIN_EMAILS || "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function adminRecord(env, user) {
  if (!user) return null;
  let record = await env.DB.prepare("SELECT role, created_at FROM admins WHERE user_id = ? LIMIT 1").bind(user.id).first();
  if (!record && bootstrapAdminEmails(env).has(String(user.email || "").toLowerCase())) {
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO admins (user_id, role, created_by, created_at) VALUES (?, 'owner', ?, ?)").bind(user.id, user.id, now).run();
    record = { role: "owner", created_at: now };
  }
  return record;
}

async function adminContext(request, env, ownerOnly = false) {
  const user = await getUser(request, env);
  if (!user) return { response: json({ error: "يلزم تسجيل الدخول إلى حساب مشرف." }, 401) };
  const admin = await adminRecord(env, user);
  if (!admin || (ownerOnly && admin.role !== "owner")) return { response: json({ error: ownerOnly ? "هذه العملية متاحة لمالك المنصة فقط." : "ليس لهذا الحساب صلاحية الإدارة." }, 403) };
  return { user, admin };
}

async function settingValue(env, key, fallback = "") {
  const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = ? LIMIT 1").bind(key).first();
  return row?.value ?? fallback;
}

async function siteConfig(env) {
  const rows = await env.DB.prepare("SELECT key, value FROM site_settings").all();
  const values = Object.fromEntries(rows.results.map((row) => [row.key, row.value]));
  return {
    maintenanceMode: values.maintenance_mode === "1",
    registrationEnabled: values.registration_enabled !== "0",
    roomCreationEnabled: values.room_creation_enabled !== "0",
    maintenanceMessage: values.maintenance_message || "قِناع في صيانة قصيرة. سنعود قريباً.",
  };
}

function publicGamePage(row) {
  return {
    gameType: row.game_type,
    slug: row.slug,
    name: row.name,
    eyebrow: row.eyebrow,
    shortDescription: row.short_description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    keywords: row.keywords,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    url: `https://qinaaapp.com/games/${row.slug}`,
    updatedAt: row.updated_at,
  };
}

async function listGamePages(env) {
  const result = await env.DB.prepare("SELECT * FROM game_pages ORDER BY CASE game_type WHEN 'mafia' THEN 0 WHEN 'imposter' THEN 1 ELSE 2 END").all();
  return result.results.map(publicGamePage);
}

async function serveGameSeoPage(request, env, slug) {
  const row = await env.DB.prepare("SELECT * FROM game_pages WHERE slug = ? LIMIT 1").bind(slug).first();
  if (!row) return env.ASSETS.fetch(request);
  const page = publicGamePage(row);
  const indexUrl = new URL("/index.html", request.url);
  const asset = await env.ASSETS.fetch(new Request(indexUrl, { headers: request.headers }));
  let html = await asset.text();
  const canonical = `${new URL(request.url).origin}/games/${page.slug}`;
  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeMarkup(page.metaTitle)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeMarkup(page.metaDescription)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeMarkup(page.ogTitle)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeMarkup(page.ogDescription)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${escapeMarkup(canonical)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeMarkup(canonical)}" />`)
    .replace("</head>", `<meta name="keywords" content="${escapeMarkup(page.keywords)}" />\n    <meta property="og:type" content="website" />\n    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "VideoGame", name: page.name, description: page.metaDescription, inLanguage: "ar", url: canonical, applicationCategory: "Game" }).replaceAll("<", "\\u003c")}</script>\n  </head>`);
  return new Response(html, { status: asset.status, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "public, max-age=300" } });
}

async function serveSitemap(request, env) {
  const origin = new URL(request.url).origin;
  const pages = await listGamePages(env);
  const urls = ["/", "/rules", ...pages.map((page) => `/games/${page.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${escapeMarkup(`${origin}${path}`)}</loc></url>`).join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=UTF-8", "Cache-Control": "public, max-age=300" } });
}

async function auditAdmin(env, adminUserId, action, targetType, targetId = null, details = null) {
  await env.DB.prepare(`
    INSERT INTO admin_audit_log (id, admin_user_id, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), adminUserId, action, targetType, targetId, details ? JSON.stringify(details).slice(0, 2000) : null, new Date().toISOString()).run();
}

async function uniqueUsername(env, seed) {
  const base = clean(seed, "player", 16).toLowerCase().replace(/[^a-z0-9._-]+/g, "") || "player";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt ? `${base.slice(0, 15)}${Math.floor(100 + Math.random() * 900)}` : base;
    const exists = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(candidate).first();
    if (!exists) return candidate;
  }
  return `player${Date.now().toString().slice(-7)}`;
}

async function findOrCreateOAuthUser(env, provider, profile, allowCreate = true) {
  const linked = await env.DB.prepare(`
    SELECT u.* FROM oauth_accounts o JOIN users u ON u.id = o.user_id
    WHERE o.provider = ? AND o.provider_user_id = ? LIMIT 1
  `).bind(provider, profile.id).first();
  if (linked) return linked;
  const normalizedEmail = clean(profile.email, `${provider}-${profile.id}@qinaa.invalid`, 120).toLowerCase();
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").bind(normalizedEmail).first();
  const now = new Date().toISOString();
  if (!user) {
    if (!allowCreate) return null;
    const id = crypto.randomUUID();
    const username = await uniqueUsername(env, normalizedEmail.split("@")[0]);
    await env.DB.prepare(`
      INSERT INTO users (id, email, username, display_name, avatar_type, avatar_value, profile_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'preset', 'mask-01', 0, ?, ?)
    `).bind(id, normalizedEmail, username, clean(profile.name, username, 40), now, now).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  }
  await env.DB.prepare("INSERT OR IGNORE INTO oauth_accounts (provider, provider_user_id, user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(provider, profile.id, user.id, now).run();
  return user;
}

async function completeOAuthProfile(request, env, user) {
  if (user.profile_completed) return json({ user: publicUser(user) });
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const username = clean(input.username, "", 24).toLowerCase();
  const birthDate = clean(input.birthDate, "", 10);
  const password = String(input.password || "");
  const needsPassword = !user.password_hash;
  const needsEmail = !/^\S+@\S+\.\S+$/.test(user.email || "") || user.email.endsWith("@qinaa.invalid");
  const email = needsEmail ? clean(input.email, "", 120).toLowerCase() : user.email;
  const displayName = clean(user.display_name, clean(input.displayName, "", 40), 40);
  if (!displayName || displayName.length < 2) return json({ error: "اكتب اسماً ظاهراً من حرفين على الأقل." }, 400);
  if (!/^[\p{L}\p{N}._-]{3,24}$/u.test(username)) return json({ error: "اسم المستخدم غير صالح." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.endsWith("@qinaa.invalid")) return json({ error: "البريد الإلكتروني غير صالح." }, 400);
  if (!validBirthDate(birthDate)) return json({ error: "تاريخ الميلاد غير صالح." }, 400);
  if (needsPassword && password.length < 8) return json({ error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل." }, 400);
  const passwordData = needsPassword ? await makePassword(password) : { hash: user.password_hash, salt: user.password_salt };
  try {
    await env.DB.prepare(`
      UPDATE users SET email = ?, username = ?, display_name = ?, birth_date = ?, password_hash = ?, password_salt = ?, profile_completed = 1, updated_at = ?
      WHERE id = ?
    `).bind(email, username, displayName, birthDate, passwordData.hash, passwordData.salt, new Date().toISOString(), user.id).run();
  } catch (error) {
    const message = String(error);
    if (message.includes("users.email")) return json({ error: "هذا البريد مسجل من قبل." }, 409);
    if (message.includes("users.username")) return json({ error: "اسم المستخدم مستعمل من قبل." }, 409);
    throw error;
  }
  return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first()) });
}

async function register(request, env) {
  if (await settingValue(env, "registration_enabled", "1") === "0") return json({ error: "التسجيل متوقف مؤقتاً من إدارة قِناع." }, 503);
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const displayName = clean(input.displayName, "", 40);
  const username = clean(input.username, "", 24).toLowerCase();
  const email = clean(input.email, "", 120).toLowerCase();
  const birthDate = clean(input.birthDate, "", 10);
  const password = String(input.password || "");
  const avatarValue = AVATAR_PRESETS.has(input.avatarValue) ? input.avatarValue : "mask-01";
  if (displayName.length < 2) return json({ error: "الاسم الظاهر قصير جداً." }, 400);
  if (!/^[\p{L}\p{N}._-]{3,24}$/u.test(username)) return json({ error: "اسم المستخدم غير صالح." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "البريد الإلكتروني غير صالح." }, 400);
  if (!validBirthDate(birthDate)) return json({ error: "تاريخ الميلاد غير صالح." }, 400);
  if (password.length < 8) return json({ error: "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل." }, 400);
  const passwordData = await makePassword(password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO users (id, email, username, display_name, birth_date, password_hash, password_salt, avatar_type, avatar_value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'preset', ?, ?, ?)
    `).bind(id, email, username, displayName, birthDate, passwordData.hash, passwordData.salt, avatarValue, now, now).run();
  } catch (error) {
    const message = String(error);
    if (message.includes("users.email")) return json({ error: "هذا البريد مسجل من قبل." }, 409);
    if (message.includes("users.username")) return json({ error: "اسم المستخدم مستعمل من قبل." }, 409);
    throw error;
  }
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return json({ user: publicUser(user) }, 201, { "Set-Cookie": await createSession(id, request, env) });
}

async function login(request, env) {
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const loginValue = clean(input.login, "", 120).toLowerCase();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1").bind(loginValue, loginValue).first();
  if (!user || !await verifyPassword(String(input.password || ""), user.password_salt, user.password_hash)) return json({ error: "بيانات الدخول غير صحيحة." }, 401);
  if (user.account_status !== "active") return json({ error: "هذا الحساب موقوف. تواصل مع إدارة قِناع." }, 403);
  await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), user.id).run();
  return json({ user: publicUser(user) }, 200, { "Set-Cookie": await createSession(user.id, request, env) });
}

async function updateProfile(request, env, user) {
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const displayName = clean(input.displayName, user.display_name, 40);
  const username = clean(input.username, user.username, 24).toLowerCase();
  const birthDate = clean(input.birthDate, user.birth_date || "", 10);
  const avatarValue = AVATAR_PRESETS.has(input.avatarValue) ? input.avatarValue : null;
  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");
  if (displayName.length < 2) return json({ error: "الاسم الظاهر قصير جداً." }, 400);
  if (!/^[\p{L}\p{N}._-]{3,24}$/u.test(username)) return json({ error: "اسم المستخدم غير صالح." }, 400);
  if (!validBirthDate(birthDate)) return json({ error: "تاريخ الميلاد غير صالح." }, 400);
  let passwordHash = user.password_hash;
  let passwordSalt = user.password_salt;
  if (newPassword) {
    if (newPassword.length < 8) return json({ error: "كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل." }, 400);
    if (user.password_hash && !await verifyPassword(currentPassword, user.password_salt, user.password_hash)) return json({ error: "كلمة المرور الحالية غير صحيحة." }, 401);
    const passwordData = await makePassword(newPassword);
    passwordHash = passwordData.hash;
    passwordSalt = passwordData.salt;
  }
  try {
    await env.DB.prepare(`
      UPDATE users SET display_name = ?, username = ?, birth_date = ?, password_hash = ?, password_salt = ?,
        avatar_type = ?, avatar_value = ?, updated_at = ? WHERE id = ?
    `).bind(displayName, username, birthDate, passwordHash, passwordSalt, avatarValue ? "preset" : user.avatar_type, avatarValue || user.avatar_value, new Date().toISOString(), user.id).run();
  } catch (error) {
    if (String(error).includes("users.username")) return json({ error: "اسم المستخدم مستعمل من حساب آخر." }, 409);
    throw error;
  }
  if (avatarValue) await env.DB.prepare("DELETE FROM avatar_uploads WHERE user_id = ?").bind(user.id).run();
  return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first()) });
}

async function uploadAvatar(request, env, user) {
  const form = await request.formData();
  const image = form.get("image");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!(image instanceof File) || !allowed.has(image.type)) return json({ error: "اختر صورة PNG أو JPG أو WebP." }, 400);
  if (image.size > 350000) return json({ error: "حجم الصورة يجب ألا يتجاوز 350KB." }, 413);
  const bytes = await image.arrayBuffer();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO avatar_uploads (user_id, mime_type, image_data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET mime_type = excluded.mime_type, image_data = excluded.image_data, updated_at = excluded.updated_at
  `).bind(user.id, image.type, bytes, now).run();
  await env.DB.prepare("UPDATE users SET avatar_type = 'upload', avatar_value = 'custom', updated_at = ? WHERE id = ?").bind(now, user.id).run();
  return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first()) });
}

async function listSocialFriends(env, user) {
  const result = await env.DB.prepare(`
    SELECT u.* FROM social_friends f
    JOIN oauth_accounts o ON o.provider = f.provider AND o.provider_user_id = f.provider_friend_id
    JOIN users u ON u.id = o.user_id
    WHERE f.user_id = ? AND f.provider = 'facebook' ORDER BY u.display_name LIMIT 200
  `).bind(user.id).all();
  return json({ friends: result.results.map(publicUser) });
}

async function oauthStart(request, env, provider) {
  const url = new URL(request.url);
  const state = randomToken(18);
  const returnTo = safeReturnPath(url.searchParams.get("return") || "/");
  const redirectUri = `${url.origin}/api/auth/${provider}/callback`;
  const secure = url.protocol === "https:" ? "; Secure" : "";
  let target;
  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return Response.redirect(`${url.origin}/?auth=google-not-configured`, 302);
    target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
  } else {
    if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) return Response.redirect(`${url.origin}/?auth=facebook-not-configured`, 302);
    const version = env.FACEBOOK_GRAPH_VERSION || "v24.0";
    target = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
    target.search = new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, redirect_uri: redirectUri, response_type: "code", scope: "email,public_profile,user_friends", state });
  }
  const headers = new Headers({ Location: target.toString() });
  headers.append("Set-Cookie", `qinaa_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  headers.append("Set-Cookie", `qinaa_oauth_return=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  return new Response(null, { status: 302, headers });
}

async function oauthCallback(request, env, provider) {
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  const returnTo = safeReturnPath(cookies.qinaa_oauth_return || "/");
  if (!url.searchParams.get("code") || url.searchParams.get("state") !== cookies.qinaa_oauth_state) return Response.redirect(`${url.origin}${returnTo}?auth=failed`, 302);
  const redirectUri = `${url.origin}/api/auth/${provider}/callback`;
  let profile;
  if (provider === "google") {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: url.searchParams.get("code"), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return Response.redirect(`${url.origin}/?auth=failed`, 302);
    const data = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
    profile = { id: data.sub, email: data.email, name: data.name };
  } else {
    const version = env.FACEBOOK_GRAPH_VERSION || "v24.0";
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({ client_id: env.FACEBOOK_APP_ID, client_secret: env.FACEBOOK_APP_SECRET, redirect_uri: redirectUri, code: url.searchParams.get("code") });
    const tokens = await (await fetch(tokenUrl)).json();
    if (!tokens.access_token) return Response.redirect(`${url.origin}/?auth=failed`, 302);
    const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
    profileUrl.search = new URLSearchParams({ fields: "id,name,email,friends.limit(100)", access_token: tokens.access_token });
    const data = await (await fetch(profileUrl)).json();
    profile = { id: data.id, email: data.email, name: data.name, friends: data.friends?.data || [] };
  }
  if (!profile?.id) return Response.redirect(`${url.origin}/?auth=failed`, 302);
  const registrationEnabled = await settingValue(env, "registration_enabled", "1") !== "0";
  const user = await findOrCreateOAuthUser(env, provider, profile, registrationEnabled);
  if (!user) return Response.redirect(`${url.origin}${returnTo}?auth=registration-closed`, 302);
  if (user.account_status !== "active") return Response.redirect(`${url.origin}${returnTo}?auth=suspended`, 302);
  if (provider === "facebook") {
    const now = new Date().toISOString();
    await env.DB.prepare("DELETE FROM social_friends WHERE user_id = ? AND provider = 'facebook'").bind(user.id).run();
    if (profile.friends?.length) await env.DB.batch(profile.friends.map((friend) => env.DB.prepare("INSERT OR IGNORE INTO social_friends (user_id, provider, provider_friend_id, created_at) VALUES (?, 'facebook', ?, ?)").bind(user.id, friend.id, now)));
  }
  await env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), user.id).run();
  const destination = `${url.origin}${returnTo}`;
  const headers = new Headers({ Location: destination });
  headers.append("Set-Cookie", await createSession(user.id, request, env));
  headers.append("Set-Cookie", `qinaa_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  headers.append("Set-Cookie", `qinaa_oauth_return=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

function clientRoom(row) {
  return { id: row.id, code: row.code, name: row.name, gameType: row.game_type || "mafia", status: row.status === "playing" ? "جولة جارية" : "بانتظار اللاعبين", phase: row.status === "playing" ? "night" : "day", players: Number(row.players || 0), capacity: Number(row.capacity || 20), spectators: 0, private: Boolean(row.is_private), hostUserId: row.host_user_id };
}

function isBotId(userId) {
  return String(userId || "").startsWith("qinaa-bot-");
}

function roomChatStub(env, roomName) {
  const id = env.ROOM_CHAT.idFromName(String(roomName || "").toLowerCase());
  return env.ROOM_CHAT.get(id);
}

async function notifyGameSync(env, code, phase, gameType = "imposter") {
  try {
    await roomChatStub(env, code).fetch(new Request("https://qinaa.internal/internal/game-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameType, phase }),
    }));
  } catch (error) {
    console.error(error);
  }
}

async function postBotChatMessage(env, context, userId, body) {
  const response = await roomChatStub(env, context.code).fetch(new Request("https://qinaa.internal/internal/bot-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: context.room_id, roundId: context.round_id, userId, body }),
  }));
  if (!response.ok) throw new Error(`Bot chat failed with ${response.status}`);
}

async function ensureBotUser(env, slot) {
  const number = String(slot).padStart(2, "0");
  const id = `qinaa-bot-${number}`;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO users
      (id, email, username, display_name, birth_date, password_hash, password_salt, avatar_type, avatar_value, created_at, updated_at, profile_completed)
    VALUES (?, ?, ?, ?, '2000-01-01', NULL, NULL, 'preset', ?, ?, ?, 1)
  `).bind(id, `bot${number}@qinaa.invalid`, `qinaa.bot${number}`, `روبوت ${BOT_NAMES[slot - 1] || number}`, `mask-${String(((slot - 1) % 10) + 1).padStart(2, "0")}`, now, now).run();
  return id;
}

async function availableBotSlot(env, roomId) {
  const used = await env.DB.prepare("SELECT user_id FROM room_members WHERE room_id = ? AND user_id LIKE 'qinaa-bot-%'").bind(roomId).all();
  const usedIds = new Set(used.results.map((row) => row.user_id));
  for (let slot = 1; slot <= BOT_NAMES.length; slot += 1) {
    if (!usedIds.has(`qinaa-bot-${String(slot).padStart(2, "0")}`)) return slot;
  }
  return null;
}

async function addBotMember(env, roomId, roundId, { role = null, alive = true } = {}) {
  const slot = await availableBotSlot(env, roomId);
  if (!slot) return null;
  const botId = await ensureBotUser(env, slot);
  await env.DB.prepare("INSERT INTO room_members (room_id, user_id, round_id, role, alive, joined_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(roomId, botId, roundId || null, role, alive ? 1 : 0, new Date().toISOString()).run();
  return botId;
}

async function fillRoomWithBots(env, roomId, roundId, minimum = 5) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM room_members WHERE room_id = ?").bind(roomId).first();
  const added = [];
  for (let index = Number(count?.total || 0); index < minimum; index += 1) {
    const botId = await addBotMember(env, roomId, roundId);
    if (!botId) break;
    added.push(botId);
  }
  return added;
}

async function replaceMemberWithBot(env, room, targetUserId) {
  const member = await env.DB.prepare("SELECT round_id, role, alive FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, targetUserId).first();
  if (!member || isBotId(targetUserId)) return null;
  const botId = await addBotMember(env, room.id, member.round_id, { role: member.role, alive: Boolean(member.alive) });
  if (!botId) return null;
  if (room.game_type === "imposter" && member.round_id) {
    const stateRow = await env.DB.prepare("SELECT question_order FROM imposter_round_state WHERE round_id = ? LIMIT 1").bind(member.round_id).first();
    let order = [];
    try { order = JSON.parse(stateRow?.question_order || "[]"); } catch (_) { order = []; }
    order = order.map((userId) => userId === targetUserId ? botId : userId);
    await env.DB.batch([
      env.DB.prepare("UPDATE imposter_assignments SET user_id = ?, ready_at = COALESCE(ready_at, ?) WHERE round_id = ? AND user_id = ?").bind(botId, new Date().toISOString(), member.round_id, targetUserId),
      env.DB.prepare("UPDATE imposter_ballots SET voter_user_id = ? WHERE round_id = ? AND voter_user_id = ?").bind(botId, member.round_id, targetUserId),
      env.DB.prepare("UPDATE imposter_round_state SET question_order = ?, updated_at = ? WHERE round_id = ?").bind(JSON.stringify(order), new Date().toISOString(), member.round_id),
    ]);
  }
  if (room.game_type === "bluff" && member.round_id) {
    const stateRow = await env.DB.prepare("SELECT seen_user_ids FROM bluff_round_state WHERE round_id = ? LIMIT 1").bind(member.round_id).first();
    let seen = [];
    try { seen = JSON.parse(stateRow?.seen_user_ids || "[]"); } catch (_) { seen = []; }
    seen = seen.map((userId) => userId === targetUserId ? botId : userId);
    const bluffPlayer = await env.DB.prepare("SELECT eliminated_at, placement FROM bluff_players WHERE round_id = ? AND user_id = ?").bind(member.round_id, targetUserId).first();
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO bluff_players (round_id, user_id, eliminated_at, placement) VALUES (?, ?, ?, ?)").bind(member.round_id, botId, bluffPlayer?.eliminated_at || null, bluffPlayer?.placement || null),
      env.DB.prepare("UPDATE bluff_cards SET owner_user_id = ? WHERE round_id = ? AND owner_user_id = ?").bind(botId, member.round_id, targetUserId),
      env.DB.prepare(`
        UPDATE bluff_round_state SET
          current_player_id = CASE WHEN current_player_id = ? THEN ? ELSE current_player_id END,
          sender_user_id = CASE WHEN sender_user_id = ? THEN ? ELSE sender_user_id END,
          receiver_user_id = CASE WHEN receiver_user_id = ? THEN ? ELSE receiver_user_id END,
          winner_user_id = CASE WHEN winner_user_id = ? THEN ? ELSE winner_user_id END,
          seen_user_ids = ?, updated_at = ? WHERE round_id = ?
      `).bind(targetUserId, botId, targetUserId, botId, targetUserId, botId, targetUserId, botId, JSON.stringify(seen), new Date().toISOString(), member.round_id),
      env.DB.prepare("DELETE FROM bluff_players WHERE round_id = ? AND user_id = ?").bind(member.round_id, targetUserId),
    ]);
  }
  await env.DB.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, targetUserId).run();
  return botId;
}

async function listRooms(url, env) {
  const gameType = GAME_TYPES.has(url.searchParams.get("game")) ? url.searchParams.get("game") : null;
  const result = await env.DB.prepare(`
    SELECT r.*, COUNT(m.user_id) AS players FROM rooms r LEFT JOIN room_members m ON m.room_id = r.id
    WHERE r.ended_at IS NULL AND r.is_private = 0 AND (? IS NULL OR r.game_type = ?) GROUP BY r.id ORDER BY r.created_at DESC LIMIT 30
  `).bind(gameType, gameType).all();
  return json({ rooms: result.results.map(clientRoom) });
}

async function roomRecord(env, code) {
  return env.DB.prepare(`
    SELECT r.*, COUNT(m.user_id) AS players FROM rooms r LEFT JOIN room_members m ON m.room_id = r.id
    WHERE r.code = ? GROUP BY r.id LIMIT 1
  `).bind(code).first();
}

async function roomDetails(request, env, code) {
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ error: "انتهت هذه الجولة.", ended: true }, 410);
  const user = await getUser(request, env);
  const viewerMember = user ? await env.DB.prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, user.id).first() : null;
  if (room.is_private && !viewerMember) return json({ error: "هذه الغرفة خاصة." }, 404);
  const members = await env.DB.prepare(`
    SELECT u.id, u.display_name, u.username, u.avatar_type, u.avatar_value, m.alive,
      CASE WHEN r.host_user_id = u.id THEN 1 ELSE 0 END AS is_host
    FROM room_members m JOIN users u ON u.id = m.user_id JOIN rooms r ON r.id = m.room_id
    WHERE m.room_id = ? ORDER BY m.joined_at
  `).bind(room.id).all();
  const round = await env.DB.prepare("SELECT id, number, status FROM rounds WHERE room_id = ? AND status = 'active' ORDER BY number DESC LIMIT 1").bind(room.id).first();
  return json({ room: clientRoom(room), round, viewerMember: Boolean(viewerMember), members: members.results.map((member) => ({ id: member.id, name: member.display_name, username: member.username, avatarType: member.avatar_type, avatarValue: member.avatar_value, alive: Boolean(member.alive), host: Boolean(member.is_host), bot: isBotId(member.id) })) });
}

async function createRoom(request, env, user) {
  const config = await siteConfig(env);
  if (config.maintenanceMode) return json({ error: config.maintenanceMessage }, 503);
  if (!config.roomCreationEnabled) return json({ error: "إنشاء الغرف متوقف مؤقتاً من الإدارة." }, 503);
  let input = {};
  try { input = await request.json(); } catch (_) { /* Defaults are valid. */ }
  const gameType = GAME_TYPES.has(input.gameType) ? input.gameType : "mafia";
  let code;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    if (!await env.DB.prepare("SELECT 1 FROM rooms WHERE code = ?").bind(candidate).first()) { code = candidate; break; }
  }
  if (!code) return json({ error: "تعذر إنشاء رمز غرفة الآن." }, 503);
  const roomId = crypto.randomUUID();
  const roundId = crypto.randomUUID();
  const now = new Date().toISOString();
  const capacity = gameType === "imposter" ? 18 : gameType === "bluff" ? 5 : 20;
  const defaultName = gameType === "imposter" ? `مجلس الدخيل · ${user.display_name}` : gameType === "bluff" ? `طاولة بطاقة الخداع · ${user.display_name}` : `غرفة ${user.display_name}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO rooms (id, code, name, host_user_id, is_private, capacity, game_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(roomId, code, clean(input.name, defaultName, 60), user.id, input.private ? 1 : 0, capacity, gameType, now),
    env.DB.prepare("INSERT INTO rounds (id, room_id, number, status, created_at) VALUES (?, ?, 1, 'active', ?)").bind(roundId, roomId, now),
    env.DB.prepare("INSERT INTO room_members (room_id, user_id, round_id, alive, joined_at) VALUES (?, ?, ?, 1, ?)").bind(roomId, user.id, roundId, now),
  ]);
  return json({ room: clientRoom(await roomRecord(env, code)) }, 201);
}

async function joinRoom(env, code, user) {
  const config = await siteConfig(env);
  if (config.maintenanceMode) return json({ error: config.maintenanceMessage }, 503);
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ error: "هذه الجولة لم تعد متاحة.", ended: true }, 410);
  if (room.status === "playing") return json({ error: "بدأت الجولة بالفعل. يمكنك متابعتها كمشاهد حتى تنتهي." }, 409);
  if (Number(room.players) >= Number(room.capacity)) return json({ error: "الغرفة مكتملة." }, 409);
  const round = await env.DB.prepare("SELECT id FROM rounds WHERE room_id = ? AND status = 'active' ORDER BY number DESC LIMIT 1").bind(room.id).first();
  await env.DB.prepare("INSERT OR IGNORE INTO room_members (room_id, user_id, round_id, alive, joined_at) VALUES (?, ?, ?, 1, ?)").bind(room.id, user.id, round?.id || null, new Date().toISOString()).run();
  return json({ room: clientRoom(await roomRecord(env, code)) });
}

async function updateRoom(request, env, code, user) {
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ error: "هذه الجولة لم تعد متاحة." }, 410);
  if (room.host_user_id !== user.id) return json({ error: "المضيف وحده يستطيع تعديل الغرفة." }, 403);
  let input = {};
  try { input = await request.json(); } catch (_) { /* No changes. */ }
  await env.DB.prepare("UPDATE rooms SET is_private = ?, name = ? WHERE id = ?")
    .bind(input.private ? 1 : 0, clean(input.name, room.name, 60), room.id).run();
  return json({ room: clientRoom(await roomRecord(env, code)) });
}

async function kickMember(env, code, user, targetUserId) {
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ error: "هذه الجولة لم تعد متاحة." }, 410);
  if (room.host_user_id !== user.id) return json({ error: "المضيف وحده يستطيع إخراج اللاعبين." }, 403);
  if (targetUserId === user.id) return json({ error: "لا يمكن للمضيف إخراج نفسه." }, 400);
  if (isBotId(targetUserId)) return json({ error: "لا يمكن إخراج روبوت أثناء الجولة." }, 400);
  const botReplacement = room.status === "playing" ? await replaceMemberWithBot(env, room, targetUserId) : null;
  if (!botReplacement) await env.DB.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, targetUserId).run();
  return json({ ok: true, botReplacement });
}

async function leaveRoom(env, code, user) {
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ left: true, ended: true });
  const member = await env.DB.prepare("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, user.id).first();
  if (!member) return json({ left: true });
  const nextHuman = await env.DB.prepare(`
    SELECT user_id FROM room_members
    WHERE room_id = ? AND user_id != ? AND user_id NOT LIKE 'qinaa-bot-%'
    ORDER BY joined_at LIMIT 1
  `).bind(room.id, user.id).first();
  if (room.host_user_id === user.id && !nextHuman) {
    await endRoom(env, code, user);
    return json({ left: true, ended: true });
  }
  const botReplacement = room.status === "playing" ? await replaceMemberWithBot(env, room, user.id) : null;
  if (!botReplacement) await env.DB.prepare("DELETE FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.id, user.id).run();
  if (room.host_user_id === user.id && nextHuman) {
    await env.DB.prepare("UPDATE rooms SET host_user_id = ? WHERE id = ?").bind(nextHuman.user_id, room.id).run();
  }
  return json({ left: true, botReplacement, newHostUserId: room.host_user_id === user.id ? nextHuman?.user_id || null : room.host_user_id });
}

function roleDeck(count, options = {}) {
  const shadowCount = count >= 16 ? 4 : count >= 12 ? 3 : count >= 8 ? 2 : 1;
  const deck = Array(shadowCount).fill("أفراد الظل");
  if (count >= 5) deck.push("المُنقذ", "الشيخ");
  if (count >= 8 && deck.length < count) deck.push("الكشّاف");
  if (options.witch && deck.length < count) deck.push("الساحرة");
  if (options.cupid && deck.length < count) deck.push("الخطّابة");
  while (deck.length < count) deck.push("البريء");
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}

async function activeImposterContext(env, code) {
  return env.DB.prepare(`
    SELECT r.id AS room_id, r.code, r.host_user_id, r.status AS room_status, r.is_private, r.ended_at,
      rd.id AS round_id, rd.number, s.phase, s.secret_word, s.candidate_words, s.question_order,
      s.current_index, s.turn_stage, s.imposter_count, s.vote_deadline, s.results_json
    FROM rooms r JOIN rounds rd ON rd.room_id = r.id
    LEFT JOIN imposter_round_state s ON s.round_id = rd.id
    WHERE r.code = ? AND r.game_type = 'imposter' AND rd.status = 'active'
    ORDER BY rd.number DESC LIMIT 1
  `).bind(code).first();
}

async function startImposterRound(env, room, round, user) {
  const botsAdded = await fillRoomWithBots(env, room.id, round?.id, 4);
  const members = await env.DB.prepare(`
    SELECT m.user_id FROM room_members m WHERE m.room_id = ? ORDER BY m.joined_at
  `).bind(room.id).all();
  const playerIds = members.results.map((member) => member.user_id);
  if (playerIds.length < 4) return json({ error: "تحتاج لعبة الدخيل إلى أربعة لاعبين على الأقل." }, 409);
  if (playerIds.length > 18) return json({ error: "الحد الأقصى للعبة الدخيل هو 18 لاعباً." }, 409);
  const imposterCount = imposterCountForPlayers(playerIds.length);
  const imposters = new Set(shuffled(playerIds).slice(0, imposterCount));
  const cluster = IMPOSTER_WORD_CLUSTERS[Math.floor(Math.random() * IMPOSTER_WORD_CLUSTERS.length)];
  const secretWord = cluster[Math.floor(Math.random() * cluster.length)];
  const candidateCount = imposterCount === 1 ? 6 : imposterCount === 2 ? 8 : 10;
  const candidates = shuffled([secretWord, ...shuffled(cluster.filter((word) => word !== secretWord)).slice(0, candidateCount - 1)]);
  const questionOrder = shuffled(playerIds);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO imposter_round_state
        (round_id, phase, secret_word, candidate_words, question_order, current_index, turn_stage, imposter_count, created_at, updated_at)
      VALUES (?, 'reveal', ?, ?, ?, 0, 'question', ?, ?, ?)
    `).bind(round.id, secretWord, JSON.stringify(candidates), JSON.stringify(questionOrder), imposterCount, now, now),
    ...playerIds.map((userId) => env.DB.prepare(`
      INSERT INTO imposter_assignments (round_id, user_id, is_imposter, ready_at) VALUES (?, ?, ?, ?)
    `).bind(round.id, userId, imposters.has(userId) ? 1 : 0, isBotId(userId) ? now : null)),
    ...playerIds.map((userId) => env.DB.prepare("UPDATE room_members SET role = ?, alive = 1, round_id = ? WHERE room_id = ? AND user_id = ?")
      .bind(imposters.has(userId) ? "الدخيل" : "عارف الكلمة", round.id, room.id, userId)),
    env.DB.prepare("UPDATE rooms SET status = 'playing' WHERE id = ?").bind(room.id),
  ]);
  return json({ started: true, gameType: "imposter", imposterCount, botsAdded: botsAdded.length, role: imposters.has(user.id) ? "الدخيل" : "عارف الكلمة" });
}

async function runImposterBotActions(env, context) {
  if (!context) return context;
  let current = context;
  if (current.phase === "reveal") {
    const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN ready_at IS NOT NULL THEN 1 ELSE 0 END) AS ready FROM imposter_assignments WHERE round_id = ?").bind(current.round_id).first();
    if (Number(counts.ready || 0) >= Number(counts.total || 0)) {
      await env.DB.prepare("UPDATE imposter_round_state SET phase = 'questions', updated_at = ? WHERE round_id = ?").bind(new Date().toISOString(), current.round_id).run();
      current = await activeImposterContext(env, current.code);
    }
  }
  for (let guard = 0; guard < 24 && current.phase === "questions"; guard += 1) {
    const order = JSON.parse(current.question_order || "[]");
    const index = Number(current.current_index || 0);
    const askerId = order[index % order.length];
    const answererId = order[(index + 1) % order.length];
    const actorId = current.turn_stage === "question" ? askerId : answererId;
    if (!isBotId(actorId)) break;
    const now = new Date().toISOString();
    const participants = await env.DB.prepare("SELECT id, display_name FROM users WHERE id IN (?, ?)").bind(askerId, answererId).all();
    const names = Object.fromEntries(participants.results.map((participant) => [participant.id, participant.display_name]));
    const botBody = current.turn_stage === "question"
      ? `سؤالي لـ${names[answererId] || "اللاعب"}: ${pickBySeed(BOT_QUESTIONS, `${current.round_id}:${index}:question:${actorId}`)}`
      : pickBySeed(BOT_ANSWERS, `${current.round_id}:${index}:answer:${actorId}`);
    try { await postBotChatMessage(env, current, actorId, botBody); } catch (error) { console.error(error); }
    if (current.turn_stage === "question") {
      await env.DB.prepare("UPDATE imposter_round_state SET turn_stage = 'answer', updated_at = ? WHERE round_id = ?").bind(now, current.round_id).run();
    } else if (index + 1 >= order.length) {
      await env.DB.prepare("UPDATE imposter_round_state SET phase = 'vote', vote_deadline = ?, updated_at = ? WHERE round_id = ?")
        .bind(new Date(Date.now() + 30000).toISOString(), now, current.round_id).run();
    } else {
      await env.DB.prepare("UPDATE imposter_round_state SET current_index = ?, turn_stage = 'question', updated_at = ? WHERE round_id = ?").bind(index + 1, now, current.round_id).run();
    }
    current = await activeImposterContext(env, current.code);
  }
  if (current.phase === "vote") {
    const bots = await env.DB.prepare(`
      SELECT a.user_id, a.is_imposter FROM imposter_assignments a
      LEFT JOIN imposter_ballots b ON b.round_id = a.round_id AND b.voter_user_id = a.user_id
      WHERE a.round_id = ? AND a.user_id LIKE 'qinaa-bot-%' AND b.voter_user_id IS NULL
    `).bind(current.round_id).all();
    const players = (await env.DB.prepare("SELECT user_id FROM room_members WHERE room_id = ?").bind(current.room_id).all()).results.map((row) => row.user_id);
    const candidates = JSON.parse(current.candidate_words || "[]");
    const now = new Date().toISOString();
    const statements = [];
    bots.results.forEach((bot) => {
      const selections = shuffled(players.filter((userId) => userId !== bot.user_id)).slice(0, Number(current.imposter_count || 1));
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO imposter_ballots (round_id, voter_user_id, selections_json, confirmed_at) VALUES (?, ?, ?, ?)").bind(current.round_id, bot.user_id, JSON.stringify(selections), now));
      if (bot.is_imposter) statements.push(env.DB.prepare("UPDATE imposter_assignments SET word_choice = ?, word_confirmed_at = ? WHERE round_id = ? AND user_id = ? AND word_confirmed_at IS NULL").bind(candidates[Math.floor(Math.random() * candidates.length)] || null, now, current.round_id, bot.user_id));
    });
    if (statements.length) await env.DB.batch(statements);
  }
  return current;
}

async function maybeFinalizeImposter(env, context) {
  if (!context || context.phase !== "vote") return context;
  const now = new Date();
  const deadlineReached = context.vote_deadline && new Date(context.vote_deadline) <= now;
  const totals = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM room_members WHERE room_id = ?) AS players,
      (SELECT COUNT(*) FROM imposter_ballots WHERE round_id = ?) AS ballots,
      (SELECT COUNT(*) FROM imposter_assignments WHERE round_id = ? AND is_imposter = 1 AND word_confirmed_at IS NOT NULL) AS word_choices
  `).bind(context.room_id, context.round_id, context.round_id).first();
  const complete = Number(totals.ballots || 0) >= Number(totals.players || 0) && Number(totals.word_choices || 0) >= Number(context.imposter_count || 0);
  if (!deadlineReached && !complete) return context;

  const [ballots, assignments] = await Promise.all([
    env.DB.prepare("SELECT selections_json FROM imposter_ballots WHERE round_id = ?").bind(context.round_id).all(),
    env.DB.prepare("SELECT user_id, is_imposter, word_choice FROM imposter_assignments WHERE round_id = ?").bind(context.round_id).all(),
  ]);
  const voteCounts = {};
  ballots.results.forEach((ballot) => {
    let selections = [];
    try { selections = JSON.parse(ballot.selections_json); } catch (_) { selections = []; }
    selections.forEach((userId) => { voteCounts[userId] = Number(voteCounts[userId] || 0) + 1; });
  });
  const ranked = Object.entries(voteCounts).sort((left, right) => right[1] - left[1]);
  const limit = Number(context.imposter_count || 1);
  const cutoff = ranked[limit - 1]?.[1] || 0;
  const above = ranked.filter(([, count]) => count > cutoff).map(([userId]) => userId);
  const tiedAtCutoff = ranked.filter(([, count]) => count === cutoff && cutoff > 0);
  const accused = above.length + tiedAtCutoff.length === limit ? [...above, ...tiedAtCutoff.map(([userId]) => userId)] : above;
  const imposters = assignments.results.filter((entry) => entry.is_imposter).map((entry) => entry.user_id);
  const wordChoices = Object.fromEntries(assignments.results.filter((entry) => entry.is_imposter).map((entry) => [entry.user_id, entry.word_choice || null]));
  const allCaught = imposters.every((userId) => accused.includes(userId));
  const allWrong = imposters.every((userId) => wordChoices[userId] !== context.secret_word);
  const winner = allCaught && allWrong ? "knowers" : "imposters";
  const results = { secretWord: context.secret_word, imposters, accused, voteCounts, wordChoices, winner, tieAtCutoff: accused.length < limit };
  await env.DB.prepare("UPDATE imposter_round_state SET phase = 'results', results_json = ?, updated_at = ? WHERE round_id = ?")
    .bind(JSON.stringify(results), now.toISOString(), context.round_id).run();
  await notifyGameSync(env, context.code, "results");
  return { ...context, phase: "results", results_json: JSON.stringify(results) };
}

async function imposterState(request, env, code) {
  let context = await activeImposterContext(env, code);
  if (!context || context.ended_at || !context.phase) return json({ error: "لم تبدأ جولة الدخيل بعد." }, 409);
  context = await runImposterBotActions(env, context);
  context = await activeImposterContext(env, code);
  context = await maybeFinalizeImposter(env, context);
  const user = await getUser(request, env);
  const members = await env.DB.prepare(`
    SELECT u.id, u.display_name, u.avatar_type, u.avatar_value, CASE WHEN r.host_user_id = u.id THEN 1 ELSE 0 END AS is_host
    FROM room_members m JOIN users u ON u.id = m.user_id JOIN rooms r ON r.id = m.room_id
    WHERE m.room_id = ? ORDER BY m.joined_at
  `).bind(context.room_id).all();
  const assignment = user ? await env.DB.prepare("SELECT * FROM imposter_assignments WHERE round_id = ? AND user_id = ? LIMIT 1").bind(context.round_id, user.id).first() : null;
  if (context.is_private && !assignment) return json({ error: "هذه الغرفة خاصة." }, 403);
  const ballot = user ? await env.DB.prepare("SELECT selections_json, confirmed_at FROM imposter_ballots WHERE round_id = ? AND voter_user_id = ? LIMIT 1").bind(context.round_id, user.id).first() : null;
  const order = JSON.parse(context.question_order || "[]");
  const askerId = order.length ? order[Number(context.current_index || 0) % order.length] : null;
  const answererId = order.length ? order[(Number(context.current_index || 0) + 1) % order.length] : null;
  const secondsRemaining = context.phase === "vote" && context.vote_deadline ? Math.max(0, Math.ceil((new Date(context.vote_deadline).getTime() - Date.now()) / 1000)) : null;
  let selections = [];
  try { selections = ballot ? JSON.parse(ballot.selections_json) : []; } catch (_) { selections = []; }
  const payload = {
    gameType: "imposter",
    round: Number(context.number || 1),
    phase: context.phase,
    imposterCount: Number(context.imposter_count || 1),
    currentIndex: Number(context.current_index || 0),
    totalTurns: order.length,
    turnStage: context.turn_stage,
    askerId,
    answererId,
    voteSecondsRemaining: secondsRemaining,
    players: members.results.map((member) => ({ id: member.id, name: member.display_name, avatarType: member.avatar_type, avatarValue: member.avatar_value, host: Boolean(member.is_host) })),
    me: assignment ? {
      id: user.id,
      role: assignment.is_imposter ? "الدخيل" : "عارف الكلمة",
      secretWord: assignment.is_imposter ? null : context.secret_word,
      candidates: assignment.is_imposter && context.phase === "vote" ? JSON.parse(context.candidate_words || "[]") : [],
      ready: Boolean(assignment.ready_at),
      wordChoice: assignment.word_choice || null,
      wordConfirmed: Boolean(assignment.word_confirmed_at),
      voteSelections: selections,
      voteConfirmed: Boolean(ballot?.confirmed_at),
    } : null,
    results: context.phase === "results" && context.results_json ? JSON.parse(context.results_json) : null,
  };
  return json(payload);
}

async function imposterReady(env, code, user) {
  const context = await activeImposterContext(env, code);
  if (!context || context.phase !== "reveal") return json({ error: "مرحلة كشف الدور انتهت." }, 409);
  const assignment = await env.DB.prepare("SELECT 1 FROM imposter_assignments WHERE round_id = ? AND user_id = ?").bind(context.round_id, user.id).first();
  if (!assignment) return json({ error: "أنت تشاهد الغرفة ولست لاعباً فيها." }, 403);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE imposter_assignments SET ready_at = COALESCE(ready_at, ?) WHERE round_id = ? AND user_id = ?").bind(now, context.round_id, user.id).run();
  const counts = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN ready_at IS NOT NULL THEN 1 ELSE 0 END) AS ready FROM imposter_assignments WHERE round_id = ?").bind(context.round_id).first();
  if (Number(counts.ready || 0) >= Number(counts.total || 0)) {
    await env.DB.prepare("UPDATE imposter_round_state SET phase = 'questions', updated_at = ? WHERE round_id = ?").bind(now, context.round_id).run();
    await notifyGameSync(env, code, "questions");
  }
  return json({ ready: true, allReady: Number(counts.ready || 0) >= Number(counts.total || 0) });
}

async function imposterAdvanceTurn(request, env, code, user) {
  const context = await activeImposterContext(env, code);
  if (!context || context.phase !== "questions") return json({ error: "ليست هذه مرحلة الأسئلة." }, 409);
  let input = {};
  try { input = await request.json(); } catch (_) { /* Invalid action below. */ }
  const order = JSON.parse(context.question_order || "[]");
  const currentIndex = Number(context.current_index || 0);
  const askerId = order[currentIndex % order.length];
  const answererId = order[(currentIndex + 1) % order.length];
  const now = new Date().toISOString();
  if (context.turn_stage === "question") {
    if (input.action !== "question_done" || user.id !== askerId) return json({ error: "السائل الحالي وحده يؤكد انتهاء سؤاله." }, 403);
    await env.DB.prepare("UPDATE imposter_round_state SET turn_stage = 'answer', updated_at = ? WHERE round_id = ?").bind(now, context.round_id).run();
    await notifyGameSync(env, code, "questions");
    return json({ advanced: true, turnStage: "answer" });
  }
  if (input.action !== "answer_done" || user.id !== answererId) return json({ error: "المجيب الحالي وحده يؤكد انتهاء جوابه." }, 403);
  if (currentIndex + 1 >= order.length) {
    const deadline = new Date(Date.now() + 30000).toISOString();
    await env.DB.prepare("UPDATE imposter_round_state SET phase = 'vote', vote_deadline = ?, updated_at = ? WHERE round_id = ?").bind(deadline, now, context.round_id).run();
    await notifyGameSync(env, code, "vote");
    return json({ advanced: true, phase: "vote", voteDeadline: deadline });
  }
  await env.DB.prepare("UPDATE imposter_round_state SET current_index = ?, turn_stage = 'question', updated_at = ? WHERE round_id = ?").bind(currentIndex + 1, now, context.round_id).run();
  await notifyGameSync(env, code, "questions");
  return json({ advanced: true, currentIndex: currentIndex + 1, turnStage: "question" });
}

async function imposterSubmitVote(request, env, code, user) {
  let context = await activeImposterContext(env, code);
  context = await maybeFinalizeImposter(env, context);
  if (!context || context.phase !== "vote") return json({ error: "صندوق التصويت غير مفتوح." }, 409);
  let input = {};
  try { input = await request.json(); } catch (_) { return json({ error: "التصويت غير صالح." }, 400); }
  const assignment = await env.DB.prepare("SELECT 1 FROM imposter_assignments WHERE round_id = ? AND user_id = ?").bind(context.round_id, user.id).first();
  if (!assignment) return json({ error: "المشاهد لا يملك حق التصويت." }, 403);
  const existing = await env.DB.prepare("SELECT 1 FROM imposter_ballots WHERE round_id = ? AND voter_user_id = ?").bind(context.round_id, user.id).first();
  if (existing) return json({ error: "تم تأكيد صوتك ولا يمكن تغييره." }, 409);
  const selections = [...new Set(Array.isArray(input.selections) ? input.selections.map(String) : [])];
  if (selections.length !== Number(context.imposter_count)) return json({ error: `اختر ${context.imposter_count} من المشتبه بهم ثم أكّد.` }, 400);
  if (selections.includes(user.id)) return json({ error: "لا يمكنك التصويت لنفسك." }, 400);
  const placeholders = selections.map(() => "?").join(",");
  const valid = await env.DB.prepare(`SELECT COUNT(*) AS count FROM room_members WHERE room_id = ? AND user_id IN (${placeholders})`).bind(context.room_id, ...selections).first();
  if (Number(valid.count || 0) !== selections.length) return json({ error: "أحد الاختيارات غير صالح." }, 400);
  await env.DB.prepare("INSERT INTO imposter_ballots (round_id, voter_user_id, selections_json, confirmed_at) VALUES (?, ?, ?, ?)")
    .bind(context.round_id, user.id, JSON.stringify(selections), new Date().toISOString()).run();
  context = await maybeFinalizeImposter(env, context);
  return json({ confirmed: true, finished: context.phase === "results" });
}

async function imposterSubmitWord(request, env, code, user) {
  let context = await activeImposterContext(env, code);
  context = await maybeFinalizeImposter(env, context);
  if (!context || context.phase !== "vote") return json({ error: "اختيار الكلمة متاح أثناء التصويت فقط." }, 409);
  const assignment = await env.DB.prepare("SELECT is_imposter, word_confirmed_at FROM imposter_assignments WHERE round_id = ? AND user_id = ?").bind(context.round_id, user.id).first();
  if (!assignment?.is_imposter) return json({ error: "هذا الاختيار متاح للدخيل فقط." }, 403);
  if (assignment.word_confirmed_at) return json({ error: "تم تأكيد الكلمة ولا يمكن تغييرها." }, 409);
  let input = {};
  try { input = await request.json(); } catch (_) { return json({ error: "اختر كلمة صالحة." }, 400); }
  const candidates = JSON.parse(context.candidate_words || "[]");
  const word = clean(input.word, "", 40);
  if (!candidates.includes(word)) return json({ error: "اختر كلمة من القائمة." }, 400);
  await env.DB.prepare("UPDATE imposter_assignments SET word_choice = ?, word_confirmed_at = ? WHERE round_id = ? AND user_id = ?")
    .bind(word, new Date().toISOString(), context.round_id, user.id).run();
  context = await maybeFinalizeImposter(env, context);
  return json({ confirmed: true, finished: context.phase === "results" });
}

function bluffType(typeId) {
  return BLUFF_CARD_TYPES.find((type) => type.id === typeId) || null;
}

function bluffDeadline(seconds = 60) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function jsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function activeBluffContext(env, code) {
  return env.DB.prepare(`
    SELECT r.id AS room_id, r.code, r.host_user_id, r.status AS room_status, r.is_private, r.ended_at,
      rd.id AS round_id, rd.number, s.phase, s.current_player_id, s.active_card_id,
      s.sender_user_id, s.receiver_user_id, s.claimed_type, s.seen_user_ids,
      s.action_deadline, s.last_result_json, s.winner_user_id, s.version
    FROM rooms r JOIN rounds rd ON rd.room_id = r.id
    LEFT JOIN bluff_round_state s ON s.round_id = rd.id
    WHERE r.code = ? AND r.game_type = 'bluff' AND rd.status = 'active'
    ORDER BY rd.number DESC LIMIT 1
  `).bind(code).first();
}

async function activeBluffPlayers(env, roundId) {
  const rows = await env.DB.prepare(`
    SELECT p.user_id FROM bluff_players p JOIN room_members m ON m.round_id = p.round_id AND m.user_id = p.user_id
    WHERE p.round_id = ? AND p.eliminated_at IS NULL ORDER BY m.joined_at
  `).bind(roundId).all();
  return rows.results.map((row) => row.user_id);
}

async function maybeRefillBluffHands(env, roundId) {
  const active = await activeBluffPlayers(env, roundId);
  if (!active.length) return { refilled: false, count: 0 };
  const hands = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM bluff_cards WHERE round_id = ? AND zone = 'hand'
      AND owner_user_id IN (SELECT user_id FROM bluff_players WHERE round_id = ? AND eliminated_at IS NULL)
  `).bind(roundId, roundId).first();
  if (Number(hands?.total || 0) > 0) return { refilled: false, count: 0 };

  const recycleRows = await env.DB.prepare("SELECT id FROM bluff_cards WHERE round_id = ? AND zone = 'recycle'").bind(roundId).all();
  const recycleIds = shuffled(recycleRows.results.map((row) => row.id));
  const ideal = active.length * 4;
  const minimum = active.length * 3;
  const useCount = recycleIds.length >= ideal ? ideal : recycleIds.length >= minimum ? recycleIds.length : minimum;
  const selectedIds = recycleIds.slice(0, Math.min(useCount, recycleIds.length));
  const now = new Date().toISOString();
  const generated = [];
  for (let index = selectedIds.length; index < useCount; index += 1) {
    generated.push({
      id: crypto.randomUUID(),
      type: BLUFF_CARD_TYPES[index % BLUFF_CARD_TYPES.length].id,
      variant: (index % 8) + 1,
    });
  }
  const dealt = shuffled([...selectedIds.map((id) => ({ id, existing: true })), ...generated]);
  const recipients = shuffled(active);
  await env.DB.batch([
    ...dealt.map((card, index) => card.existing
      ? env.DB.prepare("UPDATE bluff_cards SET zone = 'hand', owner_user_id = ? WHERE id = ? AND round_id = ?").bind(recipients[index % recipients.length], card.id, roundId)
      : env.DB.prepare("INSERT INTO bluff_cards (id, round_id, animal_type, variant, zone, owner_user_id, created_at) VALUES (?, ?, ?, ?, 'hand', ?, ?)")
        .bind(card.id, roundId, card.type, card.variant, recipients[index % recipients.length], now)),
  ]);
  return { refilled: true, count: dealt.length };
}

async function nextBluffStarter(env, roundId, preferredUserId = null) {
  await maybeRefillBluffHands(env, roundId);
  const rows = await env.DB.prepare(`
    SELECT p.user_id, COUNT(c.id) AS cards FROM bluff_players p
    LEFT JOIN bluff_cards c ON c.round_id = p.round_id AND c.owner_user_id = p.user_id AND c.zone = 'hand'
    WHERE p.round_id = ? AND p.eliminated_at IS NULL GROUP BY p.user_id HAVING COUNT(c.id) > 0
  `).bind(roundId).all();
  const available = rows.results.map((row) => row.user_id);
  if (preferredUserId && available.includes(preferredUserId)) return preferredUserId;
  return shuffled(available)[0] || null;
}

async function startBluffRound(env, room, round, user) {
  const botsAdded = await fillRoomWithBots(env, room.id, round?.id, 3);
  const members = await env.DB.prepare("SELECT user_id FROM room_members WHERE room_id = ? ORDER BY joined_at").bind(room.id).all();
  const playerIds = members.results.map((member) => member.user_id);
  if (playerIds.length < 3) return json({ error: "تحتاج بطاقة الخداع إلى ثلاثة لاعبين على الأقل." }, 409);
  if (playerIds.length > 5) return json({ error: "الحد الأقصى لبطاقة الخداع هو خمسة لاعبين." }, 409);
  const recipients = shuffled(playerIds);
  const cards = shuffled(BLUFF_CARD_TYPES.flatMap((type) => Array.from({ length: 8 }, (_, index) => ({
    id: crypto.randomUUID(), type: type.id, variant: index + 1,
  }))));
  const now = new Date().toISOString();
  const firstPlayer = shuffled(playerIds)[0];
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO bluff_round_state
        (round_id, phase, current_player_id, seen_user_ids, action_deadline, created_at, updated_at)
      VALUES (?, 'select', ?, '[]', ?, ?, ?)
    `).bind(round.id, firstPlayer, bluffDeadline(), now, now),
    ...playerIds.map((userId) => env.DB.prepare("INSERT INTO bluff_players (round_id, user_id) VALUES (?, ?)").bind(round.id, userId)),
    ...cards.map((card, index) => env.DB.prepare(`
      INSERT INTO bluff_cards (id, round_id, animal_type, variant, zone, owner_user_id, created_at)
      VALUES (?, ?, ?, ?, 'hand', ?, ?)
    `).bind(card.id, round.id, card.type, card.variant, recipients[index % recipients.length], now)),
    ...playerIds.map((userId) => env.DB.prepare("UPDATE room_members SET role = 'لاعب بطاقة الخداع', alive = 1, round_id = ? WHERE room_id = ? AND user_id = ?").bind(round.id, room.id, userId)),
    env.DB.prepare("UPDATE rooms SET status = 'playing' WHERE id = ?").bind(room.id),
  ]);
  return json({ started: true, gameType: "bluff", botsAdded: botsAdded.length });
}

async function performBluffPlay(env, context, actorId, cardId, targetUserId, claim) {
  if (context.phase !== "select" || context.current_player_id !== actorId) throw new Error("ليس دور هذا اللاعب لاختيار بطاقة.");
  if (!BLUFF_CARD_TYPE_IDS.has(claim)) throw new Error("اختر ادعاءً صالحاً.");
  const [card, target] = await Promise.all([
    env.DB.prepare("SELECT id FROM bluff_cards WHERE id = ? AND round_id = ? AND owner_user_id = ? AND zone = 'hand'").bind(cardId, context.round_id, actorId).first(),
    env.DB.prepare("SELECT 1 FROM bluff_players WHERE round_id = ? AND user_id = ? AND eliminated_at IS NULL").bind(context.round_id, targetUserId).first(),
  ]);
  if (!card) throw new Error("هذه البطاقة ليست في يدك.");
  if (!target || targetUserId === actorId) throw new Error("اختر لاعباً آخر ما زال في الجولة.");
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE bluff_cards SET zone = 'transit', owner_user_id = NULL WHERE id = ?").bind(cardId),
    env.DB.prepare(`
      UPDATE bluff_round_state SET phase = 'respond', active_card_id = ?, sender_user_id = ?, receiver_user_id = ?,
        claimed_type = ?, seen_user_ids = ?, action_deadline = ?, last_result_json = NULL, version = version + 1, updated_at = ?
      WHERE round_id = ?
    `).bind(cardId, actorId, targetUserId, claim, JSON.stringify([actorId]), bluffDeadline(), now, context.round_id),
  ]);
}

async function performBluffPeek(env, context, actorId) {
  if (context.phase !== "respond" || context.receiver_user_id !== actorId) throw new Error("لا يمكنك كشف هذه البطاقة الآن.");
  const seen = [...new Set([...jsonArray(context.seen_user_ids), actorId])];
  const active = await activeBluffPlayers(env, context.round_id);
  if (!active.some((userId) => userId !== actorId && !seen.includes(userId))) throw new Error("أنت آخر من لم ير البطاقة، ويجب أن تحكم على الادعاء.");
  await env.DB.prepare("UPDATE bluff_round_state SET phase = 'pass', seen_user_ids = ?, action_deadline = ?, version = version + 1, updated_at = ? WHERE round_id = ?")
    .bind(JSON.stringify(seen), bluffDeadline(), new Date().toISOString(), context.round_id).run();
}

async function performBluffPass(env, context, actorId, targetUserId, claim) {
  if (context.phase !== "pass" || context.receiver_user_id !== actorId) throw new Error("لا يمكنك تمرير هذه البطاقة الآن.");
  if (!BLUFF_CARD_TYPE_IDS.has(claim)) throw new Error("اختر ادعاءً صالحاً.");
  const seen = [...new Set([...jsonArray(context.seen_user_ids), actorId])];
  const target = await env.DB.prepare("SELECT 1 FROM bluff_players WHERE round_id = ? AND user_id = ? AND eliminated_at IS NULL").bind(context.round_id, targetUserId).first();
  if (!target || targetUserId === actorId || seen.includes(targetUserId)) throw new Error("اختر لاعباً لم ير البطاقة بعد.");
  await env.DB.prepare(`
    UPDATE bluff_round_state SET phase = 'respond', sender_user_id = ?, receiver_user_id = ?, claimed_type = ?,
      seen_user_ids = ?, action_deadline = ?, version = version + 1, updated_at = ? WHERE round_id = ?
  `).bind(actorId, targetUserId, claim, JSON.stringify(seen), bluffDeadline(), new Date().toISOString(), context.round_id).run();
}

async function performBluffAnswer(env, context, actorId, answer) {
  if (context.phase !== "respond" || context.receiver_user_id !== actorId) throw new Error("لا يمكنك الحكم على هذه البطاقة الآن.");
  const card = await env.DB.prepare("SELECT id, animal_type FROM bluff_cards WHERE id = ? AND round_id = ? AND zone = 'transit'").bind(context.active_card_id, context.round_id).first();
  if (!card) throw new Error("تعذر العثور على البطاقة النشطة.");
  const claimWasTrue = card.animal_type === context.claimed_type;
  const correct = Boolean(answer) === claimWasTrue;
  const penaltyUserId = correct ? context.sender_user_id : actorId;
  await env.DB.prepare("UPDATE bluff_cards SET zone = 'penalty', owner_user_id = ? WHERE id = ?").bind(penaltyUserId, card.id).run();
  const penalties = await env.DB.prepare(`
    SELECT animal_type, COUNT(*) AS total FROM bluff_cards WHERE round_id = ? AND owner_user_id = ? AND zone = 'penalty'
    GROUP BY animal_type
  `).bind(context.round_id, penaltyUserId).all();
  const eliminated = penalties.results.some((row) => Number(row.total) >= 4) || penalties.results.length >= BLUFF_CARD_TYPES.length;
  const now = new Date().toISOString();
  let winnerUserId = null;
  if (eliminated) {
    const remainingBefore = await activeBluffPlayers(env, context.round_id);
    await env.DB.batch([
      env.DB.prepare("UPDATE bluff_players SET eliminated_at = ?, placement = ? WHERE round_id = ? AND user_id = ?").bind(now, remainingBefore.length, context.round_id, penaltyUserId),
      env.DB.prepare("UPDATE room_members SET alive = 0 WHERE room_id = ? AND user_id = ?").bind(context.room_id, penaltyUserId),
      env.DB.prepare("UPDATE bluff_cards SET zone = 'recycle', owner_user_id = NULL WHERE round_id = ? AND owner_user_id = ?").bind(context.round_id, penaltyUserId),
    ]);
    const remaining = await activeBluffPlayers(env, context.round_id);
    if (remaining.length === 1) winnerUserId = remaining[0];
  }
  const cardMeta = bluffType(card.animal_type);
  const claimMeta = bluffType(context.claimed_type);
  const result = {
    cardType: card.animal_type,
    cardName: cardMeta?.name || card.animal_type,
    claimType: context.claimed_type,
    claimName: claimMeta?.name || context.claimed_type,
    answer: Boolean(answer),
    claimWasTrue,
    correct,
    penaltyUserId,
    eliminatedUserId: eliminated ? penaltyUserId : null,
  };
  if (winnerUserId) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE bluff_round_state SET phase = 'results', current_player_id = ?, active_card_id = NULL,
          sender_user_id = NULL, receiver_user_id = NULL, claimed_type = NULL, seen_user_ids = '[]', action_deadline = NULL,
          last_result_json = ?, winner_user_id = ?, version = version + 1, updated_at = ? WHERE round_id = ?
      `).bind(winnerUserId, JSON.stringify(result), winnerUserId, now, context.round_id),
      env.DB.prepare("UPDATE bluff_players SET placement = 1 WHERE round_id = ? AND user_id = ?").bind(context.round_id, winnerUserId),
    ]);
    return;
  }
  const nextPlayer = await nextBluffStarter(env, context.round_id, eliminated ? null : penaltyUserId);
  await env.DB.prepare(`
    UPDATE bluff_round_state SET phase = 'select', current_player_id = ?, active_card_id = NULL,
      sender_user_id = NULL, receiver_user_id = NULL, claimed_type = NULL, seen_user_ids = '[]', action_deadline = ?,
      last_result_json = ?, version = version + 1, updated_at = ? WHERE round_id = ?
  `).bind(nextPlayer, bluffDeadline(), JSON.stringify(result), now, context.round_id).run();
}

async function runBluffAutomaticActions(env, context) {
  let changed = false;
  for (let guard = 0; guard < 40; guard += 1) {
    context = await activeBluffContext(env, context.code);
    if (!context || context.phase === "results") break;
    const actorId = context.phase === "select" ? context.current_player_id : context.receiver_user_id;
    const expired = context.action_deadline && new Date(context.action_deadline).getTime() <= Date.now();
    if (!isBotId(actorId) && !expired) break;
    if (context.phase === "select") {
      const cards = await env.DB.prepare("SELECT id, animal_type FROM bluff_cards WHERE round_id = ? AND owner_user_id = ? AND zone = 'hand'").bind(context.round_id, actorId).all();
      const active = (await activeBluffPlayers(env, context.round_id)).filter((userId) => userId !== actorId);
      if (!cards.results.length || !active.length) {
        const next = await nextBluffStarter(env, context.round_id);
        await env.DB.prepare("UPDATE bluff_round_state SET current_player_id = ?, action_deadline = ?, updated_at = ? WHERE round_id = ?").bind(next, bluffDeadline(), new Date().toISOString(), context.round_id).run();
      } else {
        const card = cards.results[Math.floor(Math.random() * cards.results.length)];
        const claim = Math.random() < 0.55 ? card.animal_type : BLUFF_CARD_TYPES[Math.floor(Math.random() * BLUFF_CARD_TYPES.length)].id;
        await performBluffPlay(env, context, actorId, card.id, active[Math.floor(Math.random() * active.length)], claim);
      }
      changed = true;
      continue;
    }
    if (context.phase === "pass") {
      const seen = jsonArray(context.seen_user_ids);
      const targets = (await activeBluffPlayers(env, context.round_id)).filter((userId) => userId !== actorId && !seen.includes(userId));
      if (targets.length) {
        const claim = BLUFF_CARD_TYPES[Math.floor(Math.random() * BLUFF_CARD_TYPES.length)].id;
        await performBluffPass(env, context, actorId, targets[Math.floor(Math.random() * targets.length)], claim);
      } else {
        await env.DB.prepare("UPDATE bluff_round_state SET phase = 'respond', action_deadline = ?, updated_at = ? WHERE round_id = ?").bind(bluffDeadline(), new Date().toISOString(), context.round_id).run();
      }
      changed = true;
      continue;
    }
    const seen = jsonArray(context.seen_user_ids);
    const unseen = (await activeBluffPlayers(env, context.round_id)).filter((userId) => userId !== actorId && !seen.includes(userId));
    if (unseen.length && Math.random() < 0.35) {
      await performBluffPeek(env, context, actorId);
    } else {
      const card = await env.DB.prepare("SELECT animal_type FROM bluff_cards WHERE id = ?").bind(context.active_card_id).first();
      const actual = card?.animal_type === context.claimed_type;
      const answer = Math.random() < 0.55 ? actual : !actual;
      await performBluffAnswer(env, context, actorId, answer);
    }
    changed = true;
  }
  if (changed) await notifyGameSync(env, context.code, (await activeBluffContext(env, context.code))?.phase || null, "bluff");
  return activeBluffContext(env, context.code);
}

async function bluffState(request, env, code) {
  let context = await activeBluffContext(env, code);
  if (!context || context.ended_at || !context.phase) return json({ error: "لم تبدأ جولة بطاقة الخداع بعد." }, 409);
  context = await runBluffAutomaticActions(env, context);
  const user = await getUser(request, env);
  const assignment = user ? await env.DB.prepare("SELECT * FROM bluff_players WHERE round_id = ? AND user_id = ?").bind(context.round_id, user.id).first() : null;
  if (context.is_private && !assignment) return json({ error: "هذه الغرفة خاصة." }, 403);
  const players = await env.DB.prepare(`
    SELECT u.id, u.display_name, u.avatar_type, u.avatar_value, p.eliminated_at, p.placement,
      CASE WHEN r.host_user_id = u.id THEN 1 ELSE 0 END AS is_host,
      SUM(CASE WHEN c.zone = 'hand' THEN 1 ELSE 0 END) AS hand_count,
      SUM(CASE WHEN c.zone = 'penalty' THEN 1 ELSE 0 END) AS penalty_count,
      COUNT(DISTINCT CASE WHEN c.zone = 'penalty' THEN c.animal_type END) AS penalty_types
    FROM bluff_players p JOIN users u ON u.id = p.user_id
    JOIN rounds rd ON rd.id = p.round_id JOIN rooms r ON r.id = rd.room_id
    LEFT JOIN bluff_cards c ON c.round_id = p.round_id AND c.owner_user_id = p.user_id
    WHERE p.round_id = ? GROUP BY p.user_id ORDER BY p.eliminated_at IS NOT NULL, u.display_name
  `).bind(context.round_id).all();
  const handRows = assignment && !assignment.eliminated_at ? await env.DB.prepare(`
    SELECT id, animal_type, variant FROM bluff_cards WHERE round_id = ? AND owner_user_id = ? AND zone = 'hand' ORDER BY animal_type, variant
  `).bind(context.round_id, user.id).all() : { results: [] };
  const penaltyRows = assignment ? await env.DB.prepare(`
    SELECT animal_type, COUNT(*) AS total FROM bluff_cards WHERE round_id = ? AND owner_user_id = ? AND zone = 'penalty' GROUP BY animal_type
  `).bind(context.round_id, user.id).all() : { results: [] };
  const activeIds = players.results.filter((player) => !player.eliminated_at).map((player) => player.id);
  const seen = jsonArray(context.seen_user_ids);
  const knowsCard = assignment && seen.includes(user.id);
  const activeCard = knowsCard && context.active_card_id ? await env.DB.prepare("SELECT animal_type, variant FROM bluff_cards WHERE id = ?").bind(context.active_card_id).first() : null;
  const secondsRemaining = context.action_deadline ? Math.max(0, Math.ceil((new Date(context.action_deadline).getTime() - Date.now()) / 1000)) : null;
  const mapCard = (card) => {
    const meta = bluffType(card.animal_type);
    return { id: card.id, type: card.animal_type, name: meta?.name, symbol: meta?.symbol, color: meta?.color, variant: Number(card.variant || 1) };
  };
  const payload = {
    gameType: "bluff",
    round: Number(context.number || 1),
    phase: context.phase,
    version: Number(context.version || 1),
    currentPlayerId: context.current_player_id,
    senderId: context.sender_user_id,
    receiverId: context.receiver_user_id,
    claim: context.claimed_type ? { type: context.claimed_type, ...bluffType(context.claimed_type) } : null,
    actionSecondsRemaining: secondsRemaining,
    cardTypes: BLUFF_CARD_TYPES,
    players: players.results.map((player) => ({
      id: player.id, name: player.display_name, avatarType: player.avatar_type, avatarValue: player.avatar_value,
      host: Boolean(player.is_host), eliminated: Boolean(player.eliminated_at), placement: player.placement,
      handCount: Number(player.hand_count || 0), penaltyCount: Number(player.penalty_count || 0), penaltyTypes: Number(player.penalty_types || 0), bot: isBotId(player.id),
    })),
    me: assignment ? {
      id: user.id,
      eliminated: Boolean(assignment.eliminated_at),
      hand: handRows.results.map(mapCard),
      penalties: penaltyRows.results.map((row) => ({ type: row.animal_type, name: bluffType(row.animal_type)?.name, color: bluffType(row.animal_type)?.color, count: Number(row.total) })),
      activeCard: activeCard ? mapCard({ id: context.active_card_id, ...activeCard }) : null,
      selectTargets: context.phase === "select" && context.current_player_id === user.id ? activeIds.filter((id) => id !== user.id) : [],
      passTargets: context.phase === "pass" && context.receiver_user_id === user.id ? activeIds.filter((id) => id !== user.id && !seen.includes(id)) : [],
      canAnswer: context.phase === "respond" && context.receiver_user_id === user.id,
      canPeek: context.phase === "respond" && context.receiver_user_id === user.id && activeIds.some((id) => id !== user.id && !seen.includes(id)),
      canPass: context.phase === "pass" && context.receiver_user_id === user.id,
    } : null,
    lastResult: context.last_result_json ? JSON.parse(context.last_result_json) : null,
    winnerUserId: context.winner_user_id,
  };
  return json(payload);
}

async function bluffAction(request, env, code, user, action) {
  let context = await activeBluffContext(env, code);
  if (!context || context.ended_at || !context.phase) return json({ error: "لم تبدأ جولة بطاقة الخداع بعد." }, 409);
  const player = await env.DB.prepare("SELECT eliminated_at FROM bluff_players WHERE round_id = ? AND user_id = ?").bind(context.round_id, user.id).first();
  if (!player) return json({ error: "المشاهد لا يستطيع تنفيذ حركة." }, 403);
  if (player.eliminated_at) return json({ error: "خرجت من هذه الجولة ويمكنك متابعتها فقط." }, 409);
  let input = {};
  try { input = await request.json(); } catch (_) { /* Some actions need no payload. */ }
  try {
    if (action === "play") await performBluffPlay(env, context, user.id, clean(input.cardId, "", 80), clean(input.targetUserId, "", 80), clean(input.claim, "", 30));
    else if (action === "peek") await performBluffPeek(env, context, user.id);
    else if (action === "pass") await performBluffPass(env, context, user.id, clean(input.targetUserId, "", 80), clean(input.claim, "", 30));
    else if (action === "answer" && typeof input.answer === "boolean") await performBluffAnswer(env, context, user.id, input.answer);
    else return json({ error: "الحركة غير صالحة." }, 400);
  } catch (error) {
    return json({ error: error.message || "تعذر تنفيذ الحركة." }, 409);
  }
  context = await activeBluffContext(env, code);
  await runBluffAutomaticActions(env, context);
  const latest = await activeBluffContext(env, code);
  await notifyGameSync(env, code, latest?.phase || null, "bluff");
  return json({ ok: true, phase: latest?.phase || null });
}

async function startRoom(request, env, code, user) {
  const config = await siteConfig(env);
  if (config.maintenanceMode) return json({ error: config.maintenanceMessage }, 503);
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ error: "هذه الجولة لم تعد متاحة." }, 410);
  if (room.host_user_id !== user.id) return json({ error: "المضيف وحده يستطيع بدء الجولة." }, 403);
  if (room.status === "playing") return json({ error: "بدأت هذه الجولة بالفعل." }, 409);
  let input = {};
  try { input = await request.json(); } catch (_) { /* Optional settings. */ }
  const round = await env.DB.prepare("SELECT id FROM rounds WHERE room_id = ? AND status = 'active' ORDER BY number DESC LIMIT 1").bind(room.id).first();
  if (room.game_type === "imposter") return startImposterRound(env, room, round, user);
  if (room.game_type === "bluff") return startBluffRound(env, room, round, user);
  const botsAdded = await fillRoomWithBots(env, room.id, round?.id, 5);
  const members = await env.DB.prepare("SELECT user_id FROM room_members WHERE room_id = ? ORDER BY joined_at").bind(room.id).all();
  if (members.results.length < 5) return json({ error: "تعذر تجهيز العدد الأدنى من اللاعبين." }, 409);
  const deck = roleDeck(members.results.length, input.options || {});
  await env.DB.batch([
    ...members.results.map((member, index) => env.DB.prepare("UPDATE room_members SET role = ?, alive = 1, round_id = ? WHERE room_id = ? AND user_id = ?").bind(deck[index], round.id, room.id, member.user_id)),
    env.DB.prepare("UPDATE rooms SET status = 'playing' WHERE id = ?").bind(room.id),
  ]);
  const myRole = deck[members.results.findIndex((member) => member.user_id === user.id)];
  const partners = myRole === "أفراد الظل" ? (await env.DB.prepare(`
    SELECT u.id, u.display_name AS name FROM room_members m JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ? AND m.user_id != ? AND m.role = 'أفراد الظل'
  `).bind(room.id, user.id).all()).results : [];
  return json({ started: true, role: myRole, partners, botsAdded: botsAdded.length });
}

async function myRoomState(env, code, user) {
  const row = await env.DB.prepare(`
    SELECT m.role, m.alive, r.status, r.ended_at FROM rooms r JOIN room_members m ON m.room_id = r.id
    WHERE r.code = ? AND m.user_id = ? LIMIT 1
  `).bind(code, user.id).first();
  if (!row || row.ended_at) return json({ error: "انتهت هذه الجولة.", ended: true }, 410);
  const room = await roomRecord(env, code);
  const partners = row.role === "أفراد الظل" ? (await env.DB.prepare(`
    SELECT u.id, u.display_name AS name FROM room_members m JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ? AND m.user_id != ? AND m.role = 'أفراد الظل'
  `).bind(room.id, user.id).all()).results : [];
  return json({ status: row.status, gameType: room.game_type || "mafia", role: row.role, alive: Boolean(row.alive), partners });
}

async function createLiveKitToken(request, env) {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return json({ error: "الصوت غير مهيأ بعد." }, 503);
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "بيانات الغرفة الصوتية غير صالحة." }, 400); }
  const code = clean(input.roomCode, "", 20).toUpperCase();
  const channel = input.channel === "shadow" ? "shadow" : "public";
  const room = await env.DB.prepare(`
    SELECT r.id AS room_id, r.code, r.status, r.is_private, r.ended_at, rd.id AS round_id
    FROM rooms r JOIN rounds rd ON rd.room_id = r.id
    WHERE r.code = ? AND rd.status = 'active' ORDER BY rd.number DESC LIMIT 1
  `).bind(code).first();
  if (!room || room.ended_at) return json({ error: "انتهت هذه الجولة.", ended: true }, 410);
  if (room.status !== "playing") return json({ error: "تبدأ الغرفة الصوتية مع بداية الجولة." }, 409);

  const user = await getUser(request, env);
  const member = user ? await env.DB.prepare("SELECT role, alive FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.room_id, user.id).first() : null;
  if (room.is_private && !member) return json({ error: "هذه الغرفة خاصة." }, 403);
  if (channel === "shadow" && (!member || member.role !== "أفراد الظل" || !member.alive)) return json({ error: "قناة أفراد الظل غير متاحة لدورك." }, 403);

  const spectator = !member;
  const canPublish = Boolean(member?.alive);
  const identity = member ? user.id : user ? `spectator-${user.id}` : `guest-${crypto.randomUUID()}`;
  const name = member ? user.display_name : user ? `${user.display_name} · مشاهد` : "مشاهد";
  const liveKitRoom = `qinaa-${room.round_id}-${channel}`;
  const participantToken = await liveKitJwt(env, {
    identity,
    name,
    room: liveKitRoom,
    canPublish,
    metadata: { qinaaRoom: code, channel, spectator, alive: Boolean(member?.alive) },
  });
  return json({ server_url: env.LIVEKIT_URL, participant_token: participantToken, channel, can_publish: canPublish }, 201);
}

async function endRoom(env, code, user) {
  const room = await roomRecord(env, code);
  if (!room || room.ended_at) return json({ ended: true });
  if (room.host_user_id !== user.id) return json({ error: "المضيف وحده يستطيع إنهاء الجولة." }, 403);
  const round = await env.DB.prepare("SELECT id FROM rounds WHERE room_id = ? AND status = 'active' ORDER BY number DESC LIMIT 1").bind(room.id).first();
  const now = new Date().toISOString();
  const statements = [env.DB.prepare("UPDATE rooms SET status = 'ended', ended_at = ? WHERE id = ?").bind(now, room.id)];
  if (round) statements.push(env.DB.prepare("DELETE FROM messages WHERE round_id = ?").bind(round.id), env.DB.prepare("UPDATE rounds SET status = 'ended', ended_at = ? WHERE id = ?").bind(now, round.id));
  await env.DB.batch(statements);
  await roomChatStub(env, code).fetch(new Request("https://qinaa.internal/internal/end"));
  return json({ ended: true, messagesDeleted: true });
}

function adminUserPayload(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    birthDate: row.birth_date,
    avatarType: row.avatar_type,
    avatarValue: row.avatar_value,
    profileComplete: Boolean(row.profile_completed),
    accountStatus: row.account_status,
    statusReason: row.status_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    hasPassword: Boolean(row.has_password),
    providers: row.providers ? String(row.providers).split(",").filter(Boolean) : [],
    activeSessions: Number(row.active_sessions || 0),
    adminRole: row.admin_role || null,
  };
}

async function adminOverview(env, context) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const [users, newUsers, sessions, activeRooms, completedRooms, storedMessages, admins] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE id NOT LIKE 'qinaa-bot-%'").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE id NOT LIKE 'qinaa-bot-%' AND created_at >= ?").bind(dayStart).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?").bind(now.toISOString()).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM rooms WHERE ended_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM rooms WHERE ended_at IS NOT NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM messages").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM admins").first(),
  ]);
  return json({
    admin: { id: context.user.id, name: context.user.display_name, email: context.user.email, role: context.admin.role },
    stats: {
      users: Number(users.count || 0),
      newUsersToday: Number(newUsers.count || 0),
      activeSessions: Number(sessions.count || 0),
      activeRooms: Number(activeRooms.count || 0),
      completedRooms: Number(completedRooms.count || 0),
      storedMessages: Number(storedMessages.count || 0),
      admins: Number(admins.count || 0),
    },
    settings: await siteConfig(env),
  });
}

async function adminListUsers(url, env) {
  const query = clean(url.searchParams.get("q"), "", 80);
  const status = ["active", "suspended"].includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "all";
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const where = ["u.id NOT LIKE 'qinaa-bot-%'"];
  const bindings = [];
  if (query) {
    where.push("(u.email LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)");
    bindings.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (status !== "all") { where.push("u.account_status = ?"); bindings.push(status); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT u.id, u.email, u.username, u.display_name, u.birth_date, u.avatar_type, u.avatar_value,
        u.profile_completed, u.account_status, u.status_reason, u.created_at, u.updated_at, u.last_login_at,
        CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password,
        (SELECT GROUP_CONCAT(provider) FROM oauth_accounts WHERE user_id = u.id) AS providers,
        (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND expires_at > ?) AS active_sessions,
        (SELECT role FROM admins WHERE user_id = u.id) AS admin_role
      FROM users u ${clause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).bind(new Date().toISOString(), ...bindings, limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM users u ${clause}`).bind(...bindings).first(),
  ]);
  return json({ users: rows.results.map(adminUserPayload), total: Number(total.count || 0), limit, offset });
}

async function adminUpdateUser(request, env, context, targetId) {
  const target = await env.DB.prepare("SELECT u.*, a.role AS admin_role FROM users u LEFT JOIN admins a ON a.user_id = u.id WHERE u.id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ error: "الحساب غير موجود." }, 404);
  if (target.admin_role && context.admin.role !== "owner" && targetId !== context.user.id) return json({ error: "مالك المنصة وحده يستطيع تعديل حساب إداري آخر." }, 403);
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const displayName = clean(input.displayName, target.display_name, 40);
  const username = clean(input.username, target.username, 24).toLowerCase();
  const email = clean(input.email, target.email, 120).toLowerCase();
  const birthDate = clean(input.birthDate, target.birth_date || "", 10) || null;
  const accountStatus = ["active", "suspended"].includes(input.accountStatus) ? input.accountStatus : target.account_status;
  const statusReason = accountStatus === "suspended" ? clean(input.statusReason, "قرار إداري", 160) : null;
  if (targetId === context.user.id && accountStatus !== "active") return json({ error: "لا يمكنك إيقاف حسابك الإداري الحالي." }, 400);
  if (displayName.length < 2 || !/^[\p{L}\p{N}._-]{3,24}$/u.test(username) || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "راجع الاسم واسم المستخدم والبريد الإلكتروني." }, 400);
  if (birthDate && !validBirthDate(birthDate)) return json({ error: "تاريخ الميلاد غير صالح." }, 400);
  try {
    await env.DB.prepare(`
      UPDATE users SET display_name = ?, username = ?, email = ?, birth_date = ?, account_status = ?, status_reason = ?, updated_at = ? WHERE id = ?
    `).bind(displayName, username, email, birthDate, accountStatus, statusReason, new Date().toISOString(), targetId).run();
  } catch (error) {
    const message = String(error);
    if (message.includes("users.email")) return json({ error: "هذا البريد مستعمل من حساب آخر." }, 409);
    if (message.includes("users.username")) return json({ error: "اسم المستخدم مستعمل من حساب آخر." }, 409);
    throw error;
  }
  if (accountStatus === "suspended") await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetId).run();
  await auditAdmin(env, context.user.id, "user.update", "user", targetId, { displayName, username, email, birthDate, accountStatus, statusReason });
  return json({ ok: true });
}

async function adminRevokeSessions(env, context, targetId) {
  if (targetId === context.user.id) return json({ error: "سجّل الخروج بنفسك بدل إلغاء جلستك من هنا." }, 400);
  const result = await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetId).run();
  await auditAdmin(env, context.user.id, "user.sessions.revoke", "user", targetId, { deleted: result.meta.changes || 0 });
  return json({ ok: true, revoked: result.meta.changes || 0 });
}

async function adminDeleteUser(env, context, targetId) {
  if (targetId === context.user.id) return json({ error: "لا يمكنك حذف حسابك الإداري الحالي." }, 400);
  const target = await env.DB.prepare("SELECT u.email, a.role AS admin_role FROM users u LEFT JOIN admins a ON a.user_id = u.id WHERE u.id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ error: "الحساب غير موجود." }, 404);
  if (target.admin_role && context.admin.role !== "owner") return json({ error: "مالك المنصة وحده يستطيع حذف حساب إداري." }, 403);
  if (target.admin_role === "owner") {
    const owners = await env.DB.prepare("SELECT COUNT(*) AS count FROM admins WHERE role = 'owner'").first();
    if (Number(owners.count || 0) <= 1) return json({ error: "لا يمكن حذف مالك المنصة الوحيد." }, 409);
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admin_audit_log (id, admin_user_id, action, target_type, target_id, details, created_at) VALUES (?, ?, 'user.delete', 'user', ?, ?, ?)").bind(crypto.randomUUID(), context.user.id, targetId, JSON.stringify({ email: target.email }), now),
    env.DB.prepare("DELETE FROM rooms WHERE host_user_id = ?").bind(targetId),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(targetId),
  ]);
  return json({ ok: true });
}

async function adminListRooms(env) {
  const result = await env.DB.prepare(`
    SELECT r.id, r.code, r.name, r.game_type, r.status, r.is_private, r.capacity, r.created_at, r.ended_at,
      u.display_name AS host_name, u.email AS host_email,
      (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS members,
      (SELECT COUNT(*) FROM messages WHERE room_id = r.id) AS messages
    FROM rooms r JOIN users u ON u.id = r.host_user_id ORDER BY r.created_at DESC LIMIT 100
  `).all();
  return json({ rooms: result.results.map((room) => ({
    id: room.id, code: room.code, name: room.name, gameType: room.game_type || "mafia", status: room.status, private: Boolean(room.is_private), capacity: Number(room.capacity),
    createdAt: room.created_at, endedAt: room.ended_at, hostName: room.host_name, hostEmail: room.host_email,
    members: Number(room.members || 0), messages: Number(room.messages || 0),
  })) });
}

async function adminEndRoom(env, context, roomId) {
  const room = await env.DB.prepare("SELECT id, code, ended_at FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first();
  if (!room) return json({ error: "الغرفة غير موجودة." }, 404);
  if (!room.ended_at) {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM messages WHERE room_id = ?").bind(room.id),
      env.DB.prepare("UPDATE rounds SET status = 'ended', ended_at = ? WHERE room_id = ? AND status = 'active'").bind(now, room.id),
      env.DB.prepare("UPDATE rooms SET status = 'ended', ended_at = ? WHERE id = ?").bind(now, room.id),
    ]);
    await roomChatStub(env, room.code).fetch(new Request("https://qinaa.internal/internal/end"));
  }
  await auditAdmin(env, context.user.id, "room.end", "room", room.id, { code: room.code });
  return json({ ok: true });
}

async function adminDeleteRoom(env, context, roomId) {
  const room = await env.DB.prepare("SELECT code, ended_at FROM rooms WHERE id = ? LIMIT 1").bind(roomId).first();
  if (!room) return json({ error: "الغرفة غير موجودة." }, 404);
  if (!room.ended_at) return json({ error: "أنه الغرفة أولاً قبل حذف سجلها." }, 409);
  await auditAdmin(env, context.user.id, "room.delete", "room", roomId, { code: room.code });
  await env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();
  return json({ ok: true });
}

async function adminUpdateSettings(request, env, context) {
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const values = {
    maintenance_mode: input.maintenanceMode ? "1" : "0",
    registration_enabled: input.registrationEnabled ? "1" : "0",
    room_creation_enabled: input.roomCreationEnabled ? "1" : "0",
    maintenance_message: clean(input.maintenanceMessage, "قِناع في صيانة قصيرة. سنعود قريباً.", 160),
  };
  const now = new Date().toISOString();
  await env.DB.batch(Object.entries(values).map(([key, value]) => env.DB.prepare(`
    INSERT INTO site_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(key, value, context.user.id, now)));
  await auditAdmin(env, context.user.id, "site.settings.update", "site", "qinaa", values);
  return json({ ok: true, settings: await siteConfig(env) });
}

async function adminUpdateGamePage(request, env, context, gameType) {
  if (!GAME_TYPES.has(gameType)) return json({ error: "اللعبة غير موجودة." }, 404);
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const current = await env.DB.prepare("SELECT * FROM game_pages WHERE game_type = ? LIMIT 1").bind(gameType).first();
  if (!current) return json({ error: "صفحة اللعبة غير موجودة." }, 404);
  const slug = clean(input.slug, current.slug, 60).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const values = {
    slug,
    name: clean(input.name, current.name, 60),
    eyebrow: clean(input.eyebrow, current.eyebrow, 100),
    shortDescription: clean(input.shortDescription, current.short_description, 240),
    metaTitle: clean(input.metaTitle, current.meta_title, 70),
    metaDescription: clean(input.metaDescription, current.meta_description, 170),
    keywords: clean(input.keywords, current.keywords, 300),
    ogTitle: clean(input.ogTitle, current.og_title, 100),
    ogDescription: clean(input.ogDescription, current.og_description, 200),
  };
  if (!slug || values.metaTitle.length < 10 || values.metaDescription.length < 30) return json({ error: "راجع الرابط وعنوان SEO والوصف التعريفي." }, 400);
  try {
    await env.DB.prepare(`
      UPDATE game_pages SET slug = ?, name = ?, eyebrow = ?, short_description = ?, meta_title = ?, meta_description = ?,
        keywords = ?, og_title = ?, og_description = ?, updated_by = ?, updated_at = ? WHERE game_type = ?
    `).bind(values.slug, values.name, values.eyebrow, values.shortDescription, values.metaTitle, values.metaDescription, values.keywords, values.ogTitle, values.ogDescription, context.user.id, new Date().toISOString(), gameType).run();
  } catch (error) {
    if (String(error).includes("game_pages.slug")) return json({ error: "هذا الرابط مستعمل للعبة أخرى." }, 409);
    throw error;
  }
  await auditAdmin(env, context.user.id, "game.seo.update", "game", gameType, values);
  const updated = await env.DB.prepare("SELECT * FROM game_pages WHERE game_type = ?").bind(gameType).first();
  return json({ game: publicGamePage(updated) });
}

async function adminListAdmins(env) {
  const result = await env.DB.prepare(`
    SELECT a.user_id, a.role, a.created_at, u.display_name, u.username, u.email, u.account_status
    FROM admins a JOIN users u ON u.id = a.user_id ORDER BY CASE a.role WHEN 'owner' THEN 0 ELSE 1 END, a.created_at
  `).all();
  return json({ admins: result.results.map((row) => ({ id: row.user_id, role: row.role, createdAt: row.created_at, name: row.display_name, username: row.username, email: row.email, status: row.account_status })) });
}

async function adminAddAdmin(request, env, context) {
  let input;
  try { input = await request.json(); } catch (_) { return json({ error: "البيانات المرسلة غير صالحة." }, 400); }
  const email = clean(input.email, "", 120).toLowerCase();
  const role = input.role === "owner" ? "owner" : "admin";
  const target = await env.DB.prepare("SELECT id, account_status FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (!target) return json({ error: "لا يوجد حساب مسجل بهذا البريد." }, 404);
  if (target.account_status !== "active") return json({ error: "فعّل الحساب قبل منحه صلاحية الإدارة." }, 409);
  await env.DB.prepare(`
    INSERT INTO admins (user_id, role, created_by, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, created_by = excluded.created_by
  `).bind(target.id, role, context.user.id, new Date().toISOString()).run();
  await auditAdmin(env, context.user.id, "admin.upsert", "user", target.id, { email, role });
  return json({ ok: true });
}

async function adminRemoveAdmin(env, context, targetId) {
  if (targetId === context.user.id) return json({ error: "لا يمكنك إزالة صلاحيتك الحالية من هنا." }, 400);
  const target = await env.DB.prepare("SELECT role FROM admins WHERE user_id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ error: "هذا الحساب ليس مشرفاً." }, 404);
  if (target.role === "owner") {
    const owners = await env.DB.prepare("SELECT COUNT(*) AS count FROM admins WHERE role = 'owner'").first();
    if (Number(owners.count || 0) <= 1) return json({ error: "لا يمكن إزالة مالك المنصة الوحيد." }, 409);
  }
  await env.DB.prepare("DELETE FROM admins WHERE user_id = ?").bind(targetId).run();
  await auditAdmin(env, context.user.id, "admin.remove", "user", targetId, { previousRole: target.role });
  return json({ ok: true });
}

async function adminAuditLog(env) {
  const result = await env.DB.prepare(`
    SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
      u.display_name AS admin_name, u.email AS admin_email
    FROM admin_audit_log l LEFT JOIN users u ON u.id = l.admin_user_id
    ORDER BY l.created_at DESC LIMIT 100
  `).all();
  return json({ entries: result.results.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, details: row.details, createdAt: row.created_at, adminName: row.admin_name || "حساب محذوف", adminEmail: row.admin_email || "" })) });
}

export class RoomChat {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/end") {
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(JSON.stringify({ type: "round-ended" })); socket.close(1000, "round-ended"); } catch (_) { /* Closing. */ }
      }
      await this.ctx.storage.deleteAll();
      return new Response("ok");
    }
    if (url.pathname === "/internal/game-sync" && request.method === "POST") {
      let input = {};
      try { input = await request.json(); } catch (_) { /* Empty sync payload is still valid. */ }
      const payload = JSON.stringify({ type: "game-sync", gameType: input.gameType || "imposter", phase: input.phase || null });
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(payload); } catch (_) { /* Ignore stale sockets. */ }
      }
      return json({ ok: true });
    }
    if (url.pathname === "/internal/bot-message" && request.method === "POST") {
      let input = {};
      try { input = await request.json(); } catch (_) { return json({ error: "رسالة الروبوت غير صالحة." }, 400); }
      const userId = clean(input.userId, "", 80);
      const body = clean(input.body, "", MAX_MESSAGE_LENGTH);
      if (!isBotId(userId) || !body) return json({ error: "رسالة الروبوت غير صالحة." }, 400);
      const membership = await this.env.DB.prepare(`
        SELECT u.display_name FROM room_members m JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ? AND m.round_id = ? AND m.user_id = ? LIMIT 1
      `).bind(input.roomId, input.roundId, userId).first();
      if (!membership) return json({ error: "الروبوت ليس عضواً في الجولة." }, 403);
      const message = { id: crypto.randomUUID(), userId, sender: membership.display_name, initial: membership.display_name.charAt(0), body, time: new Date().toISOString(), channel: "public" };
      await this.env.DB.prepare("INSERT INTO messages (id, room_id, round_id, user_id, channel, body, created_at) VALUES (?, ?, ?, ?, 'public', ?, ?)")
        .bind(message.id, input.roomId, input.roundId, userId, body, message.time).run();
      const payload = JSON.stringify({ type: "message", message });
      for (const socket of this.ctx.getWebSockets()) {
        try { if ((socket.deserializeAttachment()?.allowedChannels || []).includes("public")) socket.send(payload); } catch (_) { /* Ignore stale sockets. */ }
      }
      return json({ ok: true });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const code = clean(url.searchParams.get("room"), "", 20).toUpperCase();
    const room = await this.env.DB.prepare(`
      SELECT r.id AS room_id, r.is_private, rd.id AS round_id FROM rooms r JOIN rounds rd ON rd.room_id = r.id
      WHERE r.code = ? AND r.ended_at IS NULL AND rd.status = 'active' ORDER BY rd.number DESC LIMIT 1
    `).bind(code).first();
    if (!room) return json({ error: "انتهت الجولة." }, 410);
    const user = await getUser(request, this.env);
    const member = user ? await this.env.DB.prepare("SELECT role, alive FROM room_members WHERE room_id = ? AND user_id = ?").bind(room.room_id, user.id).first() : null;
    if (room.is_private && !member) return json({ error: "هذه الغرفة خاصة." }, 403);
    const allowedChannels = ["public"];
    if (member?.role === "أفراد الظل") allowedChannels.push("mafia");
    if (member && !member.alive) allowedChannels.push("dead");
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment = { userId: user?.id || null, name: user?.display_name || "مشاهد", initial: (user?.display_name || "م").charAt(0), roomId: room.room_id, roundId: room.round_id, allowedChannels, canSend: Boolean(member), lastMessageAt: 0 };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    const placeholders = allowedChannels.map(() => "?").join(",");
    const history = await this.env.DB.prepare(`
      SELECT m.*, u.display_name AS sender, u.avatar_type, u.avatar_value FROM messages m JOIN users u ON u.id = m.user_id
      WHERE m.round_id = ? AND m.channel IN (${placeholders}) ORDER BY m.created_at DESC LIMIT 180
    `).bind(room.round_id, ...allowedChannels).all();
    const histories = Object.fromEntries(allowedChannels.map((channel) => [channel, []]));
    history.results.reverse().forEach((message) => histories[message.channel]?.push({ id: message.id, userId: message.user_id, sender: message.sender, initial: message.sender.charAt(0), body: message.body, time: message.created_at, channel: message.channel, avatarType: message.avatar_type, avatarValue: message.avatar_value }));
    server.send(JSON.stringify({ type: "histories", histories, readOnly: !member }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const attachment = ws.deserializeAttachment() || {};
    const nowMs = Date.now();
    if (!attachment.canSend || !attachment.userId) return ws.send(JSON.stringify({ type: "error", message: "سجّل الدخول وانضم إلى الغرفة قبل الكتابة." }));
    if (nowMs - Number(attachment.lastMessageAt || 0) < 350) return ws.send(JSON.stringify({ type: "error", message: "تمهّل قليلاً قبل إرسال رسالة أخرى." }));
    let incoming;
    try { incoming = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)); } catch (_) { return ws.send(JSON.stringify({ type: "error", message: "تعذر قراءة الرسالة." })); }
    if (incoming.type !== "message") return;
    const channel = ["public", "mafia", "dead"].includes(incoming.channel) ? incoming.channel : "public";
    if (!attachment.allowedChannels.includes(channel)) return ws.send(JSON.stringify({ type: "error", message: "هذه القناة غير متاحة لدورك." }));
    const body = clean(incoming.body, "", MAX_MESSAGE_LENGTH);
    if (!body) return;
    attachment.lastMessageAt = nowMs;
    ws.serializeAttachment(attachment);
    const message = { id: crypto.randomUUID(), userId: attachment.userId, sender: attachment.name, initial: attachment.initial, body, time: new Date(nowMs).toISOString(), channel };
    await this.env.DB.prepare("INSERT INTO messages (id, room_id, round_id, user_id, channel, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(message.id, attachment.roomId, attachment.roundId, attachment.userId, channel, body, message.time).run();
    const payload = JSON.stringify({ type: "message", message });
    for (const socket of this.ctx.getWebSockets()) {
      try { if ((socket.deserializeAttachment()?.allowedChannels || []).includes(channel)) socket.send(payload); } catch (_) { /* Closing. */ }
    }
  }

  webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch (_) { /* Already closed. */ } }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    try {
      const gamePageMatch = url.pathname.match(/^\/games\/([a-z0-9-]+)\/?$/i);
      if (gamePageMatch && method === "GET") return serveGameSeoPage(request, env, gamePageMatch[1].toLowerCase());
      if (url.pathname === "/robots.txt" && method === "GET") return new Response(`User-agent: *\nAllow: /\nDisallow: /admindash\nDisallow: /api\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "public, max-age=3600" } });
      if (url.pathname === "/sitemap.xml" && method === "GET") return serveSitemap(request, env);
      if (url.pathname === "/api/health") return json({ ok: true, service: "qinaa", database: "d1", chat: "durable-object" });
      if (url.pathname === "/api/site/config" && method === "GET") return json(await siteConfig(env));
      if (url.pathname === "/api/games" && method === "GET") return json({ games: await listGamePages(env) });
      if (url.pathname.startsWith("/api/admin/")) {
        const ownerOnly = (url.pathname === "/api/admin/admins" && method === "POST") || (/^\/api\/admin\/admins\/[a-f0-9-]+$/i.test(url.pathname) && method === "DELETE");
        const context = await adminContext(request, env, ownerOnly);
        if (context.response) return context.response;
        if (url.pathname === "/api/admin/overview" && method === "GET") return adminOverview(env, context);
        if (url.pathname === "/api/admin/users" && method === "GET") return adminListUsers(url, env);
        const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/i);
        if (adminUserMatch && method === "PATCH") return adminUpdateUser(request, env, context, adminUserMatch[1]);
        if (adminUserMatch && method === "DELETE") return adminDeleteUser(env, context, adminUserMatch[1]);
        const revokeMatch = url.pathname.match(/^\/api\/admin\/users\/([a-f0-9-]+)\/revoke-sessions$/i);
        if (revokeMatch && method === "POST") return adminRevokeSessions(env, context, revokeMatch[1]);
        if (url.pathname === "/api/admin/rooms" && method === "GET") return adminListRooms(env);
        const roomEndMatch = url.pathname.match(/^\/api\/admin\/rooms\/([a-f0-9-]+)\/end$/i);
        if (roomEndMatch && method === "POST") return adminEndRoom(env, context, roomEndMatch[1]);
        const adminRoomMatch = url.pathname.match(/^\/api\/admin\/rooms\/([a-f0-9-]+)$/i);
        if (adminRoomMatch && method === "DELETE") return adminDeleteRoom(env, context, adminRoomMatch[1]);
        if (url.pathname === "/api/admin/settings" && method === "PATCH") return adminUpdateSettings(request, env, context);
        if (url.pathname === "/api/admin/games" && method === "GET") return json({ games: await listGamePages(env) });
        const adminGameMatch = url.pathname.match(/^\/api\/admin\/games\/(mafia|imposter|bluff)$/);
        if (adminGameMatch && method === "PATCH") return adminUpdateGamePage(request, env, context, adminGameMatch[1]);
        if (url.pathname === "/api/admin/admins" && method === "GET") return adminListAdmins(env);
        if (url.pathname === "/api/admin/admins" && method === "POST") return adminAddAdmin(request, env, context);
        const adminMemberMatch = url.pathname.match(/^\/api\/admin\/admins\/([a-f0-9-]+)$/i);
        if (adminMemberMatch && method === "DELETE") return adminRemoveAdmin(env, context, adminMemberMatch[1]);
        if (url.pathname === "/api/admin/audit" && method === "GET") return adminAuditLog(env);
        return json({ error: "مسار الإدارة غير موجود." }, 404);
      }
      if (url.pathname === "/api/auth/register" && method === "POST") return register(request, env);
      if (url.pathname === "/api/auth/login" && method === "POST") return login(request, env);
      if (url.pathname === "/api/auth/me" && method === "GET") {
        const user = await getUser(request, env);
        const admin = user ? await adminRecord(env, user) : null;
        return json({ user: publicUser(user, admin?.role || null) });
      }
      if (url.pathname === "/api/auth/complete-profile" && method === "POST") {
        const user = await getUser(request, env);
        return user ? completeOAuthProfile(request, env, user) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      if (url.pathname === "/api/auth/logout" && method === "POST") {
        const token = parseCookies(request).qinaa_session;
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
        return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", request, 0) });
      }
      const oauthStartMatch = url.pathname.match(/^\/api\/auth\/(google|facebook)\/start$/);
      if (oauthStartMatch && method === "GET") return oauthStart(request, env, oauthStartMatch[1]);
      const oauthCallbackMatch = url.pathname.match(/^\/api\/auth\/(google|facebook)\/callback$/);
      if (oauthCallbackMatch && method === "GET") return oauthCallback(request, env, oauthCallbackMatch[1]);
      if (url.pathname === "/api/profile" && method === "PATCH") {
        const user = await getUser(request, env);
        return user ? updateProfile(request, env, user) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      if (url.pathname === "/api/profile/avatar" && method === "POST") {
        const user = await getUser(request, env);
        return user ? uploadAvatar(request, env, user) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      if (url.pathname === "/api/friends" && method === "GET") {
        const user = await getUser(request, env);
        return user ? listSocialFriends(env, user) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      if (url.pathname === "/api/livekit/token" && method === "POST") return createLiveKitToken(request, env);
      const avatarMatch = url.pathname.match(/^\/api\/profile\/avatar\/([a-f0-9-]+)$/i);
      if (avatarMatch && method === "GET") {
        const avatar = await env.DB.prepare("SELECT mime_type, image_data, updated_at FROM avatar_uploads WHERE user_id = ?").bind(avatarMatch[1]).first();
        if (!avatar) return new Response("Not found", { status: 404 });
        return new Response(avatar.image_data, { headers: { "Content-Type": avatar.mime_type, "Cache-Control": "public, max-age=3600", ETag: `\"${avatar.updated_at}\"` } });
      }
      if (url.pathname === "/api/rooms" && method === "GET") return listRooms(url, env);
      if (url.pathname === "/api/rooms" && method === "POST") {
        const user = await getUser(request, env);
        return user ? createRoom(request, env, user) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      const memberMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})\/members\/([a-f0-9-]+)$/);
      if (memberMatch && method === "DELETE") {
        const user = await getUser(request, env);
        return user ? kickMember(env, memberMatch[1].toUpperCase(), user, memberMatch[2]) : json({ error: "يلزم تسجيل الدخول." }, 401);
      }
      const roomMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})(?:\/(join|start|me|end|leave))?$/);
      if (roomMatch) {
        const code = roomMatch[1].toUpperCase();
        const action = roomMatch[2];
        if (!action && method === "GET") return roomDetails(request, env, code);
        const user = await getUser(request, env);
        if (!user) return json({ error: "يلزم تسجيل الدخول." }, 401);
        if (!action && method === "PATCH") return updateRoom(request, env, code, user);
        if (action === "join" && method === "POST") return joinRoom(env, code, user);
        if (action === "start" && method === "POST") return startRoom(request, env, code, user);
        if (action === "me" && method === "GET") return myRoomState(env, code, user);
        if (action === "end" && method === "POST") return endRoom(env, code, user);
        if (action === "leave" && method === "DELETE") return leaveRoom(env, code, user);
      }
      const imposterMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})\/imposter(?:\/(ready|turn|vote|word))?$/);
      if (imposterMatch) {
        const code = imposterMatch[1].toUpperCase();
        const action = imposterMatch[2];
        if (!action && method === "GET") return imposterState(request, env, code);
        const user = await getUser(request, env);
        if (!user) return json({ error: "يلزم تسجيل الدخول." }, 401);
        if (action === "ready" && method === "POST") return imposterReady(env, code, user);
        if (action === "turn" && method === "POST") return imposterAdvanceTurn(request, env, code, user);
        if (action === "vote" && method === "POST") return imposterSubmitVote(request, env, code, user);
        if (action === "word" && method === "POST") return imposterSubmitWord(request, env, code, user);
      }
      const bluffMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})\/bluff(?:\/(play|peek|pass|answer))?$/);
      if (bluffMatch) {
        const code = bluffMatch[1].toUpperCase();
        const action = bluffMatch[2];
        if (!action && method === "GET") return bluffState(request, env, code);
        const user = await getUser(request, env);
        if (!user) return json({ error: "يلزم تسجيل الدخول." }, 401);
        if (action && method === "POST") return bluffAction(request, env, code, user, action);
      }
      if (url.pathname === "/api/chat/ws") {
        const room = clean(url.searchParams.get("room"), "", 20).toLowerCase();
        if (!room) return json({ error: "رمز الغرفة مطلوب." }, 400);
        return roomChatStub(env, room).fetch(request);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: "وقع خطأ في الخادم. حاول من جديد." }, 500);
    }
  },
};
