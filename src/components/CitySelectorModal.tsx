// نافذة اختيار المدينة الأولية
import type { City } from "@/lib/stations";
import { MapPin } from "lucide-react";

interface Props {
  cities: City[];
  onSelect: (c: City) => void;
  onSkip: () => void;
}

export function CitySelectorModal({ cities, onSelect, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/20">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-bold">اختر مدينتك</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            سنعرض لك محطات الوقود وحالة الازدحام في مدينتك مباشرة على الخريطة.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cities.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="glass rounded-2xl px-3 py-4 text-sm font-bold transition hover:bg-primary/20 hover:shadow-[var(--shadow-glow-primary)] active:scale-95"
            >
              {c.name_ar}
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          className="mt-5 w-full text-xs text-muted-foreground hover:text-foreground transition"
        >
          عرض كل الأنبار
        </button>
      </div>
    </div>
  );
}
