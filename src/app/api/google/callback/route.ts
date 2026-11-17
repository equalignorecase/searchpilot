import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/owner-guard";
import { exchangeOAuth } from "@/lib/google/oauth";
import { appOrigin } from "@/lib/config";
import { z } from "zod";
export async function GET(request: Request) {
  let ok = false;
  try {
    const owner = await requireOwner(),
      u = new URL(request.url);
    const input = z
      .object({
        state: z.string().min(20).max(200),
        code: z.string().min(1).max(4096),
      })
      .parse(Object.fromEntries(u.searchParams));
    await exchangeOAuth(
      owner.id,
      input.state,
      (await cookies()).get("gsc_state")?.value,
      input.code,
    );
    ok = true;
  } catch {
    /* Never echo provider errors or authorization codes. */
  }
  const response = NextResponse.redirect(
    new URL(
      "/settings?connection=" + (ok ? "connected" : "failed"),
      appOrigin(),
    ),
  );
  response.cookies.set("gsc_state", "", {
    maxAge: 0,
    path: "/api/google/callback",
  });
  return response;
}
