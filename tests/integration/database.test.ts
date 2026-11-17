import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Prisma } from "@/generated/prisma/client";
const holder = vi.hoisted(() => ({ database: null as PGlite | null }));
async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = Prisma.sql(strings, ...values);
  const result = await holder.database!.query<Record<string, unknown>>(
    sql.text,
    sql.values,
  );
  return result.rows.map((row) => ({
    ...row,
    ...(typeof row.date === "string"
      ? { date: new Date(row.date + "T00:00:00Z") }
      : {}),
  }));
}
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    $queryRaw: query,
    site: {
      findUniqueOrThrow: async () => ({
        id: "site",
        ruleConfig: null,
        lastSyncAt: new Date(),
      }),
    },
    pageTarget: { findMany: async () => [] },
    $transaction: async (
      fn: (tx: {
        $executeRaw: (
          strings: TemplateStringsArray,
          ...values: unknown[]
        ) => Promise<unknown>;
      }) => Promise<unknown>,
    ) =>
      holder.database!.transaction(async (tx) =>
        fn({
          $executeRaw: async (strings, ...values) => {
            const sql = Prisma.sql(strings, ...values);
            return (await tx.query(sql.text, sql.values)).rows;
          },
        }),
      ),
    syncJob: {
      findMany: async () => [
        {
          startDate: new Date("1900-01-01"),
          endDate: new Date("2999-12-31"),
          truncated: false,
        },
      ],
    },
  }),
}));
import { summary, table, reportInput, csv } from "@/features/analytics/service";
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  holder.database = pg;
  await pg.exec(
    "CREATE SCHEMA neon_auth; CREATE TABLE neon_auth.users (id text PRIMARY KEY); INSERT INTO neon_auth.users VALUES ('managed-owner'); SET search_path TO neon_auth,public;",
  );
  await pg.exec(
    await readFile(
      "prisma/migrations/20261116000000_initial/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(await readFile("prisma/migrations/20261117000000_recent_search/migration.sql", "utf8"));
  await pg.query(
    `INSERT INTO public."Site" (id,"ownerId","siteUrl","displayName",permission,"propertyType","updatedAt") VALUES ('site','owner','sc-domain:x.test','x.test','siteOwner','DOMAIN',NOW())`,
  );
  for (const [
    id,
    date,
    dataset,
    queryValue,
    page,
    clicks,
    impressions,
    position,
  ] of [
    ["s1", "2026-01-01", "SITE_DAILY", null, null, 10, 100, 2],
    ["s2", "2026-01-02", "SITE_DAILY", null, null, 0, 900, 12],
    ["q1", "2026-01-01", "QUERY_DAILY", "สว่าน", null, 4, 100, 3],
    ["q2", "2026-01-02", "QUERY_DAILY", "สว่าน", null, 6, 900, 13],
    ["q3", "2025-12-30", "QUERY_DAILY", "สว่าน", null, 20, 1000, 8],
    ["q4", "2026-01-01", "QUERY_DAILY", "=WEBSERVICE('x')", null, 1, 10, 2],
  ] as const)
    await pg.query(
      `INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","dimensionKey",query,page,clicks,impressions,ctr,position) VALUES ($1,'site',$2,$3,$1,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        date,
        dataset,
        queryValue,
        page,
        clicks,
        impressions,
        clicks / impressions,
        position,
      ],
    );
}, 30000);
afterAll(async () => {
  await pg?.close();
});
it("runs the real migration in public and leaves managed auth data intact", async () => {
  expect(
    (await pg.query<{ id: string }>("SELECT id FROM neon_auth.users")).rows,
  ).toEqual([{ id: "managed-owner" }]);
  const tables = await pg.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
  );
  expect(tables.rows.map((t) => t.table_name)).toContain("SearchMetric");
  expect(tables.rows.map((t) => t.table_name)).not.toContain("users");
});
it("executes real analytics SQL using independent site totals and weighted positions", async () => {
  const result = await summary("site", "2026-01-01", "2026-01-02");
  expect(result.metrics).toEqual({
    clicks: 10,
    impressions: 1000,
    ctr: 0.01,
    position: 11,
  });
  expect(result.daily).toHaveLength(2);
});
it("executes real Unicode filtering, comparison, sorting and pagination SQL", async () => {
  const result = await table(
    reportInput.parse({
      siteId: "site",
      start: "2026-01-01",
      end: "2026-01-02",
      search: "สว่าน",
    }),
    "query",
  );
  expect(result.total).toBe(1);
  expect(result.rows[0]).toMatchObject({
    label: "สว่าน",
    clicks: 10,
    impressions: 1000,
    ctr: 0.01,
    position: 12,
    clickChange: -50,
    impressionChange: 0,
    positionChange: 4,
  });
});
it("neutralizes spreadsheet formulas and escapes CSV cells", () => {
  const text = csv([
    {
      label: '=WEBSERVICE("x")',
      clicks: 1,
      impressions: 10,
      ctr: 0.1,
      position: 2,
      clickChange: null,
      impressionChange: null,
      positionChange: null,
    },
  ]);
  expect(text).toContain('"\'=WEBSERVICE(""x"")"');
});
it("prevents overlapping active jobs while allowing completed history and idempotent metric upserts", async () => {
  const insert = `INSERT INTO public."SyncJob" (id,"siteId","syncType","startDate","endDate",checkpoint) VALUES ($1,'site','MANUAL','2026-01-01','2026-01-02','{"day":"2026-01-01","dataset":0,"offset":0}')`;
  await pg.query(insert, ["job-a"]);
  await expect(pg.query(insert, ["job-b"])).rejects.toThrow();
  await pg.query(
    `UPDATE public."SyncJob" SET status='SUCCEEDED' WHERE id='job-a'`,
  );
  await pg.query(insert, ["job-b"]);
  await pg.query(
    `INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","dimensionKey",clicks,impressions,ctr,position) VALUES ('new','site','2026-01-01','SITE_DAILY','s1',20,100,.2,4) ON CONFLICT ("siteId",date,"datasetType","searchType","dimensionKey") DO UPDATE SET clicks=EXCLUDED.clicks`,
  );
  expect(
    (
      await pg.query<{ clicks: number }>(
        `SELECT clicks FROM public."SearchMetric" WHERE id='s1'`,
      )
    ).rows[0].clicks,
  ).toBe(20);
});
it("rolls back failed daily publications instead of destroying old data", async () => {
  await expect(
    pg.transaction(async (tx) => {
      await tx.query(`DELETE FROM public."SearchMetric" WHERE id='s1'`);
      await tx.query(
        `INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","dimensionKey",clicks,impressions,ctr,position) VALUES ('bad','site','2026-01-01','SITE_DAILY','bad',-1,1,0,1)`,
      );
    }),
  ).rejects.toThrow();
  expect(
    (await pg.query(`SELECT id FROM public."SearchMetric" WHERE id='s1'`)).rows,
  ).toHaveLength(1);
});
it("stores long exact URLs and Unicode queries without B-tree key size failures", async () => {
  const { randomBytes } = await import("node:crypto");
  const page = "https://x.test/" + randomBytes(3200).toString("hex"),
    queryValue = "สว่าน" + randomBytes(2500).toString("base64");
  await pg.query(
    `INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","dimensionKey",query,page,clicks,impressions,ctr,position) VALUES ('long','site','2026-01-01','QUERY_PAGE_DAILY','long',$1,$2,1,10,.1,3)`,
    [queryValue, page],
  );
  expect(
    (
      await pg.query<{ page: string }>(
        `SELECT page FROM public."SearchMetric" WHERE id='long'`,
      )
    ).rows[0].page,
  ).toBe(page);
  await pg.query(
    `INSERT INTO public."PageTarget" (id,"siteId",page,"pageKey","targetKeyword") VALUES ('long-target','site',$1,'hash',$2)`,
    [page, queryValue],
  );
  expect(
    (
      await pg.query<{ page: string }>(
        `SELECT page FROM public."PageTarget" WHERE id='long-target'`,
      )
    ).rows[0].page,
  ).toBe(page);
});

it("persists opportunity rules idempotently and preserves dismissals through real SQL", async () => {
  const { analyzeSite } = await import("@/features/opportunities/service");
  const { defaultRange } = await import("@/features/analytics/math");
  const { end } = defaultRange();
  await pg.query(
    `INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","dimensionKey",query,page,clicks,impressions,ctr,position) VALUES ('analysis','site',$1,'QUERY_PAGE_DAILY','analysis','important keyword','https://x.test/product',25,2000,.0125,7)`,
    [end],
  );
  await analyzeSite("site");
  const first = await pg.query<{ id: string; type: string; status: string }>(
    `SELECT id,type,status FROM public."Opportunity" WHERE "siteId"='site'`,
  );
  expect(first.rows).toHaveLength(1);
  expect(first.rows[0]).toMatchObject({ type: "QUICK_WIN", status: "OPEN" });
  await pg.query(
    `UPDATE public."Opportunity" SET status='DISMISSED' WHERE id=$1`,
    [first.rows[0].id],
  );
  await analyzeSite("site");
  expect(
    (
      await pg.query<{ status: string }>(
        `SELECT status FROM public."Opportunity" WHERE "siteId"='site'`,
      )
    ).rows,
  ).toEqual([{ status: "DISMISSED" }]);
  await pg.query(`UPDATE public."Opportunity" SET status='OPEN' WHERE id=$1`, [
    first.rows[0].id,
  ]);
  await pg.query(`DELETE FROM public."SearchMetric" WHERE id='analysis'`);
  await analyzeSite("site");
  expect(
    (
      await pg.query<{ status: string }>(
        `SELECT status FROM public."Opportunity" WHERE "siteId"='site'`,
      )
    ).rows,
  ).toEqual([{ status: "RESOLVED" }]);
});

it("isolates recent hourly snapshots from daily metrics and enforces one snapshot per site/day", async () => {
  const payload = { hours: [{ date: "2026-11-17T08:00:00Z", clicks: 2 }], firstIncompleteHour: null };
  await pg.query(`INSERT INTO public."RecentSearchSnapshot" (id,"siteId",day,data) VALUES ('recent','site','2026-11-17',$1)`, [JSON.stringify(payload)]);
  const result = await pg.query<{data: unknown}>(`SELECT data FROM public."RecentSearchSnapshot" WHERE id='recent'`);
  expect(result.rows[0].data).toEqual(payload);
  await expect(pg.query(`INSERT INTO public."RecentSearchSnapshot" (id,"siteId",day) VALUES ('duplicate','site','2026-11-17')`)).rejects.toThrow();
  await expect(pg.query(`INSERT INTO public."RecentSearchSnapshot" (id,"siteId",day) VALUES ('foreign','missing','2026-11-17')`)).rejects.toThrow();
  expect((await pg.query(`SELECT * FROM public."SearchMetric" WHERE date='2026-11-17'`)).rows).toHaveLength(0);
});
