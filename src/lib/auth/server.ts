import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { authConfig } from "@/lib/config";
export function auth() {
  const c = authConfig();
  return createNeonAuth({
    baseUrl: c.baseUrl,
    cookies: { secret: c.cookieSecret },
    logLevel: "silent",
  });
}
