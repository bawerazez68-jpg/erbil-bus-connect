/** Waze-style bottom card floating over the map: arrival time + distance/duration to the destination. */
export function MapEtaOverlay({
  etaMin,
  distanceKm,
  label,
}: {
  etaMin: number;
  distanceKm: number;
  label?: string;
}) {
  const arrival = new Date(Date.now() + etaMin * 60_000);
  const arrivalLabel = arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-3 px-3">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white text-slate-900 shadow-2xl px-5 py-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-bold leading-none tabular-nums">{arrivalLabel}</div>
            <div className="mt-1 text-sm text-slate-500">
              {distanceKm.toFixed(1)} km · {Math.round(etaMin)} min
            </div>
          </div>
          {label && (
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
