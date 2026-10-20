import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomState } from "@therapy-play/shared";
import { accessibilityProblems } from "./a11y";
import { JoinForm, OwnNames, PlayersPanel } from "./Players";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const state: RoomState = {
  admitRequired: true,
  maxPlayers: 4,
  hostPlays: true,
  screens: [
    { id: "s1", status: "admitted", playerIds: [2, 3] },
    { id: "s2", status: "waiting", playerIds: [4] },
  ],
  players: [
    { id: 1, name: "Therapist" },
    { id: 2, name: "Sam" },
    { id: 3, name: "Mom" },
    { id: 4, name: "Alex" },
  ],
};

test("the therapist panel has no accessibility problems", async () => {
  const { container } = render(<PlayersPanel state={state} mine={[1]} notice={null} send={() => {}} />);
  expect(await accessibilityProblems(container)).toEqual([]);
});

test("the waiting banner admits everyone waiting; each screen also has its own Admit", async () => {
  const user = userEvent.setup();
  const send = vi.fn();
  render(<PlayersPanel state={state} mine={[1]} notice={null} send={send} />);
  const [banner, forScreen] = screen.getAllByRole("button", { name: "Admit" });
  await user.click(banner);
  expect(send).toHaveBeenCalledWith({ type: "admit" });
  await user.click(forScreen);
  expect(send).toHaveBeenCalledWith({ type: "admit", screenId: "s2" });
});

test("a player changes their own name with the keyboard", async () => {
  const user = userEvent.setup();
  const send = vi.fn();
  render(<OwnNames state={state} mine={[2, 3]} send={send} />);
  await user.click(screen.getByRole("button", { name: "Change names" }));
  const box = screen.getByLabelText("Your name: Sam");
  await user.clear(box);
  await user.type(box, "Sammy{Enter}");
  expect(send).toHaveBeenCalledWith({ type: "renamePlayer", playerId: 2, name: "Sammy" });
});

test("the join form caps the player count and has no accessibility problems", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ freeSlots: 3 }) })),
  );
  const { container } = render(<JoinForm code="abc" onSubmit={() => {}} />);
  const select = await screen.findByLabelText("Players on this screen");
  expect(select.querySelectorAll("option")).toHaveLength(3);
  expect(screen.getByRole("note").textContent).toContain("do not type real names");
  expect(await accessibilityProblems(container)).toEqual([]);
});
