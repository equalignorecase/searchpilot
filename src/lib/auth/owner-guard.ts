import "server-only";
import { auth } from "./server";
import { isOwner } from "./identity";
import { HttpError } from "@/lib/security/http";
import { db } from "@/lib/db/prisma";
export async function requireOwner() {
  const { data, error } = await auth().getSession();
  if (
    error ||
    !data?.user ||
    !data.session ||
    !(new Date(data.session.expiresAt).getTime() > Date.now())
  )
    throw new HttpError(401, "กรุณาเข้าสู่ระบบเพื่อใช้งานต่อ");
  if (
    !isOwner(data.user, {
      neonUserId: process.env.OWNER_NEON_USER_ID,
    })
  )
    throw new HttpError(403, "บัญชีนี้ไม่ใช่เจ้าของที่ได้รับอนุญาต");
  return data.user;
}
export async function requireSite(ownerId: string, id: string) {
  const site = await db().site.findFirst({ where: { id, ownerId } });
  if (!site) throw new HttpError(404, "ไม่พบเว็บไซต์นี้");
  return site;
}
