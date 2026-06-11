// لوحة صاحب المحطة - محطة واحدة، تبويبات: بياناتها / المنتجات / الشكاوى
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchFuelTypes, type StationProduct } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { AlertTriangle, Check, LogOut, Plus, Share2, Loader2, Trash2, Save, MessageSquare, Package, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة المحطة — بانزين الأنبار" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type MyStation = { id: string; name: string; slug: string; status: string; city_id: string; address: string; phone: string | null };
type Status = { station_id: string; fuel_type_id: number; is_available: boolean; crowd_level: "خفيف"|"متوسط"|"شديد"; last_updated: string };
type Complaint = { id: string; reporter_name: string | null; reporter_phone: string; reason: string; status: string; created_at: string };

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

  const { data: station, isLoading } = useQuery({
    queryKey: ["my-station"],
    queryFn: async (): Promise<MyStation | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("stations")
        .select("id,name,slug,status,city_id,address,phone").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      return data as MyStation | null;
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

      {isLoading ? (
        <div className="mt-6 grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !station ? (
        <div className="glass mt-8 rounded-2xl p-6 text-center">
          <p className="text-sm">لا توجد محطة مسجلة باسمك.</p>
          <p className="mt-1 text-xs text-muted-foreground">سجّل خروجك ثم أنشئ حساباً جديداً مع بيانات محطتك.</p>
        </div>
      ) : (
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

          {station.status !== "Active" && (
            <p className="glass mt-3 rounded-xl p-3 text-xs text-yellow-300">
              المحطة بانتظار موافقة الإدارة قبل ظهورها للعموم.
            </p>
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
            {tab === "info" && <InfoTab station={station} onSaved={() => qc.invalidateQueries({ queryKey: ["my-station"] })} />}
            {tab === "complaints" && <ComplaintsTab stationId={station.id} />}
          </div>
        </>
      )}
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
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر (اختياري)" type="number" step="0.01" dir="ltr"
          className="w-28 rounded-lg bg-input px-3 py-2 text-sm outline-none" />
        <button disabled={adding} className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground" aria-label="إضافة">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </form>
      {products.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground">لا منتجات بعد — أضف ما تبيعه (وقود، خدمات، إلخ)</p>
      ) : products.map((p) => (
        <div key={p.id} className="glass flex items-center justify-between gap-2 rounded-xl p-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            {p.price !== null && <p className="text-xs text-muted-foreground">{p.price.toLocaleString("ar-IQ")} د.ع</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleAvail(p)} role="switch" aria-checked={p.is_available}
              className={`relative h-6 w-12 shrink-0 rounded-full transition ${p.is_available ? "bg-primary" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.is_available ? "right-0.5" : "right-6"}`} />
            </button>
            <button onClick={() => remove(p.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/20 text-destructive" aria-label="حذف">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoTab({ station, onSaved }: { station: MyStation; onSaved: () => void }) {
  const [name, setName] = useState(station.name);
  const [phone, setPhone] = useState(station.phone ?? "");
  const [address, setAddress] = useState(station.address);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("stations").update({ name, phone, address }).eq("id", station.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); onSaved();
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block text-xs text-muted-foreground">اسم المحطة
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>
      <label className="block text-xs text-muted-foreground">هاتف المحطة
        <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>
      <label className="block text-xs text-muted-foreground">العنوان
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none" />
      </label>
      <p className="text-[10px] text-muted-foreground">الرابط الثابت: <span dir="ltr">/s/{station.slug}</span></p>
      <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
      </button>
    </form>
  );
}

function ComplaintsTab({ stationId }: { stationId: string }) {
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
      {items.map((c) => (
        <div key={c.id} className="glass rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">{c.reason}</p>
            <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px]">{c.status}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            من: {c.reporter_name ?? "مجهول"} · <span dir="ltr">{c.reporter_phone}</span> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
          </p>
        </div>
      ))}
    </div>
  );
}
