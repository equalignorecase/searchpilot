import "server-only";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { ownerConfig, ownerLoginEmail } from "@/lib/config";
import { checkOrigin, readJson, HttpError } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
export async function loginWithUsername(request: Request) {
  checkOrigin(request);
  const owner = ownerConfig();
  await rateLimit("auth:password:" + owner.id, 20, 60);
  const input = z
    .object({
      username: z.string().trim().min(1).max(64),
      password: z.string().min(1).max(128),
    })
    .parse(await readJson(request));
  if (input.username !== owner.username)
    throw new HttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  const result = await auth().signIn.email({
    email: ownerLoginEmail(),
    password: input.password,
  });
  if (result.error || !result.data?.user || result.data.user.id !== owner.id) {
    if (result.data?.user) await auth().signOut();
    throw new HttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
}
