import { loginWithUsername } from "@/features/auth/login";
import { json, errorResponse } from "@/lib/security/http";
export async function POST(request: Request) {
  try {
    await loginWithUsername(request);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
