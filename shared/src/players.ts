// Limits and name rules for players. Shared so the client form and the server agree.

export const PLAYER_LIMITS = {
  maxPlayers: 8, // in the whole room, the therapist included if she plays
  maxPerScreen: 4,
  nameLength: 20,
} as const;

// Returns a cleaned name, or null if it is empty or too long.
// Names are free text: control characters are removed and spaces are tidied.
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const printable = [...raw].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127).join("");
  const name = printable.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= PLAYER_LIMITS.nameLength ? name : null;
}

// "Player n" with the lowest n that no current player already has.
export function defaultName(taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`Player ${n}`)) n++;
  return `Player ${n}`;
}
