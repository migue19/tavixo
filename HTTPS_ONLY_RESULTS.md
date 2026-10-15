# Tavixo: bloque Nginx exclusivamente HTTPS — 15 de octubre de 2026

## Cambio aplicado

Se retiró únicamente el primer bloque `server` de `/etc/nginx/sites-available/tavixo`, que escuchaba en 80 tanto IPv4 como IPv6. Con él se retiraron la redirección HTTP 301 y la ruta antigua `/.well-known/acme-challenge/` con webroot `/opt/tavixo/acme`.

El bloque HTTPS existente quedó idéntico, byte por byte: puerto 443, certificado, TLS 1.2/1.3 y proxies a 127.0.0.1:6000/6001. La plantilla del repositorio se actualizó al mismo modelo HTTPS, con certificado preaprovisionado por DNS-01.

## Verificación

- Renovación existente confirmada como manual/DNS-01 con hook automático y temporizador activo. Su archivo de configuración no se modificó.
- `nginx -t` aprobado y recarga gradual de Nginx aplicada correctamente.
- Hashes de todos los demás archivos Nginx sin cambios.
- Todos los contenedores conservaron sus IDs y fechas de arranque; no se reiniciaron API, web, PostgreSQL ni servicios ajenos.
- Portada y `/api/health`: HTTP 200 por HTTPS con TLS confiable y certificado válido hasta el 13 de enero de 2027.
- Puerto 80 comprobado desde Internet: filtrado/bloqueado.
- No se modificó el firewall ni se eliminaron listeners de otros sitios compartidos. No se borraron datos ni se ejecutaron migraciones.

## Respaldo

Configuración anterior privada: `/opt/tavixo/backups/pre-https-only-20261015T151206Z/tavixo.conf`. Si fuera necesario revertir, restaurar sólo ese archivo como `/etc/nginx/sites-available/tavixo`, validar con `nginx -t` y recargar Nginx; no reemplazar toda su configuración compartida.

La sesión SSH de mantenimiento se cerró al finalizar.
