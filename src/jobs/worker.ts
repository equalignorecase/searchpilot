import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
// tsx uses the server-only react-server export condition via the worker command.
const { workOne, scheduleDaily } = await import("@/features/sync/service");
const { db } = await import("@/lib/db/prisma");
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
let lastDay = "";
while (running) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    if (lastDay !== day) {
      await scheduleDaily();
      lastDay = day;
    }
    const worked = await workOne();
    await new Promise((resolve) => setTimeout(resolve, worked ? 1100 : 10000));
  } catch {
    console.error("Worker iteration failed; retrying in 30 seconds.");
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}
await db().$disconnect();
