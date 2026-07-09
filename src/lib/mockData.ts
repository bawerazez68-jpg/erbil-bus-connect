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
  { id: "sarchinar", name: "Sarchinar", color: "#ef4444", origin: [44.035, 36.165] },
  { id: "havalan", name: "Havalan", color: "#14b8a6", origin: [44.07, 36.21] },
  { id: "khabat", name: "Khabat", color: "#8b5cf6", origin: [43.92, 36.265] },
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

const DRIVER_FIRST_NAMES = [
  "Rebin",
  "Halgurd",
  "Shad",
  "Aram",
  "Newroz",
  "Ari",
  "Dilan",
  "Soran",
  "Bnar",
  "Zana",
  "Hemin",
  "Karwan",
  "Rojin",
  "Diyar",
  "Sarkawt",
  "Rawa",
  "Barham",
  "Dana",
  "Peshraw",
  "Nawroz",
  "Sirwan",
  "Bahoz",
  "Chia",
  "Zhiar",
  "Hawre",
  "Bestun",
  "Kawa",
  "Rebaz",
  "Sami",
  "Twana",
];

const DRIVER_LAST_NAMES = [
  "Ahmad",
  "Salih",
  "Kamal",
  "Hussein",
  "Karim",
  "Rasul",
  "Fatih",
  "Aziz",
  "Rauf",
  "Faraj",
  "Sabir",
  "Latif",
  "Jamal",
  "Nabi",
  "Hamad",
  "Qadir",
  "Amin",
  "Rashid",
  "Omar",
  "Saleh",
  "Zangana",
  "Hawrami",
  "Soorani",
  "Jaff",
  "Mahmoud",
  "Ismail",
  "Yousif",
  "Khalid",
  "Barzani",
  "Talabani",
];

function driverNameFor(globalIndex: number): string {
  const first = DRIVER_FIRST_NAMES[globalIndex % DRIVER_FIRST_NAMES.length];
  const last = DRIVER_LAST_NAMES[(globalIndex * 7 + 3) % DRIVER_LAST_NAMES.length];
  return `${first} ${last}`;
}

// Each route is served by a fleet of buses through the day, spaced along
// the route with an interval/headway between them (set by the auditor —
// see route_intervals in the server). Bus id is `B-<routeIndex>-<slot>` so
// it's stable and traceable back to its route; label is a short per-route
// code (e.g. "ANK-01") since a flat "Bus 100" numbering scheme doesn't
// scale to this many buses.
export const BUSES_PER_ROUTE = 25;

export const BUSES: Bus[] = ROUTES.flatMap((r, routeIndex) => {
  const code = r.id.slice(0, 3).toUpperCase();
  return Array.from({ length: BUSES_PER_ROUTE }, (_, slot) => {
    const globalIndex = routeIndex * BUSES_PER_ROUTE + slot;
    return {
      id: `B-${routeIndex}-${slot + 1}`,
      routeId: r.id,
      label: `${code}-${String(slot + 1).padStart(2, "0")}`,
      driverName: driverNameFor(globalIndex),
      seats: 32,
      taken: 4 + ((globalIndex * 7) % 28),
      // Spread evenly along the route so there's a visible convoy with a
      // roughly consistent headway to start from.
      progress: 0.02 + (slot / BUSES_PER_ROUTE) * 0.9,
      speed: 0.003 + (globalIndex % 5) * 0.0006,
      etaMin: 3 + (slot % 10) * 2,
    };
  });
});

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
    busId: "B-1-3",
    routeId: "kasnazan",
    type: "deviation",
    severity: "high",
    status: "open",
    note: "Detoured 800m off Kasnazan corridor",
    minutesAgo: 3,
  },
  {
    id: "a2",
    busId: "B-3-5",
    routeId: "qoshtapa",
    type: "ghost",
    severity: "medium",
    status: "open",
    note: "5 riders boarded without ticket scan",
    minutesAgo: 11,
  },
  {
    id: "a3",
    busId: "B-0-1",
    routeId: "ankawa",
    type: "speed",
    severity: "low",
    status: "open",
    note: "Over speed limit on 100m Rd",
    minutesAgo: 18,
  },
  {
    id: "a4",
    busId: "B-4-2",
    routeId: "bahrka",
    type: "stop",
    severity: "medium",
    status: "cleared",
    note: "Skipped Bahrka stop #4",
    minutesAgo: 42,
  },
  {
    id: "a5",
    busId: "B-6-7",
    routeId: "pirzen",
    type: "deviation",
    severity: "low",
    status: "cleared",
    note: "Brief detour, returned to route",
    minutesAgo: 65,
  },
];
