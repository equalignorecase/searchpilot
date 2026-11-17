import { config } from "dotenv";
import { z } from "zod";
import {
  databaseUrl,
  authConfig,
  googleConfig,
  appOrigin,
  ownerConfig,
} from "@/lib/config";
import { encrypt } from "@/lib/security/encryption";
import { db } from "@/lib/db/prisma";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
let authUrl: string, origin: string;
try {
  databaseUrl();
  ownerConfig();
  z.url().parse(process.env.DATABASE_URL_UNPOOLED);
  authUrl = authConfig().baseUrl;
  googleConfig();
  origin = appOrigin();
  if (!["http:", "https:"].includes(new URL(origin).protocol))
    throw new Error("Invalid web origin");
  z.string().min(32).parse(process.env.CRON_SECRET);
  encrypt("configuration-check", "setup");
  console.log("Configuration values are present and structurally valid.");
} catch {
  console.error(
    "Missing or invalid configuration. Complete .env.local using .env.example; secret values are never printed.",
  );
  process.exit(1);
}
let database: ReturnType<typeof db> | undefined;
try {
  database = db();
  await database.$queryRaw`SELECT 1`;
  const rows = await database.$queryRaw<
    { count: number }[]
  >`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('GoogleCredential','Site','SearchMetric','SyncJob','Opportunity','SeoTask','PageTarget','SeoChange','UrlInspection','RecentSearchSnapshot')`;
  if (rows[0]?.count !== 10) {
    console.error(
      "Database is reachable, but application tables are missing. Run npm run db:migrate on the intended development branch.",
    );
    process.exitCode = 1;
  } else
    console.log(
      "Neon database is reachable and all ten business tables exist.",
    );
  const response = await fetch(authUrl.replace(/\/$/, "") + "/get-session", {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Auth endpoint rejected the request");
  const payload: unknown = await response.json();
  if (
    payload !== null &&
    !(
      typeof payload === "object" &&
      ("user" in payload || "session" in payload)
    )
  )
    throw new Error("Unexpected Auth endpoint");
  console.log(
    "Neon Auth endpoint is reachable. Username/password sign-in and GSC consent still require a browser verification.",
  );
} catch {
  console.error(
    "Connection check failed. Verify the Neon branch URLs, database migrations, network access and trusted application origin.",
  );
  process.exitCode = 1;
} finally {
  await database?.$disconnect().catch(() => {});
}
