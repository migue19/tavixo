# Parche de seguridad — 15 de octubre de 2026

## Cambio

- Next.js: 16.4.0 → **16.4.1**.
- React y React DOM: 19.3.0 → **19.3.1**, manteniendo ambas versiones alineadas.
- Sharp: **0.35.5**, versión instalada y conservada en el lockfile.
- Actualización limitada a las dependencias web y sus paquetes asociados en `package-lock.json`. No cambia el modelo de datos ni requiere migración.

## Referencias oficiales

- [Next.js: ejecución remota en use cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr): versión corregida 16.4.1.
- [Next.js: ejecución remota en optimización de imágenes](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw): Next.js 16.4.1 y Sharp >=0.35.5.
- [React: denegación de servicio en Server Functions](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453): rama corregida 19.3.1 de react-server-dom; Next.js distribuye sus componentes de servidor compilados. Se actualizó también el par React/React DOM de la aplicación.

## Validación

- Instalación: 0 vulnerabilidades reportadas por npm en ese momento.
- `npm run verify:local`: aprobado. 61 pruebas (1 de contraseña y 60 de integración), tipos, compilación, PostgreSQL temporal, migraciones históricas, seed y funcionamiento local de web/API/PWA/autenticación.
- Versiones instaladas confirmadas mediante `npm ls`: Next.js 16.4.1, React/React DOM 19.3.1, Sharp 0.35.5.
- La actualización no representa una auditoría integral del VPS.

## Producción

Desplegado y verificado con autorización del usuario el **15 de octubre de 2026**, código `aab0e3f`.

- Respaldo validado: `/opt/tavixo/backups/pre-security-patch-20261015T150657Z`, con dump PostgreSQL, fuente, entorno e imágenes `tavixo-api:pre-security-patch` y `tavixo-web:pre-security-patch`.
- Imágenes de API y web compiladas con Node 24.22.0. Versiones verificadas dentro de **ambos** contenedores: Next.js 16.4.1, React 19.3.1, React DOM 19.3.1 y Sharp 0.35.5.
- La primera activación revirtió automáticamente por un error del verificador al intentar importar `sharp/package.json`, que no está exportado en Node 24. Se corrigió la lectura de metadatos, se verificaron ambas imágenes sin red y se reaplicaron las mismas imágenes parcheadas; la aplicación y las pruebas funcionales no habían fallado.
- 60 comprobaciones HTTPS aprobadas: TLS, PWA, acceso/renovación/cierre de sesión, catálogo, mesas, cuentas, rondas, tickets/PDF, caja, cancelaciones, pagos mixtos, turnos y reportes. Sin crear ventas ni movimientos de prueba.
- Comparación de todos los registros de restaurantes, usuarios, sucursales, catálogo, mesas, membresías, cuentas, líneas, rondas, eventos, pagos, cancelaciones, cortes, turnos y movimientos: sin cambios. No se ejecutaron migraciones.
- PostgreSQL y los demás contenedores conservaron sus identificadores y fechas de arranque; sólo se actualizaron API/web de Tavixo.
- Archivos Nginx, configuraciones de renovación y archivos del certificado/credencial DNS sin cambios.
- API y web conservan los puertos 6000/6001 publicados sólo en 127.0.0.1 y el usuario no privilegiado `node`. PostgreSQL continúa sin puertos publicados, en una red Docker interna.
- Puerto 80 comprobado desde fuera: bloqueado/filtrado. No se cambiaron reglas del firewall ni el bloque HTTP de Nginx.
- Sesión SSH de mantenimiento cerrada al terminar.
