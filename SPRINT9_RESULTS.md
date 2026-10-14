# Sprint 9 · Cancelación auditada de productos

Implementado y verificado localmente el 14 de octubre de 2026. Despliegue pendiente de autorización específica.

## Resultado

- Propietario/gerente cancela cantidades parciales o completas en cuentas abiertas, con motivo obligatorio.
- Auditoría append-only por API: cantidad, motivo, actor y fecha; línea original permanece con nombre, precio y cantidad inicial.
- Total ajustado con precio guardado original; tickets y cobros incluyen sólo unidades vigentes. Cancelaciones posteriores al pago/estado terminal rechazadas; sin devoluciones ni modificaciones a cortes anteriores.
- Cocina muestra unidades restantes y omite líneas canceladas completas. Ronda sin productos vigentes queda cancelada; rondas restantes conservan su estado.
- Si no queda ningún producto vigente, la cuenta se cancela, total cero y mesa libre, sin crear pago.
- Reintentos idempotentes y validación de cantidad cancelada/total esperados. Bloqueo común con cobros/rondas/estados; ningún cobro puede aceptar un total anterior si gana la cancelación.
- Datos de auditoría proyectados sin requestHash; ámbito compuesto de sucursal/restaurante/cuenta/línea y permisos revalidados al escribir.
- Vista previa invalidada al cambiar cantidades canceladas, incluso para productos gratuitos sin cambio de total.

## Verificación

- 46 pruebas aprobadas: 1 de contraseñas y 45 de integración, cero fallos.
- Cancelación parcial a precio histórico pese a cambio de menú, cantidad original intacta, motivo/actor auditados, ticket neto y cobro ajustado; reintento después del pago sin nueva cancelación.
- Cancelación completa de ronda nueva conserva la ronda anterior entregada y permite cobrar sólo lo vigente; cancelación de todos los productos libera mesa sin pago.
- Envíos repetidos simultáneos, cantidades excesivas, total/cantidad cancelada desactualizados y referencia con otro motivo rechazados.
- Mesero/cajero/cocina/sin sesión no autorizados; línea inexistente/ajena y sucursal de otro tenant rechazadas. Motivo vacío, cantidad nula/fraccionaria/cero y campos de precio inesperados rechazados.
- Carrera pago/cancelación: exactamente una operación aceptada, sin cargos desactualizados ni cancelaciones de productos pagados.
- Migración desde Sprint 8 conserva cortes guardados y rondas/pagos anteriores; líneas existentes comienzan con cero canceladas. Regresión completa de auth, catálogo, rondas, cobros, tickets y caja.

- Typecheck, compilación API/web y ejecución standalone en 127.0.0.1:6000/6001 aprobados; health/proxy/PostgreSQL/login/refresh y PWA verificados.
- Navegador local: cancelación de 1 de 3 tacos ajusta $87 a $58, con motivo/actor/fecha visibles; cuenta digital muestra dos tacos por $58. Cancelar los dos restantes deja total cero, cuenta/ronda canceladas y mesa libre, sin pago. Historial de ambas cancelaciones verificado. Captura `../tavixo-sprint9-cancelacion.jpg`. Sin operaciones de prueba en producción.

## Despliegue y reversión

Migración aditiva 20261014060000_item_cancellations; no cambia Compose, Nginx ni puertos. Requiere autorización específica, respaldo e imágenes anteriores. No borrar auditoría ni campos nuevos. Sprint 8 desconoce cantidades canceladas: tras operar esta función, evaluar cuentas afectadas antes de volver al código anterior para evitar tickets con cantidades originales y total ajustado.
