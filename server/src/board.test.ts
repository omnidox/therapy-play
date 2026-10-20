import { expect, test } from "vitest";
import {
  boardToFileText,
  copingBoard,
  feelingsBoard,
  LIMITS,
  needsBoard,
  parseBoardFile,
  starterBoards,
  validateBoard,
  type BoardData,
} from "@therapy-play/shared";

const small = (): BoardData => ({
  name: "Test",
  categories: [
    { name: "A", clues: [{ value: 100, question: "Q1", answer: "A1" }] },
    { name: "B", clues: [{ value: 100, question: "Q2", answer: "A2" }] },
  ],
});

test("every starter board is valid, 5 by 5, and has its own name", () => {
  expect(starterBoards.map((b) => b.name)).toEqual(["Feelings", "Coping Skills", "Needs"]);
  for (const board of [feelingsBoard, copingBoard, needsBoard]) {
    expect(validateBoard(board)).toEqual(board);
    expect(board.categories).toHaveLength(5);
    for (const c of board.categories) {
      expect(c.clues.map((k) => k.value)).toEqual([100, 200, 300, 400, 500]);
    }
  }
});

test("a good board passes and text is trimmed", () => {
  const board = small();
  board.name = "  Test  ";
  expect(validateBoard(board)?.name).toBe("Test");
});

test("boards with missing or oversized parts are rejected", () => {
  const noQuestion = small();
  noQuestion.categories[0].clues[0].question = "  ";
  expect(validateBoard(noQuestion)).toBeNull();

  const longName = small();
  longName.name = "x".repeat(LIMITS.boardName + 1);
  expect(validateBoard(longName)).toBeNull();

  const badValue = small();
  badValue.categories[0].clues[0].value = 1.5;
  expect(validateBoard(badValue)).toBeNull();

  const uneven = small();
  uneven.categories[0].clues.push({ value: 200, question: "Q", answer: "A" });
  expect(validateBoard(uneven)).toBeNull();

  const tooMany = small();
  tooMany.categories = Array.from({ length: LIMITS.maxCategories + 1 }, () => small().categories[0]);
  expect(validateBoard(tooMany)).toBeNull();

  expect(validateBoard(null)).toBeNull();
  expect(validateBoard("board")).toBeNull();
  expect(validateBoard({ name: "x", categories: "nope" })).toBeNull();
});

test("a saved board file loads back the same; other files are refused", () => {
  const board = small();
  expect(parseBoardFile(boardToFileText(board))).toEqual(board);
  expect(parseBoardFile("not json")).toBeNull();
  expect(parseBoardFile(JSON.stringify({ format: "something-else", board }))).toBeNull();
  expect(parseBoardFile(JSON.stringify({ format: "therapy-play-board", board: { name: "" } }))).toBeNull();
});
