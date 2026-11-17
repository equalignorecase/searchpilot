import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  raw: vi.fn(),
  transaction: vi.fn(),
  findSite: vi.fn(),
  stageDelete: vi.fn(),
  stageCreate: vi.fn(),
  metricDelete: vi.fn(),
  execute: vi.fn(),
  jobUpdate: vi.fn(),
  updateMany: vi.fn(),
  siteUpdate: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/google/client", () => ({
  googleClient: async () => ({
    search: { searchanalytics: { query: mocks.query } },
  }),
  googleCall: async (_owner: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    $queryRaw: mocks.raw,
    $transaction: mocks.transaction,
    site: { findUniqueOrThrow: mocks.findSite },
    syncJob: { updateMany: mocks.updateMany },
  }),
}));
import { workOne } from "@/features/sync/service";
const job = {
  id: "job",
  siteId: "site",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-01"),
  checkpoint: { day: "2026-01-01", dataset: 0, offset: 0 },
  leaseToken: "lease",
  attempts: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.raw.mockResolvedValue([job]);
  mocks.findSite.mockResolvedValue({
    id: "site",
    ownerId: "owner",
    siteUrl: "sc-domain:example.com",
  });
  mocks.lock.mockResolvedValue([{ leaseToken: "lease", status: "RUNNING" }]);
  mocks.query.mockResolvedValue({
    data: {
      rows: [
        { keys: ["2026-01-01"], clicks: 5, impressions: 100, position: 8 },
      ],
    },
  });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      $queryRaw: mocks.lock,
      metricStage: {
        deleteMany: mocks.stageDelete,
        createMany: mocks.stageCreate,
      },
      searchMetric: { deleteMany: mocks.metricDelete },
      $executeRaw: mocks.execute,
      syncJob: { update: mocks.jobUpdate },
      site: { update: mocks.siteUpdate },
    }),
  );
});
it("commits a daily snapshot and checkpoint in one transaction", async () => {
  expect(await workOne()).toBe(true);
  expect(mocks.query).toHaveBeenCalledWith(
    expect.objectContaining({
      siteUrl: "sc-domain:example.com",
      requestBody: expect.objectContaining({
        dimensions: ["date"],
        dataState: "final",
        type: "web",
      }),
    }),
    expect.anything(),
  );
  expect(mocks.stageCreate).toHaveBeenCalled();
  expect(mocks.metricDelete).toHaveBeenCalledWith({
    where: {
      siteId: "site",
      date: new Date("2026-01-01"),
      datasetType: "SITE_DAILY",
      searchType: "web",
    },
  });
  expect(mocks.execute).toHaveBeenCalledOnce();
  expect(mocks.jobUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        checkpoint: { day: "2026-01-01", dataset: 1, offset: 0 },
        status: "QUEUED",
      }),
    }),
  );
});
it("does not publish an incomplete page of a paginated day", async () => {
  mocks.query.mockResolvedValue({
    data: {
      rows: Array.from({ length: 25000 }, (_, i) => ({
        keys: ["2026-01-01"],
        clicks: 1,
        impressions: i + 1,
        position: 3,
      })),
    },
  });
  await workOne();
  expect(mocks.metricDelete).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.jobUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        checkpoint: { day: "2026-01-01", dataset: 0, offset: 25000 },
      }),
    }),
  );
});
it("fences a stale worker after its lease was replaced", async () => {
  mocks.lock.mockResolvedValue([
    { leaseToken: "new-worker", status: "RUNNING" },
  ]);
  await workOne();
  expect(mocks.stageCreate).not.toHaveBeenCalled();
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.jobUpdate).not.toHaveBeenCalled();
});
it("records sanitized failure and retries without changing the checkpoint", async () => {
  mocks.query.mockRejectedValue(new Error("secret-token-from-provider"));
  await workOne();
  expect(mocks.transaction).not.toHaveBeenCalled();
  const data = mocks.updateMany.mock.calls[0][0];
  expect(data.where.leaseToken).toBe("lease");
  expect(data.data).toMatchObject({ status: "RETRY", attempts: 1 });
  expect(JSON.stringify(data)).not.toContain("secret-token");
  expect(data.data.checkpoint).toBeUndefined();
});
it("does nothing when no durable job is available", async () => {
  mocks.raw.mockResolvedValue([]);
  expect(await workOne()).toBe(false);
  expect(mocks.query).not.toHaveBeenCalled();
});
it("rejects invalid historical ranges as input errors before creating a job", async () => {
  const { enqueue } = await import("@/features/sync/service");
  for (const [start, end] of [
    ["2026-03-02", "2026-03-01"],
    ["2026-02-30", "2026-03-01"],
  ]) {
    await expect(enqueue("site", start, end)).rejects.toMatchObject({
      status: 400,
    });
  }
});
