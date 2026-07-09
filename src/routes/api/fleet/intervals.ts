import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { routeIntervalSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { setRouteInterval, listRouteIntervals } from "@/server/db";
import { isKnownRoute } from "@/server/fleet";

// The target headway (minutes) between consecutive buses on a route. Only
// the bus auditor sets it; every role can read it (owner/driver needs to
// know the interval they should be keeping).
export const Route = createFileRoute("/api/fleet/intervals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const intervals = listRouteIntervals();
        return Response.json({
          intervals: intervals.map((i) => ({
            routeId: i.route_id,
            intervalMinutes: i.interval_minutes,
          })),
        });
      },
      POST: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "auditor") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "fleet/intervals" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`fleet-intervals:${session.userId}`, 30, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = routeIntervalSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }
        if (!isKnownRoute(parsed.data.routeId)) {
          return Response.json({ error: "Unknown route" }, { status: 404 });
        }

        setRouteInterval(parsed.data.routeId, parsed.data.intervalMinutes, session.userId);
        return Response.json({ ok: true });
      },
    },
  },
});
