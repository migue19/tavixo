# Guía de marca Tavixo v1 — 27 de octubre de 2026

Estado: guía v1 aprobada. La integración de plataforma se publicó posteriormente el mismo día; ver PLATFORM_BRAND_RESULTS.md. Las verificaciones de esta sección corresponden a la entrega de diseño.

## Entrega

Guía fuente `marketing/marca/tavixo/DESIGN.md`, vista HTML sin conexión, lámina PNG/SVG, maestros de logo/símbolo, icono/favicons, plantilla social, fuente Manrope/OFL, manifiesto y tokens CSS aislados. Copia de lectura y PNG en `outputs/marca-tavixo/`; paquete descargable `outputs/Tavixo-identidad-v1.zip`.

La recomendación es terracota/carbón/crema, comparada visualmente con verde y carbón/ámbar. El símbolo retoma la X de Tavixo con cuatro brazos alrededor de un centro abierto; palabra en minúsculas convertida a curvas. Se documentan construcción, protección, mínimos, variantes, colores/contrastes, tipografía, componentes, estados, voz, convivencia con cada restaurante y aplicaciones.

## Verificación

- Render PNG de lámina, portada, logo, retícula, muestras de tamaños y pieza social inspeccionados visualmente. Se corrigió el margen del pie de la retícula.
- 14 SVG parseados como XML válido, con viewBox y curvas; sin texto dependiente de fuente ni imágenes enlazadas.
- Enlaces locales de la vista HTML comprobados contra archivos existentes.
- Copia exportada de la guía idéntica al original.
- Cinco combinaciones de texto contrastadas por luminancia sRGB; todas superan 4.5:1 sin redondear. Datos exactos en `contrast-checks.json`.
- Fuente y licencia obtenidas del repositorio oficial de Google Fonts; se comprobó disponibilidad de cifras tabulares.
- Integridad del ZIP comprobada con `unzip -t`; sólo contiene activos de marca Tavixo, documentación y generador, sin datos de clientes.
- La vista HTML está preparada para escritorio/móvil, pero la interacción y representación real en navegador siguen pendientes. La vista del archivo solicitada a Codex quedó en cola; no se presenta como una revisión de navegador.

No se modificaron código del producto, configuración de restaurantes ni servicios del VPS. No se repitieron compilación API/web ni pruebas de base de datos por ser una entrega de marca y documentación. Los cambios al sincronizador de Obsidian añaden únicamente `docs/IDENTIDAD_TAVIXO.md` a la lista explícita de documentación pública.


Tras publicar la plataforma se actualizaron los textos de estado de guía, lámina y ZIP, sin alterar la geometría ni los colores aprobados. El paquete no es una captura ni una prueba interactiva del producto.
