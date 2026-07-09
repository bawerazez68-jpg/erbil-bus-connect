import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/Progress";
import { MapView } from "@/components/MapView";
import { AdsFeed } from "@/components/AdsFeed";
import { AUDIT_ALERTS, ROUTES, type AuditAlert } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useAuth, useRequireRole } from "@/lib/auth";
import { useLiveFleet, etaToPoint } from "@/lib/useLiveFleet";

type Penalty = {
  id: string;
  busId: string;
  routeId: string;
  reason: string;
  minutesLate: number;
  createdAt: number;
};

export const Route = createFileRoute("/auditor")({
  head: () => ({ meta: [{ title: "Auditor — Bbina" }] }),
  component: AuditorPage,
});

function AuditorPage() {
  const { t } = useI18n();
  const { accessToken } = useAuth();
  const { user, isLoading } = useRequireRole("auditor");
  const { buses, intervals } = useLiveFleet();
  const [alerts, setAlerts] = useState<AuditAlert[]>(AUDIT_ALERTS);
  const [focus, setFocus] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<[number, number] | null>(null);

  const [intervalRoute, setIntervalRoute] = useState(ROUTES[0]?.id ?? "");
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [intervalStatus, setIntervalStatus] = useState<string | null>(null);

  const [penaltyBus, setPenaltyBus] = useState("");
  const [penaltyReason, setPenaltyReason] = useState("");
  const [penaltyMinutes, setPenaltyMinutes] = useState(5);
  const [penaltyStatus, setPenaltyStatus] = useState<string | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);

  const open = alerts.filter((a) => a.status === "open");
  const onRoute =
    buses.length - new Set(open.filter((a) => a.type === "deviation").map((a) => a.busId)).size;
  const integrity = Math.max(
    0,
    100 -
      open.reduce((s, a) => s + (a.severity === "high" ? 12 : a.severity === "medium" ? 6 : 2), 0),
  );

  const clear = (id: string) =>
    setAlerts((xs) => xs.map((a) => (a.id === id ? { ...a, status: "cleared" } : a)));

  const sevTone = (s: AuditAlert["severity"]) =>
    s === "high" ? "danger" : s === "medium" ? "warn" : "default";

  const loadPenalties = async () => {
    if (!accessToken) return;
    const res = await fetch("/api/fleet/penalties", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPenalties(data.penalties);
    }
  };

  useEffect(() => {
    void loadPenalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const submitInterval = async () => {
    if (!accessToken) return;
    setIntervalStatus(null);
    try {
      const res = await fetch("/api/fleet/intervals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ routeId: intervalRoute, intervalMinutes }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to set interval");
      setIntervalStatus("Interval updated.");
    } catch (err) {
      setIntervalStatus(err instanceof Error ? err.message : "Failed to set interval");
    }
  };

  const submitPenalty = async () => {
    if (!accessToken || !penaltyBus || !penaltyReason.trim()) return;
    setPenaltyStatus(null);
    try {
      const res = await fetch("/api/fleet/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          busId: penaltyBus,
          reason: penaltyReason,
          minutesLate: penaltyMinutes,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Failed to record penalty");
      setPenaltyStatus("Penalty recorded.");
      setPenaltyReason("");
      void loadPenalties();
    } catch (err) {
      setPenaltyStatus(err instanceof Error ? err.message : "Failed to record penalty");
    }
  };

  if (isLoading || user?.role !== "auditor") return null;

  return (
    <AnimatedGradient theme="auditor">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("onRoute")} value={`${onRoute}/${buses.length}`} />
          <Stat label={t("flagged")} value={open.length} />
          <Stat
            label={t("ghostRider")}
            value={open.filter((a) => a.type === "ghost").reduce((s) => s + 5, 0)}
          />
          <Stat label={t("integrityScore")} value={`${integrity}%`} />
        </div>

        <p className="mt-3 text-xs text-white/70">
          Tap the map to set your checkpoint location and see each bus's ETA to you.
        </p>

        <div className="mt-4 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[480px]">
            <MapView
              showPassengers
              highlightRouteId={focus}
              liveBuses={buses}
              myLocation={checkpoint}
              onSetMyLocation={setCheckpoint}
            />
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("recentAlerts")}</h2>
              <Badge tone="warn">
                {open.length} {t("flagged")}
              </Badge>
            </div>
            <p className="text-xs text-white/70 mt-1">{t("auditDesc")}</p>
            <ul className="mt-3 space-y-3 max-h-[400px] overflow-auto">
              {alerts.map((a) => {
                const r = ROUTES.find((x) => x.id === a.routeId)!;
                return (
                  <li
                    key={a.id}
                    onMouseEnter={() => setFocus(a.routeId)}
                    onMouseLeave={() => setFocus(null)}
                    className="p-3 rounded-xl bg-white/10 border border-white/20"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">
                        {a.busId} · {r.name}
                      </span>
                      <Badge tone={a.status === "cleared" ? "success" : sevTone(a.severity)}>
                        {a.status === "cleared"
                          ? t("cleared")
                          : t(
                              a.type === "deviation"
                                ? "deviation"
                                : a.type === "ghost"
                                  ? "ghostRider"
                                  : "offRoute",
                            )}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/80 mt-1">{a.note}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                      <span>
                        {a.minutesAgo} {t("min")}
                      </span>
                      {a.status === "open" && (
                        <button
                          onClick={() => clear(a.id)}
                          className="px-3 py-1 rounded-full bg-white text-violet-900 font-semibold"
                        >
                          {t("investigate")} ✓
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </div>

        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <GlassCard className="p-4">
            <h2 className="text-lg font-semibold">Live fleet — gaps &amp; checkpoint ETA</h2>
            <ul className="mt-3 space-y-2 max-h-[340px] overflow-auto">
              {buses.map((b) => {
                const eta = checkpoint ? etaToPoint(b, checkpoint) : null;
                return (
                  <li
                    key={b.id}
                    className="p-3 rounded-xl bg-white/10 border border-white/20 text-sm"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {b.label} · {b.driverName}
                      </span>
                      <Badge>{ROUTES.find((r) => r.id === b.routeId)?.name}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      {b.gapAheadMin != null
                        ? `${b.gapAheadKm!.toFixed(2)} km / ${Math.round(b.gapAheadMin)} min behind lead bus`
                        : "Lead bus on route"}
                      {eta && ` · ${Math.round(eta.etaMin)} min to my checkpoint`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-4">
              <h2 className="text-lg font-semibold">Set route interval</h2>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <select
                  value={intervalRoute}
                  onChange={(e) => setIntervalRoute(e.target.value)}
                  className="text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white"
                >
                  {ROUTES.map((r) => (
                    <option key={r.id} value={r.id} className="text-slate-900">
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="w-20 text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                />
                <span className="text-xs text-white/70">minutes</span>
                <button
                  onClick={submitInterval}
                  className="text-xs px-3 py-2 rounded-full bg-white text-violet-900 font-semibold"
                >
                  Set interval
                </button>
              </div>
              {intervalStatus && <p className="mt-2 text-xs text-white/80">{intervalStatus}</p>}
            </GlassCard>

            <GlassCard className="p-4">
              <h2 className="text-lg font-semibold">Penalize a bus for lateness</h2>
              <div className="mt-3 flex flex-col gap-2">
                <select
                  value={penaltyBus}
                  onChange={(e) => setPenaltyBus(e.target.value)}
                  className="text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white"
                >
                  <option value="" className="text-slate-900">
                    Select bus…
                  </option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-900">
                      {b.label} — {b.driverName}
                    </option>
                  ))}
                </select>
                <input
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Reason (e.g. missed checkpoint window)"
                  maxLength={300}
                  className="text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 placeholder-white/40"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={penaltyMinutes}
                    onChange={(e) => setPenaltyMinutes(Number(e.target.value))}
                    className="w-20 text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                  />
                  <span className="text-xs text-white/70">minutes late</span>
                  <button
                    onClick={submitPenalty}
                    disabled={!penaltyBus || !penaltyReason.trim()}
                    className="ml-auto text-xs px-3 py-2 rounded-full bg-white text-rose-800 font-semibold disabled:opacity-50"
                  >
                    Issue penalty
                  </button>
                </div>
                {penaltyStatus && <p className="text-xs text-white/80">{penaltyStatus}</p>}
              </div>
              {penalties.length > 0 && (
                <ul className="mt-3 space-y-1 max-h-[160px] overflow-auto text-xs text-white/80">
                  {penalties.map((p) => (
                    <li key={p.id} className="p-2 rounded-lg bg-white/10">
                      {p.busId} · {p.minutesLate} min late — {p.reason}
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </div>

        <div className="mt-4">
          <AdsFeed />
        </div>

        <div className="mt-4">
          <GlassCard className="p-4">
            <h2 className="text-lg font-semibold">{t("auditTitle")}</h2>
            <ul className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ROUTES.map((r) => {
                const routeAlerts = open.filter((a) => a.routeId === r.id).length;
                const score = Math.max(0, 100 - routeAlerts * 18);
                return (
                  <li key={r.id} className="p-3 rounded-xl bg-white/10 border border-white/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <Badge tone={routeAlerts ? "warn" : "success"}>
                        {routeAlerts ? `${routeAlerts}` : t("onRoute")}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <Progress value={score} color="bg-violet-300" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </div>
      </main>
    </AnimatedGradient>
  );
}
