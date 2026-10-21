import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import type { ClientMessage, CreateRoomResponse, ServerMessage } from "@therapy-play/shared";
import { buildApp } from "./app.js";

let app: FastifyInstance;
let port: number;

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  port = (app.server.address() as { port: number }).port;
});

afterAll(async () => {
  await app.close();
});

async function createRoom(): Promise<CreateRoomResponse> {
  const res = await fetch(`http://127.0.0.1:${port}/rooms`, { method: "POST" });
  return (await res.json()) as CreateRoomResponse;
}

// A tiny test client: collects every message and lets a test wait for one.
function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const seen: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  ws.on("message", (data) => {
    seen.push(JSON.parse(data.toString()) as ServerMessage);
    waiters.splice(0).forEach((w) => w());
  });
  const opened = new Promise<void>((resolve) => ws.on("open", () => resolve()));
  return {
    seen,
    send: async (msg: ClientMessage) => {
      await opened;
      ws.send(JSON.stringify(msg));
    },
    next: async (match: (m: ServerMessage) => boolean): Promise<ServerMessage> => {
      const deadline = Date.now() + 2000;
      for (;;) {
        const found = seen.find(match);
        if (found) return found;
        if (Date.now() > deadline) throw new Error("timed out waiting for message");
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
    },
    close: () => ws.close(),
  };
}

type Client = ReturnType<typeof connect>;

// The latest room message this client has seen.
function lastRoom(client: Client) {
  const rooms = client.seen.filter((m) => m.type === "room");
  return rooms[rooms.length - 1] as Extract<ServerMessage, { type: "room" }>;
}

test("host and a screen: it waits, the host admits, the host ends the room", async () => {
  const { code, hostKey } = await createRoom();

  const host = connect();
  await host.send({ type: "join", code, hostKey });
  expect(await host.next((m) => m.type === "joined")).toEqual({ type: "joined", role: "host" });

  const child = connect();
  await child.send({ type: "join", code });
  const joined = await child.next((m) => m.type === "joined");
  expect(joined).toMatchObject({ type: "joined", role: "child" });
  expect(joined.type === "joined" && typeof joined.token).toBe("string");
  await host.next((m) => m.type === "room" && m.state.screens[0]?.status === "waiting");

  await host.send({ type: "admit" });
  await child.next((m) => m.type === "room" && m.state.screens[0]?.status === "admitted");

  await host.send({ type: "end" });
  expect(await child.next((m) => m.type === "ended")).toEqual({ type: "ended" });

  const late = connect();
  await late.send({ type: "join", code });
  expect(await late.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_found" });
  host.close();
  child.close();
  late.close();
});

test("a screen cannot admit itself", async () => {
  const { code } = await createRoom();
  const child = connect();
  await child.send({ type: "join", code });
  await child.next((m) => m.type === "joined");
  await child.send({ type: "admit" });
  expect(await child.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_host" });
  child.close();
});

test("by default a second screen is turned away, and bad messages are rejected", async () => {
  const { code } = await createRoom();
  const first = connect();
  await first.send({ type: "join", code });
  await first.next((m) => m.type === "joined");

  const second = connect();
  await second.send({ type: "join", code });
  expect(await second.next((m) => m.type === "error")).toEqual({ type: "error", reason: "room_full" });

  const stranger = connect();
  await stranger.send({ type: "admit" });
  expect(await stranger.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_joined" });
  first.close();
  second.close();
  stranger.close();
});

test("the board stays hidden from a waiting screen and syncs live once admitted", async () => {
  const { code, hostKey } = await createRoom();
  const host = connect();
  await host.send({ type: "join", code, hostKey });
  await host.next((m) => m.type === "game");

  const child = connect();
  await child.send({ type: "join", code });
  await child.next((m) => m.type === "room" && m.state.screens[0]?.status === "waiting");
  expect(child.seen.some((m) => m.type === "game")).toBe(false);

  // A waiting screen cannot play.
  await child.send({ type: "openTile", cat: 0, clue: 0 });
  expect(await child.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_allowed" });

  await host.send({ type: "admit" });
  await child.next((m) => m.type === "game");

  // The child opens a tile; the host sees it, without the answer.
  await child.send({ type: "openTile", cat: 0, clue: 0 });
  const opened = await host.next((m) => m.type === "game" && m.game.open !== null);
  expect(opened.type === "game" && opened.game.open?.answer).toBeNull();

  // The host reveals the answer; both see it.
  await host.send({ type: "showAnswer" });
  for (const player of [host, child]) {
    const shown = await player.next((m) => m.type === "game" && m.game.open?.answer === "Happy");
    expect(shown.type).toBe("game");
  }

  // Done greys the tile out for both.
  await child.send({ type: "closeTile" });
  for (const player of [host, child]) {
    await player.next((m) => m.type === "game" && m.game.open === null && m.game.used[0][0] === true);
  }
  host.close();
  child.close();
});

test("several players: shared screens, names, seats and per-player scores", async () => {
  const { code, hostKey } = await createRoom();
  const host = connect();
  await host.send({ type: "join", code, hostKey });
  await host.next((m) => m.type === "joined");
  await host.send({ type: "setMaxPlayers", value: 3 });

  const a = connect(); // one screen, two players
  await a.send({ type: "join", code, names: ["Sam", "Mom"] });
  await a.next((m) => m.type === "joined");
  const b = connect(); // one screen, one player
  await b.send({ type: "join", code, names: ["Alex"] });
  await b.next((m) => m.type === "joined");

  // The room is now full: the dropdown helper agrees and a third screen is turned away.
  const info = await fetch(`http://127.0.0.1:${port}/rooms/${code}`);
  expect(await info.json()).toEqual({ freeSlots: 0 });
  const c = connect();
  await c.send({ type: "join", code });
  expect(await c.next((m) => m.type === "error")).toEqual({ type: "error", reason: "room_full" });

  // Each screen is told which players are its own.
  await a.next((m) => m.type === "room" && m.state.players.length === 3);
  await b.next((m) => m.type === "room" && m.state.players.length === 3);
  expect(lastRoom(a).mine).toEqual([1, 2]);
  expect(lastRoom(b).mine).toEqual([3]);
  expect(lastRoom(host).state.players.map((p) => p.name)).toEqual(["Sam", "Mom", "Alex"]);

  // A screen renames its own players only.
  await a.send({ type: "renamePlayer", playerId: 2, name: "Mama" });
  await host.next((m) => m.type === "room" && m.state.players[1]?.name === "Mama");
  await b.send({ type: "renamePlayer", playerId: 1, name: "Nope" });
  expect(await b.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_allowed" });

  // Only the therapist scores, and she picks the player.
  await host.send({ type: "admit" });
  await a.next((m) => m.type === "game");
  await a.send({ type: "adjustScore", playerId: 1, delta: 100 });
  expect(await a.next((m) => m.type === "error")).toEqual({ type: "error", reason: "not_host" });
  await host.send({ type: "setScoring", value: true });
  await host.send({ type: "adjustScore", playerId: 3, delta: 300 });
  for (const screen of [host, a, b]) {
    await screen.next((m) => m.type === "game" && m.game.scoring.enabled && m.game.scoring.scores[3] === 300);
  }

  // The therapist removes screen B: it is told, and its seat is free again.
  const screenB = lastRoom(host).state.screens[1].id;
  await host.send({ type: "removeScreen", screenId: screenB });
  expect(await b.next((m) => m.type === "error" && m.reason === "seat_gone")).toEqual({
    type: "error",
    reason: "seat_gone",
  });
  await host.next((m) => m.type === "room" && m.state.players.length === 2);
  host.close();
  a.close();
  b.close();
  c.close();
});

test("a screen that reconnects with its token keeps its seat and names", async () => {
  const { code, hostKey } = await createRoom();
  const host = connect();
  await host.send({ type: "join", code, hostKey });
  await host.send({ type: "setMaxPlayers", value: 2 });

  const first = connect();
  await first.send({ type: "join", code, names: ["Sam"] });
  const joined = await first.next((m) => m.type === "joined");
  const token = joined.type === "joined" ? joined.token : undefined;
  expect(token).toBeTruthy();
  first.close();
  await host.next((m) => m.type === "room" && m.state.screens[0]?.status === "away");

  const again = connect();
  await again.send({ type: "join", code, token });
  const rejoined = await again.next((m) => m.type === "joined");
  expect(rejoined).toEqual({ type: "joined", role: "child" }); // no new token
  await host.next((m) => m.type === "room" && m.state.screens[0]?.status === "waiting");
  expect(lastRoom(host).state.players.map((p) => p.name)).toEqual(["Sam"]);

  const stranger = connect();
  await stranger.send({ type: "join", code, token: "not-a-real-token" });
  expect(await stranger.next((m) => m.type === "error")).toEqual({ type: "error", reason: "seat_gone" });
  host.close();
  again.close();
  stranger.close();
});

test("the join helper reports free seats and hides everything else", async () => {
  const { code } = await createRoom();
  const ok = await fetch(`http://127.0.0.1:${port}/rooms/${code}`);
  expect(await ok.json()).toEqual({ freeSlots: 1 });
  const missing = await fetch(`http://127.0.0.1:${port}/rooms/not-a-room`);
  expect(missing.status).toBe(404);
});

test("ping gets a pong, even before joining", async () => {
  const client = connect();
  await client.send({ type: "ping" });
  expect(await client.next((m) => m.type === "pong")).toEqual({ type: "pong" });
  client.close();
});

test("a connection that stops answering is cut, and its screen shows as disconnected", async () => {
  const quick = await buildApp(undefined, { heartbeatMs: 60 });
  await quick.listen({ port: 0, host: "127.0.0.1" });
  const quickPort = (quick.server.address() as { port: number }).port;
  const res = await fetch(`http://127.0.0.1:${quickPort}/rooms`, { method: "POST" });
  const { code, hostKey } = (await res.json()) as CreateRoomResponse;

  const open = (autoPong: boolean) => {
    const ws = new WebSocket(`ws://127.0.0.1:${quickPort}/ws`, { autoPong });
    const seen: ServerMessage[] = [];
    ws.on("message", (data) => seen.push(JSON.parse(data.toString()) as ServerMessage));
    return { ws, seen, opened: new Promise<void>((resolve) => ws.on("open", () => resolve())) };
  };
  const host = open(true);
  await host.opened;
  host.ws.send(JSON.stringify({ type: "join", code, hostKey } satisfies ClientMessage));
  const silent = open(false); // never answers the server's pings
  await silent.opened;
  silent.ws.send(JSON.stringify({ type: "join", code } satisfies ClientMessage));

  const deadline = Date.now() + 3000;
  const sawAway = () => host.seen.some((m) => m.type === "room" && m.state.screens[0]?.status === "away");
  while (!sawAway() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  expect(sawAway()).toBe(true);
  host.ws.close();
  silent.ws.close();
  await quick.close();
});

test("one program serves the built page, links open the app, and the API stays separate", async () => {
  const dir = mkdtempSync(join(tmpdir(), "page-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(dir, "assets", "app-123.js"), "console.log(1)");
  const web = await buildApp(undefined, { clientDir: dir });
  await web.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${(web.server.address() as { port: number }).port}`;
  try {
    // The page, and room links, open the app.
    for (const path of ["/", "/r/some-room", "/host/some-room?fresh"]) {
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("<title>app</title>");
      expect(res.headers.get("cache-control")).toBe("no-cache");
    }
    // Built files are cached for a long time because their names change when they do.
    const asset = await fetch(`${base}/assets/app-123.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
    // Missing files and unknown API paths are real 404s, not the page.
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/rooms/not-a-room`)).status).toBe(404);
    // Health check and safety headers.
    const health = await fetch(`${base}/health`);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(health.headers.get("referrer-policy")).toBe("no-referrer");
    expect(health.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    // Creating a room still works next to the page.
    const made = await fetch(`${base}/rooms`, { method: "POST" });
    expect(((await made.json()) as CreateRoomResponse).code.length).toBeGreaterThan(20);
  } finally {
    await web.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("without a built page, unknown paths are plain 404s", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/r/some-room`);
  expect(res.status).toBe(404);
});

test("the strict-transport header is sent only when the request came in over https", async () => {
  const plain = await fetch(`http://127.0.0.1:${port}/health`);
  expect(plain.headers.get("strict-transport-security")).toBeNull();
  const viaHost = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { "x-forwarded-proto": "https" },
  });
  expect(viaHost.headers.get("strict-transport-security")).toBe("max-age=31536000");
});

test("the config says whether this is a demo site", async () => {
  const normal = await fetch(`http://127.0.0.1:${port}/config`);
  expect(await normal.json()).toEqual({ demo: false, passcodeRequired: false });
  const demoApp = await buildApp(undefined, { demo: true });
  await demoApp.listen({ port: 0, host: "127.0.0.1" });
  const demoPort = (demoApp.server.address() as { port: number }).port;
  try {
    const res = await fetch(`http://127.0.0.1:${demoPort}/config`);
    expect(await res.json()).toEqual({ demo: true, passcodeRequired: false });
  } finally {
    await demoApp.close();
  }
});

test("with a host passcode, only a request carrying it can create a room", async () => {
  const PASSCODE = "correct-horse-battery";
  const locked = await buildApp(undefined, { hostPasscode: PASSCODE });
  await locked.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${(locked.server.address() as { port: number }).port}`;
  const create = (body?: unknown) =>
    fetch(`${base}/rooms`, {
      method: "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    expect(await (await fetch(`${base}/config`)).json()).toEqual({ demo: false, passcodeRequired: true });
    expect((await create()).status).toBe(401); // no passcode at all
    expect((await create({ passcode: "wrong-guess-here" })).status).toBe(401);
    expect((await create({ passcode: 12345 })).status).toBe(401); // wrong type
    const ok = await create({ passcode: PASSCODE });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as CreateRoomResponse).code.length).toBeGreaterThan(20);
    // Joining and playing in a room that exists does not need the passcode.
    const { code } = (await (await create({ passcode: PASSCODE })).json()) as CreateRoomResponse;
    expect((await fetch(`${base}/rooms/${code}`)).status).toBe(200);
  } finally {
    await locked.close();
  }
});

test("repeated wrong guesses are slowed down, even if the next one is right", async () => {
  const PASSCODE = "correct-horse-battery";
  const locked = await buildApp(undefined, { hostPasscode: PASSCODE });
  await locked.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${(locked.server.address() as { port: number }).port}`;
  const attempt = (passcode: string) =>
    fetch(`${base}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
  try {
    for (let i = 0; i < 5; i++) expect((await attempt("nope-nope-nope")).status).toBe(401);
    const blocked = await attempt(PASSCODE); // right passcode, but too many recent misses
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  } finally {
    await locked.close();
  }
});
