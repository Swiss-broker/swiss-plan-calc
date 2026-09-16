-- Le trigger on_new_payment (sur rdv_invoices) notifiait TOUT le monde
-- (admin_users, admin et commercial confondus) pour CHAQUE paiement passé
-- à "paid", y compris les paiements démo simulés (demo-rdv-invoice).
-- Le mode démo ne sert qu'à faire la démo du logiciel : aucune notification
-- ne doit en sortir. Et pour un vrai paiement, seuls les comptes admin
-- doivent être notifiés, jamais les comptes commerciaux.
create or replace function public.notify_admins_new_payment()
returns trigger as $$
begin
  if new.status = 'paid' and not coalesce(new.is_demo, false) then
    insert into public.admin_notifications (admin_id, type, title, body, link)
    select user_id, 'new_payment',
      'Nouveau paiement reçu',
      'CHF ' || new.amount_chf::text,
      '/payments'
    from public.admin_users
    where role = 'admin';
  end if;
  return new;
end;
$$ language plpgsql;
