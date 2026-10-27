# Tavixo — Guía de identidad y diseño

Versión 1 · 27 de octubre de 2026 · Dirección aprobada e integrada en la aplicación con autorización. Ver `docs/IDENTIDAD_TAVIXO.md` en el repositorio para estado y verificaciones.

**Tu restaurante, en sincronía.**

Tavixo ayuda a coordinar mesas, comandas, cocina, cobros y revisión del negocio. Su identidad debe transmitir orden y cercanía a quienes trabajan durante un turno completo, y funcionar tanto para una birriería como para una cafetería o una cocina con varias sucursales.

## 1. Dirección de marca y elección de color

Recomiendo **terracota, carbón y crema**, con maíz como acento. Es una elección de diseño para Tavixo: aproxima la plataforma al ambiente de servicio y mesa sin convertirla en la marca de un restaurante concreto. No presupone que un color aumente el apetito o las ventas.

El verde sigue siendo una opción válida. La ruta anterior, pino `#123C35`, ofrece buen contraste, pero se acerca más al lenguaje jade de Tepahti. Carbón con ámbar es una alternativa más sobria. La lámina compara las tres usando el mismo logotipo para poder juzgar el color sin cambiar la forma.

La ruta recomendada se distingue con una base cálida, tipografía firme y fondos tranquilos. El terracota se concentra en acciones y detalles; no cubre todo el panel. El espacio y las jerarquías deben facilitar leer una cuenta o un corte antes que decorar.

**Personalidad:** directa, cálida, ordenada y práctica. El tono habla con quien atiende un negocio: «Abre tu turno», «Cuenta cobrada», «Revisa tus ventas».

## 2. Logotipo y símbolo

El logotipo combina una **X abierta de cuatro brazos** con la palabra **tavixo**, en minúsculas y Manrope 800. El nombre comercial en una frase puede escribirse Tavixo; el dibujo del logo conserva las minúsculas.

La X retoma una letra del nombre. Sus cuatro brazos representan mesa/comandas, cocina, caja y gestión, coordinadas alrededor de un centro abierto. Es un recurso de identidad, no un botón de cerrar ni un estado operativo; no debe sustituir los iconos funcionales de la interfaz.

La versión principal lleva tres brazos terracota y uno carbón, con la palabra en carbón. La versión invertida usa crema y un brazo maíz. La versión de una tinta reúne todos los trazos y letras en un solo color.

Archivos maestros:

- `assets/logo-color.svg`: principal para superficies claras.
- `assets/logo-reverse.svg`: crema con acento maíz, para carbón oscuro.
- `assets/logo-white.svg`: blanco completo, para terracota o fotografía con placa de contraste.
- `assets/logo-mono.svg`: carbón completo, impresión de una tinta y tickets.
- `assets/logo-terracotta.svg`: terracota completo sobre blanco o crema.
- `assets/symbol.svg` y `assets/symbol-mono.svg`: símbolo independiente.
- `assets/icon.svg`: icono de aplicación.
- `assets/favicon.svg`: versión simplificada para 16–20 px.

Las dos variantes con sufijo `comparison` son únicamente muestras de las rutas cromáticas, no versiones oficiales adicionales.

## 3. Construcción geométrica

El símbolo se dibuja en una retícula de **64 × 64 unidades**. El módulo **u = 8 unidades** organiza la construcción y el espacio de protección.

| Brazo | Segmento central |
| --- | --- |
| Superior izquierdo | (12,12) → (24,24) |
| Superior derecho | (52,12) → (40,24) |
| Inferior izquierdo | (12,52) → (24,40) |
| Inferior derecho | (40,40) → (52,52) |

Cada segmento tiene grosor 12, extremos redondos y dirección de 45°. El centro queda vacío. Los extremos visibles ocupan de 6 a 58 en ambos ejes; el SVG incluye ese margen interno y no reemplaza la protección exterior.

En el archivo horizontal, el símbolo se escala 1.3 veces; la palabra parte de x = 99.2 y línea base y = 78, a tamaño tipográfico 90, dentro de un lienzo de 386 × 96. Las letras están convertidas a curvas: el archivo no necesita una fuente instalada para conservar su forma. Para reconstruir o modificar el nombre, se incluye la fuente y el generador.

La geometría está en `assets/construction.svg`; se regenera con `node scripts/generate-tavixo-brand.mjs`. No se basa en una proporción áurea ni en una retícula ornamental.

## 4. Protección, reducción y formatos

Deja al menos **1u fuera del área nominal del símbolo**. En el conjunto horizontal, usa como margen mínimo 1u multiplicado por el factor de escala del símbolo (10.4 unidades en el SVG maestro). Mantén ese espacio libre de texto, bordes y otros logos.

- Logo completo: mínimo recomendado 120 px de ancho en pantalla o 32 mm en impresión.
- Símbolo: mínimo recomendado 24 px o 8 mm.
- Icono de app: cuadrado; conserva los márgenes y esquinas del archivo maestro.
- Favicon 16–20 px: utiliza el archivo simplificado, con diagonales continuas. No reduzcas el logo completo para ese uso.

Son recomendaciones de esta propuesta, sujetas a la prueba final en los dispositivos de uso. La hoja `Prueba-tamanos.png` permite comparar reducciones. Para ampliar o imprimir, usa SVG; los PNG son exportaciones transparentes, no el original editable. Los colores están en sRGB/HEX; las piezas de imprenta necesitan una prueba de color con el proveedor.

## 5. Paleta y contraste

| Token | Nombre | HEX | Aplicación |
| --- | --- | --- | --- |
| `--tv-primary` | Barro | `#A3432F` | Botón principal, marca, enlace sobre claro |
| `--tv-primary-hover` | Barro profundo | `#873524` | Hover y acción pulsada |
| `--tv-ink` | Carbón | `#24211F` | Texto, cifras, fondos institucionales |
| `--tv-background` | Crema | `#FAF6EF` | Fondo general |
| `--tv-accent` | Maíz | `#EAB766` | Acento, ilustración y detalle de gráficas |
| `--tv-muted` | Piedra | `#70665F` | Ayudas y texto secundario sobre claro |
| `--tv-surface` | Blanco | `#FFFFFF` | Tarjetas, campos y lectura de datos |
| `--tv-border` | Arena | `#DED6CC` | Bordes decorativos y separadores |
| `--tv-tint` | Barro suave | `#F2E3D9` | Superficie seleccionada o destacada |

Distribución orientativa en producto: 75 % crema/blanco, 15 % carbón y texto, 8 % terracota y 2 % maíz. En una portada o una pieza social puede dominar carbón o terracota; en una tabla de ventas domina la lectura.

Contrastes calculados con luminancia relativa sRGB, redondeados sólo para mostrarlos:

| Texto / fondo | Razón |
| --- | ---: |
| Barro / blanco | 6.17:1 |
| Barro / crema | 5.73:1 |
| Carbón / crema | 14.85:1 |
| Carbón / maíz | 8.74:1 |
| Piedra / crema | 5.19:1 |

Estas combinaciones superan 4.5:1 para texto normal. La pauta de referencia es [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). No constituye una auditoría de accesibilidad de la aplicación.

No usar blanco sobre maíz ni barro sobre carbón para textos pequeños. Los bordes arena son separadores; un campo o control que necesite límite visible utiliza piedra y un foco claro.

## 6. Estados y accesibilidad

La paleta de marca y los estados se gestionan por separado. Un botón terracota no significa error. Cancelar debe llevar verbo explícito, icono y una disposición distinta de la acción principal.

Colores semánticos propuestos para nuevas piezas: éxito verde `#246445`, aviso ámbar oscuro `#805100`, error grana `#B42318`, información azul `#2455A4`. Combinar con fondo blanco y acompañar de texto; verificar de nuevo si cambia el fondo. No reemplazar automáticamente los colores operativos que ya están publicados.

El foco usa contorno azul `#2563EB` de 3 px, separado 3 px del componente. Mantener controles de al menos 44 px de alto, texto de cuerpo de 16 px y zoom sin pérdida de funciones. Los gráficos llevan leyenda, unidades y valores además de color. En tablas, importes alineados a la derecha y nombres a la izquierda.

## 7. Tipografía

**Manrope** es la familia propuesta para marca e interfaz. Se incluye su archivo variable 200–800 y su licencia SIL OFL 1.1 completa. Fuente oficial: [Google Fonts / Manrope](https://github.com/google/fonts/tree/main/ofl/manrope).

| Uso | Tamaño / interlineado | Peso |
| --- | --- | --- |
| Portada | 56–88 / 1.08 | 800 |
| H1 en producto | 36 / 1.15 | 800 |
| H2 | 28 / 1.2 | 700 |
| H3 | 22 / 1.3 | 700 |
| Cuerpo | 16 / 1.55 | 400–500 |
| Etiqueta y botón | 14–16 / 1.4 | 700 |
| Ayuda | 14 / 1.5 | 400–500 |

Se verificó que la fuente contiene `tnum`. Para importes y folios numéricos aplica `font-variant-numeric: tabular-nums lining-nums`; evita que salten las columnas al actualizar cifras. No uses el peso 200 para datos de trabajo. Arial y sans-serif son respaldo si aún no carga la fuente.

## 8. Formas, componentes y movimiento

Espaciado base 4 px; escala 4, 8, 12, 16, 24, 32, 48 y 64. Radios: 8 px en campos, 10 px en botones, 16 px en tarjetas y 24 px en paneles de presentación.

Botón principal terracota/blanco, secundario claro con borde piedra y texto carbón. El hover oscurece el principal; no cambia el significado. Un estado de guardado mantiene su etiqueta y evita envíos duplicados. Un archivo seleccionado muestra nombre, peso, vista previa y acción de guardar: arrastrar no guarda automáticamente.

Iconos de línea de 1.75–2 px a tamaño 24, con nombres accesibles. El símbolo de marca nunca se reutiliza como icono de cerrar. Animaciones de 120–180 ms, sin saltos al cargar importes, y sin transición cuando el usuario pide reducir movimiento.

Modo oscuro institucional: carbón de fondo, crema para texto, maíz para detalles y botones claros con texto carbón. No invertir automáticamente el panel de trabajo ni los logos de restaurantes.

## 9. Plataforma y restaurante

**Tavixo** identifica la herramienta en acceso, sitio comercial, materiales de venta y ayuda. **El restaurante** ocupa el encabezado de su operación, su configuración y sus tickets.

- Birria conserva su logo y negro/dorado.
- Bill-Cochi-Nada conserva el logo y los colores elegidos por su responsable.
- La propuesta terracota no sobrescribe las configuraciones de los pilotos.
- En un ticket, el restaurante es protagonista. Si se incorpora una firma de plataforma, debe ser secundaria: «Gestionado con Tavixo».
- En una demo pública se usa un negocio ficticio y cifras de ejemplo; no se reutilizan ventas ni datos privados de los pilotos.

La identidad ya se integró al acceso, tipografía, valores base e iconos de la plataforma. Esta entrega contiene sus activos y documentación. Las futuras aplicaciones requieren revisar contraste y estados en las pantallas reales.

## 10. Voz y mensajes

Habla de tareas concretas, en español claro y con tuteo respetuoso. Frases de referencia:

- Marca: «Tu restaurante, en sincronía».
- Comercial: «Mesas, cocina y caja en un mismo lugar».
- Producto: «Revisa tus ventas», «Abre tu turno», «Guardar identidad».
- Ayuda: «Selecciona un PNG o JPG de hasta 512 KB».

Evita «la solución definitiva» o promesas de aumentar ventas sin evidencia. En promoción, comunica lo que el producto ya hace. No anuncies operación sin internet, facturación CFDI, cobro bancario integrado o impresión física mientras no estén implementados.

## 11. Aplicaciones

**Sitio comercial y portada:** fondo carbón, logo invertido, titular crema y una acción terracota sobre una tarjeta clara. Usar espacio amplio y una captura real debidamente revisada; los mockups de esta guía están marcados como conceptuales.

**Redes y reels:** la plantilla vectorial `assets/social-post.svg` ofrece una aplicación cuadrada. Una idea por pieza, subtítulos grandes y cierre con marca. Guion de ejemplo: «¿La segunda ronda se perdió?» → mostrar agregar productos a una cuenta abierta → «Cocina, caja y mesas en sincronía» → Tavixo. Mantener textos lejos de las superposiciones de la plataforma y revisar el formato al producir el video.

**Icono de app:** símbolo crema/maíz sobre terracota. `icon.svg` sirve como maestro; la instalación PWA debe probarse con las máscaras reales antes de sustituir sus iconos.

**PDF y propuestas comerciales:** logo principal sobre blanco, títulos carbón y líneas finas terracota; cuerpo negro/carbón. Para impresoras de una tinta se usa `logo-mono.svg`.

**Dashboard:** superficies claras, importes grandes, colores usados con moderación y marcas de estado consistentes. Los datos de la lámina son ilustrativos, no un reporte real.

## 12. Usos incorrectos

No estirar, inclinar, girar el símbolo ni cambiar sus proporciones respecto a la palabra. No reconstruirlo con emojis ni cambiar sólo el brazo destacado de posición. No añadir sombras, contornos o degradados al logo. No usar la variante clara sobre blanco ni la principal sobre carbón. No escribir un eslogan dentro del archivo del logo a tamaños pequeños. No presentar una ruta comparativa como si fuera una cuarta variante oficial.

## 13. Entrega y estado

El directorio `marketing/marca/tavixo/` contiene la guía fuente, SVG maestros, fuente/licencia, tokens, manifiesto y vista HTML sin dependencias de red. `outputs/marca-tavixo/` contiene las exportaciones PNG y la copia de lectura de esta guía. El ZIP conserva ambas rutas para que los enlaces relativos funcionen después de extraerlo.

La dirección fue aprobada y se publicó el 27 de octubre de 2026 en la plataforma, con respaldo y verificaciones HTTPS. Las configuraciones de restaurantes se conservaron. La revisión visual interactiva en navegador y la instalación en dispositivos siguen pendientes. Los mockups de esta guía son conceptuales, no capturas de la app.
