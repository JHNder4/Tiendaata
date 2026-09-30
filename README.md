# Tienda Ata

Tienda en línea estática en español, desplegada desde GitHub en Vercel, con Supabase como base de datos y Clerk para el acceso administrativo.

## Arquitectura

- **Tienda pública:** HTML/CSS/JavaScript sin proceso de build.
- **Supabase:** productos, pedidos, promociones e imágenes.
- **Clerk:** inicio de sesión del administrador.
- **Vercel:** hosting, API de configuración de Clerk y proxy `/__clerk`.
- **Administrador autorizado:** la cuenta Clerk con ID `user_3K2Cx9Aqax6SzuYy6LO1TvIGxfk`.

La autorización administrativa se comprueba en la Edge Function `admin-panel`. El navegador nunca recibe `CLERK_SECRET_KEY`.

## Variables necesarias

### Vercel

Configura como variables de entorno de producción:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — clave publicable de Clerk.
- `CLERK_SECRET_KEY` — clave secreta de Clerk. Solo servidor.

La ruta `/api/clerk-config` expone únicamente la clave publicable.

### Supabase Edge Function

En los secretos de la función `admin-panel`:

- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`

`CLERK_ADMIN_USER_ID` es opcional porque la función ya tiene como respaldo el ID del administrador autorizado. Si se define, ese valor tiene prioridad.

Los secretos de Supabase deben permanecer fuera de Git. Supabase documenta que los secretos de producción se administran desde el Dashboard o con `supabase secrets set`. 

## Clerk

La aplicación usa Clerk JS y el proxy de Frontend API en:

`/__/clerk`

La ruta real del proyecto es:

`/__clerk/*`

y Vercel la reescribe hacia `/api/__clerk/*`.

Para comprobar una integración Clerk existente, la CLI actual dispone de:

```bash
npx -y clerk@latest doctor
```

Para vincular un proyecto a una aplicación Clerk existente:

```bash
npx -y clerk@latest link --app app_3K2A1MYaH34APJRXi24QDCiQ1hd
```

No se deben guardar claves secretas en el repositorio.

## Supabase

La función administrativa se mantiene en:

`supabase/functions/admin-panel/index.ts`

y está configurada con `verify_jwt = false` porque valida la sesión de Clerk dentro de la propia función.

Para desplegarla manualmente:

```bash
npx supabase functions deploy admin-panel --project-ref svvylvtmmynxkmdowymx
```

El workflow de GitHub `.github/workflows/supabase-functions.yml` también puede desplegarla automáticamente después de configurar los secretos de GitHub correspondientes.

## Desarrollo local

No requiere build:

```bash
python3 -m http.server 4173
```

Abre `http://localhost:4173`.

## Seguridad

- Nunca colocar `CLERK_SECRET_KEY` en `index.html`, `app.js`, variables públicas ni GitHub.
- La clave publicable de Clerk sí puede llegar al navegador.
- La clave publicable de Supabase no sustituye RLS.
- El panel administrativo no depende de un código almacenado en el navegador.
- Los cambios administrativos pasan por la Edge Function y se validan contra la sesión Clerk.
