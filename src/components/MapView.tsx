import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { getMapTilerKey } from "@/lib/maptiler.functions";
import {
  BUSES,
  DOWNTOWN_GARAGE,
  PASSENGERS,
  ROUTES,
  interpolate,
} from "@/lib/mockData";

type Props = {
  showPassengers?: boolean;
  highlightRouteId?: string | null;
};

export function MapView({ showPassengers = true, highlightRouteId = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const busMarkersRef = useRef<Record<string, Marker>>({});
  const fetchKey = useServerFn(getMapTilerKey);
  const [key, setKey] = useState<string>("");
  const [progress, setProgress] = useState(() => BUSES.map((b) => b.progress));

  useEffect(() => {
    fetchKey({}).then((r) => setKey(r.key)).catch(() => setKey(""));
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
      new maplibregl.Marker({ element: garageEl })
        .setLngLat(DOWNTOWN_GARAGE)
        .addTo(map);

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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [key]);

  // Animate bus progress
  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) =>
        p.map((v, i) => {
          const next = v + BUSES[i].speed;
          return next >= 1 ? 0.05 : next;
        }),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Place / update bus markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    BUSES.forEach((bus, i) => {
      const route = ROUTES.find((r) => r.id === bus.routeId)!;
      const pos = interpolate(route.origin, DOWNTOWN_GARAGE, progress[i]);
      const dimmed = highlightRouteId && highlightRouteId !== bus.routeId;
      let marker = busMarkersRef.current[bus.id];
      if (!marker) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:${route.color};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);border:2px solid white">🚌</div>`;
        marker = new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
        marker.setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<strong>${bus.label}</strong><br/>${route.name} → Downtown<br/>${bus.taken}/${bus.seats} seats`,
          ),
        );
        busMarkersRef.current[bus.id] = marker;
      } else {
        marker.setLngLat(pos);
        marker.getElement().style.opacity = dimmed ? "0.3" : "1";
      }
    });
  }, [progress, highlightRouteId]);

  // Passenger markers (mount once)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showPassengers) return;
    const markers: Marker[] = [];
    const onLoad = () => {
      PASSENGERS.forEach((p) => {
        const route = ROUTES.find((r) => r.id === p.routeId)!;
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:white;border:3px solid ${route.color};width:18px;height:18px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`;
        const m = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]);
        m.setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<strong>${p.name}</strong><br/>Waiting on ${route.name}`));
        m.addTo(map);
        markers.push(m);
      });
    };
    if (map.loaded()) onLoad();
    else map.on("load", onLoad);
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [showPassengers, key]);

  return <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden" />;
}