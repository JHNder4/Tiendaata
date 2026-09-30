-- Tienda Ata — banners predeterminados fijos
-- Los banners se administran editando únicamente texto, enlace y estado.
begin;

delete from public.banners;

insert into public.banners
  (id, kind, title, subtitle, image_url, product_id, promotion_id, link, button_text, active, position)
values
  ('banner_home_1', 'Oferta', '20% OFF', 'Descuento especial en productos seleccionados.', '', '', '', '#/catalogo', 'Ver ofertas', true, 0),
  ('banner_home_2', 'Novedades', 'Nuevas prendas', 'Descubre lo más reciente de Tienda Ata.', '', '', '', '#/catalogo', 'Ver catálogo', true, 1),
  ('banner_home_3', 'Tienda Ata', 'Compra fácil', 'Explora categorías, encuentra tu talla y arma tu pedido.', '', '', '', '#/catalogo', 'Explorar tienda', true, 2);

drop policy if exists "Authenticated can insert banners" on public.banners;
drop policy if exists "Authenticated can delete banners" on public.banners;

revoke insert, delete on table public.banners from public, anon, authenticated;
grant select on table public.banners to anon;
grant select, update on table public.banners to authenticated;

commit;
