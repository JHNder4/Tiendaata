-- Tienda Ata: sales communication, private tracking and checkout settings.
-- Customers can place orders anonymously and receive a bearer tracking token.
-- Public tracking is served only through consultar_pedido(n, token), not direct table reads.

create table if not exists public.store_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can insert store settings" on public.store_settings;
create policy "Authenticated can insert store settings"
on public.store_settings for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update store settings" on public.store_settings;
create policy "Authenticated can update store settings"
on public.store_settings for update
to authenticated
using (true)
with check (true);

insert into public.store_settings(key,value)
values
  ('whatsapp',''),
  ('payment_methods',''),
  ('delivery_methods',''),
  ('tracking_message','Gracias por tu compra. Puedes consultar aquí el estado de tu pedido.')
on conflict (key) do nothing;

create index if not exists orders_tracking_token_idx
on public.orders ((data->>'tracking_token'));

drop function if exists public.crear_pedido(jsonb);

create function public.crear_pedido(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  it jsonb;
  pr jsonb;
  cur int;
  q int;
  nn bigint;
  item_count int;
  token text;
  order_data jsonb;
  customer_name text;
  customer_phone text;
  customer_addr text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Solicitud invalida';
  end if;

  customer_name := trim(coalesce(p->>'name',''));
  customer_phone := trim(coalesce(p->>'phone',''));
  customer_addr := trim(coalesce(p->>'addr',''));

  if customer_name = '' or length(customer_name) > 120 then
    raise exception 'Nombre invalido';
  end if;

  if customer_phone = '' or length(customer_phone) > 40 then
    raise exception 'Telefono invalido';
  end if;

  if customer_addr = '' or length(customer_addr) > 500 then
    raise exception 'Direccion invalida';
  end if;

  if jsonb_typeof(p->'items') <> 'array' then
    raise exception 'Articulos invalidos';
  end if;

  item_count := jsonb_array_length(p->'items');
  if item_count < 1 or item_count > 20 then
    raise exception 'Cantidad de articulos invalida';
  end if;

  for it in select value from jsonb_array_elements(p->'items') loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'Articulo invalido';
    end if;

    if coalesce(it->>'pid', '') = '' then
      raise exception 'Producto invalido';
    end if;

    begin
      q := (it->>'qty')::int;
    exception when others then
      raise exception 'Cantidad invalida';
    end;

    if q is null or q < 1 or q > 20 then
      raise exception 'Cantidad invalida';
    end if;

    select data into pr
    from public.products
    where id = it->>'pid'
      and data->>'status' = 'published'
    for update;

    if pr is null then
      raise exception 'Producto no disponible';
    end if;

    if jsonb_typeof(pr->'sizes') = 'object' then
      if coalesce(it->>'size', '') = '' then
        raise exception 'Talla requerida';
      end if;

      cur := coalesce((pr->'sizes'->>(it->>'size'))::int, 0);
      if cur < q then
        raise exception 'Sin existencias';
      end if;

      update public.products
      set data = jsonb_set(data, array['sizes', it->>'size'], to_jsonb(cur - q))
      where id = it->>'pid';
    else
      cur := coalesce((pr->>'stock')::int, 0);
      if cur < q then
        raise exception 'Sin existencias';
      end if;

      update public.products
      set data = jsonb_set(data, '{stock}', to_jsonb(cur - q))
      where id = it->>'pid';
    end if;
  end loop;

  token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');

  order_data := p
    || jsonb_build_object(
      'date', now(),
      'status', 'Pendiente de confirmar',
      'payment_status', 'Pendiente',
      'delivery_status', 'Pendiente',
      'tracking_token', token,
      'updated_at', now(),
      'status_history', jsonb_build_array(
        jsonb_build_object('status','Pendiente de confirmar','at',now())
      )
    );

  insert into public.orders(data)
  values (order_data)
  returning n into nn;

  return jsonb_build_object('n', nn, 'token', token);
end
$function$;

create or replace function public.consultar_pedido(p_n bigint, p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_data jsonb;
begin
  if p_n is null or p_n < 1 or p_token is null or length(trim(p_token)) < 40 then
    return null;
  end if;

  select jsonb_build_object(
    'n', n,
    'date', data->>'date',
    'name', data->>'name',
    'items', data->'items',
    'status', coalesce(data->>'status','Pendiente de confirmar'),
    'payment_status', coalesce(data->>'payment_status','Pendiente'),
    'delivery_status', coalesce(data->>'delivery_status','Pendiente'),
    'payment_method', coalesce(data->>'payment_method',''),
    'delivery_method', coalesce(data->>'delivery_method',''),
    'updated_at', data->>'updated_at',
    'status_history', coalesce(data->'status_history','[]'::jsonb)
  )
  into result_data
  from public.orders
  where n=p_n and data->>'tracking_token'=trim(p_token);

  return result_data;
end
$function$;

revoke execute on function public.crear_pedido(jsonb) from public, authenticated;
grant execute on function public.crear_pedido(jsonb) to anon;

revoke execute on function public.consultar_pedido(bigint,text) from public, authenticated;
grant execute on function public.consultar_pedido(bigint,text) to anon;
