import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { databaseUrl } from "@/lib/config";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function db() {
  return (globalDb.prisma ??= new PrismaClient({
    adapter: new PrismaNeon(
      { connectionString: databaseUrl(), connectionTimeoutMillis: 10000 },
      { schema: "public" },
    ),
  }));
}
