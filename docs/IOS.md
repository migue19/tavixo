# App nativa iOS

Versión **0.2.2 · teclado y ajuste del logo**, 4 de noviembre de 2026. SwiftUI para iPhone/iPad iOS 17+, en `apps/ios/`. No se modificó ni desplegó backend ni web.

[Instrucciones completas](../apps/ios/README.md) · [Proyecto Xcode](../apps/ios/Tavixo.xcodeproj/project.pbxproj) · [Resultados de pedidos](../IOS_ORDERS_RESULTS.md) · [Primera entrega](../IOS_RESULTS.md).

Incluye acceso, restauración/rotación de sesión, sucursales según permisos, consulta de mesas/comandas y ahora **apertura de cuentas y nuevas rondas**. Menú por categorías/búsqueda, cantidades y notas por producto/pedido, revisión antes de enviar y confirmación con el importe del servidor. Propietario, gerente, caja y mesero; cocina continúa sólo con consulta.

JWT en memoria, refresh en Keychain y HTTPS sin redirecciones/caché/cookies compartidas. Los envíos iniciados guardan su UUID/contenido/contexto en un namespace separado del llavero antes de contactar la API. Una respuesta incierta permite reintentar exactamente el mismo envío aunque se cierre la app; no se repiten POST automáticamente. No se permite otro pedido hasta resolverlo. Los detalles sólo se recuperan para el mismo usuario y restaurante; no es operación offline. Un rechazo definitivo inicial exige actualizar/revisar la mesa o cuenta.

La API conserva los precios, totales, ocupación, permisos y controles de concurrencia/idempotencia. No se agregaron endpoints ni migraciones. La demo Debug es ficticia y no contacta el servidor ni modifica el llavero.

El propietario confirmó login y consulta de la versión 0.1.0 en iPhone físico y agregó su Team de Apple. Se conserva en el proyecto y su especificación XcodeGen. La versión de pedidos requiere su propia prueba de operación controlada en dispositivo. No se registraron pedidos de clientes reales para probar ni se configuró TestFlight/App Store.

Pendientes: actualización interactiva de cocina, cobros, tickets, reportes, cambio de restaurante dentro de sesión y administración. Para otro restaurante se cierra sesión y se ingresa con su identificador/cuenta; los pendientes inciertos deben resolverse con su usuario original. También falta auditoría completa de VoiceOver/tamaños extremos y distribución.

En 0.2.1, al seleccionar un producto se muestra su cantidad y el campo etiquetado **Nota para este producto** directamente en el menú. La revisión conserva la nota y muestra precio unitario y subtotal de cada línea; el detalle confirmado también muestra el precio unitario histórico del servidor. Los precios de borrador son una referencia del menú: el servidor confirma los importes.

En 0.2.2 se cierra el teclado al tocar fuera de un campo de notas o con **Ocultar teclado**, conservando el texto. El acceso admite también el gesto exterior. Los logos locales/remotos tienen un área fija, ajuste proporcional y borde contenido; la marca Tavixo admite ancho disponible reducido.

Distribución: `ITSAppUsesNonExemptEncryption = false` en Info.plist y XcodeGen para el uso actual de cifrado del sistema. Debe generarse/subirse un nuevo Archive para que la declaración llegue a App Store Connect; no se realizó ninguna publicación desde esta tarea.
