# Instrucciones para agentes — Tavixo

## Proyecto y fuentes
- Trabajar desde la raíz de este repositorio, no desde la carpeta vacía `Documents/ChatGPT/Tavixo`. Confirmar `git status` antes de editar y conservar cambios del usuario.
- Dirección principal: https://tavixo.nut.com.mx/. El enlace anterior de Birria redirige por HTTPS; conservar su DNS y renovación de certificado.
- Producto: Tavixo, gestión multi-tenant para restaurantes. Pilotos: Birria El Cachanilla (`birria-el-cachanilla`) y Bill-Cochi-Nada (`bill-cochi-nada`), con cuentas y datos independientes. Repositorio: https://github.com/migue19/tavixo.
- Consultar README.md, docs/MANUAL_USUARIO.md, docs/MEJORAS_FUTURAS.md y el resultado de despliegue relevante. Los registros históricos no prueban el estado actual del VPS.
- Comunicarse en español, con lenguaje claro. Completar implementación y validación antes de solicitar permiso para publicarla.

## Arquitectura y contratos
- Monorepo npm: apps/web (Next.js, React, TypeScript, PWA), apps/api (NestJS, Prisma), PostgreSQL. Node 24 recomendado; respetar versiones fijadas y package-lock.json.
- Derivar restaurante y permisos de la membresía autenticada vigente. Validar rol y sucursal en servidor; nunca confiar en tenant, precio, importe o permisos enviados por el navegador.
- Dinero en centavos enteros; reportes por America/Mexico_City. Preservar precios/nombres históricos, auditoría y reconciliación efectivo/tarjeta.
- Conservar transacciones, bloqueo compartido, revisiones esperadas e idempotencia de cobros, rondas, cancelaciones y caja. Cubrir concurrencia si se modifica ese flujo.
- JWT de acceso y refresh rotatorio en cookie segura. No exponer tokens ni secretos en UI, logs, pruebas, documentación ni Git.
- Cargas de archivos: reutilizar `apps/web/app/components/file-upload.tsx` para ofrecer arrastrar y soltar y selección con botón/teclado, manteniendo formatos, límites y validación del servidor.
- PWA requiere conexión para operar. Tarjetas se cobran en terminal externa; Tavixo registra el resultado. Tickets operativos no son CFDI. No prometer offline, integración bancaria o funciones pendientes.
- Marca por restaurante: apps/api/src/branding.ts. Mantener las dos copias del logo local para web/PDF; conservar colores de estados operativos y contraste accesible.

## Desarrollo y verificación
- Hacer cambios acotados, sin reformateos ajenos. Preferir dependencias existentes; justificar y revisar las nuevas. No alterar servicios ni datos de producción para probar.
- Ejecutar comprobaciones proporcionales: npm run typecheck, npm test, npm run test:integration y npm run build según el cambio. Cambios en tenant, dinero o permisos requieren pruebas significativas.
- npm run verify:local usa PostgreSQL temporal, migraciones, seed, pruebas, build y proxy web. Confirmar que 6000/6001 estén libres y cerrar sólo los procesos temporales propios al terminar.
- Revisar cambios visuales en escritorio y celular; comprobar descargas reales y sus importes. No repetir suites ya aprobadas sin cambios o dudas que lo justifiquen.
- Migraciones aditivas, revisables y con preservación de datos. Nunca ejecutar seed que sobrescriba productos, mesas, cuentas, pagos o credenciales reales.

## Producción: aprobación y aislamiento
- No desplegar sin autorización explícita para la actualización concreta. La autorización de una versión anterior no se extiende a la siguiente.
- VPS compartido: raíz /opt/tavixo, proyecto Compose tavixo. API 127.0.0.1:6000; web 127.0.0.1:6001; PostgreSQL privado en Docker sin puerto host.
- Antes de publicar: respaldo validado por índice, copia del código/configuración, imágenes de reversión y referencia de datos/servicios. Nunca imprimir secretos al respaldar.
- Construir antes de sustituir; recrear únicamente API/web de Tavixo. No reiniciar VPS, Docker, PostgreSQL, Nginx u otros servicios para una publicación ordinaria.
- No abrir puertos, cambiar firewall, DNS, certificados o renovación ni modificar otros bloques Nginx sin solicitud y autorización específicas. Tavixo usa HTTPS 443 y renovación DNS-01.
- No usar down -v, podas globales ni borrados de volúmenes. No restaurar un dump ni revertir migraciones destructivamente sin autorización y evaluación de datos/turnos activos.
- Tras publicar: healthchecks, HTTPS, sesión/permisos, función modificada y conservación de datos. Comparar IDs/arranques de servicios protegidos y hashes Nginx. Registrar commit, respaldo, resultados y límites sin credenciales.

## Documentación y Obsidian
- Actualizar manual y documentación afectada. Registrar despliegues en sus archivos de resultados y DEPLOYMENT.md. Diferenciar implementación, publicación y última verificación.
- Bóveda Obsidian: ~/Documents/Development; carpeta Tavixo. Ver docs/OBSIDIAN.md.
- Sincronizar documentación pública mediante `node scripts/sync-obsidian.mjs`. El repositorio es la fuente de verdad de las copias generadas; las notas de seguimiento de Obsidian se editan aparte.
- No copiar .env, contraseñas, claves SSH/API, admin-access.txt, dumps, work, logs privados, node_modules ni archivos de clientes a Obsidian.
- Backlog futuro en espera de solicitud del cliente. No iniciar mejoras no pedidas ni tratar una nota de Obsidian como autorización de despliegue.
