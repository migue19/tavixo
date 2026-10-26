# Segundo piloto — Bill-Cochi-Nada

Registrado el 26 de octubre de 2026 por solicitud expresa del propietario de Tavixo.

## Alta

- Restaurante independiente: Bill-Cochi-Nada; identificador `bill-cochi-nada`.
- Una sucursal principal, una cuenta exclusiva con rol propietario y una única membresía en ese restaurante.
- 5 categorías, 30 productos y 3 mesas de 4 lugares (12 lugares).
- Catálogo preparado a partir del menú PDF entregado por el usuario y revisado visualmente en sus dos páginas. Baguete se listaba dos veces al mismo precio: se cargó una sola vez; confirmar si el restaurante necesita variantes distintas.
- Sin domicilio deducido de la fotografía ni ventas, pagos, rondas o turnos ficticios. El piloto comienza sin cuentas.
- Registro transaccional con Prisma Serializable: no se reutilizaron usuarios ni se cambiaron contraseñas anteriores. El identificador de correo pertenece sólo a la cuenta del sistema; no se aprovisionó un buzón.
- Accesos entregados por archivo local privado, fuera de Git y Obsidian. No incorporar correos, contraseñas, hashes de acceso ni archivos privados de provisión a esta documentación.

## Comprobación

25 comprobaciones HTTPS aprobadas: login independiente, IDs de usuario/restaurante distintos, membresía única, catálogo y precios esperados, 3 mesas de 4 lugares, ausencia de órdenes ficticias y atributos seguros de cookie. Se rechazaron consultas de productos/mesas/cuentas de Birria, cambio de restaurante e inicio de sesión de la cuenta nueva en Birria. La cuenta anterior tampoco tiene acceso automático al nuevo piloto.

Catálogo, mesas y cuentas de Birria con hashes idénticos antes/después. Los contenedores conservaron IDs y tiempos de arranque. Sin reinicios, despliegues de código, cambios de Nginx, DNS, certificados ni migraciones por esta alta.

## Respaldo

`/opt/tavixo/backups/pre-bill-pilot-20261026T181929Z`, dump con índice validado e inventarios antes/después. No se probó restauración. No borrar el nuevo restaurante ni restaurar un dump como reversión automática: podría contener operaciones reales posteriores.

## Pendientes del piloto

- Sustituir los datos de contacto temporales por los reales al aceptar el cliente; no reutilizar una cuenta de Birria.
- Cambiar la contraseña antes de entregar el acceso definitivo.
- Confirmar domicilio y si el Baguete representa uno o dos productos.
- La identidad visual personalizada de este segundo restaurante no se desplegó en esta alta; usa el tema Tavixo genérico.
