# Nombre y propósito en la página de acceso — 27 de octubre de 2026

Estado: publicado con autorización el 27 de octubre de 2026 en https://tavixo.nut.com.mx/. Versión de código `1458a58`.

Se incorpora `BrandStory` debajo del formulario de acceso, con enlace desde la portada. Incluye explicación del nombre Tavixo como marca creada, relación de la X con los cuatro frentes de operación y objetivo de orden, visibilidad y confianza desde la comanda hasta el cierre. Sigue el relato ya incluido en la guía, sin atribuir una etimología.

La sección tiene título/etiqueta accesibles, dos tarjetas con tipografía y paleta aprobadas, y se apila en una columna en móvil. Se muestra únicamente con sesión resuelta y sin usuario autenticado; no se agrega contenido comercial al panel operativo. No cambia login, permisos ni datos.

Verificación: `npm run typecheck -w @tavixo/web`, `npm run build -w @tavixo/web` y `git diff --check` aprobados. Se revisaron el guard de sesión, enlace/ID de destino y reglas responsivas. No se repitieron pruebas API/BD por ser un cambio de contenido e interfaz. Pendiente revisión interactiva de scroll, escritorio y móvil; no hay control de navegador disponible en esta sesión.

## Publicación y comprobaciones

- Respaldo `/opt/tavixo/backups/pre-brand-story-page-20261027T235205Z`, dump validado por índice; sin ensayo de restauración.
- Reversión: `tavixo-web:rollback-20261027T235205Z`.
- Sólo web reconstruida y recreada; saludable. API, PostgreSQL y otros contenedores conservaron IDs y tiempos de inicio.
- `.env`, hashes Nginx y renovación TLS idénticos; sin acciones sobre DNS, firewall ni certificados.
- Huellas y recuentos de tablas públicas, excepto sesiones temporales `RefreshSession`, idénticos antes/después.
- 42 comprobaciones HTTPS de pilotos aprobadas: login/refresh, permisos, aislamiento, identidades, catálogo/mesas/cuentas, Excel/PDF y redirección histórica.
- 45 comprobaciones HTTPS de marca/contenido aprobadas: activos aprobados, metadatos, paleta, fuente, iconos y nueva sección con explicación del nombre, objetivo, cuatro partes de operación, enlace y destino y estilos servidos.

Las comprobaciones de textos de la sección corresponden al JavaScript servido; no prueban por sí solas el render del cliente, desplazamiento ni la vista móvil. La revisión interactiva descrita arriba continúa pendiente.

Registros privados: `work/brand-story-before.log`, `work/brand-story-after.log` y `work/brand-story-live-results.json`.
