import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { getMapTilerKey } from "@/lib/maptiler.functions";
import { BUSES, DOWNTOWN_GARAGE, PASSENGERS, ROUTES, interpolate } from "@/lib/mockData";
import type { LiveBus } from "@/lib/useLiveFleet";

type Props = {
  showPassengers?: boolean;
  highlightRouteId?: string | null;
  /** Server-authoritative bus positions (see useLiveFleet). When provided, these replace the local simulated animation so every role sees the same bus positions. */
  liveBuses?: LiveBus[];
  /** Called when a bus marker is clicked — lets the page show a detail/rating panel for that bus. */
  onSelectBus?: (busId: string) => void;
  /** A user-chosen point (passenger's pickup spot, auditor's checkpoint) rendered as a distinct marker. */
  myLocation?: [number, number] | null;
  /** Called with [lng, lat] when the map is clicked, so a page can let the user place myLocation. */
  onSetMyLocation?: (lngLat: [number, number]) => void;
};

export function MapView({
  showPassengers = true,
  highlightRouteId = null,
  liveBuses,
  onSelectBus,
  myLocation = null,
  onSetMyLocation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const busMarkersRef = useRef<Record<string, Marker>>({});
  const passengerMarkersRef = useRef<Record<string, Marker>>({});
  const myLocationMarkerRef = useRef<Marker | null>(null);
  const passengerStateRef = useRef(
    PASSENGERS.map((p) => ({ lng: p.lng, lat: p.lat, vx: 0, vy: 0 })),
  );
  const onSelectBusRef = useRef(onSelectBus);
  const onSetMyLocationRef = useRef(onSetMyLocation);
  const fetchKey = useServerFn(getMapTilerKey);
  const [key, setKey] = useState<string>("");
  const [progress, setProgress] = useState(() => BUSES.map((b) => b.progress));
  const [passengerTick, setPassengerTick] = useState(0);
  const hasLiveBuses = !!liveBuses;

  useEffect(() => {
    onSelectBusRef.current = onSelectBus;
    onSetMyLocationRef.current = onSetMyLocation;
  });

  useEffect(() => {
    fetchKey({})
      .then((r) => setKey(r.key))
      .catch(() => setKey(""));
  }, [fetchKey]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const style = key
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
      : "https://demotiles.maplibre.org/style.json";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: DOWNTOWN_GARAGE,
      zoom: 12,
      pitch: 45,
      bearing: -17,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("load", () => {
      // Route lines
      ROUTES.forEach((r) => {
        const id = `route-${r.id}`;
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [r.origin, DOWNTOWN_GARAGE] },
          },
        });
        map.addLayer({
          id,
          type: "line",
          source: id,
          paint: {
            "line-color": r.color,
            "line-width": 4,
            "line-opacity": 0.75,
          },
        });
      });

      // Downtown garage marker
      const garageEl = document.createElement("div");
      garageEl.innerHTML = `<div style="background:#0f172a;color:white;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3);border:2px solid #fbbf24">★ Downtown Garage</div>`;
      new maplibregl.Marker({ element: garageEl }).setLngLat(DOWNTOWN_GARAGE).addTo(map);

      // 3D buildings if available
      try {
        const layers = map.getStyle().layers ?? [];
        const labelLayer = layers.find(
          (l) => l.type === "symbol" && (l.layout as any)?.["text-field"],
        )?.id;
        map.addLayer(
          {
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#a3b1c2",
              "fill-extrusion-height": ["get", "render_height"],
              "fill-extrusion-base": ["get", "render_min_height"],
              "fill-extrusion-opacity": 0.7,
            },
          },
          labelLayer,
        );
      } catch {}
    });

    map.on("click", (e) => {
      onSetMyLocationRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [key]);

  // Animate bus progress locally — smoother updates every 250ms. Skipped
  // entirely when liveBuses is supplied, since the server is then the
  // authoritative position source (see useLiveFleet).
  useEffect(() => {
    if (hasLiveBuses) return;
    const iv = setInterval(() => {
      setProgress((p) =>
        p.map((v, i) => {
          const next = v + BUSES[i].speed * 0.25;
          return next >= 1 ? 0.05 : next;
        }),
      );
    }, 250);
    return () => clearInterval(iv);
  }, [hasLiveBuses]);

  // Drift passengers around their waiting spot
  useEffect(() => {
    const iv = setInterval(() => {
      const state = passengerStateRef.current;
      PASSENGERS.forEach((p, i) => {
        const s = state[i];
        // small random walk, gently pulled back toward origin
        s.vx = s.vx * 0.7 + (Math.random() - 0.5) * 0.00012;
        s.vy = s.vy * 0.7 + (Math.random() - 0.5) * 0.00012;
        s.lng += s.vx + (p.lng - s.lng) * 0.02;
        s.lat += s.vy + (p.lat - s.lat) * 0.02;
      });
      setPassengerTick((t) => (t + 1) % 1_000_000);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Place / update bus markers — from the live fleed feed when provided,
  // otherwise from the local simulated progress (see hasLiveBuses above).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenIds = new Set<string>();

    const placeBus = (busId: string, routeId: string, pos: [number, number], popupHtml: string) => {
      seenIds.add(busId);
      const route = ROUTES.find((r) => r.id === routeId);
      const color = route?.color ?? "#64748b";
      const dimmed = highlightRouteId && highlightRouteId !== routeId;
      let marker = busMarkersRef.current[busId];
      if (!marker) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:${color};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);border:2px solid white;cursor:pointer">🚌</div>`;
        el.addEventListener("click", () => onSelectBusRef.current?.(busId));
        marker = new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
        marker.setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml));
        busMarkersRef.current[busId] = marker;
      } else {
        marker.setLngLat(pos);
        marker.getElement().style.opacity = dimmed ? "0.3" : "1";
        marker.getPopup()?.setHTML(popupHtml);
      }
    };

    if (liveBuses) {
      liveBuses.forEach((bus) => {
        const route = ROUTES.find((r) => r.id === bus.routeId);
        placeBus(
          bus.id,
          bus.routeId,
          [bus.lng, bus.lat],
          `<strong>${bus.label}</strong><br/>Driver: ${bus.driverName}<br/>${route?.name ?? bus.routeId} → Downtown<br/>${bus.taken}/${bus.seats} seats`,
        );
      });
    } else {
      BUSES.forEach((bus, i) => {
        const route = ROUTES.find((r) => r.id === bus.routeId)!;
        const pos = interpolate(route.origin, DOWNTOWN_GARAGE, progress[i]);
        placeBus(
          bus.id,
          bus.routeId,
          pos,
          `<strong>${bus.label}</strong><br/>Driver: ${bus.driverName}<br/>${route.name} → Downtown<br/>${bus.taken}/${bus.seats} seats`,
        );
      });
    }

    // Remove markers for buses no longer present (e.g. filtered fleet).
    Object.keys(busMarkersRef.current).forEach((id) => {
      if (!seenIds.has(id)) {
        busMarkersRef.current[id].remove();
        delete busMarkersRef.current[id];
      }
    });
  }, [liveBuses, progress, highlightRouteId]);

  // Place / update the "my location" marker (passenger pickup spot, auditor checkpoint)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!myLocation) {
      myLocationMarkerRef.current?.remove();
      myLocationMarkerRef.current = null;
      return;
    }

    if (!myLocationMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,.35)"></div>`;
      myLocationMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(myLocation)
        .addTo(map);
      myLocationMarkerRef.current.setPopup(
        new maplibregl.Popup({ offset: 14 }).setHTML("<strong>My location</strong>"),
      );
    } else {
      myLocationMarkerRef.current.setLngLat(myLocation);
    }
  }, [myLocation]);

  // Place / update passenger markers in sync with the drift tick
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ensure = () => {
      // remove existing if hidden
      if (!showPassengers) {
        Object.values(passengerMarkersRef.current).forEach((m) => m.remove());
        passengerMarkersRef.current = {};
        return;
      }
      const state = passengerStateRef.current;
      PASSENGERS.forEach((p, i) => {
        const route = ROUTES.find((r) => r.id === p.routeId)!;
        const dimmed = highlightRouteId && highlightRouteId !== p.routeId;
        let marker = passengerMarkersRef.current[p.id];
        const s = state[i];
        if (!marker) {
          const el = document.createElement("div");
          el.innerHTML = `<div style="background:white;border:3px solid ${route.color};width:18px;height:18px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .3s"></div>`;
          marker = new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
          marker.setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<strong>${p.name}</strong><br/>Waiting on ${route.name}`,
            ),
          );
          passengerMarkersRef.current[p.id] = marker;
        } else {
          marker.setLngLat([s.lng, s.lat]);
        }
        marker.getElement().style.opacity = dimmed ? "0.25" : "1";
      });
    };

    if (map.loaded()) ensure();
    else map.once("load", ensure);
  }, [passengerTick, showPassengers, highlightRouteId, key]);

  // Clean up passenger markers on unmount
  useEffect(() => {
    return () => {
      Object.values(passengerMarkersRef.current).forEach((m) => m.remove());
      passengerMarkersRef.current = {};
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden" />
  );
}
