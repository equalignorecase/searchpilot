import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { coverageFor } from "@/features/analytics/coverage-store";
import { HttpError } from "@/lib/security/http";
import { defaultRange, comparisonRange } from "@/features/analytics/math";
import {
  analyze,
  defaultThresholds,
  type AnalysisRow,
} from "@/lib/seo/analyzer";
export const opportunityListInput = z.object({
  siteId: z.string().min(1),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  type: z.enum(["ALL", "QUICK_WIN", "LOW_CTR", "NEAR_FIRST_PAGE", "TRAFFIC_DROP", "IMPRESSION_GROWTH", "POTENTIAL_CANNIBALIZATION", "CONTENT_DECAY"]).default("ALL"),
  status: z.enum(["ALL", "OPEN", "DISMISSED", "RESOLVED"]).default("OPEN"),
  order: z.enum(["score", "confidence"]).default("score"),
});
export async function listOpportunities(input: z.infer<typeof opportunityListInput>) {
  const where = {
    siteId: input.siteId,
    ...(input.type !== "ALL" ? { type: input.type } : {}),
    ...(input.status !== "ALL" ? { status: input.status } : {}),
  };
  const total = await db().opportunity.count({ where }),
    pageSize = 10,
    page = Math.min(input.page, Math.max(1, Math.ceil(total / pageSize))),
    rows = await db().opportunity.findMany({
      where,
      orderBy: [{ [input.order]: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  return { rows, total, page, pageSize };
}
export const thresholdsSchema = z
  .object({
    minImpressions: z.number().int().min(10).max(1000000),
    minClicks: z.number().int().min(1).max(100000),
    quickMin: z.number().min(1).max(100),
    quickMax: z.number().min(1).max(100),
    nearMin: z.number().min(1).max(100),
    nearMax: z.number().min(1).max(100),
    drop: z.number().min(0.05).max(0.95),
    growth: z.number().min(0.05).max(10),
    weakClicks: z.number().min(0).max(1),
    lowCtrRatio: z.number().min(0.05).max(0.95),
    minPeers: z.number().int().min(3).max(100),
    decay: z.number().min(0.05).max(0.95),
    overlapShare: z.number().min(0.01).max(0.5),
  })
  .refine((t) => t.quickMin <= t.quickMax && t.nearMin <= t.nearMax);
export async function analyzeSite(siteId: string) {
  const site = await db().site.findUniqueOrThrow({ where: { id: siteId } }),
    range = defaultRange(),
    previous = comparisonRange(range.start, range.end),
    older = comparisonRange(previous.start, previous.end);
  const get = async (start: string, end: string) =>
    db().$queryRaw<
      AnalysisRow[]
    >`WITH grouped AS (SELECT "datasetType",query,page,SUM(clicks)::float8 AS clicks,SUM(impressions)::float8 AS impressions,COALESCE(SUM(position*impressions)/NULLIF(SUM(impressions),0),0)::float8 AS position FROM public."SearchMetric" WHERE "siteId"=${siteId} AND "datasetType" IN ('QUERY_DAILY','PAGE_DAILY','QUERY_PAGE_DAILY') AND "searchType"='web' AND date>=${new Date(start)} AND date<=${new Date(end)} GROUP BY "datasetType",query,page), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY "datasetType" ORDER BY impressions DESC) AS rank FROM grouped) SELECT query,page,clicks,impressions,position FROM ranked WHERE rank<=5000`;

  const [coverage, previousCoverage, olderCoverage] = await Promise.all([
    coverageFor(siteId, range.start, range.end),
    coverageFor(siteId, previous.start, previous.end),
    coverageFor(siteId, older.start, older.end),
  ]);
  if (!coverage.complete)
    throw new HttpError(
      409,
      "ซิงก์ข้อมูลให้ครบ 28 วันล่าสุดที่สรุปแล้วก่อนเริ่มวิเคราะห์",
    );
  const [current, prior, old, targets] = await Promise.all([
    get(range.start, range.end),
    previousCoverage.complete ? get(previous.start, previous.end) : [],
    olderCoverage.complete ? get(older.start, older.end) : [],
    db().pageTarget.findMany({ where: { siteId } }),
  ]);
  const thresholds = thresholdsSchema.parse(
      site.ruleConfig || defaultThresholds,
    ),
    findings = analyze(
      { current, previous: prior, older: old, peers: current, targets },
      thresholds,
    );
  await db().$transaction(
    async (tx) => {
      for (let i = 0; i < findings.length; i += 500) {
        const batch = JSON.stringify(
          findings.slice(i, i + 500).map((f) => ({
            ...f,
            evidence: { ...f.evidence, start: range.start, end: range.end },
          })),
        );
        await tx.$executeRaw`INSERT INTO public."Opportunity" (id,"siteId",type,fingerprint,query,page,score,confidence,evidence,explanation,"nextAction",status,"detectedAt") SELECT md5(${siteId}||x.fingerprint),${siteId},x.type,x.fingerprint,x.query,x.page,x.score,x.confidence,x.evidence,x.explanation,x."nextAction",'OPEN',NOW() FROM jsonb_to_recordset(CAST(${batch} AS jsonb)) AS x(type text,fingerprint text,query text,page text,score int,confidence float8,evidence jsonb,explanation text,"nextAction" text) ON CONFLICT ("siteId",fingerprint) DO UPDATE SET score=EXCLUDED.score,confidence=EXCLUDED.confidence,evidence=EXCLUDED.evidence,explanation=EXCLUDED.explanation,"nextAction"=EXCLUDED."nextAction","detectedAt"=NOW(),status=CASE WHEN public."Opportunity".status='DISMISSED' THEN 'DISMISSED' ELSE 'OPEN' END`;
      }
      const fingerprints = JSON.stringify(findings.map((f) => f.fingerprint));
      await tx.$executeRaw`UPDATE public."Opportunity" SET status='RESOLVED' WHERE "siteId"=${siteId} AND status='OPEN' AND fingerprint NOT IN (SELECT jsonb_array_elements_text(CAST(${fingerprints} AS jsonb)))`;
    },
    { timeout: 60000 },
  );
  return { count: findings.length, range, relationshipLimit: 5000 };
}
