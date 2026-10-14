# Sprint 6 · Tickets digitales

Implementado y verificado localmente el 14 de octubre de 2026 (America/Mexico_City). El usuario eligió ticket digital; impresión física queda pendiente. Despliegue pendiente de autorización específica.

## Resultado

- Vista previa de cuenta y comprobante de pago desde Comandas, con descarga PDF.
- Cuenta pendiente claramente diferenciada de pago registrado. Cerrada sin pago del Sprint 4 identificada como historial anterior; no se emite comprobante sin pago ni para canceladas.
- Productos/cantidades/precios/total tomados de las líneas guardadas; comprobante con método, importe, recibido/cambio o folio de terminal, actor y fecha.
- Datos leídos en transacción RepeatableRead, sin alterar estados, eventos o pagos.
- Acceso OWNER/MANAGER/CASHIER/WAITER; KITCHEN rechazado. Aislamiento de sucursal/restaurante y validación de UUID/tipo de ticket.
- PDF generado en memoria y descargado con sesión vigente, content-type correcto, attachment y no-store. Sin tokens en URL, vínculos públicos, envíos externos ni archivos privados persistentes en servidor.
- Fuentes Liberation Sans incluidas para conservar apariencia y acentos; licencia OFL incluida en el repositorio. Formato compacto, productos sin dividirse entre páginas y páginas numeradas.
- No requiere nuevas migraciones ni modifica los modelos de cuentas/pagos.

## Verificación

- **30 pruebas aprobadas:** 1 de contraseñas y 29 de integración, cero fallos.
- Regresión completa de autenticación, equipo, catálogo, comandas y cobros.
- Cuenta sin pago devuelve vista previa y rechaza comprobante; cobro correcto habilita el comprobante con importes/folio auténticos.
- Precios y nombres de ticket permanecen correctos después de editar el menú.
- Descarga no altera el Order, sus eventos ni Payment; firma/header/final PDF y headers de attachment/no-store verificados.
- Rechazo sin sesión, de Cocina, de otra sucursal/restaurante, de tipo desconocido/campos extra y de tickets cancelados/recibos históricos sin pago.
- Documento largo paginado probado por API; comprobación adicional de 100 productos, acentos y total con pypdf. Render de primera/última página con Poppler revisado visualmente; 13 páginas, líneas completas y numeración correcta.
- Typecheck, build de API/web y ejecución standalone con health/proxy/PWA/login/refresh aprobados en 127.0.0.1:6000/6001.
- Navegador local: vista previa de cuenta de $58, descarga del PDF, cobro ficticio con $100 y cambio $42, vista previa del comprobante y descarga. PDF final con dos fuentes incrustadas verificado y render revisado sin texto cortado ni superpuesto.
- Captura de la demo `../tavixo-sprint6-ticket-digital.jpg`. PDFs de QA y cuentas de prueba locales, sin pedidos/pagos de prueba en producción.

## Límites y despliegue

Ticket digital privado para descarga manual. Sin impresoras físicas, impresión silenciosa, QR público, envío automático, datos fiscales o comprobante bancario. Fechas en America/Mexico_City. No se registra contador de descargas ni se asegura recepción por un cliente.

Antes de desplegar: autorización explícita, respaldo de DB/entorno, conservar imágenes de Sprint 5 para reversión y reiniciar sólo API/web Tavixo. Sin migración nueva. Verificar conservación de productos, cuatro mesas, cuentas/pagos/eventos y demás servicios del VPS, y descargar un ticket existente sin modificar su estado. No registrar cobros de prueba reales.
