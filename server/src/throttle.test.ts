import { expect, test } from "vitest";
import { AttemptLimiter } from "./throttle.js";

const MINUTE = 60 * 1000;

function make() {
  let time = 1_000_000;
  const limiter = new AttemptLimiter(() => time, { perKeyMax: 3, globalMax: 5, windowMs: 15 * MINUTE });
  return { limiter, advance: (ms: number) => (time += ms) };
}

test("a few misses are allowed, then that address must wait", () => {
  const { limiter } = make();
  for (let i = 0; i < 2; i++) limiter.record("a");
  expect(limiter.blockedFor("a")).toBe(0);
  limiter.record("a");
  expect(limiter.blockedFor("a")).toBeGreaterThan(0);
  expect(limiter.blockedFor("b")).toBe(0); // another address is not affected
});

test("the wait ends once the window has passed", () => {
  const { limiter, advance } = make();
  for (let i = 0; i < 3; i++) limiter.record("a");
  expect(limiter.blockedFor("a")).toBe(15 * 60);
  advance(14 * MINUTE);
  expect(limiter.blockedFor("a")).toBe(60);
  advance(MINUTE + 1);
  expect(limiter.blockedFor("a")).toBe(0);
});

test("a correct passcode clears that address's misses", () => {
  const { limiter } = make();
  limiter.record("a");
  limiter.record("a");
  limiter.reset("a");
  limiter.record("a");
  expect(limiter.blockedFor("a")).toBe(0);
});

test("many different addresses together still hit the overall limit", () => {
  const { limiter } = make();
  for (let i = 0; i < 5; i++) limiter.record(`addr-${i}`);
  expect(limiter.blockedFor("a-new-address")).toBeGreaterThan(0);
});
