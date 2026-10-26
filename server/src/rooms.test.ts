import { beforeEach, expect, test } from "vitest";
import { AWAY_LIMIT_MS, IDLE_LIMIT_MS, RoomStore } from "./rooms.js";

let time: number;
let store: RoomStore;
let code: string;
let hostKey: string;

beforeEach(() => {
  time = 1_000;
  store = new RoomStore(() => time);
  ({ code, hostKey } = store.create());
});

const host = () => store.join(code, "h", { hostKey });
const names = () => store.state(code)!.players.map((p) => p.name);
const screenId = (i = 0) => store.state(code)!.screens[i].id;

test("codes and host keys are long, random and different each time", () => {
  const other = store.create();
  expect(code.length).toBeGreaterThanOrEqual(22); // 128 bits in base64url
  expect(hostKey.length).toBeGreaterThanOrEqual(22);
  expect(other.code).not.toBe(code);
  expect(other.hostKey).not.toBe(hostKey);
});

test("the right host key makes you the host; no key or a wrong key makes you a screen", () => {
  expect(host()).toEqual({ ok: true, role: "host" });
  const wrong = store.join(code, "c", { hostKey: "wrong" });
  expect(wrong).toMatchObject({ ok: true, role: "child" });
});

test("joining an unknown room fails", () => {
  expect(store.join("nope", "c")).toEqual({ ok: false, reason: "not_found" });
  expect(store.freeSlots("nope")).toBeNull();
});

test("by default the room holds one player: the first screen gets Player 1, the next is turned away", () => {
  expect(store.join(code, "c1")).toMatchObject({ ok: true, role: "child" });
  expect(names()).toEqual(["Player 1"]);
  expect(store.join(code, "c2")).toEqual({ ok: false, reason: "room_full" });
  expect(store.freeSlots(code)).toBe(0);
});

test("a new screen waits until the host admits it, one at a time or all together", () => {
  host();
  store.setMaxPlayers(code, "h", 3);
  store.join(code, "c1");
  store.join(code, "c2");
  store.join(code, "c3");
  expect(store.state(code)!.screens.map((s) => s.status)).toEqual(["waiting", "waiting", "waiting"]);
  expect(store.canPlay(code, "c1")).toBe(false);
  expect(store.admit(code, "h", screenId(0))).toEqual({ ok: true });
  expect(store.state(code)!.screens.map((s) => s.status)).toEqual(["admitted", "waiting", "waiting"]);
  expect(store.canPlay(code, "c1")).toBe(true);
  expect(store.admit(code, "h")).toEqual({ ok: true });
  expect(store.state(code)!.screens.map((s) => s.status)).toEqual(["admitted", "admitted", "admitted"]);
});

test("only the host can admit, remove, resize, change settings or end the room", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c");
  const id = screenId();
  expect(store.admit(code, "c", id)).toEqual({ ok: false, reason: "not_host" });
  expect(store.setAdmitRequired(code, "c", false)).toEqual({ ok: false, reason: "not_host" });
  expect(store.removeScreen(code, "c", id)).toEqual({ ok: false, reason: "not_host" });
  expect(store.setMaxPlayers(code, "c", 5)).toEqual({ ok: false, reason: "not_host" });
  expect(store.setHostPlays(code, "c", true)).toEqual({ ok: false, reason: "not_host" });
  expect(store.end(code, "c")).toEqual({ ok: false, reason: "not_host" });
  expect(store.state(code)!.screens[0].status).toBe("waiting");
});

test("turning admit off lets everyone waiting in; new screens then join directly", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c1");
  store.setAdmitRequired(code, "h", false);
  store.join(code, "c2");
  expect(store.state(code)!.screens.map((s) => s.status)).toEqual(["admitted", "admitted"]);
});

test("a screen can hold up to four players and uses one slot for each", () => {
  host();
  store.setMaxPlayers(code, "h", 6);
  store.join(code, "c1", { names: ["Sam", "", "Mom"] });
  expect(names()).toEqual(["Sam", "Player 1", "Mom"]);
  expect(store.freeSlots(code)).toBe(3);
  expect(store.join(code, "c2", { names: ["a", "b", "c", "d"] })).toEqual({ ok: false, reason: "room_full" });
  expect(store.join(code, "c2", { names: ["a", "b", "c"] })).toMatchObject({ ok: true });
  expect(store.freeSlots(code)).toBe(0);
});

test("too many or no players on one screen is refused; bad names get default names", () => {
  host();
  store.setMaxPlayers(code, "h", 8);
  expect(store.join(code, "c1", { names: ["1", "2", "3", "4", "5"] })).toEqual({
    ok: false,
    reason: "bad_message",
  });
  expect(store.join(code, "c1", { names: [] })).toEqual({ ok: false, reason: "bad_message" });
  expect(store.join(code, "c1", { names: "Sam" })).toEqual({ ok: false, reason: "bad_message" });
  store.join(code, "c2", { names: ["x".repeat(21), 7 as unknown as string] });
  expect(names()).toEqual(["Player 1", "Player 2"]);
});

test("the player count goes from 1 to 8 and cannot drop below the players already in", () => {
  host();
  expect(store.setMaxPlayers(code, "h", 8)).toEqual({ ok: true });
  expect(store.setMaxPlayers(code, "h", 9)).toEqual({ ok: false, reason: "bad_message" });
  expect(store.setMaxPlayers(code, "h", 0)).toEqual({ ok: false, reason: "bad_message" });
  expect(store.setMaxPlayers(code, "h", 2.5)).toEqual({ ok: false, reason: "bad_message" });
  store.join(code, "c", { names: ["a", "b", "c"] });
  expect(store.setMaxPlayers(code, "h", 2)).toEqual({ ok: false, reason: "room_full" });
  expect(store.setMaxPlayers(code, "h", 3)).toEqual({ ok: true });
});

test("the therapist can play too if there is a free slot, and it uses one", () => {
  host();
  expect(store.setHostPlays(code, "h", true)).toEqual({ ok: true });
  expect(names()).toEqual(["Player 1"]);
  expect(store.state(code)!.hostPlays).toBe(true);
  expect(store.mine(code, "h")).toEqual([1]);
  expect(store.join(code, "c")).toEqual({ ok: false, reason: "room_full" }); // max is 1
  store.setMaxPlayers(code, "h", 2);
  expect(store.join(code, "c")).toMatchObject({ ok: true });
  expect(names()).toEqual(["Player 1", "Player 2"]);
  store.setHostPlays(code, "h", false);
  expect(names()).toEqual(["Player 2"]);
  expect(store.state(code)!.hostPlays).toBe(false);
});

test("the therapist cannot start playing when the room is full", () => {
  host();
  store.join(code, "c");
  expect(store.setHostPlays(code, "h", true)).toEqual({ ok: false, reason: "room_full" });
});

test("names: a screen renames only its own players, the host renames anyone", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c1");
  store.join(code, "c2");
  expect(store.renamePlayer(code, "c1", 1, "  Sam  ")).toEqual({ ok: true });
  expect(store.renamePlayer(code, "c1", 2, "Nope")).toEqual({ ok: false, reason: "not_allowed" });
  expect(store.renamePlayer(code, "h", 2, "Alex")).toEqual({ ok: true });
  expect(store.renamePlayer(code, "h", 2, "x".repeat(21))).toEqual({ ok: false, reason: "bad_message" });
  expect(store.renamePlayer(code, "h", 99, "Ghost")).toEqual({ ok: false, reason: "bad_message" });
  expect(names()).toEqual(["Sam", "Alex"]);
});

test("a refreshed screen reclaims its seat with its token; a wrong or lost token does not", () => {
  const first = store.join(code, "c1", { names: ["Sam"] });
  const seat = first.ok ? first.token : undefined;
  expect(seat).toBeTruthy();
  store.leave(code, "c1");
  expect(store.state(code)!.screens[0].status).toBe("away");
  expect(store.join(code, "c2", { token: seat })).toMatchObject({ ok: true, role: "child" });
  expect(store.state(code)!.screens[0].status).toBe("waiting");
  expect(names()).toEqual(["Sam"]);
  expect(store.join(code, "c3", { token: "wrong" })).toEqual({ ok: false, reason: "seat_gone" });
});

test("a screen away for 15 minutes gives its seats back; coming back sooner keeps them", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  const a = store.join(code, "c1", { names: ["Sam"] });
  store.join(code, "c2", { names: ["Alex"] });
  store.leave(code, "c1");
  store.leave(code, "c2");
  time += AWAY_LIMIT_MS - 1;
  expect(store.sweepAway()).toEqual([]);
  if (a.ok && a.token) store.join(code, "c3", { token: a.token });
  time += 1;
  expect(store.sweepAway()).toEqual([code]);
  expect(names()).toEqual(["Sam"]);
  expect(store.freeSlots(code)).toBe(1);
});

test("removing a screen frees its seats and scores and returns its connection", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c1", { names: ["Sam"] });
  store.score(code, "h", { type: "setScoring", value: true });
  store.score(code, "h", { type: "adjustScore", playerId: 1, delta: 200 });
  expect(store.removeScreen(code, "h", screenId())).toEqual({ ok: true, conn: "c1" });
  expect(names()).toEqual([]);
  expect(store.gameView(code)!.scoring.scores).toEqual({});
  expect(store.removeScreen(code, "h", "nope")).toEqual({ ok: false, reason: "bad_message" });
});

test("only the host scores, per player; a new board resets scores but keeps players and scoring on", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c1");
  store.join(code, "c2");
  expect(store.score(code, "c1", { type: "setScoring", value: true })).toEqual({
    ok: false,
    reason: "not_host",
  });
  expect(store.score(code, "c1", { type: "adjustScore", playerId: 1, delta: 500 })).toEqual({
    ok: false,
    reason: "not_host",
  });
  store.score(code, "h", { type: "setScoring", value: true });
  expect(store.score(code, "h", { type: "adjustScore", playerId: 2, delta: 200 })).toEqual({ ok: true });
  expect(store.score(code, "h", { type: "adjustScore", playerId: 9, delta: 100 })).toEqual({
    ok: false,
    reason: "bad_message",
  });
  expect(store.score(code, "h", { type: "adjustScore", playerId: 1, delta: 0.5 })).toEqual({
    ok: false,
    reason: "bad_message",
  });
  expect(store.gameView(code)!.scoring).toEqual({ enabled: true, scores: { 2: 200 } });
  const board = {
    name: "B",
    categories: [{ name: "A", clues: [{ value: 100, question: "Q", answer: "A" }] }],
  };
  expect(store.setBoard(code, "h", board)).toEqual({ ok: true });
  expect(store.gameView(code)!.scoring).toEqual({ enabled: true, scores: {} });
  expect(names()).toEqual(["Player 1", "Player 2"]);
});

test("only the host can replace the board, and bad boards are refused", () => {
  host();
  store.join(code, "c");
  const board = {
    name: "Mine",
    categories: [{ name: "A", clues: [{ value: 100, question: "Q", answer: "A" }] }],
  };
  expect(store.setBoard(code, "c", board)).toEqual({ ok: false, reason: "not_host" });
  expect(store.setBoard(code, "h", { name: "" })).toEqual({ ok: false, reason: "bad_message" });
  expect(store.setBoard(code, "h", board)).toEqual({ ok: true });
  expect(store.hostBoard(code)?.name).toBe("Mine");
  expect(store.gameView(code)?.boardName).toBe("Mine");
});

test("ending a room kills the link", () => {
  host();
  expect(store.end(code, "h")).toEqual({ ok: true });
  expect(store.has(code)).toBe(false);
  expect(store.join(code, "c")).toEqual({ ok: false, reason: "not_found" });
});

test("rooms idle for 30 minutes are removed; activity resets the clock", () => {
  host();
  time += IDLE_LIMIT_MS - 1;
  expect(store.sweepIdle()).toEqual([]);
  store.touchByCode(code);
  time += IDLE_LIMIT_MS - 1;
  expect(store.sweepIdle()).toEqual([]);
  time += 1;
  expect(store.sweepIdle()).toEqual([code]);
  expect(store.has(code)).toBe(false);
});

test("a new room shows Jeopardy; only the host switches activity, and each keeps its own state", () => {
  host();
  store.setMaxPlayers(code, "h", 2);
  store.join(code, "c");
  store.admit(code, "h");
  expect(store.state(code)!.activity).toBe("jeopardy");
  expect(store.setActivity(code, "c", "sandtray")).toEqual({ ok: false, reason: "not_host" });
  expect(store.setActivity(code, "h", "chess")).toEqual({ ok: false, reason: "bad_message" });
  expect(store.setActivity(code, "h", "sandtray")).toEqual({ ok: true });
  expect(store.state(code)!.activity).toBe("sandtray");
  store.trayAct(code, "c", { type: "placeFigure", figureId: "animal-1", x: 0.5, y: 0.5 });
  store.setActivity(code, "h", "jeopardy");
  store.setActivity(code, "h", "sandtray");
  expect(store.trayView(code)!.items).toHaveLength(1); // the tray survived the switch
});

test("the host and an admitted screen can use the tray; a waiting screen cannot", () => {
  host();
  store.join(code, "c"); // waiting: admit is required by default
  const place = { type: "placeFigure", figureId: "animal-1", x: 0.5, y: 0.5 } as const;
  expect(store.trayAct(code, "c", place)).toEqual({ ok: false, reason: "not_allowed" });
  expect(store.trayAct(code, "h", place)).toEqual({ ok: true });
  store.admit(code, "h");
  expect(store.trayAct(code, "c", { type: "moveItem", itemId: 1, x: 0.2, y: 0.3 })).toEqual({ ok: true });
  expect(store.trayView(code)!.items[0]).toMatchObject({ id: 1, x: 0.2, y: 0.3 });
  expect(store.trayAct(code, "c", { type: "removeItem", itemId: 1 })).toEqual({ ok: true });
  expect(store.trayView(code)!.items).toHaveLength(0);
});

test("only the host clears the tray", () => {
  host();
  store.join(code, "c");
  store.admit(code, "h");
  store.trayAct(code, "c", { type: "placeFigure", figureId: "animal-1", x: 0.5, y: 0.5 });
  expect(store.clearTray(code, "c")).toEqual({ ok: false, reason: "not_host" });
  expect(store.trayView(code)!.items).toHaveLength(1);
  expect(store.clearTray(code, "h")).toEqual({ ok: true });
  expect(store.trayView(code)!.items).toHaveLength(0);
});

test("tray actions that do not apply are ignored, not errors", () => {
  host();
  const nothing = { type: "removeItem", itemId: 99 } as const;
  expect(store.trayAct(code, "h", nothing)).toEqual({ ok: true });
  expect(store.trayAct(code, "h", { type: "placeFigure", figureId: "nope", x: 0.5, y: 0.5 })).toEqual({
    ok: true,
  });
  expect(store.trayView(code)!.items).toHaveLength(0);
  expect(store.trayView("missing")).toBeNull();
});
