import { BUSES, ROUTES, DOWNTOWN_GARAGE, interpolate, type Bus } from "@/lib/mockData";
import { haversineKm } from "@/lib/geo";

// Server-authoritative live bus state. This is the single source of truth
// every role's dashboard polls, so passenger/owner/auditor always agree on
// where each bus is — a bus normally advances via the simulated tick below,
// but an owner/driver dashboard can push real device coordinates (see
// reportDriverLocation), which take over until that driver stops reporting
// (DRIVER_TIMEOUT_MS), at which point it falls back to simulation from the
// last known position. In-memory by design: this is high-frequency,
// ephemeral telemetry, not data that needs to survive a restart.

export type BusLive = {
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
};

export type LiveBusView = BusLive & {
  gapAheadKm: number | null;
  gapAheadMin: number | null;
  etaToGarageMin: number;
  remainingKm: number;
};

const TICK_MS = 2000;
const DRIVER_TIMEOUT_MS = 20_000;

const busById = new Map<string, Bus>(BUSES.map((b) => [b.id, b]));
const routeById = new Map(ROUTES.map((r) => [r.id, r]));

function routeLengthKm(routeId: string): number {
  const route = routeById.get(routeId)!;
  return haversineKm(route.origin, DOWNTOWN_GARAGE);
}

function computeSpeedKmh(bus: Bus): number {
  const progressPerHour = bus.speed * (3_600_000 / TICK_MS);
  return routeLengthKm(bus.routeId) * progressPerHour;
}

const state = new Map<string, BusLive>();

function seedState() {
  for (const bus of BUSES) {
    const route = routeById.get(bus.routeId)!;
    const [lng, lat] = interpolate(route.origin, DOWNTOWN_GARAGE, bus.progress);
    state.set(bus.id, {
      id: bus.id,
      routeId: bus.routeId,
      label: bus.label,
      driverName: bus.driverName,
      seats: bus.seats,
      taken: bus.taken,
      progress: bus.progress,
      lng,
      lat,
      speedKmh: computeSpeedKmh(bus),
      source: "simulated",
      updatedAt: Date.now(),
    });
  }
}

function tick() {
  const now = Date.now();
  for (const s of state.values()) {
    if (s.source === "driver") {
      if (now - s.updatedAt < DRIVER_TIMEOUT_MS) continue;
      s.source = "simulated"; // driver stopped reporting — resume simulation from last known spot
    }
    const bus = busById.get(s.id)!;
    const route = routeById.get(s.routeId)!;
    const next = s.progress + bus.speed;
    s.progress = next >= 1 ? 0.05 : next;
    const [lng, lat] = interpolate(route.origin, DOWNTOWN_GARAGE, s.progress);
    s.lng = lng;
    s.lat = lat;
    s.updatedAt = now;
  }
}

// Dev-server/HMR-safe singleton: a bare module-level setInterval would
// otherwise stack up a new duplicate timer on every hot reload.
declare global {
  var __fleetSeeded: boolean | undefined;

  var __fleetTimer: ReturnType<typeof setInterval> | undefined;
}

if (!globalThis.__fleetSeeded) {
  seedState();
  globalThis.__fleetSeeded = true;
}
if (!globalThis.__fleetTimer) {
  globalThis.__fleetTimer = setInterval(tick, TICK_MS);
}

/** All buses, grouped by route and annotated with the gap to the bus ahead of them (closer to the garage) on the same route. */
export function getLiveFleet(): LiveBusView[] {
  const byRoute = new Map<string, BusLive[]>();
  for (const b of state.values()) {
    const list = byRoute.get(b.routeId) ?? [];
    list.push(b);
    byRoute.set(b.routeId, list);
  }

  const result: LiveBusView[] = [];
  for (const buses of byRoute.values()) {
    const sorted = [...buses].sort((a, b) => b.progress - a.progress);
    sorted.forEach((bus, i) => {
      const ahead = sorted[i - 1];
      let gapAheadKm: number | null = null;
      let gapAheadMin: number | null = null;
      if (ahead) {
        gapAheadKm = haversineKm([bus.lng, bus.lat], [ahead.lng, ahead.lat]);
        const avgSpeed = (bus.speedKmh + ahead.speedKmh) / 2;
        gapAheadMin = (gapAheadKm / (avgSpeed > 1 ? avgSpeed : 1)) * 60;
      }
      const remainingKm = routeLengthKm(bus.routeId) * (1 - bus.progress);
      const etaToGarageMin = (remainingKm / (bus.speedKmh > 1 ? bus.speedKmh : 1)) * 60;
      result.push({ ...bus, gapAheadKm, gapAheadMin, etaToGarageMin, remainingKm });
    });
  }
  // numeric: true so "B-0-2" sorts before "B-0-10" (plain string compare
  // would put "B-0-10" first since "1" < "2").
  return result.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function getBus(busId: string): LiveBusView | null {
  return getLiveFleet().find((b) => b.id === busId) ?? null;
}

/** Called by an owner/driver dashboard reporting its device's real location for a bus it operates. */
export function reportDriverLocation(busId: string, lng: number, lat: number): boolean {
  const s = state.get(busId);
  if (!s) return false;
  s.lng = lng;
  s.lat = lat;
  s.source = "driver";
  s.updatedAt = Date.now();
  return true;
}

export function isKnownBus(busId: string): boolean {
  return busById.has(busId);
}

export function isKnownRoute(routeId: string): boolean {
  return routeById.has(routeId);
}
