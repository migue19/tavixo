# Manual de uso de Tavixo

Versión operativa: Sprint 12. Revisión: 15 de octubre de 2026. Dirigido a propietario, gerente, caja, meseros y cocina. Los ejemplos son de capacitación y no deben registrarse como ventas reales.

## 1. Empieza aquí

Acceso de Tavixo: https://tavixo.nut.com.mx/. El enlace anterior de Birria redirige a esta dirección. Tras el cambio debes iniciar sesión de nuevo; si instalaste la PWA anterior, instala la aplicación desde la nueva dirección. Identificador de restaurante: **birria-el-cachanilla**. Escribe tu correo y tu contraseña asignada y pulsa **Entrar a mi restaurante**. Este manual no contiene credenciales.

Usa una cuenta personal por empleado. Al terminar en un equipo compartido, pulsa **Cerrar sesión**. La pestaña **Mi cuenta** permite cambiar tu contraseña; ese cambio cierra tus sesiones y tendrás que entrar nuevamente.

Al entrar a Birria El Cachanilla verás el logo y los colores del restaurante en el encabezado, la navegación, las gráficas y los tickets digitales. La opción seleccionada se distingue con un fondo oscuro y un borde dorado.

Tavixo necesita internet para operar. La instalación como aplicación desde el navegador es opcional: no convierte el sistema en un punto de venta sin conexión. Si aparece un envío pendiente, usa el botón de reintento de ese mismo envío; no abras una segunda cuenta para resolverlo.

El menú se organiza en **Operación**, **Caja y reportes** y **Gestión**, con opciones visibles en varias filas. Para administrar usuarios, abre **Gestión → Equipo**. Las secciones disponibles dependen de tu rol.

## 2. Qué puede hacer cada persona

| Rol | Trabajo principal | Límites importantes |
| --- | --- | --- |
| Propietario | Configurar restaurante, sucursales, equipo, menú y mesas; operar y consultar caja | Puede administrar gerentes; las credenciales se entregan de forma privada |
| Gerente | Administrar la operación y personal operativo; autorizar cancelaciones | No puede otorgar ni editar privilegios de propietario o gerente |
| Caja | Tomar pedidos, registrar entregas y pagos; abrir/cerrar turnos, movimientos y reportes | Opera únicamente su sucursal asignada; no cancela productos ni cuentas |
| Mesero | Abrir cuentas, agregar rondas, registrar entregas y consultar tickets | No registra cobros, cortes, movimientos de caja ni cancelaciones |
| Cocina | Consultar pedidos pendientes y avanzar su preparación | No cobra ni administra la caja |

Los permisos también se validan en el servidor. Ver una pestaña no significa tener permiso para todas sus acciones. Si falta una opción, consulta a tu gerente antes de usar la cuenta de otra persona.

## 3. Preparación por propietario o gerente

1. Revisa **Sucursales** y confirma nombre, dirección y que la sucursal esté activa.
2. En **Menú**, revisa categorías, productos y precios. Un producto puede estar activo pero no disponible: usa la disponibilidad para agotados temporales. Desactiva sólo cuando corresponda retirarlo del catálogo operativo.
3. En **Mesas**, registra nombres, capacidad y estado activo. No cambies una mesa ocupada para intentar liberar su cuenta.
4. En **Equipo**, asigna a cada empleado su rol y sucursal. El propietario administra los accesos de gerente.
5. Haz un ejercicio con las personas que operarán cocina, mesas y caja, en un entorno de capacitación. Las capturas de este manual usan una demo local.

Los cambios de nombre o precio del menú se aplican a pedidos nuevos; las líneas que ya fueron enviadas conservan el nombre y precio con que se registraron. Antes de abrir al público revisa que el menú sea correcto.

## 4. Abre el turno antes de cobrar

1. Entra a **Turnos de caja** y selecciona la sucursal.
2. Cuenta el efectivo que queda como fondo inicial para dar cambio.
3. Captura **Fondo inicial del turno (MXN)** y pulsa **Abrir turno**.
4. Confirma que aparece un turno activo con el fondo correcto.

Existe **una caja compartida por sucursal y un solo turno abierto**. Coordina con otros cajeros para no intentar abrir dos turnos.

Importante: Tavixo permite cobrar aunque no exista un turno abierto. Esos pagos siguen apareciendo en las ventas del día, pero quedan fuera de los turnos; no se asignan después automáticamente. Si quieres conciliar por turno, ábrelo antes del primer cobro.

## 5. Toma una comanda

1. Abre **Comandas** y confirma la sucursal.
2. En **Seleccionar productos**, añade los productos del cliente.
3. En **Destino del pedido**, deja **Nueva cuenta** y elige una mesa libre.
4. Revisa **Cantidad**, **Indicaciones** de cada producto y **Notas de la comanda**. Ejemplo: sin cebolla.
5. Comprueba el total estimado y pulsa **Enviar a cocina**.
6. Confirma que la cuenta aparece entre las cuentas abiertas y la mesa queda ocupada.

Hay una cuenta abierta por mesa. Después de enviarla no se cambia la cantidad original editando el carrito: los productos extra se agregan como ronda y los que se retiran requieren cancelación autorizada.

## 6. Cocina y entrega

La secuencia de una ronda es: **Enviada → En preparación → Lista → Entregada**.

1. Cocina abre la pestaña **Cocina** y selecciona la sucursal.
2. En cada ronda, pulsa **Comenzar preparación** cuando se comience a trabajar.
3. Pulsa **Marcar lista** cuando todos los productos de esa ronda estén listos.
4. El mesero o caja entrega al cliente y pulsa **Registrar entrega** desde la operación de mesas.

Las pantallas de comandas y cocina se actualizan cada cinco segundos cuando hay conexión. Cada ronda avanza por separado; una segunda ronda no debe reenviar la primera ni volver a prepararla.

## 7. Agrega una segunda ronda

1. En la cuenta abierta, pulsa **Agregar productos**; también puedes seleccionar esa cuenta en **Destino del pedido**.
2. Añade únicamente los productos nuevos e indicaciones.
3. Revisa mesa, cuenta y total de la nueva ronda.
4. Pulsa **Enviar nueva ronda a cocina** y confirma que aparece una ronda adicional.
5. Cocina prepara y el mesero entrega esa ronda siguiendo la misma secuencia.

No crees otra cuenta en la misma mesa para una segunda ronda. El total de la cuenta incluye todas las rondas vigentes. Para cobrar, todas deben estar entregadas.

## 8. Cobra en efectivo, tarjeta o mixto

Sólo propietario, gerente y caja pueden registrar cobros. Cuando todas las rondas vigentes estén entregadas, abre la cuenta y pulsa **Cobrar cuenta**.

**Efectivo.** Selecciona **Efectivo**, captura el dinero físico en **Efectivo recibido (MXN)**, revisa el cambio y pulsa **Registrar pago y cerrar cuenta**. Devuelve el cambio mostrado. No captures sólo el consumo si el cliente entregó un billete mayor.

**Tarjeta.** Primero realiza el cobro en la terminal externa y espera su aprobación. En Tavixo elige **Tarjeta · terminal externa**, captura el **Folio de terminal**, marca **Confirmo que la terminal aprobó el pago** y registra el pago. Nunca captures número de tarjeta, NIP ni código de seguridad.

**Mixto.** Elige **Mixto · efectivo y tarjeta**. Captura **Importe con tarjeta (MXN)**; Tavixo calcula el resto en efectivo. Cobra esa parte en la terminal, registra el folio y confirma su aprobación. Captura el efectivo físico recibido, revisa el cambio y registra el pago.

Ejemplo: cuenta $300, tarjeta $100 y efectivo recibido $250. La venta en efectivo es $200 y debes devolver $50. El comprobante separa tarjeta y efectivo; una cuenta mixta sigue siendo una sola cuenta cobrada.

Tavixo registra pagos, **no procesa tarjetas ni se conecta automáticamente a tu banco**. Al confirmar el pago se cierra la cuenta y se libera la mesa. No hay pagos parciales sucesivos ni división de cuenta por comensal en esta versión.

Si se pierde la conexión tras cobrar en terminal, no vuelvas a cobrar la tarjeta. Revisa si Tavixo guardó el registro y usa **Reintentar registro** del mismo envío si aparece pendiente.

## 9. Ticket digital

- **Ver cuenta digital** muestra el consumo y su estado. No acredita que se haya cobrado.
- Después de pagar, **Ver comprobante de pago** permite consultar el registro y descargar su PDF.
- Revisa folio de cuenta, mesa, productos vigentes, importe y método de pago antes de entregarlo.
- Si necesitas compartirlo, descarga el PDF y envíalo desde el medio que tu restaurante autorice. Tavixo no lo envía automáticamente por WhatsApp.

El ticket es un comprobante operativo: **no es una factura fiscal CFDI**. La versión actual no incluye integración con impresora física. Una cuenta histórica cerrada sin pago registrado no genera comprobante de pago.

## 10. Cancela antes de cobrar

Sólo propietario o gerente pueden cancelar. Un mesero o cajero debe solicitar la autorización.

**Por producto:** localiza la línea, pulsa **Cancelar [nombre del producto]**, indica cuántas unidades se cancelan y el motivo, revisa el importe y confirma. Tavixo conserva la cantidad original y el historial, y descuenta únicamente las unidades canceladas del total.

**Cuenta completa:** pulsa **Cancelar comanda**, escribe un motivo y confirma. La cancelación libera la mesa y conserva el historial. Si todos los productos de todas las rondas se cancelan, la cuenta queda cancelada sin registrar pago.

Una vez cobrada la cuenta, esta versión no permite cancelarla ni registrar una devolución automática. No intentes compensarla con una venta falsa o un gasto inventado: documenta el caso y solicita el procedimiento autorizado al propietario.

## 11. Registra retiros y gastos reales

En **Turnos de caja**, con el turno activo, abre **Registrar retiro o gasto**.

1. Elige **Retiro** para efectivo que sale de caja sin ser un gasto operativo, o **Gasto** para una compra/pago real realizado con esa caja.
2. Captura **Importe del movimiento (MXN)** y un **Motivo del movimiento** que permita identificarlo.
3. Pulsa **Guardar movimiento** y revisa que el saldo esperado se actualice.

No registres el mismo desembolso en ambos tipos. El sistema no permite sacar más efectivo del esperado ni editar o borrar un movimiento guardado. Si hay un error, documenta el caso con el propietario: no inventes otro movimiento para ocultarlo.

## 12. Cierra y concilia el turno

1. Termina de registrar cobros y movimientos del turno. Coordina con los demás cajeros para evitar cobros simultáneos al cierre.
2. Pulsa **Actualizar caja** y revisa el resumen.
3. Cuenta todo el efectivo físico, incluido el fondo inicial. No incluyas vouchers de tarjeta como efectivo.
4. En **Cerrar turno**, captura **Efectivo contado al cierre (MXN)** y las notas necesarias.
5. Revisa la diferencia y pulsa **Guardar cierre de turno**.
6. Consulta el resultado en **Turnos cerrados**. Los cierres se conservan como estaban al guardarse y no se reabren.

Efectivo esperado = fondo inicial + ventas netas en efectivo − retiros − gastos. Diferencia = efectivo contado − efectivo esperado. Un resultado positivo es sobrante; uno negativo es faltante.

Ejemplo: fondo $500 + ventas en efectivo $1,200 − retiros $300 − gastos $100 = esperado $1,300. Si cuentas $1,280, el faltante es $20. Los cobros con tarjeta no aumentan el efectivo esperado.

Cerrar un turno no cierra automáticamente las cuentas abiertas. Si se cobra después sin abrir el turno siguiente, ese pago queda sin turno. Si el sistema avisa que hubo cambios, actualiza el resumen, vuelve a comprobarlo y guarda de nuevo.

## 13. Diferencia entre turnos y Caja y ventas

**Turnos de caja** sigue los pagos vinculados a cada turno, junto con fondo, retiros, gastos y cierre. Es la opción para conciliar la caja operativa.

**Caja y ventas** consulta los cobros acumulados desde medianoche, en horario de México, y permite guardar cortes del día. Esos cortes no cierran el turno y su conciliación no incorpora los retiros/gastos del módulo de turnos. No sumes varios cortes del mismo día: son fotografías acumuladas, no períodos independientes.

## 14. Consulta Reportes de ventas

1. Abre **Reportes de ventas** y selecciona la sucursal.
2. Elige **Desde** y **Hasta**, hasta hoy, con un máximo de 366 días inclusive.
3. Consulta ventas cobradas, cantidad de cuentas, ticket promedio y desglose efectivo/tarjeta.
4. Revisa la gráfica de **Ventas por día**, la distribución de efectivo y tarjeta y las barras de los cinco productos más vendidos. Los pagos mixtos se reparten entre los dos métodos.
5. Consulta el día de mayor venta, promedio diario (incluye días sin cobros) y unidades vendidas. Las tablas inferiores conservan los valores exactos. Usa **Actualizar reporte** si necesitas datos más recientes.

La fecha es la del cobro, no la apertura de la cuenta. Se excluyen cuentas sin pago y unidades canceladas. Los pagos mixtos no duplican cuentas. El ticket promedio es venta cobrada dividida entre cuentas cobradas, redondeado a centavos.

El ranking muestra los primeros 50 renglones por unidades y luego por importe; los totales incluyen todos. Usa precios y nombres históricos, por lo que un producto renombrado puede aparecer separado. Las cifras son ventas e ingresos registrados: **no calculan utilidad del restaurante ni costo de alimentos**.

## 15. Si algo no sale como esperabas

| Situación | Qué hacer |
| --- | --- |
| No puedo entrar | Verifica identificador de restaurante y correo. Pide al propietario revisar que tu acceso esté activo. No compartas contraseñas |
| No aparece mi sucursal | Pide revisar la asignación y el estado activo de la sucursal |
| No veo un producto | Revisa búsqueda/categoría. Pide verificar disponibilidad, estado activo y precio |
| La mesa aparece ocupada | Busca su cuenta abierta; no intentes abrir otra encima |
| No aparece Cobrar cuenta | Revisa tu rol y que todas las rondas estén entregadas |
| Envío o pago pendiente | Reintenta el mismo envío; no dupliques pedido ni cobro bancario |
| Faltan cobros en el turno | Confirma si el turno estaba abierto cuando se registraron; compara con el reporte diario |
| El resumen cambió al guardar | Actualiza, revisa nuevamente y vuelve a confirmar |
| Se fue internet | Detén los envíos digitales; usa el procedimiento de contingencia del restaurante y concilia al regresar. No hay sincronización offline automática |

Al reportar una incidencia, informa fecha/hora, sucursal, cuenta, acción y mensaje mostrado. Oculta datos personales y nunca envíes contraseñas, NIP o números de tarjeta.

## 16. Ejercicio de capacitación

En una demo, abre un turno con $500. Crea una cuenta de $300, prepara y entrega sus rondas. Cobra $100 en tarjeta y recibe $250 en efectivo: el cambio debe ser $50 y la venta neta en efectivo $200. Registra un gasto real de prueba de $50. El esperado del turno será $650. Si cuentas $640, el cierre debe mostrar faltante de $10. Comprueba un pago, una mesa libre, ticket por $300 y reporte con una cuenta cobrada.

Este ejercicio requiere productos de prueba que sumen $300 y no debe hacerse en el restaurante productivo. El cajero debe poder explicar la diferencia entre cobro, efectivo recibido, cambio, turno y corte diario antes de operar solo.

## Descargar reportes en Excel

En **Reportes de ventas**, selecciona la sucursal y las fechas. Cuando cargue el reporte, usa **Descargar Excel** en la sección **Descargar reportes**.

El archivo `.xlsx` contiene **Resumen**, **Ventas por día** y **Productos más vendidos**, con importes numéricos en pesos mexicanos y todos los renglones de productos del período. Puedes ordenar y filtrar el detalle en Excel. Incluye las fechas, sucursal y hora de generación.

La descarga vuelve a consultar los cobros al generar el archivo; si hubo una venta nueva después de cargar la pantalla, puede aparecer en el Excel. Actualiza el reporte para comparar. Sólo incluye cuentas cobradas, sin fondo inicial, retiros ni gastos de caja. Disponible para propietario, gerente y cajero; el cajero conserva el acceso limitado a su sucursal.

## Personalizar logo y colores

Con una cuenta de propietario o gerente, abre **Configuración → Identidad del restaurante**. Selecciona un logo PNG/JPG de hasta 512 KB y de 128 a 2048 píxeles por lado. La mejora de arrastrar y soltar está lista localmente, pendiente de publicación: podrás soltar un archivo en **Subir logo** o usar **Seleccionar archivo**. El archivo seleccionado se mostrará con su nombre y peso; no se envía hasta pulsar **Guardar identidad**. Elige un color principal oscuro, un acento y un fondo claro; revisa la vista previa y pulsa **Guardar identidad**. Si el contraste no permite leer bien, el sistema te pedirá ajustar la combinación.

Puedes **Quitar logo** o **Restablecer colores sugeridos**. Los cambios se aplican sólo a este restaurante. La marca aparece en el panel y tickets; el archivo Excel adopta sus colores. Los demás usuarios pueden refrescar la página para ver la nueva identidad.

En el primer acceso puedes elegir **Personalizar ahora** o **Más tarde**. Omitirlo no impide usar Tavixo y puedes volver desde Configuración. La página de acceso mantiene la marca de Tavixo. Meseros, cocina y cajeros no modifican esta configuración.
