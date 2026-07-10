import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { assignRouteSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { setAssignedRoute } from "@/server/db";
import { isKnownRoute } from "@/server/fleet";

// Lets an auditor pick which route they're checking today, so their
// dashboard can be scoped to only the buses on that route. Ownership is
// enforced in the SQL itself (WHERE role = 'auditor'), not just the role
// check here.
export const Route = createFileRoute("/api/auditor/assign")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "auditor") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "auditor/route" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`auditor-route:${session.userId}`, 20, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = assignRouteSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }
        if (!isKnownRoute(parsed.data.routeId)) {
          return Response.json({ error: "Unknown route" }, { status: 404 });
        }

        const updated = setAssignedRoute(session.userId, parsed.data.routeId);
        if (!updated) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        return Response.json({ assignedRouteId: parsed.data.routeId });
      },
    },
  },
});
