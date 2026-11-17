import "server-only";
import { google } from "googleapis";
import { db } from "@/lib/db/prisma";
import { googleConfig } from "@/lib/config";
import { decrypt } from "@/lib/security/encryption";
import { HttpError } from "@/lib/security/http";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export function oauthClient() {
  let c: ReturnType<typeof googleConfig>;
  try {
    c = googleConfig();
  } catch {
    throw new HttpError(
      503,
      "ยังไม่ได้ตั้งค่า Google OAuth ให้ครบ ตรวจสอบ GOOGLE_GSC_CLIENT_ID, GOOGLE_GSC_CLIENT_SECRET และ GOOGLE_GSC_REDIRECT_URI ใน .env.local แล้วรีสตาร์ตแอป",
    );
  }
  return new google.auth.OAuth2(c.clientId, c.clientSecret, c.redirectUri);
}
export async function googleClient(ownerId: string) {
  const credential = await db().googleCredential.findUnique({
    where: { ownerId },
  });
  if (!credential || credential.tokenStatus !== "ACTIVE")
    throw new HttpError(
      409,
      "เชื่อมต่อหรือเชื่อมต่อ Google Search Console ใหม่ในเมนูตั้งค่า",
    );
  const auth = oauthClient();
  auth.setCredentials({
    refresh_token: decrypt(credential.encryptedRefreshToken, ownerId),
  });
  return { auth, search: google.searchconsole({ version: "v1", auth }) };
}
export async function googleCall<T>(
  ownerId: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const e = error as {
      code?: number | string;
      response?: {
        status?: number;
        data?: { error?: string | { status?: string } };
      };
    };
    const status = e.response?.status || Number(e.code),
      detail = e.response?.data?.error;
    if (status === 401 || detail === "invalid_grant") {
      await db().googleCredential.updateMany({
        where: { ownerId },
        data: { tokenStatus: "RECONNECT_REQUIRED" },
      });
      throw new HttpError(
        409,
        "สิทธิ์ Google หมดอายุหรือถูกเพิกถอน กรุณาเชื่อมต่อใหม่ในเมนูตั้งค่า",
      );
    }
    if (status === 429 || status === 403 || status >= 500)
      throw new HttpError(
        status === 403 ? 403 : 503,
        status === 403
          ? "Google ปฏิเสธการเข้าถึงหรือโควตาหมด ตรวจสอบสิทธิ์เว็บไซต์แล้วลองใหม่"
          : "Google ไม่พร้อมใช้งานชั่วคราวหรือจำกัดคำขอ กรุณาลองภายหลัง",
      );
    throw new HttpError(
      502,
      "Google ทำรายการไม่สำเร็จ ตรวจสอบสิทธิ์และข้อมูลที่ส่ง",
    );
  }
}
