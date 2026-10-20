// Test helper: scans rendered HTML for accessibility problems with axe.
// Colour contrast and page-landmark rules need a real browser layout, so they are skipped here.
import axe from "axe-core";

export async function accessibilityProblems(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
}
