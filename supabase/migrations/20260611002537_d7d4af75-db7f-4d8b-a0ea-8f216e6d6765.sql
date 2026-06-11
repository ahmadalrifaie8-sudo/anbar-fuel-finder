
-- تفعيل الإضافات
CREATE EXTENSION IF NOT EXISTS postgis;

-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('super_admin', 'station_manager');
CREATE TYPE public.station_status AS ENUM ('Pending', 'Active', 'Suspended');

-- ========== المدن ==========
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المدن مرئية للجميع" ON public.cities FOR SELECT USING (true);

-- ========== الملفات الشخصية ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL DEFAULT '',
  phone VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "كل مستخدم يقرأ ملفه" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "كل مستخدم يحدث ملفه" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "إدراج الملف الشخصي" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ========== أدوار المستخدمين ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "المستخدم يرى أدواره" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- دالة فحص الدور (security definer لتجنب الـ recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ========== أنواع الوقود ==========
CREATE TABLE public.fuel_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.fuel_types TO anon, authenticated;
GRANT ALL ON public.fuel_types TO service_role;
ALTER TABLE public.fuel_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "أنواع الوقود مرئية للجميع" ON public.fuel_types FOR SELECT USING (true);

INSERT INTO public.fuel_types (name, display_order) VALUES
  ('عادي', 1), ('محسن', 2), ('غاز', 3), ('نفط أبيض', 4);

-- ========== المحطات ==========
CREATE TABLE public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  services JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.station_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stations_location_gix ON public.stations USING GIST (location);
CREATE INDEX stations_city_idx ON public.stations (city_id);
CREATE INDEX stations_status_idx ON public.stations (status);
CREATE INDEX stations_owner_idx ON public.stations (owner_id);

GRANT SELECT ON public.stations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المحطات النشطة مرئية للجميع" ON public.stations FOR SELECT
  USING (status = 'Active' OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "المستخدم ينشئ محطته" ON public.stations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "المالك أو المدير يحدث المحطة" ON public.stations FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "المدير يحذف المحطة" ON public.stations FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ========== حالة وقود المحطات ==========
CREATE TABLE public.station_fuel_status (
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  fuel_type_id INT NOT NULL REFERENCES public.fuel_types(id),
  is_available BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, fuel_type_id)
);
CREATE INDEX sfs_available_idx ON public.station_fuel_status (is_available);

GRANT SELECT ON public.station_fuel_status TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_fuel_status TO authenticated;
GRANT ALL ON public.station_fuel_status TO service_role;
ALTER TABLE public.station_fuel_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "حالة الوقود مرئية للجميع" ON public.station_fuel_status FOR SELECT USING (true);
CREATE POLICY "المالك أو المدير يدير حالة الوقود" ON public.station_fuel_status FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = station_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stations s WHERE s.id = station_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')))
  );

-- ========== Trigger: تحديث last_updated و updated_at ==========
CREATE OR REPLACE FUNCTION public.touch_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.last_updated = now(); RETURN NEW; END; $$;
CREATE TRIGGER sfs_touch BEFORE UPDATE ON public.station_fuel_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_last_updated();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER stations_touch BEFORE UPDATE ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== Trigger: إنشاء profile + صفوف حالة الوقود تلقائياً ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.seed_station_fuel_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.station_fuel_status (station_id, fuel_type_id, is_available)
  SELECT NEW.id, ft.id, false FROM public.fuel_types ft;
  RETURN NEW;
END; $$;
CREATE TRIGGER stations_seed_fuel AFTER INSERT ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.seed_station_fuel_status();

-- ========== View للاستعلامات العامة (lat/lng من POINT) ==========
CREATE OR REPLACE VIEW public.stations_public AS
SELECT
  s.id, s.name, s.slug, s.city_id, s.services, s.status,
  ST_Y(s.location::geometry) AS lat,
  ST_X(s.location::geometry) AS lng,
  s.created_at, s.updated_at
FROM public.stations s
WHERE s.status = 'Active';
GRANT SELECT ON public.stations_public TO anon, authenticated;

-- ========== تفعيل Realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.station_fuel_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stations;

-- ========== بيانات المدن (الأنبار) ==========
INSERT INTO public.cities (name_ar, name_en, center_lat, center_lng) VALUES
  ('الرمادي',  'Ramadi',   33.4206, 43.3074),
  ('الفلوجة',  'Fallujah', 33.3548, 43.7825),
  ('هيت',      'Hit',      33.6428, 42.8278),
  ('حديثة',    'Haditha',  34.1361, 42.3781),
  ('القائم',   'Al-Qaim',  34.3886, 41.0058),
  ('عانة',     'Anah',     34.3722, 41.9583),
  ('راوة',     'Rawa',     34.4669, 41.9183);
