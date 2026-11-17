import { expect, it } from "vitest";
import { coversRange } from "@/features/analytics/coverage";
it("requires an uninterrupted union of completed ranges", () => {
  expect(
    coversRange("2026-01-01", "2026-01-10", [
      { start: "2026-01-01", end: "2026-01-04" },
      { start: "2026-01-05", end: "2026-01-10" },
    ]),
  ).toBe(true);
  expect(
    coversRange("2026-01-01", "2026-01-10", [
      { start: "2026-01-01", end: "2026-01-04" },
      { start: "2026-01-06", end: "2026-01-10" },
    ]),
  ).toBe(false);
  expect(coversRange("2026-01-01", "2026-01-10", [])).toBe(false);
});
