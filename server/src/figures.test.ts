import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { FIGURES, FIGURE_CATEGORIES, TRAY, clampPosition, findFigure } from "@therapy-play/shared";

const figuresFolder = fileURLToPath(new URL("../../client/public/figures/", import.meta.url));
const assetsFile = fileURLToPath(new URL("../../ASSETS.md", import.meta.url));

test("every figure has a unique id, a file that exists, and a description", () => {
  const ids = FIGURES.map((f) => f.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const figure of FIGURES) {
    expect(existsSync(figuresFolder + figure.file), `${figure.file} is missing`).toBe(true);
    expect(figure.alt.length, `${figure.id} needs a description`).toBeGreaterThan(3);
    expect(FIGURE_CATEGORIES.some((c) => c.id === figure.category)).toBe(true);
  }
});

test("every category has figures, and the library is small enough to browse", () => {
  for (const category of FIGURE_CATEGORIES) {
    expect(FIGURES.filter((f) => f.category === category.id).length).toBeGreaterThanOrEqual(1);
  }
  expect(FIGURES.length).toBeLessThanOrEqual(60);
});

test("every figure file is recorded, with its license, in ASSETS.md", () => {
  const assets = readFileSync(assetsFile, "utf-8");
  for (const figure of FIGURES) {
    const line = assets.split("\n").find((l) => l.includes(figure.file));
    expect(line, `${figure.file} is not listed in ASSETS.md`).toBeTruthy();
    expect(line, `${figure.file} has no CC0 license in ASSETS.md`).toMatch(/CC0/);
  }
});

test("figure files are small and are not scripts", () => {
  for (const figure of FIGURES) {
    const text = readFileSync(figuresFolder + figure.file, "utf-8");
    expect(text.length, `${figure.file} is large`).toBeLessThan(20_000);
    expect(text.toLowerCase()).not.toContain("<script");
    expect(text.toLowerCase()).not.toContain("onload");
  }
});

test("findFigure only accepts library ids", () => {
  expect(findFigure("animal-1")?.category).toBe("animals");
  expect(findFigure("../secret")).toBeUndefined();
  expect(findFigure(42)).toBeUndefined();
});

test("positions are pulled inside the tray by half a figure, and bad numbers go to the middle", () => {
  const half = TRAY.figureWidth / 2;
  expect(clampPosition(0, 0)).toEqual({ x: half, y: Math.round(half * TRAY.aspect * 10000) / 10000 });
  expect(clampPosition(1, 1).x).toBeCloseTo(1 - half, 4);
  expect(clampPosition(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  expect(clampPosition(NaN, Infinity)).toEqual({ x: 0.5, y: 0.5 });
});
