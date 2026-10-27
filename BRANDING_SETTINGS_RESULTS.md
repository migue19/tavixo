# Configuración de identidad — implementación local

Estado: publicado con autorización explícita el 26 de octubre de 2026. Código desplegado: `85ab8659daecb69b49beee77053ab06ce4bb7d39`.

## Función

- Configuración por restaurante para propietario/gerente: PNG/JPG, paleta, previsualización, conservar/reemplazar/quitar logo y restablecer colores sugeridos.
- Invitación inicial opcional antes de la navegación, con decisión de omitir persistida. No bloquea comandas ni caja; los roles operativos no editan la marca.
- Marca sugerida de Bill-Cochi-Nada: mascota original extraída del PDF entregado por el usuario, verde oscuro y crema. No se generó otro logo. Birria conserva negro/dorado y queda fuera de la invitación inicial.
- Marca aplicada a sesión/panel, tickets y paleta del Excel. No cambia el acceso público sin sesión ni procesa pagos.

## Validación

- 67 pruebas aprobadas: 3 unitarias y 64 de integración. Compilación, tipos, migraciones/seed repetibles, proxy y PWA aprobados con PostgreSQL temporal.
- Nuevos casos: guardado real de imagen y colores, estado inicial persistente, quitar/conservar logo, roles, tenant, campos ajenos, imagen falsa/pequeña/grande, contraste insuficiente y marca en PDF/sesión.
- 13 comprobaciones adicionales con demo local: multipart con el logo real, primera configuración, persistencia en refresh, Excel con paleta guardada, PDF con logo embebido y apariencia previa de Birria conservada.
- PDF de muestra renderizado e inspeccionado: logo completo, importes, referencias y paginación legibles.
- El formulario dispone de CSS para escritorio y celular. La revisión visual en un navegador sigue pendiente porque la herramienta de control del navegador no está disponible en esta sesión; no se declara como completada.
- No se crearon órdenes o cobros en producción para probar la función.

## Publicación

Migración aditiva `20261026000000_restaurant_branding`: JSON de identidad y bandera para omitir la invitación. El logo normalizado se conserva en PostgreSQL, con los respaldos de datos. Sin nuevos volúmenes, puertos ni servicios.

Sharp 0.35.5 explícito en API; Multer 2.5.0 y body-parser 2.4.0 fijados para incorporar sus correcciones. La instalación reporta cero vulnerabilidades conocidas.

Antes de publicar: autorización específica, respaldo e imágenes de reversión, migración aditiva y actualización exclusiva de API/web. Después: verificar ambos pilotos, permisos, archivo subido, sesión, ticket y Excel. No eliminar configuración ni restaurar dumps como reversión automática. Ver docs/PERSONALIZACION.md.

## Resultado de publicación

- Respaldo privado `/opt/tavixo/backups/pre-brand-settings-20261027T013058Z` (fecha del nombre en UTC), con dump e índice validado, código/configuración anterior, inventarios y hashes. No se probó una restauración.
- Imágenes de reversión `tavixo-api:rollback-20261027T013058Z` y `tavixo-web:rollback-20261027T013058Z`.
- Migración aditiva aplicada correctamente mediante el contenedor de herramientas. Sin seed ni carga de datos de negocio.
- Sólo API/web recreadas, ambas saludables. PostgreSQL y todos los demás contenedores conservaron IDs y arranques; .env, Nginx y configuraciones de renovación conservaron sus hashes. No se cambiaron DNS, certificados, firewall ni puertos.
- 40 comprobaciones HTTPS aprobadas en los dos pilotos: lectura de configuración, paletas independientes, logos, estados iniciales, sesiones, Excel y PDF, rechazo de colores inválidos sin alterar identidad, autenticación e imposibilidad de leer Birria desde Bill-Cochi-Nada.
- Catálogos, categorías, mesas y cuentas con hashes idénticos antes/después: Birria 5 categorías, 16 productos, 4 mesas y 6 cuentas; Bill-Cochi-Nada 5 categorías, 30 productos, 3 mesas y 0 cuentas.
- Nueva invitación inicial disponible para Alex; Birria no vuelve a recibirla. No se guardó una configuración ficticia ni se omitió la invitación en producción para probar.
- Recursos web públicos comprobados: contienen el formulario y la guía inicial de esta versión. Esto no sustituye la revisión visual del formulario en navegador, que sigue pendiente de revisión humana.
- La carga válida real y persistencia de imagen se verificaron en la demo local; en producción se verificaron lectura, parámetros, paletas y rechazo de una edición inválida, sin modificar las preferencias de los clientes.
- El chequeo de aislamiento usa el token nuevo tras refresh: los tokens anteriores se revocan correctamente y no deben usarse para concluir que existe acceso cruzado.
