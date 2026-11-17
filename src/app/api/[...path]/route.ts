import { handleApi } from "@/features/api";
import { errorResponse } from "@/lib/security/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handleApi(request, (await context.params).path);
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
