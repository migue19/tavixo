# App nativa iOS

Primera entrega SwiftUI del 2 de noviembre de 2026, en `apps/ios/`. Proyecto Xcode, cliente API, sesión segura, consulta de sucursales/mesas/comandas y demo local. No se modificó ni desplegó backend ni web.

[Instrucciones completas](../apps/ios/README.md) · [Proyecto Xcode](../apps/ios/Tavixo.xcodeproj/project.pbxproj) · [Resultados](../IOS_RESULTS.md).

El login usa las cuentas existentes de Tavixo y la API HTTPS actual. Refresh guardado en Keychain, acceso en memoria, solicitudes sin caché, control de rotación y permisos de sucursal. La demo Debug es ficticia y no contacta el servidor.

El alcance inicial es consulta: la toma de pedidos, actualización de cocina, cobros, tickets, reportes, cambio de restaurante dentro de sesión y administración se incorporarán por etapas. Para otro restaurante en esta entrega se cierra sesión y se ingresa con su identificador/cuenta; no se mezclan accesos.

La compilación y las pruebas de simulador no equivalen a validación con cuenta real ni a distribución. Pendientes sesión de extremo a extremo con cuenta autorizada, instalación/firma en dispositivo, revisión completa de accesibilidad y preparación TestFlight/App Store. No se solicitó ni se usó una cuenta de Apple Developer.
