import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function getKey(value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
  if (!value) throw new Error("Encryption key is not configured");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("Encryption key must be 32 bytes in base64");
  return key;
}
export function encrypt(plaintext: string, context: string, key?: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", getKey(key), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function decrypt(value: string, context: string, key?: string) {
  const [version, iv, tag, data, ...rest] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data || rest.length)
    throw new Error("Invalid encrypted token");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(key),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
