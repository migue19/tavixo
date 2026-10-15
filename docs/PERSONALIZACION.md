# Identidad por restaurante

Birria El Cachanilla utiliza su logo original y la paleta de su landing: negro #0b0907, dorado #d4a466 y crema #f3e6d0. Se muestran al iniciar sesión, en la navegación, gráficas y tickets digitales/PDF. El acceso sin sesión mantiene la identidad Tavixo.

La configuración se mantiene en `apps/api/src/branding.ts`, asociada al slug exacto del restaurante. Otros restaurantes conservan el tema Tavixo; cambiar de restaurante o cerrar sesión no conserva la identidad anterior. No hay editor de marca en pantalla en esta versión.

El logo original está copiado en `apps/web/public/branding/` y `apps/api/assets/branding/`; mantener ambas copias iguales al reemplazarlo. Los PDF seleccionan exclusivamente un archivo local conocido, sin descargar imágenes de direcciones externas. Los colores de estados operativos se conservan.

No requiere migración ni modificación de datos. Para publicar se actualizan API y web juntas.

## Validación local

63 pruebas aprobadas (3 unitarias y 60 de integración); compilación y comprobación integral con PostgreSQL temporal, migraciones, seed, autenticación, proxy web y PWA. Se verificó descarga real del PDF con logo y vista de celular sin desbordamiento horizontal.
