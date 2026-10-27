# Configuración de identidad — implementación local

Estado: implementado, pendiente de autorización y publicación. No se modificó producción en esta entrega.

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
