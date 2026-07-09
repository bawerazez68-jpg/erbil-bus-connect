// Erbil center & Downtown Garage
export const ERBIL_CENTER: [number, number] = [44.0094, 36.1911];
export const DOWNTOWN_GARAGE: [number, number] = [44.0094, 36.1911];

export type RouteDef = {
  id: string;
  name: string;
  color: string;
  // origin -> garage
  origin: [number, number];
};

export const ROUTES: RouteDef[] = [
  { id: "ankawa", name: "Ankawa", color: "#a855f7", origin: [43.9783, 36.2412] },
  { id: "kasnazan", name: "Kasnazan", color: "#f97316", origin: [44.132, 36.205] },
  { id: "bnaslawa", name: "Bnaslawa", color: "#06b6d4", origin: [44.081, 36.128] },
  { id: "qoshtapa", name: "Qoshtapa", color: "#22c55e", origin: [43.992, 36.083] },
  { id: "bahrka", name: "Bahrka", color: "#ec4899", origin: [43.865, 36.212] },
  { id: "daratoo", name: "Daratoo", color: "#eab308", origin: [43.945, 36.247] },
  { id: "pirzen", name: "Pirzen", color: "#3b82f6", origin: [44.05, 36.255] },
];

export type Bus = {
  id: string;
  routeId: string;
  label: string;
  driverName: string;
  seats: number;
  taken: number;
  // 0..1 progress from origin to garage
  progress: number;
  speed: number; // progress per tick
  etaMin: number;
};

const DRIVER_NAMES = [
  "Rebin Ahmad",
  "Halgurd Salih",
  "Shad Kamal",
  "Aram Hussein",
  "Newroz Karim",
  "Ari Rasul",
  "Dilan Fatih",
  "Soran Aziz",
  "Bnar Rauf",
  "Zana Faraj",
  "Hemin Sabir",
  "Karwan Latif",
  "Rojin Jamal",
  "Diyar Nabi",
];

// Two buses per route (a route is served by multiple buses through the day,
// with an interval/headway between them set by the auditor) — the first
// batch keeps the original B-100..B-106 ids for backward compatibility with
// AUDIT_ALERTS below; the second batch (B-200..B-206) are each route's
// second bus, staggered further along the route.
export const BUSES: Bus[] = [
  ...ROUTES.map((r, i) => ({
    id: `B-${100 + i}`,
    routeId: r.id,
    label: `Bus ${100 + i}`,
    driverName: DRIVER_NAMES[i],
    seats: 32,
    taken: 10 + ((i * 7) % 22),
    progress: 0.1 + ((i * 0.11) % 0.6),
    speed: 0.004 + (i % 3) * 0.001,
    etaMin: 5 + i * 3,
  })),
  ...ROUTES.map((r, i) => ({
    id: `B-${200 + i}`,
    routeId: r.id,
    label: `Bus ${200 + i}`,
    driverName: DRIVER_NAMES[7 + i],
    seats: 32,
    taken: 6 + ((i * 5) % 20),
    progress: 0.45 + ((i * 0.09) % 0.5),
    speed: 0.0035 + (i % 3) * 0.001,
    etaMin: 12 + i * 3,
  })),
];

export type Passenger = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  routeId: string;
};

// Spread 12 passengers across routes near origins
export const PASSENGERS: Passenger[] = ROUTES.flatMap((r, i) => {
  const base: Passenger[] = [
    {
      id: `P-${i}-a`,
      name: `Passenger ${i * 2 + 1}`,
      lng: r.origin[0] + 0.004,
      lat: r.origin[1] - 0.003,
      routeId: r.id,
    },
  ];
  if (i < 5)
    base.push({
      id: `P-${i}-b`,
      name: `Passenger ${i * 2 + 2}`,
      lng: r.origin[0] - 0.005,
      lat: r.origin[1] + 0.004,
      routeId: r.id,
    });
  return base;
});

export type Campaign = {
  id: string;
  name: string;
  status: "active" | "paused";
  impressions: number;
  clicks: number;
  budget: number;
  spent: number;
};

export const CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Ankawa Weekend Promo",
    status: "active",
    impressions: 18420,
    clicks: 942,
    budget: 500,
    spent: 312,
  },
  {
    id: "c2",
    name: "Kasnazan Morning Rush",
    status: "active",
    impressions: 24310,
    clicks: 1180,
    budget: 750,
    spent: 510,
  },
  {
    id: "c3",
    name: "Downtown Cafe",
    status: "paused",
    impressions: 5210,
    clicks: 220,
    budget: 200,
    spent: 145,
  },
];

export function interpolate(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export type AuditAlert = {
  id: string;
  busId: string;
  routeId: string;
  type: "deviation" | "ghost" | "speed" | "stop";
  severity: "low" | "medium" | "high";
  status: "open" | "cleared";
  note: string;
  minutesAgo: number;
};

export const AUDIT_ALERTS: AuditAlert[] = [
  {
    id: "a1",
    busId: "B-101",
    routeId: "kasnazan",
    type: "deviation",
    severity: "high",
    status: "open",
    note: "Detoured 800m off Kasnazan corridor",
    minutesAgo: 3,
  },
  {
    id: "a2",
    busId: "B-103",
    routeId: "qoshtapa",
    type: "ghost",
    severity: "medium",
    status: "open",
    note: "5 riders boarded without ticket scan",
    minutesAgo: 11,
  },
  {
    id: "a3",
    busId: "B-100",
    routeId: "ankawa",
    type: "speed",
    severity: "low",
    status: "open",
    note: "Over speed limit on 100m Rd",
    minutesAgo: 18,
  },
  {
    id: "a4",
    busId: "B-104",
    routeId: "bahrka",
    type: "stop",
    severity: "medium",
    status: "cleared",
    note: "Skipped Bahrka stop #4",
    minutesAgo: 42,
  },
  {
    id: "a5",
    busId: "B-106",
    routeId: "pirzen",
    type: "deviation",
    severity: "low",
    status: "cleared",
    note: "Brief detour, returned to route",
    minutesAgo: 65,
  },
];
