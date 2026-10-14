# Sprint 4 · Comandas y cocina

Implementado y verificado localmente el 13 de octubre de 2026 (America/Mexico_City). Despliegue autorizado explícitamente y completado en el VPS.

## Resultado

- Captura por mesa libre usando el menú de la sucursal; cantidades e indicaciones por producto y notas generales.
- Estado Enviada → En preparación → Lista → Entregada → Cuenta cerrada. Cancelación por administrador con motivo obligatorio.
- Precio/nombre/total congelados al enviar; cálculo exclusivo en servidor, moneda MXN.
- Una cuenta abierta por mesa. El cierre/cancelación libera la mesa; cerrar no registra pagos y requiere confirmación dentro de la tarjeta.
- Tablero Cocina y vista Comandas con actualización cada 5 segundos, sin Socket.IO en esta entrega.
- Historial de estados con actor/fecha/motivo. Últimas 50 cuentas terminadas y todas las abiertas.
- Referencia UUID de envío y reintento idempotente. El envío pendiente se conserva en sessionStorage por restaurante/sucursal, sin tokens; se limpia al confirmar. No se permite enviar sin internet.
- Aislamiento de restaurante/sucursal y roles comprobados en servidor. Escrituras serializadas con bloqueo del restaurante y nueva comprobación de la membresía.
- Migración aditiva `20261014020000_orders`: nuevas tablas, índices, claves compuestas y CHECK de cantidades/precios. No modifica el catálogo existente.

## Verificación

- **22 pruebas aprobadas:** 1 de contraseñas y 21 de integración, cero fallos.
- Regresión completa de autenticación, refresh, roles, sucursales, equipo y catálogo.
- Snapshot de precio después de editar/agotar el producto; reintentos devuelven una sola comanda y cuerpo distinto con la misma referencia devuelve 409.
- Rechazo de productos/mesas de otro restaurante, sucursales ajenas, productos agotados/categorías inactivas, cantidades inválidas, líneas repetidas, precios enviados por cliente y totales fuera de rango.
- Transiciones por rol, detección de estado obsoleto, auditoría, liberación de mesa y cancelación con motivo.
- Solicitudes simultáneas: misma referencia produce una sola cuenta; dos referencias para la misma mesa producen un éxito y un conflicto.
- Restricciones directas PostgreSQL: referencias de producto/mesa de otro restaurante y cantidades fuera de rango rechazadas.
- Actualización desde Sprint 1 conserva credenciales/roles/sesiones y desde Sprint 3 conserva nombre/precio/disponibilidad del producto y capacidad de mesa.
- Typecheck, build API/web y ejecución standalone aprobados; health, proxy, assets PWA, login piloto, refresh y seed repetible correctos en 127.0.0.1:6000/6001.
- Revisión en navegador local con copia temporal de los 16 productos de la landing y tres mesas de prueba: captura de dos tacos chicos con indicación «Sin cebolla», envío por $58, mesa ocupada, preparación, lista y entrega. Captura `../tavixo-sprint4-cocina.jpg`.
- La confirmación nativa de cierre bloqueó la herramienta del navegador durante la revisión. Se reemplazaron confirmaciones nativas de cierre/cancelación por formularios dentro de la tarjeta y se volvió a aprobar typecheck/build. El cierre fue comprobado por integración; la confirmación final no pudo revalidarse visualmente en esa sesión del navegador.

## Límites y despliegue

Una comanda equivale a una cuenta completa; agregar rondas, dividir cuentas, pagos, tickets, impresión e inventario quedan para próximos sprints. Los datos de demostración viven únicamente en una base temporal local. No se cargan fixtures a producción.

Despliegue completado:

- Código de aplicación `be80290`, construido con Node 24 en Ubuntu 24.04.
- Respaldo privado `/opt/tavixo/backups/pre-sprint4-20261014T014515Z`; archivo de DB validado con listado pg_restore, fuente y entorno guardados con permisos privados. No se realizó restauración del respaldo.
- Imágenes de reversión `tavixo-api:pre-sprint4` y `tavixo-web:pre-sprint4`, con override en el respaldo. No fue necesario revertir.
- Migración `20261014020000_orders` aplicada. Sólo API/web de Tavixo recreadas; ambas saludables.
- Snapshot completo de productos, categorías, mesas, sucursales y membresías idéntico antes/después. Conservados 16 productos, precios y 5 categorías de la landing.
- Los demás contenedores, incluido PostgreSQL de Tavixo, conservaron IDs y tiempos de arranque. Los hashes de configuración Nginx no cambiaron.
- **19 comprobaciones públicas HTTPS aprobadas:** página, health, assets PWA, login, cookie segura, restaurante/sucursal, 16 productos/precios, 5 categorías, consulta de comandas, rechazo sin sesión, refresh, logout y revocación.
- Comprobación adicional en el VPS: creación con cuerpo incompleto rechazada con 400, sin generar pedidos de prueba.
- Navegador público: sesión existente renovada, nuevas pestañas Comandas/Cocina visibles, los productos disponibles en captura y estados vacíos correctos. Captura `../tavixo-sprint4-produccion.jpg`.
- No hay mesas reales registradas; es necesario configurarlas en Mesas antes de tomar la primera comanda. No se inventaron mesas ni pedidos en producción.
