import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { driverLocationSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { reportDriverLocation, isKnownBus } from "@/server/fleet";

// Owner/driver dashboards call this periodically while actively driving a
// bus; the fleet simulation treats it as the authoritative position until
// the driver stops reporting (see src/server/fleet.ts DRIVER_TIMEOUT_MS).
export const Route = createFileRoute("/api/fleet/location/$busId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "owner") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "fleet/location" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`fleet-location:${session.userId}`, 60, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        if (!isKnownBus(params.busId)) {
          return Response.json({ error: "Unknown bus" }, { status: 404 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = driverLocationSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid location" },
            { status: 400 },
          );
        }

        reportDriverLocation(params.busId, parsed.data.lng, parsed.data.lat);
        return Response.json({ ok: true });
      },
    },
  },
});
