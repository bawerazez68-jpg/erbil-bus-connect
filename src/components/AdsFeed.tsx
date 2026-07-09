import { useAds } from "@/lib/useAds";
import { GlassCard } from "./GlassCard";
import { Badge } from "./Badge";

/** Shared ad feed shown on the passenger/owner/auditor dashboards. Records a view once per ad and lets any viewer like it. */
export function AdsFeed() {
  const { ads, error, toggleLike } = useAds();

  if (error) return null;
  if (ads.length === 0) return null;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70 mb-3">
        Sponsored
      </h3>
      <div className="space-y-3">
        {ads.map((ad) => (
          <div key={ad.id} className="p-3 rounded-lg bg-white/10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">{ad.title}</h4>
                <Badge>{ad.advertiserName}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm text-white/80">{ad.body}</p>
            <button
              type="button"
              onClick={() => void toggleLike(ad.id)}
              className={`mt-2 text-sm flex items-center gap-1 ${
                ad.likedByMe ? "text-rose-300" : "text-white/60 hover:text-white"
              }`}
            >
              {ad.likedByMe ? "♥" : "♡"} {ad.likeCount}
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
