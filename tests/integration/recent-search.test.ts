import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    recentSearchSnapshot: { ...mocks, findUniqueOrThrow: mocks.findUnique },
  }),
}));
vi.mock("@/lib/google/client", () => ({
  googleClient: async () => ({
    search: { searchanalytics: { query: mocks.query } },
  }),
  googleCall: async (_id: string, call: () => unknown) => call(),
}));
import { normalizeRecent, recentSearch } from "@/features/analytics/recent";
const site = { id: "site", siteUrl: "sc-domain:test.com", ownerId: "owner" };
const hour = (date: string, clicks = 2, impressions = 100, position = 4) => ({
  keys: [date],
  clicks,
  impressions,
  ctr: clicks / impressions,
  position,
});
const payload = {
  rows: [
    hour("2026-11-17T01:00:00-08:00", 3, 300, 8),
    hour("2026-11-17T00:00:00-08:00"),
  ],
};
const old = () => ({
  id: "cache",
  siteId: "site",
  day: new Date("2026-11-17"),
  data: null,
  fetchedAt: null,
  leaseToken: null,
  leaseUntil: null,
  retryAt: null,
  errorMessage: null,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(old());
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.query.mockResolvedValue({ data: payload });
});
afterEach(() => vi.useRealTimers());
it("sorts hourly instants, computes weighted totals and retains incomplete metadata", async () => {
  const result = await recentSearch(site);
  expect(result.hours.map((h) => h.date)).toEqual([
    "2026-11-17T08:00:00.000Z",
    "2026-11-17T09:00:00.000Z",
  ]);
  expect(result.metrics).toEqual({
    clicks: 5,
    impressions: 400,
    ctr: 0.0125,
    position: 7,
  });
  expect(result.latestHour).toBe("2026-11-17T09:00:00.000Z");
  expect(mocks.query).toHaveBeenCalledWith(
    {
      siteUrl: site.siteUrl,
      requestBody: {
        startDate: "2026-11-17",
        endDate: "2026-11-17",
        dimensions: ["HOUR"],
        dataState: "HOURLY_ALL",
        type: "web",
        aggregationType: "byProperty",
        rowLimit: 25000,
      },
    },
    { timeout: 60000, retry: false },
  );
  expect(mocks.updateMany.mock.calls[1][0].where.leaseToken).toBeTruthy();
});
it("preserves repeated DST hours as distinct instants and accepts both metadata spellings", () => {
  for (const key of ["firstIncompleteHour", "first_incomplete_hour"]) {
    const data = normalizeRecent(
      {
        rows: [
          hour("2026-11-01T01:00:00-08:00"),
          hour("2026-11-01T01:00:00-07:00"),
        ],
        metadata: { [key]: "2026-11-01T01:00:00-08:00" },
      },
      "2026-11-01",
    );
    expect(data.hours.map((h) => h.date)).toEqual([
      "2026-11-01T08:00:00.000Z",
      "2026-11-01T09:00:00.000Z",
    ]);
    expect(data.firstIncompleteHour).toBe("2026-11-01T09:00:00.000Z");
  }
});
it("rejects invalid, duplicate, out-of-day and non-hourly upstream data", () => {
  for (const rows of [
    [hour("bad")],
    [hour("2026-11-16T00:00:00-08:00")],
    [hour("2026-11-17T00:30:00-08:00")],
    [hour("2026-11-17T00:00:00-08:00", -1)],
    [payload.rows[0], payload.rows[0]],
  ]) {
    expect(() => normalizeRecent({ rows }, "2026-11-17")).toThrow();
  }
});
it("returns a fresh database cache without contacting Google", async () => {
  mocks.findUnique.mockResolvedValue({
    ...old(),
    data: normalizeRecent(payload, "2026-11-17"),
    fetchedAt: new Date(),
  });
  expect((await recentSearch(site)).stale).toBe(false);
  expect(mocks.query).not.toHaveBeenCalled();
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
it("losing the database lease does not start another Google request", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.findUnique.mockResolvedValue({
    ...old(),
    leaseUntil: new Date(Date.now() + 90000),
  });
  expect((await recentSearch(site)).refreshing).toBe(true);
  expect(mocks.query).not.toHaveBeenCalled();
});
it("keeps old data on failure, sanitizes errors and backs off for fifteen minutes", async () => {
  const row = {
    ...old(),
    data: normalizeRecent(payload, "2026-11-17"),
    fetchedAt: new Date(Date.now() - 1800000),
  };
  mocks.findUnique.mockResolvedValue(row);
  mocks.query.mockRejectedValue(new Error("Authorization: secret"));
  const result = await recentSearch(site);
  expect(result.metrics.clicks).toBe(5);
  expect(result.stale).toBe(true);
  expect(result.warning).not.toContain("secret");
  expect(result.nextRefreshAt).toBe("2026-11-17T12:15:00.000Z");
  expect(mocks.updateMany.mock.calls[1][0].data.data).toBeUndefined();
});
it("backs off after initial failure without reporting zero traffic as real data", async () => {
  mocks.findUnique.mockResolvedValue({
    ...old(),
    retryAt: new Date(Date.now() + 10000),
    errorMessage: "ไม่พร้อม",
  });
  const result = await recentSearch(site);
  expect(result.available).toBe(false);
  expect(result.hasData).toBe(false);
  expect(mocks.query).not.toHaveBeenCalled();
});
it("a superseded worker returns the winning snapshot instead of overwriting it", async () => {
  mocks.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
  mocks.findUnique
    .mockResolvedValueOnce(old())
    .mockResolvedValueOnce({
      ...old(),
      data: normalizeRecent({}, "2026-11-17"),
      fetchedAt: new Date(),
    });
  const result = await recentSearch(site);
  expect(result.available).toBe(true);
  expect(result.hasData).toBe(false);
});

it("creates an initial cache safely when another request creates the same day first", async () => {
  mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(old());
  mocks.createMany.mockResolvedValue({ count: 0 });
  const result = await recentSearch(site);
  expect(mocks.createMany).toHaveBeenCalledWith({
    data: { siteId: "site", day: new Date("2026-11-17") },
    skipDuplicates: true,
  });
  expect(result.hasData).toBe(true);
});
it("claims only stale snapshots with an expired lease and retry deadline", async () => {
  await recentSearch(site);
  expect(mocks.updateMany.mock.calls[0][0].where).toEqual({
    id: "cache",
    AND: [
      {
        OR: [
          { fetchedAt: null },
          { fetchedAt: { lte: new Date("2026-11-17T11:45:00Z") } },
        ],
      },
      { OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] },
      { OR: [{ retryAt: null }, { retryAt: { lte: new Date() } }] },
    ],
  });
});
