import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { adStatusSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { setAdStatus } from "@/server/db";

// Pause/resume an ad. Ownership is enforced in the SQL itself
// (WHERE id = ? AND advertiser_id = ?), not just the role check, so one
// advertiser can never toggle another advertiser's ad.
export const Route = createFileRoute("/api/ads/$id/")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "advertiser") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "ads/$id" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`ads-status:${session.userId}`, 30, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = adStatusSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }

        const updated = setAdStatus(params.id, session.userId, parsed.data.status);
        if (!updated) {
          return Response.json({ error: "Ad not found" }, { status: 404 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
