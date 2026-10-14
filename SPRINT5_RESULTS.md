# Sprint 5 · Cobros en efectivo y tarjeta

Implementado y verificado localmente el 14 de octubre de 2026 (America/Mexico_City). Despliegue autorizado explícitamente y completado en el VPS.

## Resultado

- Cobro de cuentas entregadas por OWNER/MANAGER/CASHIER; meseros y cocina sin permiso de cobro.
- Efectivo: captura de importe recibido, cambio calculado por servidor, resumen del pago con actor/fecha.
- Tarjeta: registro de pago aprobado en terminal externa, total exacto, folio obligatorio, sin cambio. No conecta ni cobra a bancos; no solicita datos de tarjeta.
- Pago + evento de cierre + liberación de mesa en una transacción. El cierre directo del Sprint 4 se rechaza.
- Una cuenta, un pago; protección de reintentos con UUID y hash de cuerpo. Solicitudes simultáneas no generan dos pagos.
- Registro pendiente conservado en sessionStorage sin tokens. Interfaz solicita reintentar el mismo registro, sin volver a cobrar al cliente.
- Resumen del pago en el historial, con método, total, recibido, cambio, folio, actor y fecha.
- Las cuentas cerradas anteriores conservan sus datos y aparecen como «cerradas sin pago registrado»; no se crean pagos ficticios al migrar.
- Migración aditiva `20261014030000_payments`, con claves de restaurante/sucursal/cuenta y restricciones de importes/método en PostgreSQL.

## Verificación

- **27 pruebas aprobadas:** 1 de contraseñas y 26 de integración; cero fallos.
- Regresión completa de autenticación, roles, sucursales, equipo, catálogo, comandas y cocina.
- Efectivo: total 8700 centavos, recibido 10000, cambio 1300, cierre y liberación; reintento devuelve el mismo pago sin otro evento.
- Tarjeta: folio obligatorio, importe exacto, cambio cero y cancelación de cuenta pagada rechazada.
- Rechazo de cantidades negativas/decimales/null/cadenas/fuera de rango, efectivo insuficiente, total obsoleto, importe impuesto por cliente, folio improcedente y cuentas sin entregar o canceladas.
- Permisos de caja/administración y aislamiento de restaurante/sucursal, incluyendo reuso de una referencia para otra cuenta.
- Concurrencia: misma referencia produce un solo pago; dos referencias para una cuenta producen un éxito y un conflicto.
- Restricciones directas en DB: cambio inconsistente y vínculo con otro restaurante rechazados.
- Migración desde Sprint 4 preserva cuentas entregadas/cerradas, líneas y precios, sin generar pagos; también conserva credenciales/roles/sesiones del Sprint 1 y catálogo del Sprint 3.
- Typecheck, compilación de API/web y ejecución standalone en 127.0.0.1:6000/6001 aprobados. Proxy, health, assets PWA, login piloto, refresh y seed repetible correctos.
- Navegador local: cuenta de $58 registrada con efectivo de $100, cambio de $42; cuenta de $55 con folio ficticio DEMO-123. Ambas cerradas, mesas libres y resúmenes persistentes en historial. Captura `../tavixo-sprint5-cobros.jpg`.
- Todos los datos de la demo viven en una base temporal local. No se registraron cobros ni pedidos en producción.

## Límites y despliegue

Registro completo por cuenta en MXN. Sin pagos mixtos, abonos, propinas, descuentos, devoluciones, cortes de caja, facturación, impresión ni procesamiento bancario. Para tarjeta, la confirmación de autorización proviene del operador de la terminal externa.

Despliegue completado:

- Código de aplicación `0ae2000860944118f0ec6418be00750f21106167`, construido con Node 24 en Ubuntu 24.04.
- Respaldo privado `/opt/tavixo/backups/pre-sprint5-20261014T135132Z`: DB validada con listado pg_restore, fuente/entorno y snapshot de catálogo/cuentas. No se realizó restauración.
- Imágenes de reversión `tavixo-api:pre-sprint5` y `tavixo-web:pre-sprint5`, con override en el respaldo; no fue necesario revertir.
- Migración `20261014030000_payments` aplicada. Sólo API/web de Tavixo recreadas; ambas saludables.
- Comparación antes/después conserva exactamente productos, categorías, mesas, sucursales, membresías, cuenta existente, líneas y eventos. Cero pagos creados por la migración.
- Los 16 productos/5 categorías y cuatro mesas (4,6,8,4 lugares) siguen intactos. La cuenta previa sigue cerrada sin pago registrado y se identifica como historial anterior.
- PostgreSQL de Tavixo y demás contenedores conservaron IDs/tiempos de arranque; hashes de Nginx sin cambios.
- **22 comprobaciones públicas HTTPS aprobadas**: página/health/PWA, login/cookie segura, restaurante/sucursal, productos/precios/categorías, cuatro mesas, cuentas con resumen de pago, rechazo de cobro incompleto, acceso sin sesión, refresh/logout/revocación.
- Revisión en navegador público: Comandas carga menú y mesas; historial muestra la cuenta anterior y su condición sin pago registrado. Captura `../tavixo-sprint5-produccion.jpg`. No se enviaron pedidos ni pagos de prueba a producción.

Revertir aplicaciones a Sprint 4 conserva los pagos, pero deja una interfaz anterior sin registro de cobros: limitar la operación de caja hasta restablecer el Sprint 5.
