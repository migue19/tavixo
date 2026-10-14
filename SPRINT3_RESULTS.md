# Sprint 3 · Menú y mesas

Verificación local con PostgreSQL 17.9 real el 13 de octubre de 2026 (America/Mexico_City):

- **17 pruebas aprobadas:** 1 de contraseñas y 16 de integración; cero fallos.
- Regresión de autenticación, roles, sucursales, equipo y cambio de contraseña.
- Catálogo: categorías, productos, precio entero en centavos, edición y disponibilidad.
- Rechazo de precios negativos, decimales en centavos, cadenas, null y fuera de rango, también por CHECK en PostgreSQL.
- Restricciones compuestas impiden vincular productos a categorías de otra sucursal, incluso del mismo restaurante; prueba directa de DB incluida.
- Aislamiento entre restaurantes y sucursales; operativo restringido a su sucursal y sin permiso de edición.
- Categorías/productos inactivos ocultos a operativos; agotados visibles como no disponibles. Administrador conserva consulta completa.
- Mesas: altas, edición, desactivación/reactivación, duplicados, límites de capacidad e imposibilidad de editar desde otra sucursal.
- Escrituras rechazadas en sucursales inactivas.
- Typecheck y build de API/web aprobados; ejecución standalone, proxy, PWA y login/refresh del piloto correctos.
- Migración desde esquema del Sprint 1 preserva hashes, roles y sesiones; migraciones/seed repetibles.

La migración del Sprint 3 es aditiva: sólo agrega tablas/índices/constraints de catálogo. No agrega platos, precios ni mesas de prueba a producción. Despliegue autorizado explícitamente y completado en el VPS:

- Código: `a35a6e42a0030d504d8782af4e57a95fdb713e13`.
- Respaldo previo privado de DB/entorno/código: `/opt/tavixo/backups/pre-sprint3-20261014T005353Z`.
- Imágenes del Sprint 2 conservadas como `tavixo-api:pre-sprint3` y `tavixo-web:pre-sprint3`; override de reversión preparado en el respaldo. No fue necesario revertir.
- Construcción en Ubuntu 24.04 / Node 24; migración `20261013020000_catalog` aplicada; API/web/DB saludables.
- Verificados login del piloto, membresía OWNER y sucursales existentes, selector de restaurantes y los tres endpoints de catálogo.
- 13 comprobaciones públicas HTTPS correctas: página/assets PWA, health, login, cookie segura, restaurante, refresh, logout y revocación de acceso.
- Revisión en navegador de Menú y Mesas: sucursal activa seleccionada, campos y estados vacíos correctos, productos bloqueados hasta tener categoría.
- No se crearon precios, productos, categorías ni mesas ficticios en producción. CRUD y validación se probaron en PostgreSQL temporal.
- 16 contenedores anteriores mantienen IDs y tiempos de arranque; configuración Nginx previa intacta y `nginx -t` aprobado.

 Comandas, ocupación, cobros, fotos de productos, inventario y personalización de platillos quedan para sprints posteriores.
