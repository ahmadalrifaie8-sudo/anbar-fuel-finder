DROP VIEW IF EXISTS public.stations_public;
CREATE VIEW public.stations_public
WITH (security_invoker = true) AS
SELECT
  s.id, s.name, s.slug, s.city_id, s.services, s.status,
  s.address, s.visitor_count,
  ST_Y(s.location::geometry) AS lat,
  ST_X(s.location::geometry) AS lng,
  s.created_at, s.updated_at
FROM public.stations s
WHERE s.status = 'Active';
GRANT SELECT ON public.stations_public TO anon, authenticated;