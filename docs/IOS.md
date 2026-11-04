# App nativa iOS

Versión **0.2.0 · pedidos y rondas**, 3 de noviembre de 2026. SwiftUI para iPhone/iPad iOS 17+, en `apps/ios/`. No se modificó ni desplegó backend ni web.

[Instrucciones completas](../apps/ios/README.md) · [Proyecto Xcode](../apps/ios/Tavixo.xcodeproj/project.pbxproj) · [Resultados de pedidos](../IOS_ORDERS_RESULTS.md) · [Primera entrega](../IOS_RESULTS.md).

Incluye acceso, restauración/rotación de sesión, sucursales según permisos, consulta de mesas/comandas y ahora **apertura de cuentas y nuevas rondas**. Menú por categorías/búsqueda, cantidades y notas por producto/pedido, revisión antes de enviar y confirmación con el importe del servidor. Propietario, gerente, caja y mesero; cocina continúa sólo con consulta.

JWT en memoria, refresh en Keychain y HTTPS sin redirecciones/caché/cookies compartidas. Los envíos iniciados guardan su UUID/contenido/contexto en un namespace separado del llavero antes de contactar la API. Una respuesta incierta permite reintentar exactamente el mismo envío aunque se cierre la app; no se repiten POST automáticamente. No se permite otro pedido hasta resolverlo. Los detalles sólo se recuperan para el mismo usuario y restaurante; no es operación offline. Un rechazo definitivo inicial exige actualizar/revisar la mesa o cuenta.

La API conserva los precios, totales, ocupación, permisos y controles de concurrencia/idempotencia. No se agregaron endpoints ni migraciones. La demo Debug es ficticia y no contacta el servidor ni modifica el llavero.

El propietario confirmó login y consulta de la versión 0.1.0 en iPhone físico y agregó su Team de Apple. Se conserva en el proyecto y su especificación XcodeGen. La versión de pedidos requiere su propia prueba de operación controlada en dispositivo. No se registraron pedidos de clientes reales para probar ni se configuró TestFlight/App Store.

Pendientes: actualización interactiva de cocina, cobros, tickets, reportes, cambio de restaurante dentro de sesión y administración. Para otro restaurante se cierra sesión y se ingresa con su identificador/cuenta; los pendientes inciertos deben resolverse con su usuario original. También falta auditoría completa de VoiceOver/tamaños extremos y distribución.
