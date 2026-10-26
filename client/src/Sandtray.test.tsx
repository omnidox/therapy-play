import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRAY, type TrayView } from "@therapy-play/shared";
import { accessibilityProblems } from "./a11y";
import { Sandtray } from "./Sandtray";

// A pretend screen: the tray is 400 by 300 pixels at the top left, the shelf sits below it.
beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const isShelf = this.classList.contains("shelf");
    const isTray = this.classList.contains("sand");
    const r = isTray
      ? { left: 0, top: 0, width: 400, height: 300 }
      : isShelf
        ? { left: 0, top: 320, width: 400, height: 100 }
        : { left: 0, top: 0, width: 0, height: 0 };
    return {
      ...r,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON: () => ({}),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const empty: TrayView = { items: [] };
const withTwo: TrayView = {
  items: [
    { id: 1, figureId: "animal-1", x: 0.3, y: 0.4 },
    { id: 2, figureId: "person-2", x: 0.7, y: 0.6 },
  ],
};

test("Enter on a shelf figure places it near the middle", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={empty} send={send} />);
  screen.getByRole("button", { name: "Animal 1" }).focus();
  await user.keyboard("{Enter}");
  expect(send).toHaveBeenCalledTimes(1);
  const msg = send.mock.calls[0][0];
  expect(msg).toMatchObject({ type: "placeFigure", figureId: "animal-1" });
  expect(msg.x).toBeGreaterThan(0.3);
  expect(msg.x).toBeLessThan(0.7);
});

test("tap a shelf figure, then tap the sand, to place it exactly where you tap", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={empty} send={send} />);
  const shelfFigure = screen.getByRole("button", { name: "Animal 2" });
  await user.click(shelfFigure);
  expect(shelfFigure.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Tap the tray to place Animal 2/)).toBeTruthy();
  await user.pointer({
    keys: "[MouseLeft]",
    target: screen.getByRole("group", { name: "Sand tray" }),
    coords: { clientX: 100, clientY: 150 },
  });
  expect(send).toHaveBeenCalledWith({ type: "placeFigure", figureId: "animal-2", x: 0.25, y: 0.5 });
  expect(shelfFigure.getAttribute("aria-pressed")).toBe("false");
});

test("Escape cancels a picked-up figure", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={empty} send={send} />);
  await user.click(screen.getByRole("button", { name: "Animal 3" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByText(/Tap the tray to place/)).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

test("arrow keys move a figure, Shift moves it further, Delete puts it away", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={withTwo} send={send} />);
  const figure = screen.getByRole("button", { name: /Animal figure 1/ });
  figure.focus();
  await user.keyboard("{ArrowRight}");
  expect(send).toHaveBeenLastCalledWith({ type: "moveItem", itemId: 1, x: 0.32, y: 0.4 });
  await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
  expect(send.mock.calls.at(-1)![0].y).toBeCloseTo(0.5, 5);
  await user.keyboard("{Delete}");
  expect(send).toHaveBeenLastCalledWith({ type: "removeItem", itemId: 1 });
});

test("dragging a figure across the sand moves it, and drops it where the finger ends", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={withTwo} send={send} />);
  const figure = screen.getByRole("button", { name: /Animal figure 1/ });
  await user.pointer([
    { keys: "[MouseLeft>]", target: figure, coords: { clientX: 120, clientY: 120 } },
    { target: figure, coords: { clientX: 300, clientY: 180 } },
    { keys: "[/MouseLeft]", target: figure, coords: { clientX: 300, clientY: 180 } },
  ]);
  const moves = send.mock.calls.map((c) => c[0]).filter((m) => m.type === "moveItem");
  expect(moves.length).toBeGreaterThanOrEqual(1);
  expect(moves.at(-1)).toMatchObject({ itemId: 1, x: 0.75, y: 0.6 });
});

test("a tap on a figure chooses it, and Put away removes it", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={withTwo} send={send} />);
  await user.click(screen.getByRole("button", { name: /Person figure 2/ }));
  await user.click(screen.getByRole("button", { name: "Put away" }));
  expect(send).toHaveBeenCalledWith({ type: "removeItem", itemId: 2 });
});

test("dropping a figure on the shelf puts it away", async () => {
  const send = vi.fn();
  const user = userEvent.setup();
  render(<Sandtray tray={withTwo} send={send} />);
  const figure = screen.getByRole("button", { name: /Animal figure 1/ });
  await user.pointer([
    { keys: "[MouseLeft>]", target: figure, coords: { clientX: 120, clientY: 120 } },
    { target: figure, coords: { clientX: 200, clientY: 360 } },
    { keys: "[/MouseLeft]", target: figure, coords: { clientX: 200, clientY: 360 } },
  ]);
  expect(send).toHaveBeenCalledWith({ type: "removeItem", itemId: 1 });
});

test("the shelf has tabs for each kind of figure, and arrow keys move between them", async () => {
  const user = userEvent.setup();
  render(<Sandtray tray={empty} send={() => {}} />);
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
    "Animals",
    "People",
    "Buildings",
    "Nature",
    "Fantasy",
  ]);
  screen.getByRole("tab", { name: "Animals" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "People" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", { name: "Person 1" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Animal 1" })).toBeNull();
});

test("a full tray says so and stops accepting figures", () => {
  const items = Array.from({ length: TRAY.maxItems }, (_, i) => ({
    id: i + 1,
    figureId: "animal-1",
    x: 0.5,
    y: 0.5,
  }));
  render(<Sandtray tray={{ items }} send={() => {}} />);
  expect(screen.getByText("The tray is full")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Animal 1" }) as HTMLButtonElement).disabled).toBe(true);
});

test("the sandtray has no accessibility problems", async () => {
  const { container } = render(<Sandtray tray={withTwo} send={() => {}} />);
  expect(await accessibilityProblems(container)).toEqual([]);
});
