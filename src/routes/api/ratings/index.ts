import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { ratingSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { upsertRating } from "@/server/db";
import { isKnownBus } from "@/server/fleet";

// Passenger-only. The rating is tied to the passenger's account server-side
// (one rating per passenger per bus, and to stop spam) but that link is
// never exposed by any endpoint — src/routes/api/ratings/summary/$busId
// only ever returns an aggregate, so the driver/owner never learns who
// rated them.
export const Route = createFileRoute("/api/ratings/")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "passenger") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "ratings" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`ratings:${session.userId}`, 20, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = ratingSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid rating" },
            { status: 400 },
          );
        }
        if (!isKnownBus(parsed.data.busId)) {
          return Response.json({ error: "Unknown bus" }, { status: 404 });
        }

        upsertRating({
          id: crypto.randomUUID(),
          busId: parsed.data.busId,
          passengerId: session.userId,
          rating: parsed.data.rating,
          comment: parsed.data.comment ?? null,
        });
        return Response.json({ ok: true }, { status: 201 });
      },
    },
  },
});
