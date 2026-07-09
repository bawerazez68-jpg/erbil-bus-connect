import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { getAdById, recordAdView } from "@/server/db";

// Records a unique-viewer impression. Idempotent (ad_views has a
// (ad_id, viewer_id) primary key), so calling this once per page load per
// viewer is safe and can't be used to inflate the poster's view count.
export const Route = createFileRoute("/api/ads/$id/view")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        if (!consumeRateLimit(`ads-view:${getClientIp(request)}`, 120, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const ad = getAdById(params.id);
        if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });

        // Don't let a poster's own visits count toward their view stats.
        if (ad.advertiser_id !== session.userId) {
          recordAdView(params.id, session.userId);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
