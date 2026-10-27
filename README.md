# Tavixo · Sprint 11

Monorepo npm con Next.js 16 / React 19 (PWA), NestJS 11, Prisma 6 y PostgreSQL 17.9. Node.js 24 LTS recomendado. Piloto: **Birria El Cachanilla**, slug `birria-el-cachanilla`.

## Alcance

Login, JWT de acceso (15 minutos), refresh token opaco (7 días) en cookie HttpOnly, rotación y detección de reutilización, cierre de sesión con revocación, restaurante asociado a la sesión, consulta del equipo y edición del nombre. Interfaz en español. Los tokens de acceso viven solamente en memoria; no se guardan en localStorage. No hay registro público.

La PWA incluye manifiesto, iconos PNG, service worker y pantalla de desconexión. No guarda datos privados ni respuestas API en caché. La operación requiere conexión en este sprint. Instalación desde navegador compatible sobre HTTPS o localhost; el comportamiento de instalación varía según navegador.

Incluye administración de sucursales y equipo, asignación de roles y sucursal, desactivación/reactivación, creación de restaurantes y cambio de contexto entre las membresías autorizadas. Cada usuario puede cambiar su propia contraseña. Menú y configuración de mesas están disponibles por sucursal. Incluye comandas por mesa, ocupación y tablero de cocina con actualización cada 5 segundos. Incluye cobros en efectivo y registro de pagos aprobados en terminal externa. No hay registro público ni autoasignación de roles.

## Caja por turnos del Sprint 11

En **Turnos de caja**, selecciona la sucursal y abre un turno con fondo inicial. Hay una caja compartida y sólo un turno abierto por sucursal. OWNER/MANAGER/CASHIER pueden abrir, registrar movimientos y cerrar; cajero sólo en su sucursal asignada.

- Cobros nuevos se asocian automáticamente al turno abierto dentro de la misma transacción del pago. Si no hay turno abierto, permanecen en resumen diario sin turno; no se asignan retroactivamente. La operación de cobro existente sigue disponible.
- Un turno puede cruzar medianoche. Sus ventas se calculan por la relación de pago/turno, no por fecha diaria ni rangos aproximados. Efectivo/tarjeta de pagos mixtos separados y cada cuenta contada una sola vez.
- Retiros y gastos requieren importe positivo y motivo; guardan responsable y fecha. No se pueden editar/eliminar ni registrar sobre un turno cerrado. El importe no puede superar el efectivo esperado disponible.
- Efectivo esperado = fondo inicial + ventas netas en efectivo − retiros − gastos. El cambio de los cobros ya está descontado. Al cerrar, contar el fondo inicial junto al resto del efectivo; diferencia = contado − esperado.
- Cierre guarda fecha, responsable, notas y fotografía de ventas/movimientos/diferencia. Permite abrir después otro turno; no cambia cortes diarios ni pagos anteriores. Actualización manual de caja; revisión esperada detecta cobros/movimientos concurrentes antes de guardar o cerrar.
- Reintentos exactos de apertura/movimiento/cierre no duplican operaciones; UUID e importes/revisión forman el contrato de cada envío.
- Historial: últimos 50 turnos cerrados; detalle últimos 200 movimientos por turno, totales completos. Sin depósitos, entradas adicionales, transferencias entre cajas, adjuntos de gastos, exportaciones ni reapertura de turnos cerrados en esta entrega.
- El corte diario de Caja y ventas sigue siendo una fotografía acumulada de cobros; no incluye retiros/gastos de turnos. Usa el cierre de turno para esa conciliación.

| Método | Ruta | Uso |
|---|---|---|
| GET | /api/restaurant/branches/:branchId/cash/shifts | Turno activo con resumen e historial de cerrados |
| POST | /api/restaurant/branches/:branchId/cash/shifts | requestId, openingCents |
| POST | /api/restaurant/branches/:branchId/cash/shifts/:id/movements | requestId, kind WITHDRAWAL/EXPENSE, amountCents, reason, expectedRevision |
| POST | /api/restaurant/branches/:branchId/cash/shifts/:id/close | requestId, countedCents, notes, expectedRevision |

Migración aditiva `20261014080000_cash_shifts`: agrega turnos/movimientos y Payment.shiftId nullable, sin inventar turnos ni asociar pagos anteriores. Requiere autorización específica de despliegue y respaldo. Conservar tablas y enlaces al revertir; una versión anterior puede cobrar sin registrar el turno y omitir movimientos, por lo que no se debe volver mientras haya un turno activo sin evaluar esa operación.

## Pago mixto del Sprint 10

En **Cobrar cuenta**, selecciona **Mixto · efectivo y tarjeta**. Captura cuánto se paga con tarjeta; Tavixo calcula la parte en efectivo. Captura efectivo recibido, folio de terminal y confirma que la terminal aprobó la parte con tarjeta. Un solo guardado registra ambas partes y cierra la cuenta.

- Ambas partes deben ser positivas y sumar exactamente el total vigente. Ejemplo: cuenta $55, tarjeta $25, efectivo $30; si recibes $50 en efectivo, el cambio es $20.
- Un Payment por cuenta conserva importe total, partes en efectivo/tarjeta, recibido, cambio, folio y responsable. No se registran abonos independientes ni se procesan tarjetas desde Tavixo.
- API: método MIXED y cardAmountCents; receivedCents es efectivo recibido **más** parte aprobada con tarjeta. En interfaz/comprobante, efectivo recibido se muestra separado. El servidor deriva la parte neta en efectivo del total y valida todo en centavos enteros.
- Propietario/gerente/cajero; cuenta entregada y todas las rondas vigentes entregadas. Reintentos idénticos y carreras de cobro conservan un único pago, con totales esperados y bloqueo común con rondas/cancelaciones.
- Comprobante digital y PDF muestran ambas partes y cambio. Caja suma las partes a sus medios, pero cuenta el pago mixto una sola vez; cada contador por medio puede incluir la misma cuenta mixta.
- Cortes guardados anteriores conservan su fotografía; no se recalculan ni se alteran. Sin pagos parciales, división entre personas/productos o devoluciones en esta entrega.

Migración en dos pasos: `20261014070000_mixed_payments` agrega el método MIXED; `20261014071000_mixed_payments` agrega partes, rellena sólo las columnas nuevas de pagos anteriores y valida coherencia. Se preservan importes, cambio, folios, fechas, hashes de reintentos y cortes. Despliegue pendiente de autorización específica. Una vez registrados pagos mixtos, no regresar al Sprint 9 sin adaptar su lectura de este nuevo método; conservar todas las columnas y registros.

## Cancelación de productos del Sprint 9

Propietario o gerente pueden cancelar cantidades parciales o completas de una línea de una cuenta abierta. Desde Comandas, pulsa **Cancelar [producto]**, captura cantidad y motivo y confirma.

- Se conserva la cantidad original, nombre y precio de la línea. Cada cancelación guarda cantidad, motivo obligatorio, responsable y fecha; el importe descontado usa el precio original, aunque cambie el menú.
- Total, ticket y cobro usan sólo cantidades vigentes. Los productos cancelados quedan visibles en el historial; cocina muestra cantidades restantes y omite líneas completamente canceladas.
- Ronda sin productos vigentes pasa a Cancelada. Las demás conservan su avance. Una cuenta sin productos vigentes se cancela y libera la mesa sin inventar un pago.
- No se cancelan productos de cuentas ya pagadas, cerradas o canceladas. No procesa devoluciones de dinero ni modifica ventas o cortes anteriores.
- El servidor valida cantidades/total esperados y serializa cancelaciones con rondas, entregas y cobros. Reintentos idénticos no duplican cancelaciones; cambios simultáneos exigen actualizar antes de continuar.
- El permiso se revalida al escribir: sólo OWNER/MANAGER del restaurante, con validación de sucursal/cuenta/línea. No hay borrado de líneas ni cancelaciones por mesero/cajero/cocina.

| Método | Ruta | Uso |
|---|---|---|
| POST | /api/restaurant/branches/:branchId/orders/:id/items/:itemId/cancellations | requestId UUID, quantity, expectedCancelledQuantity, expectedTotalCents y reason obligatorio |

Migración aditiva `20261014060000_item_cancellations`: cantidad cancelada inicial cero y auditoría vacía; preserva datos existentes. Despliegue requiere autorización específica y respaldo. Tras operar cancelaciones no volver al Sprint 8 sin evaluar las cuentas afectadas: esa aplicación desconoce cantidades canceladas y puede presentar tickets incorrectos. Conservar siempre auditoría y campos nuevos.

## Caja y ventas del Sprint 8

**Caja y ventas** permite consultar cobros por día y sucursal en horario `America/Mexico_City`, separar efectivo/tarjeta y guardar una conciliación con fondo inicial, efectivo contado, responsable, fecha y notas.

- Ventas basadas exclusivamente en `Payment.createdAt`, independientemente del día en que se abrió la cuenta. Cuentas abiertas/canceladas y cerradas históricas sin pago no se cuentan como ventas cobradas.
- Efectivo esperado = fondo inicial + ventas netas en efectivo. El cambio ya está descontado; no se suma el dinero recibido bruto. Diferencia = efectivo contado − efectivo esperado: positivo sobrante, negativo faltante. El efectivo contado debe incluir el fondo inicial.
- OWNER/MANAGER consultan sus sucursales; CASHIER sólo la asignada. WAITER/KITCHEN no acceden. Sin enlaces públicos ni caché de datos privados.
- Corte guardado inmutable por API: conserva los totales y el detalle del momento. No modifica pagos, cierra cuentas ni bloquea la operación. Varios cortes del día son **acumulados desde medianoche**, no turnos: no se suman entre sí.
- Resumen actual requiere actualización manual. Si cambiaron los pagos entre consulta y corte, el servidor devuelve conflicto y solicita actualizar. UUID de envío y reintentos conservan un único corte ante respuesta perdida.
- Totales incluyen todos los pagos; detalle acotado a los últimos 200 y listado a los últimos 50 cortes del día, con aviso en pantalla. No hay exportación de reportes, turnos, retiros, depósitos, gastos, propinas o devoluciones en esta entrega.

| Método | Ruta | Uso |
|---|---|---|
| GET | /api/restaurant/branches/:branchId/cash/summary?day=YYYY-MM-DD | Resumen diario y últimos 200 cobros |
| GET | /api/restaurant/branches/:branchId/cash/cuts?day=YYYY-MM-DD | Últimos 50 cortes guardados del día |
| POST | /api/restaurant/branches/:branchId/cash/cuts | Guardar corte con requestId, day, openingCents, countedCents, expectedTotalCents, expectedPaymentCount y notes opcional |

Migración aditiva `20261014050000_cash_cuts`: agrega CashCut y su relación de sucursal; no reescribe órdenes, rondas o pagos ni crea cortes históricos. Despliegue pendiente de autorización específica. Conservar tabla y cortes al revertir aplicaciones; el Sprint 7 no expone este módulo, pero sigue operando con el esquema ampliado.

## Rondas del Sprint 7

Desde **Comandas**, pulsa **Agregar productos** en una cuenta abierta o selecciónala en **Destino del pedido**. Agrega los productos y pulsa **Enviar nueva ronda a cocina**. La misma mesa conserva una sola cuenta y un total acumulado.

- Cada ronda tiene sus propios productos, indicaciones y estados: Enviada → En preparación → Lista → Entregada. Cocina muestra solamente rondas pendientes; los productos ya entregados no se vuelven a preparar.
- Cada línea conserva el nombre y precio vigente al enviarse. Cambiar el menú no modifica rondas anteriores. Los tickets incluyen todas las líneas y el total acumulado.
- OWNER/MANAGER/WAITER/CASHIER pueden agregar productos. Cocina prepara y marca lista; piso registra entrega. Sólo se puede cobrar cuando todas las rondas estén entregadas.
- Reintentos del mismo envío no duplican productos. El servidor valida el total esperado y serializa cobros, cambios de estado y nuevas rondas; ante un conflicto se actualiza la cuenta antes de continuar.
- Hasta 100 líneas por cuenta y cantidades de 1 a 100 por línea; un producto puede repetirse en diferentes rondas. No se agregan productos a cuentas cerradas/canceladas ni productos agotados o inactivos.
- La cancelación administrativa sigue siendo de la cuenta completa, con motivo. No hay edición ni eliminación de líneas en Sprint 7; Sprint 9 añade cancelación auditada de cantidades.

| Método | Ruta | Uso |
|---|---|---|
| POST | /api/restaurant/branches/:branchId/orders/:id/rounds | Añadir ronda: requestId UUID, expectedTotalCents, items y notes opcionales |
| PATCH | /api/restaurant/branches/:branchId/orders/:id/rounds/:roundId/status | Avanzar ronda con status y expectedStatus |

Migración aditiva `20261014040000_rounds`: crea la primera ronda de cuentas anteriores y enlaza sus líneas sin cambiar precios, totales, eventos ni pagos. Las cuentas históricas cerradas siguen sin recibir pagos ficticios. Requiere respaldo y autorización de despliegue. No eliminar las tablas/columnas nuevas para revertir: conservar datos y evaluar el estado de las cuentas con varias rondas antes de regresar a una aplicación anterior. El modelo permite líneas antiguas sin ronda y las enlaza al reanudar una escritura con Sprint 7.

## Tickets digitales del Sprint 6

En **Comandas**, abre **Ver cuenta digital** para consultar una cuenta o **Ver comprobante de pago** cuando tenga pago registrado. La vista previa incluye restaurante/sucursal, mesa, folio, fecha del pedido, productos, cantidad, precio unitario y total MXN. El comprobante agrega método, importe pagado, recibido/cambio para efectivo, folio de terminal, actor y fecha del pago.

- **Descargar PDF** genera un archivo privado descargable; puedes compartir el archivo por tu medio habitual. No se crean enlaces públicos ni se envían mensajes desde Tavixo.
- Sólo OWNER/MANAGER/CASHIER/WAITER tienen acceso a estos tickets. KITCHEN no tiene acceso. La sucursal y el restaurante se validan con la sesión en ambos endpoints.
- Una cuenta sin pago no genera comprobante: devuelve 409. Las cerradas del Sprint 4 muestran «Cuenta cerrada · sin pago registrado». Las canceladas no generan tickets de cuenta o pago.
- Datos leídos en una transacción consistente y precios/nombres de las líneas guardadas, independientes del menú actual. Descargar o repetir no cambia estados, eventos ni pagos.
- PDF de formato compacto con fuentes Liberation Sans incluidas (licencia OFL en `apps/api/assets/fonts`), acentos, salto de página sin partir una línea de producto y numeración. Fechas del ticket en America/Mexico_City, igual en vista previa y PDF.
- No se guardan PDFs en el servidor ni tickets en caché del navegador. Datos de vista previa sólo en memoria; descarga con sesión vigente y `Cache-Control: no-store`. Un archivo descargado queda bajo control del usuario.
- Sin impresoras físicas, impresión automática, QR público, correo/WhatsApp automatizado, facturación fiscal o historial de descargas en esta entrega. El formato digital fue la prioridad solicitada.

| Método | Ruta | Uso |
|---|---|---|
| GET | /api/restaurant/branches/:branchId/orders/:id/ticket?kind=ACCOUNT | Vista previa de cuenta; ACCOUNT es el valor predeterminado |
| GET | /api/restaurant/branches/:branchId/orders/:id/ticket?kind=PAYMENT | Comprobante; requiere pago registrado |
| GET | /api/restaurant/branches/:branchId/orders/:id/ticket.pdf?kind=ACCOUNT o PAYMENT | PDF autenticado, attachment |

No hay cambios de esquema ni migraciones nuevas en el Sprint 6. La actualización requiere autorización específica y respaldo previo; sólo actualizar API/web de Tavixo. Datos de cuentas/pagos permanecen compatibles con Sprint 5.

## Cobros del Sprint 5

Desde **Comandas**, OWNER/MANAGER/CASHIER pueden cobrar una cuenta Entregada. Meseros registran la entrega y Cocina prepara; ambos pueden consultar el historial, pero no registrar pagos.

- **Efectivo:** captura el importe recibido en MXN. Debe cubrir el total; el servidor calcula cambio y registra total/recibido/cambio, actor y fecha.
- **Tarjeta:** realiza el cobro en la terminal externa y después registra su folio. La interfaz requiere confirmar que fue aprobado. El importe debe ser exactamente el total; no hay cambio. Tavixo no procesa ni solicita datos de tarjeta.
- Registro del pago, evento de cierre y liberación de mesa ocurren en una sola transacción. Una cuenta tiene un solo pago; no hay abonos, pagos mixtos, propinas, descuentos ni reembolsos en este sprint.
- Los reintentos usan una referencia UUID. La misma referencia/cuerpo devuelve el mismo resultado; cuerpos distintos o un segundo pago devuelven 409. El navegador conserva sólo el registro pendiente en sessionStorage, sin tokens; muestra «no vuelvas a cobrar al cliente» si falta confirmar la respuesta.
- El cierre directo por `PATCH status` se rechaza. Una cuenta nueva se cierra al registrar el pago, o se cancela con el motivo y permisos anteriores. Las cuentas cerradas del Sprint 4 se conservan como **cerradas sin pago registrado**, sin inventarles pagos.
- La consulta de cuentas incluye resumen del pago: método, total, recibido/cambio, folio de terminal, actor y fecha. No existe edición/borrado de pagos ni integración con bancos/terminales.

| Método | Ruta | Acceso |
|---|---|---|
| POST | /api/restaurant/branches/:branchId/orders/:id/payment | OWNER/MANAGER/CASHIER; requestId, method CASH/CARD, receivedCents, expectedTotalCents, reference para tarjeta |

`expectedTotalCents` sirve para detectar un total obsoleto; el importe del pago se obtiene de la cuenta guardada. Todos los importes son enteros de 0 a 2147483647 centavos MXN. Migración aditiva `20261014030000_payments`: tabla Payment, índices únicos, FK compuesta y CHECK de importes/método. Conserva cuentas, catálogo, mesas, credenciales y eventos previos. Requiere respaldo previo y autorización específica antes de aplicarse en producción.

Una reversión de aplicaciones a Sprint 4 conserva la tabla Payment, pero esa versión no muestra pagos y permite cierres sin pago; limitar el uso de caja hasta volver al Sprint 5. No revertir datos financieros ni aplicar la nueva migración sin respaldo.

## Comandas y cocina del Sprint 4

- **Comandas:** selecciona una mesa libre, productos, cantidades e indicaciones. El envío abre la cuenta y la ocupa. Sólo OWNER/MANAGER/WAITER/CASHIER crean comandas.
- **Cocina:** OWNER/MANAGER/KITCHEN avanzan de Enviada a En preparación y Lista. WAITER/CASHIER y administradores registran la entrega. El Sprint 5 cierra la cuenta al registrar el cobro.
- **Cancelación:** sólo OWNER/MANAGER, motivo obligatorio y registro de actividad. No se puede alterar una cuenta terminada.
- Los nombres, precios y total se congelan al enviar. La API calcula el total desde productos activos/disponibles y categorías activas de la misma sucursal. Rechaza precios del cliente, cantidades inválidas y productos repetidos en líneas separadas.
- Referencia UUID por envío; reintentar el mismo cuerpo devuelve la misma comanda, aunque el precio del menú haya cambiado. Reusar la referencia con otro cuerpo devuelve 409. La web conserva únicamente el envío pendiente en sessionStorage, sin tokens, por restaurante/sucursal, y lo elimina al confirmarse; no guarda respuestas API ni permite enviar sin conexión.
- Una cuenta abierta por mesa, protegida por transacción y por índice único parcial de PostgreSQL. Cambios de estado requieren `expectedStatus` para detectar acciones concurrentes. Historial con nombre del actor, fecha y motivo; consulta de todas las abiertas más las últimas 50 terminadas.
- Precio unitario de 0 a 99999999 centavos; 1–100 unidades por producto, máximo 100 líneas y total hasta 2147483647 centavos. Moneda MXN.
- Actualización automática por consultas cada 5 segundos; este sprint no incorpora Socket.IO. Una comanda equivale a una cuenta completa: agregar rondas, dividir cuentas, tickets e inventario quedan pendientes. Desde el Sprint 5, el cierre requiere registrar el cobro.

| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/restaurant/branches/:branchId/orders | Admin: sucursal del restaurante; operativo: asignada |
| POST | /api/restaurant/branches/:branchId/orders | OWNER/MANAGER/WAITER/CASHIER; requestId, tableId, items, notes |
| PATCH | /api/restaurant/branches/:branchId/orders/:id/status | Según transición; status, expectedStatus, reason para cancelar |

Migración aditiva `20261014020000_orders`: crea Order/OrderItem/OrderEvent, índices y claves compuestas. No cambia productos, precios, categorías ni mesas existentes. Conserva referencias de historial: las entidades del catálogo se desactivan, no se borran. Reversión de aplicaciones al Sprint 3 posible conservando el esquema aditivo; las cuentas del Sprint 4 no estarán visibles en la versión anterior. Respaldar antes de migrar y no eliminar datos de producción.

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

### Sprint 12: reportes de ventas

La pestaña **Reportes de ventas** permite consultar una sucursal y un período de 1 a 366 días inclusive, hasta hoy, en `America/Mexico_City`. Propietario y gerente pueden consultar sus sucursales; cajeros sólo su sucursal asignada. Endpoint privado: `GET /api/restaurant/branches/:branchId/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`.

Incluye ventas cobradas, cuentas, ticket promedio (redondeado a centavos), efectivo/tarjeta, pagos mixtos, unidades, días sin ventas y los 50 productos más vendidos por unidades, con desempate por importe. Los totales incluyen todos los registros. Se utiliza la fecha del pago, no la apertura de la cuenta; se excluyen cuentas sin pago y unidades canceladas. Los importes y nombres proceden de las líneas históricas, conservando cambios de precio; un producto renombrado puede aparecer en varios renglones. La pantalla avisa si el detalle histórico de productos no coincide con los cobros.

Los reportes se leen en una transacción consistente, no guardan cortes, no alteran cuentas y no incluyen fondos iniciales/retiros/gastos como ventas. Consultar **Turnos de caja** para esos movimientos. No requiere migración ni nuevas variables de entorno.

### Certificado de producción

Tavixo renueva su certificado mediante DNS-01 de Hostinger desde el 15 de octubre de 2026, sin depender del puerto 80. El temporizador de Certbot y el hook ejecutan la renovación automáticamente. La credencial permanece fuera de la aplicación y del repositorio, sólo accesible para root; debe mantenerse vigente. Consulte [instalación y funcionamiento](infra/tls/README.md) y [resultados verificados](infra/tls/RESULTS.md). La configuración de los otros servicios y las reglas del firewall no se modificaron.

### Parche de seguridad de octubre de 2026

Dependencias fijadas en Next.js **16.4.1**, React/React DOM **19.3.1** y Sharp **0.35.5** en el lockfile. Los avisos oficiales, las pruebas y la verificación del despliegue se documentan en [SECURITY_PATCH_RESULTS.md](SECURITY_PATCH_RESULTS.md).

## Manual y mejoras futuras

- [Manual de usuario](docs/MANUAL_USUARIO.md): operación por roles, comandas, pagos, tickets, turnos y reportes de la versión actual.
- [Mejoras futuras](docs/MEJORAS_FUTURAS.md): lista en espera de solicitud y cotización del cliente. No autoriza nuevos desarrollos ni despliegues.

### Navegación y reportes visuales

La navegación muestra todas las opciones en grupos de Operación, Caja y reportes, y Gestión, sin desplazamiento horizontal. Equipo se encuentra en Gestión y conserva sus permisos anteriores.

Reportes de ventas incorpora una gráfica diaria, distribución efectivo/tarjeta (con pagos mixtos repartidos), barras de los cinco productos más vendidos e indicadores de mejor día, promedio diario y unidades vendidas. Las tablas y los cálculos originales de la API se conservan. No requiere migración ni nuevas dependencias.

### Exportación de reportes a Excel

`GET /api/restaurant/branches/:branchId/reports/sales.xlsx?from=YYYY-MM-DD&to=YYYY-MM-DD` requiere los mismos permisos y filtros que el reporte JSON. Genera un XLSX con tres hojas, importes numéricos, fechas, filtros, encabezados fijos y marca del restaurante. Incluye todos los productos; el JSON conserva su límite de 50. Se consulta una nueva instantánea transaccional al descargar; no se envían reportes ni credenciales a terceros. Sin migraciones. ExcelJS 4.4.0 utiliza UUID 11.1.1 mediante override para incluir la corrección de límites de buffer.

### Documentación en Obsidian

Índice en la bóveda Development: [Tavixo](obsidian://open?vault=Development&file=Tavixo%2FTavixo). Para actualizar las copias públicas ejecutar `node scripts/sync-obsidian.mjs`; detalles en [docs/OBSIDIAN.md](docs/OBSIDIAN.md). Las instrucciones para agentes están en [AGENTS.md](AGENTS.md).

### Dirección de producción

Acceso principal: https://tavixo.nut.com.mx/. El acceso anterior de Birria redirige por HTTPS. Se requiere iniciar sesión de nuevo y reinstalar la PWA desde la nueva dirección si se usaba la instalación anterior. Ver [DOMAIN_CHANGE_RESULTS.md](DOMAIN_CHANGE_RESULTS.md).

### Segundo piloto

Bill-Cochi-Nada (`bill-cochi-nada`) está registrado con una cuenta propietaria independiente, 5 categorías, 30 productos y 3 mesas de 4 lugares. Ver [PILOT_ONBOARDING_RESULTS.md](PILOT_ONBOARDING_RESULTS.md) para alcance y comprobaciones. Las credenciales se entregan por archivo privado fuera de Git.

### Configuración de identidad y primera entrada

Disponible en producción desde el 26 de octubre de 2026: configuración por restaurante para subir/quitar logo PNG/JPG, elegir paleta y ver una previsualización, con invitación inicial opcional para propietarios/gerentes. Migración aditiva de configuración en Restaurant; imágenes normalizadas guardadas en PostgreSQL, sin volumen adicional ni URLs remotas. Incluye identidad sugerida de Bill-Cochi-Nada sin modificar la marca de Birria. Ver [docs/PERSONALIZACION.md](docs/PERSONALIZACION.md).

## Identidad Tavixo

Guía de diseño v1 con logo vectorial, construcción, paleta terracota/carbón/crema, tipografía, tokens y aplicaciones. Dirección visual aprobada; integración en acceso, fuente, PWA y paleta genérica validada localmente, pendiente de publicación. Las identidades de los pilotos se conservan. Ver [docs/IDENTIDAD_TAVIXO.md](docs/IDENTIDAD_TAVIXO.md).
