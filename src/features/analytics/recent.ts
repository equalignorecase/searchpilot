import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { googleCall, googleClient } from "@/lib/google/client";
import { pacificDate } from "@/lib/locale";
import { HttpError } from "@/lib/security/http";
import type { RecentSearchSnapshot } from "@/generated/prisma/client";

const TTL = 15 * 60 * 1000;
const hour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00(?:Z|[+-]\d{2}:\d{2})$/)
  .refine((value) => Number.isFinite(Date.parse(value)));
const upstream = z.object({
  rows: z
    .array(
      z.object({
        keys: z.tuple([hour]),
        clicks: z.number().nonnegative(),
        impressions: z.number().nonnegative(),
        ctr: z.number().min(0).max(1),
        position: z.number().nonnegative(),
      }),
    )
    .max(25)
    .nullish(),
  metadata: z
    .object({
      firstIncompleteHour: hour.nullish(),
      first_incomplete_hour: hour.nullish(),
    })
    .nullish(),
});
export function normalizeRecent(value: unknown, day: string) {
  const parsed = upstream.parse(value);
  const hours = (parsed.rows ?? [])
    .map((row) => {
      if (pacificDate(new Date(row.keys[0])) !== day)
        throw new Error("Unexpected hourly date");
      return {
        date: new Date(row.keys[0]).toISOString(),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(hours.map((row) => row.date)).size !== hours.length)
    throw new Error("Duplicate hour");
  const first =
    parsed.metadata?.firstIncompleteHour ??
    parsed.metadata?.first_incomplete_hour;
  return {
    hours,
    firstIncompleteHour: first ? new Date(first).toISOString() : null,
  };
}
type Payload = ReturnType<typeof normalizeRecent>;
export type RecentSearch = ReturnType<typeof view>;
function view(row: RecentSearchSnapshot, now: Date) {
  const payload = row.data as Payload | null;
  const hours = payload?.hours ?? [];
  const clicks = hours.reduce((n, h) => n + h.clicks, 0);
  const impressions = hours.reduce((n, h) => n + h.impressions, 0);
  const refreshing = !!row.leaseUntil && row.leaseUntil > now;
  const next = refreshing
    ? now.getTime() + 5000
    : Math.max(
        row.retryAt?.getTime() ?? 0,
        row.fetchedAt ? row.fetchedAt.getTime() + TTL : now.getTime(),
      );
  return {
    day: row.day.toISOString().slice(0, 10),
    hours,
    metrics: {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions
        ? hours.reduce((n, h) => n + h.position * h.impressions, 0) /
          impressions
        : 0,
    },
    available: payload !== null,
    hasData: hours.length > 0,
    fetchedAt: row.fetchedAt?.toISOString() ?? null,
    latestHour: hours.at(-1)?.date ?? null,
    firstIncompleteHour: payload?.firstIncompleteHour ?? null,
    stale: !row.fetchedAt || now.getTime() - row.fetchedAt.getTime() >= TTL,
    refreshing,
    warning: row.errorMessage,
    nextRefreshAt: new Date(next).toISOString(),
  };
}

// The caller must verify ownership before reading or refreshing this site's cache.
export async function recentSearch(site: {
  id: string;
  ownerId: string;
  siteUrl: string;
}) {
  const now = new Date(),
    day = new Date(pacificDate(now)),
    cache = db().recentSearchSnapshot;
  const where = { siteId_day: { siteId: site.id, day } };
  let row = await cache.findUnique({ where });
  if (!row) {
    await cache.createMany({
      data: { siteId: site.id, day },
      skipDuplicates: true,
    });
    row = await cache.findUniqueOrThrow({ where });
  }
  if (
    (row.fetchedAt && now.getTime() - row.fetchedAt.getTime() < TTL) ||
    (row.retryAt && row.retryAt > now)
  )
    return view(row, now);
  const leaseToken = randomUUID();
  const claimed = await cache.updateMany({
    where: {
      id: row.id,
      AND: [
        {
          OR: [
            { fetchedAt: null },
            { fetchedAt: { lte: new Date(now.getTime() - TTL) } },
          ],
        },
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
      ],
    },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 90000) },
  });
  if (!claimed.count)
    return view(await cache.findUniqueOrThrow({ where }), new Date());
  try {
    const { search } = await googleClient(site.ownerId);
    const response = await googleCall(site.ownerId, () =>
      search.searchanalytics.query(
        {
          siteUrl: site.siteUrl,
          requestBody: {
            startDate: pacificDate(now),
            endDate: pacificDate(now),
            dimensions: ["HOUR"],
            dataState: "HOURLY_ALL",
            type: "web",
            aggregationType: "byProperty",
            rowLimit: 25000,
          },
        },
        { timeout: 60000, retry: false },
      ),
    );
    const data = normalizeRecent(response.data, pacificDate(now));
    const fetchedAt = new Date();
    const saved = await cache.updateMany({
      where: { id: row.id, leaseToken },
      data: {
        data,
        fetchedAt,
        leaseToken: null,
        leaseUntil: null,
        retryAt: null,
        errorMessage: null,
      },
    });
    row = saved.count
      ? {
          ...row,
          data,
          fetchedAt,
          leaseToken: null,
          leaseUntil: null,
          retryAt: null,
          errorMessage: null,
        }
      : await cache.findUniqueOrThrow({ where });
  } catch (error) {
    const errorMessage =
      error instanceof HttpError
        ? error.message
        : "ดึงข้อมูลรายชั่วโมงไม่สำเร็จ ระบบจะลองใหม่ภายใน 15 นาที";
    const retryAt = new Date(Date.now() + TTL);
    const saved = await cache.updateMany({
      where: { id: row.id, leaseToken },
      data: { leaseToken: null, leaseUntil: null, retryAt, errorMessage },
    });
    row = saved.count
      ? { ...row, leaseToken: null, leaseUntil: null, retryAt, errorMessage }
      : await cache.findUniqueOrThrow({ where });
  }
  return view(row, new Date());
}
