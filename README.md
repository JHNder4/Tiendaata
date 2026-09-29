# TiendaATA

Tienda online estática en español, desplegable en Vercel, con Supabase como backend. La interfaz conserva el diseño del prototipo original.

## Conexión y seguridad

- El navegador usa la **publishable key** de Supabase. Es pública por diseño; nunca añadir aquí una `service_role` key.
- Los visitantes solo pueden consultar productos publicados gracias a RLS.
- El checkout llama a `public.crear_pedido(p jsonb)`, que registra el pedido y descuenta inventario de forma transaccional. Son pedidos de prueba: no hay cobros.
- El panel requiere iniciar sesión con Supabase Auth y pertenecer a `public.admins`. Pedidos, cambios de productos e imágenes quedan restringidos por las políticas RLS existentes.
- No hay registro administrativo público. El propietario debe crear la cuenta en Supabase Auth y autorizarla en `public.admins` desde el SQL Editor. Ejemplo (reemplaza el correo por el correo exacto de la cuenta ya creada):

  ```sql
  insert into public.admins (user_id)
  select id from auth.users where email = 'admin@ejemplo.com'
  on conflict (user_id) do nothing;
  ```

- La función heredada `public.reclamar_admin()` debe permanecer sin permiso de ejecución para usuarios públicos; la migración de este cambio revoca su acceso.

## Desarrollo local

No requiere proceso de build. Sirve la carpeta como sitio estático:

```bash
python3 -m http.server 4173
```

Abre `http://localhost:4173`. Para comprobar el backend, usa el proyecto Supabase vinculado a `tiendaata` y nunca cargues secretos de servidor en el navegador.

## Despliegue

El proyecto usa `index.html`, `app.js` y `vercel.json`. Vercel debe desplegar desde la raíz del repositorio `JHNder4/Tiendaata`; la rama de producción será la rama principal del repositorio.
