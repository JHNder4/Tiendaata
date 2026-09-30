-- TiendaATA: harden public RPC execution.
-- Public checkout remains available anonymously; admin authorization stays authenticated-only.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.reclamar_admin() from public, anon, authenticated;

revoke execute on function public.crear_pedido(jsonb) from authenticated;
grant execute on function public.crear_pedido(jsonb) to anon;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
