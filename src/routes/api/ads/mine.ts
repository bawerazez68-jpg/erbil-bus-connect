import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { listAdsByAdvertiser } from "@/server/db";

// The advertiser's own ads with view + like counts — the stats dashboard.
export const Route = createFileRoute("/api/ads/mine")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "advertiser") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const rows = listAdsByAdvertiser(session.userId);
        return Response.json({
          ads: rows.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            status: a.status,
            viewCount: a.view_count,
            likeCount: a.like_count,
            createdAt: a.created_at,
          })),
        });
      },
    },
  },
});
