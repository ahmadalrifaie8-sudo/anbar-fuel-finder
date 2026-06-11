// صفحة المشاركة العامة للمحطة /s/$slug — مع المنتجات وزر بلاغ
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { fetchStationBySlug, submitComplaint } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { Check, Ban, Navigation, ArrowRight, AlertOctagon, Phone, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const result = await fetchStationBySlug(params.slug);
    if (!result) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => {
    const name = (loaderData as any)?.station?.name ?? "محطة وقود";
    const desc = `حالة الوقود الحالية في ${name} — منصة بانزين الأنبار`;
    return {
      meta: [
        { title: `${name} — بانزين الأنبار` },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/s/${params.slug}` },
        { property: "og:image", content: `/api/og/${params.slug}` },
        { name: "twitter:image", content: `/api/og/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}` }],
    };
  },
  notFoundComponent: () => <div className="grid min-h-[100dvh] place-items-center"><p>المحطة غير موجودة</p></div>,
  errorComponent: ({ error }) => <div className="grid min-h-[100dvh] place-items-center p-4 text-center"><p>{error.message}</p></div>,
  component: SharePage,
});

function SharePage() {
  const { station, statuses, products } = Route.useLoaderData() as any;
  const s = station;
  const [reportOpen, setReportOpen] = useState(false);

  const openDir = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank");

  return (
    <main className="min-h-[100dvh] p-4">
      <div className="mx-auto max-w-md">
        <Link to="/" className="glass mb-4 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs">
          <ArrowRight className="h-3 w-3" /> الخريطة العامة
        </Link>

        <div className="glass-strong rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-center"><Logo /></div>
          <h1 className="mt-6 text-center text-2xl font-bold">{s.name}</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">{s.address}</p>
          {s.phone && (
            <a href={`tel:${s.phone}`} className="mt-2 flex items-center justify-center gap-1 text-xs text-primary" dir="ltr">
              <Phone className="h-3 w-3" /> {s.phone}
            </a>
          )}

          <div className="mt-5 space-y-2">
            {statuses.map((st: any) => (
              <div key={st.fuel_type_id} className={`flex items-center justify-between rounded-xl border p-4 ${st.is_available ? "border-primary/40 bg-primary/10" : "border-destructive/30 bg-destructive/10"}`}>
                <div className="flex items-center gap-3">
                  {st.is_available ? <Check className="h-6 w-6 text-primary" /> : <Ban className="h-6 w-6 text-destructive" />}
                  <div>
                    <div className="font-bold">{st.fuel_types?.name}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(st.last_updated), { addSuffix: true, locale: ar })}</div>
                  </div>
                </div>
                <span className={`text-sm font-bold ${st.is_available ? "text-primary" : "text-destructive"}`}>
                  {st.is_available ? "متوفر" : "غير متوفر"}
                </span>
              </div>
            ))}
          </div>

          {products.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 text-sm font-bold">المنتجات والخدمات</h2>
              <div className="space-y-1.5">
                {products.map((p: any) => (
                  <div key={p.id} className={`flex items-center justify-between rounded-xl bg-secondary/40 p-2.5 ${!p.is_available ? "opacity-50" : ""}`}>
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.price !== null ? `${Number(p.price).toLocaleString("ar-IQ")} د.ع` : ""}
                      {!p.is_available && " · غير متوفر"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={openDir} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] active:scale-95">
            <Navigation className="h-4 w-4" /> توجيه عبر خرائط جوجل
          </button>

          <button onClick={() => setReportOpen(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 text-xs font-bold text-destructive">
            <AlertOctagon className="h-3.5 w-3.5" /> إبلاغ عن مخالفة
          </button>
        </div>
      </div>

      {reportOpen && <ReportDialog stationId={s.id} onClose={() => setReportOpen(false)} />}
    </main>
  );
}

function ReportDialog({ stationId, onClose }: { stationId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitComplaint({ station_id: stationId, reporter_name: name || undefined, reporter_phone: phone, reason });
      toast.success("تم إرسال البلاغ — سيراجعه فريق الإدارة");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "تعذّر الإرسال");
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl p-6 md:left-1/2 md:right-auto md:-translate-x-1/2">
        <h2 className="text-lg font-bold">إبلاغ عن مخالفة</h2>
        <p className="mt-1 text-xs text-muted-foreground">إذا وصلت ولم تجد ما هو معلن، أرسل بلاغك لفريق الإدارة.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك (اختياري)"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none" />
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم هاتفك للتواصل" type="tel" dir="ltr" minLength={6}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none" />
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ما المخالفة؟ (مثلاً: المعلن أن البنزين متوفر لكنه غير موجود)" rows={4} minLength={5} maxLength={1000}
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none" />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">إلغاء</button>
            <button disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} إرسال البلاغ
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
