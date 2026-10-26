# Cambio de dirección de Tavixo — 26 de octubre de 2026

## Resultado

- Principal: https://tavixo.nut.com.mx/.
- Anterior: https://app.birriaelcachanilla.com.mx/ devuelve redirección permanente 308, con ruta y query intactas.
- WEB_ORIGIN actualizado únicamente a `https://tavixo.nut.com.mx`; cookies seguras y validación exacta de origen conservadas. Se requiere nuevo inicio de sesión; las instalaciones PWA anteriores deben reinstalarse desde la nueva dirección.
- No hubo compra de dominio, migración de base de datos, seed ni despliegue de código funcional. Se recreó sólo API para aplicar el origen nuevo; web, PostgreSQL y otros contenedores conservaron IDs y arranques.

## HTTPS y renovación

Certificado Let’s Encrypt para `tavixo.nut.com.mx`, válido hasta **24 de enero de 2027, 17:02:08 UTC**. Hook DNS-01 limitado a `_acme-challenge.tavixo`, estado privado independiente y credencial preexistente root-only. Emisión real y `certbot renew --cert-name tavixo.nut.com.mx --dry-run` aprobadas; temporizador existente activo. Sin apertura del puerto 80.

El certificado y hook anteriores de Birria se conservan sin cambios para permitir la redirección HTTPS. No eliminar ese DNS/certificado mientras se mantengan enlaces antiguos.

## Validación

- 14 pruebas locales del hook original y del nuevo: alcance, reintentos, rechazo de registros ajenos y propagación.
- 39 comprobaciones HTTPS previas a redirigir y 41 finales: TLS confiable, login, cookie segura, refresh, sucursal, equipo, catálogo, mesas, cuentas, reportes, Excel legible con sus tres hojas e importes conciliados; redirección de ruta y query verificadas.
- 16 productos, 4 mesas y 6 cuentas del piloto con hashes idénticos antes/después. Son los datos observados el día del cambio.
- Registros DNS de nut.com.mx idénticos salvo el nuevo TXT ACME administrado: se preservaron A/AAAA, MX, SPF, DKIM, DMARC, verificaciones y otros subdominios.
- Archivos Nginx ajenos, configuraciones de renovación previas y contenedores protegidos verificados sin cambios. El sitio principal de Birria no se modificó.
- La primera comprobación HTTPS se adelantó a la recarga gradual de Nginx y falló antes de modificar la API. Se inspeccionó el estado parcial, se confirmó un único bloque por dominio y TLS correcto; se aplicó después exclusivamente el cambio pendiente de origen. No se repitió el script completo rechazado por revisión automática.

## Respaldo y reversión

Respaldo privado: `/opt/tavixo/backups/pre-domain-20261026T175934Z`. Incluye dump con índice validado, .env previo, vhost previo, inventarios de contenedores, hashes de Nginx y renovación, instantáneas DNS antes/después y logs de certificado. No se probó restauración de datos.

Imágenes anteriores etiquetadas `tavixo-api:rollback-domain-20261026` y `tavixo-web:rollback-domain-20261026`. Para revertir el acceso, restaurar únicamente el origen anterior y el vhost previo, validar Nginx, recargar gradualmente y recrear sólo API. No restaurar toda la zona DNS ni toda la configuración compartida. La base de datos no requiere reversión.
