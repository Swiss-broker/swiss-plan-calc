CREATE TYPE public.app_language AS ENUM ('fr', 'de', 'en', 'it');
ALTER TABLE public.profiles ADD COLUMN preferred_language public.app_language NOT NULL DEFAULT 'fr';