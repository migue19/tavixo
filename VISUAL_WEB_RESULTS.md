# Navegación y reportes visuales: despliegue

Fecha: 15 de octubre de 2026, horario de Ciudad de México.
Código desplegado: `e73a92a2be7213efe8c45c577a241d2c9b77bf6f`.

Actualización autorizada exclusivamente de la web. Se compilaron sus cuatro archivos modificados en el VPS y se recreó únicamente el contenedor web con `--no-deps --no-build`. No se ejecutaron migraciones, seed ni cambios de firewall, Nginx, certificados o variables de entorno.

## Resultado

- Web saludable y acceso HTTPS con certificado confiable.
- 25 comprobaciones públicas aprobadas: página, recursos compilados, autenticación, cookie segura, acceso a Equipo y consultas de reportes.
- Navegación agrupada y gráficas confirmadas en el navegador de producción.
- Respuestas de productos, mesas y cuentas idénticas antes/después mediante SHA-256; 16 productos, cuatro mesas y tres cuentas existentes.
- Identidad y fecha de inicio de contenedores API y PostgreSQL idénticas antes/después; no se reiniciaron.
- La conexión SSH inicial expiró antes de la activación. Se restableció, se comprobó que seguía la web anterior y después se completó la actualización.

## Reversión disponible

Respaldo privado del servidor: `/opt/tavixo/backups/pre-visual-web-20261015T171604Z`.
Imagen anterior conservada: `tavixo-web:rollback-20261015T171604Z`.
El respaldo incluye fuentes web anteriores, marcador de versión anterior, identidades de contenedores y registro de compilación.

Para una reversión autorizada, restaurar las fuentes anteriores y su marcador, retirar el nuevo archivo `apps/web/app/report-visuals.tsx`, etiquetar la imagen anterior como `tavixo-web:latest` y recrear únicamente web con `docker compose up -d --no-deps --no-build web`. Verificar salud y HTTPS. No necesita restaurar la base de datos.
