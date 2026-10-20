// Messages shared by the server and the client.

import type { BoardData } from "./board.js";

export * from "./board.js";
export * from "./starterBoards.js";
export * from "./players.js";

export type ScreenStatus = "waiting" | "admitted" | "away";
export type PlayerInfo = { id: number; name: string };
export type ScreenInfo = { id: string; status: ScreenStatus; playerIds: number[] };

// A screen is one device; it holds one or more players. The therapist's own player,
// if she plays, is in `players` but on no screen.
export type RoomState = {
  admitRequired: boolean;
  maxPlayers: number;
  hostPlays: boolean;
  screens: ScreenInfo[];
  players: PlayerInfo[];
};

// What the players see. Questions and answers stay on the server until a tile is opened.
export type OpenClue = {
  cat: number;
  clue: number;
  category: string;
  value: number;
  question: string;
  answer: string | null; // null until "Show answer"
};

export type Scoring = { enabled: boolean; scores: Record<number, number> }; // scores by player id

export type GameView = {
  boardName: string;
  categories: { name: string; values: number[] }[];
  used: boolean[][]; // used[cat][clue]
  open: OpenClue | null;
  scoring: Scoring;
};

export type ErrorReason =
  | "not_found"
  | "room_full"
  | "not_host"
  | "not_allowed"
  | "not_joined"
  | "seat_gone" // the returning screen was removed or timed out
  | "bad_message";

export type GameAction =
  | { type: "openTile"; cat: number; clue: number }
  | { type: "showAnswer" }
  | { type: "closeTile" } // done: the tile is used up
  | { type: "putBack" }; // close the clue and leave the tile available

export type ClientMessage =
  | { type: "join"; code: string; hostKey?: string; token?: string; names?: string[] }
  | { type: "admit"; screenId?: string } // no screenId = admit everyone waiting
  | { type: "removeScreen"; screenId: string }
  | { type: "setMaxPlayers"; value: number }
  | { type: "setHostPlays"; value: boolean }
  | { type: "renamePlayer"; playerId: number; name: string }
  | { type: "setAdmitRequired"; value: boolean }
  | { type: "end" }
  | { type: "setBoard"; board: BoardData }
  | { type: "setScoring"; value: boolean }
  | { type: "adjustScore"; playerId: number; delta: number }
  | { type: "resetScores" }
  | { type: "ping" } // keeps the connection checked; the server answers with "pong"
  | GameAction;

export type ServerMessage =
  | { type: "joined"; role: "host" | "child"; token?: string } // token: only to a new screen
  | { type: "room"; state: RoomState; mine: number[] } // mine: player ids on the receiving screen
  | { type: "game"; game: GameView }
  | { type: "board"; board: BoardData } // the full board, sent to the host only
  | { type: "pong" }
  | { type: "ended" }
  | { type: "error"; reason: ErrorReason };

export type CreateRoomResponse = { code: string; hostKey: string };
export type RoomInfoResponse = { freeSlots: number };
