# App nativa iOS — primera entrega

Fecha: 2 de noviembre de 2026. Proyecto SwiftUI en `apps/ios/`; bundle provisional `mx.com.nut.tavixo`, versión 0.1.0. Sin despliegues ni cambios de API/web, datos o VPS.

## Alcance implementado

Acceso con cuentas existentes, refresh en Keychain, renovación agrupada, control de errores y cierre de sesión; inicio, selector de sucursal, mesas, comandas abiertas, detalle de productos/notas e historial reciente de consulta. Logo y color principal de restaurante; identidad Tavixo, Manrope local, icono propio y demo Debug identificada con datos ficticios.

App nativa SwiftUI para iPhone/iPad; mínimo declarado iOS 17, verificación en iOS 27.2. Proyecto `.xcodeproj` y especificación XcodeGen incluidos. Tema claro y tamaños tipográficos dinámicos; indicadores se apilan con tamaños de accesibilidad.

## Verificación

- Xcode 27.2, Swift 6.4.2 y XcodeGen 2.46.0.
- Compilación Debug y Release para simulador aprobadas.
- Compilación Release para SDK iPhone físico aprobada con `CODE_SIGNING_ALLOWED=NO`; no es una instalación ni firma para distribución.
- **15 pruebas unitarias/de cliente aprobadas**: contrato de sesión y Origin, secreto persistido, rotación concurrente única, 401/403, reintento de GET limitado, red, logout confirmado, HTTPS, rechazo/limpieza de respuestas rotadas inválidas, fallo de llavero, aislamiento de sucursales, cantidades netas, fuente registrada y bloqueo de demo durante login. Incluye escritura/lectura/rotación/eliminación de Keychain real en un namespace aleatorio, limpiado al terminar.
- **Una prueba de interfaz de demo** recorre mesas, abre comanda, entra a cuenta, sale y comprueba restaurante vacío. Aprobada en iPhone 17e; adaptada al selector de navegación de iPad y aprobada en iPad mini.
- Capturas de simulador de la demo inspeccionadas; ajustados indicadores del inicio para iPhone y colores de estados para lectura. Las capturas usan únicamente datos ficticios.
- Los fallos iniciales fueron registro de fuente en Info.plist y selector del test que suponía barra inferior en iPad; ambos corregidos y revalidados. La prueba real de llavero detectó que desactivar la firma del simulador bloqueaba el almacenamiento: se validó firma ad hoc local (`CODE_SIGN_IDENTITY=-`), sin cuenta ni perfil Apple. Las instrucciones de ejecución conservan esa firma.
- Metadatos de versión 0.1.0 y registro Manrope verificados; binario Release sin datos ni botón de demo. Npm sigue reconociendo únicamente los workspaces API/web; la carpeta Swift no altera las dependencias existentes.

Los tests de red utilizan URLProtocol y datos locales. El endpoint público HTTPS `/api/health` respondió 200 en una comprobación sin autenticación; eso no sustituye una prueba de login real. No se inició sesión con cuentas reales ni se probaron escrituras en producción. No se repitieron suites de backend: no se modificó su código ni contratos.

## Seguridad y límites

Sólo HTTPS, sin redirecciones y sin caché/cookies automáticas. Refresh en Keychain `WhenUnlockedThisDeviceOnly`, sin iCloud; contraseña y JWT de acceso no se persisten. Credencial rotada inválida o no almacenable se descarta con intento de revocación. Cambios de contexto invalidan datos pendientes; se borra la vista de la sucursal anterior antes de cambiar selección. Contenido oculto en segundo plano.

Validación pendiente con una cuenta autorizada de extremo a extremo, Keychain/instalación en dispositivo físico, VoiceOver y tamaños extremos. No hay certificación/auditoría de seguridad ni publicación TestFlight/App Store. Firma/Team Apple no configurados.

Esta entrega es de consulta y actualización manual. Toma de pedidos/rondas, cambio de estados, cobros, tickets, reportes y administración todavía no están en iOS. No hay operaciones offline ni tiempo real. El backend conserva la autoridad sobre precios, pagos, roles y restaurantes.

## Evidencia y siguientes pasos

Registros locales privados: `work/ios-build*.log`, `work/ios-tests-final.log`, `work/ios-ipad-tests-final.log`, `work/ios-device-release-final.log`, `work/ios-keychain-signed-tests.log` y resultados xcresult bajo `work/`. Capturas de entrega en `outputs/ios/`.

Consultar [apps/ios/README.md](apps/ios/README.md) para ejecutar. La siguiente entrega puede incorporar menú/toma de pedidos y rondas reutilizando idempotencia y revisiones de la API, antes de abordar cocina interactiva y cobros.
