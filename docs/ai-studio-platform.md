# AI Studio Platform - Documento tecnico fundacional

## Objetivo y vision tecnica
AI Studio es una plataforma para generar videojuegos de forma automatizada, reproducible y auditable. El sistema prioriza el control sobre la generacion: cada juego debe ser resultado de entradas estructuradas, contratos verificables y pipelines trazables. La IA es un componente bajo orquestacion estricta, nunca un generador libre.

Principios clave:
- Reproducibilidad: cada build es determinista a partir de inputs versionados.
- Auditoria: cada artefacto se registra con hashes, logs y manifests.
- Validacion primero: la generacion solo progresa si pasa validadores automaticos.
- Separacion de responsabilidades: logica, estado y renderizado deben estar desacoplados.
- 100% software gratuito y self-hosted: sin dependencias de SaaS de pago.

## Rol de la IA como generador controlado
La IA no escribe directamente en el repositorio final ni decide la arquitectura. Su rol es producir artefactos declarados a partir de contratos estrictos:
- Genera modulos y assets solo en un staging aislado.
- Emite manifiestos que describen exactamente lo que produjo.
- No introduce dependencias nuevas sin declararlas y pasar validacion.
- No puede modificar el core ni romper interfaces publicas sin aprobacion del sistema.

El sistema decide que se integra, rechaza o corrige. La IA queda acotada a transformaciones definidas por contrato.

## Arquitectura general
Componentes principales:
- Orquestador (Node.js + TS): coordina pipelines, versiona entradas, ejecuta validadores y construye artefactos.
- Plantillas base (Phaser + Next.js): estructura estable con separacion estricta de logica, estado y render.
- Generador IA (local/self-hosted): produce codigo/asset bajo contratos en staging.
- Validadores: schemas, lint/typecheck, reglas de seguridad, performance budgets.
- Builder/Packager: compila web y genera proyectos Android con AAB.
- Artifact Store local: almacena builds con manifests y reportes.

## Pipelines end-to-end
Pipeline canonico (prompt/entrada -> artefactos -> validacion -> build -> export/publish):
1. Ingesta de especificacion
   - Entrada: GameSpec (JSON/YAML versionado).
   - Normalizacion, validacion de schema y hash de entrada.
   - Creacion de workspace de build con identificador unico.

2. Generacion controlada
   - IA produce modulos de logica, escenas Phaser, configs y assets declarados.
   - Salida obligatoria: Feature Manifest + Asset Manifest.
   - Todo se escribe en staging aislado.

3. Ensamblado
   - El sistema integra modulos en la plantilla base.
   - Se aplican reglas de integracion y dependencias permitidas.
   - Se rechazan cambios fuera de contrato.

4. Validacion tecnica
   - Schema validation de manifests.
   - Typecheck y lint.
   - Smoke tests (init de escena, loop principal, carga de assets).
   - Presupuestos (fps, memoria, tamaño de assets).

5. Build y empaquetado
   - Build web (Next.js + bundle Phaser).
   - Build Android (wrapper + AAB).
   - Generacion de export ZIP con proyecto y reportes.

6. Export / Publicacion
   - Descarga de proyecto completo, manifests y logs.
   - Publicacion asistida: scripts locales para Play Store si hay credenciales, si no exporta paquete listo para subida manual.

## Contratos principales
### GameSpec (entrada)
Define lo que se quiere construir sin permitir ambiguedades:
- Identidad: nombre, version, objetivo de plataforma.
- Core loop y reglas.
- Progresion y economia.
- Requisitos de rendimiento (fps, memoria).
- Directrices de assets (estilo, resoluciones, paleta).
- Politicas (offline, monetizacion si aplica).

### Feature Manifest (salida de IA)
Describe exactamente lo generado:
- Modulos creados o modificados.
- Interfaces y contratos consumidos.
- Dependencias y versiones.
- Puntos de integracion con el core.

### Asset Manifest
Inventario de assets con metadatos:
- Tipo, formato, tamaño, resolucion.
- Hashes y origen.
- Licencias declaradas si aplica.

### Build Manifest
Registra el build:
- Hash de GameSpec + version de plantilla.
- Version de toolchain.
- Timestamp y commit base.
- Hashes de salida y checksums.

### Validation Report
Resultado de cada validador:
- Estado por etapa (schema, lint, tests, budgets).
- Metricas (fps objetivo, uso de memoria estimado).
- Errores y motivos de bloqueo.

## Validadores obligatorios
Conjunto minimo para permitir integracion:
- Schema validator: GameSpec y manifests.
- Static analysis: lint + typecheck.
- Runtime smoke tests: carga de escena, bucle, assets.
- Presupuesto de assets: tamaño maximo y conteo.
- Seguridad: bloqueo de eval, fetch externo no declarado, permisos nativos no permitidos.

## Fases de desarrollo del sistema
Fase 1 - Control y contratos
Objetivo: base de reproducibilidad.
Artefactos: GameSpec v1, Feature/Asset Manifest v1, Build Manifest v1, hash de entrada.

Fase 2 - Generacion controlada
Objetivo: IA produce en staging con contratos.
Artefactos: modulos generados, manifests de salida, logs de generacion.

Fase 3 - Validacion tecnica
Objetivo: gate automatico.
Artefactos: Validation Report, reglas de budgets, smoke tests.

Fase 4 - Build y empaquetado
Objetivo: outputs descargables.
Artefactos: build web, AAB, export ZIP con proyecto y reportes.

Fase 5 - Publicacion asistida
Objetivo: flujo realista de subida.
Artefactos: paquete Play Store, metadata exportable, script local de subida.

## Consideraciones reales de Play Store y builds
- Android App Bundle (AAB) es obligatorio para nuevas apps.
- Firmado: requiere keystore local y manejo seguro de credenciales.
- Target SDK y politicas cambian con frecuencia; el pipeline debe soportar actualizaciones rapidas.
- Tamano de APK/AAB y tamanos de assets son restricciones duras.
- Permisos nativos deben ser minimos y declarados.
- Metadata (descripcion, iconos, capturas) debe generarse o exportarse de forma consistente.
- El pipeline debe poder ejecutar builds locales sin servicios externos.

## Riesgos tecnicos y decisiones clave
Riesgos:
- No determinismo en la generacion IA.
- Acumulacion de deuda tecnica por integraciones no controladas.
- Assets invalidos o pesados que rompen el rendimiento movil.
- Cambios frecuentes en politicas de Play Store.
- Seguridad: codigo no revisado o dependencias no declaradas.

Decisiones clave:
- Plantilla base estable y versionada como fuente de verdad.
- IA limitada a staging con manifests obligatorios.
- Integracion solo via contratos validados.
- Auditoria total con hashes y reportes.
- Pipeline offline/self-hosted para cumplir el requisito de coste cero.
