import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/prisma";
import { coverageFor } from "./coverage-store";
import {
  aggregate,
  comparisonRange,
  dateRange,
  defaultRange,
  changePercent,
} from "./math";
export const reportInput = z
  .object({
    siteId: z.string().min(1),
    start: z.iso.date().default(() => defaultRange().start),
    end: z.iso.date().default(() => defaultRange().end),
    search: z.string().max(500).default(""),
    minImpressions: z.coerce.number().min(0).default(0),
    minClicks: z.coerce.number().min(0).default(0),
    minPosition: z.coerce.number().min(0).default(0),
    maxPosition: z.coerce.number().min(0).max(1000).default(1000),
    minCtr: z.coerce.number().min(0).max(1).default(0),
    maxCtr: z.coerce.number().min(0).max(1).default(1),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    sort: z
      .enum([
        "clicks",
        "impressions",
        "ctr",
        "position",
        "clickChange",
        "impressionChange",
        "positionChange",
        "label",
      ])
      .default("clicks"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (v) => {
      try {
        dateRange(v.start, v.end);
        return v.minPosition <= v.maxPosition && v.minCtr <= v.maxCtr;
      } catch {
        return false;
      }
    },
    { message: "ช่วงวันที่หรือตัวกรองรายงานไม่ถูกต้อง" },
  );
export type ReportInput = z.infer<typeof reportInput>;
export type TableRow = {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clickChange: number | null;
  impressionChange: number | null;
  positionChange: number | null;
};
type GroupRow = {
  label: string;
  clicks: number;
  impressions: number;
  position: number;
};
function bounds(siteId: string, dataset: string, start: string, end: string) {
  return Prisma.sql`"siteId"=${siteId} AND "datasetType"=CAST(${dataset} AS public."DatasetType") AND "searchType"='web' AND date>=${new Date(start)} AND date<=${new Date(end)}`;
}
const totalsSql = Prisma.sql`SUM(clicks)::float8 AS clicks,SUM(impressions)::float8 AS impressions,COALESCE(SUM(position*impressions)/NULLIF(SUM(impressions),0),0)::float8 AS position`;
export async function summary(siteId: string, start: string, end: string) {
  const previous = comparisonRange(start, end);
  const [daily, prior, site, coverage, priorCoverage] = await Promise.all([
    db().$queryRaw<
      (GroupRow & { date: Date })[]
    >`SELECT date, ${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, "SITE_DAILY", start, end)} GROUP BY date ORDER BY date`,
    db().$queryRaw<
      GroupRow[]
    >`SELECT ${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, "SITE_DAILY", previous.start, previous.end)}`,
    db().site.findUniqueOrThrow({
      where: { id: siteId },
      select: { lastSyncAt: true },
    }),
    coverageFor(siteId, start, end),
    coverageFor(siteId, previous.start, previous.end),
  ]);
  const metrics = aggregate(daily),
    before = aggregate(
      prior.map((r) => ({
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        position: r.position || 0,
      })),
    );
  return {
    metrics,
    previous: before,
    comparison: previous,
    changes: {
      clicks:
        coverage.complete && priorCoverage.complete
          ? changePercent(metrics.clicks, before.clicks)
          : null,
      impressions:
        coverage.complete && priorCoverage.complete
          ? changePercent(metrics.impressions, before.impressions)
          : null,
      ctr:
        coverage.complete && priorCoverage.complete && before.impressions
          ? metrics.ctr - before.ctr
          : null,
      position:
        coverage.complete && priorCoverage.complete && before.impressions
          ? metrics.position - before.position
          : null,
    },
    daily: daily.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      ctr: r.impressions ? r.clicks / r.impressions : 0,
    })),
    lastSyncAt: site.lastSyncAt,
    fullRangeSynced: coverage.complete,
    comparisonComplete: priorCoverage.complete,
    truncated: coverage.truncated,
    hasData: daily.length > 0,
  };
}
export async function table(
  input: ReportInput,
  dimension: "query" | "page",
  exportAll = false,
) {
  const { siteId, start, end } = input,
    previous = comparisonRange(start, end),
    dataset = dimension === "query" ? "QUERY_DAILY" : "PAGE_DAILY",
    column = dimension === "query" ? Prisma.sql`query` : Prisma.sql`page`;
  const sort = {
    clicks: Prisma.sql`c.clicks`,
    impressions: Prisma.sql`c.impressions`,
    ctr: Prisma.sql`c.clicks/NULLIF(c.impressions,0)`,
    position: Prisma.sql`c.position`,
    clickChange: Prisma.sql`(c.clicks-p.clicks)/NULLIF(p.clicks,0)`,
    impressionChange: Prisma.sql`(c.impressions-p.impressions)/NULLIF(p.impressions,0)`,
    positionChange: Prisma.sql`c.position-p.position`,
    label: Prisma.sql`c.label`,
  }[input.sort];
  const currentCoverage = await coverageFor(siteId, start, end),
    previousCoverage = await coverageFor(siteId, previous.start, previous.end);
  const compare = currentCoverage.complete && previousCoverage.complete;
  const cte = Prisma.sql`WITH c AS (SELECT ${column} AS label,${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, dataset, start, end)} GROUP BY ${column}),p AS (SELECT ${column} AS label,${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, dataset, previous.start, previous.end)} GROUP BY ${column})`;
  const filter = Prisma.sql`c.label IS NOT NULL AND POSITION(LOWER(${input.search}) IN LOWER(c.label))>0 AND c.impressions>=${input.minImpressions} AND c.clicks>=${input.minClicks} AND c.position BETWEEN ${input.minPosition} AND ${input.maxPosition} AND COALESCE(c.clicks/NULLIF(c.impressions,0),0) BETWEEN ${input.minCtr} AND ${input.maxCtr}`;
  const rows = await db().$queryRaw<
    (TableRow & { total: bigint })[]
  >`${cte} SELECT c.*,COALESCE(c.clicks/NULLIF(c.impressions,0),0)::float8 AS ctr,CASE WHEN p.clicks>0 THEN ((c.clicks-p.clicks)/p.clicks*100)::float8 END AS "clickChange",CASE WHEN p.impressions>0 THEN ((c.impressions-p.impressions)/p.impressions*100)::float8 END AS "impressionChange",CASE WHEN p.impressions>0 THEN (c.position-p.position)::float8 END AS "positionChange",COUNT(*) OVER() AS total FROM c LEFT JOIN p USING (label) WHERE ${filter} ORDER BY ${sort} ${input.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST,c.label ASC LIMIT ${exportAll ? 10000 : 25} OFFSET ${exportAll ? 0 : (input.page - 1) * 25}`;
  return {
    rows: rows.map(({ total, ...r }) => {
      void total;
      return compare
        ? r
        : {
            ...r,
            clickChange: null,
            impressionChange: null,
            positionChange: null,
          };
    }),
    total: Number(rows[0]?.total || 0),
    page: input.page,
    pageSize: 25,
    exportLimit: exportAll ? 10000 : undefined,
  };
}
export async function detail(
  siteId: string,
  start: string,
  end: string,
  dimension: "query" | "page",
  value: string,
) {
  const column = dimension === "query" ? Prisma.sql`query` : Prisma.sql`page`,
    other = dimension === "query" ? Prisma.sql`page` : Prisma.sql`query`,
    dataset = dimension === "query" ? "QUERY_DAILY" : "PAGE_DAILY";
  const [daily, related, target, changes] = await Promise.all([
    db().$queryRaw<
      (GroupRow & { date: Date })[]
    >`SELECT date,${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, dataset, start, end)} AND md5(${column})=md5(${value}) AND ${column}=${value} GROUP BY date ORDER BY date`,
    db().$queryRaw<
      GroupRow[]
    >`SELECT ${other} AS label,${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, "QUERY_PAGE_DAILY", start, end)} AND md5(${column})=md5(${value}) AND ${column}=${value} GROUP BY ${other} ORDER BY impressions DESC LIMIT 100`,
    db().pageTarget.findMany({
      where: {
        siteId,
        ...(dimension === "page" ? { page: value } : { targetKeyword: value }),
      },
    }),
    dimension === "page"
      ? db().seoChange.findMany({
          where: { siteId, page: value },
          orderBy: { changedAt: "desc" },
          take: 10,
        })
      : [],
  ]);
  const outcomes = await Promise.all(
    changes.map(async (change) => {
      const day = change.changedAt.toISOString().slice(0, 10);
      const beforeEnd = new Date(day);
      beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);
      const beforeStart = new Date(day);
      beforeStart.setUTCDate(beforeStart.getUTCDate() - 28);
      const afterEnd = new Date(day);
      afterEnd.setUTCDate(afterEnd.getUTCDate() + 27);
      const period = async (a: Date, b: Date) => {
        const rows = await db().$queryRaw<
          GroupRow[]
        >`SELECT ${totalsSql} FROM public."SearchMetric" WHERE ${bounds(siteId, "PAGE_DAILY", a.toISOString().slice(0, 10), b.toISOString().slice(0, 10))} AND page=${value}`;
        return aggregate(
          rows.map((r) => ({
            clicks: r.clicks || 0,
            impressions: r.impressions || 0,
            position: r.position || 0,
          })),
        );
      };
      return {
        ...change,
        before: await period(beforeStart, beforeEnd),
        after: await period(new Date(day), afterEnd),
        afterEnd: afterEnd.toISOString().slice(0, 10),
      };
    }),
  );
  return {
    daily: daily.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      ctr: r.impressions ? r.clicks / r.impressions : 0,
    })),
    related: related.map((r) => ({
      ...r,
      ctr: r.impressions ? r.clicks / r.impressions : 0,
    })),
    targets: target,
    changes: outcomes,
  };
}
export function csv(rows: TableRow[]) {
  const columns = [
    "label",
    "clicks",
    "impressions",
    "ctr",
    "position",
    "clickChange",
    "impressionChange",
    "positionChange",
  ] as const;
  const escape = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
    ].join("\r\n")
  );
}
