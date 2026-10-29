import assert from "node:assert/strict";
import WebSocket from "ws";

const baseUrl = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const wsUrl = baseUrl.replace(/^http/, "ws");
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const password = "QinaaChat!2026";

class Client {
  constructor(label) { this.label = label; this.cookie = ""; this.user = null; }
  async request(path, { method = "GET", body, expected = 200 } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
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
      method: "POST",
      expected: 201,
      body: {
        displayName: `مختبر الدردشة ${index}`,
        username: `chat.${runId}.${index}`.slice(0, 24),
        email: `chat.${runId}.${index}@example.com`,
        birthDate: "2000-01-01",
        password,
      },
    });
    this.user = result.user;
  }
}

class SocketInbox {
  constructor(cookie, room) {
    this.messages = [];
    this.waiters = [];
    this.socket = new WebSocket(`${wsUrl}/api/chat/ws?room=${room}`, { headers: cookie ? { Cookie: cookie } : {} });
    this.socket.on("message", (raw) => {
      const value = JSON.parse(raw.toString());
      this.messages.push(value);
      this.flush();
    });
  }
  flush() {
    this.waiters = this.waiters.filter((waiter) => {
      const index = this.messages.findIndex(waiter.predicate);
      if (index < 0) return true;
      const [value] = this.messages.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(value);
      return false;
    });
  }
  wait(predicate, label, timeout = 4000) {
    const index = this.messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error(`Timeout waiting for ${label}`));
      }, timeout);
      this.waiters.push(waiter);
    });
  }
  send(value) { this.socket.send(JSON.stringify(value)); }
  close() { this.socket.close(); }
}

const step = (message) => process.stdout.write(`✓ ${message}\n`);

async function main() {
  const host = new Client("host");
  const guest = new Client("guest");
  await Promise.all([host.register(1), guest.register(2)]);
  const created = await host.request("/api/rooms", { method: "POST", expected: 201, body: { gameType: "mafia", private: false } });
  const code = created.room.code;
  await guest.request(`/api/rooms/${code}/join`, { method: "POST" });
  await host.request(`/api/rooms/${code}/start`, { method: "POST", body: {} });

  const hostSocket = new SocketInbox(host.cookie, code);
  const guestSocket = new SocketInbox(guest.cookie, code);
  const spectatorSocket = new SocketInbox("", code);
  const [hostHistory, guestHistory, spectatorHistory] = await Promise.all([
    hostSocket.wait((item) => item.type === "histories", "host history"),
    guestSocket.wait((item) => item.type === "histories", "guest history"),
    spectatorSocket.wait((item) => item.type === "histories", "spectator history"),
  ]);
  assert.equal(hostHistory.readOnly, false);
  assert.equal(guestHistory.readOnly, false);
  assert.equal(spectatorHistory.readOnly, true);
  step("اللاعبون يكتبون والمشاهد يدخل بوضع القراءة فقط");

  const body = `رسالة محفوظة ${runId}`;
  hostSocket.send({ type: "message", channel: "public", body });
  const [hostMessage, guestMessage, spectatorMessage] = await Promise.all([
    hostSocket.wait((item) => item.type === "message" && item.message?.body === body, "host broadcast"),
    guestSocket.wait((item) => item.type === "message" && item.message?.body === body, "guest broadcast"),
    spectatorSocket.wait((item) => item.type === "message" && item.message?.body === body, "spectator broadcast"),
  ]);
  assert.equal(hostMessage.message.id, guestMessage.message.id);
  assert.equal(guestMessage.message.id, spectatorMessage.message.id);

  hostSocket.send({ type: "message", channel: "public", body: "رسالة سريعة" });
  const limited = await hostSocket.wait((item) => item.type === "error" && /تمهّل/.test(item.message), "rate limit");
  assert.match(limited.message, /تمهّل/);
  spectatorSocket.send({ type: "message", channel: "public", body: "ممنوعة" });
  const readOnly = await spectatorSocket.wait((item) => item.type === "error" && /انضم/.test(item.message), "spectator send rejection");
  assert.match(readOnly.message, /انضم/);
  step("البث، منع الإغراق، ومنع كتابة المشاهد تعمل");

  const hostRole = (await host.request(`/api/rooms/${code}/me`)).role;
  const guestRole = (await guest.request(`/api/rooms/${code}/me`)).role;
  const ordinary = hostRole === "أفراد الظل" ? guestSocket : hostSocket;
  assert.notEqual(hostRole === "أفراد الظل" && guestRole === "أفراد الظل", true);
  await new Promise((resolve) => setTimeout(resolve, 380));
  ordinary.send({ type: "message", channel: "mafia", body: "قناة سرية ممنوعة" });
  const forbidden = await ordinary.wait((item) => item.type === "error" && /القناة/.test(item.message), "role channel rejection");
  assert.match(forbidden.message, /غير متاحة/);
  step("قناة أفراد الظل محمية حسب الدور");

  const reconnect = new SocketInbox(host.cookie, code);
  const restored = await reconnect.wait((item) => item.type === "histories", "restored history");
  assert.ok(restored.histories.public.some((message) => message.body === body));
  step("سجل الرسائل يرجع بعد إعادة الاتصال");

  const endedPromises = [hostSocket, guestSocket, spectatorSocket, reconnect].map((socket) => socket.wait((item) => item.type === "round-ended", "round end"));
  await host.request(`/api/rooms/${code}/end`, { method: "POST" });
  await Promise.all(endedPromises);
  await host.request(`/api/rooms/${code}`, { expected: 410 });
  step("نهاية الجولة تغلق المحادثة والرابط");

  [hostSocket, guestSocket, spectatorSocket, reconnect].forEach((socket) => socket.close());
  process.stdout.write("\nCHAT E2E PASS\n");
}

main().catch((error) => {
  console.error("CHAT E2E FAIL", error);
  process.exitCode = 1;
});
