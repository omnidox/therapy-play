import { beforeEach, expect, test } from "vitest";
import { FIGURES, TRAY, clampPosition } from "@therapy-play/shared";
import {
  clearTray,
  emptyTray,
  moveItem,
  nudgeItem,
  placeFigure,
  removeItem,
  toView,
  type TrayState,
} from "./tray.js";

let tray: TrayState;
const ANIMAL = "animal-1";

beforeEach(() => {
  tray = emptyTray();
});

test("a figure from the library can be placed, and it appears where it was put", () => {
  expect(placeFigure(tray, ANIMAL, 0.5, 0.4)).toBe(true);
  expect(toView(tray).items).toEqual([{ id: 1, figureId: ANIMAL, x: 0.5, y: 0.4 }]);
});

test("unknown figures and bad numbers are refused", () => {
  expect(placeFigure(tray, "not-a-figure", 0.5, 0.5)).toBe(false);
  expect(placeFigure(tray, undefined, 0.5, 0.5)).toBe(false);
  expect(placeFigure(tray, ANIMAL, "0.5", 0.5)).toBe(false);
  expect(placeFigure(tray, ANIMAL, NaN, 0.5)).toBe(false);
  expect(placeFigure(tray, ANIMAL, 0.5, Infinity)).toBe(false);
  expect(toView(tray).items).toHaveLength(0);
});

test("figures stay inside the tray: positions are pulled in from the edges", () => {
  placeFigure(tray, ANIMAL, -5, 99);
  const { items } = toView(tray);
  expect(items[0]).toEqual({ id: 1, figureId: ANIMAL, ...clampPosition(0, 1) });
  expect(items[0].x).toBeGreaterThan(0);
  expect(items[0].y).toBeLessThan(1);
});

test("a moved figure goes to the front, keeping its id", () => {
  placeFigure(tray, "animal-1", 0.2, 0.2);
  placeFigure(tray, "person-1", 0.6, 0.6);
  expect(moveItem(tray, 1, 0.3, 0.3)).toBe(true);
  expect(toView(tray).items.map((i) => i.id)).toEqual([2, 1]);
  expect(toView(tray).items[1]).toMatchObject({ id: 1, x: 0.3, y: 0.3 });
});

test("moving or removing a figure that does not exist does nothing", () => {
  placeFigure(tray, ANIMAL, 0.5, 0.5);
  expect(moveItem(tray, 99, 0.1, 0.1)).toBe(false);
  expect(moveItem(tray, 1, "x", 0.1)).toBe(false);
  expect(removeItem(tray, 99)).toBe(false);
  expect(toView(tray).items).toHaveLength(1);
});

test("a figure can be put away, and the tray can be cleared", () => {
  placeFigure(tray, "animal-1", 0.2, 0.2);
  placeFigure(tray, "animal-2", 0.4, 0.4);
  expect(removeItem(tray, 1)).toBe(true);
  expect(toView(tray).items.map((i) => i.id)).toEqual([2]);
  clearTray(tray);
  expect(toView(tray).items).toEqual([]);
  placeFigure(tray, ANIMAL, 0.5, 0.5);
  expect(toView(tray).items[0].id).toBe(3); // ids keep counting, so an old id never means a new figure
});

test("the tray holds at most the maximum number of figures", () => {
  for (let i = 0; i < TRAY.maxItems; i++) {
    expect(placeFigure(tray, FIGURES[i % FIGURES.length].id, 0.5, 0.5)).toBe(true);
  }
  expect(placeFigure(tray, ANIMAL, 0.5, 0.5)).toBe(false);
  removeItem(tray, 1);
  expect(placeFigure(tray, ANIMAL, 0.5, 0.5)).toBe(true);
});

test("the view is a copy: changing it does not change the tray", () => {
  placeFigure(tray, ANIMAL, 0.5, 0.5);
  const view = toView(tray);
  view.items[0].x = 0.9;
  expect(toView(tray).items[0].x).toBe(0.5);
});

test("nudges add up from where the figure is now, stay inside the tray, and are limited in size", () => {
  placeFigure(tray, ANIMAL, 0.5, 0.5);
  nudgeItem(tray, 1, 0.02, 0);
  nudgeItem(tray, 1, 0.02, 0);
  nudgeItem(tray, 1, 0.02, 0);
  expect(toView(tray).items[0].x).toBeCloseTo(0.56, 5); // three quick presses, three steps
  nudgeItem(tray, 1, 5, 0); // a huge step is cut down to a fifth of the tray
  expect(toView(tray).items[0].x).toBeCloseTo(0.76, 5);
  nudgeItem(tray, 1, 0.2, 0);
  nudgeItem(tray, 1, 0.2, 0);
  expect(toView(tray).items[0].x).toBeLessThan(1); // never leaves the tray
  expect(nudgeItem(tray, 99, 0.1, 0.1)).toBe(false);
  expect(nudgeItem(tray, 1, "a", 0)).toBe(false);
});
