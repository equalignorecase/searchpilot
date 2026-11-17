import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/owner-guard";
import { checkOrigin, errorResponse, readJson } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { beginOAuth } from "@/lib/google/oauth";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    checkOrigin(request);
    await rateLimit(owner.id + ":connect", 5, 60);
    const { consent } = z
      .object({ consent: z.boolean().default(false) })
      .parse(await readJson(request));
    const { state, url } = await beginOAuth(owner.id, consent);
    const response = NextResponse.json({ url });
    response.cookies.set("gsc_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/api/google/callback",
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
