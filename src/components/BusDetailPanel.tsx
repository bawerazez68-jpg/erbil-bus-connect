import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { etaToPoint, type LiveBus } from "@/lib/useLiveFleet";
import { ROUTES } from "@/lib/mockData";
import { GlassCard } from "./GlassCard";
import { Badge } from "./Badge";

type RatingSummary = { avgRating: number | null; count: number };

export function BusDetailPanel({
  bus,
  myLocation,
  canRate = false,
  onClose,
}: {
  bus: LiveBus;
  myLocation?: [number, number] | null;
  canRate?: boolean;
  onClose?: () => void;
}) {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const route = ROUTES.find((r) => r.id === bus.routeId);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch(`/api/ratings/summary/${bus.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bus.id, accessToken, status]);

  const submitRating = async () => {
    if (!accessToken || myRating < 1) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ busId: bus.id, rating: myRating, comment: comment || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to submit rating");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    }
  };

  const etaToMe = myLocation ? etaToPoint(bus, myLocation) : null;
  const etaToDestination = { distanceKm: 0, etaMin: bus.etaToGarageMin };

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{bus.label}</h3>
          <p className="text-xs text-white/70">Driver: {bus.driverName}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm">
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge>{route?.name ?? bus.routeId}</Badge>
        <Badge tone="success">
          {bus.taken}/{bus.seats} seats
        </Badge>
        {summary && summary.count > 0 ? (
          <Badge tone="warn">
            ★ {summary.avgRating?.toFixed(1)} ({summary.count})
          </Badge>
        ) : (
          <Badge>No ratings yet</Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 rounded-lg bg-white/10">
          <div className="text-[10px] uppercase text-white/60">ETA to destination</div>
          <div className="font-semibold">{Math.round(etaToDestination.etaMin)} min</div>
        </div>
        <div className="p-2 rounded-lg bg-white/10">
          <div className="text-[10px] uppercase text-white/60">ETA to me</div>
          <div className="font-semibold">
            {etaToMe ? `${Math.round(etaToMe.etaMin)} min` : "Set my location"}
          </div>
        </div>
      </div>

      {canRate && (
        <div className="mt-4 pt-3 border-t border-white/15">
          {status === "done" ? (
            <p className="text-sm text-emerald-200">
              Thanks — your rating was submitted anonymously.
            </p>
          ) : (
            <>
              <p className="text-xs text-white/70 mb-2">
                Rate this bus. Your identity is never shown to the driver or owner.
              </p>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMyRating(n)}
                    className={`text-2xl leading-none ${n <= myRating ? "text-amber-300" : "text-white/30"}`}
                    aria-label={`${n} star`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment"
                maxLength={500}
                rows={2}
                className="w-full text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 placeholder-white/40"
              />
              {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
              <button
                onClick={submitRating}
                disabled={myRating < 1 || status === "submitting"}
                className="mt-2 w-full py-2 rounded-lg bg-white text-slate-900 font-semibold text-sm disabled:opacity-50"
              >
                {status === "submitting" ? "Submitting…" : "Submit rating"}
              </button>
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
