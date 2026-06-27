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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    signup(name, email, role);
    nav({ to: `/${role}` as any });
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
            <button className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold hover:scale-[1.02] transition">
              {t("continue")}
            </button>
          </form>
        </GlassCard>
      </main>
    </AnimatedGradient>
  );
}