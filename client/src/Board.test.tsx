import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GameView } from "@therapy-play/shared";
import { accessibilityProblems } from "./a11y";
import { Board } from "./Board";

afterEach(cleanup);

const players = [
  { id: 1, name: "Sam" },
  { id: 2, name: "Mom" },
];

const closed: GameView = {
  boardName: "Test board",
  categories: [
    { name: "Feelings", values: [100, 200] },
    { name: "Coping", values: [100, 200] },
  ],
  used: [
    [false, false],
    [false, false],
  ],
  open: null,
  scoring: { enabled: true, scores: { 1: 100 } },
};

const open: GameView = {
  ...closed,
  open: {
    cat: 0,
    clue: 0,
    category: "Feelings",
    value: 100,
    question: "What feeling is a big smile?",
    answer: null,
  },
};

test("tapping a tile asks to open it", async () => {
  const send = vi.fn();
  render(<Board game={closed} role="child" players={players} mine={[1]} send={send} />);
  await userEvent.click(screen.getByRole("button", { name: "Coping 200" }));
  expect(send).toHaveBeenCalledWith({ type: "openTile", cat: 1, clue: 1 });
});

test("Escape puts the clue back instead of using the tile up", async () => {
  const send = vi.fn();
  render(<Board game={open} role="child" players={players} mine={[1]} send={send} />);
  await userEvent.keyboard("{Escape}");
  expect(send).toHaveBeenCalledWith({ type: "putBack" });
  expect(send).not.toHaveBeenCalledWith({ type: "closeTile" });
});

test("the clue screen offers Show answer, Done and Put back, and focus starts inside it", async () => {
  const send = vi.fn();
  render(<Board game={open} role="child" players={players} mine={[1]} send={send} />);
  const dialog = screen.getByRole("dialog", { name: "Clue: Feelings for 100" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(send).toHaveBeenCalledWith({ type: "closeTile" });
  await userEvent.click(screen.getByRole("button", { name: "Put back" }));
  expect(send).toHaveBeenCalledWith({ type: "putBack" });
  await userEvent.click(screen.getByRole("button", { name: "Show answer" }));
  expect(send).toHaveBeenCalledWith({ type: "showAnswer" });
});

test("only the therapist sees the score buttons", () => {
  const { unmount } = render(<Board game={open} role="child" players={players} mine={[1]} send={() => {}} />);
  expect(screen.queryByRole("button", { name: /Give 100 to/ })).toBeNull();
  unmount();
  render(<Board game={open} role="host" players={players} mine={[]} send={() => {}} />);
  expect(screen.getByRole("button", { name: "Give 100 to Sam" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Give 100 to Mom" })).toBeTruthy();
});

test("the board and the clue screen have no accessibility problems", async () => {
  const { container, rerender } = render(
    <Board game={closed} role="host" players={players} mine={[]} send={() => {}} />,
  );
  expect(await accessibilityProblems(container)).toEqual([]);
  rerender(<Board game={open} role="host" players={players} mine={[]} send={() => {}} />);
  expect(await accessibilityProblems(document.body)).toEqual([]);
});
