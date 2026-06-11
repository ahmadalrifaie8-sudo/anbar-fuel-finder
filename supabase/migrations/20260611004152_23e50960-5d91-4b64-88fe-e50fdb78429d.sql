
DO $$ BEGIN
  CREATE TYPE public.crowd_level AS ENUM ('خفيف', 'متوسط', 'شديد');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS address VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visitor_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.station_fuel_status
  ADD COLUMN IF NOT EXISTS crowd_level public.crowd_level NOT NULL DEFAULT 'خفيف';

DROP VIEW IF EXISTS public.stations_public;
CREATE VIEW public.stations_public AS
SELECT
  s.id, s.name, s.slug, s.city_id, s.services, s.status,
  s.address, s.visitor_count,
  ST_Y(s.location::geometry) AS lat,
  ST_X(s.location::geometry) AS lng,
  s.created_at, s.updated_at
FROM public.stations s
WHERE s.status = 'Active';
GRANT SELECT ON public.stations_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_station_visits(_station_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new INT;
BEGIN
  UPDATE public.stations
    SET visitor_count = visitor_count + 1
    WHERE id = _station_id AND status = 'Active'
    RETURNING visitor_count INTO _new;
  RETURN COALESCE(_new, 0);
END $$;
GRANT EXECUTE ON FUNCTION public.increment_station_visits(UUID) TO anon, authenticated;

UPDATE public.station_fuel_status
  SET crowd_level = (ARRAY['خفيف','متوسط','شديد']::public.crowd_level[])[1 + floor(random()*3)::int];

UPDATE public.stations SET address = 'شارع رئيسي - ' || c.name_ar
  FROM public.cities c WHERE c.id = stations.city_id AND (stations.address = '' OR stations.address IS NULL);
