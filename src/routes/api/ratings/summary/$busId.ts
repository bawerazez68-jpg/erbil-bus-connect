import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { getRatingSummary } from "@/server/db";

// Aggregate only (average + count) — never the underlying per-passenger
// rows, so this can't be used to identify who rated a bus.
export const Route = createFileRoute("/api/ratings/summary/$busId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const summary = getRatingSummary(params.busId);
        return Response.json(summary);
      },
    },
  },
});
