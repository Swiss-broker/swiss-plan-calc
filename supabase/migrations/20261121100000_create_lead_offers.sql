-- Offres commerciales envoyées aux prospects : le lien envoyé pointe vers
-- swissbrokerpro.ch/offre/{token}, qui crée une page de paiement Stripe
-- neuve à chaque ouverture. Une Checkout Session Stripe expire au bout de
-- 24 h et ne peut pas être prolongée : l'envoyer telle quelle par e-mail
-- donnait un lien mort le lendemain.
create table if not exists public.lead_offers (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  demo_request_id uuid not null references public.demo_requests(id) on delete cascade,
  coupon_id text,
  discount_percent numeric,
  discount_duration text,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_opened_at timestamptz,
  open_count integer not null default 0
);
create index if not exists lead_offers_demo_request_idx on public.lead_offers(demo_request_id);
-- Accès uniquement par les Edge Functions (clé de service) : RLS activée
-- sans aucune politique, la table est invisible depuis le navigateur.
alter table public.lead_offers enable row level security;
