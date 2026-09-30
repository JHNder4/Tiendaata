-- Restore the public storefront capabilities used by the current app.
-- Keep anonymous users limited to banner reads and the validated checkout RPC.
grant select on public.banners to anon;

revoke execute on function public.crear_pedido(jsonb) from public, authenticated;
grant execute on function public.crear_pedido(jsonb) to anon;
