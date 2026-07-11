import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Badge } from "@/components/Badge";
import { Stat } from "@/components/Stat";
import { MapView } from "@/components/MapView";
import { BusDetailPanel } from "@/components/BusDetailPanel";
import { AdsFeed } from "@/components/AdsFeed";
import { ROUTES } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useRequireRole } from "@/lib/auth";
import { useLiveFleet } from "@/lib/useLiveFleet";

export const Route = createFileRoute("/passenger")({
  head: () => ({ meta: [{ title: "Passenger — Bbina" }] }),
  component: PassengerPage,
});

function PassengerPage() {
  const { t } = useI18n();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const { user, isLoading } = useRequireRole("passenger");
  const { buses } = useLiveFleet();
  if (isLoading || user?.role !== "passenger") return null;

  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null;
  const nearbyCount = buses.length;

  return (
    <AnimatedGradient theme="passenger">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("activeBuses")} value={buses.length} sub={t("onTime")} />
          <Stat label={t("routes")} value={ROUTES.length} sub={t("downtown")} />
          <Stat label={t("nearbyBuses")} value={nearbyCount} />
          <Stat
            label={t("eta")}
            value={selectedBus ? `${Math.round(selectedBus.etaToGarageMin)} ${t("min")}` : "—"}
          />
        </div>

        <p className="mt-3 text-xs text-white/70">
          Tap the map to set your pickup point, then tap a bus for its live details and to rate it.
        </p>

        <div className="mt-4 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[520px]">
            <MapView
              highlightRouteId={selectedRoute}
              liveBuses={buses}
              myLocation={myLocation}
              onSetMyLocation={setMyLocation}
              onSelectBus={(id) => {
                setSelectedBusId(id);
                const bus = buses.find((b) => b.id === id);
                if (bus) setSelectedRoute(bus.routeId);
              }}
              etaOverlay={
                selectedBus
                  ? {
                      etaMin: selectedBus.etaToGarageMin,
                      distanceKm: selectedBus.remainingKm,
                      label: ROUTES.find((r) => r.id === selectedBus.routeId)?.name,
                    }
                  : null
              }
            />
          </GlassCard>
          <div className="space-y-4 max-h-[520px] overflow-auto">
            {selectedBus && (
              <BusDetailPanel
                bus={selectedBus}
                myLocation={myLocation}
                canRate
                onClose={() => setSelectedBusId(null)}
              />
            )}
            <GlassCard className="p-4">
              <h2 className="text-lg font-semibold mb-3">{t("routes")}</h2>
              <ul className="space-y-2">
                {ROUTES.map((r) => {
                  const routeBuses = buses.filter((b) => b.routeId === r.id);
                  const active = selectedRoute === r.id;
                  return (
                    <li key={r.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRoute(active ? null : r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            setSelectedRoute(active ? null : r.id);
                        }}
                        className={`w-full text-start p-3 rounded-xl border transition cursor-pointer ${
                          active
                            ? "bg-white/25 border-white/40"
                            : "bg-white/5 border-white/15 hover:bg-white/15"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ background: r.color }}
                            />
                            <span className="font-medium">{r.name}</span>
                          </div>
                          <Badge tone="success">{routeBuses.length} buses</Badge>
                        </div>
                        <div className="mt-1 space-y-1">
                          {routeBuses.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBusId(b.id);
                              }}
                              className="w-full flex items-center justify-between text-xs text-white/70 hover:text-white"
                            >
                              <span>
                                {b.label} · {b.taken}/{b.seats} {t("seats")}
                              </span>
                              <span>
                                {Math.round(b.etaToGarageMin)} {t("min")}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassCard>
            <AdsFeed />
          </div>
        </div>
      </main>
    </AnimatedGradient>
  );
}
