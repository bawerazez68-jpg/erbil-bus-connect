import { useI18n, type Lang } from "@/lib/i18n";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ar", label: "العربية" },
  { code: "ku", label: "کوردی" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-full bg-white/10 backdrop-blur p-1 border border-white/20">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition ${
            lang === l.code
              ? "bg-white text-slate-900 shadow"
              : "text-white/80 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}