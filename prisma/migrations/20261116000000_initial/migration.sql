-- Application objects must never resolve into the Neon-managed auth schema.
SET search_path TO public;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DatasetType" AS ENUM ('SITE_DAILY', 'QUERY_DAILY', 'PAGE_DAILY', 'QUERY_PAGE_DAILY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "GoogleCredential" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "googleAccountId" TEXT,
    "encryptedRefreshToken" TEXT NOT NULL,
    "grantedScopes" TEXT[],
    "tokenStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ruleConfig" JSONB,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchMetric" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "datasetType" "DatasetType" NOT NULL,
    "searchType" TEXT NOT NULL DEFAULT 'web',
    "dimensionKey" TEXT NOT NULL,
    "query" TEXT,
    "page" TEXT,
    "clicks" DOUBLE PRECISION NOT NULL,
    "impressions" DOUBLE PRECISION NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "truncated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricStage" (
    "jobId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "query" TEXT,
    "page" TEXT,
    "clicks" DOUBLE PRECISION NOT NULL,
    "impressions" DOUBLE PRECISION NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MetricStage_pkey" PRIMARY KEY ("jobId","dimensionKey")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "query" TEXT,
    "page" TEXT,
    "score" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoTask" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "page" TEXT,
    "query" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageTarget" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'Other',
    "targetKeyword" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PageTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoChange" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlInspection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "verdict" TEXT,
    "coverage" TEXT,
    "rawResult" JSONB NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "hash" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCredential_ownerId_key" ON "GoogleCredential"("ownerId");

-- CreateIndex
CREATE INDEX "Site_ownerId_isDefault_idx" ON "Site"("ownerId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Site_ownerId_siteUrl_key" ON "Site"("ownerId", "siteUrl");

-- CreateIndex
CREATE INDEX "SearchMetric_siteId_datasetType_date_idx" ON "SearchMetric"("siteId", "datasetType", "date");

-- CreateIndex
CREATE INDEX "SearchMetric_site_query_hash" ON public."SearchMetric"("siteId", md5(query));

-- CreateIndex
CREATE INDEX "SearchMetric_site_page_hash" ON public."SearchMetric"("siteId", md5(page));

-- CreateIndex
CREATE UNIQUE INDEX "SearchMetric_siteId_date_datasetType_searchType_dimensionKe_key" ON "SearchMetric"("siteId", "date", "datasetType", "searchType", "dimensionKey");

-- CreateIndex
CREATE INDEX "SyncJob_status_availableAt_leaseUntil_idx" ON "SyncJob"("status", "availableAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "SyncJob_siteId_createdAt_idx" ON "SyncJob"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_siteId_status_score_idx" ON "Opportunity"("siteId", "status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_siteId_fingerprint_key" ON "Opportunity"("siteId", "fingerprint");

-- CreateIndex
CREATE INDEX "SeoTask_siteId_status_priority_idx" ON "SeoTask"("siteId", "status", "priority");

-- CreateIndex


-- CreateIndex
CREATE UNIQUE INDEX "PageTarget_siteId_pageKey_key" ON "PageTarget"("siteId", "pageKey");

-- CreateIndex
CREATE INDEX "SeoChange_siteId_changedAt_idx" ON "SeoChange"("siteId", "changedAt");

-- CreateIndex
CREATE INDEX "UrlInspection_siteId_inspectedAt_idx" ON "UrlInspection"("siteId", "inspectedAt");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "SearchMetric" ADD CONSTRAINT "SearchMetric_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricStage" ADD CONSTRAINT "MetricStage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTask" ADD CONSTRAINT "SeoTask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoTask" ADD CONSTRAINT "SeoTask_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageTarget" ADD CONSTRAINT "PageTarget_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoChange" ADD CONSTRAINT "SeoChange_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlInspection" ADD CONSTRAINT "UrlInspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One active job per property prevents overlapping daily snapshots.
CREATE UNIQUE INDEX "SyncJob_one_active_per_site" ON public."SyncJob" ("siteId") WHERE status IN ('QUEUED','RUNNING','RETRY');
CREATE UNIQUE INDEX "SyncJob_daily_window" ON public."SyncJob" ("siteId","endDate") WHERE "syncType"='DAILY' AND status <> 'FAILED';
CREATE UNIQUE INDEX "Site_one_default_per_owner" ON public."Site" ("ownerId") WHERE "isDefault"=true;
ALTER TABLE public."SearchMetric" ADD CONSTRAINT "SearchMetric_nonnegative" CHECK (clicks>=0 AND impressions>=0 AND position>=0 AND ctr>=0 AND ctr<=1);
ALTER TABLE public."MetricStage" ADD CONSTRAINT "MetricStage_nonnegative" CHECK (clicks>=0 AND impressions>=0 AND position>=0 AND ctr>=0 AND ctr<=1);
ALTER TABLE public."Opportunity" ADD CONSTRAINT "Opportunity_score_bounds" CHECK (score BETWEEN 0 AND 100 AND confidence BETWEEN 0 AND 1);

CREATE UNIQUE INDEX "PageTarget_site_keyword_hash" ON public."PageTarget" ("siteId",md5("targetKeyword")) WHERE "targetKeyword" IS NOT NULL;
