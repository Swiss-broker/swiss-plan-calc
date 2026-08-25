-- Le REVOKE ... FROM PUBLIC de la migration precedente n'a pas suffi :
-- Supabase accorde EXECUTE directement aux roles anon/authenticated (pas
-- seulement via le pseudo-role PUBLIC) sur chaque fonction du schema
-- public. Il faut donc revoquer explicitement sur ces deux roles.
revoke execute on function public.enforce_client_limit() from anon, authenticated;
revoke execute on function public.enforce_company_limit() from anon, authenticated;
revoke execute on function public.notify_admin_message() from anon, authenticated;
revoke execute on function public.notify_admins_feedback_reply() from anon, authenticated;
revoke execute on function public.notify_admins_new_feedback() from anon, authenticated;
revoke execute on function public.notify_admins_new_payment() from anon, authenticated;
revoke execute on function public.notify_feedback_message() from anon, authenticated;
revoke execute on function public.notify_feedback_reply() from anon, authenticated;
revoke execute on function public.hash_share_password(uuid, text) from anon;
