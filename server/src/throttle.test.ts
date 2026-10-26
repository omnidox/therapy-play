import { expect, test } from "vitest";
import { AttemptLimiter, TokenBucket } from "./throttle.js";

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

test("a connection may burst, then is held to its steady rate, and recovers when it rests", () => {
  let time = 0;
  const bucket = new TokenBucket(() => time, { capacity: 5, perSecond: 2 });
  for (let i = 0; i < 5; i++) expect(bucket.take()).toBe(true); // the burst
  expect(bucket.take()).toBe(false); // used up
  time += 500; // half a second gives one message back
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(false);
  time += 60_000; // a long rest refills to the capacity, no more
  for (let i = 0; i < 5; i++) expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(false);
});
