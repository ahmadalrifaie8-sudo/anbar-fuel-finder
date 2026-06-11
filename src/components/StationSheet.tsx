// الورقة السفلية لتفاصيل المحطة
import type { FuelType, StationWithStatus } from "@/lib/stations";
import { Navigation, Share2, X, Check, Ban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  station: StationWithStatus;
  fuelTypes: FuelType[];
  onClose: () => void;
}

export function StationSheet({ station, fuelTypes, onClose }: Props) {
  const handleNavigate = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
    window.open(url, "_blank");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/s/${station.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: station.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("تم نسخ الرابط");
      }
    } catch { /* تم الإلغاء */ }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="glass-strong fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom md:inset-x-auto md:bottom-4 md:right-4 md:max-w-md md:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20 md:hidden" />
        <button onClick={onClose} className="absolute left-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>

        <h2 className="pl-10 text-lg font-bold">{station.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">حالة الوقود الحالية</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {fuelTypes.map((ft) => {
            const st = station.statuses.find((s) => s.fuel_type_id === ft.id);
            const available = !!st?.is_available;
            return (
              <div key={ft.id} className={`flex items-center gap-2 rounded-xl border p-3 ${available ? "border-primary/40 bg-primary/10" : "border-destructive/30 bg-destructive/10"}`}>
                {available ? <Check className="h-5 w-5 text-primary" /> : <Ban className="h-5 w-5 text-destructive" />}
                <div className="leading-tight">
                  <div className="text-sm font-bold">{ft.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {st ? formatDistanceToNow(new Date(st.last_updated), { addSuffix: true, locale: ar }) : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={handleNavigate} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] transition active:scale-95">
            <Navigation className="h-4 w-4" /> توجيه
          </button>
          <button onClick={handleShare} className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-secondary/60 transition active:scale-95">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
