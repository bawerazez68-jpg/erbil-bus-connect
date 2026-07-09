import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { haversineKm, etaMinutes } from "@/lib/geo";

export type LiveBus = {
  id: string;
  routeId: string;
  label: string;
  driverName: string;
  seats: number;
  taken: number;
  progress: number;
  lng: number;
  lat: number;
  speedKmh: number;
  source: "simulated" | "driver";
  updatedAt: number;
  gapAheadKm: number | null;
  gapAheadMin: number | null;
  etaToGarageMin: number;
};

export type RouteInterval = { routeId: string; intervalMinutes: number };

/** Polls the server-authoritative live fleet so passenger/owner/auditor views all agree on bus positions. */
export function useLiveFleet(pollMs = 3000) {
  const { accessToken } = useAuth();
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [intervals, setIntervals] = useState<RouteInterval[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/fleet/live", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load live fleet");
        const data = (await res.json()) as { buses: LiveBus[]; intervals: RouteInterval[] };
        if (!cancelled) {
          setBuses(data.buses);
          setIntervals(data.intervals);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load live fleet");
      }
    };

    void poll();
    const id = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, pollMs]);

  return { buses, intervals, error };
}

/** Straight-line distance/ETA from a bus's live position to an arbitrary map point (a passenger's pickup spot, an auditor's checkpoint). */
export function etaToPoint(bus: LiveBus, point: [number, number]) {
  const distanceKm = haversineKm([bus.lng, bus.lat], point);
  return { distanceKm, etaMin: etaMinutes(distanceKm, bus.speedKmh) };
}
