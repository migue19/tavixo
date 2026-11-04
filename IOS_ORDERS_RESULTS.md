# iOS 0.2.0 — pedidos y rondas

Fecha: 3 de noviembre de 2026. App SwiftUI para iPhone/iPad, iOS 17+. Desarrollo sobre la API actual, sin cambios de servidor, migraciones, datos, web ni VPS. Conservado el Team que el propietario configuró en Xcode, también en `project.yml`; versión 0.2.0, build 2.

## Entrega

- Desde una mesa activa/libre, tomar un pedido con menú de la sucursal, búsqueda y filtro por categoría. Productos activos/disponibles de categorías activas.
- Agregar cantidades, quitar productos y escribir notas por producto o generales. Revisión separada del menú con estimado; confirmación explícita antes de enviar.
- Desde una cuenta abierta, agregar otra ronda con el total esperado vigente. El servidor conserva autoridad sobre precios, ocupación, estado y permisos.
- Confirmación del número de comanda y total del servidor; actualización local de cuenta/mesa. Detalle de notas de rondas devueltas por la API. Actualización manual de cambios de otros dispositivos.
- Propietario, gerente, caja y mesero; cocina sólo consulta. Sin cobros ni transiciones de cocina nativos todavía.

## Envíos y recuperación

Cada operación iniciada se guarda antes del POST en `mx.com.nut.tavixo.pending-order`, con Keychain `WhenUnlockedThisDeviceOnly`, sin iCloud. Conserva usuario/restaurante/sucursal, UUID, IDs, cantidades, notas y total esperado. No incluye credenciales ni JWT.

POST sin reintento automático. Si la respuesta se pierde, devuelve 5xx, no se interpreta o falla el borrado del pendiente tras éxito, se conserva el mismo UUID/cuerpo para reintento explícito. Se recupera tras cerrar/reabrir o volver a iniciar sesión con el mismo usuario/restaurante. No hay catálogo offline ni cola automática. Borradores no enviados sólo en memoria.

Un pendiente bloquea otro pedido y el cambio de sucursal; sus detalles no se muestran a otra identidad. Un rechazo definitivo del primer intento exige actualizar/revisar antes de crear otra referencia. Si el envío ya era incierto, un rechazo posterior no descarta su referencia: debe resolverse con el acceso original o soporte, comprobando el servidor. No hay borrado indiscriminado que pueda ocultar una comanda recibida.

El compositor captura el contexto inicial; cambios de restaurante/usuario/rol/sucursal impiden enviar desde el borrador anterior. No se permite salir/cambiar sucursal durante el POST ni iniciar dos escrituras simultáneas. Los permisos también se validan siempre en la API.

## Verificación

- 27 pruebas unitarias/de cliente aprobadas. Además de las 15 anteriores: cuerpo sin precios/tenant, referencia/total esperado de rondas, recuperación y reintento exacto tras recrear el store, fallo al persistir antes de enviar, conflicto, identidad ajena, 401 sin replay, rechazo posterior de un envío incierto, cambio de contexto, disponibilidad/límites, envío concurrente, fallo al borrar el pendiente y rol cocina.
- Dos pruebas de interfaz de demo aprobadas en iPhone 17e: navegación inicial y apertura de cuenta con segunda ronda. Sólo datos ficticios, sin pedidos de clientes reales.
- Las mismas dos pruebas de interfaz aprobadas en iPad mini A20 Pro, sin paralelismo; la toma de pedido también verifica escribir una nota por producto y verla en el detalle.
- Compilación Debug de simulador y Release para SDK iPhone aprobadas. Release se compiló sin firma/instalación; no equivale a distribución.
- Capturas reales de simuladores inspeccionadas: `outputs/ios/Tavixo-iPhone-pedido.png`, `Tavixo-iPhone-segunda-ronda.png`, `Tavixo-iPad-pedido.png` y `Tavixo-iPad-segunda-ronda.png`.
- Firma ad hoc local para simulador. La primera ejecución sin acceso a los servicios de Xcode no pudo compilar/descubrir dispositivos; repetida con el acceso local correspondiente. El ejecutor UI del primer intento iPad terminó antes de conectar; repetido sin paralelismo con las 27 pruebas y los dos recorridos aprobados.
- En la repetición adicional dirigida a notas en iPhone y al aislamiento del llavero, la prueba unitaria aislada pasó, pero el recorrido UI no se completó y se detuvo; no se cuenta como otra aprobación de interfaz. La escritura de notas se verificó en iPad; apertura/rondas y navegación ya habían pasado en iPhone. El único cambio posterior a la suite completa es usar almacenamiento ficticio también para el pendiente en la prueba de demo/login.
- No se repitieron pruebas web/API porque su código y sus contratos no cambiaron. No se inició sesión ni se registraron escrituras en producción durante esta implementación.

Registros privados: `work/ios-orders-unit-signed.log`, `work/ios-orders-phone-tests.log`, `work/ios-orders-ipad-tests.log`, `work/ios-orders-ipad-final.log`, `work/ios-orders-device-final.log` y resultados xcresult bajo `work/`.

## Límites y prueba de aceptación

El propietario confirmó login/consulta de 0.1.0 en iPhone físico. La operación de pedidos de 0.2.0 necesita su propia prueba controlada con cuenta autorizada: abrir una mesa, añadir productos/notas, confirmar en la web, agregar una ronda y comprobar su total. Las pruebas interceptadas validan el cliente; la demo no sustituye esa integración real. No se alteró ninguna cuenta o venta para probar.

Sin TestFlight/App Store, cambios de estados de cocina, cobros, tickets o administración nativos. Requiere conexión, no promete servicio sin internet. Revisión completa de VoiceOver/tamaños extremos pendiente. Ver [guía de uso](apps/ios/README.md) y [documentación iOS](docs/IOS.md).
