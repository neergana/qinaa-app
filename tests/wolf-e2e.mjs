import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class Client {
  constructor(index) { this.index = index; this.cookie = ""; this.user = null; }
  async request(path, { method = "GET", body, expected = 200 } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${payload.error || ""}`);
    return payload;
  }
  async register() {
    const result = await this.request("/api/auth/register", {
      method: "POST", expected: 201,
      body: { displayName: `قروي ${this.index}`, username: `wolf.${runId}.${this.index}`.slice(0, 24), email: `wolf.${runId}.${this.index}@example.com`, birthDate: "2000-01-01", password: "QinaaWolf!2026" },
    });
    this.user = result.user;
  }
}

async function main() {
  const players = Array.from({ length: 11 }, (_, index) => new Client(index + 1));
  await Promise.all(players.map((player) => player.register()));
  const created = await players[0].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "wolf", private: true } });
  const code = created.room.code;
  assert.equal(created.room.gameType, "wolf");
  await Promise.all(players.slice(1).map((player) => player.request(`/api/rooms/${code}/join`, { method: "POST" })));
  const started = await players[0].request(`/api/rooms/${code}/start`, { method: "POST", body: {} });
  assert.equal(started.gameType, "wolf");

  const memberships = await Promise.all(players.map((player) => player.request(`/api/rooms/${code}/me`)));
  const byRole = new Map();
  memberships.forEach((membership, index) => {
    if (!byRole.has(membership.role)) byRole.set(membership.role, []);
    byRole.get(membership.role).push(players[index]);
  });
  ["الذئب", "ساكن القرية", "العرّافة", "الساحرة", "الصياد", "عين الليل", "رابطة القلوب", "الملعون", "العجوز"].forEach((role) => assert.ok(byRole.has(role), `Missing role ${role}`));

  await Promise.all(players.map((player) => player.request(`/api/rooms/${code}/mafia/ready`, { method: "POST", body: {} })));
  const cursed = byRole.get("الملعون")[0];
  const wolves = byRole.get("الذئب");
  const villagers = byRole.get("ساكن القرية");
  for (const wolf of wolves) await wolf.request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { targetUserId: cursed.user.id } });
  await byRole.get("العرّافة")[0].request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { targetUserId: wolves[0].user.id } });
  await byRole.get("الساحرة")[0].request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { mode: "pass" } });
  await byRole.get("الصياد")[0].request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { targetUserId: villagers[0].user.id } });
  await byRole.get("عين الليل")[0].request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { targetUserId: wolves[0].user.id } });
  await byRole.get("رابطة القلوب")[0].request(`/api/rooms/${code}/mafia/night`, { method: "POST", body: { targetUserIds: [villagers[0].user.id, byRole.get("العجوز")[0].user.id] } });

  const state = await players[0].request(`/api/rooms/${code}/mafia`);
  assert.equal(state.gameType, "wolf");
  assert.equal(state.phase, "day");
  assert.equal(state.lastResult.transformedId, cursed.user.id);
  const transformed = await cursed.request(`/api/rooms/${code}/me`);
  assert.equal(transformed.role, "الذئب");
  const seerState = await byRole.get("العرّافة")[0].request(`/api/rooms/${code}/mafia`);
  assert.equal(seerState.me.privateResult.shadow, true);
  const eyeState = await byRole.get("عين الليل")[0].request(`/api/rooms/${code}/mafia`);
  assert.equal(eyeState.me.privateResult.wokeAtNight, true);
  await players[0].request(`/api/rooms/${code}/end`, { method: "POST" });
  process.stdout.write("✓ ذئاب القرية: توزيع الأدوار، قرارات الليل وتحول الملعون تعمل\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
