// صفحة المصادقة - دخول / تسجيل مع إنشاء محطة في خطوة واحدة
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCities, fetchFuelTypes, DAYS, defaultWorkingHours, type WorkingHours, type DaySchedule } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { TimePickerAr } from "@/components/TimePickerAr";
import { toast } from "sonner";
import { Loader2, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_FUELS = [
  "بانزين محسن",
  "بانزين عادي",
  "كاز",
  "نفط أبيض",
  "غاز LPG",
  "غاز الطبخ",
];

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول صاحب المحطة — بانزين الأنبار" },
      { name: "description", content: "تسجيل دخول أصحاب المحطات لتحديث توفر الوقود لحظياً." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const translateAuthError = (err: any): { title: string; hint?: string } => {
  const code = (err?.code ?? err?.error_code ?? "").toString().toLowerCase();
  const msg = (err?.message ?? "").toString().toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return { title: "بيانات الدخول غير صحيحة", hint: "تأكّد من البريد وكلمة المرور." };
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return { title: "البريد الإلكتروني غير مُؤكَّد بعد", hint: "افتح بريدك واضغط رابط التأكيد." };
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("user already"))
    return { title: "هذا البريد مُسجَّل مسبقاً", hint: "بدّل إلى وضع «دخول»." };
  if (code === "weak_password" || msg.includes("password should be at least") || msg.includes("weak password"))
    return { title: "كلمة المرور ضعيفة", hint: "6 أحرف على الأقل." };
  if (code === "over_request_rate_limit" || msg.includes("rate limit") || msg.includes("too many"))
    return { title: "محاولات كثيرة", hint: "انتظر دقيقة ثم أعد المحاولة." };
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return { title: "تعذّر الاتصال بالخادم", hint: "تحقّق من الإنترنت." };
  return { title: err?.message ?? "حدث خطأ غير متوقّع" };
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // signup
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [stationName, setStationName] = useState("");
  const [address, setAddress] = useState("");
  const [locationText, setLocationText] = useState("");
  const [cityId, setCityId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [customFuel, setCustomFuel] = useState("");
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);
  const [showHours, setShowHours] = useState(false);

  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: dbFuels = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });

  // دمج أنواع الوقود من قاعدة البيانات مع القائمة الافتراضية
  const allFuelNames = Array.from(new Set([...dbFuels.map((f) => f.name), ...DEFAULT_FUELS]));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error("متصفحك لا يدعم تحديد الموقع"); return; }
    setLocLoading(true);
    toast.info("جاري طلب إذن الموقع...", { id: "loc" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setLocationText(`${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`);
        setLocLoading(false);
        toast.success("تم تحديد موقعك بنجاح", { id: "loc" });
      },
      (err) => {
        setLocLoading(false);
        toast.dismiss("loc");
        if (err.code === 1) {
          toast.error("تم رفض إذن الموقع", { description: "افتح إعدادات المتصفح واسمح بالوصول للموقع" });
        } else {
          toast.error("تعذّر تحديد الموقع", { description: "أدخل الإحداثيات يدوياً" });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const toggleFuel = (name: string) =>
    setSelectedFuels((prev) => prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]);

  const addCustomFuel = () => {
    const n = customFuel.trim();
    if (!n) return;
    if (!selectedFuels.includes(n)) setSelectedFuels((prev) => [...prev, n]);
    setCustomFuel("");
  };

  const updateDay = (key: string, field: keyof DaySchedule, value: string | boolean) =>
    setWorkingHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!lat || !lng) { toast.error("يجب تحديد موقع المحطة"); setLoading(false); return; }
        if (!cityId) { toast.error("يجب اختيار المدينة"); setLoading(false); return; }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { name: ownerName, phone } },
        });
        if (error) throw error;
        const user = signUpData.user;
        if (!user) throw new Error("لم يتم إنشاء الحساب");

        const { data: stationData, error: insErr } = await supabase.from("stations").insert({
          owner_id: user.id,
          city_id: cityId,
          name: stationName,
          address: address + (locationText ? ` — ${locationText}` : ""),
          phone,
          slug: "",
          location: `SRID=4326;POINT(${lng} ${lat})` as any,
          status: "Pending",
          working_hours: workingHours,
        }).select("id").single();
        if (insErr) throw insErr;

        if (selectedFuels.length > 0 && stationData?.id) {
          const matchedFuels = dbFuels.filter((f) => selectedFuels.includes(f.name));
          if (matchedFuels.length > 0) {
            await supabase.from("station_fuel_status").upsert(
              matchedFuels.map((f) => ({
                station_id: stationData.id,
                fuel_type_id: f.id,
                is_available: true,
                crowd_level: "خفيف",
              }))
            );
          }
          const unmatched = selectedFuels.filter((n) => !dbFuels.some((f) => f.name === n));
          if (unmatched.length > 0) {
            await supabase.from("station_products").insert(
              unmatched.map((name, i) => ({ station_id: stationData.id, name, display_order: i }))
            );
          }
        }
        toast.success("تم إنشاء حسابك وإرسال محطتك للمراجعة");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const { title, hint } = translateAuthError(err);
      toast.error(title, { description: hint });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-bold">
          {mode === "login" ? "دخول صاحب المحطة" : "تسجيل محطة جديدة"}
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {mode === "login" ? "أدخل بيانات حسابك لإدارة محطتك" : "سجّل حسابك ومحطتك بخطوة واحدة"}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              {/* 1 — اسم المالك (خاص بالإدارة) */}
              <div>
                <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="اسمك الكامل"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">لا يظهر للعامة — للإدارة فقط</p>
              </div>

              {/* 2 — رقم الهاتف (خاص بالإدارة) */}
              <div>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="رقم هاتفك" type="tel" dir="ltr"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">لا يظهر للعامة — للمنصة فقط</p>
              </div>

              {/* 3 — اسم المحطة */}
              <input required value={stationName} onChange={(e) => setStationName(e.target.value)}
                placeholder="اسم المحطة"
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

              {/* 4 — المدينة — تم إصلاح ظهور النص */}
              <select required value={cityId} onChange={(e) => setCityId(e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                style={{ colorScheme: "dark" }}>
                <option value="" className="bg-[#0f1827] text-foreground">اختر المدينة</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0f1827] text-foreground">{c.name_ar}</option>
                ))}
              </select>

              {/* 5 — العنوان */}
              <input required value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="العنوان التفصيلي (مثال: شارع 20، حي النضال)"
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

              {/* 6 — المنتوج — قائمة كاملة بالأنواع الستة */}
              <div className="rounded-xl border border-border bg-input p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">المنتوج — اختر ما تبيعه</p>
                <div className="space-y-1.5">
                  {allFuelNames.map((name) => {
                    const sel = selectedFuels.includes(name);
                    return (
                      <label key={name}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          sel ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-foreground hover:bg-secondary/30"
                        }`}>
                        <input type="checkbox" className="sr-only" checked={sel} onChange={() => toggleFuel(name)} />
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          sel ? "border-primary bg-primary" : "border-muted-foreground/50"
                        }`}>
                          {sel && <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-primary-foreground"><path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        {name}
                      </label>
                    );
                  })}
                </div>
                {/* إضافة منتوج مخصص */}
                <div className="mt-2 flex gap-2">
                  <input value={customFuel} onChange={(e) => setCustomFuel(e.target.value)}
                    placeholder="أضف منتجاً غير موجود في القائمة..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFuel(); } }} />
                  <button type="button" onClick={addCustomFuel}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 hover:bg-secondary text-foreground">
                    <span className="text-lg leading-none">+</span>
                  </button>
                </div>
              </div>

              {/* 7 — الموقع نصاً */}
              <input value={locationText} onChange={(e) => setLocationText(e.target.value)}
                placeholder="وصف الموقع (مثال: قرب مستشفى الرمادي) — اختياري"
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

              {/* 8 — زر الموقع الحالي */}
              <button type="button" onClick={useMyLocation} disabled={locLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold transition hover:bg-secondary/40 disabled:opacity-60">
                {locLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الحصول على موقعك...</>
                  : <><MapPin className="h-4 w-4" /> استخدم موقعك الحالي</>}
              </button>

              {/* عرض الإحداثيات أو حقول يدوية */}
              {lat && lng ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
                  <p className="text-xs font-semibold text-primary">✓ الموقع: {lat}, {lng}</p>
                  <button type="button" onClick={() => { setLat(""); setLng(""); }}
                    className="text-[10px] text-muted-foreground underline">تغيير</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="خط العرض (Lat)" dir="ltr"
                    className="rounded-xl border border-border bg-input px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="خط الطول (Lng)" dir="ltr"
                    className="rounded-xl border border-border bg-input px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}

              {/* 9 — أوقات العمل (قابل للطي) */}
              <div className="overflow-hidden rounded-xl border border-border bg-input">
                <button type="button" onClick={() => setShowHours(!showHours)}
                  className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold">
                  <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> أوقات العمل الأسبوعية</span>
                  {showHours ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showHours && (
                  <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                    {DAYS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="flex w-[72px] shrink-0 cursor-pointer items-center gap-1.5">
                          <input type="checkbox" checked={workingHours[key]?.open ?? true}
                            onChange={(e) => updateDay(key, "open", e.target.checked)}
                            className="h-3.5 w-3.5 accent-primary" />
                          <span className="text-[11px] font-medium">{label}</span>
                        </label>
                        {workingHours[key]?.open ? (
                          <div className="flex flex-1 flex-wrap items-center gap-1">
                            <TimePickerAr
                              value={workingHours[key]?.from ?? "08:00"}
                              onChange={(v) => updateDay(key, "from", v)}
                            />
                            <span className="text-[10px] text-muted-foreground">—</span>
                            <TimePickerAr
                              value={workingHours[key]?.to ?? "22:00"}
                              onChange={(v) => updateDay(key, "to", v)}
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">مغلق</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 10 — البريد الإلكتروني */}
          <input required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني" type="email" dir="ltr"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

          {/* 11 — كلمة المرور */}
          <input required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور" type="password" minLength={6} dir="ltr"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

          <button disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] transition active:scale-95 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "دخول" : "إنشاء حساب ومحطة"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "login" ? "ليس لديك حساب؟ سجّل محطتك" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </main>
  );
}
