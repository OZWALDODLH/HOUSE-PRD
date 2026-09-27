# 2. Investigación

Investigación hecha en septiembre de 2026. Las fuentes están al final. Los
precios, versiones y cuotas de mercado cambian rápido: revisar antes de
tomar decisiones de compra o licencias.

## 2.1 Qué hacen hoy las apps de música

| App | Lo que hace bien | Lo que tomamos | Lo que evitamos |
|---|---|---|---|
| **Ableton Live 12.3** | Separación de stems sin internet (en Suite), integración con Splice que ajusta samples al tempo y tono del proyecto, escala global, vista de clips para improvisar. | Escala global que afecta pads y piano roll; vista de clips para lanzar ideas; stems dentro del flujo. | La curva de aprendizaje y la interfaz gris sin personalidad. |
| **FL Studio 2025/2026** | "Loop Starter" que arranca con loops del género elegido; "Remix a Song" que detecta tempo y separa stems en un clic; Gopher, un asistente que ya ejecuta tareas en el proyecto; el step sequencer más querido por beatmakers. | Arrancar con algo sonando según el género; secuenciador por pasos como centro; asistente que explica y también hace. | Ventanas flotantes encimadas; menús enormes. |
| **Koala Sampler** | Samplear en segundos, 64 pads, modo teclado con 9 escalas, 16 efectos de performance, separación con IA. | La inmediatez: grabar algo y tenerlo en un pad al instante; efectos que se tocan. | Pantalla pequeña: nosotros tenemos escritorio y teclado completo. |
| **BandLab** | Gratis, web y móvil, SongStarter con IA, masterización con presets, comunidad enorme. | Masterizar con un clic; retos y comunidad (más adelante). | Depender de la nube para todo. |
| **Suno Studio 2.0** (2026) | DAW con modelo generativo: piano roll, sinte wavetable, stems, efectos, todo junto a la generación. | Nada del enfoque generativo; sí la idea de que la IA viva en la misma línea de tiempo. | Que la IA haga la canción por ti. HOUSE se posiciona del otro lado: tú la haces. |
| **Fender Studio** (2025) | Grabación en un toque, cero configuración, gratis en todas las plataformas. | Grabar voz con un botón y un asistente de micrófono. | Lo limitado: sin MIDI ni instrumentos. |
| **rekordbox / Serato / VirtualDJ** | Juntos cubren cerca del 80% de los DJs (rekordbox ≈34%, Serato ≈27%, VirtualDJ ≈17%, Global DJ Census 2026). Stems en tiempo real ya son estándar: rekordbox pasó a 4 stems en su versión 7.2.8. | Stems por deck, formas de onda de color por frecuencia, sync, hot cues, loops, key lock, compatibilidad con controladores. | Que la biblioteca sea un problema: en HOUSE tus proyectos ya llegan analizados. |
| **Mixxx** (código abierto) | Permite Master y Audífonos en tarjetas de sonido distintas: usa el reloj de la tarjeta del Master y remuestrea las demás para compensar la deriva. | Exactamente esa estrategia para la multi-salida. | — |
| **Synesthesia** (VJ) | 80 escenas generativas, reactividad fina al beat, "meta controles" mapeables por MIDI/OSC, importa shaders de Shadertoy e ISF, sale por Syphon/Spout/NDI. | Escenas con pocos controles grandes; salida a otras apps; editor de escenas para avanzados. | Que sea una app aparte: en HOUSE los visuales conocen la canción. |

### Tendencias que importan

1. **Stems en todos lados.** Ableton, FL Studio, Koala y todas las apps de DJ
   separan canciones en voz, batería, bajo y resto. Ya no es un lujo.
2. **Asistentes que actúan.** FL Studio pasó de un asistente que contesta
   preguntas a uno que modifica el proyecto. La expectativa en 2026 es poder
   decir "hazme un groove de tech house con percusión latina" y que pase.
3. **Arrancar con algo sonando.** Loop Starter, SongStarter y las plantillas
   atacan el "síndrome de la hoja en blanco".
4. **Librerías integradas.** Splice dentro de Live 12.3: buscar un sample y
   que llegue ya en tu tempo y tu tono.
5. **Generativos completos** (Suno Studio). Es la competencia indirecta más
   fuerte para quien empieza. Nuestra respuesta: la satisfacción de hacerlo tú,
   con herramientas que no te dejan equivocarte.

## 2.2 Hallazgos técnicos que cambian el plan

| # | Hallazgo | Qué significa para HOUSE |
|---|---|---|
| 1 | **VST3 es MIT desde octubre de 2025** (SDK 3.8). **ASIO** pasó a doble licencia GPLv3/propietaria. | Hospedar plugins VST3 ya no requiere contrato con Steinberg. ASIO: si la app es de código cerrado se usa la licencia propietaria de Steinberg; si es GPL, puede usar la GPLv3. |
| 2 | En el navegador (y en Electron) `AudioContext.setSinkId()` existe desde Chrome 110, pero **un AudioContext solo sale por un dispositivo** y no hay sincronía entre dos. | Audífonos + bocina en dispositivos distintos exige un motor nativo con compensación de deriva. Decide la arquitectura (ver doc 5). |
| 3 | **WebGPU** ya está en Chrome, Edge, Safari 26 y Firefox 141+ (Windows). | Visuales con WebGPU donde exista y WebGL2 como respaldo universal. |
| 4 | **Separación de stems local:** HT-Demucs (versión *ft*) es el mejor default general; BS-RoFormer es el estado del arte en MUSDB18-HQ, más lento y con ventaja sobre todo en bajo. Ambos se exportan a ONNX. | Stems sin subir audio a internet, con ONNX Runtime. Modo rápido y modo calidad. |
| 5 | **Estirar/transponer audio:** Signalsmith Stretch (MIT), Rubber Band R3 (GPL o comercial), Bungee (MPL-2.0). | Signalsmith Stretch: licencia libre y muy buena transposición; ya tiene bindings para Rust. |
| 6 | **Beat This!** (ISMIR 2024) detecta beats y downbeats; código y pesos con licencia MIT. | Análisis de tempo y compases para audio importado y la cabina DJ. Ojo: parte de sus datos de entrenamiento tiene copyright; revisar para uso comercial. |
| 7 | **DeepFilterNet**: supresión de ruido en tiempo real a 48 kHz, escrita en Rust, MIT/Apache. | Botón "Quitar ruido de fondo" para la voz, en vivo. |
| 8 | **Butterchurn** (MIT) es MilkDrop en WebGL2, con miles de presets. **ISF** es el estándar abierto de shaders para VJ (revisar la licencia de cada shader: CC no comercial vs MIT). | Cientos de escenas psicodélicas desde el día uno; formato abierto para escenas propias. |
| 9 | **JUCE** es AGPLv3 o licencia de pago por niveles (Personal gratis con tope de ingresos, Indie ≈40 USD/año, Pro ≈800 USD/año, mayo 2026). | Alternativa válida para el motor, pero con costo o copyleft. Ver doc 5. |
| 10 | **cpal** (Rust) da audio en WASAPI, ASIO, CoreAudio, ALSA/JACK; **clack** permite hospedar plugins CLAP en Rust; **Firewheel** es un motor de grafo de audio en Rust activo en 2026. | El ecosistema Rust ya alcanza para un motor de audio serio. |
| 11 | **openDAW** (AGPL o comercial) es un DAW web de código abierto que llega a su 1.0 en otoño de 2026. | Buena referencia de arquitectura web; no lo usamos como base por la licencia y porque necesitamos audio nativo. |
| 12 | **DAWproject** es un formato abierto para mover proyectos entre DAWs (Bitwig, Studio One, Cubase 14). | Exportar/importar DAWproject para que nadie quede atrapado en HOUSE. |
| 13 | **Fotosensibilidad (WCAG 2.3.1):** nada debe destellar más de 3 veces por segundo salvo que esté bajo los umbrales de área y luminancia; el rojo saturado es más peligroso. | "Modo seguro" encendido por defecto en Visuales. |
| 14 | **Tauri 2** lista monitores y permite mover y poner en pantalla completa una ventana, pero abrir una ventana directo en un monitor tiene fallas reportadas. | Abrir la ventana, moverla al monitor elegido y luego pantalla completa; probarlo en Windows y macOS desde la Fase 0. |
| 15 | **WLED** (tiras LED con ESP32) acepta color en tiempo real por UDP (DRGB/DNRGB/DDP) y E1.31. | Idea para después: luces LED de tu cuarto al ritmo de la canción. |

## 2.3 Géneros: la receta de cada plantilla

Rangos aproximados. Cada plantilla trae su kit, tempo, swing, patrón inicial,
escala y estructura, y todo se puede cambiar.

| Género | BPM | Batería | Bajo | Sonidos típicos | Swing | Fase |
|---|---|---|---|---|---|---|
| **Tech house** | 124–128 | Bombo 4×4, palmas en 2 y 4, hat abierto a contratiempo, shaker y percusión con swing | Rodante, corto, a contratiempo, con sidechain | Vocal chops, percusión latina, stabs, filtros | 54–60% | MVP |
| **Techno** (peak time) | 128–135 | Bombo con "rumble", hats rectos en 16avos, ride | Hipnótico, grave, casi sin melodía | Línea ácida 303, stabs, texturas industriales | 50–52% | MVP |
| **Hard techno** | 145–160 | Bombo distorsionado, hats rápidos | Rumble saturado | Kicks "hardgroove", sirenas, voces cortas | 50% | 2 |
| **House / deep house** | 120–125 | 4×4, palmas, hats abiertos | Cálido y melódico | Órgano estilo M1, acordes de piano, pads | 55–60% | MVP |
| **Melodic techno / house** | 120–126 | 4×4 limpio | Rodante | Arpegios, pads largos, leads emotivos | 50–54% | 2 |
| **Afro house** | 118–124 | Congas, shakers, bombo suave | Sub redondo | Percusión orgánica, voces, marimbas | 55–62% | 2 |
| **Reggaetón** | 88–100 (94–96 el clásico) | Dembow: bombo en cada tiempo; caja/rim en los 16avos 4, 7, 12 y 15 | 808 siguiendo los acordes | Plucks, pads, redobles de timbal, voces con eco | 50–54% | MVP |
| **Dembow dominicano** | 115–130 | Dembow rápido y seco | 808 corto | Sirenas, voces cortadas | 50% | 2 |
| **Moombahton** | 100–115 (≈110) | Groove de reggaetón con peso de house | Grave y pesado | Stabs de medios, leads | 52–56% | 2 |
| **Trap** | 130–150 (medio tiempo) | Caja en el 3, hats en tresillos y redobles | 808 con glide | Pads oscuros, campanas, plucks | 50% | 2 |
| **Tribal guarachero** (MX) | 130–135 | 4×4 con swing de tresillo cumbiero, mucha percusión | Tipo tuba, rebotado | Flautas prehispánicas, sintes agudos, acordeón | tresillo | 2 |
| **Funk brasileño** | 130–150 | Tamborzão, percusión seca | 808 saturado | Voces repetidas, "montagem" | 50% | 2 |
| **Phonk (drift)** | 150–170 (≈160) | Cowbell, 808 recortado, sidechain fuerte | 808 distorsionado | Cowbell melódico, pads en menor | 50% | 2 |
| **Amapiano** | 108–115 (≈112) | Shakers, bombo suave | "Log drum" (bajo percusivo afinado) | Acordes jazzeros, pianos | 55–60% | 2 |
| **Psytrance** | 138–148 | Bombo seco en cada tiempo | Rodante "K-B-B-B": bombo y tres notas de bajo por tiempo | Leads psicodélicos, FX, voces de películas | 50% | 2 |
| **Drum & bass** | 170–176 | Breaks, caja en 2 y 4 | Reese, sub | Pads, amens | 50–54% | 5 |
| **Lo-fi / chill** | 70–90 | Batería suave con swing | Bajo cálido | Keys, vinilo, lluvia | 58–66% | MVP |
| **Ambient / relax** | libre (60–90 o sin rejilla) | Poca o ninguna | Drones | Pads, texturas granulares, naturaleza | — | 2 |

### Patrones base en la rejilla de 16 pasos

Cada bloque es un tiempo (una negra) dividido en cuatro 16avos. El número
marca el inicio del tiempo.

```
Tech house          |1 . . . |2 . . . |3 . . . |4 . . . |
Bombo               |●       |●       |●       |●       |
Palmas              |        |●       |        |●       |
Hat abierto         |    ●   |    ●   |    ●   |    ●   |
Shaker (con swing)  |● ● ● ● |● ● ● ● |● ● ● ● |● ● ● ● |

Reggaetón (dembow)  |1 . . . |2 . . . |3 . . . |4 . . . |
Bombo               |●       |●       |●       |●       |
Caja / rim          |      ● |    ●   |      ● |    ●   |
Hat                 |●   ●   |●   ●   |●   ●   |●   ●   |

Psytrance (K-B-B-B) |1 . . . |2 . . . |3 . . . |4 . . . |
Bombo               |●       |●       |●       |●       |
Bajo                |  ● ● ● |  ● ● ● |  ● ● ● |  ● ● ● |
```

### Estructuras típicas (para "De loop a canción")

- **Tech house / techno** (pensadas para DJ): Intro de batería 16–32
  compases › Subida 16 › Drop 32 › Pausa 16 › Subida 8 › Drop 32 › Salida de
  batería 16–32.
- **Reggaetón**: Intro 4–8 › Verso 16 › Pre-coro 8 › Coro 8–16 › Verso 16 ›
  Coro › Puente 8 › Coro final › Salida 4–8. Duración de 2:45 a 3:30.
- **Lo-fi / relax**: A (8) › B (8) › A' (8) › cierre suave, en bucle.

## 2.4 Diseño: qué hace que una interfaz "se vea hecha por IA"

Lo que la comunidad de diseño identifica en 2025–2026 como "AI slop" y
evitamos (detalle en el doc 4 y en `DESIGN.md`):

- Degradados morado-azul, halos de neón, vidrio esmerilado.
- Todo en tarjetas redondeadas iguales, con el mismo borde gris y sombra.
- Tipografía Inter en todo, fondos casi negros con un solo acento ácido.
- Etiquetas en mayúsculas encima de cada bloque, textos "A · B · C",
  flechas "→" pegadas a los botones.
- Tres tarjetas de "características" en fila, con ícono, título y dos líneas.

Lo que funciona según esas mismas fuentes: fijar los tokens en un
`DESIGN.md` y tratarlo como contrato, elegir tipografías de verdad, limitar la
paleta y poner criterio humano en la curaduría. Eso es lo que hace este
proyecto.

## 2.5 Fuentes

**Apps y mercado**
- [Ableton Live 12.3 is out now](https://www.ableton.com/en/blog/live-12-3-is-here/) · [Stem Separation en Live 12.3](https://www.ableton.com/stem-separation-in-ableton-live/)
- [What's new in FL Studio 2026](https://www.image-line.com/fl-studio/release/2026) · [FL Studio 2025](https://www.image-line.com/fl-studio-news/fl-studio-2025-whats-new-2)
- [Koala Sampler — Sound On Sound](https://www.soundonsound.com/reviews/elf-audio-koala-sampler) · [Koala Sampler (MWM)](https://mwm.ai/apps/koala-sampler/1449584007)
- [Suno (platform) — Wikipedia](https://en.wikipedia.org/wiki/Suno_(platform)) · [Suno: Best DAW for beginners](https://suno.com/hub/best-daw-for-beginners)
- [Fender Studio — Bedroom Producers Blog](https://bedroomproducersblog.com/2025/05/20/fender-studio/) · [Fender Studio review — Guitar.com](https://guitar.com/reviews/accessories/hands-on-fender-studio-review/)
- [Best DJ Software 2026 — Lexicon](https://www.lexicondj.com/blog/best-dj-software) · [DJ Stems Compared 2026](https://thedjmixtape.com/virtualdj-stems-vs-serato-stems-vs-rekordbox-stems/) · [DJ Software 2026 — Digital DJ Tips](https://www.digitaldjtips.com/best-dj-software-2026/)
- [Mixxx — Sound Hardware](https://manual.mixxx.org/2.3/en/chapters/preferences/sound_hardware)
- [Synesthesia — Features](https://getsynesthesia.com/features)

**Tecnología y licencias**
- [VST 3 y ASIO con licencias abiertas — CDM](https://cdm.link/open-steinberg-vst3-and-asio/) · [Libre Arts](https://librearts.org/2025/11/steinberg-relicenses-vst3-and-asio/)
- [AudioContext.setSinkId() — Chrome for Developers](https://developer.chrome.com/blog/audiocontext-setsinkid) · [AudioContext — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [WebGPU en los navegadores principales — web.dev](https://web.dev/blog/webgpu-supported-major-browsers) · [Estado de implementación](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [htdemucs vs BS-RoFormer vs Spleeter (2026)](https://dev.to/codesugar_lin_037a57b06a4/htdemucs-vs-bs-roformer-vs-spleeter-a-2026-audio-source-separation-benchmark-2ll8) · [htdemucs-onnx](https://huggingface.co/StemSplitio/htdemucs-onnx)
- [Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) · [Su diseño](https://signalsmith-audio.co.uk/writing/2023/stretch-design/) · [crate signalsmith-stretch](https://crates.io/crates/signalsmith-stretch)
- [Beat This!](https://github.com/CPJKU/beat_this) · [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)
- [Butterchurn](https://github.com/jberg/butterchurn) · [ISF Spec](https://github.com/mrRay/ISF_Spec) · [Usar ISF](https://docs.isf.video/using_isf.html)
- [JUCE — licencias](https://juce.com/get-juce/) · [Resumen de precios 2026](https://www.youngju.dev/blog/culture/2026-05-16-audio-plugin-development-2026-juce-8-vst3-au-aax-clap-iplug2-faust-cmajor-elementary-audio-deep-dive.en)
- [cpal](https://github.com/RustAudio/cpal) · [clack](https://github.com/prokopyl/clack) · [Firewheel](https://github.com/BillyDM/Firewheel)
- [openDAW](https://github.com/andremichelle/openDAW)
- [Tauri 2 — window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) · [Issue: asignar ventana a un monitor](https://github.com/tauri-apps/tauri/issues/6394)
- [DAWproject FAQ — Bitwig](https://www.bitwig.com/support/technical_support/dawproject-file-format-faqs-62/)
- [WCAG 2.3.1 Three Flashes or Below Threshold](https://w3c.github.io/wcag21/understanding/three-flashes-or-below-threshold.html) · [Three Flashes (2.3.2)](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes.html)
- [WLED UDP Realtime](https://kno.wled.ge/interfaces/udp-realtime/)

**Géneros**
- [Cómo hacer un beat de reggaetón — MusicRadar](https://www.musicradar.com/news/beat-building-how-to-produce-a-reggaeton-beat) · [Dembow — Wikipedia](https://en.wikipedia.org/wiki/Dembow_beat)
- [House vs Techno — Splice](https://splice.com/blog/house-vs-techno/) · [BPM del tech house](https://alecforshag.com/what-bpm-is-tech-house-tempo-guide-producer-perspective/)
- [Tribal guarachero — Wikipedia](https://en.wikipedia.org/wiki/Tribal_guarachero) · [Moombahton — Wikipedia](https://en.wikipedia.org/wiki/Moombahton)
- [Amapiano — Splice](https://splice.com/blog/what-is-amapiano-music/) · [Brazilian funk vs phonk — Splice](https://splice.com/blog/brazilian-funk-vs-phonk/) · [Phonk — Wikipedia](https://en.wikipedia.org/wiki/Phonk)

**Diseño**
- [AI Design Slop — SmoothUI](https://smoothui.dev/blog/ai-design-slop) · [AI Slop Web Design Guide](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Big Shoulders — Google Fonts](https://fonts.google.com/specimen/Big+Shoulders) · [Big Shoulders (repositorio)](https://github.com/xotypeco/big_shoulders)
- [Atkinson Hyperlegible Next — Braille Institute](https://www.brailleinstitute.org/about-us/news/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier/)
