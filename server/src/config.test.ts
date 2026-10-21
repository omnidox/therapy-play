import { expect, test } from "vitest";
import { MIN_PASSCODE_LENGTH, readConfig } from "./config.js";

const GOOD = "x".repeat(MIN_PASSCODE_LENGTH);

test("a normal site needs a passcode and refuses to start without one", () => {
  expect(() => readConfig({})).toThrow(/HOST_PASSCODE is not set/);
  expect(() => readConfig({ HOST_PASSCODE: "" })).toThrow(/HOST_PASSCODE is not set/);
  expect(readConfig({ HOST_PASSCODE: GOOD }).hostPasscode).toBe(GOOD);
});

test("a short passcode is refused, even on a demo", () => {
  expect(() => readConfig({ HOST_PASSCODE: "short" })).toThrow(/at least/);
  expect(() => readConfig({ HOST_PASSCODE: "short", DEMO: "1" })).toThrow(/at least/);
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
