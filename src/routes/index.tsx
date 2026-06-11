// الصفحة الرئيسية - الخريطة العامة مع Realtime + اختيار المدينة + شريط مباشر
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActiveStations,
  fetchCities,
  fetchFuelTypes,
  type City,
  type StationWithStatus,
} from "@/lib/stations";
import { StationsMap, type StationsMapHandle } from "@/components/StationsMap";
import { StatsBar } from "@/components/StatsBar";
import { FilterPills } from "@/components/FilterPills";
import { StationSheet } from "@/components/StationSheet";
import { Logo } from "@/components/Logo";
import { CitySelectorModal } from "@/components/CitySelectorModal";
import { LiveTicker } from "@/components/LiveTicker";
import { LogIn, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة بانزين الأنبار — خريطة توفر الوقود ومستوى الازدحام لحظياً" },
      { name: "description", content: "خريطة لحظية لمحطات الوقود في محافظة الأنبار مع مستوى الازدحام: بنزين عادي ومحسن، غاز ونفط أبيض." },
      { property: "og:title", content: "منصة بانزين الأنبار" },
      { property: "og:description", content: "اعرف أين يتوفر الوقود الآن في الأنبار ومستوى الازدحام في كل محطة." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const CITY_KEY = "anbar:selectedCityId";

function HomePage() {
  const qc = useQueryClient();
  const mapRef = useRef<StationsMapHandle>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<StationWithStatus | null>(null);
  const [fuelFilter, setFuelFilter] = useState<number | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [showCityModal, setShowCityModal] = useState(false);

  const { data: stations = [] } = useQuery({ queryKey: ["stations"], queryFn: fetchActiveStations });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: fuelTypes = [] } = useQuery({ queryKey: ["fuel_types"], queryFn: fetchFuelTypes });

  // عند تحميل المدن: استرجع المدينة المحفوظة أو اطلب من المستخدم الاختيار
  useEffect(() => {
    if (cities.length === 0) return;
    const saved = typeof window !== "undefined" ? localStorage.getItem(CITY_KEY) : null;
    const city = saved ? cities.find((c) => c.id === saved) : null;
    if (city) {
      setCityFilter(city.id);
      // طيران مبدئي بعد لحظة لتثبيت الخريطة
      setTimeout(() => mapRef.current?.flyTo(city.center_lng, city.center_lat, 12), 400);
    } else {
      setShowCityModal(true);
    }
  }, [cities]);

  const handleCityPick = (c: City) => {
    setCityFilter(c.id);
    localStorage.setItem(CITY_KEY, c.id);
    setShowCityModal(false);
    mapRef.current?.flyTo(c.center_lng, c.center_lat, 12);
  };

  const handleCitySkip = () => {
    setShowCityModal(false);
    localStorage.setItem(CITY_KEY, "all");
  };

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

  const currentCity = cities.find((c) => c.id === cityFilter);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      {/* الخريطة */}
      <div className="absolute inset-0">
        <StationsMap ref={mapRef} stations={filtered} onSelect={setSelected} userLocation={userLoc} />
      </div>

      {/* الشريط العلوي */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="glass pointer-events-auto rounded-2xl px-3 py-2">
            <Logo />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setShowCityModal(true)}
              className="glass flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold"
            >
              <MapPin className="h-4 w-4 text-primary" />
              {currentCity ? currentCity.name_ar : "اختر المدينة"}
            </button>
            <Link
              to="/auth"
              className="glass flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold"
            >
              <LogIn className="h-4 w-4" /> صاحب محطة؟
            </Link>

          </div>
        </div>
        <StatsBar stations={stations} fuelTypes={fuelTypes} />
        <FilterPills
          cities={cities}
          fuelTypes={fuelTypes}
          fuelFilter={fuelFilter}
          cityFilter={cityFilter}
          onFuelFilter={setFuelFilter}
          onCityFilter={(id) => {
            setCityFilter(id);
            if (id) {
              const c = cities.find((x) => x.id === id);
              if (c) mapRef.current?.flyTo(c.center_lng, c.center_lat, 12);
            }
          }}
        />
      </div>

      {/* الشريط المتحرك السفلي */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <LiveTicker stations={filtered} fuelTypes={fuelTypes} paused={!!selected} />
      </div>

      {showCityModal && (
        <CitySelectorModal cities={cities} onSelect={handleCityPick} onSkip={handleCitySkip} />
      )}

      {selected && (
        <StationSheet station={selected} fuelTypes={fuelTypes} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
