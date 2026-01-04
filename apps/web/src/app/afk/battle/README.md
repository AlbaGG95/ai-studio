# AFK battle slice (Pixi)

Cómo probar el vertical slice:

1. `pnpm install` (si no lo has hecho) y `pnpm dev` en la raíz.
2. Abre `http://localhost:3000/afk/battle`.
3. Usa **Next stage** para regenerar equipos procedurales y **Velocidad x1/x2** para acelerar el tick del driver. El renderer Pixi consume snapshots/eventos del `CombatEngine` y muestra estado + FX básicos. 
