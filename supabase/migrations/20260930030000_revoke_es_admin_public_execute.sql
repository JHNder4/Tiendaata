-- The admin panel now authorizes through the admin-panel Edge Function.
-- Keep the legacy helper unavailable to client roles so it cannot be used as an auth bypass.
revoke execute on function public.es_admin() from authenticated, anon;
