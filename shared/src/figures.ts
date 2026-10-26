// The sandtray: a fixed library of figures, and the shape of the tray.
// Players can only use figures from this list, so nothing typed or uploaded by a user
// is stored or shown. Positions are fractions of the tray (0 to 1), so every screen agrees.

export type FigureCategory = "animals" | "people" | "buildings" | "nature" | "fantasy";

export const FIGURE_CATEGORIES: { id: FigureCategory; label: string }[] = [
  { id: "animals", label: "Animals" },
  { id: "people", label: "People" },
  { id: "buildings", label: "Buildings" },
  { id: "nature", label: "Nature" },
  { id: "fantasy", label: "Fantasy" },
];

export type Figure = {
  id: string;
  name: string;
  category: FigureCategory;
  file: string; // under /figures/
  alt: string;
};

// PLACEHOLDER starter set: simple shapes drawn for this project. Real art replaces them;
// the list below is the only place that has to change.
function placeholders(category: FigureCategory, prefix: string, singular: string): Figure[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `${prefix}-${n}`,
    name: `${singular} ${n}`,
    category,
    file: `${prefix}-${n}.svg`,
    alt: `${singular} figure ${n}`,
  }));
}

export const FIGURES: Figure[] = [
  ...placeholders("animals", "animal", "Animal"),
  ...placeholders("people", "person", "Person"),
  ...placeholders("buildings", "building", "Building"),
  ...placeholders("nature", "nature", "Nature"),
  ...placeholders("fantasy", "fantasy", "Fantasy"),
];

export function findFigure(id: unknown): Figure | undefined {
  return typeof id === "string" ? FIGURES.find((f) => f.id === id) : undefined;
}

export const TRAY = {
  maxItems: 40,
  aspect: 4 / 3, // width divided by height
  figureWidth: 0.14, // a figure's width as a fraction of the tray's width
} as const;

// One placed figure. x and y are the figure's centre, as fractions of the tray.
export type TrayItem = { id: number; figureId: string; x: number; y: number };
export type TrayView = { items: TrayItem[] }; // back to front: the last one is on top

const round = (n: number) => Math.round(n * 10000) / 10000;

// Keeps a figure's centre far enough from the edges that the whole figure stays inside the tray.
// A position that is not a number goes to the middle.
export function clampPosition(x: number, y: number): { x: number; y: number } {
  const halfX = TRAY.figureWidth / 2;
  const halfY = halfX * TRAY.aspect; // the tray is shorter than it is wide
  const clamp = (value: number, low: number, high: number, middle: number) =>
    Number.isFinite(value) ? round(Math.min(high, Math.max(low, value))) : middle;
  return { x: clamp(x, halfX, 1 - halfX, 0.5), y: clamp(y, halfY, 1 - halfY, 0.5) };
}
