import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

class TestClient {
  constructor(label) {
    this.label = label;
    this.cookie = "";
    this.user = null;
  }

  async request(path, { method = "GET", body, expected = 200 } = {}) {
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
    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${this.label} ${method} ${path}: expected ${expected}, got ${response.status} (${payload.error || "no error"})`);
    return payload;
  }

  async register(index) {
    const payload = await this.request("/api/auth/register", {
      method: "POST",
      expected: 201,
      body: {
        displayName: `مختبر ${index}`,
        username: `qtest.${runId}.${index}`.slice(0, 24),
        email: `qtest.${runId}.${index}@example.com`,
        birthDate: "2000-01-01",
        password: "QinaaTest!2026",
        avatarValue: `mask-0${index}`,
      },
    });
    this.user = payload.user;
    assert.ok(this.cookie.startsWith("qinaa_session="), `${this.label}: session cookie missing`);
    return payload.user;
  }
}

const step = (message) => process.stdout.write(`✓ ${message}\n`);

async function advanceQuestionCycle(clients, code) {
  for (;;) {
    const state = await clients[0].request(`/api/rooms/${code}/imposter`);
    if (state.phase !== "questions") return state;
    const actorId = state.turnStage === "question" ? state.askerId : state.answererId;
    const actor = clients.find((client) => client.user.id === actorId);
    assert.ok(actor, `No client found for active ${state.turnStage} actor ${actorId}`);
    await actor.request(`/api/rooms/${code}/imposter/turn`, {
      method: "POST",
      body: { action: state.turnStage === "question" ? "question_done" : "answer_done" },
    });
  }
}

async function main() {
  const clients = [1, 2, 3, 4].map((index) => new TestClient(`player-${index}`));
  await Promise.all(clients.map((client, index) => client.register(index + 1)));
  step("إنشاء أربع حسابات مستقلة وجلسات آمنة");

  const temporary = await clients[3].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "imposter" } });
  await clients[3].request(`/api/rooms/${temporary.room.code}/leave`, { method: "DELETE" });
  await clients[3].request(`/api/rooms/${temporary.room.code}`, { expected: 410 });
  step("المغادرة من اللوبي تنهي غرفة المضيف الوحيد وتجعل رابطها غير صالح");

  const created = await clients[0].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "imposter", private: false } });
  const code = created.room.code;
  assert.match(code, /^\d{6}$/, "Room code must contain exactly six digits");
  assert.equal(created.room.gameType, "imposter");
  await Promise.all(clients.slice(1).map((client) => client.request(`/api/rooms/${code}/join`, { method: "POST" })));
  const lobby = await clients[0].request(`/api/rooms/${code}`);
  assert.equal(lobby.members.length, 4);
  assert.equal(lobby.room.status, "بانتظار اللاعبين");
  const spectator = new TestClient("spectator");
  const spectatorLobby = await spectator.request(`/api/rooms/${code}`);
  assert.equal(spectatorLobby.viewerMember, false);
  assert.equal(spectatorLobby.room.status, "بانتظار اللاعبين");
  step("غرفة الدخيل مستقلة، أربعة لاعبين، والمشاهد يرى أنها لم تبدأ بعد");

  const mafiaRooms = await spectator.request("/api/rooms?game=mafia");
  const imposterRooms = await spectator.request("/api/rooms?game=imposter");
  assert.ok(imposterRooms.rooms.some((room) => room.code === code));
  assert.ok(!mafiaRooms.rooms.some((room) => room.code === code));
  step("دليل غرف الدخيل منفصل عن دليل غرف أفراد الظل");

  await clients[0].request(`/api/rooms/${code}/start`, { method: "POST", body: {} });
  const revealStates = await Promise.all(clients.map((client) => client.request(`/api/rooms/${code}/imposter`)));
  const imposters = revealStates.filter((state) => state.me.role === "الدخيل");
  const knowers = revealStates.filter((state) => state.me.role === "عارف الكلمة");
  assert.equal(imposters.length, 1);
  assert.equal(knowers.length, 3);
  assert.equal(imposters[0].me.secretWord, null);
  assert.deepEqual(imposters[0].me.candidates, []);
  assert.ok(knowers.every((state) => state.me.secretWord && state.me.candidates.length === 0));
  step("توزيع سري صحيح: دخيل واحد، والكلمة لا تتسرّب إليه قبل التصويت");

  await Promise.all(clients.map((client) => client.request(`/api/rooms/${code}/imposter/ready`, { method: "POST" })));
  let questions = await clients[0].request(`/api/rooms/${code}/imposter`);
  assert.equal(questions.phase, "questions");
  assert.equal(questions.totalTurns, 4);
  const wrongActor = clients.find((client) => client.user.id !== questions.askerId);
  await wrongActor.request(`/api/rooms/${code}/imposter/turn`, { method: "POST", expected: 403, body: { action: "question_done" } });
  step("مرحلة الأسئلة تبدأ بعد تأكيد الجميع، ولا يمكن للاعب آخر تمرير الدور");

  const voteState = await advanceQuestionCycle(clients, code);
  assert.equal(voteState.phase, "vote");
  assert.ok(voteState.voteSecondsRemaining > 0 && voteState.voteSecondsRemaining <= 30);
  step("كل لاعب سأل وأجاب مرة واحدة؛ الانتقال تلقائي إلى تصويت 30 ثانية");

  const imposterClient = clients.find((client) => client.user.id === imposters[0].me.id);
  const imposterVoteState = await imposterClient.request(`/api/rooms/${code}/imposter`);
  assert.ok(imposterVoteState.me.candidates.length >= 6);
  const secretWord = knowers[0].me.secretWord;
  const wrongWord = imposterVoteState.me.candidates.find((word) => word !== secretWord);
  assert.ok(wrongWord);

  for (const client of clients) {
    const target = clients.find((candidate) => candidate.user.id !== client.user.id).user.id;
    await client.request(`/api/rooms/${code}/imposter/vote`, { method: "POST", body: { selections: [target] } });
  }
  const beforeWord = await clients[0].request(`/api/rooms/${code}/imposter`);
  assert.equal(beforeWord.phase, "vote");
  assert.equal(beforeWord.me.voteConfirmed, true);
  assert.ok(!Object.hasOwn(beforeWord, "ballots"));
  await imposterClient.request(`/api/rooms/${code}/imposter/word`, { method: "POST", body: { word: wrongWord } });
  const result = await clients[0].request(`/api/rooms/${code}/imposter`);
  assert.equal(result.phase, "results");
  assert.equal(result.results.secretWord, secretWord);
  assert.equal(result.results.imposters.length, 1);
  assert.ok(["knowers", "imposters"].includes(result.results.winner));
  step("التصويت سري ومؤكد، اختيار الدخيل للكلمة يعمل، والنتيجة تُحسم على الخادم");

  const replacementRoom = await clients[0].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "imposter" } });
  const replacementCode = replacementRoom.room.code;
  await Promise.all(clients.slice(1).map((client) => client.request(`/api/rooms/${replacementCode}/join`, { method: "POST" })));
  await clients[0].request(`/api/rooms/${replacementCode}/start`, { method: "POST", body: {} });
  await clients[2].request(`/api/rooms/${replacementCode}/leave`, { method: "DELETE" });
  const replaced = await clients[0].request(`/api/rooms/${replacementCode}`);
  assert.equal(replaced.members.length, 4);
  assert.equal(replaced.members.filter((member) => member.bot).length, 1);
  step("مغادرة لاعب أثناء الجولة تستبدله بروبوت مع بقاء عدد المقاعد ثابتاً");

  process.stdout.write(`\nE2E PASS — room ${code}\n`);
}

main().catch((error) => {
  console.error("E2E FAIL", error);
  process.exitCode = 1;
});
