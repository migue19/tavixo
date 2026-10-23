# Tavixo en Obsidian

Bóveda: `~/Documents/Development`. Índice: [abrir Tavixo](obsidian://open?vault=Development&file=Tavixo%2FTavixo).

Las notas de contexto y seguimiento viven en `Tavixo/`. La documentación pública del repositorio se copia a `Tavixo/Documentación sincronizada/` con origen y fecha. No es sincronización bidireccional ni un servicio automático; el repositorio es la fuente de verdad del código, manual, reglas y registros técnicos. Editar esos originales y ejecutar:

```sh
node scripts/sync-obsidian.mjs
# Otra ubicación de la misma bóveda:
node scripts/sync-obsidian.mjs /ruta/a/Development
```

El script requiere una bóveda existente con `.obsidian`, usa una lista permitida de Markdown público y no borra notas. No copia credenciales, .env, dumps, work ni archivos privados. Las notas de seguimiento se mantienen manualmente y no se sobrescriben.

La fecha de copia no equivale a una nueva verificación de producción. La última publicación verificada al configurar este vínculo fue el 15 de octubre de 2026 (Excel); no se inspeccionó el VPS por crear estas notas.
