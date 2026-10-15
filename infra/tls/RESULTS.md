# Renovación DNS de Tavixo — 15 de octubre de 2026

## Resultado

Certificado de producción renovado correctamente para `app.birriaelcachanilla.com.mx`. Nueva caducidad: **13 de enero de 2027**, a las 07:44:23 en `America/Mexico_City`.

- `certbot reconfigure` aprobó la simulación de renovación por DNS y guardó el hook de autenticación junto con el despliegue mediante recarga de Nginx.
- `certbot renew --cert-name app.birriaelcachanilla.com.mx --force-renewal --non-interactive --no-random-sleep-on-renew` emitió el certificado real. La primera invocación fue detenida durante la espera aleatoria, antes de emitir, y se repitió sin esa espera.
- Temporizador `snap.certbot.renew.timer` habilitado y activo. Próxima comprobación observada: 15 de octubre de 2026, 12:12 en horario de México; esa comprobación no implica renovar si aún no corresponde.
- Autenticación guardada: `manual` con `pref_challs = dns-01` y `manual_auth_hook` automático; no requiere intervención humana ni el puerto 80 en las renovaciones.
- La credencial fue entregada mediante archivo privado, verificada e instalada sólo para root en `/etc/tavixo-acme/hostinger-token` (0600), fuera de Git y Docker. La copia temporal local fue eliminada. Su custodia y alcance fueron autorizados expresamente; debe mantenerse vigente para que continúen las renovaciones.
- Sólo se añadió el TXT administrado `_acme-challenge.app` (TTL 300). El último valor público permanece entre renovaciones y será reemplazado por el siguiente; se rechazan valores ajenos.

## Verificación

- 7 pruebas locales aprobadas: validación previa, alcance del TXT, rechazo de registros ajenos, renovación y reintento con respuesta incierta, restricciones de dominio, propagación y bloqueo de redirecciones HTTP para proteger la credencial.
- 35 comprobaciones en servidor/HTTPS aprobadas: permisos, temporizador, autenticador, estado DNS, configuración Nginx, configuraciones de otros certificados y contenedores sin reinicios.
- La portada y `/api/health` responden HTTP 200 mediante HTTPS confiable y presentan la misma huella SHA-256 que el certificado nuevo instalado.
- No se reiniciaron API, web, PostgreSQL ni contenedores de otros sistemas. Se recargó Nginx de forma gradual para servir el certificado nuevo.
- No se modificaron los bloques Nginx, el firewall, los puertos ni dependencias de la aplicación. El cierre del puerto 80 compartido requiere coordinar los demás certificados/servicios del VPS.

## Respaldo

`/opt/tavixo/backups/pre-dns-renewal-20261015T143707Z` contiene la configuración anterior del certificado, sus archivos, el bloque Nginx y los estados de verificación. Permisos privados en el VPS; no se descargaron claves privadas del certificado.

Huella SHA-256 servida:

`C2:09:ED:C2:C8:50:70:33:F4:8B:37:DA:3A:D1:6A:75:41:BA:C3:1B:98:0C:3D:47:CD:6D:A9:76:2D:BA:04:2D`

La conexión SSH de mantenimiento se cerró al finalizar.
