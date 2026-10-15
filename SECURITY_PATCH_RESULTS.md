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

Despliegue autorizado por el usuario, pendiente de verificación en producción.
