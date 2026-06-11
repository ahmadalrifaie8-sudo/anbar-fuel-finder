// مكتبة استعلامات المحطات والوقود المشتركة
import { supabase } from "@/integrations/supabase/client";

export type FuelType = { id: number; name: string; display_order: number };
export type City = { id: string; name_ar: string; name_en: string; center_lat: number; center_lng: number };
export type CrowdLevel = "خفيف" | "متوسط" | "شديد";
export type FuelStatus = {
  station_id: string;
  fuel_type_id: number;
  is_available: boolean;
  crowd_level: CrowdLevel;
  last_updated: string;
};

export type DaySchedule = { open: boolean; from: string; to: string };
export type WorkingHours = Record<string, DaySchedule>;

export const DAYS = [
  { key: "saturday", label: "السبت" },
  { key: "sunday",   label: "الأحد" },
  { key: "monday",   label: "الاثنين" },
  { key: "tuesday",  label: "الثلاثاء" },
  { key: "wednesday",label: "الأربعاء" },
  { key: "thursday", label: "الخميس" },
  { key: "friday",   label: "الجمعة" },
] as const;

export const defaultWorkingHours = (): WorkingHours =>
  Object.fromEntries(DAYS.map(({ key }) => [key, { open: true, from: "08:00", to: "22:00" }]));

export type StationWithStatus = {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  lat: number;
  lng: number;
  address: string;
  visitor_count: number;
  services: Record<string, unknown>;
  status: string;
  working_hours: WorkingHours;
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
    .select("id, name, slug, city_id, lat, lng, services, status, address, visitor_count, working_hours");
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
  if (!data || !(data as any).id) return null;
  const stationId = (data as any).id as string;
  const [statusesRes, productsRes] = await Promise.all([
    supabase.from("station_fuel_status").select("*, fuel_types(name)").eq("station_id", stationId),
    supabase.from("station_products").select("*").eq("station_id", stationId).order("display_order"),
  ]);
  return { station: data, statuses: statusesRes.data ?? [], products: productsRes.data ?? [] };
}

export type StationProduct = {
  id: string;
  station_id: string;
  name: string;
  price: number | null;
  is_available: boolean;
  notes: string | null;
  display_order: number;
};

export async function submitComplaint(input: {
  station_id: string;
  reporter_name?: string;
  reporter_phone: string;
  reason: string;
}) {
  const { error } = await supabase.from("complaints").insert(input);
  if (error) throw error;
}

// عداد زيارات المحطة (دالة آمنة على الخادم)
export async function incrementStationVisits(stationId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("increment_station_visits", { _station_id: stationId });
  if (error) return null;
  return (data as unknown as number) ?? null;
}

// ألوان الازدحام
export const CROWD_COLOR: Record<CrowdLevel, string> = {
  "خفيف": "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  "متوسط": "text-amber-400 bg-amber-500/15 border-amber-500/30",
  "شديد": "text-red-400 bg-red-500/15 border-red-500/30",
};
