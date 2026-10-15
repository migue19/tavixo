# Sprint 12 — Reportes de ventas y productos más vendidos

## Alcance

- Consulta privada por sucursal y período inclusive de 1 a 366 días, horario de México.
- Ventas cobradas, cantidad de cuentas, ticket promedio, efectivo, tarjeta y pagos mixtos.
- Ventas diarias con días sin cobros en cero.
- Ranking de 50 productos por unidades netas y ventas, usando precios/nombres históricos y descontando cancelaciones.
- Totales completos, incluso cuando se limita el ranking; aviso de diferencias entre cobros y detalle histórico.
- Permisos de propietario/gerente y cajero asignado, aislamiento de restaurantes y respuestas sin caché.
- Lectura consistente de PostgreSQL; no requiere migración. No modifica dependencias, puertos, certificados ni firewall.

## Validación

- `npm run verify:local`: aprobado; migraciones históricas, seed repetible, tipos, pruebas, compilación y ejecución local en 127.0.0.1:6000/6001.
- 61 pruebas aprobadas (1 de contraseña y 60 de integración). Cinco pruebas nuevas cubren ventas mixtas/cancelaciones, medianoche de México, aislamiento de roles/sucursal/restaurante, fechas inválidas/períodos vacíos y ranking limitado con totales completos.
- Demo local revisada: venta de $58, una cuenta, dos tacos, cuenta abierta excluida, días sin ventas y cambio de fecha con resultados actualizados. Captura: `../tavixo-sprint12-reportes.png`.
- Se corrigió la comparación de fechas SQL para no depender del huso horario de la sesión PostgreSQL, y la suma decimal de importes del ranking. El generador de IP de las pruebas ahora mantiene direcciones válidas cuando supera 255 inicios de sesión.
- Sin Docker local disponible; ejecución Docker/Nginx de producción pendiente del despliegue autorizado.

## Producción

Desplegado con autorización del usuario el 14 de octubre de 2026 (horario de México), código `9aa7691`.

- Respaldo privado validado: `/opt/tavixo/backups/pre-sprint12-20261015T004356Z`, con dump, código, entorno e imágenes de reversión `tavixo-api:pre-sprint12` y `tavixo-web:pre-sprint12`.
- Compilación Docker con Node 24 y comprobaciones de salud de API/web aprobadas; no se ejecutaron migraciones.
- 60 verificaciones por HTTPS aprobadas, incluyendo reportes diarios/mensuales, conciliación con caja, ranking, tickets/PDF, autenticación y validación de fechas. No se crearon cuentas, pagos ni movimientos de prueba en producción.
- Revisión visual: $319 cobrados, 2 cuentas, ticket promedio $159.50, efectivo $120, tarjeta $199 y 6 unidades. Ranking: Quesabirria individual 2/$110, Taco chico 2/$58, Consomé con carne — Medio litro 1/$120 y Refresco 600 ml 1/$31.
- Se compararon todos los registros actuales de catálogo, mesas, sucursales, membresías, cuentas, rondas, eventos, pagos, cancelaciones, cortes, turnos y movimientos: sin cambios.
- PostgreSQL y los demás contenedores conservaron sus identificadores/fechas de arranque. Configuración Nginx sin cambios. Puertos, TLS, firewall y dependencias de seguridad permanecen pendientes de Avi.
- Evidencia visual: `../tavixo-sprint12-produccion.png`.
- Las sesiones SSH y pestañas temporales de revisión se cerraron al terminar.
