# Arrastrar y soltar archivos — 27 de octubre de 2026

Estado: implementado localmente; pendiente de autorización de publicación.

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

No se desplegó ni se modificaron servicios del VPS. Una publicación de este cambio requiere sólo reconstruir y actualizar la web de Tavixo, con respaldo y verificaciones del procedimiento habitual.
