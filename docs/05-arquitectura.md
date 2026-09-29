# 5. Arquitectura técnica

## 5.1 La decisión en corto

- **App de escritorio.** Windows 10/11 y macOS 13+ primero; Linux después.
- **Tauri 2** (Rust) como cascarón de la app.
- **Motor de audio nativo en Rust** (con `cpal` para hablar con la tarjeta de
  sonido: WASAPI y ASIO en Windows, CoreAudio en macOS, PipeWire/JACK/ALSA en
  Linux).
- **Interfaz en TypeScript + React**, dentro del WebView de Tauri; lo que se
  mueve a 60 fps se dibuja en Canvas/WebGL.
- **Visuales en una ventana aparte** con WebGL2 (y WebGPU donde exista).

Por qué así:

1. Tres requisitos del proyecto **no se pueden** hacer bien dentro de un
   navegador: latencia baja estable para tocar con el teclado y monitorear la
   voz, **dos dispositivos de salida sincronizados** (audífonos + bocina) y
   drivers ASIO. Eso obliga a un motor nativo.
2. Una interfaz con tanta personalidad y movimiento se construye mucho más
   rápido con tecnología web que con kits nativos de audio.
3. Rust da velocidad de C++ con seguridad de memoria, que en un hilo de audio
   en tiempo real evita la clase de errores más peligrosa (cuelgues y ruidos).
   Y ya tiene lo necesario: `cpal`, `rubato`, `symphonia`, `clack`, `ort`.

## 5.2 Opciones descartadas (y cuándo tendrían sentido)

| Opción | Por qué no | Cuándo sí |
|---|---|---|
| **Electron + Web Audio** | Un `AudioContext` solo sale por un dispositivo y dos contextos no se sincronizan; sin ASIO; más latencia; DSP limitado al hilo de audio del navegador; pesa más. | Para una demo web ligera en el futuro (la UI se reutiliza). |
| **JUCE (C++) / Tracktion Engine** | Lo más probado en audio y trae hosting de plugins, pero es C++, la licencia es AGPL o de pago (JUCE) y GPL o comercial (Tracktion), y la UI nativa cuesta más hacerla así de expresiva. | Si HOUSE se hace open source GPL y los plugins son prioridad desde el día uno. |
| **Web pura (PWA)** | Sin multi-salida real, latencia variable, sin acceso a drivers. | Nunca como app principal. |
| **Flutter o Qt** | UI nativa posible pero menos productiva para este estilo; el audio igual tendría que ser nativo. | — |

## 5.3 Vista general

```
┌──────────────────────── Proceso principal (Rust, Tauri) ────────────────────────┐
│                                                                                  │
│  Núcleo de la app ──comandos──▶ Documento del proyecto (fuente de la verdad)     │
│  (hilo principal)               + historial de deshacer                          │
│        │                                 │ compila                               │
│        │                                 ▼                                       │
│        │                        Grafo de render inmutable ──intercambio atómico──┐│
│        │                                                                         ││
│        │  colas sin bloqueo    ┌──────────────────────────────────┐              ││
│        ├──────────────────────▶│ HILO DE AUDIO (tiempo real)      │◀─────────────┘│
│        │  notas, parámetros    │ instrumentos, efectos, buses     │──▶ Dispositivo A (reloj maestro)
│        │                       └──────────────┬───────────────────┘─remuestreo─▶ Dispositivo B
│        │                                      │ muestras + eventos               │
│        │                                      ▼                                  │
│        │                       Hilo de análisis (FFT, golpes, LUFS)              │
│        │                                      │ 60 veces por segundo             │
│  Trabajadores: disco, renders, stems (ONNX), análisis, exportación              │
└────────┬──────────────────────────────────────┼──────────────────────────────────┘
         │ comandos + canales binarios          │ canal binario
         ▼                                      ▼
┌───────────────────────────┐        ┌──────────────────────────────┐
│ Ventana principal          │        │ Ventana de Visuales          │
│ WebView: React + TS        │        │ WebView: WebGL2 / WebGPU     │
│ Canvas/WebGL para pasos,   │        │ escenas, Butterchurn, ISF    │
│ ondas y medidores          │        │ (solo existe si la abres)    │
└───────────────────────────┘        └──────────────────────────────┘
```

## 5.4 Motor de audio

### Reglas de tiempo real (no negociables)

Dentro del callback de audio:

- Nada de pedir memoria, nada de candados (locks), nada de archivos, nada de
  logs, nada de llamadas al sistema.
- La comunicación entra y sale por **colas sin bloqueo** (`rtrb`) y valores
  atómicos. Los cambios grandes (agregar una pista, un efecto) llegan como un
  **grafo nuevo** que se intercambia de forma atómica; el viejo se libera
  fuera del hilo de audio (`basedrop`).
- `assert_no_alloc` en las builds de desarrollo para cazar cualquier pedido
  de memoria.
- Voces preasignadas con robo de voces; suavizado de parámetros para que no
  haya clics; protección contra números desnormales.
- Eventos precisos a la muestra dentro de cada bloque.

### Piezas

- **Transporte**: tempo, compás, posición en ticks (960 por negra), swing,
  bucle, metrónomo.
- **Secuenciador**: patrones y clips se convierten en eventos con tiempo
  exacto, con un bloque de anticipación.
- **Grafo**: instrumentos, efectos, buses, envíos y sidechain en orden
  topológico, con compensación de latencia de plugins.
- **Buses**: Master, Pre-escucha, Metrónomo, Monitoreo y Cabina, asignables a
  cualquier dispositivo y canal (ver 3.9).
- **Grabación**: del hilo de audio a un buffer circular y de ahí al disco en
  otro hilo; compensa la latencia de entrada.
- **Streaming desde disco** para clips largos y decks.
- **Motor DJ**: decks con estirado de tiempo en tiempo real, sync por rejilla
  de beats y stems como cuatro flujos sincronizados.

### Multi-salida y deriva de reloj

Dos aparatos distintos nunca corren exactamente a la misma velocidad
(diferencias típicas de 0.01% a 0.1%). Sin corregirlo, en minutos aparecen
clics o desfase. Diseño:

1. Cada dispositivo abre su propio stream con `cpal`.
2. El dispositivo del Master es el **reloj maestro**: su callback genera el
   audio de todos los buses.
3. Los buses de otro dispositivo se escriben en un buffer circular; el
   callback de ese dispositivo lee con un **remuestreador adaptativo**
   (`rubato`) cuya proporción ajusta un controlador PI según qué tan lleno
   está el buffer. Así se mide y corrige la deriva real.
4. **Retraso por salida** para alinear dispositivos con latencias distintas
   (Bluetooth), calibrable con el micrófono.
5. Si todo sale por un solo dispositivo de varios canales, no hay remuestreo.

### Presupuesto de latencia

| Tramo | Objetivo |
|---|---|
| Tecla › evento en el motor | 1–2 ms |
| Buffer de audio (128 muestras a 48 kHz) | 2.7 ms |
| Driver y conversor (ASIO / CoreAudio) | 2–5 ms |
| **Total tecla › sonido** | **menos de 10 ms** |
| Monitoreo de voz por software, ida y vuelta | menos de 12 ms con ASIO/CoreAudio. Con WASAPI compartido, 20–30 ms: la app recomienda modo exclusivo o el monitoreo directo de la interfaz. |

### DSP: qué se escribe y qué se usa

| Pieza | Cómo |
|---|---|
| Osciladores (PolyBLEP, wavetables con mipmaps), filtros ZDF (escalera, estado variable), envolventes, LFO | Propios, en el crate `house-dsp`. |
| EQ, compresor, limitador con anticipación y true peak, reverb (FDN), delay, chorus/flanger/phaser, saturación con sobremuestreo | Propios. |
| Estirar tiempo y cambiar tono | Signalsmith Stretch (crate `signalsmith-stretch`, MIT). |
| Remuestreo (archivos y deriva) | `rubato`. |
| Loudness (LUFS) | `ebur128`. |
| FFT | `realfft` / `rustfft`. |
| Afinación de voz | Detección de tono (YIN/pYIN) + corrección (PSOLA, o Signalsmith con formantes). |
| Decodificar audio | `symphonia` (WAV, FLAC, MP3, AAC, OGG, ALAC). |
| Escribir audio | `hound` (WAV), codificador FLAC y MP3 (LAME como biblioteca dinámica). |
| MIDI | `midir`. |

## 5.5 Análisis e IA

Todo corre en la compu, sin internet, salvo el Copiloto.

| Tarea | Herramienta | Licencia |
|---|---|---|
| Separar stems | HT-Demucs *ft* en ONNX (modo rápido); BS-RoFormer (modo calidad) | MIT (Demucs); revisar pesos de cada RoFormer |
| Beats y compases | Beat This! en ONNX | MIT (revisar datos de entrenamiento para uso comercial) |
| Tonalidad | Cromagrama + perfiles de Krumhansl (propio) | propio |
| Quitar ruido de la voz | DeepFilterNet (Rust, tiempo real); respaldo: `nnnoiseless` (RNNoise) | MIT/Apache; BSD-3 |
| Clasificar sonidos, "parecidos a este" | Embeddings de audio con un modelo pequeño | por definir |
| Inferencia | ONNX Runtime con el crate `ort` (GPU si hay) | MIT/Apache |
| **Copiloto** (F5) | Un LLM por API (por ejemplo Claude, de Anthropic) con herramientas | — |

**Cómo funciona el Copiloto:** el modelo nunca toca el audio. Recibe un
resumen del proyecto (pistas, tempo, tonalidad, secciones, efectos) y puede
proponer acciones como llamadas a herramientas (`crear_patron`,
`agregar_efecto`, `cambiar_tempo`, `armar_cancion`…). La app muestra la
propuesta, la persona la acepta o no, y todo entra al historial de deshacer.
Nada sale de la compu sin permiso; se puede usar la app entera sin él.

## 5.6 Visuales

- **Ventana bajo demanda** (`WebviewWindow` de Tauri). Mientras no se abre,
  el hilo de análisis ni siquiera manda datos.
- **Colocación en la pantalla 2**: listar monitores, mover la ventana al
  origen del monitor elegido y después activar pantalla completa; recordar la
  elección por nombre de monitor. Hay fallas reportadas al crear una ventana
  directamente en un monitor: se prueba desde la Fase 0 en Windows y macOS.
- **Render**: WebGL2 como base (funciona en todos los WebViews) y WebGPU
  cuando exista (WebView2 en Windows, macOS 26+).
- **Escenas como módulos**:

  ```ts
  interface Escena {
    id: string;
    nombre: string;
    animo: 'relax' | 'psicodelico' | 'fiesta';
    parametros: Parametro[];          // 4–6 perillas grandes
    iniciar(gl: WebGL2RenderingContext): void;
    dibujar(cuadro: CuadroVisual, params: Valores, dt: number): void;
    liberar(): void;
  }
  ```

- **Mensaje de cada cuadro** (60 Hz, unos cientos de bytes; las muestras para
  Butterchurn van aparte en binario):

  ```ts
  type CuadroVisual = {
    t: number;                 // segundos del transporte
    bpm: number; compas: number; beat: number;
    fase: number;              // 0..1 dentro del beat
    seccion: string;           // 'intro' | 'subida' | 'drop' | 'pausa' | 'salida' | …
    progresoSeccion: number;   // 0..1
    faltaParaDrop?: number;    // en beats
    energia: number;           // 0..1
    bandas: Float32Array;      // 32 bandas logarítmicas 0..1
    graves: number; medios: number; agudos: number;
    golpes: { bombo: boolean; caja: boolean; hat: boolean };
    notas: number[];           // notas MIDI que suenan
    tonalidad: string; acorde?: string;
    voz: { nivel: number; tono?: number };
    letra?: string;
  };
  ```

- **Butterchurn** se alimenta con las muestras que manda el motor, sin Web
  Audio.
- **Modo seguro**: la luminancia promedio de cada cuadro se mide en la GPU
  (reducción a 1×1) y se limita cuánto puede cambiar por segundo; así nunca
  pasa de 3 destellos por segundo.
- **Grabar video**: captura del canvas y codificación con el codificador del
  sistema (Media Foundation en Windows, VideoToolbox en macOS) o FFmpeg como
  programa aparte.
- **Spout, Syphon y NDI** (F5): requieren compartir texturas desde código
  nativo. Se evalúa en F5 si el render de visuales pasa a Rust con `wgpu`.

## 5.7 Interfaz

- React 19 + TypeScript + Vite.
- El documento del proyecto vive en Rust; la UI recibe cambios y manda
  **comandos** (cada comando se puede deshacer).
- Cabezal, medidores, pasos y formas de onda se dibujan en Canvas/WebGL
  leyendo datos que llegan por canal binario, sin pasar por React.
- Catálogo de componentes (Storybook o Ladle) con los componentes de
  `DESIGN.md`; las pantallas solo usan componentes del catálogo.
- Fuentes empaquetadas dentro de la app (no se descargan al abrir).
- Controles propios con roles ARIA y navegación por teclado.
- Teclado musical: se lee `KeyboardEvent.code` (posición física) y se ignoran
  las repeticiones automáticas; la etiqueta de cada tecla se toma del mapa de
  teclado del sistema cuando está disponible y de tablas propias (es-MX,
  es-ES, US) cuando no.

## 5.8 Proyecto y datos

```
MiCancion.house/
  proyecto.json      documento con versión de esquema
  audio/             grabaciones y samples usados (copiados)
  renders/           track y stems para la cabina DJ (se regeneran)
  historial/         versiones automáticas
```

- Biblioteca global en SQLite (`rusqlite`): sonidos, análisis, tracks, listas.
- Migraciones de esquema; autoguardado cada 30 s; recuperación tras cierre
  inesperado.

## 5.9 Plugins (F5)

- CLAP con `clack-host`; VST3 con el SDK de Steinberg (MIT desde la 3.8).
- Cada plugin en un proceso aparte comunicado por memoria compartida: si
  falla, se desactiva y la app sigue.
- Escaneo en segundo plano y lista de plugins problemáticos.

## 5.10 Librerías y licencias

| Librería | Para qué | Licencia |
|---|---|---|
| `tauri` 2.x | Cascarón de la app, ventanas, IPC | Apache-2.0 / MIT |
| `cpal` | Audio de entrada y salida | Apache-2.0 |
| `rtrb`, `basedrop`, `arc-swap` | Tiempo real sin bloqueos | MIT / Apache-2.0 |
| `assert_no_alloc` | Cazar pedidos de memoria en el hilo de audio | BSD-1-Clause |
| `rubato` | Remuestreo | MIT / Apache-2.0 |
| `symphonia` | Decodificar audio | MPL-2.0 |
| `hound` | Escribir WAV | Apache-2.0 |
| `realfft`, `rustfft` | FFT | MIT / Apache-2.0 |
| `ebur128` | LUFS | MIT |
| `midir` | MIDI | MIT |
| `signalsmith-stretch` | Estirar tiempo y tono | MIT |
| `ort` + ONNX Runtime | Modelos de IA locales | MIT / Apache-2.0 |
| DeepFilterNet · `nnnoiseless` | Quitar ruido | MIT / Apache-2.0 · BSD-3-Clause |
| `clack-host` | Plugins CLAP | MIT / Apache-2.0 |
| VST3 SDK | Plugins VST3 | MIT |
| ASIO SDK | Driver de baja latencia en Windows | GPLv3 o licencia propietaria de Steinberg |
| `rusqlite` / SQLite | Biblioteca | MIT / dominio público |
| React, Vite | Interfaz | MIT |
| Butterchurn | Presets de MilkDrop | MIT |
| FFmpeg | Video (como programa aparte) | LGPL |
| Big Shoulders, Atkinson Hyperlegible Next | Tipografías | OFL |

Versiones revisadas en septiembre de 2026 (p. ej. `tauri` 2.12, `cpal` 0.18,
`rubato` 5.0). El crate publicado de DeepFilterNet es antiguo: se usa desde
su repositorio o se empieza con `nnnoiseless`.

**Política de licencias**: se permiten MIT, Apache-2.0, BSD, ISC, Zlib,
MPL-2.0 y OFL. LGPL solo como biblioteca dinámica o programa aparte. GPL y
AGPL no, salvo que se decida publicar HOUSE como código abierto GPL (en ese
caso se abren más puertas: Rubber Band, Tracktion, ASIO bajo GPL). Se revisa
en cada build con `cargo-deny` y un verificador de licencias de npm.

## 5.11 Estructura del repositorio cuando empiece el código

```
apps/desktop/            Tauri: src-tauri (Rust) + ui (React)
crates/
  house-engine/          transporte, grafo, buses, grabación, motor DJ
  house-dsp/             osciladores, filtros, efectos
  house-instruments/     Máquina, Ácido, 808, Analógico, Ondas, Sampler, Nubes…
  house-io/              dispositivos, multi-salida, deriva, latencia
  house-analysis/        FFT, golpes, beats, tonalidad, LUFS, stems
  house-project/         documento, comandos, deshacer, archivos .house
  house-visual-feed/     señales para Visuales
packages/
  ui-kit/                componentes de DESIGN.md
  visuals/               escenas, shaders, Butterchurn
content/                 kits, presets, plantillas, retos
docs/                    este plan
```

## 5.12 Calidad y pruebas

- **DSP**: pruebas con archivos de referencia, pruebas nulas y barridos.
- **Motor**: una hora sin cortes con 16 pistas; latencia medida
  automáticamente con loopback.
- **Multi-salida**: dos horas con dos dispositivos midiendo el desfase
  acumulado.
- **Interfaz**: pruebas de punta a punta con Playwright y capturas de
  regresión visual.
- **Rendimiento**: presupuestos de CPU por voz y por efecto; fps de visuales;
  perfiles en CI.
- **Robustez**: fuzzing de los lectores de archivos.
- **Telemetría** anónima y opcional (fallos y rendimiento), apagada por
  defecto.

## 5.13 Plataformas y distribución

- Windows 10/11 x64 (ARM64 después), macOS 13+ (Apple Silicon e Intel),
  Linux en F5.
- Instaladores firmados: Windows con firma de código; macOS notarizado.
- Actualizaciones automáticas con canal estable y beta.
- La app pesa poco (decenas de MB); los sonidos se descargan por paquetes.

## 5.14 Lo que ya está construido (septiembre de 2026)

Lo implementado sigue la decisión de 5.1 (Tauri 2 + motor en Rust con `cpal`
+ React/TypeScript + visuales WebGL2 en ventana aparte). Estas son las
diferencias con el plan de arriba y por qué:

- **Un motor, dos anfitriones.** `crates/house-engine` no tiene dependencias.
  Compilado a WebAssembly corre dentro de un AudioWorklet (la versión de
  navegador y la demo); compilado nativo corre dentro del callback de `cpal`
  en la app de escritorio. Los dos reciben el mismo protocolo de comandos
  numéricos (`[código, ...argumentos]`, ver `command.rs`) y devuelven el mismo
  arreglo de estado (paso, sección, golpes, niveles, 16 bandas). La
  exportación a WAV usa el mismo motor en un Worker, así que lo que exportas
  es exactamente lo que oyes.
- **El documento vive en TypeScript en la Fase 1** (no en Rust, como dice
  5.7). La interfaz guarda el proyecto en un store inmutable, calcula las
  diferencias y manda solo los comandos que cambiaron; deshacer son
  instantáneas del documento. Así la misma interfaz sirve en navegador y en
  escritorio. El documento pasa a Rust cuando la Cabina DJ (F4) necesite
  renders y análisis sin la interfaz abierta.
- **Un solo crate de motor** en lugar de `house-dsp`, `house-instruments`,
  etc. Se separa cuando crezca.
- **Archivos**: autoguardado en el almacenamiento de la app (localStorage para
  el documento, IndexedDB para el audio) y un archivo `.house` (JSON con el
  audio dentro) para mover proyectos. La carpeta `.house/` y la biblioteca en
  SQLite de 5.8 llegan con la Fase 2.
- **Dos salidas**: como en 5.4, con colas `rtrb` y un controlador PI que
  mantiene la cola de la pre-escucha a media carga; el remuestreo es lineal
  por ahora (`rubato` cuando haga falta más calidad).
- **Modo seguro de Visuales**: en lugar de medir un solo punto (1×1), mide
  la luminancia lineal exacta de una rejilla de 4×4 regiones con una imagen
  de 256×256 y su cadena de mipmaps. Lo que no parpadea no se toca; lo que
  pulsa (3 cambios de 0.09 o más en 2 s) se suaviza a 0.6 por segundo, y hay
  un tope duro de 2 destellos por segundo por región. La imagen final se
  vuelve a medir antes de mostrarse. Las pruebas de punta a punta lo miden en
  los píxeles de la pantalla con estrobos de 2 a 30 Hz y con las 8 escenas.
- **Web**: Chromium no deja pasar un `WebAssembly.Module` compilado a un
  AudioWorklet, así que se mandan los bytes y el worklet compila.
- **Licencias**: `cargo-deny` (`deny.toml`) y `scripts/check-licenses.mjs`
  corren en CI. Se aceptó **Unicode-3.0** (tablas de Unicode en crates básicos
  de Rust y de Tauri): es permisiva y no se puede evitar. La licencia del
  código de HOUSE queda sin elegir (decisión 6.7.3).
- **Segunda ronda (interfaz "Estudio")**: el motor creció a 32 pistas, 64
  espacios de audio, 26 modelos de batería y efectos de transición, tres
  instrumentos nuevos (Teclas FM, Supersaw y Cuerdas con Karplus-Strong), dos
  efectos por pista (12 tipos, líneas de retardo reservadas al crear el
  motor), 16 curvas de automatización de 64 puntos que se evalúan una vez por
  bloque en modo Canción, largo por nota para el piano roll, "ir a" un compás
  y paso, y recorte no destructivo del sampler (inicio, fin, suavizado y al
  revés). Nada de eso pide memoria en el hilo de audio.
- **Interfaz por módulos**: `state/` guarda el documento (`store`), las
  acciones de los menús (`actions`), acordes (`chords`), notas del piano roll
  (`notes`), curvas (`automation`), efectos (`effects`), el editor de audio
  (`audioEdit`) y Mis samples (`library`, en IndexedDB); `ui/` tiene un
  componente por vista (`Timeline`, `Arreglo`, `PianoRoll`, `Navegador`,
  `EditorAudio`, `Efectos`, `MenuBar`) y `tutorial/` el motor de lecciones.
- **Lo que se mueve con la música vive en su propia capa**: cabezales y la
  marca del paso que suena se mueven con `transform`, y pads, medidores y
  pantallas tienen `will-change`, así que la interfaz no repinta paneles
  mientras suena (60 cuadros por segundo incluso sin GPU, medido en CI).
- **Pruebas**: 33 del motor (incluye renders completos, efectos, curvas y
  recorte), 3 de la app de escritorio (incluye 30 minutos de deriva) y 20 de
  punta a punta en Chromium: las 21 plantillas suenan, modo Canción, la regla
  mueve el cabezal, deshacer, Soundboard, exportar, efectos, curvas, proyecto
  en blanco, editor de audio (recortar, usar, reabrir, cortar en pads),
  grabar, acordes, tutorial, ventana de visuales y modo seguro.

