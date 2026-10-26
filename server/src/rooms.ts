import { randomBytes, timingSafeEqual } from "node:crypto";
import { PLAYER_LIMITS, cleanName, defaultName, feelingsBoard, validateBoard } from "@therapy-play/shared";
import type {
  Activity,
  BoardData,
  ErrorReason,
  GameAction,
  GameView,
  RoomState,
  TrayAction,
  TrayView,
} from "@therapy-play/shared";
import {
  clearTray,
  emptyTray,
  moveItem,
  placeFigure,
  removeItem,
  toView as trayToView,
  type TrayState,
} from "./tray.js";
import {
  adjustScore,
  applyAction,
  newGame,
  removeScore,
  resetScores,
  setScoring,
  toView,
  type GameState,
} from "./game.js";

export const IDLE_LIMIT_MS = 30 * 60 * 1000;
// A screen gone this long gives its seats back. Long enough for closing the app,
// a phone call or a bathroom break; the therapist can remove a screen sooner.
export const AWAY_LIMIT_MS = 15 * 60 * 1000;

// A screen is one device. It holds one or more players.
type Screen = {
  id: string;
  token: string; // private; lets a refreshed page reclaim its seat
  conn: string | null; // null while the device is disconnected
  admitted: boolean;
  playerIds: number[];
  awaySince: number | null;
};

type Player = { id: number; name: string };

type Room = {
  code: string;
  hostKey: string;
  admitRequired: boolean;
  maxPlayers: number;
  hostConn: string | null;
  hostPlayerId: number | null; // set while the therapist plays too
  screens: Map<string, Screen>;
  players: Map<number, Player>;
  nextPlayerId: number;
  game: GameState;
  activity: Activity; // what the room is showing now; the host switches it
  tray: TrayState; // the sandtray's figures; kept while the room lives, never stored
  lastActivity: number;
};

export type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; reason: ErrorReason };

type ScoreChange =
  | { type: "setScoring"; value: boolean }
  | { type: "adjustScore"; playerId: number; delta: number }
  | { type: "resetScores" };

function token(bytes = 16): string {
  return randomBytes(bytes).toString("base64url"); // 128 bits by default
}

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Rooms live only in memory. Nothing here is written anywhere.
export class RoomStore {
  private rooms = new Map<string, Room>();

  constructor(private now: () => number = Date.now) {}

  create(): { code: string; hostKey: string } {
    const room: Room = {
      code: token(),
      hostKey: token(),
      admitRequired: true,
      maxPlayers: 1,
      hostConn: null,
      hostPlayerId: null,
      screens: new Map(),
      players: new Map(),
      nextPlayerId: 1,
      game: newGame(structuredClone(feelingsBoard)),
      activity: "jeopardy",
      tray: emptyTray(),
      lastActivity: this.now(),
    };
    this.rooms.set(room.code, room);
    return { code: room.code, hostKey: room.hostKey };
  }

  // How many rooms exist right now.
  count(): number {
    return this.rooms.size;
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  // How many more players the room can take, or null if there is no such room.
  freeSlots(code: string): number | null {
    const room = this.rooms.get(code);
    return room ? Math.max(0, room.maxPlayers - room.players.size) : null;
  }

  join(
    code: string,
    connId: string,
    opts: { hostKey?: string; token?: string; names?: unknown } = {},
  ): Result<{ role: "host" | "child"; token?: string }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "not_found" };
    this.touch(room);

    if (opts.hostKey !== undefined && sameKey(opts.hostKey, room.hostKey)) {
      room.hostConn = connId;
      return { ok: true, role: "host" };
    }

    // A returning screen reclaims its seat, names and score.
    if (typeof opts.token === "string") {
      for (const screen of room.screens.values()) {
        if (sameKey(opts.token, screen.token)) {
          screen.conn = connId;
          screen.awaySince = null;
          return { ok: true, role: "child" };
        }
      }
      if (opts.names === undefined) return { ok: false, reason: "seat_gone" };
    }

    // A new screen: one to four players, if the room has space for all of them.
    const requested = opts.names === undefined ? [""] : opts.names;
    if (!Array.isArray(requested) || requested.length < 1 || requested.length > PLAYER_LIMITS.maxPerScreen) {
      return { ok: false, reason: "bad_message" };
    }
    if (room.players.size + requested.length > room.maxPlayers) {
      return { ok: false, reason: "room_full" };
    }
    const screen: Screen = {
      id: token(6),
      token: token(),
      conn: connId,
      admitted: !room.admitRequired,
      playerIds: [],
      awaySince: null,
    };
    for (const raw of requested) screen.playerIds.push(this.addPlayer(room, cleanName(raw)).id);
    room.screens.set(screen.id, screen);
    return { ok: true, role: "child", token: screen.token };
  }

  // A dropped screen keeps its seat for AWAY_LIMIT_MS, so a refresh does not lose it.
  leave(code: string, connId: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.hostConn === connId) room.hostConn = null;
    for (const screen of room.screens.values()) {
      if (screen.conn === connId) {
        screen.conn = null;
        screen.awaySince = this.now();
      }
    }
  }

  // Host only. No screenId means everyone who is waiting.
  admit(code: string, connId: string, screenId?: string): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    if (screenId === undefined) {
      for (const screen of found.room.screens.values()) screen.admitted = true;
      return { ok: true };
    }
    const screen = found.room.screens.get(screenId);
    if (!screen) return { ok: false, reason: "bad_message" };
    screen.admitted = true;
    return { ok: true };
  }

  // Turning admit off lets everyone who is waiting in; new screens then join directly.
  setAdmitRequired(code: string, connId: string, value: boolean): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    found.room.admitRequired = value;
    if (!value) for (const screen of found.room.screens.values()) screen.admitted = true;
    return { ok: true };
  }

  // Host only. Removes a screen and its players; returns its connection so it can be closed.
  removeScreen(code: string, connId: string, screenId: string): Result<{ conn: string | null }> {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    const screen = found.room.screens.get(screenId);
    if (!screen) return { ok: false, reason: "bad_message" };
    this.dropScreen(found.room, screen);
    return { ok: true, conn: screen.conn };
  }

  // Host only. Cannot go below the players already in the room; nobody is removed.
  setMaxPlayers(code: string, connId: string, value: number): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    if (!Number.isInteger(value) || value < 1 || value > PLAYER_LIMITS.maxPlayers) {
      return { ok: false, reason: "bad_message" };
    }
    if (value < found.room.players.size) return { ok: false, reason: "room_full" };
    found.room.maxPlayers = value;
    return { ok: true };
  }

  // Host only. Playing needs a free slot.
  setHostPlays(code: string, connId: string, value: boolean): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    const room = found.room;
    if (value && room.hostPlayerId === null) {
      if (room.players.size >= room.maxPlayers) return { ok: false, reason: "room_full" };
      room.hostPlayerId = this.addPlayer(room, null).id;
    } else if (!value && room.hostPlayerId !== null) {
      room.players.delete(room.hostPlayerId);
      removeScore(room.game, room.hostPlayerId);
      room.hostPlayerId = null;
    }
    return { ok: true };
  }

  // The host may rename anyone; a screen may rename only its own players.
  renamePlayer(code: string, connId: string, playerId: number, name: unknown): Result {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "not_found" };
    const clean = cleanName(name);
    const player = room.players.get(playerId);
    if (clean === null || !player) return { ok: false, reason: "bad_message" };
    const isHost = room.hostConn === connId;
    const ownsPlayer = [...room.screens.values()].some(
      (s) => s.conn === connId && s.playerIds.includes(playerId),
    );
    if (!isHost && !ownsPlayer) return { ok: false, reason: "not_allowed" };
    this.touch(room);
    player.name = clean;
    return { ok: true };
  }

  // The host and an admitted screen may play; a waiting screen may not.
  canPlay(code: string, connId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.hostConn === connId) return true;
    return [...room.screens.values()].some((s) => s.conn === connId && s.admitted);
  }

  // An action that does not apply (for example, a tile already open) is ignored, not an error.
  act(code: string, connId: string, action: GameAction): Result {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "not_found" };
    if (!this.canPlay(code, connId)) return { ok: false, reason: "not_allowed" };
    this.touch(room);
    applyAction(room.game, action);
    return { ok: true };
  }

  // Host only. Replaces the board and starts a new game: scores reset, players stay.
  setBoard(code: string, connId: string, board: unknown): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    const clean = validateBoard(board);
    if (clean === null) return { ok: false, reason: "bad_message" };
    found.room.game = newGame(clean, found.room.game.scoring.enabled);
    return { ok: true };
  }

  // Host only. Scoring is the therapist's call: no one else can change scores.
  score(code: string, connId: string, change: ScoreChange): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    const { game, players } = found.room;
    if (change.type === "setScoring") setScoring(game, change.value === true);
    else if (change.type === "resetScores") resetScores(game);
    else if (!players.has(change.playerId) || !adjustScore(game, change.playerId, change.delta)) {
      return { ok: false, reason: "bad_message" };
    }
    return { ok: true };
  }

  // The full board with questions and answers; only ever sent to the host.
  hostBoard(code: string): BoardData | null {
    return this.rooms.get(code)?.game.board ?? null;
  }

  // Host only: which activity the room shows. Each activity keeps its own state.
  setActivity(code: string, connId: string, value: unknown): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    if (value !== "jeopardy" && value !== "sandtray") return { ok: false, reason: "bad_message" };
    found.room.activity = value;
    return { ok: true };
  }

  // Anyone allowed to play may place, move or put away figures. An action that does not
  // apply (unknown figure, full tray, no such figure) is ignored, not an error.
  trayAct(code: string, connId: string, action: TrayAction): Result {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "not_found" };
    if (!this.canPlay(code, connId)) return { ok: false, reason: "not_allowed" };
    this.touch(room);
    if (action.type === "placeFigure") placeFigure(room.tray, action.figureId, action.x, action.y);
    else if (action.type === "moveItem") moveItem(room.tray, action.itemId, action.x, action.y);
    else if (action.type === "removeItem") removeItem(room.tray, action.itemId);
    return { ok: true };
  }

  // Host only.
  clearTray(code: string, connId: string): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    clearTray(found.room.tray);
    return { ok: true };
  }

  trayView(code: string): TrayView | null {
    const room = this.rooms.get(code);
    return room ? trayToView(room.tray) : null;
  }

  gameView(code: string): GameView | null {
    const room = this.rooms.get(code);
    return room ? toView(room.game) : null;
  }

  end(code: string, connId: string): Result {
    const found = this.hostRoom(code, connId);
    if (!found.ok) return found;
    this.rooms.delete(code);
    return { ok: true };
  }

  state(code: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return {
      activity: room.activity,
      admitRequired: room.admitRequired,
      maxPlayers: room.maxPlayers,
      hostPlays: room.hostPlayerId !== null,
      screens: [...room.screens.values()].map((s) => ({
        id: s.id,
        status: s.conn === null ? "away" : s.admitted ? "admitted" : "waiting",
        playerIds: [...s.playerIds],
      })),
      players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name })),
    };
  }

  // The player ids that belong to this connection (its own screen, or the therapist).
  mine(code: string, connId: string): number[] {
    const room = this.rooms.get(code);
    if (!room) return [];
    if (room.hostConn === connId) return room.hostPlayerId === null ? [] : [room.hostPlayerId];
    const screen = [...room.screens.values()].find((s) => s.conn === connId);
    return screen ? [...screen.playerIds] : [];
  }

  // Removes rooms idle longer than the limit; returns their codes.
  sweepIdle(): string[] {
    const ended: string[] = [];
    for (const room of this.rooms.values()) {
      if (this.now() - room.lastActivity >= IDLE_LIMIT_MS) {
        this.rooms.delete(room.code);
        ended.push(room.code);
      }
    }
    return ended;
  }

  // Frees the seats of screens that have been disconnected too long; returns changed rooms.
  sweepAway(): string[] {
    const changed: string[] = [];
    for (const room of this.rooms.values()) {
      let any = false;
      for (const screen of [...room.screens.values()]) {
        if (
          screen.conn === null &&
          screen.awaySince !== null &&
          this.now() - screen.awaySince >= AWAY_LIMIT_MS
        ) {
          this.dropScreen(room, screen);
          any = true;
        }
      }
      if (any) changed.push(room.code);
    }
    return changed;
  }

  touchByCode(code: string): void {
    const room = this.rooms.get(code);
    if (room) this.touch(room);
  }

  private addPlayer(room: Room, name: string | null): Player {
    const taken = [...room.players.values()].map((p) => p.name);
    const player: Player = { id: room.nextPlayerId++, name: name ?? defaultName(taken) };
    room.players.set(player.id, player);
    return player;
  }

  private dropScreen(room: Room, screen: Screen): void {
    for (const id of screen.playerIds) {
      room.players.delete(id);
      removeScore(room.game, id);
    }
    room.screens.delete(screen.id);
  }

  private touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private hostRoom(
    code: string,
    connId: string,
  ): { ok: true; room: Room } | { ok: false; reason: ErrorReason } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "not_found" };
    if (room.hostConn !== connId) return { ok: false, reason: "not_host" };
    this.touch(room);
    return { ok: true, room };
  }
}
