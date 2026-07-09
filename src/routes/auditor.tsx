import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/Progress";
import { MapView } from "@/components/MapView";
import { AUDIT_ALERTS, BUSES, ROUTES, type AuditAlert } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useRequireRole } from "@/lib/auth";

export const Route = createFileRoute("/auditor")({
  head: () => ({ meta: [{ title: "Auditor — Bbina" }] }),
  component: AuditorPage,
});

function AuditorPage() {
  const { t } = useI18n();
  const { user, isLoading } = useRequireRole("auditor");
  const [alerts, setAlerts] = useState<AuditAlert[]>(AUDIT_ALERTS);
  const [focus, setFocus] = useState<string | null>(null);

  const open = alerts.filter((a) => a.status === "open");
  const onRoute =
    BUSES.length - new Set(open.filter((a) => a.type === "deviation").map((a) => a.busId)).size;
  const integrity = Math.max(
    0,
    100 -
      open.reduce((s, a) => s + (a.severity === "high" ? 12 : a.severity === "medium" ? 6 : 2), 0),
  );

  const clear = (id: string) =>
    setAlerts((xs) => xs.map((a) => (a.id === id ? { ...a, status: "cleared" } : a)));

  const sevTone = (s: AuditAlert["severity"]) =>
    s === "high" ? "danger" : s === "medium" ? "warn" : "default";

  if (isLoading || user?.role !== "auditor") return null;

  return (
    <AnimatedGradient theme="auditor">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("onRoute")} value={`${onRoute}/${BUSES.length}`} />
          <Stat label={t("flagged")} value={open.length} />
          <Stat
            label={t("ghostRider")}
            value={open.filter((a) => a.type === "ghost").reduce((s) => s + 5, 0)}
          />
          <Stat label={t("integrityScore")} value={`${integrity}%`} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[480px]">
            <MapView showPassengers={false} highlightRouteId={focus} />
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
                          className="px-3 py-1 rounded-full bg-white text-emerald-800 font-semibold"
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
                      <Progress value={score} color="bg-emerald-300" />
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
