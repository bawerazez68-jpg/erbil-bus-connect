import { createFileRoute } from "@tanstack/react-router";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/Progress";
import { MapView } from "@/components/MapView";
import { BUSES, ROUTES } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useRequireRole } from "@/lib/auth";

export const Route = createFileRoute("/owner")({
  head: () => ({ meta: [{ title: "Owner — Bbina" }] }),
  component: OwnerPage,
});

function OwnerPage() {
  const { t } = useI18n();
  const { user, isLoading } = useRequireRole("owner");
  const totalSeats = BUSES.reduce((s, b) => s + b.seats, 0);
  const taken = BUSES.reduce((s, b) => s + b.taken, 0);
  if (isLoading || user?.role !== "owner") return null;
  return (
    <AnimatedGradient theme="owner">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("fleet")} value={BUSES.length} />
          <Stat label={t("passengersToday")} value={taken * 6} />
          <Stat label={t("revenue")} value={`${(taken * 6 * 0.5).toFixed(0)}k IQD`} />
          <Stat label={t("onTime")} value="92%" />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[480px]">
            <MapView showPassengers={false} />
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("fleet")}</h2>
              <button className="text-xs px-3 py-1.5 rounded-full bg-white text-orange-700 font-semibold">
                + {t("addBus")}
              </button>
            </div>
            <ul className="mt-3 space-y-3 max-h-[400px] overflow-auto">
              {BUSES.map((b) => {
                const r = ROUTES.find((x) => x.id === b.routeId)!;
                const pct = (b.taken / b.seats) * 100;
                return (
                  <li key={b.id} className="p-3 rounded-xl bg-white/10 border border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{b.label}</span>
                      <Badge tone="success">{t("active")}</Badge>
                    </div>
                    <div className="text-xs text-white/70 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />{" "}
                      {r.name}
                    </div>
                    <div className="mt-2">
                      <Progress value={pct} color="bg-amber-300" />
                      <div className="mt-1 text-xs text-white/70">
                        {b.taken}/{b.seats} {t("seats")} · {b.etaMin} {t("min")}
                      </div>
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
