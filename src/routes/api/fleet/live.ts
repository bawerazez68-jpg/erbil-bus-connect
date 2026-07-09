import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest } from "@/server/security/request-auth";
import { getLiveFleet } from "@/server/fleet";
import { listRouteIntervals } from "@/server/db";

// Any authenticated role can read the live fleet — passengers need it to
// see buses on the map, owners to manage their fleet, auditors to audit it.
export const Route = createFileRoute("/api/fleet/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getSessionFromRequest(request);
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const buses = getLiveFleet();
        const intervals = listRouteIntervals();
        return Response.json({
          buses,
          intervals: intervals.map((i) => ({
            routeId: i.route_id,
            intervalMinutes: i.interval_minutes,
          })),
        });
      },
    },
  },
});
