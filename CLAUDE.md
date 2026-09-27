# CLAUDE.md

Contexto para cualquier sesión de Claude que trabaje en este repositorio.

## Qué es

HOUSE (nombre clave) es una app de escritorio para crear música electrónica y
urbana (tech house, techno, reggaetón y más), mezclarla como DJ con salida a
audífonos y bocina por separado, grabar voz y proyectar visuales reactivos en
un segundo monitor. Público: gente joven de habla hispana, muchas personas
sin conocimientos de música. Hoy el repositorio contiene el plan; el código
empieza en la Fase 0.

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
