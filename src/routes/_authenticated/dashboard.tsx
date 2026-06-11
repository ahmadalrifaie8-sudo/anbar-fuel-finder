// لوحة صاحب المحطة - دعم محطات متعددة + منتجات + شكاوى + أوقات العمل
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchCities, fetchFuelTypes, DAYS, defaultWorkingHours, type WorkingHours, type DaySchedule, type StationProduct } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { TimePickerAr } from "@/components/TimePickerAr";
import { toast } from "sonner";
import { AlertTriangle, Check, LogOut, Plus, Share2, Loader2, Trash2, Save, MessageSquare, Package, Settings, MapPin, Clock, Pencil, X, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة المحطة — بانزين الأنبار" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type MyStation = { id: string; name: string; slug: string; status: string; city_id: string; address: string; phone: string | null; rejection_note?: string | null; working_hours?: WorkingHours };
type Status = { station_id: string; fuel_type_id: number; is_available: boolean; crowd_level: "خفيف"|"متوسط"|"شديد"; last_updated: string };
type Complaint = { id: string; reporter_name: string | null; reporter_phone: string; reason: string; status: string; created_at: string };

// أنواع الوقود الافتراضية — تُستخدم كـ fallback إذا لم تكتمل قاعدة البيانات
const DEFAULT_FUELS = [
  "بانزين محسن",
  "بانزين عادي",
  "كاز",
  "نفط أبيض",
  "غاز LPG",
  "غاز الطبخ",
];

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
  const [tab, setTab] = useState<"fuel" | "info" | "products" | "complaints">("fuel");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["my-stations"],
    queryFn: async (): Promise<MyStation[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("stations")
        .select("id,name,slug,status,city_id,address,phone,rejection_note,working_hours")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyStation[];
    },
  });

  // Auto-select first station when loaded
  useEffect(() => {
    if (stations.length > 0 && !selectedId) setSelectedId(stations[0].id);
  }, [stations]);

  const station = stations.find((s) => s.id === selectedId) ?? stations[0] ?? null;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (roles?.some((r) => r.role === "super_admin")) setIsAdmin(true);
    });
  }, []);

  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-stations"] });

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          {isAdmin && <Link to="/admin" className="glass rounded-xl px-3 py-2 text-xs font-semibold">لوحة الإدارة</Link>}
          <button onClick={() => setAddOpen(true)} className="glass flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold">
            <Plus className="h-3 w-3" /> محطة
          </button>
          <button onClick={logout} className="glass grid h-10 w-10 place-items-center rounded-xl" aria-label="خروج">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="mt-6 grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : stations.length === 0 ? (
        <div className="glass mt-8 rounded-2xl p-6 text-center">
          <p className="text-sm">لا توجد محطة مسجلة باسمك.</p>
          <button onClick={() => setAddOpen(true)} className="mt-3 flex items-center gap-1 mx-auto rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
            <Plus className="h-3 w-3" /> أضف محطتك الأولى
          </button>
        </div>
      ) : (
        <>
          {/* Station Selector */}
          {stations.length > 1 && (
            <div className="glass mt-4 flex gap-1 overflow-x-auto rounded-2xl p-1">
              {stations.map((s) => (
                <button key={s.id} onClick={() => { setSelectedId(s.id); setTab("fuel"); }}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${selectedId === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {station && (
            <>
              <div className="mt-6 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-xl font-bold">{station.name}</h1>
                    <StatusBadge status={station.status} />
                  </div>
                  <Link to="/s/$slug" params={{ slug: station.slug }} className="text-[11px] text-muted-foreground hover:text-primary">/s/{station.slug}</Link>
                </div>
                <ShareBtn slug={station.slug} name={station.name} />
              </div>

              {station.status === "Pending" && (
                <div className="glass mt-3 rounded-xl p-3 text-xs text-yellow-300">
                  ⏳ محطتك بانتظار موافقة الإدارة قبل ظهورها للعموم.
                </div>
              )}
              {station.status === "Suspended" && (
                <div className="glass mt-3 rounded-xl p-3 text-xs text-destructive">
                  ⚠ تم تعليق المحطة.
                  {station.rejection_note && (
                    <p className="mt-1 font-semibold">ملاحظة الإدارة: {station.rejection_note}</p>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="glass mt-5 flex gap-1 rounded-2xl p-1">
                {[
                  { k: "fuel", label: "الوقود", icon: Check },
                  { k: "products", label: "المنتجات", icon: Package },
                  { k: "info", label: "البيانات", icon: Settings },
                  { k: "complaints", label: "الشكاوى", icon: MessageSquare },
                ].map((t) => (
                  <button key={t.k} onClick={() => setTab(t.k as any)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition ${tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    <t.icon className="h-3 w-3" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {tab === "fuel" && <FuelTab stationId={station.id} disabled={station.status !== "Active"} />}
                {tab === "products" && <ProductsTab stationId={station.id} />}
                {tab === "info" && <InfoTab station={station} onSaved={refresh} />}
                {tab === "complaints" && <ComplaintsTab stationId={station.id} />}
              </div>
            </>
          )}
        </>
      )}

      {addOpen && <AddStationModal onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); refresh(); }} />}
    </main>
  );
}

function ShareBtn({ slug, name }: { slug: string; name: string }) {
  const share = async () => {
    const url = `${window.location.origin}/s/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else { await navigator.clipboard.writeText(url); toast.success("تم نسخ رابط المحطة"); }
    } catch { /* */ }
  };
  return <button onClick={share} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary/60" aria-label="مشاركة"><Share2 className="h-4 w-4" /></button>;
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

function FuelTab({ stationId, disabled }: { stationId: string; disabled: boolean }) {
  const qc = useQueryClient();
  const { data: fuelTypes = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });
  const { data: statuses = [] } = useQuery({
    queryKey: ["station-status", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("station_fuel_status").select("*").eq("station_id", stationId);
      if (error) throw error;
      return (data ?? []) as Status[];
    },
  });
  const [savingId, setSavingId] = useState<number | null>(null);

  const toggle = async (fuelId: number, current: boolean) => {
    setSavingId(fuelId);
    const { error } = await supabase.from("station_fuel_status").upsert({ station_id: stationId, fuel_type_id: fuelId, is_available: !current });
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["station-status", stationId] });
  };
  const setCrowd = async (fuelId: number, level: "خفيف"|"متوسط"|"شديد", isAvailable: boolean) => {
    const { error } = await supabase.from("station_fuel_status").upsert({ station_id: stationId, fuel_type_id: fuelId, is_available: isAvailable, crowd_level: level });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["station-status", stationId] });
  };
  const killAll = async () => {
    if (!confirm("سيتم تعليم كل أنواع الوقود غير متوفرة. متابعة؟")) return;
    const { error } = await supabase.from("station_fuel_status").upsert(fuelTypes.map((ft) => ({ station_id: stationId, fuel_type_id: ft.id, is_available: false })));
    if (error) { toast.error(error.message); return; }
    toast.success("تم"); qc.invalidateQueries({ queryKey: ["station-status", stationId] });
  };

  if (disabled) return <p className="text-xs text-muted-foreground">سيتم تفعيل هذه الإعدادات بعد موافقة الإدارة.</p>;

  return (
    <div className="space-y-2">
      {fuelTypes.map((ft) => {
        const st = statuses.find((s) => s.fuel_type_id === ft.id);
        const on = !!st?.is_available;
        return (
          <div key={ft.id} className="glass rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{ft.name}</span>
                {st && <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(st.last_updated), { addSuffix: true, locale: ar })}</span>}
              </div>
              <button onClick={() => toggle(ft.id, on)} disabled={savingId === ft.id} role="switch" aria-checked={on}
                className={`relative h-7 w-14 shrink-0 rounded-full transition ${on ? "bg-primary shadow-[var(--shadow-glow-primary)]" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-7"}`} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">الازدحام:</span>
              {CROWD_LEVELS.map((lvl) => {
                const active = (st?.crowd_level ?? "خفيف") === lvl;
                return (
                  <button key={lvl} onClick={() => setCrowd(ft.id, lvl, on)}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${active ? CROWD_BTN[lvl] : "border-border bg-transparent text-muted-foreground hover:bg-secondary/60"}`}>
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <button onClick={killAll} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-bold text-destructive">
        <AlertTriangle className="h-4 w-4" /> إيقاف طارئ — الكل غير متوفر
      </button>
    </div>
  );
}

function ProductsTab({ stationId }: { stationId: string }) {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("station_products").select("*").eq("station_id", stationId).order("display_order");
      if (error) throw error;
      return (data ?? []) as StationProduct[];
    },
  });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const { error } = await supabase.from("station_products").insert({
      station_id: stationId, name, price: price ? Number(price) : null, display_order: products.length,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setPrice(""); toast.success("تمت الإضافة");
    qc.invalidateQueries({ queryKey: ["products", stationId] });
  };

  const startEdit = (p: StationProduct) => {
    setEditingId(p.id); setEditName(p.name); setEditPrice(p.price !== null ? String(p.price) : "");
  };

  const saveEdit = async (p: StationProduct) => {
    const { error } = await supabase.from("station_products").update({
      name: editName, price: editPrice ? Number(editPrice) : null,
    }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null); toast.success("تم التعديل");
    qc.invalidateQueries({ queryKey: ["products", stationId] });
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنتج؟")) return;
    const { error } = await supabase.from("station_products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["products", stationId] });
  };

  const toggleAvail = async (p: StationProduct) => {
    const { error } = await supabase.from("station_products").update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["products", stationId] });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="glass flex gap-2 rounded-xl p-2">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المنتج"
          className="flex-1 rounded-lg bg-input px-3 py-2 text-sm outline-none" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر" type="number" step="0.01" dir="ltr"
          className="w-24 rounded-lg bg-input px-3 py-2 text-sm outline-none" />
        <button disabled={adding} className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground" aria-label="إضافة">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">لا منتجات — أضف ما تبيعه</p>
      ) : products.map((p) => (
        <div key={p.id} className="glass rounded-xl p-3">
          {editingId === p.id ? (
            <div className="flex items-center gap-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="flex-1 rounded-lg bg-input px-2 py-1.5 text-sm outline-none" />
              <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} placeholder="السعر" type="number" step="0.01" dir="ltr"
                className="w-24 rounded-lg bg-input px-2 py-1.5 text-sm outline-none" />
              <button onClick={() => saveEdit(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Save className="h-3.5 w-3.5" /></button>
              <button onClick={() => setEditingId(null)} className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/60"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                {p.price !== null && <p className="text-xs text-muted-foreground">{p.price.toLocaleString("ar-IQ")} د.ع</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAvail(p)} role="switch" aria-checked={p.is_available}
                  className={`relative h-6 w-12 shrink-0 rounded-full transition ${p.is_available ? "bg-primary" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.is_available ? "right-0.5" : "right-6"}`} />
                </button>
                <button onClick={() => startEdit(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/60" aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(p.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/20 text-destructive" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InfoTab({ station, onSaved }: { station: MyStation; onSaved: () => void }) {
  const [name, setName] = useState(station.name);
  const [phone, setPhone] = useState(station.phone ?? "");
  const [address, setAddress] = useState(station.address);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    station.working_hours && Object.keys(station.working_hours).length > 0
      ? station.working_hours
      : defaultWorkingHours()
  );
  const [showHours, setShowHours] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateDay = (key: string, field: keyof DaySchedule, value: string | boolean) =>
    setWorkingHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("stations").update({ name, phone, address, working_hours: workingHours }).eq("id", station.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block text-xs text-muted-foreground">اسم المحطة
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>
      <label className="block text-xs text-muted-foreground">هاتف المحطة (يظهر في صفحة المحطة)
        <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>
      <label className="block text-xs text-muted-foreground">العنوان
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>

      {/* أوقات العمل */}
      <div className="overflow-hidden rounded-xl border border-border">
        <button type="button" onClick={() => setShowHours(!showHours)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold">
          <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> أوقات العمل</span>
          {showHours ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showHours && (
          <div className="space-y-1.5 border-t border-border px-3 pb-3 pt-2">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="flex w-[72px] shrink-0 cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={workingHours[key]?.open ?? true}
                    onChange={(e) => updateDay(key, "open", e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary" />
                  <span className="text-[11px] font-medium">{label}</span>
                </label>
                {workingHours[key]?.open ? (
                  <div className="flex flex-1 items-center gap-1">
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

      <p className="text-[10px] text-muted-foreground">الرابط الثابت: <span dir="ltr">/s/{station.slug}</span></p>
      <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
      </button>
    </form>
  );
}

function ComplaintsTab({ stationId }: { stationId: string }) {
  const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    open:       { label: "جديدة", cls: "bg-yellow-500/20 text-yellow-400" },
    reviewing:  { label: "قيد المراجعة", cls: "bg-blue-500/20 text-blue-400" },
    resolved:   { label: "محلولة", cls: "bg-primary/20 text-primary" },
    rejected:   { label: "مرفوضة", cls: "bg-destructive/20 text-destructive" },
  };
  const { data: items = [] } = useQuery({
    queryKey: ["complaints", stationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").eq("station_id", stationId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Complaint[];
    },
  });
  if (items.length === 0) return <p className="text-center text-xs text-muted-foreground">لا شكاوى — أداؤك ممتاز</p>;
  return (
    <div className="space-y-2">
      {items.map((c) => {
        const s = STATUS_LABELS[c.status] ?? { label: c.status, cls: "bg-secondary/60 text-foreground" };
        return (
          <div key={c.id} className="glass rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{c.reason}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              من: {c.reporter_name ?? "مجهول"} · <span dir="ltr">{c.reporter_phone}</span> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ========== نموذج إضافة محطة جديدة (modal) ==========
function AddStationModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: dbFuels = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });

  // دمج أنواع الوقود من قاعدة البيانات مع القائمة الافتراضية
  const allFuelNames = Array.from(new Set([
    ...dbFuels.map((f) => f.name),
    ...DEFAULT_FUELS,
  ]));

  const [loading, setLoading] = useState(false);
  const [stationName, setStationName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  // الوقود المحدد = قائمة أسماء
  const [selectedFuelNames, setSelectedFuelNames] = useState<string[]>([]);
  const [customFuel, setCustomFuel] = useState("");
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours);
  const [showHours, setShowHours] = useState(false);

  const getLocation = () => {
    if (!navigator.geolocation) { toast.error("المتصفح لا يدعم تحديد الموقع"); return; }
    setLocLoading(true);
    toast.info("جاري طلب إذن الموقع...", { id: "loc-modal" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setLocLoading(false);
        toast.success("تم تحديد موقعك بنجاح", { id: "loc-modal" });
      },
      (err) => {
        setLocLoading(false);
        toast.dismiss("loc-modal");
        if (err.code === 1) toast.error("تم رفض إذن الموقع", { description: "افتح إعدادات المتصفح واسمح بالوصول" });
        else toast.error("تعذّر تحديد الموقع", { description: "أدخل الإحداثيات يدوياً" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const toggleFuel = (name: string) =>
    setSelectedFuelNames((prev) => prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]);

  const addCustomFuel = () => {
    const n = customFuel.trim();
    if (!n) return;
    if (!selectedFuelNames.includes(n)) setSelectedFuelNames((prev) => [...prev, n]);
    setCustomFuel("");
  };

  const updateDay = (key: string, field: keyof DaySchedule, value: string | boolean) =>
    setWorkingHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lat || !lng) { toast.error("يجب تحديد الموقع"); return; }
    if (!cityId) { toast.error("يجب اختيار المدينة"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجّل");

      const { data: stationData, error } = await supabase.from("stations").insert({
        owner_id: user.id, city_id: cityId, name: stationName, address, phone,
        slug: "", location: `SRID=4326;POINT(${lng} ${lat})` as any,
        status: "Pending", working_hours: workingHours,
      }).select("id").single();
      if (error) throw error;

      // ربط أنواع الوقود المحددة بالمحطة
      if (selectedFuelNames.length > 0 && stationData?.id) {
        const matchedFuels = dbFuels.filter((f) => selectedFuelNames.includes(f.name));
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
        // إضافة المنتجات المخصصة غير الموجودة في جدول fuel_types
        const unmatched = selectedFuelNames.filter((n) => !dbFuels.some((f) => f.name === n));
        if (unmatched.length > 0) {
          await supabase.from("station_products").insert(
            unmatched.map((name, i) => ({ station_id: stationData.id, name, display_order: i }))
          );
        }
      }

      toast.success("تم إرسال طلب المحطة للمراجعة");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="glass-strong fixed inset-x-4 bottom-0 z-50 mx-auto max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8 shadow-2xl md:inset-x-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إضافة محطة جديدة</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {/* اسم المحطة */}
          <input required value={stationName} onChange={(e) => setStationName(e.target.value)}
            placeholder="اسم المحطة"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />

          {/* المدينة — fix: text-foreground + colorScheme dark */}
          <select required value={cityId} onChange={(e) => setCityId(e.target.value)}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            style={{ colorScheme: "dark" }}>
            <option value="" className="bg-[#0f1827] text-foreground">اختر المدينة</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0f1827] text-foreground">{c.name_ar}</option>
            ))}
          </select>

          {/* العنوان */}
          <input required value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="العنوان التفصيلي (مثال: شارع 20، حي النضال)"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />

          {/* هاتف المحطة */}
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="هاتف المحطة" type="tel" dir="ltr"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />

          {/* ===== المنتوج ===== */}
          <div className="rounded-xl border border-border bg-input p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">المنتوج — اختر ما تبيعه</p>
            <div className="space-y-1.5">
              {allFuelNames.map((name) => {
                const sel = selectedFuelNames.includes(name);
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
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/60 hover:bg-secondary">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ===== الموقع ===== */}
          <button type="button" onClick={getLocation} disabled={locLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold transition hover:bg-secondary/40 disabled:opacity-60">
            {locLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الحصول على موقعك...</>
              : <><MapPin className="h-4 w-4" /> استخدم موقعك الحالي</>}
          </button>

          {lat && lng ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <p className="text-xs font-semibold text-primary">✓ الموقع: {lat}, {lng}</p>
              <button type="button" onClick={() => { setLat(""); setLng(""); }}
                className="text-[10px] text-muted-foreground underline">تغيير</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="خط العرض" dir="ltr"
                className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none" />
              <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="خط الطول" dir="ltr"
                className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none" />
            </div>
          )}

          {/* ===== أوقات العمل ===== */}
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

          <button disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} إرسال طلب المحطة
          </button>
        </form>
      </div>
    </>
  );
}
