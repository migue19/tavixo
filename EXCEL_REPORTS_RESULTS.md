# Reportes Excel — implementación y despliegue

Publicado el 15 de octubre de 2026 con autorización explícita del propietario.

- Código: `291ffd7d420c4273ef684b512080a25e3c1ef3fb`.
- Reportes de ventas → Descargar reportes → Descargar Excel. Conserva sucursal y fechas, con consulta nueva al generar el archivo.
- Hojas: Resumen, Ventas por día y Productos más vendidos. Importes numéricos en MXN, fechas reales, encabezados fijos y filtros. Todos los renglones de productos, sin límite de 50 del JSON.
- Mismos permisos por rol, tenant y sucursal que los reportes. Nombres de productos tratados como texto, sin convertirlos en fórmulas. Sin caché de archivos financieros.
- 65 pruebas locales aprobadas (3 unitarias y 62 de integración), compilación y verificación integral con PostgreSQL temporal.
- Casos de prueba: acceso anónimo, mesero/cocina rechazados, cajero de otra sucursal rechazado, otro tenant rechazado; fechas inválidas, cero ventas, 55 renglones de productos y nombres que parecen fórmulas.
- Dependencia ExcelJS 4.4.0, UUID corregido 11.1.1; auditoría de instalación sin vulnerabilidades conocidas.
- 38 comprobaciones HTTPS aprobadas; el archivo de producción se reabrió y concilió: 2 cuentas, $319.00, efectivo $120.00 y tarjeta $199.00. Se verificó también la descarga real desde el botón en el navegador.
- 16 productos, 4 mesas y 4 cuentas con hashes idénticos antes/después.
- Respaldo privado: `/opt/tavixo/backups/pre-excel-20261015T195445Z`, con dump e índice validado, código anterior, configuración privada e inventario. No se realizó restauración.
- Imágenes de reversión: `tavixo-api:rollback-20261015T195445Z` y `tavixo-web:rollback-20261015T195445Z`.
- Sólo API/web recreadas, saludables. Sin migraciones ni seed en producción. PostgreSQL y otros contenedores conservaron IDs y tiempos de arranque; hashes Nginx idénticos. Puertos, firewall y certificados sin cambios.
