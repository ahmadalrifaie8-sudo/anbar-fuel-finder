// ???? ??????? ???????? ?? MapLibre ? CARTO Dark
// ??? ?????? ??? ?? ???? ?????? ????? ????? SSR ?? maplibre-gl
import { useImperativeHandle, useMemo, useRef, useEffect, forwardRef, useState } from "react";
import type { StationWithStatus } from "@/lib/stations";
import { MapPin } from "lucide-react";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type StationsMapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
};

interface MapProps {
  stations: StationWithStatus[];
  onSelect: (s: StationWithStatus) => void;
  userLocation: { lat: number; lng: number } | null;
}

type MapLibreModule = typeof import("react-map-gl/maplibre");

function InnerMap({
  stations,
  onSelect,
  userLocation,
  mapRef,
  lib,
}: MapProps & {
  mapRef: React.RefObject<any>;
  lib: MapLibreModule;
}) {
  const { default: Map, Marker, NavigationControl, GeolocateControl } = lib;

  const initialView = useMemo(() => ({
    longitude: 43.3074,
    latitude: 33.4206,
    zoom: 7.5,
  }), []);

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 12, duration: 1500 });
    }
  }, [userLocation, mapRef]);

  return (
    <Map
      ref={mapRef}
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
            <div className="flex flex-col items-center">
              <span className="station-label">{s.name}</span>
              <button className="group relative grid place-items-center" aria-label={s.name}>
                <span
                  className={`absolute inset-0 -z-10 rounded-full opacity-60 animate-pulse-soft ${anyAvailable ? "marker-glow-green" : "marker-glow-red"}`}
                  style={{ width: 28, height: 28, top: -2, right: -2 }}
                />
                <span className={`grid h-8 w-8 place-items-center rounded-full border-2 border-background ${anyAvailable ? "marker-glow-green" : "marker-glow-red"}`}>
                  <MapPin className="h-4 w-4 text-white" fill="white" strokeWidth={0} />
                </span>
              </button>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}

export const StationsMap = forwardRef<StationsMapHandle, MapProps>(function StationsMap(
  { stations, onSelect, userLocation },
  ref,
) {
  const mapRef = useRef<any>(null);
  const [lib, setLib] = useState<MapLibreModule | null>(null);

  // ??????? ?????? ?? ???? ?????? ???
  useEffect(() => {
    import("react-map-gl/maplibre").then((m) => setLib(m as MapLibreModule));
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom = 12) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1800, essential: true });
    },
  }));

  if (!lib) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-xs text-muted-foreground animate-pulse">???? ????? ???????...</div>
      </div>
    );
  }

  return (
    <InnerMap
      stations={stations}
      onSelect={onSelect}
      userLocation={userLocation}
      mapRef={mapRef}
      lib={lib}
    />
  );
});
