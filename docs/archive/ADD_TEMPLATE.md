# Añadir una nueva plantilla de juego

1) Usar el generador:
```bash
pnpm gen:template <id> <type>
# tipos válidos: idle_rpg | clicker | runner | tower_defense | trivia | platformer_simple | match3
```
Esto crea `/lib/templates/<id>/` con:
- `index.ts`: stub de `GameTemplate` (canHandle + build)
- `spec.example.json`: ejemplo de GameSpec
- `template.test.ts`: checks básicos

2) Registrar la plantilla:
- Agrega el nuevo `TemplateId` al enum en `lib/templates/registry.ts`.
- Añade el template al array `templates` y exporta si aplica.

3) Ajustar build/canHandle:
- Implementa lógica real en `build(spec)` para mapear `GameSpec` -> config/runtime.
- Refina `canHandle(spec)` si hay condiciones adicionales (tema, layout, etc).

4) Opcional: wirear rutas/UI
- Si requiere ruta dedicada, crea página o handler y usa `generated.route` para redirigir.

5) Probar:
- Ejecuta `node lib/templates/<id>/template.test.ts` (o integra en el runner que uses).
- Genera un spec de ejemplo y verifica que `selectTemplate` la escoja.
