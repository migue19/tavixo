# Personalización de Birria El Cachanilla — producción

Publicado el 15 de octubre de 2026, con autorización explícita del propietario.

- Código desplegado: `df96271485a92aa3bf3f4b3dac25b5183852ee57`.
- Encabezado, navegación, gráficas y tickets digitales/PDF con logo original y colores del restaurante; configuración por slug. Acceso sin sesión genérico Tavixo.
- Sin migraciones ni seed en producción. Sólo API/web recreadas; ambas saludables.
- Respaldo privado: `/opt/tavixo/backups/pre-branding-20261015T192251Z` (dump, índice validado con pg_restore, código previo, configuración privada e inventario de contenedores). No se realizó una restauración.
- Imágenes anteriores conservadas: `tavixo-api:rollback-20261015T192251Z` y `tavixo-web:rollback-20261015T192251Z`.
- 63 pruebas locales aprobadas, compilación y verificación integral con PostgreSQL temporal.
- 34 comprobaciones HTTPS aprobadas: sesión y cookie segura, marca del tenant, logo JPEG, ticket JSON y PDF con imagen embebida, acceso a equipo, conciliación de reportes y assets web.
- Catálogo, mesas y cuentas con hashes idénticos antes/después: 16 productos, 4 mesas, 4 cuentas.
- PostgreSQL y los demás contenedores conservan IDs y tiempos de arranque. Hashes de los archivos Nginx idénticos. Sin cambios a puertos, firewall, certificados ni renovación.
- Vista autenticada de producción revisada en navegador: logo cargado y tema activo.

La edición de marca desde pantalla y la personalización del acceso sin sesión quedan fuera de esta versión. Para agregar otra identidad consultar `docs/PERSONALIZACION.md`.
