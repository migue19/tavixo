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


## Corrección 0.2.1 — 4 de noviembre de 2026

A partir de la prueba del propietario en dispositivo: las notas quedaban ocultas hasta abrir la revisión y el resumen no mostraba el precio de cada producto. Ahora cada producto seleccionado presenta su cantidad y un campo con etiqueta persistente **Nota para este producto**, ejemplo y alcance (todas sus unidades del envío), tanto en menú como en revisión. El resumen muestra precio unitario y subtotal por línea; el detalle confirmado muestra también el precio unitario histórico. Los importes del borrador siguen siendo estimados del menú, sin enviarse como precios a la API. Pendientes inciertos mantienen cuerpo/UUID; no se cambia ese flujo.

Versión 0.2.1, build 3. Team y bundle conservados. Sin cambios de API/web/VPS. Prueba dirigida de interfaz: escribir la nota desde el menú, revisar 2 unidades de $120 con subtotal $240, enviar, comprobar nota en detalle y agregar otra ronda. La captura de iPhone inspeccionada muestra $120 de precio unitario, $240 de subtotal y «Sin cebolla». En la primera prueba se comprobaba el importe como texto independiente, pero iOS lo expone como valor de la fila; se añadieron etiquetas/valores explícitos para VoiceOver y se adaptó la prueba. Revalidación dirigida aprobada en iPhone 17e (iOS 27.2): una prueba UI, cero fallos; compilación Debug aprobada. No se repitió la suite de API/sesión porque no cambió ese código. La instalación de esta corrección en iPhone físico queda para el propietario al ejecutar Xcode. Evidencia: `outputs/ios/Tavixo-iPhone-notas-precios.png`; registros privados `work/ios-notes-prices*.log`.


## Corrección 0.2.2 — 4 de noviembre de 2026

Teclado de notas: gesto exterior limitado a la pantalla, sin cancelar los toques de controles ni la edición/selección dentro de campos; botón **Ocultar teclado** y gesto de deslizamiento conservado. El acceso también permite tocar fuera para cerrar el teclado. Sin almacenamiento ni envío de notas añadido: sólo cambia la interacción. Logo de restaurante: tamaño explícito en imagen local y en cada fase remota, aspecto conservado, área interior 54 × 54 y contenedor de 66 × 66 con margen/borde; wordmark Tavixo admite ancho menor al habitual sin desbordar.

Versión 0.2.2, build 4; Team conservado, API/web/VPS intactos. Prueba UI dirigida: escribir nota, ocultar al tocar etiqueta exterior, volver a editar, ocultar con botón, revisar importes, enviar y añadir ronda. Prueba de render con logos ficticios horizontal/vertical/cuadrado para comprobar contenedor, margen y proporciones. Prueba UI de iPhone aprobada: tocar fuera, volver a enfocar, cerrar con botón, conservar nota y completar pedido/ronda. Compilación Debug aprobada. Prueba de render de logos horizontal/vertical/cuadrado aprobada: margen y contenedor correctos, tamaño proporcional con tolerancia de un píxel por redondeo de los bordes. No se repitieron las suites de API/sesión: su código no cambió. Registros privados `work/ios-keyboard-logo.log`, `work/ios-logo-fit-final.log` y `work/ios-keyboard-logo-release.log`. Prueba física de estos ajustes pendiente de instalar el nuevo build.


A petición del propietario se agrega `ITSAppUsesNonExemptEncryption = false` a la fuente XcodeGen y al Info.plist generado. Inspeccionado el cliente: URLSession/Keychain del sistema, sin paquetes Swift de cifrado externos ni implementación propia; declaración conforme a la [documentación de Apple](https://developer.apple.com/documentation/Security/complying-with-encryption-export-regulations). Compilación Release para SDK iPhone aprobada y clave verificada como booleano false en el Info.plist empaquetado (0.2.2, build 4), además del plist fuente. No se archivó/subió a App Store Connect; los builds previos no cambian.
