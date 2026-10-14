# Despliegue inicial de Tavixo

Fecha: 2026-10-13 18:05 (America/Mexico_City).

Estado: servicios desplegados y verificados en el VPS; HTTPS público pendiente de conectividad al puerto 80 para emitir el certificado.

## Instalación

- Directorio: `/opt/tavixo`.
- Código de aplicación: `a60431c4e08a43171079b703793a1a97ddb23059`.
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

## HTTPS pendiente

Dominio: `app.birriaelcachanilla.com.mx`. DNS A confirmado en resolutores públicos. Puerto 443 accesible externamente; puerto 80 devuelve timeout. UFW inactivo y política INPUT local ACCEPT. Let’s Encrypt HTTP-01 falló por timeout al conectar al puerto 80; revisar firewall o filtrado de red del proveedor. No abrir los puertos 6000/6001 ni PostgreSQL.

El vhost nuevo `/etc/nginx/sites-available/tavixo` está enlazado, validado con `nginx -t` y en mantenimiento HTTP 503. Los sitios previos no fueron editados. El vhost HTTPS final está preparado en `/opt/tavixo/tavixo-https.conf` y no se habilita hasta tener el certificado.

Cuando TCP 80 esté accesible, ejecutar en el VPS:

```sh
certbot certonly --webroot --webroot-path /opt/tavixo/acme --domain app.birriaelcachanilla.com.mx --non-interactive --deploy-hook 'nginx -t && systemctl reload nginx'
install -m 644 /opt/tavixo/tavixo-https.conf /etc/nginx/sites-available/tavixo
nginx -t
# Sólo tras un test exitoso:
systemctl reload nginx
curl --fail https://app.birriaelcachanilla.com.mx/api/health
```

Ya existe el timer de renovación `snap.certbot.renew.timer`. El certificado nuevo deberá guardar su webroot y deploy hook para renovar y recargar Nginx; falta comprobar esa renovación después de emitirlo.

No se puede considerar completo el acceso público hasta emitir el certificado y probar login/refresh/logout sobre HTTPS desde fuera del VPS.
