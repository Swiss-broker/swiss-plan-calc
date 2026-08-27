-- Modeles d'email personnalisables par courtier. Les 10 modeles par
-- defaut vivent en dur cote frontend (src/lib/emails/templates.ts) ; une
-- ligne ici represente uniquement une PERSONNALISATION du courtier pour
-- un modele donne (absence de ligne = le defaut s'applique).
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null
    check (template_key in (
      'demande_documents', 'relance_j2', 'documents_manquants',
      'confirmation_reception', 'rappel_rdv', 'confirmation_rdv',
      'report_rdv', 'annulation_rdv', 'suivi_post_rdv', 'demande_complementaire'
    )),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (broker_id, template_key)
);

create trigger trg_email_templates_updated
  before update on public.email_templates
  for each row execute function public.touch_updated_at();

alter table public.email_templates enable row level security;

create policy email_templates_select on public.email_templates for select
  using (auth.uid() = broker_id);
create policy email_templates_insert on public.email_templates for insert
  with check (auth.uid() = broker_id);
create policy email_templates_update on public.email_templates for update
  using (auth.uid() = broker_id) with check (auth.uid() = broker_id);
create policy email_templates_delete on public.email_templates for delete
  using (auth.uid() = broker_id);

-- Historique minimal des emails envoyes a un client (tracabilite, evite
-- les envois en double, alimente un futur "suivi des communications").
-- Ne stocke jamais le corps complet du message, seulement le sujet.
create table public.client_email_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  template_key text,
  subject text not null,
  sent_at timestamptz not null default now()
);

create index idx_client_email_log_client on public.client_email_log(client_id);

alter table public.client_email_log enable row level security;

create policy client_email_log_select on public.client_email_log for select
  using (auth.uid() = broker_id);
-- Pas de policy insert pour authenticated : seule l'edge function
-- send-client-email (service role, SECURITY DEFINER via son propre acces)
-- ecrit dans cette table, jamais directement depuis le navigateur.

-- Signature email du courtier, distincte de pdf_footer_note (qui ne sert
-- qu'aux exports PDF) : reutilisee comme variable {{signature}}.
alter table public.profiles add column if not exists email_signature text;
