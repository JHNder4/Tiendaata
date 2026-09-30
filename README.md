# Tienda Ata

## Arquitectura

- **Tienda pública:** HTML/CSS/JavaScript sin proceso de build.
- **Supabase Auth:** acceso al panel mediante correo + contraseña y sesión JWT.
- **Supabase Database:** productos, pedidos y promociones protegidos con RLS.
- **Supabase Storage:** imágenes en el bucket público `fotos`; solo sesiones autenticadas pueden subir, cambiar o eliminar imágenes.
- **Vercel:** hosting y despliegue de la tienda.

## Administración

`/admin` está protegido por Supabase Auth:

- Correo + contraseña.
- Sesión persistente al recargar.
- Verificación de sesión antes de cargar pedidos, productos o promociones.
- Cerrar sesión con `supabase.auth.signOut()`.
- Sin Clerk.
- Sin `ATA-2026-ADMIN`.
- Las operaciones administrativas usan la sesión/JWT de Supabase y las políticas RLS.

La pantalla también permite crear una cuenta con correo y contraseña. Si el proyecto tiene confirmación de correo activada, primero hay que confirmar el correo recibido y después iniciar sesión.

## Variables

La tienda usa la clave **publishable** de Supabase en el navegador. No se debe colocar nunca una secret/service-role key en el frontend.

## Supabase

Las migraciones de seguridad están en:

- `supabase/migrations/20260930085231_supabase_auth_admin_access.sql`
- `supabase/migrations/20260930085234_supabase_auth_permissions.sql`

La Edge Function heredada `admin-panel` ya no participa en el panel y fue reemplazada por una respuesta 410 con JWT obligatorio para cerrar el antiguo flujo de código/Clerk.

## Desarrollo local

No requiere build:

```bash
python3 -m http.server 4173
```

Abre `http://localhost:4173`.

## Seguridad

- La clave publicable de Supabase no sustituye RLS.
- Los datos administrativos requieren una sesión autenticada.
- El frontend nunca contiene una clave secreta de Supabase.
- El catálogo público solo expone productos publicados y promociones activas.
