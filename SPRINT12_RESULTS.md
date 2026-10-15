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

No desplegado. Requiere autorización específica antes de actualizar el VPS.
