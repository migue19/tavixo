# Identidad Tavixo — dirección aprobada v1

Dirección aprobada por el usuario el 27 de octubre de 2026. Integración en producto implementada localmente y validada, pendiente de autorización de publicación. Los restaurantes conservan su propia identidad.

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

Una aplicación posterior al login, PWA o materiales debe partir de la dirección elegida y probar tamaños, máscaras de iconos y contraste en las pantallas reales. Los pilotos conservan su identidad configurable. La publicación requerirá autorización aparte.


## Integración local aprobada

Logo en el acceso, portada carbón/crema con acciones terracota, fuente Manrope servida localmente, iconos de navegador/iPhone/PWA, caché de recursos de interfaz actualizada y página sin conexión coherente con la marca. Los valores genéricos de nuevos restaurantes y Excel sin identidad propia adoptan la paleta Tavixo; las configuraciones guardadas y las marcas de ambos pilotos conservan prioridad.

Los maestros se copian y exportan a la app con `node scripts/sync-platform-brand.mjs`. El icono para recortes tiene fondo completo y símbolo dentro del círculo central de diámetro 80%; el de iPhone es opaco. La actualización de un icono ya instalado depende también del sistema operativo; la comprobación geométrica no sustituye pruebas de instalación en dispositivos.

Ver [PLATFORM_BRAND_RESULTS.md](../PLATFORM_BRAND_RESULTS.md) para resultados y límites. Esta integración aún no está publicada.
