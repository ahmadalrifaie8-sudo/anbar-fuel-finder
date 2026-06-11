
ALTER VIEW public.stations_public SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_station_fuel_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_last_updated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
