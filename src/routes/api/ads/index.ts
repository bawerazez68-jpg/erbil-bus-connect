import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { createAdSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { insertAd, listActiveAdsForViewer } from "@/server/db";

// GET is the public feed shown on the passenger/owner/auditor dashboards —
// like counts are visible to everyone (like a social post), but view
// counts are not: those are only ever exposed to the ad's own poster via
// GET /api/ads/mine, matching "show the poster how many views and likes".
export const Route = createFileRoute("/api/ads/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const rows = listActiveAdsForViewer(session.userId);
        return Response.json({
          ads: rows.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            advertiserName: a.advertiser_name,
            likeCount: a.like_count,
            likedByMe: !!a.liked_by_me,
            createdAt: a.created_at,
          })),
        });
      },
      POST: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "advertiser") {
          logSecurityEvent({
            type: "rbac_denied",
            userId: session.userId,
            ip: getClientIp(request),
            detail: { path: "ads" },
          });
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!consumeRateLimit(`ads-create:${session.userId}`, 10, 60 * 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = createAdSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }

        const id = crypto.randomUUID();
        insertAd({
          id,
          advertiserId: session.userId,
          title: parsed.data.title,
          body: parsed.data.body,
        });
        return Response.json({ id }, { status: 201 });
      },
    },
  },
});
