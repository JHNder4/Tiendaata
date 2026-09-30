-- Grant Data API and Storage permissions for Supabase Auth sessions.
grant select on public.products to anon;
grant select on public.promotions to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select, insert, update, delete on public.promotions to authenticated;
drop policy if exists "fotos_ver" on storage.objects;
create policy "fotos_ver" on storage.objects for select to anon, authenticated using (bucket_id = 'fotos');
drop policy if exists "fotos_subir_auth" on storage.objects;
create policy "fotos_subir_auth" on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
drop policy if exists "fotos_actualizar_auth" on storage.objects;
create policy "fotos_actualizar_auth" on storage.objects for update to authenticated using (bucket_id = 'fotos') with check (bucket_id = 'fotos');
drop policy if exists "fotos_eliminar_auth" on storage.objects;
create policy "fotos_eliminar_auth" on storage.objects for delete to authenticated using (bucket_id = 'fotos');
revoke execute on function public.es_admin() from public, anon, authenticated;
