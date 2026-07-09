import { createFileRoute } from "@tanstack/react-router";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/Progress";
import { MapView } from "@/components/MapView";
import { DriverLocationReporter } from "@/components/DriverLocationReporter";
import { ROUTES } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useRequireRole } from "@/lib/auth";
import { useLiveFleet } from "@/lib/useLiveFleet";

export const Route = createFileRoute("/owner")({
  head: () => ({ meta: [{ title: "Owner — Bbina" }] }),
  component: OwnerPage,
});

function OwnerPage() {
  const { t } = useI18n();
  const { user, isLoading } = useRequireRole("owner");
  const { buses, intervals } = useLiveFleet();
  const taken = buses.reduce((s, b) => s + b.taken, 0);
  const onTimeBuses = buses.filter(
    (b) => b.gapAheadMin == null || b.gapAheadMin <= targetIntervalFor(b.routeId, intervals) * 1.2,
  );
  const onTimePct = buses.length ? Math.round((onTimeBuses.length / buses.length) * 100) : 100;

  if (isLoading || user?.role !== "owner") return null;
  return (
    <AnimatedGradient theme="owner">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("fleet")} value={buses.length} />
          <Stat label={t("passengersToday")} value={taken * 6} />
          <Stat label={t("revenue")} value={`${(taken * 6 * 0.5).toFixed(0)}k IQD`} />
          <Stat label={t("onTime")} value={`${onTimePct}%`} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[480px]">
            <MapView showPassengers liveBuses={buses} />
          </GlassCard>
          <div className="space-y-4">
            <GlassCard className="p-4">
              <h2 className="text-lg font-semibold">Headway (set by auditor)</h2>
              <ul className="mt-3 space-y-2">
                {ROUTES.map((r) => {
                  const interval = intervals.find((i) => i.routeId === r.id);
                  const routeBuses = buses.filter((b) => b.routeId === r.id);
                  const actualGap =
                    routeBuses.find((b) => b.gapAheadMin != null)?.gapAheadMin ?? null;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/10"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <span className="text-xs text-white/70">
                        target {interval ? `${interval.intervalMinutes} min` : "not set"}
                        {actualGap != null && ` · actual ${Math.round(actualGap)} min`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("fleet")}</h2>
                <button className="text-xs px-3 py-1.5 rounded-full bg-white text-orange-700 font-semibold">
                  + {t("addBus")}
                </button>
              </div>
              <ul className="mt-3 space-y-3 max-h-[400px] overflow-auto">
                {buses.map((b) => {
                  const r = ROUTES.find((x) => x.id === b.routeId)!;
                  const pct = (b.taken / b.seats) * 100;
                  return (
                    <li key={b.id} className="p-3 rounded-xl bg-white/10 border border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{b.label}</span>
                        <Badge tone={b.source === "driver" ? "success" : "default"}>
                          {b.source === "driver" ? "Live GPS" : t("active")}
                        </Badge>
                      </div>
                      <div className="text-xs text-white/70 mt-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />{" "}
                        {r.name} · {b.driverName}
                      </div>
                      <div className="mt-2">
                        <Progress value={pct} color="bg-amber-300" />
                        <div className="mt-1 text-xs text-white/70">
                          {b.taken}/{b.seats} {t("seats")} · {Math.round(b.etaToGarageMin)}{" "}
                          {t("min")} to garage
                          {b.gapAheadMin != null &&
                            ` · ${Math.round(b.gapAheadMin)} min behind lead bus`}
                        </div>
                      </div>
                      <div className="mt-2">
                        <DriverLocationReporter busId={b.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>
          </div>
        </div>
      </main>
    </AnimatedGradient>
  );
}

function targetIntervalFor(
  routeId: string,
  intervals: { routeId: string; intervalMinutes: number }[],
): number {
  return intervals.find((i) => i.routeId === routeId)?.intervalMinutes ?? Infinity;
}
