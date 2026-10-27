# Nombre y propósito en la página de acceso — 27 de octubre de 2026

Estado: implementado localmente, pendiente de autorización de publicación.

Se incorpora `BrandStory` debajo del formulario de acceso, con enlace desde la portada. Incluye explicación del nombre Tavixo como marca creada, relación de la X con los cuatro frentes de operación y objetivo de orden, visibilidad y confianza desde la comanda hasta el cierre. Sigue el relato ya incluido en la guía, sin atribuir una etimología.

La sección tiene título/etiqueta accesibles, dos tarjetas con tipografía y paleta aprobadas, y se apila en una columna en móvil. Se muestra únicamente con sesión resuelta y sin usuario autenticado; no se agrega contenido comercial al panel operativo. No cambia login, permisos ni datos.

Verificación: `npm run typecheck -w @tavixo/web`, `npm run build -w @tavixo/web` y `git diff --check` aprobados. Se revisaron el guard de sesión, enlace/ID de destino y reglas responsivas. No se repitieron pruebas API/BD por ser un cambio de contenido e interfaz. Pendiente revisión interactiva de scroll, escritorio y móvil; no hay control de navegador disponible en esta sesión.

No se desplegó. La publicación requiere sólo reconstruir/recrear web de Tavixo, con respaldo y comprobaciones habituales; API, base de datos e infraestructura no requieren cambios.
