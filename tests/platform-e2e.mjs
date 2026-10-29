import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = "QinaaTest!2026";

class Client {
  constructor(label) {
    this.label = label;
    this.cookie = "";
    this.user = null;
  }

  async request(path, { method = "GET", body, expected = 200, text = false } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const payload = text ? await response.text() : await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${this.label} ${method} ${path}: expected ${expected}, got ${response.status} (${payload?.error || payload})`);
    return payload;
  }

  async register(index) {
    const result = await this.request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: {
        displayName: `مختبر المنصة ${index}`,
        username: `ptest.${runId}.${index}`.slice(0, 24),
        email: `ptest.${runId}.${index}@example.com`,
        birthDate: "2000-01-01",
        password,
        avatarValue: `mask-0${index}`,
      },
    });
    this.user = result.user;
    assert.ok(this.cookie.startsWith("qinaa_session="));
    assert.ok(!Object.keys(result.user).some((key) => key.includes("password")), "Public user leaked password fields");
    return result.user;
  }
}

const step = (message) => process.stdout.write(`✓ ${message}\n`);

async function main() {
  const anonymous = new Client("anonymous");
  const health = await anonymous.request("/api/health");
  assert.equal(health.ok, true);
  const games = await anonymous.request("/api/games");
  assert.equal(games.games.length, 3);
  const robots = await anonymous.request("/robots.txt", { text: true });
  const sitemap = await anonymous.request("/sitemap.xml", { text: true });
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /afrad-alzil/);
  assert.match(sitemap, /aldakhil/);
  assert.match(sitemap, /bluff-card/);
  await anonymous.request("/games/afrad-alzil", { text: true });
  await anonymous.request("/games/aldakhil", { text: true });
  await anonymous.request("/games/bluff-card", { text: true });
  step("الصحة العامة وصفحات اللعب وSEO تعمل");

  await anonymous.request("/api/rooms", { method: "POST", expected: 401, body: {} });
  await anonymous.request("/api/auth/register", {
    method: "POST",
    expected: 400,
    body: { displayName: "س", username: "x", email: "bad", birthDate: "2035-01-01", password: "short" },
  });
  await anonymous.request("/api/auth/register", {
    method: "POST",
    expected: 400,
    body: { displayName: "تاريخ مستقبلي", username: `future.${runId}`.slice(0, 24), email: `future.${runId}@example.com`, birthDate: "2035-01-01", password },
  });
  await anonymous.request("/api/auth/register", {
    method: "POST",
    expected: 400,
    body: { displayName: "تاريخ غير صالح", username: `date.${runId}`.slice(0, 24), email: `date.${runId}@example.com`, birthDate: "2000-99-99", password },
  });
  step("التحقق من التسجيل يرفض البيانات والتواريخ غير الصالحة");

  const host = new Client("host");
  const guest = new Client("guest");
  const third = new Client("third");
  await Promise.all([host.register(1), guest.register(2), third.register(3)]);
  await anonymous.request("/api/auth/register", {
    method: "POST",
    expected: 409,
    body: { displayName: "مكرر", username: `duplicate.${runId}`.slice(0, 24), email: host.user.email, birthDate: "2000-01-01", password },
  });
  const me = await host.request("/api/auth/me");
  assert.equal(me.user.id, host.user.id);
  await host.request("/api/auth/logout", { method: "POST" });
  assert.equal((await host.request("/api/auth/me")).user, null);
  await host.request("/api/auth/login", { method: "POST", expected: 401, body: { login: host.user.email, password: "wrong-password" } });
  await host.request("/api/auth/login", { method: "POST", body: { login: host.user.username, password } });
  step("التسجيل، منع التكرار، الجلسة، الخروج والدخول تعمل");

  await host.request("/api/profile", {
    method: "PATCH",
    expected: 401,
    body: { displayName: "مختبر محدّث", username: host.user.username, birthDate: "1999-02-03", currentPassword: "wrong-password", newPassword: "NewQinaa!2026", avatarValue: "mask-10" },
  });
  const profile = await host.request("/api/profile", {
    method: "PATCH",
    body: { displayName: "مختبر محدّث", username: host.user.username, birthDate: "1999-02-03", currentPassword: password, newPassword: "NewQinaa!2026", avatarValue: "mask-10" },
  });
  assert.equal(profile.user.displayName, "مختبر محدّث");
  assert.equal(profile.user.birthDate, "1999-02-03");
  assert.equal(profile.user.avatarValue, "mask-10");
  await host.request("/api/auth/logout", { method: "POST" });
  await host.request("/api/auth/login", { method: "POST", expected: 401, body: { login: host.user.username, password } });
  await host.request("/api/auth/login", { method: "POST", body: { login: host.user.username, password: "NewQinaa!2026" } });
  step("تعديل الملف والأيقونة وكلمة المرور يعمل بأمان");

  const privateRoom = await host.request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "mafia", private: true } });
  const privateCode = privateRoom.room.code;
  assert.match(privateCode, /^\d{6}$/);
  const listed = await anonymous.request("/api/rooms?game=mafia");
  assert.ok(!listed.rooms.some((room) => room.code === privateCode));
  await anonymous.request(`/api/rooms/${privateCode}`, { expected: 404 });
  await guest.request(`/api/rooms/${privateCode}/join`, { method: "POST" });
  await guest.request(`/api/rooms/${privateCode}`, { method: "PATCH", expected: 403, body: { private: false } });
  await guest.request(`/api/rooms/${privateCode}/start`, { method: "POST", expected: 403, body: {} });
  await host.request(`/api/rooms/${privateCode}/members/${host.user.id}`, { method: "DELETE", expected: 400 });
  step("الغرفة الخاصة مخفية وصلاحيات المضيف محمية");

  const started = await host.request(`/api/rooms/${privateCode}/start`, { method: "POST", body: { options: { cupid: true, witch: true } } });
  assert.equal(started.started, true);
  assert.equal(started.botsAdded, 3);
  const playing = await host.request(`/api/rooms/${privateCode}`);
  assert.equal(playing.members.length, 5);
  assert.equal(playing.members.filter((member) => member.bot).length, 3);
  assert.equal((await host.request(`/api/rooms/${privateCode}/me`)).gameType, "mafia");
  await third.request(`/api/rooms/${privateCode}/join`, { method: "POST", expected: 409 });
  await guest.request(`/api/rooms/${privateCode}/leave`, { method: "DELETE" });
  const replaced = await host.request(`/api/rooms/${privateCode}`);
  assert.equal(replaced.members.length, 5);
  assert.equal(replaced.members.filter((member) => member.bot).length, 4);
  await host.request(`/api/rooms/${privateCode}/end`, { method: "POST" });
  await host.request(`/api/rooms/${privateCode}`, { expected: 410 });
  step("بداية أفراد الظل، الأدوار، الروبوتات، التعويض ونهاية الرابط تعمل");

  const transferRoom = await host.request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "mafia", private: false } });
  const transferCode = transferRoom.room.code;
  await guest.request(`/api/rooms/${transferCode}/join`, { method: "POST" });
  await host.request(`/api/rooms/${transferCode}/leave`, { method: "DELETE" });
  const transferred = await guest.request(`/api/rooms/${transferCode}`);
  assert.equal(transferred.members.find((member) => member.id === guest.user.id)?.host, true);
  await guest.request(`/api/rooms/${transferCode}/leave`, { method: "DELETE" });
  await anonymous.request(`/api/rooms/${transferCode}`, { expected: 410 });
  step("انتقال الاستضافة وإنهاء غرفة المضيف الأخير يعملان");

  await guest.request("/api/admin/overview", { expected: 403 });
  step("لوحة الإدارة محمية من المستخدم العادي");

  process.stdout.write("\nPLATFORM E2E PASS\n");
}

main().catch((error) => {
  console.error("PLATFORM E2E FAIL", error);
  process.exitCode = 1;
});
