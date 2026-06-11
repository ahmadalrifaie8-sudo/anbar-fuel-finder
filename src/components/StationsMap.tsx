// مكون الخريطة التفاعلي مع MapLibre و CARTO Dark
import { useMemo, useRef, useEffect } from "react";
import Map, { Marker, Source, Layer, NavigationControl, GeolocateControl, type MapRef } from "react-map-gl/maplibre";
import type { StationWithStatus } from "@/lib/stations";
import { MapPin } from "lucide-react";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface MapProps {
  stations: StationWithStatus[];
  onSelect: (s: StationWithStatus) => void;
  userLocation: { lat: number; lng: number } | null;
}

export function StationsMap({ stations, onSelect, userLocation }: MapProps) {
  const ref = useRef<MapRef>(null);

  // الإحداثيات الافتراضية: مركز الأنبار (الرمادي)
  const initialView = useMemo(() => ({
    longitude: userLocation?.lng ?? 43.3074,
    latitude: userLocation?.lat ?? 33.4206,
    zoom: userLocation ? 12 : 7.5,
  }), [userLocation]);

  useEffect(() => {
    if (userLocation && ref.current) {
      ref.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 12, duration: 1500 });
    }
  }, [userLocation]);

  return (
    <Map
      ref={ref}
      initialViewState={initialView}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
    >
      <NavigationControl position="bottom-left" showCompass={false} />
      <GeolocateControl position="bottom-left" trackUserLocation={false} />

      {stations.map((s) => {
        const anyAvailable = s.statuses.some((st) => st.is_available);
        return (
          <Marker
            key={s.id}
            longitude={s.lng}
            latitude={s.lat}
            anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); onSelect(s); }}
          >
            <button
              className="group relative grid place-items-center"
              aria-label={s.name}
            >
              <span className={`absolute inset-0 -z-10 rounded-full opacity-60 animate-pulse-soft ${anyAvailable ? "marker-glow-green" : "marker-glow-red"}`} style={{ width: 28, height: 28, top: -2, right: -2 }} />
              <span className={`grid h-8 w-8 place-items-center rounded-full border-2 border-background ${anyAvailable ? "marker-glow-green" : "marker-glow-red"}`}>
                <MapPin className="h-4 w-4 text-white" fill="white" strokeWidth={0} />
              </span>
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
