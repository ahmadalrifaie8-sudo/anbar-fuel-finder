// شريط لحظي متحرك بآخر تحديثات المحطات — يتوقف عند اللمس أو فتح لوحة المحطة
import type { FuelType, StationWithStatus } from "@/lib/stations";
import { Radio } from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
  stations: StationWithStatus[];
  fuelTypes: FuelType[];
  paused?: boolean; // إيقاف خارجي (مثلاً عند فتح لوحة المحطة)
}

export function LiveTicker({ stations, fuelTypes, paused = false }: Props) {
  const [touching, setTouching] = useState(false);

  const items = useMemo(() => {
    const fuelName = (id: number) => fuelTypes.find((f) => f.id === id)?.name ?? "";
    const rows: { station: string; fuel: string; available: boolean; crowd: string; time: number }[] = [];
    stations.forEach((s) => {
      s.statuses.forEach((st) => {
        rows.push({
          station: s.name,
          fuel: fuelName(st.fuel_type_id),
          available: st.is_available,
          crowd: st.crowd_level,
          time: new Date(st.last_updated).getTime(),
        });
      });
    });
    return rows.sort((a, b) => b.time - a.time).slice(0, 25);
  }, [stations, fuelTypes]);

  if (items.length === 0) return null;

  const renderItems = (key: string) =>
    items.map((it, i) => (
      <span key={`${key}-${i}`} className="mx-6 inline-flex items-center gap-2 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${it.available ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className="font-bold">{it.station}:</span>
        <span className={it.available ? "text-emerald-300" : "text-red-300"}>
          {it.available ? `متوفر ${it.fuel}` : `لا يوجد ${it.fuel}`}
        </span>
        <span className="text-muted-foreground">— الازدحام {it.crowd}</span>
        <span className="text-muted-foreground/60">|</span>
      </span>
    ));

  const isPaused = paused || touching;

  return (
    <div className="glass-strong pointer-events-auto flex items-center gap-2 overflow-hidden rounded-2xl py-2 pr-3">
      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300">
        <Radio className="h-3 w-3 animate-pulse" /> مباشر
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        dir="ltr"
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
        onMouseEnter={() => setTouching(true)}
        onMouseLeave={() => setTouching(false)}
      >
        <div
          className="flex w-max whitespace-nowrap"
          dir="rtl"
          style={{
            animation: "marquee-ltr 90s linear infinite",
            animationPlayState: isPaused ? "paused" : "running",
          }}
        >
          {renderItems("a")}
          {renderItems("b")}
        </div>
      </div>
    </div>
  );
}
