# Tienda Ata


## Arquitectura

- **Tienda pública:** HTML/CSS/JavaScript sin proceso de build.
- **Supabase:** productos, pedidos, promociones e imágenes.
- **Vercel:** hosting y despliegue de la tienda.

El panel de administración usa un código de acceso validado en una Edge Function de Supabase. El código no se guarda en el repositorio.

## Variables necesarias

### Vercel

Configura como variables de entorno de producción:



### Supabase Edge Function

En los secretos de la función `admin-panel`:



Los secretos de Supabase deben permanecer fuera de Git. Supabase documenta que los secretos de producción se administran desde el Dashboard o con `supabase secrets set`. 




La ruta real del proyecto es:




```bash
```


```bash
```

No se deben guardar claves secretas en el repositorio.

## Supabase

La función administrativa se mantiene en:

`supabase/functions/admin-panel/index.ts`


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

- La clave publicable de Supabase no sustituye RLS.
- El panel administrativo no depende de un código almacenado en el navegador.
