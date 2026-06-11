// لوحة المدير العام - مراجعة الطلبات + تعليق المحطات + الشكاوى
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Check, X, Ban, ArrowLeft, ShieldAlert, Phone, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة العامة — بانزين الأنبار" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type S = { id: string; name: string; slug: string; status: string; created_at: string; city_id: string; phone: string | null };
type Complaint = { id: string; station_id: string; reporter_name: string | null; reporter_phone: string; reason: string; status: string; admin_notes: string | null; created_at: string };

function AdminPage() {
  const qc = useQueryClient();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"stations" | "complaints">("stations");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setAllowed(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      setAllowed(!!roles?.some((r) => r.role === "super_admin"));
    });
  }, []);

  const { data: stations = [] } = useQuery({
    queryKey: ["admin-stations"],
    enabled: allowed === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("id,name,slug,status,created_at,city_id,phone").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as S[];
    },
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ["admin-complaints"],
    enabled: allowed === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Complaint[];
    },
  });

  const setStatus = async (id: string, status: "Active" | "Suspended" | "Pending") => {
    const { error } = await supabase.from("stations").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم"); qc.invalidateQueries({ queryKey: ["admin-stations"] });
  };
  const setComplaintStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("complaints").update({ status: status as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-complaints"] });
  };

  if (allowed === null) return <main className="grid min-h-[100dvh] place-items-center"><div className="text-sm text-muted-foreground">جاري التحقق...</div></main>;
  if (!allowed) return (
    <main className="grid min-h-[100dvh] place-items-center p-4">
      <div className="glass-strong max-w-md rounded-3xl p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-lg font-bold">صلاحية غير كافية</h1>
        <Link to="/dashboard" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">العودة</Link>
      </div>
    </main>
  );

  const pending = stations.filter((s) => s.status === "Pending");
  const others = stations.filter((s) => s.status !== "Pending");
  const openComplaints = complaints.filter((c) => c.status === "open");

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Logo />
        <Link to="/dashboard" className="glass flex items-center gap-1 rounded-xl px-3 py-2 text-xs"><ArrowLeft className="h-3 w-3" /> العودة</Link>
      </header>

      <h1 className="mt-6 text-xl font-bold">لوحة الإدارة العامة</h1>

      <div className="glass mt-4 flex gap-1 rounded-2xl p-1">
        <button onClick={() => setTab("stations")} className={`flex-1 rounded-xl py-2 text-xs font-bold ${tab === "stations" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          المحطات ({pending.length} قيد المراجعة)
        </button>
        <button onClick={() => setTab("complaints")} className={`flex-1 rounded-xl py-2 text-xs font-bold ${tab === "complaints" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          الشكاوى ({openComplaints.length} جديدة)
        </button>
      </div>

      {tab === "stations" ? (
        <>
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold text-yellow-400">قيد المراجعة ({pending.length})</h2>
            <div className="space-y-2">
              {pending.length === 0 ? <p className="text-xs text-muted-foreground">لا طلبات</p> :
                pending.map((s) => (
                  <div key={s.id} className="glass flex items-center justify-between gap-2 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">/s/{s.slug}{s.phone ? ` · ${s.phone}` : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStatus(s.id, "Active")} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label="موافقة"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setStatus(s.id, "Suspended")} className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/20 text-destructive" aria-label="رفض"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-bold">باقي المحطات ({others.length})</h2>
            <div className="space-y-2">
              {others.map((s) => (
                <div key={s.id} className="glass flex items-center justify-between gap-2 rounded-xl p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{s.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.status === "Active" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>{s.status === "Active" ? "نشطة" : "موقوفة"}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">/s/{s.slug}{s.phone ? ` · ${s.phone}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.phone && <a href={`tel:${s.phone}`} className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/60" aria-label="اتصال"><Phone className="h-3 w-3" /></a>}
                    {s.status === "Active" ? (
                      <button onClick={() => setStatus(s.id, "Suspended")} className="flex items-center gap-1 rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive"><Ban className="h-3 w-3" /> تعليق</button>
                    ) : (
                      <button onClick={() => setStatus(s.id, "Active")} className="flex items-center gap-1 rounded-xl bg-primary/15 px-3 py-2 text-xs text-primary"><Check className="h-3 w-3" /> تفعيل</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="mt-6 space-y-2">
          {complaints.length === 0 ? <p className="text-xs text-muted-foreground">لا شكاوى</p> :
            complaints.map((c) => {
              const st = stations.find((s) => s.id === c.station_id);
              return (
                <div key={c.id} className="glass rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-yellow-400" />
                        <p className="truncate text-xs font-bold">{st?.name ?? "محطة"}</p>
                      </div>
                      <p className="mt-1 text-sm">{c.reason}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        من: {c.reporter_name ?? "مجهول"} · <a href={`tel:${c.reporter_phone}`} dir="ltr" className="text-primary">{c.reporter_phone}</a> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    <select value={c.status} onChange={(e) => setComplaintStatus(c.id, e.target.value)}
                      className="shrink-0 rounded-lg border border-border bg-input px-2 py-1 text-[10px]">
                      <option value="open">جديدة</option>
                      <option value="reviewing">قيد المراجعة</option>
                      <option value="resolved">مُحلَّت</option>
                      <option value="rejected">مرفوضة</option>
                    </select>
                  </div>
                </div>
              );
            })}
        </section>
      )}
    </main>
  );
}
