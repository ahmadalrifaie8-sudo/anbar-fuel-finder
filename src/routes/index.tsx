// الصفحة الرئيسية - الخريطة العامة مع Realtime
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveStations, fetchCities, fetchFuelTypes, type StationWithStatus } from "@/lib/stations";
import { StationsMap } from "@/components/StationsMap";
import { StatsBar } from "@/components/StatsBar";
import { FilterPills } from "@/components/FilterPills";
import { StationSheet } from "@/components/StationSheet";
import { Logo } from "@/components/Logo";
import { LogIn } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة بانزين الأنبار — خريطة توفر الوقود لحظياً" },
      { name: "description", content: "خريطة لحظية لمحطات الوقود في محافظة الأنبار: بنزين عادي ومحسن، غاز ونفط أبيض." },
      { property: "og:title", content: "منصة بانزين الأنبار" },
      { property: "og:description", content: "اعرف أين يتوفر الوقود الآن في الأنبار." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const qc = useQueryClient();
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<StationWithStatus | null>(null);
  const [fuelFilter, setFuelFilter] = useState<number | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  const { data: stations = [] } = useQuery({ queryKey: ["stations"], queryFn: fetchActiveStations });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: fuelTypes = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });

  // طلب الموقع
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* تم رفض الإذن */ },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  // اشتراك Realtime لتحديثات الوقود
  useEffect(() => {
    const ch = supabase
      .channel("public:station_fuel_status")
      .on("postgres_changes", { event: "*", schema: "public", table: "station_fuel_status" },
        () => { qc.invalidateQueries({ queryKey: ["stations"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stations" },
        () => { qc.invalidateQueries({ queryKey: ["stations"] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => stations.filter((s) => {
    if (cityFilter && s.city_id !== cityFilter) return false;
    if (fuelFilter !== null) {
      const st = s.statuses.find((x) => x.fuel_type_id === fuelFilter);
      if (!st?.is_available) return false;
    }
    return true;
  }), [stations, cityFilter, fuelFilter]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      {/* الخريطة */}
      <div className="absolute inset-0">
        <StationsMap stations={filtered} onSelect={setSelected} userLocation={userLoc} />
      </div>

      {/* الشريط العلوي */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="glass pointer-events-auto rounded-2xl px-3 py-2">
            <Logo />
          </div>
          <Link
            to="/auth"
            className="glass pointer-events-auto flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold"
          >
            <LogIn className="h-4 w-4" /> دخول المحطات
          </Link>
        </div>
        <StatsBar stations={stations} fuelTypes={fuelTypes} />
        <FilterPills
          cities={cities}
          fuelTypes={fuelTypes}
          fuelFilter={fuelFilter}
          cityFilter={cityFilter}
          onFuelFilter={setFuelFilter}
          onCityFilter={setCityFilter}
        />
      </div>

      {selected && (
        <StationSheet station={selected} fuelTypes={fuelTypes} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
