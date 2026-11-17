import "server-only";
import { z } from "zod";
const nonempty = z.string().min(1);
export function databaseUrl() {
  return z.url().parse(process.env.DATABASE_URL);
}
export function authConfig() {
  return z
    .object({
      baseUrl: z.url(),
      cookieSecret: z.string().min(32),
    })
    .parse({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    });
}
export function ownerConfig() {
  return z
    .object({
      username: z.string().trim().min(1).max(64),
      id: z.string().min(1).max(200),
    })
    .parse({
      username: process.env.APP_USERNAME,
      id: process.env.OWNER_NEON_USER_ID,
    });
}
export function ownerLoginEmail() {
  return z
    .email()
    .parse(
      process.env.OWNER_AUTH_EMAIL ||
        process.env.OWNER_GOOGLE_EMAIL ||
        "owner@searchpilot.invalid",
    );
}
export function googleConfig() {
  return z
    .object({
      clientId: nonempty,
      clientSecret: nonempty,
      redirectUri: z.url(),
    })
    .parse({
      clientId: process.env.GOOGLE_GSC_CLIENT_ID,
      clientSecret: process.env.GOOGLE_GSC_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_GSC_REDIRECT_URI,
    });
}
export function appOrigin() {
  return new URL(z.url().parse(process.env.NEXT_PUBLIC_APP_URL)).origin;
}
export function isConfigured() {
  return !!(
    process.env.DATABASE_URL &&
    process.env.NEON_AUTH_BASE_URL &&
    process.env.NEON_AUTH_COOKIE_SECRET &&
    process.env.APP_USERNAME &&
    process.env.OWNER_NEON_USER_ID
  );
}
