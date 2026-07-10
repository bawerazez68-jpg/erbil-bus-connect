import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { useMyAds } from "@/lib/useAds";

export const Route = createFileRoute("/advertiser")({
  head: () => ({ meta: [{ title: "Advertiser — Bbina" }] }),
  component: AdvertiserPage,
});

function AdvertiserPage() {
  const { t } = useI18n();
  const { user, isLoading } = useRequireRole("advertiser");
  const { ads, error: adsError, createAd, setStatus } = useMyAds();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const totalImp = CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const totalSpent = CAMPAIGNS.reduce((s, c) => s + c.spent, 0);
  if (isLoading || user?.role !== "advertiser") return null;

  const submitAd = async () => {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await createAd(title.trim(), body.trim());
      setTitle("");
      setBody("");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post ad");
    } finally {
      setPosting(false);
    }
  };
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
              <button className="text-xs px-3 py-1.5 rounded-full bg-white text-emerald-800 font-semibold">
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
                      <Progress value={pct} color="bg-teal-300" />
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

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <h2 className="text-lg font-semibold">Post an ad</h2>
            <p className="mt-1 text-xs text-white/70">
              Shown to passengers, owners, and auditors on their dashboards.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              maxLength={120}
              className="mt-3 w-full text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 placeholder-white/40"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What do you want to share?"
              maxLength={1000}
              rows={3}
              className="mt-2 w-full text-sm rounded-lg bg-white/10 border border-white/20 px-3 py-2 placeholder-white/40"
            />
            {postError && <p className="mt-1 text-xs text-red-200">{postError}</p>}
            <button
              onClick={() => void submitAd()}
              disabled={!title.trim() || !body.trim() || posting}
              className="mt-3 w-full py-2 rounded-lg bg-white text-emerald-800 font-semibold text-sm disabled:opacity-50"
            >
              {posting ? "Posting…" : "Share ad"}
            </button>
          </GlassCard>

          <GlassCard className="lg:col-span-2 p-4">
            <h2 className="text-lg font-semibold">Your ads</h2>
            {adsError && <p className="mt-1 text-xs text-red-200">{adsError}</p>}
            {ads.length === 0 ? (
              <p className="mt-3 text-sm text-white/60">You haven't posted any ads yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {ads.map((ad) => (
                  <li key={ad.id} className="p-3 rounded-xl bg-white/10 border border-white/20">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium">{ad.title}</span>
                      <Badge tone={ad.status === "active" ? "success" : "warn"}>{ad.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-white/70">{ad.body}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-white/80">
                      <span>👁 {ad.viewCount} views</span>
                      <span>♥ {ad.likeCount} likes</span>
                    </div>
                    <button
                      onClick={() =>
                        void setStatus(ad.id, ad.status === "active" ? "paused" : "active")
                      }
                      className="mt-2 text-xs px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 font-semibold"
                    >
                      {ad.status === "active" ? "Pause" : "Resume"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </main>
    </AnimatedGradient>
  );
}
