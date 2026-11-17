import { auth } from "@/lib/auth/server";
import { errorResponse } from "@/lib/security/http";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
    if (!(
      (request.method === "GET" && path === "get-session") ||
      (request.method === "POST" && path === "sign-out")
    ))
      return new Response(null, { status: 404 });
    const handlers = auth().handler();
    const method = request.method as keyof typeof handlers;
    const handle = handlers[method];
    if (!handle) return new Response(null, { status: 405 });
    return await handle(request, context);
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST };
