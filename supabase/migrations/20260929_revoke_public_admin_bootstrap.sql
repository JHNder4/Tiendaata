-- Disable self-service first-admin claims through the public API.
-- An owner must provision the first admin from Supabase Auth and the SQL Editor.
REVOKE EXECUTE ON FUNCTION public.reclamar_admin() FROM PUBLIC, anon, authenticated;
