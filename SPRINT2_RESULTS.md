# Sprint 2 · Restaurantes, sucursales y equipo

Verificación local completada el 13 de octubre de 2026 (America/Mexico_City), con PostgreSQL 17.9 real.

- **14 pruebas aprobadas:** 1 de contraseñas y 13 de integración; cero fallos.
- Migración desde esquema del Sprint 1 con datos, roles, hash de contraseña y sesión preexistentes: conservados y asignados a Sucursal Principal.
- Restricción de sucursales de otro restaurante probada tanto en API como directamente en PostgreSQL.
- Probados los permisos OWNER/MANAGER/operativos, la prohibición de elevar rol y editar propietario o propios permisos.
- Probados altas, duplicados sin sobreescritura de cuentas globales, desactivación/reactivación y revocación de sesiones.
- Rechazados branchId/active null, IDs inválidos, campos extra y sucursales ajenas/inactivas.
- Probados cambio de restaurante autorizado, rechazo ajeno y revocación del contexto anterior.
- Probado cambio de contraseña con validación actual, rechazo de la anterior y revocación de varias sesiones.
- Typecheck, build API/web y ejecución standalone correctos.
- Seed/migraciones repetibles; sucursal piloto sin duplicados.
- Health, proxy web, assets PWA, login piloto y refresh correctos.

## Actualización del VPS completada

- Código desplegado: `e06de17dded0d115b9dd0705f606622737ab68d6`.
- Respaldo previo de DB, entorno y código en `/opt/tavixo/backups/pre-sprint2-20261014T003236Z`, con acceso privado.
- Imágenes anteriores conservadas como `tavixo-api:pre-sprint2` y `tavixo-web:pre-sprint2`, con override de reversión en el respaldo. No fue necesario revertir.
- Imágenes Docker construidas en Ubuntu 24.04 con Node 24; migración aplicada y los tres servicios saludables.
- 18 comprobaciones de autenticación/assets de servidor correctas; comprobación adicional de Sucursal Principal, membresía OWNER migrada y lista de restaurantes autorizados.
- 13 comprobaciones públicas por HTTPS correctas, con validación TLS: assets, login, cookie segura, restaurante, refresh, logout y JWT revocado.
- Revisión del panel en el navegador: Resumen, Sucursales, Equipo y Mi cuenta; Sucursal Principal activa y OWNER conservado. No se crearon empleados ni restaurantes ficticios en producción.
- Los 16 contenedores anteriores conservan IDs y tiempos de arranque; archivos Nginx previos intactos y `nginx -t` aprobado.
- HTTPS y configuración de puertos/red privada conservados.

Las pruebas de altas, edición, cambios de permisos y contraseña se ejecutaron en PostgreSQL temporal, no sobre cuentas reales. La revisión del navegador comprobó los datos y formularios existentes sin modificar credenciales o crear datos ficticios. No incluye pruebas de carga ni instalación de la PWA en dispositivos.
