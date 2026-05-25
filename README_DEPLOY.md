# COLE Web

Proyecto independiente para la tienda pública de COLE.

## Rutas públicas

- `/` Tienda online
- `/tienda` Compatibilidad con enlaces anteriores
- `/tienda/pago` Resultado de pago Mercado Pago
- `/api/tienda/productos` Productos visibles para web
- `/api/tienda/pedidos` Creación de pedidos web
- `/api/mercadopago/webhook` Confirmación de pagos Mercado Pago

## Variables Vercel

Obligatorias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://colelibreria.com.ar`

Recomendada para insertar pedidos y actualizar pagos sin depender de RLS:

- `SUPABASE_SERVICE_ROLE_KEY`

Mercado Pago se lee desde la tabla `mercado_pago_config` compartida con COLE Gestión.

## Deploy

```powershell
npm install
npm run build
```

Luego subir este proyecto a un repositorio nuevo, por ejemplo `cole-web`, e importarlo en Vercel.
