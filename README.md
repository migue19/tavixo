# Tavixo · Sprint 3

Monorepo npm con Next.js 16 / React 19 (PWA), NestJS 11, Prisma 6 y PostgreSQL 17.9. Node.js 24 LTS recomendado. Piloto: **Birria El Cachanilla**, slug `birria-el-cachanilla`.

## Alcance

Login, JWT de acceso (15 minutos), refresh token opaco (7 días) en cookie HttpOnly, rotación y detección de reutilización, cierre de sesión con revocación, restaurante asociado a la sesión, consulta del equipo y edición del nombre. Interfaz en español. Los tokens de acceso viven solamente en memoria; no se guardan en localStorage. No hay registro público.

La PWA incluye manifiesto, iconos PNG, service worker y pantalla de desconexión. No guarda datos privados ni respuestas API en caché. La operación requiere conexión en este sprint. Instalación desde navegador compatible sobre HTTPS o localhost; el comportamiento de instalación varía según navegador.

Incluye administración de sucursales y equipo, asignación de roles y sucursal, desactivación/reactivación, creación de restaurantes y cambio de contexto entre las membresías autorizadas. Cada usuario puede cambiar su propia contraseña. Menú y configuración de mesas están disponibles por sucursal. Comandas, ocupación de mesas, cocina en tiempo real y cobros llegarán en los siguientes sprints. No hay registro público ni autoasignación de roles.

## Administración del Sprint 2

- **Resumen:** nombre del restaurante; OWNER puede crear otro restaurante independiente con Sucursal Principal. El selector superior sólo muestra membresías activas de la identidad autenticada. Cambiar restaurante emite una nueva sesión y revoca la anterior.
- **Sucursales:** OWNER y MANAGER crean, editan y desactivan/reactivan. Debe quedar al menos una activa. Los roles operativos consultan únicamente su sucursal asignada; una sucursal inactiva impide login/refresh y revoca sus sesiones operativas.
- **Equipo:** OWNER administra gerentes y roles operativos; MANAGER sólo administra WAITER/CASHIER/KITCHEN. El propietario y los propios permisos no se modifican desde el equipo. Cambiar rol/sucursal o estado revoca las sesiones de esa membresía, sin afectar sus otras membresías.
- **Mi cuenta:** contraseña actual requerida para cambiarla; el cambio revoca todas las sesiones de esa identidad. Se serializa el login con el cambio para impedir emitir sesiones nuevas con una contraseña anterior.

Las altas de empleados requieren un correo nuevo y contraseña de al menos 12 caracteres. Un correo ya existente devuelve 409 y no altera la identidad ni contraseña global; invitar una identidad existente a otro restaurante requerirá un flujo de consentimiento futuro. No se envían correos ni invitaciones en este sprint. No hay borrado de usuarios, transferencia de propiedad ni restablecimiento administrativo de contraseñas compartidas.

La relación compuesta Branch/Membership garantiza en PostgreSQL que una sucursal pertenezca al mismo restaurante de la membresía. Las escrituras administrativas bloquean la fila del restaurante y vuelven a comprobar el rol dentro de la transacción. No se aceptan valores null para saltarse las validaciones de rol/estado/sucursal.

La migración `20261013010000_management` agrega sucursales, crea Sucursal Principal para cada restaurante existente y asigna las membresías previas, sin alterar hashes de contraseña, roles o sesiones. Las cuentas administrativas pueden gestionar el restaurante aunque su sucursal esté inactiva. Antes de aplicarla en producción, respaldar la DB; es una migración aditiva compatible con las imágenes del Sprint 1 para una reversión de aplicaciones.

| Método | Ruta nueva | Permiso |
|---|---|---|
| GET | /api/restaurants | Membresías propias |
| POST | /api/restaurants | OWNER |
| POST | /api/auth/switch | Bearer + Origin; restaurantId autorizado |
| GET | /api/restaurant/branches | Admin: todas; operativo: asignada |
| POST | /api/restaurant/branches | OWNER/MANAGER |
| PATCH | /api/restaurant/branches/:id | OWNER/MANAGER |
| POST | /api/restaurant/members | Según jerarquía de roles |
| PATCH | /api/restaurant/members/:id | Según jerarquía de roles |
| PATCH | /api/me/password | Propia identidad, currentPassword/newPassword |

Ver [SPRINT2_RESULTS.md](SPRINT2_RESULTS.md) para la verificación de esta versión.

## Menú y mesas del Sprint 3

Las pestañas Menú y Mesas muestran un selector de sucursal. OWNER/MANAGER pueden crear, editar y desactivar/reactivar categorías, productos y mesas. Los roles operativos sólo consultan su sucursal asignada. Sus vistas omiten categorías/productos/mesas inactivos; un producto agotado sigue visible como no disponible. Los administradores pueden leer catálogo de sucursales inactivas para revisión, pero no escribirlo.

El catálogo es independiente por sucursal. Al desactivar una categoría, sus productos dejan de aparecer al equipo operativo sin perder sus registros. Productos guardan precios enteros `priceCents` en MXN (0 a 99,999,999 centavos); la interfaz acepta hasta dos decimales. PostgreSQL también valida rangos y relaciones compuestas de restaurante/sucursal/categoría. Mesas tienen nombre, capacidad (1–100) y estado activo; la ocupación dependerá de las órdenes del siguiente sprint, no de un indicador manual.

Las rutas base son `/api/restaurant/branches/:branchId/categories`, `/products` y `/tables`: GET para consulta; POST para alta; PATCH `/:id` para editar. Sólo OWNER/MANAGER escriben. UUID inválidos, campos extra y valores null inválidos devuelven 400; nombres duplicados por sucursal, 409; acceso de personal a otra sucursal, 403; recursos fuera del restaurante, 404.

No se cargan productos, precios o mesas ficticios en el piloto. La migración aditiva `20261013020000_catalog` no modifica cuentas, sucursales o sesiones existentes. Ver [SPRINT3_RESULTS.md](SPRINT3_RESULTS.md).

## Estructura

```text
apps/api/          API, Prisma, migraciones, seed y pruebas
apps/web/          Next.js App Router y PWA
infra/nginx/       vhost de ejemplo, independiente
scripts/           verificación local con PostgreSQL temporal
compose.yaml       servicios aislados del proyecto tavixo
```

## Arranque con Docker Compose (local)

Requisitos: Docker Engine o Docker Desktop con Compose v2, puertos 6000/6001 libres. Ejecutar desde la raíz de este proyecto:

```sh
cp .env.example .env
# Editar .env: contraseña DB, JWT_SECRET (32+ caracteres aleatorios)
# y SEED_ADMIN_PASSWORD único de 12+ caracteres.
# POSTGRES_* y DATABASE_URL deben coincidir; host DB = db.
# Para contraseñas con caracteres especiales, codificar la URL.
docker compose build
docker compose up -d db
docker compose --profile tools run --rm tools npm run db:migrate
docker compose --profile tools run --rm tools npm run db:seed
docker compose up -d api web
docker compose ps
```

Abrir **http://localhost:6001**. Usuario: `SEED_ADMIN_EMAIL`; contraseña: el valor definido por ti. No hay una contraseña predeterminada. El seed es idempotente y no cambia credenciales, nombres ni roles existentes. Cambiar la variable del seed no restablece una contraseña ya creada.

Compose publica exclusivamente `127.0.0.1:6000 → API:3000` y `127.0.0.1:6001 → web:3000`. PostgreSQL **no publica puertos** y está en una red Docker `internal`; web no pertenece a esa red. Volumen independiente `tavixo_tavixo_pgdata`. Límites de memoria/CPU, reinicio y healthchecks definidos. Las aplicaciones corren como usuario sin privilegios.

El puerto 6000 está restringido por algunos navegadores. Usa siempre la web en 6001; sus rutas `/api/*` funcionan como proxy de mismo origen. Puedes comprobar la API directamente con `curl http://127.0.0.1:6000/api/health`.

```sh
docker compose logs --tail=100 api web db
docker compose stop
# docker compose down conserva el volumen. No usar down -v con datos reales.
```

Migraciones y seed se ejecutan explícitamente, nunca automáticamente al arrancar la API. Así no hay escrituras inesperadas en reinicios.

## Desarrollo sin Docker

Requisitos: Node 24 y PostgreSQL 17 privado/local. Para no instalar un servidor, `npm run verify:local` usa un PostgreSQL temporal y lo detiene al terminar; no mantiene una demo abierta.

```sh
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Editar apps/api/.env con una DB propia, secretos y contraseña seed.
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

La API escucha en 127.0.0.1:6000 y Next en 127.0.0.1:6001. Abrir `http://localhost:6001`; `WEB_ORIGIN` debe coincidir exactamente con el origen utilizado, sin slash final. La configuración de raíz `.env` es para Compose; la API local lee `apps/api/.env`.

Para un build de producción local: `npm run build`, luego `npm run start -w @tavixo/api` y `npm run start -w @tavixo/web`. La API con `NODE_ENV=production` exige origen HTTPS y cookie segura. La verificación local utiliza `NODE_ENV=test` para HTTP en loopback.

## Modelo multi-tenant y roles

`User` representa una identidad global; `Membership` vincula usuario + restaurante y contiene rol/estado. Una identidad puede pertenecer a varios restaurantes con roles distintos. El login recibe el slug y solamente emite sesión si esa membresía existe y está activa.

El JWT firmado contiene usuario, restaurante, membresía y sesión. Cada petición protegida comprueba firma, vencimiento, issuer/audience, sesión vigente y estados actuales de usuario/restaurante/membresía. Los roles se consultan desde la DB, no se confía en un rol enviado por el cliente. La API usa exclusivamente el restaurante obtenido de esa membresía: ignora headers de tenant y rechaza campos extra en los DTO. La separación actual es a nivel de aplicación; no se utiliza PostgreSQL RLS. Cualquier entidad futura de negocio debe incluir restaurantId y consultas siempre filtradas por el contexto autenticado.

| Rol | Consultar restaurante / perfil | Consultar equipo | Cambiar nombre |
|---|---|---|---|
| OWNER | Sí | Sí | Sí |
| MANAGER | Sí | Sí | Sí |
| CASHIER | Sí | No | No |
| WAITER | Sí | No | No |
| KITCHEN | Sí | No | No |

`RefreshSession` guarda SHA-256 del token aleatorio de 384 bits. El token original sólo sale en cookie HttpOnly, SameSite=Strict, path=/api/auth. La rotación reclama el token con una actualización condicional en una transacción. Reutilizarlo revoca toda su familia; logout también revoca los JWT asociados a esa familia. Los POST de autenticación exigen `Origin` exacto para prevenir CSRF. No hay CORS abierto. Contraseñas con scrypt + sal aleatoria y comparación constante. Login limitado a 10 intentos por IP por minuto. El límite reside en memoria y corresponde a una sola réplica API; antes de escalar, usar almacenamiento compartido para el rate limit.

## API

| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/health | Público; consulta DB |
| POST | /api/auth/login | Origin; email, password, restaurantSlug |
| POST | /api/auth/refresh | Origin + cookie |
| POST | /api/auth/logout | Origin + cookie |
| GET | /api/me | Bearer JWT |
| GET | /api/restaurant | Bearer JWT |
| PATCH | /api/restaurant | OWNER/MANAGER; `{ "name": "..." }` |
| GET | /api/restaurant/members | OWNER/MANAGER |

401: sesión/credenciales inválidas; 403: rol u origen no permitido; 400: entrada inválida; 429: límite de peticiones. API con `Cache-Control: no-store`. Las respuestas no incluyen hashes de contraseña ni refresh tokens.

## Pruebas

```sh
npm run db:generate
npm run typecheck
npm test
npm run verify:local
```

`verify:local` comprueba que 6000/6001 estén libres, crea un cluster PostgreSQL 17.9 dentro de `work/` en un puerto libre ligado a loopback, verifica primero la actualización desde una base del Sprint 1 con datos existentes y confirma que conserva contraseñas, roles y sesiones; luego ejecuta migraciones/seed repetibles, typecheck, tests y build. Después arranca los artefactos compilados y comprueba web, proxy, PWA, login piloto y refresh. Apaga los procesos que creó y elimina exclusivamente el cluster temporal. No toca instalaciones PostgreSQL existentes. Credenciales efímeras aleatorias; no escribe `.env` ni registra tokens. Logs en `work/` (ignorados por Git).

Para integración con PostgreSQL propio, usar una **DB de pruebas separada cuyo nombre termine en `_test`**:

```sh
DATABASE_URL='postgresql://.../tavixo_test' npm run db:migrate
TEST_DATABASE_URL='postgresql://.../tavixo_test' npm run test:integration
```

Las pruebas crean y eliminan sólo sus fixtures. Nunca apuntar a una base de datos de producción. En sistemas que bloqueen scripts de instalación, aprobar los scripts de Prisma/esbuild/embedded-postgres después de revisarlos. El wrapper embedded-postgres lleva etiqueta beta; sus binarios son PostgreSQL 17.9 y sólo es una herramienta de desarrollo.

## VPS Ubuntu 24.04 compartido: preparación para despliegue autorizado

El estado del despliegue autorizado se registra en [DEPLOYMENT.md](DEPLOYMENT.md). Los siguientes pasos describen el proceso para instalaciones futuras. No reemplazar configuraciones ni servicios existentes.

1. Inspeccionar puertos 6000/6001, RAM/disco y Docker/Nginx existentes. No reinstalar ni reiniciar servicios compartidos. Reservar recursos para Tavixo; los límites de Compose no sustituyen una revisión de capacidad del VPS.
2. Ubicar este proyecto en un directorio propio, por ejemplo `/opt/tavixo`. Crear `.env` con permisos 600 y secretos propios. No reutilizar credenciales de otros servicios.
3. Definir `APP_ENV=production`, `WEB_ORIGIN=https://tavixo.tu-dominio.com` y `COOKIE_SECURE=true`. Mantener `API_INTERNAL_URL=http://api:3000`. No abrir puertos 6000/6001/5432 en firewall.
4. Crear DNS para un **subdominio nuevo** y disponer de un certificado TLS válido antes de habilitar el vhost. `infra/nginx/tavixo.conf` tiene dominios/rutas de certificado de ejemplo y debe editarse. No es un archivo listo para activar sin adaptar.
5. Construir imágenes, arrancar sólo el DB de Tavixo, aplicar migraciones y seed con los comandos anteriores; arrancar API/web y verificar healthchecks. Respaldar DB antes de migraciones posteriores.
6. Copiar el vhost adaptado a un archivo nuevo en `sites-available` y crear un enlace nuevo en `sites-enabled`; no borrar el sitio por defecto ni editar otros vhosts. Ejecutar `sudo nginx -t`. **Sólo con configuración válida y autorización**, recargar Nginx; verificar HTTPS, login y que los sitios previos siguen respondiendo.

Nginx reenvía `/api/` a 127.0.0.1:6000 y la web a 127.0.0.1:6001. Mantiene el Host y sobrescribe X-Forwarded-For para que un cliente no pueda falsificar la IP del rate limit. La API confía en un único salto de proxy. Si se incorpora otro proxy/CDN hay que revisar explícitamente esa política.

No se incluye un script de despliegue automático ni modificación de UFW, systemd o Nginx global. Docker Engine/Compose y obtención de certificados son requisitos previos gestionados por el administrador del VPS.

### Respaldo y recuperación

Con el proyecto Tavixo seleccionado, guardar el respaldo fuera del repositorio en una ubicación protegida:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > tavixo-backup.dump
```

Probar restauración en un entorno separado antes de necesitarla. Restaurar datos requiere una ventana y autorización específicas. Para detener únicamente Tavixo: `docker compose stop api web`. Conservar el DB/volumen y configuración previa; no usar comandos globales para detener contenedores ni eliminar volúmenes.

## Dependencias

Lockfile incluido. Las pruebas usan el runner nativo de Node. Se fija `deepmerge-ts` 8.0.2 mediante override para corregir un aviso en la herramienta Prisma 6; migraciones y generación del cliente se verifican con esa combinación. Consultar el reporte observado en `TEST_RESULTS.md`.

## Referencias técnicas

[PWA en Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps) · [Datasource Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources)

Ver `TEST_RESULTS.md` para los resultados observados y límites de verificación.
