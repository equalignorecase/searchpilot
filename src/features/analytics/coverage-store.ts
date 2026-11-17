import "server-only";
import { db } from "@/lib/db/prisma";
import { iso } from "./math";
import { coversRange } from "./coverage";
export async function coverageFor(siteId: string, start: string, end: string) {
  const jobs = await db().syncJob.findMany({
    where: {
      siteId,
      status: "SUCCEEDED",
      startDate: { lte: new Date(end) },
      endDate: { gte: new Date(start) },
    },
    select: { startDate: true, endDate: true, truncated: true },
  });
  return {
    complete: coversRange(
      start,
      end,
      jobs.map((j) => ({ start: iso(j.startDate), end: iso(j.endDate) })),
    ),
    truncated: jobs.some((j) => j.truncated),
  };
}
