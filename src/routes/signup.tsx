import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { useI18n } from "@/lib/i18n";
import { useAuth, type Role } from "@/lib/auth";
import { RoleTabs, Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Bbina" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { t } = useI18n();
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("passenger");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await signup(name, email, password, role);
      nav({ to: `/${user.role}` as any });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedGradient theme={role}>
      <AppHeader />
      <main className="px-4 max-w-md mx-auto pt-8 pb-16">
        <GlassCard className="p-6">
          <h1 className="text-2xl font-bold">{t("signup")}</h1>
          <p className="text-sm text-white/70 mt-1">{t("chooseRoleDesc")}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <RoleTabs role={role} setRole={setRole} />
            <Field label={t("name")} value={name} onChange={setName} />
            <Field label={t("email")} type="email" value={email} onChange={setEmail} />
            <Field label={t("password")} type="password" value={password} onChange={setPassword} />
            <p className="text-xs text-white/60 -mt-2">
              At least 10 characters, with a letter and a number.
            </p>
            {error && (
              <p
                role="alert"
                className="text-sm text-red-200 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2"
              >
                {error}
              </p>
            )}
            <button
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100"
            >
              {submitting ? "…" : t("continue")}
            </button>
          </form>
        </GlassCard>
      </main>
    </AnimatedGradient>
  );
}
