# Identidad del restaurante

## Estado

La configuración editable se publicó con autorización el 26 de octubre de 2026, con respaldo y migración aditiva. Incluye el logo original de Bill-Cochi-Nada extraído del menú, verde oscuro, crema y acento claro como valores sugeridos. Birria conserva su identidad negra/dorada. Ver BRANDING_SETTINGS_RESULTS.md para validaciones y límites.

## Uso

El propietario y el gerente encuentran **Configuración → Identidad del restaurante**. Pueden subir o quitar logo, escoger color principal, acento y fondo claro, revisar una vista previa y guardar. La marca aplica al restaurante actual; no modifica otros pilotos.

En el primer acceso de un administrador sin configuración aparece **Haz tuyo este espacio**, con **Personalizar ahora** o **Más tarde**. Omitir guarda la decisión por restaurante, sin impedir la operación; la configuración sigue disponible en el menú. Birria, que ya estaba personalizado, no vuelve a recibir la invitación. Los meseros, cocina y cajeros ven la marca pero no pueden modificarla.

## Logo

- PNG o JPG; hasta 512 KB.
- Entre 128 y 2048 píxeles por lado; recomendado cuadrado, PNG transparente si está disponible.
- El servidor valida tipo y decodificación reales, rechaza SVG/GIF y optimiza a PNG de hasta 512 px por lado. Se elimina metadata y se limita la salida a 256 KB. La corrección local para imágenes detalladas reduce la paleta sólo cuando hace falta y, como último recurso, ajusta a 384 px; conserva la transparencia. Esta corrección está pendiente de publicación.
- El formulario conserva el logo actual, permite sustituirlo o quitarlo explícitamente. No acepta direcciones remotas ni rutas de archivos.

## Colores y alcance

Se requiere principal oscuro, fondo claro y contraste mínimo de 4.5:1 entre principal y fondo/ blanco, más 3:1 entre acento y principal. La previsualización no cambia la aplicación hasta guardar. Estados de cocina, pagos, errores y alertas mantienen sus colores operativos.

Encabezado, navegación, fondo del panel y gráficas utilizan la marca. Tickets digitales/PDF utilizan el logo; Excel usa la paleta en sus encabezados. Otros usuarios deben refrescar la página o renovar sesión para actualizar los datos de marca que ya tenían cargados. El acceso sin sesión conserva la identidad Tavixo.

## API y persistencia

- `GET /api/restaurant/branding`: identidad efectiva, colores sugeridos y estado de la invitación.
- `POST /api/restaurant/branding`: multipart con `primary`, `accent`, `surface`, `logoAction` (`keep`, `replace`, `remove`) y `logo` opcional.
- `POST /api/restaurant/branding/dismiss`: omite la invitación inicial.

Roles OWNER/MANAGER, membresía vigente y tenant derivados del token. Límite de 20 guardados por minuto. No se añade un parámetro para editar el restaurante de otra cuenta.

Migración `20261026000000_restaurant_branding`: agrega `Restaurant.branding` JSON y `brandingPromptDismissed`, sin borrar datos. El PNG optimizado se guarda dentro del JSON en PostgreSQL: sobrevive a cambios de contenedor y se incluye en los respaldos de la base. No requiere disco compartido, otro servicio ni cambios de Nginx; la carga de 512 KB cabe en el límite actual de 1 MB.

`apps/api/src/branding.ts` conserva valores sugeridos del piloto inicial y de Bill-Cochi-Nada como compatibilidad; cualquier restaurante puede guardar su propia configuración sin modificar código. Los logos sugeridos permanecen en `apps/web/public/branding/` y `apps/api/assets/branding/`; mantener las dos copias iguales al reemplazarlos.

La API depende explícitamente de Sharp 0.35.5 (ya utilizado por Next). Se fijaron Multer 2.5.0 y body-parser 2.4.0 para incorporar sus correcciones de seguridad en la carga y lectura de formularios.
