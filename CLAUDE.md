# CLAUDE.md

Contexto para cualquier sesión de Claude que trabaje en este repositorio.

## Qué es

HOUSE (nombre clave) es una app de escritorio para crear música electrónica y
urbana (tech house, techno, reggaetón y más), mezclarla como DJ con salida a
audífonos y bocina por separado, grabar voz y proyectar visuales reactivos en
un segundo monitor. Público: gente joven de habla hispana, muchas personas
sin conocimientos de música. El repositorio tiene el plan y la app: motor de
audio en Rust, interfaz en React y app de escritorio con Tauri. El estado de
cada fase está en `docs/06-hoja-de-ruta.md`, sección 6.9.

## Idioma

- Documentos, textos de interfaz y mensajes al usuario: español de México, de tú.
- Código, nombres de variables y commits: inglés está bien; los textos que ve
  la persona siempre en español.

## Dónde está cada cosa

- `README.md`: resumen e índice.
- `docs/01…07`: visión, investigación, funciones, diseño, arquitectura, hoja
  de ruta, ideas.
- `DESIGN.md`: contrato visual (tokens, tipografía, reglas). Obligatorio.
- `diseno/`: bocetos HTML de las pantallas (`bocetos/`) y sus capturas
  (`capturas/`).
- `.claude/skills/house-ui` y `.claude/skills/frontend-design`: skills de diseño.
- `crates/house-engine/`: motor de audio (sin dependencias). Corre como
  WebAssembly en un AudioWorklet y nativo en la app de escritorio. Protocolo de
  comandos en `command.rs`; el espejo en TypeScript es `app/src/engine/protocol.ts`.
- `app/`: interfaz (React 19 + TypeScript + Vite). `src/state` (documento,
  plantillas, guardado), `src/engine` (puentes al motor, sincronización,
  exportar), `src/ui` (componentes del sistema de diseño), `src/screens`,
  `src/visuals` (escenas y modo seguro), `tests/e2e.mjs` (pruebas en navegador).
- `src-tauri/`: app de escritorio (audio nativo con `cpal`, dos salidas).
- `scripts/`, `deny.toml`, `.github/workflows/ci.yml`: build del motor,
  licencias y CI.

## Cómo probar

- Motor y escritorio: `cargo test --workspace --release`.
- Si cambias el motor: `bash scripts/build-wasm.sh` y sube también
  `app/src/engine/house_engine.wasm` (la interfaz lo usa tal cual).
- Interfaz: `npm --prefix app run typecheck`, `npm --prefix app run build` y
  `npm --prefix app run test:e2e` (Chromium real: audio, exportar, visuales y
  modo seguro).
- Licencias: `cargo deny check licenses` y `node scripts/check-licenses.mjs`.

## Reglas de trabajo

1. **Interfaz**: antes de tocar cualquier pantalla o componente, carga la
   skill `house-ui` y lee `DESIGN.md`. Nada de colores, fuentes o radios fuera
   del contrato. Revisa con captura contra la lista de la sección 9.
2. **Arquitectura decidida** (ver `docs/05-arquitectura.md`): Tauri 2 +
   motor de audio nativo en Rust (`cpal`) + React/TypeScript + visuales
   WebGL2/WebGPU en ventana aparte. No cambiar sin discutirlo.
3. **Tiempo real**: en el hilo de audio no se pide memoria, no hay locks, ni
   archivos, ni logs. Comunicación por colas sin bloqueo.
4. **Licencias**: solo MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0, OFL. LGPL
   solo dinámica o como programa aparte. GPL/AGPL no, salvo decisión explícita.
5. **Fases**: trabajar dentro de la fase actual de `docs/06-hoja-de-ruta.md`.
   Lo que no esté en la fase va a `docs/07-ideas.md`.
6. **Seguridad en Visuales**: el modo seguro (máximo 3 destellos por segundo)
   está activo por defecto y no se debilita.
