import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar" | "ku";

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  en: {
    appName: "Bbina",
    tagline: "Smart bus tracking for Erbil",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    email: "Email",
    password: "Password",
    name: "Full name",
    role: "I am a",
    passenger: "Passenger",
    owner: "Bus Owner",
    advertiser: "Advertiser",
    auditor: "Bus Auditor",
    continue: "Continue",
    welcome: "Welcome",
    liveMap: "Live Map",
    nearbyBuses: "Nearby buses",
    routes: "Routes",
    eta: "ETA",
    min: "min",
    seats: "Seats",
    fleet: "Fleet",
    revenue: "Revenue",
    onTime: "On time",
    activeBuses: "Active buses",
    passengersToday: "Passengers today",
    addBus: "Add bus",
    campaigns: "Campaigns",
    impressions: "Impressions",
    clicks: "Clicks",
    budget: "Budget",
    newCampaign: "New campaign",
    status: "Status",
    active: "Active",
    paused: "Paused",
    downtown: "Downtown Garage",
    chooseRole: "Choose your role",
    chooseRoleDesc: "Pick how you want to use Bbina today.",
    overview: "Overview",
    map: "Map",
    dashboard: "Dashboard",
    backHome: "Back to home",
    heroCta: "Get started",
    feature1: "Live 3D map",
    feature1desc: "Track every bus across Erbil in real time.",
    feature2: "Four roles",
    feature2desc: "Passengers, owners, advertisers and auditors.",
    feature3: "Trilingual",
    feature3desc: "English, Arabic and Kurdish with full RTL.",
    audits: "Audits",
    auditTitle: "Route Integrity",
    auditDesc: "Verify each bus stays on its assigned route — flag deviations and ticket fraud.",
    onRoute: "On route",
    offRoute: "Off route",
    flagged: "Flagged",
    cleared: "Cleared",
    investigate: "Investigate",
    deviation: "Deviation",
    ghostRider: "Unscanned riders",
    integrityScore: "Integrity score",
    recentAlerts: "Recent alerts",
  },
  ar: {
    appName: "بينا",
    tagline: "تتبع ذكي للحافلات في أربيل",
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    logout: "تسجيل الخروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    name: "الاسم الكامل",
    role: "أنا",
    passenger: "راكب",
    owner: "مالك حافلة",
    advertiser: "معلن",
    auditor: "مدقق الحافلات",
    continue: "متابعة",
    welcome: "مرحباً",
    liveMap: "الخريطة المباشرة",
    nearbyBuses: "حافلات قريبة",
    routes: "المسارات",
    eta: "الوقت المتوقع",
    min: "دقيقة",
    seats: "المقاعد",
    fleet: "الأسطول",
    revenue: "الإيرادات",
    onTime: "في الوقت",
    activeBuses: "حافلات نشطة",
    passengersToday: "ركاب اليوم",
    addBus: "إضافة حافلة",
    campaigns: "الحملات",
    impressions: "المشاهدات",
    clicks: "النقرات",
    budget: "الميزانية",
    newCampaign: "حملة جديدة",
    status: "الحالة",
    active: "نشط",
    paused: "متوقف",
    downtown: "كراج وسط المدينة",
    chooseRole: "اختر دورك",
    chooseRoleDesc: "اختر كيف تريد استخدام بينا اليوم.",
    overview: "نظرة عامة",
    map: "خريطة",
    dashboard: "لوحة التحكم",
    backHome: "العودة للرئيسية",
    heroCta: "ابدأ الآن",
    feature1: "خريطة ثلاثية الأبعاد",
    feature1desc: "تتبع كل حافلة في أربيل لحظة بلحظة.",
    feature2: "أربعة أدوار",
    feature2desc: "للركاب والمالكين والمعلنين والمدققين.",
    feature3: "ثلاث لغات",
    feature3desc: "إنجليزية وعربية وكردية مع دعم كامل لليمين إلى اليسار.",
    audits: "التدقيقات",
    auditTitle: "سلامة المسار",
    auditDesc: "تحقق من التزام كل حافلة بمسارها — رصد الانحرافات والاحتيال في التذاكر.",
    onRoute: "على المسار",
    offRoute: "خارج المسار",
    flagged: "مُعلَّم",
    cleared: "تمت المراجعة",
    investigate: "تحقيق",
    deviation: "انحراف",
    ghostRider: "ركاب بلا تذكرة",
    integrityScore: "درجة السلامة",
    recentAlerts: "تنبيهات حديثة",
  },
  ku: {
    appName: "بینا",
    tagline: "شوێنپێهەڵگرتنی زیرەکی پاسەکان لە هەولێر",
    login: "چوونەژوورەوە",
    signup: "تۆمارکردن",
    logout: "دەرچوون",
    email: "ئیمەیڵ",
    password: "وشەی نهێنی",
    name: "ناوی تەواو",
    role: "من",
    passenger: "سەرنشین",
    owner: "خاوەن پاس",
    advertiser: "ڕیکلامکار",
    auditor: "پشکنەری پاس",
    continue: "بەردەوامبە",
    welcome: "بەخێربێیت",
    liveMap: "نەخشەی ڕاستەوخۆ",
    nearbyBuses: "پاسەکانی نزیک",
    routes: "ڕێگاکان",
    eta: "کاتی گەیشتن",
    min: "خولەک",
    seats: "کورسییەکان",
    fleet: "فلیت",
    revenue: "داهات",
    onTime: "لە کاتی خۆیدا",
    activeBuses: "پاسە چالاکەکان",
    passengersToday: "سەرنشینەکانی ئەمڕۆ",
    addBus: "زیادکردنی پاس",
    campaigns: "هەڵمەتەکان",
    impressions: "بینین",
    clicks: "کلیک",
    budget: "بودجە",
    newCampaign: "هەڵمەتی نوێ",
    status: "دۆخ",
    active: "چالاک",
    paused: "ڕاگیراو",
    downtown: "گەراجی ناوەند",
    chooseRole: "ڕۆڵی خۆت هەڵبژێرە",
    chooseRoleDesc: "هەڵبژێرە چۆن دەتەوێت بینا بەکاربهێنیت.",
    overview: "گشتی",
    map: "نەخشە",
    dashboard: "داشبۆرد",
    backHome: "گەڕانەوە بۆ ماڵەوە",
    heroCta: "دەستپێبکە",
    feature1: "نەخشەی سێ ڕەهەندی",
    feature1desc: "هەموو پاسێک لە هەولێر بەشێوەی ڕاستەوخۆ بەدوادابچە.",
    feature2: "چوار ڕۆڵ",
    feature2desc: "بۆ سەرنشین، خاوەن، ڕیکلامکار و پشکنەر.",
    feature3: "سێ زمان",
    feature3desc: "ئینگلیزی، عەرەبی و کوردی بە پشتگیری تەواو RTL.",
    audits: "پشکنینەکان",
    auditTitle: "دروستی ڕێگا",
    auditDesc: "دڵنیابە کە هەر پاسێک لە ڕێگای دیاریکراوی خۆیدا دەمێنێت — هەڵە و فێڵکاری بدۆزەرەوە.",
    onRoute: "لەسەر ڕێگا",
    offRoute: "دەرەوەی ڕێگا",
    flagged: "نیشانکراو",
    cleared: "پاککراوە",
    investigate: "لێکۆڵینەوە",
    deviation: "لادان",
    ghostRider: "سەرنشینی بێ بلیت",
    integrityScore: "خاڵی دروستی",
    recentAlerts: "ئاگادارییە نوێیەکان",
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof translations.en) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("bbina_lang")) as Lang | null;
    if (stored && ["en", "ar", "ku"].includes(stored)) setLangState(stored);
  }, []);

  const dir: "ltr" | "rtl" = lang === "en" ? "ltr" : "rtl";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang, dir]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("bbina_lang", l);
  };

  const t = (key: keyof typeof translations.en) =>
    translations[lang][key] ?? translations.en[key] ?? String(key);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}