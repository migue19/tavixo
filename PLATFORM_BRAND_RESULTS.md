# Integración de identidad Tavixo — 27 de octubre de 2026

Estado: dirección aprobada, implementación local validada y pendiente de autorización de publicación en VPS.

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

No se tocó el VPS. Publicar requiere respaldo previo, imágenes de reversión y actualización exclusiva de API/web de Tavixo, sin migraciones, cambios de infraestructura ni de identidades guardadas. La autorización de la guía aprobó la dirección visual; aún no se ha solicitado/aprobado este despliegue concreto.
