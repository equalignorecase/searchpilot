import { ZodError } from "zod";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({count: vi.fn(), findMany: vi.fn()}));
vi.mock("@/lib/db/prisma", () => ({db: () => ({opportunity: m})}));
import { opportunityListInput, listOpportunities } from "@/features/opportunities/service";
beforeEach(() => {vi.clearAllMocks(); m.count.mockResolvedValue(21); m.findMany.mockResolvedValue([{id: "last-result"}]);});
it("loads only the requested page and returns the filtered total", async () => {
  const input = opportunityListInput.parse({siteId: "site", page: "3", type: "LOW_CTR", status: "OPEN", order: "confidence"});
  expect(await listOpportunities(input)).toEqual({rows: [{id: "last-result"}], total: 21, page: 3, pageSize: 10});
  expect(m.count).toHaveBeenCalledWith({where: {siteId: "site", type: "LOW_CTR", status: "OPEN"}});
  expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({skip: 20, take: 10, orderBy: [{confidence: "desc"}, {id: "asc"}]}));
});
it("moves back to the last available page after results shrink", async () => {
  m.count.mockResolvedValue(20);
  const result = await listOpportunities(opportunityListInput.parse({siteId: "site", page: 3}));
  expect(result.page).toBe(2);
  expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({skip: 10}));
});
it("keeps an empty result set on page one", async () => {
  m.count.mockResolvedValue(0); m.findMany.mockResolvedValue([]);
  expect(await listOpportunities(opportunityListInput.parse({siteId: "site", page: 99, type: "ALL", status: "ALL"}))).toEqual({rows: [], total: 0, page: 1, pageSize: 10});
  expect(m.count).toHaveBeenCalledWith({where: {siteId: "site"}});
});
it("rejects invalid pagination and unsupported filter values", () => {
  for (const values of [{page: 0}, {page: 1.5}, {order: "query"}, {type: "invalid"}, {status: "RUNNING"}])
    expect(() => opportunityListInput.parse({siteId: "site", ...values})).toThrow(ZodError);
  expect(m.findMany).not.toHaveBeenCalled();
});
