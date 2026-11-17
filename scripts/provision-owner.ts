import { config } from "dotenv";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  lstatSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { OwnerProvisionError, provisionOwner } from "@/features/auth/provision-owner";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
const file = ".env.local",
  temporary = file + "." + randomUUID() + ".tmp";
try {
  if (process.stdin.isTTY)
    throw new Error("Use npm run auth:owner for hidden password entry");
  try {
    if (lstatSync(file).isSymbolicLink())
      throw new Error("Symlink not allowed");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const password = readFileSync(0, "utf8");
  const id = await provisionOwner(password);
  let previous = "";
  try {
    previous = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const updated =
    previous
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("OWNER_NEON_USER_ID="))
      .join("\n")
      .trimEnd() +
    "\nOWNER_NEON_USER_ID=" +
    JSON.stringify(id) +
    "\n";
  writeFileSync(temporary, updated, { mode: 0o600, flag: "wx" });
  renameSync(temporary, file);
  console.log(
    "Owner account verified and pinned in .env.local. Password was not stored locally.",
  );
} catch (error) {
  if (error instanceof OwnerProvisionError) console.error(error.message);
  console.error(
    "Owner provisioning failed. Existing owner configuration was not replaced.",
  );
  process.exitCode = 1;
} finally {
  rmSync(temporary, { force: true });
}
