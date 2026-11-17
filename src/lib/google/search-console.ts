import "server-only";
import { db } from "@/lib/db/prisma";
import { googleCall, googleClient } from "./client";
export async function discoverSites(ownerId: string) {
  const { search } = await googleClient(ownerId);
  const response = await googleCall(ownerId, () =>
    search.sites.list({}, { timeout: 60000 }),
  );
  const entries = response.data.siteEntry || [];
  for (const entry of entries) {
    if (!entry.siteUrl) continue;
    const isDomain = entry.siteUrl.startsWith("sc-domain:");
    await db().site.upsert({
      where: { ownerId_siteUrl: { ownerId, siteUrl: entry.siteUrl } },
      create: {
        ownerId,
        siteUrl: entry.siteUrl,
        displayName: isDomain ? entry.siteUrl.slice(10) : entry.siteUrl,
        permission: entry.permissionLevel || "unknown",
        propertyType: isDomain ? "DOMAIN" : "URL_PREFIX",
      },
      update: { permission: entry.permissionLevel || "unknown" },
    });
  }
  return db().site.findMany({
    where: { ownerId },
    orderBy: [{ isDefault: "desc" }, { displayName: "asc" }],
  });
}
