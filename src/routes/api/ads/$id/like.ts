import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { getAdById, toggleAdLike } from "@/server/db";

// Toggles the caller's like on an ad. Any authenticated role may like an ad
// (like a social post); the like count itself is public in the feed.
export const Route = createFileRoute("/api/ads/$id/like")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        if (!consumeRateLimit(`ads-like:${session.userId}`, 60, 60 * 1000)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const ad = getAdById(params.id);
        if (!ad) return Response.json({ error: "Ad not found" }, { status: 404 });

        const { liked, likeCount } = toggleAdLike(params.id, session.userId);
        return Response.json({ liked, likeCount });
      },
    },
  },
});
