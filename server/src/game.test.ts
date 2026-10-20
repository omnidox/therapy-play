import { beforeEach, expect, test } from "vitest";
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
import { feelingsBoard as sampleBoard } from "@therapy-play/shared";

let game: GameState;

beforeEach(() => {
  game = newGame(sampleBoard);
});

test("the sample board is 5 categories of 5 clues with values 100 to 500", () => {
  expect(sampleBoard.categories).toHaveLength(5);
  for (const c of sampleBoard.categories) {
    expect(c.clues.map((k) => k.value)).toEqual([100, 200, 300, 400, 500]);
  }
});

test("the view hides questions and answers until a tile is opened", () => {
  expect(JSON.stringify(toView(game))).not.toContain("surprise gift");
  expect(JSON.stringify(toView(game))).not.toContain("Happy");
  applyAction(game, { type: "openTile", cat: 0, clue: 0 });
  const open = toView(game).open!;
  expect(open.question).toContain("surprise gift");
  expect(open.answer).toBeNull();
  applyAction(game, { type: "showAnswer" });
  expect(toView(game).open!.answer).toBe("Happy");
});

test("done closes the tile and greys it out; it cannot be opened again", () => {
  applyAction(game, { type: "openTile", cat: 1, clue: 2 });
  expect(applyAction(game, { type: "closeTile" })).toBe(true);
  expect(toView(game).open).toBeNull();
  expect(toView(game).used[1][2]).toBe(true);
  expect(applyAction(game, { type: "openTile", cat: 1, clue: 2 })).toBe(false);
});

test("first action wins: a second tile cannot open while one is open", () => {
  expect(applyAction(game, { type: "openTile", cat: 0, clue: 0 })).toBe(true);
  expect(applyAction(game, { type: "openTile", cat: 2, clue: 2 })).toBe(false);
  expect(toView(game).open!.cat).toBe(0);
});

test("bad tile positions are ignored", () => {
  expect(applyAction(game, { type: "openTile", cat: 9, clue: 0 })).toBe(false);
  expect(applyAction(game, { type: "openTile", cat: 0, clue: -1 })).toBe(false);
  expect(applyAction(game, { type: "openTile", cat: 0.5, clue: 0 })).toBe(false);
  expect(applyAction(game, { type: "showAnswer" })).toBe(false);
  expect(applyAction(game, { type: "closeTile" })).toBe(false);
});

test("scoring starts off with no points; points go up or down per player; reset clears them", () => {
  expect(toView(game).scoring).toEqual({ enabled: false, scores: {} });
  setScoring(game, true);
  expect(adjustScore(game, 2, 300)).toBe(true);
  expect(adjustScore(game, 1, 100)).toBe(true);
  expect(adjustScore(game, 2, -100)).toBe(true);
  expect(toView(game).scoring).toEqual({ enabled: true, scores: { 1: 100, 2: 200 } });
  removeScore(game, 1);
  expect(toView(game).scoring.scores).toEqual({ 2: 200 });
  resetScores(game);
  expect(toView(game).scoring).toEqual({ enabled: true, scores: {} });
});

test("bad score changes are refused", () => {
  expect(adjustScore(game, 1, 1.5)).toBe(false);
  expect(adjustScore(game, 1, 999_999)).toBe(false);
  expect(adjustScore(game, 1.5, 100)).toBe(false);
  expect(toView(game).scoring.scores).toEqual({});
});

test("put back closes the clue and leaves the tile available; done uses it up", () => {
  expect(applyAction(game, { type: "putBack" })).toBe(false); // nothing is open
  applyAction(game, { type: "openTile", cat: 0, clue: 1 });
  applyAction(game, { type: "showAnswer" });
  expect(applyAction(game, { type: "putBack" })).toBe(true);
  expect(toView(game).open).toBeNull();
  expect(toView(game).used[0][1]).toBe(false);
  // The same tile can be opened again, with the answer hidden again.
  expect(applyAction(game, { type: "openTile", cat: 0, clue: 1 })).toBe(true);
  expect(toView(game).open!.answer).toBeNull();
});
