// مكتبة استعلامات المحطات والوقود المشتركة
import { supabase } from "@/integrations/supabase/client";

export type FuelType = { id: number; name: string; display_order: number };
export type City = { id: string; name_ar: string; name_en: string; center_lat: number; center_lng: number };
export type FuelStatus = { station_id: string; fuel_type_id: number; is_available: boolean; last_updated: string };

export type StationWithStatus = {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  lat: number;
  lng: number;
  services: Record<string, unknown>;
  status: string;
  statuses: FuelStatus[];
};

export async function fetchFuelTypes(): Promise<FuelType[]> {
  const { data, error } = await supabase.from("fuel_types").select("*").order("display_order");
  if (error) throw error;
  return data as FuelType[];
}

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase.from("cities").select("*").order("name_ar");
  if (error) throw error;
  return data as City[];
}

export async function fetchActiveStations(): Promise<StationWithStatus[]> {
  const { data: stations, error } = await supabase
    .from("stations_public")
    .select("id, name, slug, city_id, lat, lng, services, status");
  if (error) throw error;
  const rows = (stations ?? []).filter((s): s is NonNullable<typeof s> & { id: string } => !!s?.id);
  const ids = rows.map((s) => s.id as string);
  if (ids.length === 0) return [];
  const { data: statuses } = await supabase
    .from("station_fuel_status")
    .select("*")
    .in("station_id", ids);
  const byStation = new Map<string, FuelStatus[]>();
  (statuses ?? []).forEach((s) => {
    const arr = byStation.get(s.station_id) ?? [];
    arr.push(s as FuelStatus);
    byStation.set(s.station_id, arr);
  });
  return rows.map((s) => ({
    ...(s as any),
    statuses: byStation.get(s.id) ?? [],
  }));
}

export async function fetchStationBySlug(slug: string) {
  const { data, error } = await supabase
    .from("stations_public")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: statuses } = await supabase
    .from("station_fuel_status")
    .select("*, fuel_types(name)")
    .eq("station_id", (data as any).id);
  return { station: data, statuses: statuses ?? [] };
}
