# Sprint 11 · Caja compartida por turnos

Implementado el 14 de octubre de 2026. El usuario eligió una caja compartida por sucursal. Despliegue autorizado explícitamente y completado en el VPS.

## Resultado

- Apertura con fondo inicial; un turno abierto por sucursal, índice único parcial también en DB.
- Pagos enlazados automáticamente al turno activo dentro del bloqueo/ transacción común. Sin turno abierto, cobro conserva operación existente y queda sólo en resumen diario; no hay asociación retroactiva.
- Ventas por identidad de turno, con soporte de medianoche y pago mixto sin doble conteo; parte neta en efectivo, tarjeta y número de cuentas.
- Retiro/gasto con importe positivo, motivo, actor y fecha. No supera el efectivo esperado disponible; no modifica pagos ni cortes diarios. Sin edición/borrado de movimientos.
- Cierre con conteo, fecha/responsable/notas y snapshot inmutable por API. Esperado = fondo + ventas netas efectivo − retiros − gastos; diferencia = contado − esperado.
- Revisión esperada e idempotencia en apertura/movimiento/cierre; cambio concurrente exige actualizar. Roles y alcance de sucursal/tenant revalidados en escrituras.
- Historial últimos 50 cerrados; últimos 200 movimientos por turno, sumas completas. Lecturas consistentes y proyecciones sin hashes/referencias privadas de envío.
- Índices por shiftId en pagos/movimientos y FK compuesta de sucursal/restaurante. Turnos anteriores no inventados; pagos existentes permanecen con shiftId null.

## Verificación

- 56 pruebas aprobadas: 1 de contraseñas y 55 de integración, cero fallos.
- Aperturas simultáneas/duplicadas, referencia con otro fondo y restricción única DB.
- Pago mixto enlazado, resumen de turno que cruza medianoche, retiro/gasto y cierre con faltante; reintentos sin duplicar y cierre persistente tras nueva apertura.
- Movimientos de turno cerrado, cierre repetido distinto, cantidades inválidas, sobregiro, motivo vacío y revisión desactualizada rechazados.
- Permisos de cocina/mesero/sin sesión, ámbito de cajero/sucursal/restaurante y turno ajeno rechazados.
- Carreras cierre/cobro y cierre/movimiento: relación de pago correcta según operación que gana; snapshot no agrega pagos posteriores. Pago asociado como máximo una vez.
- Cobros sin turno permanecen sin asignar al abrir uno nuevo; cierre/historial no reescribe pagos ni cortes previos.
- Migración desde Sprint 10 conserva pagos/importes/partes/hashes/cortes/rondas anteriores, sin turnos históricos inventados.

- Typecheck, compilación API/web y ejecución standalone en 127.0.0.1:6000/6001 aprobados, con health/proxy/PostgreSQL/login/refresh y PWA.
- Navegador local: apertura $200, nuevo pago mixto $55 ($30 efectivo/$25 tarjeta), gasto $20 y retiro $50; esperado $160. Cierre con contado $155 guarda faltante $5, motivo/actor/fecha de movimientos y snapshot. Salida del módulo y recuperación del cierre verificadas. Pago histórico de $58 fuera del turno. Captura `../tavixo-sprint11-turnos.jpg`. Sin operaciones de prueba en producción.

## Despliegue y reversión

Migración aditiva 20261014080000_cash_shifts. Requiere autorización específica, respaldo e imágenes anteriores. Sin cambios a Compose/Nginx/puertos. No borrar turnos, movimientos ni relaciones al revertir. Evitar volver a una versión anterior con turno activo: esa versión no enlaza nuevos pagos ni muestra sus movimientos.

## Producción verificada

- Aplicación 30563dc desplegada con Node 24 en https://app.birriaelcachanilla.com.mx.
- Respaldo privado `/opt/tavixo/backups/pre-sprint11-20261014T220520Z`: dump validado, fuente/entorno y snapshot previo. Imágenes de reversión `tavixo-api:pre-sprint11` / `tavixo-web:pre-sprint11` conservadas; no se requirió reversión.
- Migración 20261014080000_cash_shifts aplicada. Ningún turno/movimiento histórico inventado; todos los pagos anteriores con shiftId null.
- Comparación exacta antes/después excluyendo sólo shiftId: productos/categorías, mesas, sucursales, membresías, cuentas, líneas, rondas, eventos, pagos/partes, cancelaciones y cortes diarios intactos.
- Sólo API/web recreadas y saludables. PostgreSQL y otros contenedores conservaron IDs/tiempos de arranque; hashes Nginx sin cambios. Puertos 6000/6001 ligados a 127.0.0.1; base privada.
- 48 comprobaciones públicas HTTPS aprobadas: auth/PWA, catálogo/mesas/rondas/cancelaciones, tickets/PDF, caja, partes mixtas, lista de turnos, pagos históricos sin turno, permisos y rechazo de apertura inválida sin escritura.
- Navegador público: sesión restaurada y módulo Turnos de caja disponible con apertura por sucursal y sin turno activo/histórico. Captura `../tavixo-sprint11-produccion.jpg`.
- No se abrieron turnos ni se registraron movimientos, cobros, pedidos, cancelaciones o cortes de prueba en producción. Flujo completo de turno/movimientos/cierre probado en demo local aislada.
