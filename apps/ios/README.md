# Tavixo para iOS — pedidos y rondas (0.2.1)

App SwiftUI para iPhone y iPad, iOS 17 o posterior. Proyecto Xcode incluido, sin paquetes externos de Swift. Identificador provisional: `mx.com.nut.tavixo`.

## Qué incluye

- Acceso con restaurante, correo y contraseña contra `https://tavixo.nut.com.mx`.
- Restauración y rotación de sesión; credencial de renovación en Keychain y JWT de acceso sólo en memoria.
- Inicio con cuentas abiertas, total pendiente y ocupación de mesas; selector de sucursal según el acceso real.
- Mesas, comandas abiertas, detalle de productos/notas/cantidades vigentes e historial reciente de hasta 50 cuentas terminales, conforme al contrato actual de la API.
- Tomar pedidos desde mesas libres: menú con búsqueda/categorías, cantidades y notas, revisión y envío.
- Agregar rondas a cuentas abiertas; detalle actualizado con total y notas de las rondas.
- Recuperación de un envío incierto en Keychain; reintento explícito con el mismo UUID y contenido, incluso después de cerrar la app.
- Rol visible; cocina no muestra importes en las pantallas de consulta. Las autorizaciones se mantienen en el servidor.
- Logo y color principal del restaurante cuando están configurados. Identidad Tavixo en acceso e icono; Manrope local, tamaños dinámicos y VoiceOver con etiquetas de controles.
- Demo con datos ficticios sólo en Debug, sin llamadas API ni cambios del llavero.

Esta entrega permite **consultar y tomar pedidos/rondas** para propietario, gerente, caja y mesero. Cocina conserva sólo consulta. Todavía no cambia estados de cocina, registra cobros, muestra tickets PDF, administra equipo ni configura marca. No es un WebView; las pantallas y el cliente HTTP son nativos. El enlace a la web en Mi cuenta permite acceder a las funciones que aún no están en iOS.

## Abrir y ejecutar

Desde la raíz del monorepo:

```sh
open apps/ios/Tavixo.xcodeproj
```

Selecciona el esquema **Tavixo** y un simulador iPhone/iPad instalado, y pulsa Run. Xcode usa firma local ad hoc para el simulador; no hace falta un Team ni cuenta Apple para esas pruebas. No desactives la firma en el simulador: el llavero necesita esa identidad local. Para un teléfono físico, elige tu Team en Signing & Capabilities y ajusta el identificador si corresponde. El Team que el propietario agregó en Xcode se conserva también en `project.yml`. TestFlight y App Store no están configurados ni se ha publicado una app.

En Debug, pulsa **Explorar demo local**, o agrega el argumento de lanzamiento `-tavixo-demo`. La banda DEMO LOCAL identifica todos los datos ficticios. Para conectar una cuenta real, sal de la demo e introduce sus credenciales directamente en la app; no las escribas en código, Git o documentación. El nombre de restaurante empieza vacío.

## Compilar y probar

Comandos desde la raíz; adapta el destino a los simuladores instalados:

```sh
xcodebuild -project apps/ios/Tavixo.xcodeproj -scheme Tavixo \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath work/ios-build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build

xcodebuild -project apps/ios/Tavixo.xcodeproj -scheme Tavixo \
  -destination 'platform=iOS Simulator,name=iPhone 17e,OS=27.2' \
  -derivedDataPath work/ios-build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

Verificado con Xcode 27.2, Swift 6.4.2 y simulador iOS 27.2. Ver resultados y recuento de pruebas de esta versión en [IOS_ORDERS_RESULTS.md](../../IOS_ORDERS_RESULTS.md). La navegación inicial pasó en iPhone y iPad; el llavero se verificó también con una escritura/lectura reales en un namespace aislado del simulador. Los tests de cliente interceptan HTTP con URLProtocol; el de interfaz usa la demo. No requieren contraseñas ni cuentas de clientes.

`project.yml` es la fuente para regenerar el proyecto con XcodeGen 2.46.0. El `.xcodeproj` ya está versionado, así que XcodeGen no es necesario para abrirlo. Para regenerar:

```sh
xcodegen generate --spec apps/ios/project.yml
node scripts/sync-ios-brand.mjs
```

El generador de activos usa Sharp del monorepo: ejecutar después de `npm ci` y desde su raíz. Copia fuente/licencia y exporta logo/icono desde los maestros aprobados de `marketing/marca/tavixo/`.

## Sesión y red

`APIClient` utiliza URLSession efímera, sin caché de respuestas ni almacenamiento automático de cookies. Sólo conecta por HTTPS, rechaza redirecciones y envía `Origin` con el origen del backend: la API existente lo comprueba en login, refresh y logout. No se agregó un bypass ni un endpoint nuevo al servidor.

La cookie `tavixo_refresh` se extrae del encabezado Set-Cookie; se valida dominio, Secure, ruta y formato antes de guardarla en el llavero con accesibilidad `WhenUnlockedThisDeviceOnly`, sin sincronización iCloud. No se guardan contraseña, JWT de acceso ni datos de negocio en UserDefaults/archivos. Las respuestas operativas permanecen en memoria. Excepción acotada: un envío de pedido iniciado se guarda en otro namespace del Keychain (`mx.com.nut.tavixo.pending-order`) antes del POST, con usuario/restaurante/sucursal, UUID, IDs de productos, cantidades, notas y total esperado de la ronda. No contiene contraseña ni JWT; conserva la misma protección local, sin iCloud. Se elimina tras confirmación válida, salvo fallo de borrado, en cuyo caso el UUID se conserva para reintentar sin duplicar.

Las renovaciones simultáneas se agrupan en una sola tarea. Un GET que recibe 401 puede renovarse y repetirse una vez; no se reintentan automáticamente POST de autenticación. Un 403 no se convierte en una nueva sesión. Un 401 persistente elimina la identidad local. Una respuesta de renovación malformada o un fallo al escribir el llavero intenta revocar la nueva credencial y descarta el estado autenticado.

Si falla la red al restaurar, se conserva la credencial para un reintento explícito. El cierre normal se confirma en servidor antes de limpiar el llavero; si falla, se informa y permite reintentar. La recuperación permite eliminar sólo la sesión local con confirmación, dejando claro que eso no la revoca en servidor sin conexión. Una interrupción durante una rotación puede requerir volver a iniciar sesión, según el comportamiento del backend existente. El envío pendiente no se elimina al salir o perder la sesión: vuelve a aparecer para el mismo usuario/restaurante. Otra cuenta no puede ver sus detalles ni iniciar nuevos pedidos hasta resolverlo con el acceso original.

Se descartan resultados obsoletos al cambiar sucursal o contexto de usuario/rol/restaurante. La app oculta el contenido al pasar a segundo plano y marca vistas de datos como privadas. La versión inicial usa tema claro para conservar contraste de la identidad aprobada; falta evaluación completa con VoiceOver, tamaños extremos y dispositivos físicos para esta nueva versión. El propietario confirmó login y consulta en un iPhone físico para 0.1.0.

## Contratos utilizados

- `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- `GET /api/restaurant/branches`.
- `GET /api/restaurant/branches/:id/tables`, `/orders`, `/categories` y `/products`.
- `POST /api/restaurant/branches/:id/orders` y `/orders/:orderId/rounds`.

El restaurante y los permisos se derivan de la sesión del servidor. Los IDs de sucursal proceden del listado autorizado y se validan como UUID antes de formar rutas. Importes en centavos enteros y presentación MXN mediante Decimal; precios/cantidades de consulta proceden de snapshots del servidor. La hora “Actualizado” corresponde al dispositivo; no es una fecha contable.

Las mesas se consideran ocupadas por sus cuentas abiertas; una mesa inactiva nunca se anuncia libre. Los totales del inicio corresponden a cuentas abiertas, no a ventas cobradas. Los datos requieren actualización manual mediante gesto de recarga o botón de reintento. No hay sincronización de cocina en tiempo real ni operaciones offline.

## Tomar pedidos

1. En **Mesas**, elige **Tomar pedido** en una mesa activa y libre. En una cuenta abierta, usa **Agregar otra ronda** en su detalle.
2. Busca o filtra el menú. Sólo se ofrecen productos activos/disponibles de categorías activas. Cada pulsación en + aumenta la cantidad; máximo 100 por producto y 100 líneas por envío. La API limita además cada cuenta a 100 líneas acumuladas entre sus rondas, incluidos los snapshots previos.
3. Al agregar un producto aparece **Nota para este producto** directamente en el menú. Es opcional y aplica a todas sus unidades en ese envío. Pulsa **Revisar pedido** para ver precio unitario y subtotal por producto, ajustar cantidades y notas (300 caracteres por producto, 500 generales), o vuelve al menú para agregar más. El estimado usa precios del menú; el servidor fija los importes definitivos.
4. Confirma el envío y espera la confirmación con número de comanda y total vigente. Una ronda envía el total de cuenta esperado y no modifica productos anteriores. No se realiza ningún cobro.
5. Si hay un envío pendiente, usa **Recuperar envío pendiente** y **Reintentar mismo envío**. No se reenvía automáticamente al recuperar conexión; no cambies de cuenta ni abras otra para sustituirlo. Se bloquea el cambio de sucursal y un segundo pedido mientras existe ese envío. Puedes cerrar la pantalla conservándolo.
6. Un rechazo definitivo inicial por mesa ocupada, producto no disponible o cuenta modificada exige actualizar y revisar desde la mesa/cuenta antes de iniciar otro envío. Un reintento de una operación incierta conserva su referencia incluso si luego el servidor deniega permisos; debe resolverlo el usuario original o soporte con comprobación en servidor. La app no ofrece un borrado que pueda ocultar un pedido ya recibido.

Los borradores **sin enviar** sólo viven en memoria: al cancelarlos se pide confirmación. El llavero de pendientes protege envíos ya iniciados; no es una cola offline ni guarda el catálogo. Necesitas internet para consultar y confirmar. Las escrituras no se repiten automáticamente ni tras un 401. Si cambian el usuario, restaurante, rol o sucursal, el compositor conserva su contexto inicial y rechaza el envío.

## Próxima entrega

Cocina interactiva y cobros, reutilizando revisiones, snapshots e idempotencia de la API. No deben agregarse escrituras que cambien importes calculados por servidor o ignoren cambios de rol/sucursal.
