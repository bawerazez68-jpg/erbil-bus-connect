import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

/** Lets an owner/driver dashboard push its device's real location for a bus, taking over from the simulated position until it stops reporting. */
export function DriverLocationReporter({ busId }: { busId: string }) {
  const { accessToken } = useAuth();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const send = (lat: number, lng: number) => {
    if (!accessToken) return;
    const now = Date.now();
    if (now - lastSentRef.current < 4000) return;
    lastSentRef.current = now;
    void fetch(`/api/fleet/location/${busId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ lat, lng }),
    }).catch(() => {});
  };

  const stop = () => {
    if (watchIdRef.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setActive(false);
  };

  const start = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't available in this browser");
      return;
    }
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      (err) => setError(err.message),
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 10000 },
    );
    setActive(true);
  };

  useEffect(() => stop, []);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (active ? stop() : start())}
        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
          active ? "bg-emerald-400 text-emerald-950" : "bg-white/15 text-white hover:bg-white/25"
        }`}
      >
        {active ? "Reporting location…" : "Report my location"}
      </button>
      {error && <span className="text-xs text-red-200">{error}</span>}
    </div>
  );
}
