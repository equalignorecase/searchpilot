CREATE TABLE "public"."RecentSearchSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "data" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "retryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    CONSTRAINT "RecentSearchSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecentSearchSnapshot_siteId_day_key" ON "public"."RecentSearchSnapshot"("siteId", "day");
ALTER TABLE "public"."RecentSearchSnapshot" ADD CONSTRAINT "RecentSearchSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
