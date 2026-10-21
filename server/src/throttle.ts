// Slows down repeated attempts: wrong passcode guesses, or room creation on an open demo.
// Held in memory only; nothing is stored.

type Options = { perKeyMax: number; globalMax: number; windowMs: number };

const DEFAULTS: Options = { perKeyMax: 5, globalMax: 30, windowMs: 15 * 60 * 1000 };

export class AttemptLimiter {
  private byKey = new Map<string, number[]>();
  private all: number[] = [];

  constructor(
    private now: () => number = Date.now,
    private options: Options = DEFAULTS,
  ) {}

  // How many seconds a caller must wait before trying again; 0 means go ahead.
  // There is a limit for each address, and a lower overall limit in case addresses are faked.
  blockedFor(key: string): number {
    const { perKeyMax, globalMax, windowMs } = this.options;
    const own = this.recent(this.byKey.get(key) ?? []);
    this.all = this.recent(this.all);
    const waits: number[] = [];
    if (own.length >= perKeyMax) waits.push(own[own.length - perKeyMax] + windowMs - this.now());
    if (this.all.length >= globalMax)
      waits.push(this.all[this.all.length - globalMax] + windowMs - this.now());
    return waits.length === 0 ? 0 : Math.max(1, Math.ceil(Math.max(...waits) / 1000));
  }

  record(key: string): void {
    const own = this.recent(this.byKey.get(key) ?? []);
    own.push(this.now());
    this.byKey.set(key, own);
    this.all.push(this.now());
  }

  // A correct passcode clears that address's earlier misses.
  reset(key: string): void {
    this.byKey.delete(key);
  }

  private recent(times: number[]): number[] {
    const cutoff = this.now() - this.options.windowMs;
    return times.filter((t) => t > cutoff);
  }
}
