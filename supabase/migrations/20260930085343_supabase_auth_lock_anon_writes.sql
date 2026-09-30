-- Keep the storefront anonymous but deny anonymous writes to application tables.
revoke insert, update, delete, truncate, references, trigger on public.products from anon;
revoke insert, update, delete, truncate, references, trigger on public.orders from anon;
revoke insert, update, delete, truncate, references, trigger on public.promotions from anon;
