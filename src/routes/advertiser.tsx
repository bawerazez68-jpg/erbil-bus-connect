import { createFileRoute } from "@tanstack/react-router";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/Badge";
import { Progress } from "@/components/Progress";
import { MapView } from "@/components/MapView";
import { CAMPAIGNS } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";
import { useRequireRole } from "@/lib/auth";

export const Route = createFileRoute("/advertiser")({
  head: () => ({ meta: [{ title: "Advertiser — Bbina" }] }),
  component: AdvertiserPage,
});

function AdvertiserPage() {
  const { t } = useI18n();
  const { user, isLoading } = useRequireRole("advertiser");
  const totalImp = CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const totalSpent = CAMPAIGNS.reduce((s, c) => s + c.spent, 0);
  if (isLoading || user?.role !== "advertiser") return null;
  return (
    <AnimatedGradient theme="advertiser">
      <AppHeader />
      <main className="px-4 sm:px-8 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("campaigns")} value={CAMPAIGNS.length} />
          <Stat label={t("impressions")} value={totalImp.toLocaleString()} />
          <Stat
            label={t("clicks")}
            value={totalClicks.toLocaleString()}
            sub={`${((totalClicks / totalImp) * 100).toFixed(2)}% CTR`}
          />
          <Stat label={t("budget")} value={`$${totalSpent}`} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="lg:col-span-2 p-2 h-[480px]">
            <MapView showPassengers={false} />
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">{t("campaigns")}</h2>
              <button className="text-xs px-3 py-1.5 rounded-full bg-white text-purple-700 font-semibold">
                + {t("newCampaign")}
              </button>
            </div>
            <ul className="mt-3 space-y-3">
              {CAMPAIGNS.map((c) => {
                const pct = (c.spent / c.budget) * 100;
                return (
                  <li key={c.id} className="p-3 rounded-xl bg-white/10 border border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{c.name}</span>
                      <Badge tone={c.status === "active" ? "success" : "warn"}>
                        {t(c.status as any)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/80">
                      <div>
                        {t("impressions")}: {c.impressions.toLocaleString()}
                      </div>
                      <div>
                        {t("clicks")}: {c.clicks.toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Progress value={pct} color="bg-fuchsia-300" />
                      <div className="mt-1 text-xs text-white/70">
                        ${c.spent} / ${c.budget}
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
