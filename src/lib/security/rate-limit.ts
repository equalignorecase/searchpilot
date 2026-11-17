import "server-only";
import { db } from "@/lib/db/prisma";
import { HttpError } from "./http";
export async function rateLimit(key: string, limit: number, seconds: number) {
  const now = new Date(),
    expiresAt = new Date(now.getTime() + seconds * 1000);
  const rows = await db().$queryRaw<
    { count: number }[]
  >`INSERT INTO public."RateLimit" (key,count,"expiresAt") VALUES (${key},1,${expiresAt}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN public."RateLimit"."expiresAt" < ${now} THEN 1 ELSE public."RateLimit".count+1 END, "expiresAt"=CASE WHEN public."RateLimit"."expiresAt" < ${now} THEN ${expiresAt} ELSE public."RateLimit"."expiresAt" END RETURNING count`;
  if (rows[0].count > limit)
    throw new HttpError(429, "ส่งคำขอมากเกินไป กรุณาลองอีกครั้งภายหลัง");
}
