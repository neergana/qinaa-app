import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class Client {
  constructor() { this.cookie = ""; this.user = null; }
  async request(path, { method = "GET", body, expected = 200 } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${payload.error || ""}`);
    return payload;
  }
  async register() {
    const result = await this.request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: {
        displayName: "مختبر الروبوتات",
        username: `bots.${runId}`.slice(0, 24),
        email: `bots.${runId}@example.com`,
        birthDate: "2000-01-01",
        password: "QinaaBots!2026",
      },
    });
    this.user = result.user;
  }
}

const step = (message) => process.stdout.write(`✓ ${message}\n`);

async function testImposter(host) {
  const created = await host.request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "imposter" } });
  const code = created.room.code;
  const started = await host.request(`/api/rooms/${code}/start`, { method: "POST", body: {} });
  assert.equal(started.botsAdded, 3);
  let state = await host.request(`/api/rooms/${code}/imposter`);
  assert.equal(state.players.length, 4);
  assert.equal(state.players.filter((player) => player.id.startsWith("qinaa-bot-")).length, 3);
  await host.request(`/api/rooms/${code}/imposter/ready`, { method: "POST", body: {} });

  for (let guard = 0; guard < 20; guard += 1) {
    state = await host.request(`/api/rooms/${code}/imposter`);
    if (state.phase !== "questions") break;
    const actorId = state.turnStage === "question" ? state.askerId : state.answererId;
    if (actorId !== host.user.id) continue;
    await host.request(`/api/rooms/${code}/imposter/turn`, {
      method: "POST",
      body: { action: state.turnStage === "question" ? "question_done" : "answer_done" },
    });
  }

  state = await host.request(`/api/rooms/${code}/imposter`);
  assert.equal(state.phase, "vote");
  const suspect = state.players.find((player) => player.id !== host.user.id);
  if (state.me.role === "الدخيل") {
    await host.request(`/api/rooms/${code}/imposter/word`, { method: "POST", body: { word: state.me.candidates[0] } });
  }
  await host.request(`/api/rooms/${code}/imposter/vote`, { method: "POST", body: { selections: [suspect.id] } });
  state = await host.request(`/api/rooms/${code}/imposter`);
  assert.equal(state.phase, "results");
  await host.request(`/api/rooms/${code}/end`, { method: "POST" });
  step("الدخيل يبدأ بلاعب واحد، والروبوتات تكمل الأسئلة والتصويت والنتيجة");
}

async function testBluff(host) {
  const created = await host.request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "bluff" } });
  const code = created.room.code;
  const started = await host.request(`/api/rooms/${code}/start`, { method: "POST", body: {} });
  assert.equal(started.botsAdded, 2);
  let state = await host.request(`/api/rooms/${code}/bluff`);
  assert.equal(state.players.length, 3);
  assert.equal(state.players.filter((player) => player.bot).length, 2);
  const openingVersion = state.version;

  for (let guard = 0; guard < 8 && state.phase !== "results"; guard += 1) {
    state = await host.request(`/api/rooms/${code}/bluff`);
    if (state.phase === "select" && state.currentPlayerId === host.user.id) {
      const card = state.me.hand[0];
      await host.request(`/api/rooms/${code}/bluff/play`, {
        method: "POST",
        body: { cardId: card.id, targetUserId: state.me.selectTargets[0], claim: card.type },
      });
    } else if (state.phase === "respond" && state.receiverId === host.user.id) {
      await host.request(`/api/rooms/${code}/bluff/answer`, { method: "POST", body: { answer: true } });
    } else if (state.phase === "pass" && state.receiverId === host.user.id) {
      await host.request(`/api/rooms/${code}/bluff/pass`, {
        method: "POST",
        body: { targetUserId: state.me.passTargets[0], claim: state.cardTypes[0].id },
      });
    }
  }

  state = await host.request(`/api/rooms/${code}/bluff`);
  assert.ok(state.version > openingVersion, "Expected bot-assisted bluff game to advance");
  await host.request(`/api/rooms/${code}/end`, { method: "POST" });
  step("بطاقة الخداع تبدأ بلاعب واحد، والروبوتات تمرّر وتحكم من دون توقف");
}

async function main() {
  const host = new Client();
  await host.register();
  await testImposter(host);
  await testBluff(host);
  process.stdout.write("\nBOT E2E PASS\n");
}

main().catch((error) => {
  console.error("BOT E2E FAIL", error);
  process.exitCode = 1;
});
