# AI Studio - Contratos tecnicos minimos (v1)

Este documento deriva de `ai-studio-platform.md` y define los contratos ejecutables minimos del sistema. Su objetivo es permitir validacion automatica y orquestacion reproducible. Todo cambio en estos contratos debe versionarse.

## 1) GameSpec v1 (contrato formal)
Rol: entrada canonica para generacion. Debe ser validable de forma automatica.

Formato y versionado:
- Formato: JSON.
- Version de contrato: v1 (definida por el schema activo).
- Schema canonico: `packages/core/spec/gamespec.schema.json`.

### Estructura obligatoria (nivel 1)
- `meta` (obligatorio)
- `engine` (obligatorio)
- `systems` (obligatorio)
- `content` (obligatorio)
- `ui` (obligatorio)
- `balance` (obligatorio)

### Definicion de campos y restricciones
`meta`
- `name`: string, 1-100 chars.
- `version`: semver `x.y.z`.
- `language`: enum `["en", "es"]`.
- `description`: string, max 500 (opcional).
- `seed`: integer >= 0 (opcional, determinista).

`engine`
- `templateId`: enum `["idle-rpg-base"]`.

`systems`
- `idleLoop.tickMs`: integer 100-10000.
- `idleLoop.baseIncome`: number 0.1-1000.
- `combat.auto`: boolean.
- `combat.damageFormula`: enum `["linear", "scaling", "exponential"]`.
- `progression.levels`: integer 10-200.
- `progression.scaling`: enum `["linear", "quadratic", "exponential"]`.
- `inventory.enabled`: boolean.
- `inventory.maxSlots`: integer 5-200 (default 20).

`content`
- `heroes`: array min 1.
  - `id`: string min 1.
  - `name`: string 1-50.
  - `description`: string max 200 (opcional).
  - `hp`: integer min 1.
  - `atk`: integer min 1.
  - `def`: integer min 0.
- `enemies`: array min 1.
  - `id`: string min 1.
  - `name`: string 1-50.
  - `hp`: integer min 1.
  - `atk`: integer min 1.
  - `goldReward`: integer min 1.
- `stages`: array min 1.
  - `id`: string min 1.
  - `name`: string 1-50.
  - `level`: integer min 1.
  - `enemies`: array min 1 de ids de `enemies`.
- `items`: array min 0.
  - `id`: string min 1.
  - `name`: string 1-50.
  - `rarity`: enum `["common", "rare", "epic", "legendary"]`.
  - `stats`: opcional con `atk/def/hp` integers min 0.

`ui`
- `screens`: array min 1.
  - `id`: enum `["home", "battle", "inventory", "heroes"]`.
  - `name`: string min 1.
  - `enabled`: boolean (default true).

`balance`
- `goldPerSecond`: number 0.1-10000.
- `enemyHPScaling`: number 1-5.

### Reglas de integridad adicionales (obligatorias para validacion)
- Todos los `id` deben ser unicos dentro de su lista.
- `stages[].enemies[]` debe referenciar ids existentes en `content.enemies`.
- No se permiten campos desconocidos en ningun nivel (modo estricto).
- El spec debe ser determinista: no se aceptan campos aleatorios no controlados.

## 2) Feature Manifest v1 (salida de IA)
Rol: describe exactamente lo que un modulo generado expone/consume y que archivos produce. Permite integracion segura.

Formato y versionado:
- Formato: JSON.
- Version de contrato: "1.0".

### Estructura minima
```yaml
version: "1.0"
module:
  id: "string"                # kebab-case, unico
  name: "string"
  kind: "system|renderer|ui"
  entry: "path/entry.ts"
  templateId: "idle-rpg-base"
provides:
  events: ["string"]
  state: ["path.like.this"]
  commands: ["string"]
consumes:
  events: ["string"]
  state: ["path.like.this"]
  commands: ["string"]
files:
  - path: "relative/path.ts"
    role: "logic|render|ui|asset"
    sha256: "hex"
assets:
  - id: "string"
    type: "image|audio|data"
    path: "relative/path.png"
    sha256: "hex"
    sizeBytes: 1234
constraints:
  maxBundleKb: 512
  maxTickMs: 5
```

### Reglas de integracion
- `module.id` debe ser unico en el proyecto.
- `files[].path` y `assets[].path` solo pueden existir dentro del directorio permitido del modulo.
- No se permite modificar archivos fuera de los paths declarados.
- `provides` y `consumes` deben resolverse sin ciclos y con dependencias satisfechas.
- Toda dependencia externa debe estar en allowlist del sistema o el manifest es rechazado.

## 3) Runtime Contract minimo
Rol: define el ciclo de vida y las fronteras de ejecucion de modulos.

### Ciclo de vida
Orden y reglas:
1. `init(ctx)`: registra handlers y valida configuracion. No muta estado.
2. `start(ctx)`: establece estado inicial permitido.
3. `tick(ctx, dtMs)`: actualizacion determinista por frame/tick.
4. `stop(ctx)`: pausa y libera timers propios.
5. `dispose(ctx)`: libera recursos.

### Comunicacion entre sistemas
- `StateStore`: unico punto de verdad. Mutaciones solo via acciones declaradas.
- `EventBus`: pub/sub tipado. Emisiones deben estar declaradas en `provides.events`.
- `Commands`: intenciones de UI o input. Un modulo solo consume comandos declarados.

### Contexto de ejecucion minimo
- `spec`: GameSpec validado (solo lectura).
- `state`: API de lectura/escritura por slices declarados.
- `events`: API de emision/suscripcion.
- `rng`: generador determinista con seed del build.
- `clock`: tiempo monotono controlado por el runtime.
- `logger`: salida controlada.

### Restricciones para modulos generados por IA
Permitido:
- Computo determinista y puro respecto a `spec` + `state`.
- Lectura de assets declarados en el manifest.
- Emision de eventos y comandos declarados.

Prohibido:
- Acceso directo a red, filesystem o DOM.
- `eval`, `Function`, `import()` dinamico.
- Crear dependencias no declaradas o modificar el core.
- Acceso a RNG global fuera de `ctx.rng`.
- Escritura de estado fuera de slices declarados.

## 4) Pipeline de validacion tecnica (flujo formal)
El flujo es secuencial y bloqueante. Cualquier fallo detiene el pipeline.

### Orden de validadores y condiciones de bloqueo
1. Normalizacion de entrada
   - Bloquea si el JSON es invalido.
   - Artefactos: `gamespec.normalized.json`, `gamespec.hash`.

2. Validacion GameSpec (schema)
   - Bloquea si falta un campo obligatorio o hay tipo invalido.
   - Artefactos: `gamespec.validation.json`.

3. Validacion de manifests
   - Bloquea si el Feature Manifest no cumple schema o tiene paths fuera de limite.
   - Artefactos: `feature-manifest.validation.json`.

4. Integridad y dependencias
   - Bloquea si hay ids duplicados, referencias rotas o ciclos.
   - Artefactos: `dependency-graph.json`.

5. Analisis estatico
   - Bloquea si falla lint o typecheck.
   - Artefactos: `lint-report.json`, `typecheck-report.json`.

6. Reglas de seguridad
   - Bloquea si hay APIs prohibidas o imports no permitidos.
   - Artefactos: `security-report.json`.

7. Smoke tests de runtime
   - Bloquea si `init/start/tick` fallan o producen errores.
   - Artefactos: `runtime-smoke.json`.

8. Presupuestos de rendimiento
   - Bloquea si assets o tiempo por tick exceden limites.
   - Artefactos: `budget-report.json`.

9. Build preflight
   - Bloquea si faltan toolchains o configs.
   - Artefactos: `build-preflight.json`.

Salida final (si todo pasa):
- `validation-report.json` consolidado.
- `build-manifest.json` (cuando se inicia build).
