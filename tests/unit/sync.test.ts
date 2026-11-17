import { expect, it } from "vitest";
import {
  advance,
  normalizeRows,
  retryDelay,
  initialCheckpoint,
} from "@/features/sync/protocol";
it("paginates one day and dataset at a time, marks the 50k cap", () => {
  const c = initialCheckpoint("2026-01-01");
  expect(advance(c, 25000, "2026-01-02")).toEqual({
    next: { ...c, offset: 25000 },
    commit: false,
    truncated: false,
    done: false,
  });
  const second = advance({ ...c, offset: 25000 }, 25000, "2026-01-02");
  expect(second.commit).toBe(true);
  expect(second.truncated).toBe(true);
  expect(second.next.dataset).toBe(1);
  expect(
    advance({ day: "2026-01-02", dataset: 3, offset: 0 }, 0, "2026-01-02").done,
  ).toBe(true);
});
it("keeps exact URLs and recomputes derived CTR safely", () => {
  const rows = normalizeRows("QUERY_PAGE_DAILY", [
    {
      keys: ["2026-01-01", "สว่าน", "https://x.test/A?q=1"],
      clicks: 2,
      impressions: 10,
      ctr: 0.9,
      position: 5,
    },
  ]);
  expect(rows[0]).toMatchObject({
    query: "สว่าน",
    page: "https://x.test/A?q=1",
    ctr: 0.2,
  });
  expect(() =>
    normalizeRows("SITE_DAILY", [
      { keys: ["2026-01-01"], clicks: -1, impressions: 0, position: 0 },
    ]),
  ).toThrow();
  expect(() =>
    normalizeRows("QUERY_DAILY", [
      { keys: ["2026-01-01"], clicks: 1, impressions: 2, position: 1 },
    ]),
  ).toThrow();
});
it("backs off failed chunks exponentially with a bound", () => {
  expect(retryDelay(1)).toBe(30000);
  expect(retryDelay(2)).toBe(60000);
  expect(retryDelay(20)).toBe(3600000);
});
