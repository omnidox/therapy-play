import { expect, test } from "vitest";
import { MIN_DEMO_PASSCODE_LENGTH, MIN_PASSCODE_LENGTH, readConfig } from "./config.js";

const GOOD = "x".repeat(MIN_PASSCODE_LENGTH);

test("a normal site needs a passcode and refuses to start without one", () => {
  expect(() => readConfig({})).toThrow(/HOST_PASSCODE is not set/);
  expect(() => readConfig({ HOST_PASSCODE: "" })).toThrow(/HOST_PASSCODE is not set/);
  expect(readConfig({ HOST_PASSCODE: GOOD }).hostPasscode).toBe(GOOD);
});

test("a real site needs a long passcode; a demo may use a shorter one", () => {
  expect(() => readConfig({ HOST_PASSCODE: "short" })).toThrow(/at least 12/);
  expect(() => readConfig({ HOST_PASSCODE: "x".repeat(MIN_PASSCODE_LENGTH - 1) })).toThrow(/at least 12/);
  const demoOk = "x".repeat(MIN_DEMO_PASSCODE_LENGTH);
  expect(readConfig({ HOST_PASSCODE: demoOk, DEMO: "1" }).hostPasscode).toBe(demoOk);
  expect(() => readConfig({ HOST_PASSCODE: "short", DEMO: "1" })).toThrow(/at least 6 .*demo site/);
  // the real minimum still applies without DEMO, even when the same short passcode would pass on a demo
  expect(() => readConfig({ HOST_PASSCODE: demoOk })).toThrow(/at least 12/);
});

test("the error says how long the passcode is, never what it is", () => {
  try {
    readConfig({ HOST_PASSCODE: "secret", DEMO: undefined });
  } catch (error) {
    const message = (error as Error).message;
    expect(message).toContain("the one set has 6");
    expect(message).not.toContain("secret");
  }
});

test("a demo site, or local development, may run without a passcode", () => {
  expect(readConfig({ DEMO: "1" })).toMatchObject({ demo: true, hostPasscode: undefined });
  expect(readConfig({ DEMO: "true" }).demo).toBe(true);
  expect(readConfig({}, true)).toMatchObject({ demo: false, hostPasscode: undefined });
});

test("port and host come from the environment, with defaults", () => {
  expect(readConfig({ DEMO: "1" })).toMatchObject({ port: 3001, host: "0.0.0.0" });
  expect(readConfig({ DEMO: "1", PORT: "8080", HOST: "127.0.0.1" })).toMatchObject({
    port: 8080,
    host: "127.0.0.1",
  });
});
