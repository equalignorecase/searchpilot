import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/prisma";
import { requireOwner, requireSite } from "@/lib/auth/owner-guard";
import { checkOrigin, readJson, HttpError, json } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  id,
  siteBody,
  taskBody,
  targetBody,
  changeBody,
  url as urlSchema,
} from "@/lib/validation";
import {
  reportInput,
  summary,
  table,
  detail,
  csv,
} from "@/features/analytics/service";
import { defaultRange, dimensionKey } from "@/features/analytics/math";
import { discoverSites } from "@/lib/google/search-console";
import { disconnect } from "@/lib/google/oauth";
import { googleClient, googleCall } from "@/lib/google/client";
import { enqueue, retryJob } from "@/features/sync/service";
import {
  analyzeSite,
  thresholdsSchema,
  opportunityListInput,
  listOpportunities,
} from "@/features/opportunities/service";
import { recentSearch } from "@/features/analytics/recent";
import { defaultThresholds } from "@/lib/seo/analyzer";

export async function handleApi(request: Request, path: string[]) {
  const owner = await requireOwner(),
    route = path.join("/"),
    method = request.method,
    u = new URL(request.url);
  if (method !== "GET") checkOrigin(request);
  if (method === "GET" && route === "sites")
    return json(
      await db().site.findMany({
        where: { ownerId: owner.id },
        orderBy: [{ isDefault: "desc" }, { displayName: "asc" }],
      }),
    );
  if (method === "POST" && route === "sites/discover") {
    await rateLimit(owner.id + ":discover", 5, 60);
    return json(await discoverSites(owner.id));
  }
  if (method === "POST" && route === "google/disconnect") {
    await rateLimit(owner.id + ":disconnect", 3, 60);
    await disconnect(owner.id);
    return json({ ok: true });
  }
  if (method === "GET" && route === "settings") {
    const credential = await db().googleCredential.findUnique({
      where: { ownerId: owner.id },
      select: { tokenStatus: true, grantedScopes: true, updatedAt: true },
    });
    return json({
      credential,
      ownerUsername: process.env.APP_USERNAME,
      defaultThresholds,
    });
  }
  if (method === "GET" && route === "analytics/recent") {
    const siteId = id.parse(u.searchParams.get("siteId"));
    const site = await requireSite(owner.id, siteId);
    return json(await recentSearch(site));
  }
  if (method === "GET") {
    if (route === "opportunities") {
      const input = opportunityListInput.parse(Object.fromEntries(u.searchParams));
      await requireSite(owner.id, input.siteId);
      return json(await listOpportunities(input));
    }
    const input = reportInput.parse(Object.fromEntries(u.searchParams));
    await requireSite(owner.id, input.siteId);
    if (route === "analytics")
      return json(await summary(input.siteId, input.start, input.end));
    if (route === "keywords" || route === "pages") {
      const exportAll = u.searchParams.get("format") === "csv";
      if (exportAll) await rateLimit(owner.id + ":export", 5, 60);
      const result = await table(
        input,
        route === "keywords" ? "query" : "page",
        exportAll,
      );
      if (exportAll)
        return new Response(csv(result.rows), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="searchpilot-${route}.csv"`,
            "Cache-Control": "no-store",
            "X-Export-Limit": "10000",
          },
        });
      return json(result);
    }
    if (route === "history") {
      const dimension = z
          .enum(["query", "page"])
          .parse(u.searchParams.get("dimension")),
        value = z.string().min(1).max(8192).parse(u.searchParams.get("value"));
      return json(
        await detail(input.siteId, input.start, input.end, dimension, value),
      );
    }
    if (route === "tasks")
      return json(
        await db().seoTask.findMany({
          where: { siteId: input.siteId },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
      );
    if (route === "sync")
      return json(
        await db().syncJob.findMany({
          where: { siteId: input.siteId },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (route === "inspections")
      return json(
        await db().urlInspection.findMany({
          where: { siteId: input.siteId },
          orderBy: { inspectedAt: "desc" },
          take: 50,
        }),
      );
    if (route === "targets")
      return json(
        await db().pageTarget.findMany({
          where: { siteId: input.siteId },
          orderBy: { page: "asc" },
        }),
      );
    if (route === "rules")
      return json(
        (await requireSite(owner.id, input.siteId)).ruleConfig ||
          defaultThresholds,
      );
  }
  const body = await readJson(request),
    { siteId } = siteBody.parse(body),
    site = await requireSite(owner.id, siteId);
  if (method === "POST" && route === "sites/default") {
    await db().$transaction([
      db().site.updateMany({
        where: { ownerId: owner.id },
        data: { isDefault: false },
      }),
      db().site.update({ where: { id: siteId }, data: { isDefault: true } }),
    ]);
    return json({ ok: true });
  }
  if (method === "POST" && route === "sync") {
    await rateLimit(owner.id + ":sync", 5, 60);
    const b = siteBody
      .extend({
        start: z.iso.date().default(() => defaultRange(90).start),
        end: z.iso.date().default(() => defaultRange(90).end),
      })
      .parse(body);
    return json(await enqueue(siteId, b.start, b.end), 201);
  }
  if (method === "POST" && route === "sync/retry") {
    await rateLimit(owner.id + ":retry", 5, 60);
    return json(await retryJob(z.object({ id }).parse(body).id, siteId));
  }
  if (method === "POST" && route === "opportunities/analyze") {
    await rateLimit(owner.id + ":analyze", 3, 60);
    return json(await analyzeSite(siteId));
  }
  if (method === "PATCH" && route === "opportunities") {
    const b = z
      .object({ id, status: z.enum(["OPEN", "DISMISSED"]) })
      .parse(body);
    const result = await db().opportunity.updateMany({
      where: { id: b.id, siteId },
      data: { status: b.status },
    });
    if (!result.count) throw new HttpError(404, "ไม่พบโอกาสปรับปรุงนี้");
    return json({ ok: true });
  }
  if (route === "tasks") {
    if (method === "POST") {
      const b = taskBody.parse(body);
      if (
        b.opportunityId &&
        !(await db().opportunity.findFirst({
          where: { id: b.opportunityId, siteId },
        }))
      )
        throw new HttpError(404, "ไม่พบโอกาสปรับปรุงนี้");
      return json(
        await db().seoTask.create({
          data: { ...b, completedAt: b.status === "DONE" ? new Date() : null },
        }),
        201,
      );
    }
    const taskId = z.object({ id }).parse(body).id;
    if (method === "DELETE") {
      const r = await db().seoTask.deleteMany({
        where: { id: taskId, siteId },
      });
      if (!r.count) throw new HttpError(404, "ไม่พบงานนี้");
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const b = taskBody
        .omit({ siteId: true, opportunityId: true })
        .partial()
        .parse(body);
      const result = await db().seoTask.updateMany({
        where: { id: taskId, siteId },
        data: {
          ...b,
          ...(b.status
            ? { completedAt: b.status === "DONE" ? new Date() : null }
            : {}),
        },
      });
      if (!result.count) throw new HttpError(404, "ไม่พบงานนี้");
      return json({ ok: true });
    }
  }
  if (method === "POST" && route === "targets") {
    const b = targetBody.parse(body),
      pageKey = dimensionKey([b.page]);
    return json(
      await db().$transaction(async (tx) => {
        if (b.targetKeyword)
          await tx.pageTarget.updateMany({
            where: {
              siteId,
              targetKeyword: b.targetKeyword,
              pageKey: { not: pageKey },
            },
            data: { targetKeyword: null },
          });
        return tx.pageTarget.upsert({
          where: { siteId_pageKey: { siteId, pageKey } },
          create: { ...b, pageKey },
          update: {
            pageType: b.pageType,
            targetKeyword: b.targetKeyword,
            notes: b.notes,
          },
        });
      }),
    );
  }

  if (method === "POST" && route === "changes") {
    const b = changeBody.parse(body);
    return json(
      await db().seoChange.create({
        data: { ...b, changedAt: new Date(b.changedAt) },
      }),
      201,
    );
  }
  if (method === "POST" && route === "rules") {
    const b = siteBody.extend({ thresholds: thresholdsSchema }).parse(body);
    await db().site.update({
      where: { id: siteId },
      data: { ruleConfig: b.thresholds },
    });
    return json({ ok: true });
  }
  if (method === "POST" && route === "inspections") {
    const page = z.object({ page: urlSchema }).parse(body).page;
    const target = new URL(page);
    if (site.propertyType === "DOMAIN") {
      const domain = site.siteUrl.slice(10).toLowerCase();
      if (target.hostname !== domain && !target.hostname.endsWith("." + domain))
        throw new HttpError(400, "URL ต้องอยู่ภายใต้โดเมนของเว็บไซต์นี้");
    } else if (!page.startsWith(site.siteUrl))
      throw new HttpError(400, "URL ต้องขึ้นต้นตรงกับ URL ของเว็บไซต์ที่เลือก");
    await rateLimit(owner.id + ":inspect", 10, 60);
    await rateLimit(siteId + ":inspect-day", 1900, 86400);
    const { search } = await googleClient(owner.id);
    const result = await googleCall(owner.id, () =>
      search.urlInspection.index.inspect(
        {
          requestBody: {
            inspectionUrl: page,
            siteUrl: site.siteUrl,
            languageCode: "en-US",
          },
        },
        { timeout: 60000 },
      ),
    );
    const raw = result.data.inspectionResult || {};
    return json(
      await db().urlInspection.create({
        data: {
          siteId,
          page,
          verdict: raw.indexStatusResult?.verdict,
          coverage: raw.indexStatusResult?.coverageState,
          rawResult: JSON.parse(JSON.stringify(raw)),
        },
      }),
      201,
    );
  }
  throw new HttpError(404, "ไม่พบรายการที่ร้องขอ");
}
