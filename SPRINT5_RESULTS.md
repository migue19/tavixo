# Sprint 5 · Cobros en efectivo y tarjeta

Implementado y verificado localmente el 14 de octubre de 2026 (America/Mexico_City). Pendiente autorización específica para desplegar este sprint en el VPS.

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

Sin despliegue durante esta entrega. Antes de actualizar: autorización explícita, respaldo de DB/entorno, imágenes de reversión, migración aditiva y reinicio exclusivo de API/web Tavixo. Preservar los 16 productos/5 categorías y las cuatro mesas reales (4,6,8,4 lugares). No tocar Nginx ni servicios ajenos; no usar pagos reales para verificar el despliegue. Revertir aplicaciones a Sprint 4 conserva los pagos pero deja una interfaz anterior sin registro de cobros: limitar la operación de caja hasta restablecer el Sprint 5.
