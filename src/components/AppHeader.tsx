import { Link } from "@tanstack/react-router";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AvatarUpload } from "./AvatarUpload";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  return (
    <header className="flex items-center justify-between px-4 sm:px-8 py-4">
      <Link to="/" className="flex items-center gap-2 text-white">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur border border-white/30 text-lg">
          🚌
        </span>
        <span className="text-xl font-bold tracking-tight">{t("appName")}</span>
      </Link>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        {user && <AvatarUpload />}
        {user ? (
          <button
            onClick={logout}
            className="text-xs text-white/90 hover:text-white px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur"
          >
            {t("logout")}
          </button>
        ) : (
          <Link
            to="/login"
            className="text-xs text-white/90 hover:text-white px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur"
          >
            {t("login")}
          </Link>
        )}
      </div>
    </header>
  );
}
