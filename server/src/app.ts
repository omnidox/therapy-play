import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { sep } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import type {
  ClientMessage,
  CreateRoomResponse,
  RoomInfoResponse,
  ServerMessage,
} from "@therapy-play/shared";
import { RoomStore } from "./rooms.js";
import { AttemptLimiter } from "./throttle.js";

type Socket = { send(data: string): void; close(): void };

// Compares secrets without leaking, through timing, how much of a guess was right.
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// The most rooms alive at once. It keeps a busy or abused site from filling the server's memory.
const DEFAULT_MAX_ROOMS = 200;

const SWEEP_EVERY_MS = 60 * 1000;
const HEARTBEAT_MS = 20 * 1000; // how often a silent connection is checked

// Logging is off on purpose: nothing about rooms or people goes in logs.
export async function buildApp(
  store: RoomStore = new RoomStore(),
  // clientDir: the built page (client/dist). When set, this one program serves the page too.
  options: {
    heartbeatMs?: number;
    clientDir?: string;
    demo?: boolean;
    hostPasscode?: string;
    limiter?: AttemptLimiter; // wrong passcode guesses
    createLimiter?: AttemptLimiter; // room creation on an open demo
    maxRooms?: number;
  } = {},
) {
  // trustProxy: behind a host's proxy, req.ip is the visitor's address (used to slow down guessing).
  const app = Fastify({ logger: false, trustProxy: true });
  const limiter = options.limiter ?? new AttemptLimiter();
  // An open demo (no passcode) lets one address create only a few rooms in a while.
  const createLimiter =
    options.createLimiter ??
    new AttemptLimiter(Date.now, { perKeyMax: 10, globalMax: 100, windowMs: 15 * 60 * 1000 });
  const maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
  await app.register(websocket);

  // Small safety headers on every web response. no-referrer keeps a room link out of
  // the "came from" information sent to other sites.
  app.addHook("onSend", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Content-Security-Policy", "frame-ancestors 'self'");
    // Tell browsers to use only https for this address, but only when the request came in over
    // https (a host in front of us says so). The header is meaningless, and ignored, over plain http.
    if (req.headers["x-forwarded-proto"] === "https") {
      reply.header("Strict-Transport-Security", "max-age=31536000");
    }
  });

  // A host can ask this to see that the program is alive.
  app.get("/health", async () => ({ status: "ok" }));

  // Tells the page whether this is a demo site, so it can show a "made-up content only" banner.
  app.get("/config", async () => ({
    demo: options.demo === true,
    passcodeRequired: options.hostPasscode !== undefined,
  }));

  const sockets = new Map<string, Map<string, Socket>>(); // room code -> connId -> socket

  const send = (socket: Socket, msg: ServerMessage) => socket.send(JSON.stringify(msg));

  // Everyone gets the room state (and which players are theirs); only people
  // allowed to play get the game.
  const broadcastState = (code: string) => {
    const state = store.state(code);
    const game = store.gameView(code);
    if (!state || !game) return;
    for (const [connId, socket] of sockets.get(code)?.entries() ?? []) {
      send(socket, { type: "room", state, mine: store.mine(code, connId) });
      if (store.canPlay(code, connId)) send(socket, { type: "game", game });
    }
  };

  const sendBoardToHost = (code: string, connId: string) => {
    const board = store.hostBoard(code);
    const socket = sockets.get(code)?.get(connId);
    if (board && socket) send(socket, { type: "board", board });
  };

  const closeRoom = (code: string) => {
    for (const socket of sockets.get(code)?.values() ?? []) {
      send(socket, { type: "ended" });
      socket.close();
    }
    sockets.delete(code);
  };

  // Only the host may create a room. When a passcode is set, it must come with the request;
  // wrong guesses are counted per address and slowed down after a few. Room creation is also
  // capped overall, and limited per address on an open demo.
  app.post(
    "/rooms",
    async (req, reply): Promise<CreateRoomResponse | { error: string; retryAfter?: number }> => {
      if (options.hostPasscode !== undefined) {
        const wait = limiter.blockedFor(req.ip);
        if (wait > 0) {
          return reply
            .code(429)
            .header("Retry-After", String(wait))
            .send({ error: "too_many_attempts", retryAfter: wait });
        }
        const given = (req.body as { passcode?: unknown } | undefined)?.passcode;
        if (typeof given !== "string" || !sameSecret(given, options.hostPasscode)) {
          limiter.record(req.ip);
          return reply.code(401).send({ error: "passcode" });
        }
        limiter.reset(req.ip);
      }
      if (store.count() >= maxRooms) {
        return reply.code(503).send({ error: "busy" });
      }
      // Without a passcode (an open demo), also limit how many rooms one address can create.
      if (options.hostPasscode === undefined && options.demo === true) {
        const wait = createLimiter.blockedFor(req.ip);
        if (wait > 0) {
          return reply
            .code(429)
            .header("Retry-After", String(wait))
            .send({ error: "too_many_rooms", retryAfter: wait });
        }
        createLimiter.record(req.ip);
      }
      return store.create();
    },
  );

  // Lets the join form cap its player count. Reveals nothing else about a room.
  app.get<{ Params: { code: string } }>("/rooms/:code", async (req, reply): Promise<RoomInfoResponse> => {
    const freeSlots = store.freeSlots(req.params.code);
    if (freeSlots === null) return reply.code(404).send({ freeSlots: 0 });
    return { freeSlots };
  });

  if (options.clientDir) {
    await app.register(fastifyStatic, {
      root: options.clientDir,
      wildcard: false,
      // Built files have fingerprinted names and never change; the page itself must be re-checked.
      setHeaders: (res, path) => {
        const fingerprinted = path.includes(`${sep}assets${sep}`);
        res.header("Cache-Control", fingerprinted ? "public, max-age=31536000, immutable" : "no-cache");
      },
    });
    // Links like /r/CODE and /host/CODE are pages of the app: answer them with the app.
    // Anything that looks like a missing file, or an API path, stays a plain 404.
    app.setNotFoundHandler((req, reply) => {
      const path = req.url.split("?")[0];
      const lastPart = path.split("/").pop() ?? "";
      const isPage =
        req.method === "GET" &&
        !lastPart.includes(".") &&
        !path.startsWith("/rooms") &&
        path !== "/config" &&
        path !== "/health";
      if (isPage) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not found" });
    });
  }

  app.get("/ws", { websocket: true }, (socket) => {
    const connId = randomUUID();
    let code: string | null = null;

    // A connection that stops answering is cut, so its screen shows as disconnected soon
    // (a phone that lost its network never says goodbye).
    let alive = true;
    socket.on("pong", () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, options.heartbeatMs ?? HEARTBEAT_MS);

    socket.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        return send(socket, { type: "error", reason: "bad_message" });
      }

      if (msg.type === "ping") return send(socket, { type: "pong" });

      if (msg.type === "join") {
        if (code !== null || typeof msg.code !== "string") {
          return send(socket, { type: "error", reason: "bad_message" });
        }
        const result = store.join(msg.code, connId, {
          hostKey: msg.hostKey,
          token: msg.token,
          names: msg.names,
        });
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        code = msg.code;
        if (!sockets.has(code)) sockets.set(code, new Map());
        sockets.get(code)!.set(connId, socket);
        send(socket, { type: "joined", role: result.role, token: result.token });
        if (result.role === "host") sendBoardToHost(code, connId);
        return broadcastState(code);
      }

      if (code === null) return send(socket, { type: "error", reason: "not_joined" });

      if (msg.type === "admit") {
        const result = store.admit(code, connId, msg.screenId);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        return broadcastState(code);
      }

      if (msg.type === "setAdmitRequired") {
        const result = store.setAdmitRequired(code, connId, msg.value === true);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        return broadcastState(code);
      }

      if (msg.type === "removeScreen") {
        const result = store.removeScreen(code, connId, msg.screenId);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        const removed = result.conn === null ? undefined : sockets.get(code)?.get(result.conn);
        if (removed) {
          send(removed, { type: "error", reason: "seat_gone" });
          sockets.get(code)?.delete(result.conn!);
          removed.close();
        }
        return broadcastState(code);
      }

      if (msg.type === "setMaxPlayers" || msg.type === "setHostPlays" || msg.type === "renamePlayer") {
        const result =
          msg.type === "setMaxPlayers"
            ? store.setMaxPlayers(code, connId, msg.value)
            : msg.type === "setHostPlays"
              ? store.setHostPlays(code, connId, msg.value === true)
              : store.renamePlayer(code, connId, msg.playerId, msg.name);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        return broadcastState(code);
      }

      if (
        msg.type === "openTile" ||
        msg.type === "showAnswer" ||
        msg.type === "closeTile" ||
        msg.type === "putBack"
      ) {
        const result = store.act(code, connId, msg);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        return broadcastState(code); // also resyncs a player whose action was ignored
      }

      if (msg.type === "setScoring" || msg.type === "adjustScore" || msg.type === "resetScores") {
        const result = store.score(code, connId, msg);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        return broadcastState(code);
      }

      if (msg.type === "setBoard") {
        const result = store.setBoard(code, connId, msg.board);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        sendBoardToHost(code, connId);
        return broadcastState(code);
      }

      if (msg.type === "end") {
        const result = store.end(code, connId);
        if (!result.ok) return send(socket, { type: "error", reason: result.reason });
        const ended = code;
        code = null;
        return closeRoom(ended);
      }

      send(socket, { type: "error", reason: "bad_message" });
    });

    socket.on("close", () => {
      clearInterval(heartbeat);
      if (code === null) return;
      store.leave(code, connId);
      sockets.get(code)?.delete(connId);
      broadcastState(code);
    });
  });

  const sweeper = setInterval(() => {
    for (const ended of store.sweepIdle()) closeRoom(ended);
    for (const changed of store.sweepAway()) broadcastState(changed);
  }, SWEEP_EVERY_MS);
  sweeper.unref();
  app.addHook("onClose", async () => clearInterval(sweeper));

  return app;
}
