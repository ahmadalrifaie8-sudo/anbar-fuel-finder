// أزرار الفلاتر العائمة
import type { City, FuelType } from "@/lib/stations";
import { X } from "lucide-react";

interface Props {
  cities: City[];
  fuelTypes: FuelType[];
  fuelFilter: number | null;
  cityFilter: string | null;
  onFuelFilter: (id: number | null) => void;
  onCityFilter: (id: string | null) => void;
}

export function FilterPills({ cities, fuelTypes, fuelFilter, cityFilter, onFuelFilter, onCityFilter }: Props) {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
      <select
        value={cityFilter ?? ""}
        onChange={(e) => onCityFilter(e.target.value || null)}
        className="glass rounded-full px-4 py-2 text-xs font-semibold outline-none ring-0 transition focus:ring-2 focus:ring-primary"
      >
        <option value="">كل المدن</option>
        {cities.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
      </select>
      {fuelTypes.map((f) => (
        <button
          key={f.id}
          onClick={() => onFuelFilter(fuelFilter === f.id ? null : f.id)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            fuelFilter === f.id
              ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-primary)]"
              : "glass hover:bg-secondary/60"
          }`}
        >
          {f.name}
        </button>
      ))}
      {(fuelFilter !== null || cityFilter !== null) && (
        <button
          onClick={() => { onFuelFilter(null); onCityFilter(null); }}
          className="glass flex items-center gap-1 rounded-full px-3 py-2 text-xs"
        >
          <X className="h-3 w-3" /> مسح
        </button>
      )}
    </div>
  );
}
