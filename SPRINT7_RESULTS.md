# Sprint 7 · Productos en cuentas abiertas

Implementado y verificado localmente el 14 de octubre de 2026. Despliegue pendiente de autorización específica.

## Resultado

- Segunda y siguientes rondas en una cuenta abierta, con mesa y total acumulado.
- Productos, precios e indicaciones separados por ronda; preparación/listo/entrega independientes. Cocina omite rondas entregadas.
- Precio y nombre guardados al enviar cada ronda; tickets agregan todas las líneas.
- Cobro permitido sólo cuando todas las rondas estén entregadas; cuentas terminales rechazan nuevos productos.
- Reintentos idempotentes, total esperado y bloqueo transaccional común con pagos/estados; sólo una escritura puede ganar una carrera de cobro contra nueva ronda.
- Permisos de rol y ámbito de sucursal/restaurante preservados. Productos agotados/inactivos/ajenos y líneas duplicadas dentro de la misma ronda rechazados.
- Cuenta limitada a 100 líneas y cantidades 1–100, con validación de desbordamiento de total. La cancelación sigue siendo de cuenta completa con motivo.

## Verificación

- 35 pruebas aprobadas: 1 de contraseñas y 34 de integración, cero fallos.
- Nuevas pruebas de precios históricos contra precio nuevo, ronda independiente, cobro bloqueado hasta entrega, ticket acumulado y reintento después de pago.
- Envíos duplicados y simultáneos, total desactualizado y reutilización de referencia rechazados correctamente.
- Productos ajenos/agotados, duplicados, Cocina agregando pedidos, cuentas cerradas, estados fuera de secuencia y rondas de otra cuenta rechazados.
- Carrera de pago contra nueva ronda: exactamente una operación aceptada, sin productos ni importes perdidos.
- Migración desde esquema Sprint 6 con cuentas entregadas/cerradas y pago existente: precios, cantidades, credenciales, roles, sesiones, totales y pagos preservados; primeras rondas creadas y líneas enlazadas.
- Typecheck, compilación API/web, seed repetible y ejecución standalone en 127.0.0.1:6000/6001 aprobados. Health, PostgreSQL, proxy web, login/refresh y archivos PWA verificados.

- Navegador local: cuenta original de $55, nueva ronda de dos tacos por $58, total $113. Cocina muestra sólo la segunda ronda; preparación/listo/entrega verificados. Cobro ficticio con $150, cambio $37 y mesa liberada. Captura de evidencia `../tavixo-sprint7-rondas.jpg`.

## Despliegue y reversión

Migración aditiva: OrderRound y OrderItem.roundId. PostgreSQL continúa privado; no cambia Compose, puertos ni Nginx. Antes de desplegar, respaldar datos y conservar imágenes anteriores. Comparar el contenido anterior de OrderItem excluyendo la nueva columna roundId y comprobar las rondas creadas.

No revertir la migración ni borrar rondas. Una aplicación Sprint 6 no conoce los estados individuales de cuentas con varias rondas; después de operar Sprint 7, evaluar esas cuentas antes de volver al código anterior. El enlace nullable permite escrituras antiguas y Sprint 7 las agrupa en la primera ronda al reanudarse. Sin pedidos/pagos de prueba en producción.
