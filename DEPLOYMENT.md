# Despliegue de Tavixo e historial de actualizaciones

Despliegue inicial: 2026-10-13 18:05 (America/Mexico_City). Estado HTTPS actualizado el 15 de octubre de 2026.

Estado: acceso principal en https://tavixo.nut.com.mx desde el 26 de octubre de 2026. El enlace HTTPS anterior de Birria redirige permanentemente.

## Instalación

- Directorio: `/opt/tavixo`.
- Código de aplicación actual: `291ffd7` (Sprint 12, parche de seguridad, navegación/reportes visuales e identidad del restaurante). Ver [SECURITY_PATCH_RESULTS.md](SECURITY_PATCH_RESULTS.md).
- Docker Compose con proyecto independiente `tavixo`.
- API: `127.0.0.1:6000`; web: `127.0.0.1:6001`.
- PostgreSQL 17.9 privado, sin puertos host publicados.
- Contenedores `tavixo-api-1`, `tavixo-web-1`, `tavixo-db-1`: saludables.
- Configuración production, secretos aleatorios y cookie Secure/HttpOnly/SameSite=Strict.
- Migración inicial y seed de Birria El Cachanilla aplicados.
- Credenciales en `.env` y `admin-access.txt` con permisos 600; no están en Git.
- Respaldo inicial privado: `/opt/tavixo/backups/initial-pilot.dump`. No se probó restauración.

## Verificación inicial ejecutada

Las imágenes se construyeron con Node 24 en Ubuntu 24.04. Prueba de contraseñas aprobada dentro del contenedor. Pasaron 18 comprobaciones de ejecución: health directo y vía proxy, HTML y assets PWA, rechazo sin autenticación, login OWNER, atributos de cookie, consulta de restaurante/equipo, rotación de refresh y revocación al cerrar sesión. Resultado en `/opt/tavixo/smoke-results.txt`.

Los 16 contenedores anteriores conservan sus IDs, tiempos de arranque y estado activo. Todos sus archivos Nginx anteriores conservan sus hashes. Cuatro sitios UI existentes mantienen HTTP 200. `scada_backend` ya estaba no saludable antes de este trabajo y no se modificó.

## HTTPS público

URL: https://app.birriaelcachanilla.com.mx. El grupo de firewall inicial «OFF» fue activado por el propietario, dejando accesibles TCP 22 y 443 y bloqueando el 80. El dominio principal continúa en su hosting anterior.

Certificado Let’s Encrypt renovado y válido hasta el **13 de enero de 2027**. Renovación automática **DNS-01** mediante Hostinger, con el temporizador existente `snap.certbot.renew.timer` y recarga gradual de Nginx. La clave DNS está fuera de Git/Docker y sólo es accesible para root. Ver [infra/tls/RESULTS.md](infra/tls/RESULTS.md).

El bloque de Tavixo escucha únicamente **443** (IPv4 e IPv6). El 15 de octubre de 2026 se retiraron su bloque HTTP, la redirección 301 y la ruta webroot ACME. El bloque HTTPS se conservó idéntico. Otros sitios del Nginx compartido pueden mantener sus propios listeners HTTP; no se alteraron sus configuraciones.

Verificaciones posteriores a la limpieza: `nginx -t` aprobado; recarga sin reinicios de contenedores; portada y `/api/health` responden HTTP 200 con TLS confiable; puerto 80 bloqueado desde Internet. Configuraciones de otros sitios y renovación DNS de Tavixo sin cambios. Respaldo y detalle en [HTTPS_ONLY_RESULTS.md](HTTPS_ONLY_RESULTS.md).

Las credenciales de administrador se entregan por archivo privado al propietario, separado de Git. No se registraron contraseñas ni tokens en los resultados de las pruebas. La instalación de la PWA en un navegador y pruebas de carga quedan fuera de esta verificación.

## Actualización al Sprint 2

Restaurantes, sucursales, equipo, roles y cambio de contraseña propia disponibles. Migración y despliegue verificados con respaldo previo, imágenes de reversión y conservación de los servicios existentes. Ver [SPRINT2_RESULTS.md](SPRINT2_RESULTS.md) para resultados y límites. El proceso de actualización reinició únicamente API/web de Tavixo y conservó PostgreSQL/volumen y configuración Nginx.

## Actualización al Sprint 3

Menú, categorías, productos/precios/disponibilidad y mesas por sucursal disponibles. Actualización con aprobación explícita, migración aditiva, respaldo e imágenes de reversión; los servicios existentes se conservaron. Ver [SPRINT3_RESULTS.md](SPRINT3_RESULTS.md). Sólo API/web de Tavixo se reiniciaron; no se modificaron los datos del equipo, sucursales o precios reales del piloto.


## Actualización al Sprint 4

Comandas por mesa, ocupación, cocina, entrega/cierre y cancelación con motivo e historial disponibles. Despliegue aprobado explícitamente con respaldo validado e imágenes de reversión. Sólo API/web se recrearon; PostgreSQL, contenedores previos y Nginx no cambiaron. Conservados todos los productos/precios, categorías, mesas, sucursales y membresías existentes. Pasaron 19 comprobaciones públicas HTTPS y revisión de las pantallas Comandas/Cocina. Ver [SPRINT4_RESULTS.md](SPRINT4_RESULTS.md). Las mesas reales aún deben registrarse; los pagos quedan para el próximo sprint.


## Actualización al Sprint 5

Cobros en efectivo con cálculo de cambio y registro de pagos aprobados en terminal externa, con folio. El pago cierra la cuenta y libera la mesa en una transacción; el cierre directo anterior se rechaza. Despliegue aprobado, respaldo validado e imágenes de reversión; sólo API/web recreadas. Conservados productos, categorías, cuatro mesas reales, membresías, cuenta previa y su historial; no se inventaron pagos para cuentas anteriores. Pasaron 22 comprobaciones públicas HTTPS. PostgreSQL, otros contenedores y Nginx sin cambios. Ver [SPRINT5_RESULTS.md](SPRINT5_RESULTS.md).


## Actualización al Sprint 6

Tickets digitales de cuenta y comprobante de pago con vista previa y descarga PDF autenticada. Despliegue aprobado con respaldo validado e imágenes de reversión; sólo API/web recreadas. Sin migraciones, datos de catálogo/cuentas/pagos idénticos antes/después, PostgreSQL/otros contenedores y Nginx sin cambios. Pasaron 27 comprobaciones públicas HTTPS y la descarga desde el navegador; total, acentos y condición histórica revisados en el PDF. Ver [SPRINT6_RESULTS.md](SPRINT6_RESULTS.md). Impresión física y envíos automáticos quedan fuera del alcance solicitado.

## Identidad del restaurante

Personalización publicada con autorización; logo, paleta de marca y tickets PDF verificados. 34 comprobaciones HTTPS aprobadas, sin migraciones ni cambios de datos o servicios compartidos. Ver [BRANDING_RESULTS.md](BRANDING_RESULTS.md).

## Descarga de reportes Excel

Exportación XLSX publicada con autorización, respaldo previo y actualización exclusiva de API/web. 38 comprobaciones HTTPS y descarga real desde navegador aprobadas. Sin migraciones ni cambios de datos. Ver [EXCEL_REPORTS_RESULTS.md](EXCEL_REPORTS_RESULTS.md).

## Cambio de dirección — 26 de octubre de 2026

Acceso principal `https://tavixo.nut.com.mx`; redirección 308 del dominio anterior conservando ruta y parámetros. Nuevo certificado DNS-01 con renovación simulada correctamente. Sólo API recreada para cambiar WEB_ORIGIN; web, PostgreSQL y servicios ajenos sin reinicios. 41 comprobaciones HTTPS aprobadas. Ver [DOMAIN_CHANGE_RESULTS.md](DOMAIN_CHANGE_RESULTS.md).
