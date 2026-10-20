import { expect, test } from "vitest";
import { PLAYER_LIMITS, cleanName, defaultName } from "@therapy-play/shared";

test("names are tidied and limited to 20 characters", () => {
  expect(cleanName("  Sam   and Mom ")).toBe("Sam and Mom");
  expect(cleanName("a\u0000b\u0007c")).toBe("abc");
  expect(cleanName("x".repeat(PLAYER_LIMITS.nameLength))).toHaveLength(20);
  expect(cleanName("x".repeat(PLAYER_LIMITS.nameLength + 1))).toBeNull();
  expect(cleanName("   ")).toBeNull();
  expect(cleanName(42)).toBeNull();
});

test("default names use the lowest free number", () => {
  expect(defaultName([])).toBe("Player 1");
  expect(defaultName(["Player 1", "Player 2"])).toBe("Player 3");
  expect(defaultName(["Player 2", "Sam"])).toBe("Player 1");
});
