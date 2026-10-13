# Verificación de Sprint 1

Fecha: 2026-10-13 17:47:02 (America/Mexico_City).
Entorno: macOS arm64, Node 26.8.1, npm 11.19.0. Objetivo de contenedores: Node 24 LTS / Ubuntu 24.04.

## Ejecutado y aprobado

- PostgreSQL **17.9 real**, temporal en loopback; sin mocks de DB.
- Prisma generate y migración inicial SQL con claves foráneas e índices.
- `migrate deploy` ejecutado dos veces; segunda ejecución sin migraciones pendientes.
- Seed ejecutado dos veces; login posterior del OWNER de Birria El Cachanilla correcto.
- TypeScript de ambos workspaces sin errores.
- Build de API y Next.js completo; ejecución del servidor standalone usado en Docker.
- **9 pruebas: 1 de contraseñas + 8 de integración; 0 fallos.**
- Health de API en 127.0.0.1:6000 y web en 127.0.0.1:6001.
- Proxy web → API → PostgreSQL, login piloto, lectura autenticada y refresh vía cookie.
- HTTP 200 en manifiesto, service worker, página offline e iconos PNG 192/512.
- YAML de Compose parseado; comprobados los puertos host exactos, ausencia de puertos DB, red DB interna y ausencia de web en esa red.
- `npm audit` y `npm audit --omit=dev`: **0 vulnerabilidades reportadas** con el lockfile entregado.

## Cobertura de integración

1. Health con consulta a DB y rechazo sin autenticación.
2. Credenciales inválidas, DTO con campos extra y origen no autorizado.
3. Separación entre dos restaurantes: header falso, body con otro tenant, ruta ajena, consultas de equipo y modificación sólo del restaurante propio. Una misma identidad con dos membresías recibe sesiones separadas.
4. Mesero sin acceso administrativo; desactivación de membresía invalida acceso y refresh.
5. JWT adulterado y JWT vencido rechazados.
6. Rotación de refresh, rechazo del token anterior y revocación de familia ante reutilización.
7. CSRF por origen rechazado; logout revoca refresh y JWT asociado.
8. Límite de 10 intentos de login por IP/minuto.

## Límites de la verificación

- **Docker no está instalado en este equipo:** no se construyeron imágenes ni se ejecutó Compose. El YAML y Dockerfiles se revisaron, pero falta validar su ejecución real con Docker.
- **Nginx no está instalado:** no se ejecutó `nginx -t`, ni se verificó TLS o el vhost en Ubuntu. Hay placeholders de dominio y certificado que deben adaptarse antes de habilitarlo.
- PWA: se verificaron archivos y build, no su instalación ni comportamiento offline en un navegador real.
- No se realizaron pruebas de carga, concurrencia de múltiples réplicas ni un pentest. El rate limit actual usa memoria por proceso.
- Rotar refresh invalida el JWT previo de esa sesión; varias pestañas deben renovar su acceso si otra pestaña lo rotó. La UI está diseñada para una sesión activa por pestaña.
- No se conectó al VPS, no se desplegó y no se modificaron servicios existentes.
- Los procesos locales de verificación se apagaron al terminar y el cluster temporal se eliminó. No queda una demo ejecutándose.

## Registro de comprobaciones

```text
2026-10-13T23:47:02.747Z
PASS: npm run db:generate
PASS: npm run db:migrate
PASS: npm run db:migrate
PASS: npm run db:seed
PASS: npm run db:seed
PASS: npm run typecheck
PASS: npm test
PASS: npm run test:integration
PASS: npm run build
PASS: web HTML served on 6001
PASS: web proxy reaches API and PostgreSQL
PASS: PWA asset /manifest.webmanifest
PASS: PWA asset /sw.js
PASS: PWA asset /offline.html
PASS: PWA asset /icon-192.png
PASS: PWA asset /icon-512.png
PASS: pilot login through web proxy
PASS: pilot OWNER membership seeded
PASS: authenticated tenant access through web proxy
PASS: cookie refresh through web proxy
Docker/Nginx runtime checks not performed by this script.
```
