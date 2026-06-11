-- ========== 1) أعمدة جديدة على جدول المحطات ==========
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- ========== 2) تحديث أنواع الوقود ==========
UPDATE public.fuel_types SET name = 'بانزين عادي',  display_order = 1 WHERE id = 1;
UPDATE public.fuel_types SET name = 'بانزين محسن',  display_order = 2 WHERE id = 2;
UPDATE public.fuel_types SET name = 'كاز',           display_order = 3 WHERE id = 3;
UPDATE public.fuel_types SET name = 'نفط أبيض',      display_order = 4 WHERE id = 4;
INSERT INTO public.fuel_types (name, display_order) VALUES ('غاز LPG',    5) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.fuel_types (name, display_order) VALUES ('غاز الطبخ',  6) ON CONFLICT (name) DO NOTHING;

-- ========== 3) إعادة بناء view المحطات العامة مع الأعمدة الجديدة ==========
DROP VIEW IF EXISTS public.stations_public;
CREATE VIEW public.stations_public WITH (security_invoker = true) AS
SELECT
  id, name, slug, city_id, services, status, address, visitor_count, phone,
  working_hours,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng,
  created_at, updated_at
FROM public.stations
WHERE status = 'Active'::station_status;

GRANT SELECT ON public.stations_public TO anon, authenticated;

-- ========== 4) RLS: السماح لصاحب المحطة بقراءة rejection_note من جدوله المباشر ==========
-- (الـ RLS الموجود يسمح بالقراءة عبر stations مباشرة بدون تعديل)
