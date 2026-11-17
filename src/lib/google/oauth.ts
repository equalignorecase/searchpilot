import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { db } from "@/lib/db/prisma";
import { oauthClient, GSC_SCOPE } from "./client";
import { encrypt, decrypt } from "@/lib/security/encryption";
import { selectRefreshToken } from "./tokens";
import { HttpError } from "@/lib/security/http";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function beginOAuth(ownerId: string, consent = false) {
  const auth = oauthClient(),
    state = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } =
    await auth.generateCodeVerifierAsync();
  await db().oAuthState.deleteMany({
    where: { OR: [{ ownerId }, { expiresAt: { lt: new Date() } }] },
  });
  await db().oAuthState.create({
    data: {
      hash: hash(state),
      ownerId,
      verifier: encrypt(codeVerifier, ownerId),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  const existing = await db().googleCredential.findUnique({
    where: { ownerId },
    select: { id: true },
  });
  const url = auth.generateAuthUrl({
    access_type: "offline",
    scope: [GSC_SCOPE],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    ...(!existing || consent ? { prompt: "consent" } : {}),
  });
  return { state, url };
}
export async function exchangeOAuth(
  ownerId: string,
  state: string,
  cookieState: string | undefined,
  code: string,
) {
  if (!cookieState || hash(state) !== hash(cookieState))
    throw new HttpError(400, "ข้อมูลยืนยันคำขอ OAuth ไม่ตรงกัน กรุณาเริ่มเชื่อมต่อใหม่");
  const rows = await db().$queryRaw<
    { verifier: string }[]
  >`DELETE FROM public."OAuthState" WHERE hash=${hash(state)} AND "ownerId"=${ownerId} AND "expiresAt">NOW() RETURNING verifier`;
  if (!rows.length)
    throw new HttpError(400, "คำขอ OAuth หมดอายุหรือถูกใช้แล้ว กรุณาเริ่มเชื่อมต่อใหม่");
  const auth = oauthClient();
  const { tokens } = await auth.getToken({
    code,
    codeVerifier: decrypt(rows[0].verifier, ownerId),
  });
  if (!tokens.access_token)
    throw new HttpError(400, "Google ไม่ได้ส่งโทเคนสำหรับเข้าถึงข้อมูลกลับมา");
  const info = await auth.getTokenInfo(tokens.access_token);
  if (!info.scopes.includes(GSC_SCOPE))
    throw new HttpError(
      400,
      "ต้องอนุญาตสิทธิ์อ่านข้อมูล Search Console",
    );
  const previous = await db().googleCredential.findUnique({
    where: { ownerId },
  });
  const subject = info.sub || null;
  const token = selectRefreshToken(
    tokens.refresh_token,
    previous
      ? {
          token: decrypt(previous.encryptedRefreshToken, ownerId),
          subject: previous.googleAccountId,
        }
      : null,
    subject,
  );
  await db().googleCredential.upsert({
    where: { ownerId },
    create: {
      ownerId,
      googleAccountId: subject,
      encryptedRefreshToken: encrypt(token, ownerId),
      grantedScopes: info.scopes,
    },
    update: {
      googleAccountId: subject,
      encryptedRefreshToken: encrypt(token, ownerId),
      grantedScopes: info.scopes,
      tokenStatus: "ACTIVE",
    },
  });
}
export async function disconnect(ownerId: string) {
  const credential = await db().googleCredential.findUnique({
    where: { ownerId },
  });
  if (!credential) return;
  try {
    await oauthClient().revokeToken(
      decrypt(credential.encryptedRefreshToken, ownerId),
    );
  } catch (error) {
    const response = (
      error as { response?: { status?: number; data?: { error?: string } } }
    ).response;
    // Google may already have revoked this grant; local cleanup is still valid.
    if (response?.status !== 400 || response.data?.error !== "invalid_token")
      throw new HttpError(
        502,
        "ยกเลิกสิทธิ์ Google ไม่สำเร็จ ลองใหม่หรือยกเลิกสิทธิ์ SearchPilot ในบัญชี Google ของคุณ",
      );
  }
  await db().$transaction([
    db().googleCredential.delete({ where: { ownerId } }),
    db().syncJob.updateMany({
      where: {
        site: { ownerId },
        status: { in: ["QUEUED", "RUNNING", "RETRY"] },
      },
      data: {
        status: "FAILED",
        errorCode: "DISCONNECTED",
        errorMessage: "ยกเลิกการเชื่อมต่อ Google แล้ว",
        leaseToken: null,
        leaseUntil: null,
        finishedAt: new Date(),
      },
    }),
    db().oAuthState.deleteMany({ where: { ownerId } }),
  ]);
}
