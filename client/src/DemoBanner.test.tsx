import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { accessibilityProblems } from "./a11y";
import { DemoBanner } from "./DemoBanner";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubConfig(config: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => config })),
  );
}

test("a demo site shows the made-up-content warning", async () => {
  stubConfig({ demo: true });
  const { container } = render(<DemoBanner />);
  const note = await screen.findByRole("note");
  expect(note.textContent).toContain("made-up content only");
  expect(await accessibilityProblems(container)).toEqual([]);
});

test("a normal site shows nothing, and a failed config does not break the page", async () => {
  stubConfig({ demo: false });
  const { container, rerender } = render(<DemoBanner />);
  await Promise.resolve();
  expect(container.textContent).toBe("");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  rerender(<DemoBanner />);
  await Promise.resolve();
  expect(container.textContent).toBe("");
});
