import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import {
  addDays,
  defaultRange,
  iso,
  pacificDate,
  dateRange,
} from "@/features/analytics/math";
import {
  datasets,
  dimensions,
  initialCheckpoint,
  advance,
  normalizeRows,
  retryDelay,
} from "./protocol";
import { googleCall, googleClient } from "@/lib/google/client";
import { HttpError } from "@/lib/security/http";
import type { SyncJob } from "@/generated/prisma/client";
const checkpointSchema = z.object({
  day: z.iso.date(),
  dataset: z.number().int().min(0).max(3),
  offset: z.number().int().min(0).max(25000),
});
export async function enqueue(
  siteId: string,
  start: string,
  end: string,
  syncType = "MANUAL",
) {
  try {
    dateRange(start, end);
  } catch {
    throw new HttpError(400, "เลือกช่วงวันที่ที่ถูกต้องและไม่เกิน 500 วัน");
  }
  if (end > addDays(pacificDate(), -3))
    throw new HttpError(
      400,
      "เลือกวันสิ้นสุดอย่างน้อย 3 วันก่อนตามเวลาแปซิฟิก เพื่อซิงก์เฉพาะข้อมูลที่สรุปแล้ว",
    );
  if (start < addDays(pacificDate(), -480))
    throw new HttpError(
      400,
      "เลือกวันเริ่มต้นภายในระยะเวลาเก็บข้อมูลของ Search Console (ประมาณ 16 เดือน)",
    );
  try {
    return await db().syncJob.create({
      data: {
        siteId,
        startDate: new Date(start),
        endDate: new Date(end),
        syncType,
        checkpoint: initialCheckpoint(start),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new HttpError(
        409,
        "เว็บไซต์นี้มีงานซิงก์ที่กำลังดำเนินการอยู่แล้ว",
      );
    throw e;
  }
}
export async function retryJob(id: string, siteId: string) {
  const job = await db().syncJob.findFirst({
    where: { id, siteId, status: "FAILED" },
  });
  if (!job) throw new HttpError(404, "ไม่พบงานที่ล้มเหลว");
  try {
    return await db().syncJob.update({
      where: { id },
      data: {
        status: "QUEUED",
        attempts: 0,
        availableAt: new Date(),
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        leaseToken: null,
        leaseUntil: null,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new HttpError(409, "มีงานซิงก์ที่กำลังดำเนินการอยู่แล้ว");
    throw e;
  }
}
export async function claimJob() {
  const token = randomUUID();
  const jobs = await db().$queryRaw<
    SyncJob[]
  >`UPDATE public."SyncJob" SET status='RUNNING', "leaseToken"=${token}, "leaseUntil"=NOW()+INTERVAL '3 minutes', "startedAt"=COALESCE("startedAt",NOW()) WHERE id=(SELECT id FROM public."SyncJob" WHERE ((status IN ('QUEUED','RETRY') AND "availableAt"<=NOW()) OR (status='RUNNING' AND "leaseUntil"<NOW())) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
  return jobs[0] || null;
}
export async function workOne() {
  const job = await claimJob();
  if (!job) return false;
  try {
    const c = checkpointSchema.parse(job.checkpoint),
      dataset = datasets[c.dataset];
    const site = await db().site.findUniqueOrThrow({
        where: { id: job.siteId },
      }),
      { search } = await googleClient(site.ownerId);
    const result = await googleCall(site.ownerId, () =>
      search.searchanalytics.query(
        {
          siteUrl: site.siteUrl,
          requestBody: {
            startDate: c.day,
            endDate: c.day,
            type: "web",
            dataState: "final",
            dimensions: dimensions[dataset],
            aggregationType:
              dataset === "SITE_DAILY" || dataset === "QUERY_DAILY"
                ? "byProperty"
                : "byPage",
            rowLimit: 25000,
            startRow: c.offset,
          },
        },
        { timeout: 60000, retry: false },
      ),
    );
    const rows = normalizeRows(dataset, result.data.rows || []),
      progress = advance(c, rows.length, iso(job.endDate));
    await db().$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          { leaseToken: string | null; status: string }[]
        >`SELECT "leaseToken",status FROM public."SyncJob" WHERE id=${job.id} FOR UPDATE`;
        if (
          locked[0]?.leaseToken !== job.leaseToken ||
          locked[0]?.status !== "RUNNING"
        )
          return;
        if (c.offset === 0)
          await tx.metricStage.deleteMany({ where: { jobId: job.id } });
        for (let i = 0; i < rows.length; i += 1000)
          await tx.metricStage.createMany({
            data: rows.slice(i, i + 1000).map((r) => ({ ...r, jobId: job.id })),
            skipDuplicates: true,
          });
        if (progress.commit) {
          await tx.searchMetric.deleteMany({
            where: {
              siteId: site.id,
              date: new Date(c.day),
              datasetType: dataset,
              searchType: "web",
            },
          });
          await tx.$executeRaw`INSERT INTO public."SearchMetric" (id,"siteId",date,"datasetType","searchType","dimensionKey",query,page,clicks,impressions,ctr,position,"syncedAt") SELECT md5(${site.id}||${c.day}||${dataset}||"dimensionKey"),${site.id},${new Date(c.day)},CAST(${dataset} AS public."DatasetType"),'web',"dimensionKey",query,page,clicks,impressions,ctr,position,NOW() FROM public."MetricStage" WHERE "jobId"=${job.id}`;
          await tx.metricStage.deleteMany({ where: { jobId: job.id } });
        }
        await tx.syncJob.update({
          where: { id: job.id },
          data: {
            checkpoint: progress.next,
            status: progress.done ? "SUCCEEDED" : "QUEUED",
            attempts: 0,
            leaseUntil: null,
            leaseToken: null,
            availableAt: new Date(Date.now() + 1000),
            truncated: job.truncated || progress.truncated,
            finishedAt: progress.done ? new Date() : null,
            errorCode: null,
            errorMessage: null,
          },
        });
        if (progress.done)
          await tx.site.update({
            where: { id: site.id },
            data: { lastSyncAt: new Date() },
          });
      },
      { timeout: 60000 },
    );
  } catch (error) {
    const attempts = job.attempts + 1,
      terminal =
        attempts >= 6 || (error instanceof HttpError && error.status === 409);
    await db().syncJob.updateMany({
      where: { id: job.id, leaseToken: job.leaseToken, status: "RUNNING" },
      data: {
        status: terminal ? "FAILED" : "RETRY",
        attempts,
        leaseUntil: null,
        leaseToken: null,
        availableAt: new Date(Date.now() + retryDelay(attempts)),
        finishedAt: terminal ? new Date() : null,
        errorCode:
          error instanceof HttpError ? String(error.status) : "SYNC_ERROR",
        errorMessage:
          error instanceof HttpError
            ? error.message
            : "ซิงก์ไม่สำเร็จ ตรวจสอบการเชื่อมต่อและการตั้งค่า แล้วลองใหม่",
      },
    });
  }
  return true;
}
export async function scheduleDaily() {
  const { start, end } = defaultRange(7),
    sites = await db().site.findMany({
      where: {
        ownerId: {
          in: (
            await db().googleCredential.findMany({
              where: { tokenStatus: "ACTIVE" },
              select: { ownerId: true },
            })
          ).map((c) => c.ownerId),
        },
      },
    });
  let count = 0;
  for (const site of sites) {
    const already = await db().syncJob.findFirst({
      where: {
        siteId: site.id,
        syncType: "DAILY",
        endDate: new Date(end),
        status: { not: "FAILED" },
      },
    });
    if (already) continue;
    try {
      await enqueue(site.id, start, end, "DAILY");
      count++;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 409)) throw error;
    }
  }
  await db().rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db().oAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
