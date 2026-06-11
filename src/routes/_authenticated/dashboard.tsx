// لوحة مدير المحطة - Toggles + Kill-switch + مشاركة
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchFuelTypes, fetchCities } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { AlertTriangle, Check, LogOut, MapPin, Plus, Share2, Loader2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة المحطة — بانزين الأنبار" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type MyStation = {
  id: string; name: string; slug: string; status: string; city_id: string;
};

type Status = { station_id: string; fuel_type_id: number; is_available: boolean; crowd_level: "خفيف"|"متوسط"|"شديد"; last_updated: string };
const CROWD_LEVELS: Array<"خفيف"|"متوسط"|"شديد"> = ["خفيف", "متوسط", "شديد"];
const CROWD_BTN: Record<string, string> = {
  "خفيف": "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  "متوسط": "bg-amber-500/20 text-amber-300 border-amber-500/40",
  "شديد": "bg-red-500/20 text-red-300 border-red-500/40",
};

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["my-stations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("stations").select("id,name,slug,status,city_id").eq("owner_id", user.id);
      if (error) throw error;
      return (data ?? []) as MyStation[];
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (roles?.some((r) => r.role === "super_admin")) setIsAdmin(true);
    });
  }, []);

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          {isAdmin && <Link to="/admin" className="glass rounded-xl px-3 py-2 text-xs font-semibold">لوحة الإدارة</Link>}
          <button onClick={logout} className="glass grid h-10 w-10 place-items-center rounded-xl" aria-label="خروج">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <h1 className="mt-6 text-xl font-bold">محطاتي</h1>
      <p className="text-xs text-muted-foreground">حدّث توفر الوقود فوراً ليراه المواطنون على الخريطة.</p>

      {isLoading ? (
        <div className="mt-6 grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : stations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 space-y-3">
          {stations.map((s) => <StationCard key={s.id} station={s} onChange={() => qc.invalidateQueries({ queryKey: ["my-stations"] })} />)}
          <AddStationButton />
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="glass mt-6 rounded-2xl p-6 text-center">
      <MapPin className="mx-auto h-10 w-10 text-primary" />
      <p className="mt-3 text-sm font-semibold">لا توجد محطات مسجلة باسمك بعد</p>
      <p className="mt-1 text-xs text-muted-foreground">سجّل محطتك ليراجعها المدير العام ويفعّلها على الخريطة.</p>
      <AddStationButton />
    </div>
  );
}

function AddStationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">
        <Plus className="h-4 w-4" /> إضافة محطة جديدة
      </button>
      {open && <AddStationDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddStationDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(false);

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(p.coords.latitude.toFixed(6)); setLng(p.coords.longitude.toFixed(6)); },
      () => toast.error("تعذر الحصول على الموقع"),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");
      const slug = `${name}-${Date.now().toString(36)}`.toLowerCase().replace(/[^\w\u0600-\u06ff]+/g, "-").slice(0, 100);
      const { error } = await supabase.from("stations").insert({
        owner_id: user.id,
        city_id: cityId,
        name,
        address,
        slug,
        location: `SRID=4326;POINT(${lng} ${lat})` as any,
        status: "Pending",
      });
      if (error) throw error;
      toast.success("تم إرسال طلب المحطة للمراجعة");
      qc.invalidateQueries({ queryKey: ["my-stations"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "فشل الإرسال");
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong fixed inset-x-4 top-1/2 z-50 max-w-md -translate-y-1/2 rounded-3xl p-6 md:left-1/2 md:right-auto md:-translate-x-1/2">
        <h2 className="text-lg font-bold">إضافة محطة جديدة</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المحطة"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان (مثال: شارع 20 - حي الجمعية)"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <select required value={cityId} onChange={(e) => setCityId(e.target.value)}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">اختر المدينة</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input required value={lat} onChange={(e) => setLat(e.target.value)} placeholder="خط العرض" dir="ltr"
              className="rounded-xl border border-border bg-input px-3 py-3 text-sm outline-none" />
            <input required value={lng} onChange={(e) => setLng(e.target.value)} placeholder="خط الطول" dir="ltr"
              className="rounded-xl border border-border bg-input px-3 py-3 text-sm outline-none" />
          </div>
          <button type="button" onClick={useMyLocation} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs">
            <MapPin className="h-3 w-3" /> استخدم موقعي الحالي
          </button>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">إلغاء</button>
            <button disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} إرسال للمراجعة
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function StationCard({ station, onChange }: { station: MyStation; onChange: () => void }) {
  const qc = useQueryClient();
  const { data: fuelTypes = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });
  const { data: statuses = [] } = useQuery({
    queryKey: ["station-status", station.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("station_fuel_status").select("*").eq("station_id", station.id);
      if (error) throw error;
      return (data ?? []) as Status[];
    },
  });

  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const toggle = async (fuelId: number, current: boolean) => {
    setSavingId(fuelId);
    const { error } = await supabase
      .from("station_fuel_status")
      .upsert({ station_id: station.id, fuel_type_id: fuelId, is_available: !current });
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    setSavedId(fuelId);
    setTimeout(() => setSavedId(null), 1500);
    qc.invalidateQueries({ queryKey: ["station-status", station.id] });
  };

  const setCrowd = async (fuelId: number, level: "خفيف"|"متوسط"|"شديد", isAvailable: boolean) => {
    const { error } = await supabase
      .from("station_fuel_status")
      .upsert({ station_id: station.id, fuel_type_id: fuelId, is_available: isAvailable, crowd_level: level });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["station-status", station.id] });
  };

  const killAll = async () => {
    if (!confirm("سيتم تعليم كل أنواع الوقود غير متوفرة. هل تريد المتابعة؟")) return;
    const { error } = await supabase
      .from("station_fuel_status")
      .upsert(fuelTypes.map((ft) => ({ station_id: station.id, fuel_type_id: ft.id, is_available: false })));
    if (error) { toast.error(error.message); return; }
    toast.success("تم تعليم كل الأنواع غير متوفرة");
    qc.invalidateQueries({ queryKey: ["station-status", station.id] });
  };

  const share = async () => {
    const url = `${window.location.origin}/s/${station.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: station.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("تم نسخ رابط المحطة"); }
    } catch { /* */ }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold">{station.name}</h3>
            <StatusBadge status={station.status} />
          </div>
          <Link to="/s/$slug" params={{ slug: station.slug }} className="mt-1 inline-block text-[10px] text-muted-foreground hover:text-primary">/s/{station.slug}</Link>
        </div>
        <button onClick={share} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary/60" aria-label="مشاركة">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {station.status === "Active" ? (
        <>
          <div className="mt-4 space-y-2">
            {fuelTypes.map((ft) => {
              const st = statuses.find((s) => s.fuel_type_id === ft.id);
              const on = !!st?.is_available;
              return (
                <div key={ft.id} className="rounded-xl bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{ft.name}</span>
                      {savedId === ft.id && <span className="flex items-center gap-1 text-[10px] text-primary"><Check className="h-3 w-3" /> محفوظ</span>}
                      {st && <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(st.last_updated), { addSuffix: true, locale: ar })}</span>}
                    </div>
                    <button
                      onClick={() => toggle(ft.id, on)}
                      disabled={savingId === ft.id}
                      role="switch"
                      aria-checked={on}
                      className={`relative h-7 w-14 shrink-0 rounded-full transition ${on ? "bg-primary shadow-[var(--shadow-glow-primary)]" : "bg-white/15"}`}
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-7"}`} />
                    </button>
                  </div>
                  {/* اختيار مستوى الازدحام */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">الازدحام:</span>
                    {CROWD_LEVELS.map((lvl) => {
                      const active = (st?.crowd_level ?? "خفيف") === lvl;
                      return (
                        <button
                          key={lvl}
                          onClick={() => setCrowd(ft.id, lvl, on)}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${active ? CROWD_BTN[lvl] : "border-border bg-transparent text-muted-foreground hover:bg-secondary/60"}`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={killAll} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-bold text-destructive transition active:scale-95">
            <AlertTriangle className="h-4 w-4" /> إيقاف طارئ — تعليم الكل غير متوفر
          </button>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">المحطة بانتظار الموافقة من إدارة المنصة.</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    Active: { label: "نشطة", cls: "bg-primary/20 text-primary" },
    Pending: { label: "قيد المراجعة", cls: "bg-yellow-500/20 text-yellow-400" },
    Suspended: { label: "موقوفة", cls: "bg-destructive/20 text-destructive" },
  };
  const c = map[status] ?? map.Pending;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>{c.label}</span>;
}
