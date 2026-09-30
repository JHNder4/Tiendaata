-- Keep public storefront reads limited to anon while authenticated admins retain their own full-read policies.
drop policy if exists "Public can view published products" on public.products;
create policy "Public can view published products" on public.products
for select to anon
using ((data->>'status') = 'published');

drop policy if exists "Public can view active promotions" on public.promotions;
create policy "Public can view active promotions" on public.promotions
for select to anon
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- Orders are created directly through the table from the current storefront.
-- Disable the legacy SECURITY DEFINER RPC from the public API surface.
revoke execute on function public.crear_pedido(jsonb) from anon, authenticated;
