// Small private keys kept on this device only, so closing the browser does not lose a seat
// or the therapist's control of a room. Nothing here identifies a person: each value is a
// random code that only works for one temporary room. Entries expire after a day, and are
// removed as soon as the room ends or the seat is closed.

const DAY_MS = 24 * 60 * 60 * 1000;
const PREFIXES = ["seat:", "hostKey:"];

type Entry = { value: string; savedAt: number };

export function saveKey(key: string, value: string): void {
  try {
    const entry: Entry = { value, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Without storage a closed browser just asks for names again.
  }
}

export function readKey(key: string): string | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    const entry = JSON.parse(raw) as Entry;
    if (Date.now() - entry.savedAt > DAY_MS) {
      localStorage.removeItem(key);
      return undefined;
    }
    return entry.value;
  } catch {
    return undefined;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}

// A finished or unavailable room leaves nothing behind on this device.
export function forgetRoom(code: string): void {
  for (const prefix of PREFIXES) removeKey(`${prefix}${code}`);
}

// Removes expired entries left behind by rooms that were never closed.
export function purgeOldKeys(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && PREFIXES.some((p) => key.startsWith(p))) readKey(key); // readKey drops expired ones
    }
  } catch {
    // Storage is blocked; nothing to clean.
  }
}
