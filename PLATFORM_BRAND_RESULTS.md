# Integración de identidad Tavixo — 27 de octubre de 2026

Estado: publicado con autorización el 27 de octubre de 2026 en https://tavixo.nut.com.mx/. Versión de código `57cf3a4`.

## Cambios

- Logo vectorial aprobado en cabecera pública; acceso con portada carbón, textos crema y acción terracota. El restaurante sigue sin prellenar.
- Manrope variable y licencia servidas localmente. Tipografía y colores neutros base actualizados; los estados de éxito/cocina/alertas conservan sus reglas y las identidades de restaurantes mantienen prioridad.
- Favicons SVG y PNG, iconos PWA 192/512 y versión exclusiva maskable 512, icono Apple opaco 180. Metadatos y manifest actualizados.
- Service worker `tavixo-shell-v2`: recursos de interfaz actualizados; conserva exclusión de API, sin almacenar operaciones ni introducir modo de trabajo offline.
- Página sin conexión con marca nueva y texto preciso de que se requiere conexión.
- Paleta genérica de restaurantes nuevos y Excel sin marca propia coherente con Tavixo. Valores curados de Birria/Bill y overrides guardados intactos; sin migración ni escritura de datos.
- Generador `scripts/sync-platform-brand.mjs` copia maestros/fuente y prepara los iconos públicos. Sin dependencias nuevas.

## Verificación

`npm run verify:local` completó migraciones, actualización desde esquemas históricos, seed repetible, tipos, **4 pruebas unitarias y 65 de integración**, compilaciones API/web, proxy, login y refresh. Incluye prueba nueva de contrato de contraste de la paleta genérica y preservación de marcas guardadas/curadas. PostgreSQL y procesos temporales terminaron.

**30 comprobaciones HTTP/geometría** de la web compilada: logo público, recursos de fuente/licencia, favicons e iconos, tamaños, manifest, metadatos, nueva caché, API excluida, texto de conexión, titulares, campo de restaurante vacío y componente de arrastrar y soltar conservado. El símbolo maskable ocupa hasta radio 178.26 px respecto al centro, dentro del radio seguro 204.8 px; fondo íntegramente opaco. Icono Apple opaco. Servidor HTTP temporal cerrado.

Registros privados: `work/platform-brand-verification.log` y `work/platform-brand-assets-results.json`.

## Límites y publicación

Pendiente revisión visual interactiva del login/panel en escritorio y móvil, instalación real de iconos y transición del service worker en un navegador existente: no hay herramienta de control de navegador disponible en esta sesión. Las verificaciones HTTP y geométricas no se presentan como capturas o pruebas de dispositivo.

## Despliegue autorizado

- Respaldo `/opt/tavixo/backups/pre-platform-brand-20261027T232238Z`: dump validado por índice; sin ensayo de restauración.
- Reversión disponible en `tavixo-api:rollback-20261027T232238Z` y `tavixo-web:rollback-20261027T232238Z`.
- Construcción previa y actualización exclusiva de API/web; ambos saludables. Sin migración ni seed.
- IDs y tiempos de inicio de PostgreSQL y todos los contenedores protegidos idénticos. `.env`, hashes Nginx y renovación TLS idénticos. Sin acciones sobre DNS, firewall ni certificados.
- Recuentos y huellas de todas las tablas públicas, excepto sesiones temporales `RefreshSession`, idénticos antes/después.
- **42 comprobaciones HTTPS de pilotos**: login, refresh, permisos/aislamiento, identidad y onboarding conservados, productos/mesas/cuentas, Excel y PDF, redirección histórica.
- **38 comprobaciones HTTPS de marca**: logo en HTML, metadatos, manifest, coincidencia exacta de 10 archivos públicos con los activos aprobados, texto/colores/fuente servidos, exclusión de API de la caché, carga por arrastre conservada e icono maskable dentro de zona segura.
- Verificación directa de API publicada: paleta genérica nueva y valores curados de ambos pilotos conservados, sin consulta ni escritura de base de datos.

Registros privados: `work/platform-brand-before.log`, `work/platform-brand-after.log` y `work/platform-brand-live-results.json`. La revisión interactiva de navegador/dispositivo descrita arriba sigue pendiente; estos resultados corresponden a HTTPS, sesión, datos y geometría de activos.
