# Despliegue inicial de Tavixo

Fecha: 2026-10-13 18:05 (America/Mexico_City).

Estado: despliegue completo; acceso público HTTPS verificado en https://app.birriaelcachanilla.com.mx.

## Instalación

- Directorio: `/opt/tavixo`.
- Código de aplicación actual: `a35a6e42a0030d504d8782af4e57a95fdb713e13` (Sprint 3).
- Docker Compose con proyecto independiente `tavixo`.
- API: `127.0.0.1:6000`; web: `127.0.0.1:6001`.
- PostgreSQL 17.9 privado, sin puertos host publicados.
- Contenedores `tavixo-api-1`, `tavixo-web-1`, `tavixo-db-1`: saludables.
- Configuración production, secretos aleatorios y cookie Secure/HttpOnly/SameSite=Strict.
- Migración inicial y seed de Birria El Cachanilla aplicados.
- Credenciales en `.env` y `admin-access.txt` con permisos 600; no están en Git.
- Respaldo inicial privado: `/opt/tavixo/backups/initial-pilot.dump`. No se probó restauración.

## Verificación ejecutada

Las imágenes se construyeron con Node 24 en Ubuntu 24.04. Prueba de contraseñas aprobada dentro del contenedor. Pasaron 18 comprobaciones de ejecución: health directo y vía proxy, HTML y assets PWA, rechazo sin autenticación, login OWNER, atributos de cookie, consulta de restaurante/equipo, rotación de refresh y revocación al cerrar sesión. Resultado en `/opt/tavixo/smoke-results.txt`.

Los 16 contenedores anteriores conservan sus IDs, tiempos de arranque y estado activo. Todos sus archivos Nginx anteriores conservan sus hashes. Cuatro sitios UI existentes mantienen HTTP 200. `scada_backend` ya estaba no saludable antes de este trabajo y no se modificó.

## HTTPS público

URL: https://app.birriaelcachanilla.com.mx. DNS A configurado y firewall del proveedor sincronizado para TCP 80. El dominio principal continúa en su hosting anterior.

Certificado Let’s Encrypt válido hasta el 11 de enero de 2027. Vhost propio habilitado y validado con `nginx -t`; HTTP redirige a HTTPS con 301. La ruta webroot ACME responde públicamente. `/opt/tavixo` permite atravesar el directorio (751) para leer los challenges; `.env` y `admin-access.txt` conservan permisos 600.

Pasaron **13 comprobaciones desde fuera del VPS** con validación TLS activada: página principal, health, manifiesto, service worker, offline e iconos; login del piloto, cookie segura, consulta autenticada del restaurante, refresh, logout y rechazo del JWT revocado. También se probó `/api/health` con resolución DNS normal.

Renovación por webroot en el timer existente `snap.certbot.renew.timer`, con deploy hook `nginx -t && systemctl reload nginx`. El vhost HTTPS final conserva la ruta de challenge para renovaciones. La simulación `certbot renew --cert-name app.birriaelcachanilla.com.mx --dry-run --no-random-sleep-on-renew` terminó correctamente.

Las credenciales de administrador se entregan por archivo privado al propietario, separado de Git. No se registraron contraseñas ni tokens en los resultados de las pruebas. La instalación de la PWA en un navegador y pruebas de carga quedan fuera de esta verificación.

## Actualización al Sprint 2

Restaurantes, sucursales, equipo, roles y cambio de contraseña propia disponibles. Migración y despliegue verificados con respaldo previo, imágenes de reversión y conservación de los servicios existentes. Ver [SPRINT2_RESULTS.md](SPRINT2_RESULTS.md) para resultados y límites. El proceso de actualización reinició únicamente API/web de Tavixo y conservó PostgreSQL/volumen y configuración Nginx.

## Actualización al Sprint 3

Menú, categorías, productos/precios/disponibilidad y mesas por sucursal disponibles. Actualización con aprobación explícita, migración aditiva, respaldo e imágenes de reversión; los servicios existentes se conservaron. Ver [SPRINT3_RESULTS.md](SPRINT3_RESULTS.md). Sólo API/web de Tavixo se reiniciaron; no se modificaron los datos del equipo, sucursales o precios reales del piloto.
