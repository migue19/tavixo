# Sprint 8 · Corte de caja y resumen de ventas

Implementado el 14 de octubre de 2026. El usuario eligió fondo inicial, efectivo contado y diferencias. Despliegue pendiente de autorización específica.

## Resultado

- Módulo Caja y ventas por sucursal y día de cobro en America/Mexico_City.
- Totales de ventas cobradas, efectivo, tarjeta y cantidad de cuentas; detalle de pagos con cuenta/mesa, hora, método, importe, responsable y folio de terminal.
- Conciliación: esperado = fondo inicial + venta neta en efectivo; contado − esperado determina faltante/sobrante.
- Cortes guardados con responsable, fecha, notas y fotografía de importes/detalle; consulta posterior conserva valores aun si cambia el resumen actual.
- Cortes acumulados desde medianoche, sin bloquear nuevos cobros. Sin turnos, movimientos de caja, propinas, devoluciones o exportación en este sprint.
- Totales completos; detalle limitado a últimos 200 pagos y listado a últimos 50 cortes del día, con avisos en UI.
- Validación de fecha real no futura, centavos enteros no negativos, límites de importes, aislamiento por rol/tenant/sucursal y revalidación de membresía al escribir.
- Resumen leído consistentemente; guardado bajo el bloqueo de restaurante que comparten cobros/rondas. Total/cantidad esperados detectan resumen desactualizado. Reintentos idénticos retornan el corte previo sin duplicarlo.

## Verificación

- 41 pruebas aprobadas: 1 de contraseñas y 40 de integración; cero fallos.
- Límites de medianoche de México, día de pago frente a día de apertura, efectivo bruto/cambio/neto, tarjeta y exclusión de cuenta histórica sin pago.
- Guardado concurrente duplicado, snapshot inmutable, conflicto por pagos posteriores, UUID reutilizado con otros datos, sobrante/faltante/diferencia cero y día sin ventas.
- Permisos de mesero/cocina/cajero, ámbito de sucursal/restaurante y revocación de rol con JWT anterior.
- Fechas imposibles/futuras, cantidades negativas/fraccionarias/nulas/excesivas y campos inesperados rechazados. Guardar corte no altera los pagos existentes.
- Más de 200 pagos: total y cantidad completos, detalle limitado correctamente.
- Migración desde Sprint 7 conserva todas las rondas y pagos existentes; no inventa cortes. Regresión de esquema anterior, credenciales, mesas, productos, cuentas y precios aprobada.

- Typecheck y compilación de API/web aprobados, con ejecución standalone en 127.0.0.1:6000/6001, health/proxy/PostgreSQL/login/refresh y archivos PWA verificados.
- Demo local en navegador: $113 cobrados ($58 efectivo / $55 tarjeta); fondo $200, esperado $258 y conteo $250 producen faltante $8. Guardado, salida del módulo y recuperación del corte verificados. Captura `../tavixo-sprint8-caja.jpg`. No se crearon cortes/pedidos/pagos de prueba en producción.

## Despliegue

Requiere autorización específica, respaldo previo e imágenes de reversión. Migración aditiva 20261014050000_cash_cuts. No cambios a Compose, puertos o Nginx; sólo actualización de API/web y herramienta de migración. No borrar CashCut al revertir: conservar los cortes guardados. Sprint 7 puede continuar con el esquema ampliado aunque no muestre Caja y ventas.
