-- Suivi de statut par-dessus le systeme de documents existant
-- (client_documents / client_document_links). Une ligne par
-- (client, categorie) : "Manquant" tant qu'aucune ligne n'existe pour
-- cette categorie, sinon un des statuts suivants.
create table public.client_document_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  broker_id uuid not null references auth.users(id) on delete cascade,
  category public.client_document_category not null,
  status text not null default 'demande'
    check (status in ('demande', 'recu', 'verifie', 'a_remplacer')),
  note text,
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  verified_at timestamptz,
  reminder_sent_at timestamptz,
  document_id uuid references public.client_documents(id) on delete set null,
  link_id uuid references public.client_document_links(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, category)
);

create index idx_client_document_requests_client on public.client_document_requests(client_id);
create index idx_client_document_requests_broker on public.client_document_requests(broker_id);
-- Utilise par le job de relance J+2 pour trouver rapidement les demandes
-- en attente sans avoir deja recu de rappel.
create index idx_client_document_requests_pending
  on public.client_document_requests(status, requested_at)
  where status = 'demande' and reminder_sent_at is null;

create trigger trg_client_document_requests_updated
  before update on public.client_document_requests
  for each row execute function public.touch_updated_at();

alter table public.client_document_requests enable row level security;

-- Meme regle que client_documents/client_document_links : strictement
-- prive au courtier proprietaire, pas de visibilite cabinet (coherent
-- avec l'existant, non demande dans cette phase).
create policy client_document_requests_select
  on public.client_document_requests for select
  using (auth.uid() = broker_id);

create policy client_document_requests_insert
  on public.client_document_requests for insert
  with check (auth.uid() = broker_id);

create policy client_document_requests_update
  on public.client_document_requests for update
  using (auth.uid() = broker_id)
  with check (auth.uid() = broker_id);

create policy client_document_requests_delete
  on public.client_document_requests for delete
  using (auth.uid() = broker_id);
