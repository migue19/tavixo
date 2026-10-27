# Identidad Tavixo — dirección aprobada v1

Dirección aprobada por el usuario el 27 de octubre de 2026. Integración publicada con autorización y verificada por HTTPS el mismo día. Los restaurantes conservan su propia identidad.

## Por qué Tavixo y nuestro objetivo

Tavixo es un nombre de marca creado, elegido por ser breve, sonar moderno y acompañar el crecimiento de la plataforma. La X representa el encuentro de mesas/comandas, cocina, caja y gestión: es una interpretación de marca, no una traducción ni una etimología.

**Nuestro objetivo:** ayudar a los restaurantes a trabajar con más orden, visibilidad y confianza, desde la primera comanda hasta el cierre de caja.

**Misión:** conectar mesas, cocina, caja e información del negocio mediante herramientas claras y prácticas para las personas que operan un restaurante.

**Visión:** ser una herramienta de confianza para restaurantes independientes y negocios en crecimiento, acompañándolos a ordenar su operación sin perder su identidad.

El relato completo está al inicio de la guía y en su [sección visual de nombre y propósito](../marketing/marca/tavixo/preview/index.html#nombre-y-proposito). También se incluye una [lámina independiente](../outputs/marca-tavixo/Nombre-y-proposito-Tavixo.png).

## Dirección recomendada

Terracota **#A3432F**, carbón **#24211F** y crema **#FAF6EF**, con maíz **#EAB766** como acento. Busca una presencia cálida y una separación visual respecto al jade de Tepahti. Se muestran también las rutas verde y carbón/ámbar para comparar; no hay un color obligatorio para el ramo.

El símbolo es una X abierta de cuatro brazos, vinculados a mesas/comandas, cocina, caja y gestión. La palabra tavixo utiliza Manrope 800 en minúsculas y está convertida a curvas en los maestros SVG. El eslogan continúa siendo «Tu restaurante, en sincronía».

## Entregables

- [Guía completa y fuente de verdad](../marketing/marca/tavixo/DESIGN.md).
- [Vista HTML sin conexión](../marketing/marca/tavixo/preview/index.html).
- [Lámina visual](../outputs/marca-tavixo/Tavixo-identidad-v1.png).
- [Presentación del logo](../outputs/marca-tavixo/Presentacion-logo-Tavixo.png).
- [Logo vectorial principal](../marketing/marca/tavixo/assets/logo-color.svg).
- [Construcción geométrica](../marketing/marca/tavixo/assets/construction.svg).
- [Tokens CSS aislados](../marketing/marca/tavixo/tokens.css).
- [Paquete ZIP](../outputs/Tavixo-identidad-v1.zip).

La guía incluye variaciones, protección y mínimos, colores/contrastes, tipografía/licencia, componentes, voz, convivencia con el restaurante y aplicaciones comerciales. Incluye una plantilla cuadrada para redes, icono y favicon simplificado. El ZIP contiene la fuente y su licencia; no contiene datos de clientes.

## Estado y aplicación

Se verificó el render de la lámina, logo, retícula y muestras de tamaños. Los SVG de marca contienen curvas y no requieren cargar tipografía. La vista HTML utiliza la fuente local y tiene sus rutas de archivos verificadas; revisión interactiva en navegador pendiente.

Los contrastes de texto propuestos se calcularon con luminancia sRGB: barro/blanco 6.17:1, carbón/crema 14.85:1 y piedra/crema 5.19:1. Son comprobaciones de la paleta; no una auditoría del producto.

La identidad está publicada en acceso, tipografía, valores base e iconos PWA. Los pilotos conservan su identidad configurable. La instalación real y la revisión interactiva en dispositivos siguen pendientes; futuras aplicaciones requieren sus propias verificaciones.


## Integración publicada

Logo en el acceso, portada carbón/crema con acciones terracota, fuente Manrope servida localmente, iconos de navegador/iPhone/PWA, caché de recursos de interfaz actualizada y página sin conexión coherente con la marca. Los valores genéricos de nuevos restaurantes y Excel sin identidad propia adoptan la paleta Tavixo; las configuraciones guardadas y las marcas de ambos pilotos conservan prioridad.

Los maestros se copian y exportan a la app con `node scripts/sync-platform-brand.mjs`. El icono para recortes tiene fondo completo y símbolo dentro del círculo central de diámetro 80%; el de iPhone es opaco. La actualización de un icono ya instalado depende también del sistema operativo; la comprobación geométrica no sustituye pruebas de instalación en dispositivos.

Ver [PLATFORM_BRAND_RESULTS.md](../PLATFORM_BRAND_RESULTS.md) para resultados y límites. Publicada con código `57cf3a4`: 42 comprobaciones HTTPS de pilotos y 38 de marca aprobadas.
