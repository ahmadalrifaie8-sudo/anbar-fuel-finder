// شريط الإحصائيات الزجاجي
import type { FuelType, StationWithStatus } from "@/lib/stations";
import { Activity, Flame, Droplets, Wind } from "lucide-react";

const ICONS: Record<string, typeof Flame> = {
  "عادي": Flame,
  "محسن": Flame,
  "غاز": Wind,
  "نفط أبيض": Droplets,
};

export function StatsBar({ stations, fuelTypes }: { stations: StationWithStatus[]; fuelTypes: FuelType[] }) {
  const total = stations.length;
  const perFuel = fuelTypes.map((ft) => ({
    ...ft,
    count: stations.filter((s) => s.statuses.some((st) => st.fuel_type_id === ft.id && st.is_available)).length,
  }));

  return (
    <div className="glass-strong pointer-events-auto rounded-2xl p-3 shadow-2xl">
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-primary/15 px-3 py-2">
          <Activity className="h-4 w-4 text-primary" />
          <div className="leading-tight">
            <div className="text-[10px] text-muted-foreground">المحطات النشطة</div>
            <div className="text-base font-bold">{total}</div>
          </div>
        </div>
        {perFuel.map((f) => {
          const Icon = ICONS[f.name] ?? Flame;
          return (
            <div key={f.id} className="flex shrink-0 items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
              <Icon className="h-4 w-4 text-primary" />
              <div className="leading-tight">
                <div className="text-[10px] text-muted-foreground">{f.name}</div>
                <div className="text-base font-bold">{f.count}<span className="text-[10px] text-muted-foreground"> / {total}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
