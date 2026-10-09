-- Fige la commission SwissBroker Pro calculee au moment de la facturation,
-- pour que l'historique reste exact si le bareme de commission (tranches/
-- taux, voir supabase/functions/_shared/commission.ts) change un jour.
-- Additive uniquement : nullable, aucune donnee existante touchee. NULL
-- pour les factures creees avant cette colonne, ou la commission reste
-- recalculee a la volee depuis amount_chf avec le bareme en vigueur.
alter table public.rdv_invoices
  add column commission_centimes integer;

comment on column public.rdv_invoices.amount_chf is
  'Montant de la facture en CENTIMES (malgre le nom), ex. 150000 = 1500.00 CHF.';

comment on column public.rdv_invoices.commission_centimes is
  'Commission SwissBroker Pro figee au moment de la facturation, en centimes. NULL pour les factures creees avant cette colonne (commission alors recalculee a la volee depuis amount_chf avec le bareme en vigueur).';
