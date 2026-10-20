import { LIMITS, type BoardData, type GameAction, type GameView, type Scoring } from "@therapy-play/shared";

export type Board = BoardData;

export type GameState = {
  board: Board;
  used: boolean[][];
  open: { cat: number; clue: number; showAnswer: boolean } | null;
  scoring: Scoring;
};

// A new game starts with zero scores; whether scoring is switched on carries over.
export function newGame(board: Board, scoringEnabled = false): GameState {
  return {
    board,
    used: board.categories.map((c) => c.clues.map(() => false)),
    open: null,
    scoring: { enabled: scoringEnabled, scores: {} },
  };
}

const MAX_SCORE = 1_000_000;

export function setScoring(game: GameState, enabled: boolean): void {
  game.scoring.enabled = enabled;
}

// Only the host calls this; the room checks that the player exists.
// Returns false for a bad amount.
export function adjustScore(game: GameState, playerId: number, delta: number): boolean {
  if (!Number.isInteger(playerId)) return false;
  if (!Number.isInteger(delta) || Math.abs(delta) > LIMITS.maxValue) return false;
  const next = (game.scoring.scores[playerId] ?? 0) + delta;
  if (Math.abs(next) > MAX_SCORE) return false;
  game.scoring.scores[playerId] = next;
  return true;
}

export function resetScores(game: GameState): void {
  game.scoring.scores = {};
}

export function removeScore(game: GameState, playerId: number): void {
  delete game.scoring.scores[playerId];
}

// Applies one action. Returns false when the action does not apply
// (for example, a tile is already open or already used); the first action wins.
export function applyAction(game: GameState, action: GameAction): boolean {
  switch (action.type) {
    case "openTile": {
      if (game.open !== null) return false;
      const { cat, clue } = action;
      if (!Number.isInteger(cat) || !Number.isInteger(clue)) return false;
      if (game.used[cat]?.[clue] !== false) return false; // missing or already used
      game.open = { cat, clue, showAnswer: false };
      return true;
    }
    case "showAnswer": {
      if (game.open === null || game.open.showAnswer) return false;
      game.open.showAnswer = true;
      return true;
    }
    case "putBack": {
      if (game.open === null) return false;
      game.open = null; // the tile stays available
      return true;
    }
    case "closeTile": {
      if (game.open === null) return false;
      game.used[game.open.cat][game.open.clue] = true;
      game.open = null;
      return true;
    }
  }
}

// The view sent to players: no questions or answers until a tile is opened.
export function toView(game: GameState): GameView {
  const { board, open } = game;
  let openClue: GameView["open"] = null;
  if (open) {
    const category = board.categories[open.cat];
    const clue = category.clues[open.clue];
    openClue = {
      cat: open.cat,
      clue: open.clue,
      category: category.name,
      value: clue.value,
      question: clue.question,
      answer: open.showAnswer ? clue.answer : null,
    };
  }
  return {
    boardName: board.name,
    categories: board.categories.map((c) => ({ name: c.name, values: c.clues.map((k) => k.value) })),
    used: game.used.map((row) => [...row]),
    open: openClue,
    scoring: { enabled: game.scoring.enabled, scores: { ...game.scoring.scores } },
  };
}
