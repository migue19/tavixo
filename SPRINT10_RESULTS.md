# Sprint 10 · Pago mixto en efectivo y tarjeta

Implementado y verificado localmente el 14 de octubre de 2026. Despliegue autorizado explícitamente y completado en el VPS.

## Resultado

- Un cobro por cuenta con partes positivas en efectivo y tarjeta; suma exacta al total, folio de terminal y confirmación de aprobación externa.
- Parte en efectivo derivada del total menos parte en tarjeta; cambio calculado sólo sobre efectivo recibido. receivedCents almacenado/API incluye efectivo recibido más tarjeta; UI y comprobante separan el efectivo recibido.
- Guardado atómico de ambas partes y cierre/liberación de mesa; sin abonos independientes ni procesamiento bancario.
- Roles OWNER/MANAGER/CASHIER y ámbitos existentes. Total esperado, rondas entregadas, idempotencia y bloqueo común con cancelaciones/rondas/cobros preservados.
- Comprobante digital/PDF con desglose y cambio. Cambio de importe con tarjeta/folio/total requiere confirmar aprobación de nuevo en formulario.
- Caja: suma cada parte a su medio y cuenta la cuenta mixta una sola vez; contadores por medio incluyen mixtos. Cortes guardados anteriores permanecen intactos.
- Pagos CASH/CARD existentes y reintentos mantienen su contrato; columnas nuevas opcionales permiten lecturas históricas y escrituras de esos métodos anteriores.

## Verificación

- 50 pruebas aprobadas: 1 de contraseñas y 49 de integración, cero fallos.
- Cobro mixto de $87 con $50 tarjeta / $37 efectivo, $50 efectivo recibido y $13 cambio; un pago, una cuenta cerrada y reintento sin duplicar.
- Comprobante con ambos importes/folio; DB rechaza partes inconsistentes. Importe nulo/fraccionario/cero/excesivo, efectivo insuficiente, folio vacío, campo de parte efectivo impuesto por cliente y roles no autorizados rechazados.
- Registro concurrente idéntico devuelve un pago; reintento con otra parte en tarjeta o segunda referencia rechazado. Contrato de reintentos CASH previo conservado.
- Resumen de venta $87 cuenta una cuenta mixta, $37 neto efectivo y $50 tarjeta; efectivo recibido/cambio correctos. Con fondo $10, corte espera $47 y diferencia cero.
- Migración en dos etapas desde Sprint 9: partes históricas rellenadas en columnas nuevas, importes/fechas/hashes originales y cortes guardados preservados. Regresión completa de autenticación, menú, mesas, rondas, cancelaciones, tickets y caja.

- Typecheck, compilación API/web y ejecución standalone en 127.0.0.1:6000/6001 aprobados, con health/proxy/PostgreSQL/login/refresh y archivos PWA. Compilación web final y revisión visual después de ajustar el desglose.
- Navegador local: cuenta $55 pagada con tarjeta $25 y efectivo neto $30, efectivo recibido $50 y cambio $20; mesa libre y comprobante con ambos importes/folio. Captura `../tavixo-sprint10-mixto.jpg`.
- PDF privado descargado por API, importes/folio extraídos y verificados con pypdf; una página renderizada con Poppler y revisada sin cortes ni superposición. Intermedios en work, sin documentos de producción.
- Caja de la demo: dos cuentas, una mixta; total $113 = $88 efectivo + $25 tarjeta. Corte con fondo $200, esperado/contado $288 y diferencia cero verificado. Ningún pedido/pago/corte de prueba en producción.

## Despliegue y reversión

Requiere autorización específica, respaldo previo e imágenes anteriores. Migraciones 20261014070000_mixed_payments y 20261014071000_mixed_payments. Sin cambios a Compose/Nginx/puertos; actualizar exclusivamente API/web y ejecutar herramienta de migración.

No eliminar enum/columnas ni registros para revertir. Tras registrar MIXED, Sprint 9 desconoce el nuevo método: evaluar/adaptar su lectura antes de regresar a imágenes anteriores. Antes de que existan pagos mixtos, los métodos antiguos siguen compatibles con el esquema ampliado.

## Producción verificada

- Aplicación 796984b desplegada con Node 24 en https://app.birriaelcachanilla.com.mx.
- Respaldo privado `/opt/tavixo/backups/pre-sprint10-20261014T214412Z`: dump validado, fuente, entorno y snapshot. Imágenes de reversión `tavixo-api:pre-sprint10` y `tavixo-web:pre-sprint10` conservadas; no se requirió reversión.
- Ambas migraciones aplicadas correctamente. Partes de pagos históricos rellenadas sólo en columnas nuevas; datos originales de pagos (importes, cambio, fechas, folios y hashes) idénticos.
- Comparación exacta previa/posterior excluyendo únicamente columnas nuevas: productos/categorías, mesas, sucursales, membresías, cuentas, líneas, rondas, eventos, cancelaciones y cortes intactos.
- Sólo API/web recreadas y saludables. PostgreSQL y demás contenedores conservaron IDs y tiempos de arranque; hashes de Nginx iguales. Puertos 6000/6001 ligados a 127.0.0.1 y base privada.
- 43 comprobaciones HTTPS aprobadas: auth/PWA, catálogo/mesas/rondas/cancelaciones, tickets/PDF, caja, partes históricas coherentes y reconocimiento/validación del método MIXED sin escrituras de prueba.
- Navegador público: sesión renovada y módulo Caja y ventas nuevo muestra ventas reales $319 = efectivo $120 + tarjeta $199, dos cuentas cobradas y cero mixtas. Captura `../tavixo-sprint10-produccion.jpg`.
- Sin pagos mixtos, pedidos, cancelaciones ni cortes de prueba en producción. Flujo completo y PDF mixto verificados en demo local aislada.
