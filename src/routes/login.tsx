import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { AppHeader } from "@/components/AppHeader";
import { GlassCard } from "@/components/GlassCard";
import { useI18n } from "@/lib/i18n";
import { useAuth, type Role } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Bbina" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("passenger");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    login(email, role);
    nav({ to: `/${role}` as any });
  };

  return (
    <AnimatedGradient theme={role}>
      <AppHeader />
      <main className="px-4 max-w-md mx-auto pt-8 pb-16">
        <GlassCard className="p-6">
          <h1 className="text-2xl font-bold">{t("login")}</h1>
          <p className="text-sm text-white/70 mt-1">{t("tagline")}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <RoleTabs role={role} setRole={setRole} />
            <Field label={t("email")} type="email" value={email} onChange={setEmail} />
            <Field label={t("password")} type="password" value={password} onChange={setPassword} />
            <button className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold hover:scale-[1.02] transition">
              {t("continue")}
            </button>
          </form>
        </GlassCard>
      </main>
    </AnimatedGradient>
  );
}

export function RoleTabs({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const { t } = useI18n();
  const roles: Role[] = ["passenger", "owner", "advertiser", "auditor"];
  return (
    <div className="grid grid-cols-4 gap-2 p-1 rounded-xl bg-white/10 border border-white/20">
      {roles.map((r) => (
        <button
          type="button"
          key={r}
          onClick={() => setRole(r)}
          className={`py-2 text-[11px] font-medium rounded-lg transition ${
            role === r ? "bg-white text-slate-900" : "text-white/80 hover:text-white"
          }`}
        >
          {t(r as any)}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/70 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required
        className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
      />
    </label>
  );
}