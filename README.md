# MoneyTalk - Backend

API REST de MoneyTalk: autenticación, transacciones, metas de ahorro, pagos recurrentes, notificaciones push y categorización con IA.

**Stack:** Node.js 24, Express 5, TypeScript, Prisma 7 (MySQL vía adaptador MariaDB), Zod, OpenAI, Jest + Supertest.

## Puesta en marcha

1. Instala las dependencias (también genera el cliente de Prisma):
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y completa los valores. Son obligatorios `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `OPENAI_API_KEY`; el servidor no arranca si falta alguno.
3. Aplica las migraciones y carga las categorías base:
   ```bash
   npm run migrate:deploy
   npm run seed
   ```
4. Inicia el servidor:
   ```bash
   npm run dev      # desarrollo, con recarga
   npm run build && npm start   # producción
   ```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta |
| `npm run typecheck` | Verificación de tipos |
| `npm run lint` | ESLint |
| `npm test` | Tests de integración (ver abajo) |
| `npm run migrate` | Crea una migración **sin aplicarla** (`--create-only`) |
| `npm run migrate:deploy` | Aplica las migraciones pendientes |
| `npm run seed` | Crea las categorías base que falten (idempotente) |

## Estructura

```
src/
  app.ts            Express sin listen ni cron (lo usan los tests)
  server.ts         Arranque: listen + jobs
  config/env.ts     Variables de entorno validadas con Zod
  lib/              Clientes únicos: Prisma, OpenAI, web-push, Google
  middlewares/      Auth, validación, errores, rate limit, 404
  routes/           Rutas por recurso (montadas en /api)
  controllers/      Traducen HTTP ↔ servicios
  services/         Lógica de negocio (services/ai/ para la IA)
  prompts/          Prompts de OpenAI y esquemas de respuesta
  validators/       Reglas de express-validator por recurso
  jobs/             Cron: pagos recurrentes y recordatorios
  utils/            AppError, logger, fechas, decimales, tokens
  generated/        Cliente de Prisma (generado, no se versiona)
tests/              Jest + Supertest contra una BD de pruebas
```

## Errores

Todas las respuestas de error tienen la misma forma:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos", "details": [{ "field": "amount", "message": "El monto debe ser mayor a 0" }] } }
```

Los errores 500 nunca exponen detalles internos; se registran en el log del servidor.

## Base de datos y migraciones

- `prisma.config.ts` define la conexión (Prisma 7 ya no lee la URL desde el schema).
- La migración `20261106000000_baseline_sync` alinea el historial con el schema real. En una base de datos que ya tenía el esquema aplicado con `db push`, se marca como aplicada una sola vez:
  ```bash
  npx prisma migrate resolve --applied 20261106000000_baseline_sync
  ```
- Flujo para cambios de esquema: editar `prisma/schema.prisma` → `npm run migrate -- --name descripcion` → revisar el SQL generado → `npm run migrate:deploy`. Nunca usar `db push` contra la base real.

## Tests

Los tests usan una base de datos **separada** (vacían sus tablas en cada test).

1. Crea la base, por ejemplo `moneytalk_test`, con permisos para tu usuario.
2. Copia `.env.test.example` a `.env.test` y apunta `DATABASE_URL` a esa base (su nombre debe contener `test`).
3. `npm test`. Las migraciones se aplican solas antes de correr; OpenAI y web-push van simulados.

## Seguridad

- Access token de 30 minutos y refresh token de 30 días con rotación; el logout invalida el refresh token.
- Contraseñas con bcrypt; todas las rutas de datos exigen autenticación y verifican que el recurso sea del usuario.
- Rate limit en login, registro, refresh, Google y endpoints de IA.
- El texto del usuario se envía a OpenAI como dato delimitado y la respuesta se valida con un esquema antes de usarse.
