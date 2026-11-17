import { z } from "zod";
export const id = z.string().min(1).max(200);
export const url = z
  .url()
  .max(8192)
  .refine(
    (u) => ["https:", "http:"].includes(new URL(u).protocol),
    "Use an HTTP URL",
  );
export const siteBody = z.object({ siteId: id });
export const taskBody = siteBody.extend({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).default(""),
  page: url.nullable().optional(),
  query: z.string().max(2048).nullable().optional(),
  opportunityId: id.nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "DISMISSED"]).default("TODO"),
});
export const targetBody = siteBody.extend({
  page: url,
  pageType: z.enum(["Product", "Category", "Blog", "Landing Page", "Other"]),
  targetKeyword: z.string().trim().max(2048).nullable(),
  notes: z.string().max(10000).default(""),
});
export const changeBody = siteBody.extend({
  page: url,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  changedAt: z.iso.date(),
});
