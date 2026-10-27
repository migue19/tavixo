# Corrección de carga de logos — 27 de octubre de 2026

Estado: publicado con autorización el 27 de octubre de 2026 en https://tavixo.nut.com.mx/. Código `43c3c36` (corrección de carga `0b23675` y login genérico `43c3c36`).

## Causa y cambio

Los dos archivos facilitados cumplen las especificaciones visibles: JPG de 199224 bytes (870 × 1024) y PNG de 491808 bytes (512 × 512). Al normalizarlos a PNG sin paleta, crecían a 389030 y 542940 bytes, superando el límite interno de 262144 bytes. El servidor los rechazaba pese a cumplir los límites de entrada.

Se conserva la normalización inicial sin pérdida. Sólo si supera el límite se reduce la paleta a 256 colores; si aún es necesario se reduce a 384 px y 128 colores. Se conserva el formato PNG, la transparencia, la eliminación de metadata, el límite de entrada de 512 KB y el límite de almacenamiento de 256 KB. No requiere migración ni cambios de infraestructura.

Los archivos originales producen salidas de 124491 y 154870 bytes respectivamente, sin reducir más la resolución prevista. Se inspeccionó visualmente la salida cuadrada. Esta optimización puede reducir gradientes o textura en imágenes complejas.

El selector limpia el archivo pendiente cuando una selección nueva no cumple tipo o peso, evitando enviar una selección anterior por accidente.

## Regresión

Prueba de integración con JPEG y PNG transparente detallados generados de forma determinista: ambos cumplen el límite de entrada pero exceden el límite interno tras la conversión anterior. Verifica carga por multipart, PNG guardado dentro del límite, dimensiones permitidas y conservación de transparencia. No incluye imágenes del cliente como fixtures.

La revisión interactiva del formulario en escritorio y móvil continúa pendiente por falta de control de navegador en esta sesión. No se hicieron escrituras en producción.

## Resultado de verificación local

`npm run verify:local` completó correctamente: migraciones y actualización desde esquemas históricos, seed repetible, tipos, 3 pruebas unitarias y 65 de integración, compilación API/web, HTML, recursos PWA y sesión/refresh a través del proxy web. El PostgreSQL temporal y los procesos de prueba finalizaron. Registro privado: `work/logo-fix-verification.log`.

El cambio previo del login genérico está incluido en el árbol validado; la guía de marca sigue en preparación y no forma parte de esta corrección.


## Publicación y validación

- Respaldo: `/opt/tavixo/backups/pre-logo-upload-fix-20261027T223108Z`. Dump validado por índice; no se realizó una restauración de prueba.
- Imágenes de reversión: `tavixo-api:rollback-20261027T223108Z` y `tavixo-web:rollback-20261027T223108Z`.
- Compilación previa y actualización exclusiva de API/web. Sin migración, seed, cambios de `.env`, Nginx, renovación TLS, DNS o firewall.
- API/web saludables. IDs y horas de inicio de PostgreSQL y otros contenedores idénticos; hashes Nginx y renovación TLS idénticos.
- Recuento y huella de todas las tablas públicas, excepto sesiones temporales `RefreshSession`, idénticos antes/después de la sustitución.
- 40 comprobaciones HTTPS aprobadas: acceso de ambos pilotos, configuración, sesión/refresh, aislamiento, catálogo/mesas/cuentas sin cambios, Excel, PDF y redirección histórica.
- Los dos archivos originales se probaron con el controlador compilado dentro del contenedor publicado, sustituyendo únicamente la transacción por memoria: JPG → PNG 435 × 512, 124491 bytes; PNG → PNG 512 × 512, 154870 bytes. No se guardaron logos ni datos reales en esta prueba. La carga multipart completa se probó en integración local.
- 4 comprobaciones del JavaScript servido confirman textos genéricos y ausencia de valor inicial Birria en el campo restaurante. La inspección inicial del HTML no encontraba el campo porque el login se renderiza en el cliente; se verificó el código público entregado al navegador.
- Sigue pendiente revisión interactiva del formulario en escritorio/móvil; no hay herramienta de control de navegador disponible en esta sesión.

No se incluyeron en el despliegue las imágenes nuevas sin seguimiento de Git ni la guía de marca en preparación.
