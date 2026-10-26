# Tavixo: renovación DNS-01 con Hostinger

El hook `hostinger_dns_auth.py` se limita a `app.birriaelcachanilla.com.mx` y al TXT `_acme-challenge.app`. Utiliza la API oficial de Hostinger y no depende del puerto 80. Requiere Python 3 y `dig`, disponibles en el VPS actual.

## Credenciales y alcance

La credencial no se almacena en Git, Docker, variables del frontend ni registros. En el VPS se instala en `/etc/tavixo-acme/hostinger-token`, propietario root, modo 0600, dentro de un directorio 0700. Si Hostinger sólo permite tokens de cuenta completa, el token tiene ese alcance aunque este código se limite a un registro. Es necesario autorizar esa custodia, vigilar su fecha de caducidad y reemplazarlo antes de que venza.

El token compartido anteriormente en el chat no debe reutilizarse. Generar uno nuevo y entregarlo mediante el archivo privado fuera del repositorio. Tras transferirlo al VPS, eliminar la copia temporal local.

## Comportamiento

1. Comprueba dominio, formato del desafío y permisos de los archivos privados.
2. Lee el DNS y rechaza cualquier valor del TXT que no haya creado este mecanismo, así como CNAME u otros tipos en el mismo nombre.
3. Valida el cambio con la API antes de aplicar un único conjunto TXT con TTL 300. No envía una zona completa.
4. Guarda un estado privado para recuperar operaciones cuya respuesta se haya perdido y reemplaza únicamente su valor anterior.
5. Espera hasta 15 minutos a que todos los DNS autoritativos y dos resolutores públicos observen el valor nuevo. Las credenciales nunca se envían a esos resolutores.

El último TXT de validación, que es público y no contiene la clave API, queda presente entre renovaciones. Se reemplaza en la siguiente validación; así no es necesario borrar registros ni acumular desafíos. No hay hook de limpieza. No habilitar simultáneamente otro cliente ACME para este mismo nombre.

## Instalación y verificación

Respaldar primero la configuración de renovación, el certificado y el bloque Nginx en un directorio privado del VPS. Instalar el hook root-owned en `/etc/tavixo-acme/hostinger_dns_auth.py` (0700) y la credencial (0600). No instalar la credencial en el contenedor de la aplicación.

Cambiar únicamente la configuración del certificado existente mediante una prueba de staging:

```sh
certbot reconfigure --cert-name app.birriaelcachanilla.com.mx \
  --authenticator manual --preferred-challenges dns \
  --manual-auth-hook '/usr/bin/python3 /etc/tavixo-acme/hostinger_dns_auth.py' \
  --deploy-hook '/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx' \
  --run-deploy-hooks --non-interactive
```

Sólo si esa prueba finaliza correctamente, emitir la renovación real solicitada:

```sh
certbot renew --cert-name app.birriaelcachanilla.com.mx --force-renewal --non-interactive --no-random-sleep-on-renew
```

Comprobar fechas/huella del certificado servido por HTTPS, `/api/health`, modo y propietario de la credencial, configuración manual/DNS del certificado y el temporizador `snap.certbot.renew.timer`. Comparar los registros DNS restantes y los otros archivos Nginx con el estado anterior. Los contenedores no necesitan reiniciarse.

Esta configuración no cambia firewall ni elimina el bloque HTTP de Nginx. La decisión de cerrar el acceso público al 80 en un VPS compartido corresponde al administrador, tras validar que ningún otro certificado o servicio dependa de él.

Si staging falla, conservar el certificado actual y restaurar exclusivamente su configuración de renovación desde el respaldo. No restaurar toda la zona DNS ni los certificados de otras aplicaciones. No afirmar que la migración está completa sin probarla con el DNS real.

## Pruebas locales

```sh
python3 -m unittest discover -s infra/tls -p 'test_*.py' -v
```

Referencias: [desafíos de Let's Encrypt](https://letsencrypt.org/docs/challenge-types/), [Certbot reconfigure y hooks](https://eff-certbot.readthedocs.io/en/stable/using.html), [API DNS oficial de Hostinger](https://github.com/hostinger/api-python-sdk/blob/main/docs/DNSZoneApi.md).

## Estado de la configuración existente

La instalación de este mecanismo no cambia la exposición HTTP/HTTPS del VPS. Una vez validada la renovación DNS real, puede retirarse la dependencia del puerto 80 para este certificado. Otros certificados de este VPS utilizan su propia configuración y deben revisarse antes de cambiar reglas compartidas.

El **15 de octubre de 2026** se retiró el bloque HTTP de Tavixo tras verificar DNS-01. La plantilla Nginx del repositorio ahora escucha sólo 443. El firewall inicial del proveedor, activado manualmente por el propietario, bloquea el 80. Ver [resultado de la limpieza](../../HTTPS_ONLY_RESULTS.md). Los listeners HTTP de otros sitios permanecen bajo la administración de sus propietarios.

## Acceso principal en nut.com.mx

Desde el 26 de octubre de 2026, Tavixo utiliza `tavixo.nut.com.mx`. Su hook es `hostinger_dns_auth_tavixo_nut.py`, instalado como root en `/etc/tavixo-acme/`, con estado separado `state-tavixo-nut.json`. Gestiona exclusivamente `_acme-challenge.tavixo` en la zona `nut.com.mx`; comparte el bloqueo y la credencial privada existente, cuya utilización para este cambio fue autorizada. No copiar la credencial al repositorio.

El hook anterior `hostinger_dns_auth.py` y su estado se conservan para renovar el certificado del enlace antiguo de Birria, que ahora redirige por HTTPS. No eliminar el A ni la renovación anteriores mientras se necesite esa redirección. Los dos certificados usan DNS-01 y el temporizador existente; no requieren puerto 80. La prueba real de renovación del nuevo certificado quedó aprobada. Ver ../../DOMAIN_CHANGE_RESULTS.md.

Pruebas de alcance y preservación DNS: `python3 -m unittest discover -s infra/tls -p 'test_hostinger_dns_auth*.py'`.
