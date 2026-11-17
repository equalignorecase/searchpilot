import { timingSafeEqual } from "node:crypto";
import { scheduleDaily, workOne } from "@/features/sync/service";
import { errorResponse, json } from "@/lib/security/http";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    actual = request.headers.get("authorization") || "";
  if (
    !expected ||
    expected.length < 32 ||
    Buffer.byteLength(actual) !== Buffer.byteLength("Bearer " + expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from("Bearer " + expected))
  )
    return json({ error: "Unauthorized" }, 401);
  try {
    return json({ scheduled: await scheduleDaily(), worked: await workOne() });
  } catch (error) {
    return errorResponse(error);
  }
}
