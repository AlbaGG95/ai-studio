# Deploy en Vercel

## Pasos rápidos
1. Requisitos: Node 18+ (Vercel usa 18/20), Corepack activado (pnpm incluido en lockfile).
2. Conectar el repo a Vercel.
3. Ajustar Proyecto en Vercel:
   - Framework: **Next.js**
   - Comando de instalación: `pnpm install`
   - Comando de build: `pnpm --filter web build`
   - Directorio de salida: `.next`
4. Variables de entorno: ninguna obligatoria para web. Opcional:
   - `NEXT_PUBLIC_API_BASE_URL` si el backend corre en otro host/puerto.
5. Deploy: crear un nuevo deploy o “Redeploy” desde la UI de Vercel.

## Comandos locales (entorno limpio)
```bash
corepack enable
corepack pnpm install
corepack pnpm --filter web lint
corepack pnpm --filter web build
```

## Notas
- El endpoint `/api/generate` es serverless-friendly (Next API route) y tiene rate-limit in-memory; para producción con más tráfico, reemplazar con Redis u otro almacén compartido.
- La app asume `pnpm-lock.yaml`; no mezclar npm/yarn para evitar divergencias.
