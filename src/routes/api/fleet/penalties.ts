import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { penaltySchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { insertPenalty, listAllPenalties, listPenaltiesByBus } from "@/server/db";
import { isKnownBus, getLiveFleet } from "@/server/fleet";

// Lateness penalties an auditor issues against a bus at a checkpoint.
// Readable by owner (their fleet's record) and auditor; only the auditor
// can issue one.
export const Route = createFileRoute("/api/fleet/penalties")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "owner" && session.role !== "auditor") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const url = new URL(request.url);
        const busId = url.searchParams.get("busId");
        const rows = busId ? listPenaltiesByBus(busId) : listAllPenalties();
        return Response.json({
          penalties: rows.map((p) => ({
            id: p.id,
            busId: p.bus_id,
            routeId: p.route_id,
            reason: p.reason,
            minutesLate: p.minutes_late,
            createdAt: p.created_at,
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
            detail: { path: "fleet/penalties" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`fleet-penalties:${session.userId}`, 30, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = penaltySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }
        if (!isKnownBus(parsed.data.busId)) {
          return Response.json({ error: "Unknown bus" }, { status: 404 });
        }
        const liveBus = getLiveFleet().find((b) => b.id === parsed.data.busId)!;

        insertPenalty({
          id: crypto.randomUUID(),
          busId: parsed.data.busId,
          routeId: liveBus.routeId,
          auditorId: session.userId,
          reason: parsed.data.reason,
          minutesLate: parsed.data.minutesLate,
        });
        return Response.json({ ok: true }, { status: 201 });
      },
    },
  },
});
