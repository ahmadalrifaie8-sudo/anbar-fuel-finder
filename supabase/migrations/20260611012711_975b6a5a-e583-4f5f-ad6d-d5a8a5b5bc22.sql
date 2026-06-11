
-- 1) Add phone column to stations + ensure stations_public exposes it
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS phone text;

DROP VIEW IF EXISTS public.stations_public;
CREATE VIEW public.stations_public WITH (security_invoker=on) AS
SELECT id, name, slug, city_id, services, status, address, visitor_count, phone,
       st_y(location::geometry) AS lat,
       st_x(location::geometry) AS lng,
       created_at, updated_at
FROM public.stations s
WHERE status = 'Active'::station_status;

GRANT SELECT ON public.stations_public TO anon, authenticated;

-- 2) Arabic -> Latin transliteration + slug generator
CREATE OR REPLACE FUNCTION public.arabic_to_latin(_input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(
    COALESCE(_input, ''),
    'ابتثجحخدذرزسشصضطظعغفقكلمنهويىءؤإأآةئ ـ',
    'abtthjhkhdthrzsshsdtzaaghfqklmnhwyy''oeaate-_'
  );
$$;

CREATE OR REPLACE FUNCTION public.slugify_station_name(_name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text;
BEGIN
  base := lower(public.arabic_to_latin(_name));
  -- replace any non a-z 0-9 with dash, collapse, trim
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base IS NULL OR base = '' THEN base := 'station'; END IF;
  RETURN left(base, 60);
END $$;

CREATE OR REPLACE FUNCTION public.unique_station_slug(_name text)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE base text; candidate text; i int := 1;
BEGIN
  base := public.slugify_station_name(_name);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.stations WHERE slug = candidate) LOOP
    i := i + 1;
    candidate := base || '-' || i;
  END LOOP;
  RETURN candidate;
END $$;

-- 3) Trigger: auto-fill slug if empty on insert
CREATE OR REPLACE FUNCTION public.stations_autoslug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.unique_station_slug(NEW.name);
  ELSE
    -- normalize and ensure unique
    NEW.slug := public.slugify_station_name(NEW.slug);
    IF EXISTS (SELECT 1 FROM public.stations WHERE slug = NEW.slug AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
      NEW.slug := public.unique_station_slug(NEW.slug);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stations_autoslug ON public.stations;
CREATE TRIGGER trg_stations_autoslug BEFORE INSERT ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.stations_autoslug();

-- 4) station_products table
CREATE TABLE IF NOT EXISTS public.station_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2),
  is_available boolean NOT NULL DEFAULT true,
  notes text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.station_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.station_products TO authenticated;
GRANT ALL ON public.station_products TO service_role;

ALTER TABLE public.station_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "منتجات المحطات النشطة مرئية للجميع"
  ON public.station_products FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = station_products.station_id
            AND (s.status = 'Active'::station_status
                 OR s.owner_id = auth.uid()
                 OR public.has_role(auth.uid(), 'super_admin'::app_role)))
  );

CREATE POLICY "المالك يدير منتجات محطته"
  ON public.station_products FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = station_products.station_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role)))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = station_products.station_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role)))
  );

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_station_products_touch ON public.station_products;
CREATE TRIGGER trg_station_products_touch BEFORE UPDATE ON public.station_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS station_products_station_idx ON public.station_products(station_id);

-- 5) complaints table
DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('open','reviewing','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  reporter_name text,
  reporter_phone text NOT NULL,
  reason text NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaints_reason_len CHECK (char_length(reason) BETWEEN 5 AND 1000),
  CONSTRAINT complaints_phone_len CHECK (char_length(reporter_phone) BETWEEN 6 AND 20)
);

GRANT INSERT ON public.complaints TO anon, authenticated;
GRANT SELECT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- anyone can file a complaint against an active station
CREATE POLICY "أي شخص يرسل شكوى على محطة نشطة"
  ON public.complaints FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = complaints.station_id AND s.status = 'Active'::station_status)
  );

-- only super admin can read complaints
CREATE POLICY "المدير يقرأ كل الشكاوى"
  ON public.complaints FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.stations s WHERE s.id = complaints.station_id AND s.owner_id = auth.uid()));

-- only super admin can update status
CREATE POLICY "المدير يحدث الشكوى"
  ON public.complaints FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP TRIGGER IF EXISTS trg_complaints_touch ON public.complaints;
CREATE TRIGGER trg_complaints_touch BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS complaints_station_idx ON public.complaints(station_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON public.complaints(status);

-- 6) Rate-limit complaints: at most 3 per phone per hour (validation trigger, not CHECK)
CREATE OR REPLACE FUNCTION public.complaints_rate_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.complaints
  WHERE reporter_phone = NEW.reporter_phone
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'تم تجاوز الحد المسموح من الشكاوى. حاول لاحقاً.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaints_rate_limit ON public.complaints;
CREATE TRIGGER trg_complaints_rate_limit BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.complaints_rate_limit();
