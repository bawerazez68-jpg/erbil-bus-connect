import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bbina — Smart bus tracking for Erbil" },
      { name: "description", content: "Live 3D bus tracking across Erbil's 7 routes for passengers, owners and advertisers." },
      { property: "og:title", content: "Bbina — Smart bus tracking for Erbil" },
      { property: "og:description", content: "Live 3D bus tracking across Erbil's 7 routes." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();
  return (
    <AnimatedGradient theme="brand">
      <AppHeader />
      <main className="px-4 sm:px-8 pb-16 max-w-6xl mx-auto">
        <section className="text-center pt-12 pb-16 text-white">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-white/15 border border-white/25 backdrop-blur">
            Erbil · العراق · هەولێر
          </span>
          <h1 className="mt-5 text-5xl sm:text-6xl font-extrabold tracking-tight">
            {t("appName")}
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/85 max-w-xl mx-auto">
            {t("tagline")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="px-6 py-3 rounded-full bg-white text-violet-900 font-semibold shadow-xl hover:scale-105 transition"
            >
              {t("heroCta")}
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-full bg-white/10 border border-white/30 text-white font-medium backdrop-blur hover:bg-white/20 transition"
            >
              {t("login")}
            </Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-4">
          {[
            { t: t("feature1"), d: t("feature1desc"), icon: "🗺️" },
            { t: t("feature2"), d: t("feature2desc"), icon: "👥" },
            { t: t("feature3"), d: t("feature3desc"), icon: "🌐" },
          ].map((f) => (
            <GlassCard key={f.t} className="p-6">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-white/80">{f.d}</p>
            </GlassCard>
          ))}
        </section>
      </main>
    </AnimatedGradient>
  );
}
