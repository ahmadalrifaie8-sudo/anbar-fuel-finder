// صفحة المشاركة العامة للمحطة /s/$slug
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { fetchStationBySlug } from "@/lib/stations";
import { Logo } from "@/components/Logo";
import { Check, Ban, Navigation, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

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
  const { station, statuses } = Route.useLoaderData() as any;
  const s = station;

  const navigate = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, "_blank");

  return (
    <main className="min-h-[100dvh] p-4">
      <div className="mx-auto max-w-md">
        <Link to="/" className="glass mb-4 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs">
          <ArrowRight className="h-3 w-3" /> الخريطة العامة
        </Link>

        <div className="glass-strong rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-center"><Logo /></div>
          <h1 className="mt-6 text-center text-2xl font-bold">{s.name}</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">حالة الوقود الحالية</p>

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

          <button onClick={navigate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] active:scale-95">
            <Navigation className="h-4 w-4" /> توجيه عبر خرائط جوجل
          </button>
        </div>
      </div>
    </main>
  );
}
