import "server-only";
import { z } from "zod";
import { createAuthClient, isAuthError } from "@neondatabase/auth";
import { ownerLoginEmail, appOrigin } from "@/lib/config";
export class OwnerProvisionError extends Error {}

// The managed SDK can throw AuthError before Better Fetch returns its error result.
async function authResult<T>(request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    if (isAuthError(error)) return { data: null, error };
    throw error;
  }
}

function providerFailure(stage: string, error: { code?: string; status?: number }) {
  const hints: Record<string, string> = {
    INVALID_ORIGIN: "Add NEXT_PUBLIC_APP_URL to Neon Auth trusted origins.",
    EMAIL_NOT_VERIFIED: "Disable email verification for the internal login identifier.",
    EMAIL_PASSWORD_DISABLED: "Enable email/password sign-in in Neon Auth.",
    EMAIL_PASSWORD_SIGN_UP_DISABLED: "Temporarily enable email/password sign-up in Neon Auth.",
    SIGN_UP_DISABLED: "Temporarily enable sign-up in Neon Auth.",
    INVALID_EMAIL_OR_PASSWORD: "Check the password for the existing owner account.",
    USER_ALREADY_EXISTS: "An account already exists. Use its original password.",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account already exists. Use its original password.",
    INVALID_EMAIL: "Check OWNER_AUTH_EMAIL, if configured.",
    PASSWORD_TOO_SHORT: "Use a longer password accepted by Neon Auth.",
    PASSWORD_TOO_LONG: "Use a shorter password accepted by Neon Auth.",
    invalid_credentials: "Check the password for the existing owner account.",
    email_not_confirmed: "Disable email verification for the internal login identifier.",
    user_already_exists: "An account already exists. Use its original password.",
    email_exists: "An account already exists. Use its original password.",
    email_address_invalid: "Check OWNER_AUTH_EMAIL, if configured.",
    weak_password: "Use a password accepted by Neon Auth.",
    feature_not_supported: "Check email/password, sign-up and trusted origin settings in Neon Auth.",
    over_request_rate_limit: "Wait before retrying owner provisioning.",
  };
  const code = error.code && Object.hasOwn(hints, error.code) ? error.code : "AUTH_REQUEST_FAILED";
  const status = Number.isInteger(error.status) && error.status! >= 100 && error.status! <= 599
    ? ` (HTTP ${error.status})` : "";
  return new OwnerProvisionError(`${stage}: ${code}${status}. ${hints[code] ?? "Check Neon Auth settings and service availability."}`);
}

export async function provisionOwner(password: string) {
  if (!z.string().min(12).max(128).safeParse(password).success)
    throw new OwnerProvisionError("Password must contain 12-128 characters.");
  for (const [key, schema] of [
    ["APP_USERNAME", z.string().trim().min(1).max(64)],
    ["NEON_AUTH_BASE_URL", z.url()],
    ["NEXT_PUBLIC_APP_URL", z.url()],
  ] as const) {
    if (!schema.safeParse(process.env[key]).success)
      throw new OwnerProvisionError(`Set a valid ${key} in .env.local.`);
  }
  const username = z
      .string()
      .trim()
      .min(1)
      .max(64)
      .parse(process.env.APP_USERNAME),
    baseUrl = z.url().parse(process.env.NEON_AUTH_BASE_URL),
    pinned = process.env.OWNER_NEON_USER_ID;
  try {
    const client = createAuthClient(baseUrl),
      email = ownerLoginEmail(),
      options = { headers: { Origin: appOrigin() } };
    let login = await authResult(client.signIn.email({ email, password }, options));
    if (login.error?.code && !["INVALID_EMAIL_OR_PASSWORD", "invalid_credentials"].includes(login.error.code))
      throw providerFailure("Sign in", login.error);
    if (login.error && !pinned) {
      const created = await authResult(client.signUp.email(
        { email, password, name: username },
        options,
      ));
      if (created.error)
        throw providerFailure("Create owner", created.error);
      login = await authResult(client.signIn.email({ email, password }, options));
    }
    if (login.error || !login.data?.user)
      throw login.error ? providerFailure("Verify email/password sign-in", login.error)
        : new OwnerProvisionError("Verify email/password sign-in: Neon Auth returned no user.");
    const id = z.string().min(1).max(200).parse(login.data.user.id);
    if (pinned && pinned !== id)
      throw new OwnerProvisionError(
        "The pinned owner differs from the authenticated account. Existing ownership was not changed.",
      );
    return id;
  } catch (error) {
    if (error instanceof OwnerProvisionError) throw error;
    throw new OwnerProvisionError("Could not reach Neon Auth or read its response. Check NEON_AUTH_BASE_URL and network access.");
  }
}
