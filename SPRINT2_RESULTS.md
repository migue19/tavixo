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

La prueba local crea y elimina sólo un PostgreSQL temporal; no apunta al VPS. El resultado de la actualización del servidor y revisión del panel se añadirá al finalizar el despliegue.
