// The shape of a Jeopardy board, and checks used by both the server and the client.

export type Clue = { value: number; question: string; answer: string };
export type Category = { name: string; clues: Clue[] };
export type BoardData = { name: string; categories: Category[] };

export const LIMITS = {
  maxCategories: 6,
  maxRows: 6,
  boardName: 60,
  categoryName: 40,
  question: 300,
  answer: 150,
  maxValue: 10000,
} as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

// Returns a cleaned copy of the board, or null if anything is missing or too long.
export function validateBoard(input: unknown): BoardData | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as { name?: unknown; categories?: unknown };
  const name = text(raw.name, LIMITS.boardName);
  if (name === null || !Array.isArray(raw.categories)) return null;
  if (raw.categories.length < 1 || raw.categories.length > LIMITS.maxCategories) return null;

  const categories: Category[] = [];
  let rows = -1;
  for (const rawCat of raw.categories as unknown[]) {
    if (typeof rawCat !== "object" || rawCat === null) return null;
    const cat = rawCat as { name?: unknown; clues?: unknown };
    const catName = text(cat.name, LIMITS.categoryName);
    if (catName === null || !Array.isArray(cat.clues)) return null;
    if (cat.clues.length < 1 || cat.clues.length > LIMITS.maxRows) return null;
    if (rows === -1) rows = cat.clues.length;
    if (cat.clues.length !== rows) return null; // every category needs the same number of rows

    const clues: Clue[] = [];
    for (const rawClue of cat.clues as unknown[]) {
      if (typeof rawClue !== "object" || rawClue === null) return null;
      const clue = rawClue as { value?: unknown; question?: unknown; answer?: unknown };
      const question = text(clue.question, LIMITS.question);
      const answer = text(clue.answer, LIMITS.answer);
      const value = clue.value;
      if (question === null || answer === null) return null;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > LIMITS.maxValue) {
        return null;
      }
      clues.push({ value, question, answer });
    }
    categories.push({ name: catName, clues });
  }
  return { name, categories };
}

const FILE_FORMAT = "therapy-play-board";

// A board file is plain JSON saved on the therapist's own device.
export function boardToFileText(board: BoardData): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, board }, null, 2);
}

export function parseBoardFile(fileText: string): BoardData | null {
  try {
    const parsed = JSON.parse(fileText) as { format?: unknown; board?: unknown };
    if (parsed?.format !== FILE_FORMAT) return null;
    return validateBoard(parsed.board);
  } catch {
    return null;
  }
}
