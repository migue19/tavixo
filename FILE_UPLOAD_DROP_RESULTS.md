# Arrastrar y soltar archivos — 27 de octubre de 2026

Estado: publicado con autorización el 27 de octubre de 2026 en https://tavixo.nut.com.mx/. Versión de código `a758288`.

## Alcance

La revisión de las entradas `type="file"` y usos de FormData de la web encontró una sola carga de archivos actual: el logo en **Configuración → Identidad del restaurante**. Los demás formularios envían datos, sin archivos.

El componente compartido `apps/web/app/components/file-upload.tsx` ofrece zona de arrastre con resaltado, botón de selección accesible por teclado y móvil, descripción de requisitos y anuncio del nombre/peso del archivo pendiente. No envía automáticamente. Conserva vista previa y guardado explícito del editor.

La selección por botón y por arrastre usa la misma validación de formato/peso. Rechaza varios archivos; limpia el archivo pendiente ante una selección inválida. Impide navegar al archivo soltado y bloquea la selección durante guardado o sin conexión. Reinicia el selector tras elegir para poder seleccionar otra vez el mismo archivo. Las dimensiones y el contenido se siguen validando en el servidor.

El componente recibe formatos, peso máximo y mensajes como parámetros para próximas cargas. AGENTS.md registra su reutilización como convención del proyecto.

## Verificación y límites

- `npm run typecheck -w @tavixo/web`: aprobado.
- `npm run build -w @tavixo/web`: aprobado.
- `git diff --check`: aprobado.
- Cambio exclusivo de interfaz y documentación; sin cambios API, base de datos, permisos ni dependencias. No se repitieron las pruebas de integración de servidor ya aprobadas para la versión previa.
- Inspección estática de selección/arrastre, estado deshabilitado, rechazo múltiple, reinicio del input, foco, nombre largo, vista previa y guardado.
- Pendiente comprobación interactiva de arrastre real, teclado y vista escritorio/móvil: no hay herramienta de control de navegador disponible en esta sesión. No se presentan las comprobaciones estáticas como una prueba interactiva.

## Publicación

Se reconstruyó y actualizó únicamente la web de Tavixo, con respaldo previo e imagen de reversión. No se ejecutaron migraciones ni seed.

- Respaldo: `/opt/tavixo/backups/pre-file-drop-20261027T224416Z`; dump validado por índice, sin prueba de restauración.
- Imagen de reversión: `tavixo-web:rollback-20261027T224416Z`.
- Web saludable; API, PostgreSQL y todos los demás contenedores conservaron IDs y tiempos de inicio.
- `.env`, hashes de Nginx y renovación TLS idénticos antes/después; sin cambios de DNS o firewall.
- Recuentos y huellas de todas las tablas públicas, excepto sesiones temporales `RefreshSession`, idénticos antes/después.
- 42 comprobaciones HTTPS aprobadas: ambos pilotos, identidad/onboarding conservados, sesión/refresh, aislamiento, catálogo/mesas/cuentas, Excel, PDF y redirección histórica.
- 10 comprobaciones de los archivos JS/CSS servidos aprobadas: textos y estados de la zona de carga, estilos y login genérico. Estas comprobaciones no simulan un gesto de arrastre.
- La prueba interactiva real de arrastre, teclado y vista escritorio/móvil sigue pendiente por falta de control de navegador en esta sesión.

Los archivos del cliente y la guía de marca en preparación, sin seguimiento de Git, quedaron fuera del despliegue. Documentación actualizada en GitHub y sincronizada con Obsidian.
