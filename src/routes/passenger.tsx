import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/Badge";
import { Stat } from "@/components/Stat";
import { MapView } from "@/components/MapView";
import { BUSES, PASSENGERS, ROUTES } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/passenger")({
  head: () => ({ meta: [{ title: "Passenger — Bbina" }] }),
  component: PassengerPage,
});

function PassengerPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <AnimatedGradient theme="passenger">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("activeBuses")} value={BUSES.length} sub={t("onTime")} />
          <Stat label={t("routes")} value={ROUTES.length} sub={t("downtown")} />
          <Stat label={t("nearbyBuses")} value={PASSENGERS.length} />
          <Stat label={t("eta")} value={`6 ${t("min")}`} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[520px]">
            <MapView highlightRouteId={selected} />
          </GlassCard>
          <GlassCard className="p-4 max-h-[520px] overflow-auto">
            <h2 className="text-lg font-semibold mb-3">{t("routes")}</h2>
            <ul className="space-y-2">
              {ROUTES.map((r) => {
                const bus = BUSES.find((b) => b.routeId === r.id)!;
                const active = selected === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(active ? null : r.id)}
                      className={`w-full text-start p-3 rounded-xl border transition ${
                        active ? "bg-white/25 border-white/40" : "bg-white/5 border-white/15 hover:bg-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                          <span className="font-medium">{r.name}</span>
                        </div>
                        <Badge tone="success">{bus.etaMin} {t("min")}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-white/70">
                        {bus.label} · {bus.taken}/{bus.seats} {t("seats")}
                      </div>
                    </button>
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