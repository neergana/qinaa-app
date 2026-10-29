import assert from "node:assert/strict";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = "QinaaBluff!2026";

class Client {
  constructor(label) { this.label = label; this.cookie = ""; this.user = null; }
  async request(path, { method = "GET", body, expected = 200 } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const payload = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${this.label} ${method} ${path}: ${response.status} ${payload.error || ""}`);
    return payload;
  }
  async register(index) {
    const result = await this.request("/api/auth/register", {
      method: "POST", expected: 201,
      body: {
        displayName: `مختبر الخداع ${index}`,
        username: `bluff.${runId}.${index}`.slice(0, 24),
        email: `bluff.${runId}.${index}@example.com`,
        birthDate: "2000-01-01", password,
      },
    });
    this.user = result.user;
  }
}

const step = (message) => process.stdout.write(`✓ ${message}\n`);

async function main() {
  const players = [new Client("first"), new Client("second"), new Client("third")];
  await Promise.all(players.map((client, index) => client.register(index + 1)));
  const created = await players[0].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "bluff", private: false } });
  const code = created.room.code;
  assert.equal(created.room.capacity, 5);
  await Promise.all(players.slice(1).map((client) => client.request(`/api/rooms/${code}/join`, { method: "POST" })));
  const started = await players[0].request(`/api/rooms/${code}/start`, { method: "POST", body: {} });
  assert.equal(started.gameType, "bluff");
  assert.equal(started.botsAdded, 0);

  const states = await Promise.all(players.map((client) => client.request(`/api/rooms/${code}/bluff`)));
  const counts = states[0].players.map((player) => player.handCount);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 64);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  states.forEach((state, index) => {
    assert.equal(state.me.hand.length, state.players.find((player) => player.id === players[index].user.id).handCount);
    assert.equal(state.cardTypes.length, 8);
  });
  const spectator = new Client("spectator");
  const spectatorState = await spectator.request(`/api/rooms/${code}/bluff`);
  assert.equal(spectatorState.me, null);
  assert.equal(JSON.stringify(spectatorState).includes('"activeCard"'), false);
  step("توزيع 64 بطاقة متوازن وأسرار اليد لا تصل إلى المشاهد");

  const byId = new Map(players.map((client) => [client.user.id, client]));
  let currentState = await players[0].request(`/api/rooms/${code}/bluff`);
  const currentClient = byId.get(currentState.currentPlayerId);
  const currentPrivate = await currentClient.request(`/api/rooms/${code}/bluff`);
  const firstCard = currentPrivate.me.hand[0];
  const firstTargetId = currentPrivate.me.selectTargets[0];
  const firstTarget = byId.get(firstTargetId);
  await currentClient.request(`/api/rooms/${code}/bluff/play`, { method: "POST", body: { cardId: firstCard.id, targetUserId: firstTargetId, claim: firstCard.type } });
  const targetState = await firstTarget.request(`/api/rooms/${code}/bluff`);
  assert.equal(targetState.me.canAnswer, true);
  assert.equal(targetState.me.activeCard, null);
  const unrelated = players.find((client) => ![currentClient, firstTarget].includes(client));
  await unrelated.request(`/api/rooms/${code}/bluff/peek`, { method: "POST", body: {}, expected: 409 });
  await firstTarget.request(`/api/rooms/${code}/bluff/answer`, { method: "POST", body: { answer: true } });
  currentState = await currentClient.request(`/api/rooms/${code}/bluff`);
  assert.equal(currentState.lastResult.correct, true);
  assert.equal(currentState.lastResult.penaltyUserId, currentClient.user.id);
  assert.equal(currentState.currentPlayerId, currentClient.user.id);
  step("الادعاء والحكم الصحيح يضعان العقوبة على المرسل ويعيدان له الدور");

  const secondPrivate = await currentClient.request(`/api/rooms/${code}/bluff`);
  const secondCard = secondPrivate.me.hand[0];
  const secondTargetId = secondPrivate.me.selectTargets[0];
  const secondTarget = byId.get(secondTargetId);
  await currentClient.request(`/api/rooms/${code}/bluff/play`, { method: "POST", body: { cardId: secondCard.id, targetUserId: secondTargetId, claim: secondCard.type } });
  await secondTarget.request(`/api/rooms/${code}/bluff/peek`, { method: "POST", body: {} });
  const peeked = await secondTarget.request(`/api/rooms/${code}/bluff`);
  assert.equal(peeked.me.activeCard.type, secondCard.type);
  assert.equal(peeked.me.passTargets.length, 1);
  const finalTarget = byId.get(peeked.me.passTargets[0]);
  await secondTarget.request(`/api/rooms/${code}/bluff/pass`, { method: "POST", body: { targetUserId: finalTarget.user.id, claim: secondCard.type } });
  const finalState = await finalTarget.request(`/api/rooms/${code}/bluff`);
  assert.equal(finalState.me.canPeek, false);
  await finalTarget.request(`/api/rooms/${code}/bluff/answer`, { method: "POST", body: { answer: true } });
  const passedResult = await players[0].request(`/api/rooms/${code}/bluff`);
  assert.equal(passedResult.lastResult.penaltyUserId, secondTarget.user.id);
  step("المشاهدة السرية والتمرير للاعب غير مطّلع يعملان، والأخير مجبر على الحكم");

  await finalTarget.request(`/api/rooms/${code}/leave`, { method: "DELETE" });
  const replaced = await players[0].request(`/api/rooms/${code}/bluff`);
  assert.equal(replaced.players.length, 3);
  assert.ok(replaced.players.some((player) => player.bot));
  await players[0].request(`/api/rooms/${code}/end`, { method: "POST" });
  step("الخروج أثناء الجولة يستبدل اللاعب بروبوت ويحافظ على الطاولة");

  const eliminationRoom = await players[0].request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "bluff", private: false } });
  const eliminationCode = eliminationRoom.room.code;
  await Promise.all(players.slice(1).map((client) => client.request(`/api/rooms/${eliminationCode}/join`, { method: "POST" })));
  await players[0].request(`/api/rooms/${eliminationCode}/start`, { method: "POST", body: {} });
  const privateStates = await Promise.all(players.map((client) => client.request(`/api/rooms/${eliminationCode}/bluff`)));
  const candidateOptions = privateStates.flatMap((state, index) => {
    const totals = Object.groupBy(state.me.hand, (card) => card.type);
    return Object.entries(totals).map(([type, cards]) => ({ client: players[index], type, cards, count: cards.length }));
  }).sort((first, second) => second.count - first.count);
  const candidate = candidateOptions.find((option) => option.count >= 3);
  assert.ok(candidate, "Expected a player with at least three cards of one type");
  const external = privateStates.flatMap((state, index) => state.me.hand
    .filter((card) => card.type === candidate.type && players[index] !== candidate.client)
    .map((card) => ({ client: players[index], card })))[0];
  assert.ok(external, "Expected an external fourth card of the chosen type");

  const forceTurn = async (targetClient) => {
    const publicState = await players[0].request(`/api/rooms/${eliminationCode}/bluff`);
    if (publicState.currentPlayerId === targetClient.user.id) return;
    const actor = byId.get(publicState.currentPlayerId);
    const actorState = await actor.request(`/api/rooms/${eliminationCode}/bluff`);
    const card = actorState.me.hand.find((item) => item.type !== candidate.type) || actorState.me.hand[0];
    await actor.request(`/api/rooms/${eliminationCode}/bluff/play`, { method: "POST", body: { cardId: card.id, targetUserId: targetClient.user.id, claim: card.type } });
    await targetClient.request(`/api/rooms/${eliminationCode}/bluff/answer`, { method: "POST", body: { answer: false } });
  };

  await forceTurn(external.client);
  const externalState = await external.client.request(`/api/rooms/${eliminationCode}/bluff`);
  const externalCard = externalState.me.hand.find((card) => card.type === candidate.type);
  await external.client.request(`/api/rooms/${eliminationCode}/bluff/play`, { method: "POST", body: { cardId: externalCard.id, targetUserId: candidate.client.user.id, claim: candidate.type } });
  await candidate.client.request(`/api/rooms/${eliminationCode}/bluff/answer`, { method: "POST", body: { answer: false } });

  for (let guard = 0; guard < 3; guard += 1) {
    const candidateState = await candidate.client.request(`/api/rooms/${eliminationCode}/bluff`);
    if (candidateState.me.eliminated) break;
    const card = candidateState.me.hand.find((item) => item.type === candidate.type);
    assert.ok(card, "Candidate ran out of matching cards before elimination");
    const receiverId = candidateState.me.selectTargets[0];
    const receiver = byId.get(receiverId);
    await candidate.client.request(`/api/rooms/${eliminationCode}/bluff/play`, { method: "POST", body: { cardId: card.id, targetUserId: receiverId, claim: candidate.type } });
    await receiver.request(`/api/rooms/${eliminationCode}/bluff/answer`, { method: "POST", body: { answer: true } });
  }
  const eliminatedState = await players[0].request(`/api/rooms/${eliminationCode}/bluff`);
  const eliminatedPlayer = eliminatedState.players.find((player) => player.id === candidate.client.user.id);
  assert.equal(eliminatedPlayer.eliminated, true);
  assert.equal(eliminatedPlayer.handCount, 0);
  assert.equal(eliminatedPlayer.penaltyCount, 0);
  assert.equal(eliminatedState.players.filter((player) => !player.eliminated).length, 2);
  await players[0].request(`/api/rooms/${eliminationCode}/end`, { method: "POST" });
  step("أربع بطاقات من النوع نفسه تقصي اللاعب وتعيد يده وعقوباته إلى الرزمة");

  process.stdout.write("\nBLUFF E2E PASS\n");
}

main().catch((error) => {
  console.error("BLUFF E2E FAIL", error);
  process.exitCode = 1;
});
