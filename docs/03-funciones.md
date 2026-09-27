# 3. Funciones

Especificación de todo lo que hace HOUSE, módulo por módulo. Cada función
indica en qué fase entra (detalle de fases en
[`06-hoja-de-ruta.md`](06-hoja-de-ruta.md)):

`F0` cimientos · `F1` "Mi primer beat" (MVP) · `F2` "Mi canción" ·
`F3` "Visuales" · `F4` "Cabina DJ" · `F5` "Pro + IA"

Contenido:
[3.1 Estudio](#31-estudio-patrón-y-canción) ·
[3.2 Instrumentos](#32-instrumentos-y-sintetizadores) ·
[3.3 Teclado musical](#33-teclado-musical-tu-teclado-como-pads) ·
[3.4 Sampling](#34-sampling-y-audio) ·
[3.5 Voz](#35-voz-micrófono-y-grabación) ·
[3.6 Efectos](#36-efectos) ·
[3.7 Mezcla](#37-mezcla-y-master) ·
[3.8 Cabina DJ](#38-cabina-dj) ·
[3.9 Entradas y salidas](#39-entradas-y-salidas-de-audio) ·
[3.10 Visuales](#310-visuales) ·
[3.11 Aprender](#311-aprender-y-ayuda) ·
[3.12 Proyectos](#312-proyectos-exportar-y-compartir) ·
[3.13 Accesibilidad](#313-accesibilidad-y-ajustes) ·
[3.14 Atajos](#314-atajos-principales)

---

## 3.1 Estudio: Patrón y Canción

### Patrón `F1`

El lugar donde nace el loop. Es la primera pantalla que ve quien empieza.

- **Secuenciador por pasos**: 16 pasos por defecto (8, 16, 32 o 64). Cada
  pista puede tener su propio largo `F2` para crear polirritmos.
- **Por paso**: encendido, fuerza (velocidad), y en `F2` probabilidad,
  microtiempo (adelantar o atrasar), repeticiones dentro del paso (ratchet).
  En la pista del Ácido: acento y slide.
- **Swing** global y por pista, con valores sugeridos por género.
- **Variaciones A–H** por pista; "Duplicar y variar" crea una variación
  parecida (más o menos densa, con redoble al final).
- **Grabar en vivo** desde los pads con cuantización (1/16 por defecto) y
  opción "humanizar".
- **Pistas de notas** (bajo, acordes, leads) muestran un mini piano roll
  dentro del patrón.
- **Dados** por pista: genera un patrón nuevo dentro del estilo y la escala.
  Los pasos con **candado** no cambian.
- La **marquesina de secciones** está siempre arriba (ver Canción).

### Canción `F2`

- **Línea de tiempo** con pistas y clips (patrones, audio, automatización).
- **Marquesina de secciones**: bloques con nombre y color (Intro, Subida,
  ¡Drop!, Pausa, Salida, Verso, Coro…). Se arrastran, duplican y reordenan
  con todo su contenido. Clic en una sección = se repite en bucle. Debajo, la
  curva de energía de la canción calculada automáticamente. Es el elemento
  visual protagonista del estudio (ver doc 4).
- **De loop a canción**: toma tu loop y propone una estructura según el
  género: arma las secciones metiendo y sacando elementos, agrega subidas
  (risers), redobles, impactos y filtros automáticos, y explica cada decisión
  en la marquesina. Todo queda editable.
- **Vista de clips** (lanzador): escenas por fila y clips por pista para
  improvisar o tocar en vivo.
- **Piano roll**: notas con fuerza; escala resaltada o con candado; acordes
  de un clic (eliges el grado); arpegiador; glide por nota para el 808;
  cuantizar, humanizar, invertir, transponer dentro de la escala.
- **Automatización**: dibujar curvas o grabar movimientos de perillas;
  formas prediseñadas (rampa, curva S, escalones); plantillas como "subida de
  filtro de 16 compases".
- Cambios de tempo y compás dentro de la canción `F5`.

### Siempre disponible

- Deshacer y rehacer ilimitados `F1`; **Máquina del tiempo**: historial
  visual para volver a cualquier punto `F2`.
- Guardado automático cada 30 segundos y versiones del proyecto `F1`.
- Metrónomo con salida configurable, cuenta de entrada, bucle, tap tempo `F1`.

## 3.2 Instrumentos y sintetizadores

Cada instrumento tiene dos caras:

- **Cara fácil**: 4 a 8 perillas grandes con nombres humanos (macros), un
  dibujo que muestra cómo suena y presets con pre-escucha.
- **Cara pro**: todos los parámetros y modulación de arrastrar y soltar
  (llevas un LFO o una envolvente a cualquier perilla y un anillo de color
  muestra cuánto se mueve).

Comunes a todos: presets con etiquetas (género, ánimo, tipo); **Dados**
(preset aleatorio que suena bien porque solo mueve rangos musicales);
**Mezclar dos presets** con un deslizador; polifonía configurable;
sobremuestreo en distorsiones; medidor de CPU por instrumento.

| Instrumento | Qué es | Dónde brilla | Macros (cara fácil) | Fase |
|---|---|---|---|---|
| **Máquina** | Caja de ritmos de 16 voces. Cada voz puede ser sintetizada (bombos, cajas, palmas, hats, toms, rims, cencerros inspirados en las cajas clásicas), un sample o las dos cosas en capas. | Todo | Pegada, Brillo, Cola, Suciedad | F1 |
| **Ácido** | Sinte monofónico de línea ácida: sierra o cuadrada, filtro resonante, acento y slide por paso. | Techno, acid, psytrance | Brillo, Resonancia, Ácido, Pegada | F1 |
| **808** | Bajo-bombo afinado con glide y saturación. | Reggaetón, trap, phonk, funk | Grave, Golpe, Glide, Saturación | F1 |
| **Analógico** | Polifónico de modelado analógico: 2 osciladores, sub, ruido, filtro escalera o de estado variable, 2 envolventes, 2 LFO, unísono de hasta 8 voces. | Plucks, stabs, pads, leads, órgano house | Brillo, Ataque, Cola, Grosor | F1 |
| **Ondas** | Wavetable: 2 osciladores que barren tablas de onda, modos de deformación, unísono de hasta 16 voces (supersaw); convierte cualquier audio en tabla. | Leads modernos, bajos reese, psy | Forma, Brillo, Anchura, Movimiento | F2 |
| **Sampler** | Un sample en una tecla o repartido en todo el teclado; zonas por nota y fuerza; cortes (chops) en los pads; bucle, reversa, estirado al tempo. | Todo | Tono, Inicio, Cola, Filtro | F1 básico, F2 completo |
| **Nubes** | Granular: convierte cualquier audio en nubes de granos; tamaño, densidad, posición, dispersión, congelar. | Ambient, relax, texturas psicodélicas | Tamaño, Densidad, Deriva, Congelar | F2 |
| **Teclas** | Instrumentos grabados: piano, piano eléctrico, órgano house, cuerdas, metales para stabs. | House, reggaetón, lo-fi | Brillo, Cuerpo, Espacio, Ataque | F2 |
| **Voces** | Tu voz grabada convertida en instrumento (chops en el teclado, formantes) y modo vocoder (tu micro modula un sinte). | Tech house, urbano | Formante, Tono, Corte, Robot | F2 chops, F5 vocoder |
| **FM** | 4 operadores con algoritmos dibujados. | Campanas, techno metálico, pianos eléctricos, bajos | Metal, Brillo, Cola, Movimiento | F5 |
| **Cuerdas y maderas** | Modelado físico: marimba, kalimba, cuerdas pulsadas, steel drum. | Afro house, tribal, lo-fi | Material, Golpe, Cola, Afinación | F5 |
| **Plugins** | VST3 y CLAP de terceros, en proceso aparte para que un plugin que falla no tumbe la app. | Pro | — | F5 |

## 3.3 Teclado musical (tu teclado como pads)

Se enciende y apaga con **Tab** o con el botón "Teclado musical". Mientras
está encendido, una franja de color lo avisa ("Teclado musical activo. Tab
para salir") y las letras tocan sonidos en lugar de ser atajos. Las teclas de
función, Espacio, Enter, flechas y combinaciones con Ctrl/⌘ siguen
funcionando.

### Modos

1. **Pads** `F1`: dos bancos de 4×4 = 32 pads, uno por mano.

   ```
   Banco A (izquierda)      Banco B (derecha)
   1  2  3  4               7  8  9  0
   Q  W  E  R               U  I  O  P
   A  S  D  F               J  K  L  Ñ
   Z  X  C  V               M  ,  .  -
   ```

   Se usa la posición física de la tecla, así que funciona igual con teclado
   latinoamericano, de España o de EE. UU., y la pantalla muestra lo que está
   impreso en **tu** teclado. Sí: la Ñ también suena.

2. **Piano** `F1`: fila A S D F G H J K L Ñ = teclas blancas; W E T Y U O P =
   negras; Z / X cambian de octava; C / V bajan o suben la fuerza.
3. **Escala** `F1`: cada tecla es una nota de la escala de la canción; cada
   fila, una octava. Imposible desafinar.
4. **Acordes** `F2`: 1 a 7 = los siete acordes de la tonalidad, ya con buena
   posición; Q a U = variaciones (séptima, sus, inversiones). Ideal para
   reggaetón y house.
5. **Lanzador** `F2`: cada tecla dispara un clip o una escena de la vista de
   clips.
6. **FX en vivo** `F2`: mientras mantienes la tecla, suena el efecto: filtro
   que abre, stutter de 1/8 o 1/16, congelar reverb, tape stop, cortador,
   subida. Al soltar, regresa.
7. **Soundboard** `F1`: arrastras cualquier sonido a cualquier tecla. Para
   jugar, para DJ (sirenas, bocinazos, voces) y para Visuales.

### Detalles

- **Fuerza**: fija en 100 por defecto; con Shift, acento (127).
- **Repetición de nota** `F2`: con Bloq Mayús activo, mantener una tecla la
  repite a 1/8, 1/16, 1/32 o tresillos (rolls de hats para trap y reggaetón).
- **Grabar lo que tocas**: se cuantiza al grabar (configurable) y se puede
  humanizar después.
- En pantalla, cada pad muestra su tecla y se ilumina con la tinta de su
  familia al tocarse.
- **Latencia objetivo**: menos de 10 ms de la tecla al sonido.
- **Límite del teclado**: muchos teclados no registran más de 3 a 6 teclas a
  la vez en ciertas combinaciones (ghosting). La app incluye "Prueba tu
  teclado" y recomienda teclados con anti-ghosting.
- **Otros controladores**: MIDI (pads, teclados, controladores DJ) con
  "aprender MIDI" y perfiles listos `F2`/`F4`; control de videojuegos `F5`;
  tu celular como pads por Wi-Fi escaneando un QR `F5`.

## 3.4 Sampling y audio

- **Importar** `F1`: arrastra archivos (WAV, AIFF, FLAC, MP3, AAC/M4A, OGG) o
  carpetas completas de sample packs. Se indexan y analizan en segundo plano
  (BPM, tono, tipo de sonido).
- **Grabar cualquier cosa** `F2`: micrófono, entrada de línea, o
  **remuestrear** lo que suena en la app (bounce in place).
- **Editor de sample** `F1`/`F2`: recortar, desvanecer, normalizar, invertir,
  cambiar tono y tiempo por separado, bucle con fundido.
- **Cortar (chops)** `F2`: automático por golpes, por beats o en partes
  iguales. Cada corte cae en un pad. "Reacomodar al azar" dentro del estilo.
- **Ajustar al tempo (warp)** `F2`: detecta beats y estira con alta calidad;
  marcadores editables.
- **Ajustar al tono** `F2`: detecta la tonalidad y la transpone a la de tu
  canción.
- **Separar stems con IA** `F5` (posible beta en F2): voz, batería, bajo y
  resto, sin internet. Modo rápido y modo calidad.
- **Grabar el audio del sistema** `F5` (loopback en Windows; permiso de
  captura en macOS), con aviso sobre derechos de autor.
- **Buscar sonidos** por familia, género, ánimo, BPM y tono; "sonidos
  parecidos a este" `F5`.
- **Suena tu ciudad** `F2`: grabas un sonido con el micro (una puerta, el
  metro, un pregón de la calle) y la app lo convierte en percusión afinada o
  en una textura con Nubes.

## 3.5 Voz: micrófono y grabación

### Asistente de micrófono (la primera vez) `F2`

1. Elegir el micrófono y el canal (1, 2 o estéreo).
2. "Habla o canta 10 segundos": mide el nivel y el ruido del cuarto; ajusta la
   ganancia para que los picos queden cerca de −12 dBFS. Si el micro satura,
   pide bajar la perilla de la interfaz.
3. Si parece un micro de condensador conectado a una interfaz, recuerda
   activar el phantom power (+48 V).
4. Si la salida son bocinas, recomienda audífonos o apaga el monitoreo para
   evitar eco.
5. Mide la latencia de ida y vuelta y la compensa sola, para que la voz quede
   a tiempo con el beat.
6. Guarda el perfil "Mi micro".

### Siempre visible en el espacio Voz

Dispositivo; ganancia con la "zona buena" marcada; monitoreo (apagado /
directo de la interfaz / por software con efectos) con la latencia en ms;
filtro de graves a 80 Hz (activo por defecto); quitar ruido de fondo; puerta
de ruido.

### Grabar `F2`

- Botón grande de grabar, cuenta de entrada y metrónomo solo en audífonos.
- Grabación en bucle: una toma por vuelta.
- Punch in / punch out.
- Tomas en lista con forma de onda y estrella para la favorita; armar la toma
  final con pedazos de varias (comping) `F5`.

### Procesar `F2`

- **Presets de cadena**: "Voz reggaetón" (afinación media, compresión, eco en
  1/8 con puntillo, reverb corta), "Radio", "Susurro con reverb", "Robot",
  "Doble" (dobles y armonías), "Sin efecto".
- **Afinación automática**: toma la tonalidad de la canción; velocidad de
  natural a efecto robot; humanizar.
- De-esser, doblador y armonizador.

### Letra `F2`

Panel de texto junto a la grabación, con secciones (Verso, Coro). Cada línea
guarda su tiempo al grabar y puede mandarse a Visuales como karaoke. Ayudante
de rimas en español `F5`.

### Extras `F5`

- **Tararea tu idea**: cantas una melodía y se vuelve notas.
- **Beatbox a batería**: tu beatbox se convierte en patrón de bombo, caja y hat.

## 3.6 Efectos

Cada pista tiene una cadena de efectos que se reordena arrastrando. Cada
efecto tiene cara fácil y cara pro, presets y explicación de "para qué sirve".

| Efecto | Para qué sirve, dicho fácil | Fase |
|---|---|---|
| Ecualizador | Subir o bajar graves, medios y agudos. | F1 |
| Filtro | El sonido "desde otro cuarto" y las subidas que abren. | F1 |
| Compresor | Empareja el volumen y da pegada. | F1 |
| Bombeo (sidechain) | Baja lo demás cada vez que pega el bombo. | F1 |
| Espacio (reverb) | Sala, placa, catedral. | F1 |
| Eco (delay) | Repeticiones al ritmo, en estéreo o ping-pong. | F1 |
| Saturación / distorsión | Calienta o ensucia. | F1 |
| Limitador | Que suene fuerte sin tronar. | F1 |
| Chorus, flanger, phaser | Movimiento y anchura. | F2 |
| Lo-fi (bitcrusher) | Sonido de videojuego o de aparato viejo. | F2 |
| Anchura estéreo | Abre o cierra el sonido. | F2 |
| Golpe (transient shaper) | Más ataque o más cola. | F2 |
| Cortador (trance gate) | Pica el sonido al ritmo. | F2 |
| Paneo automático | Que el sonido vaya de lado a lado. | F2 |
| Stutter / repetición de beat | El tartamudeo de las transiciones. | F2 |
| Tape stop | El "disco que se frena". | F2 |
| Vinilo | Ruido de disco y ondulación de cinta. | F2 |
| Afinación de voz | Corrige o robotiza la voz. | F2 |
| De-esser | Quita las "s" que pican. | F2 |
| Quitar ruido | Limpia el ruido del cuarto con IA. | F2 |
| Doblador / armonizador | Voces dobles y armonías. | F2 |
| Cambio de tono | Sube o baja el tono sin cambiar el tiempo. | F2 |
| Multibanda | Compresión por zonas, para el master. | F2 |
| Generador de subidas e impactos | Ruidos que suben 8 o 16 compases y el golpe del drop. | F2 |
| Vocoder | Voz robótica con acordes. | F5 |
| Reverb shimmer, eco granular | Espacios mágicos para ambient y psy. | F5 |

## 3.7 Mezcla y master

- **Mezclador** `F1`: por pista, volumen, paneo, mute, solo, armar
  grabación, medidor, efectos, y dos envíos ya preparados ("Espacio" y
  "Eco"); en Pro, más envíos y buses.
- **Grupos automáticos** `F2`: Batería, Bajo, Música y Voz, con su propio
  fader y efectos.
- **Bombeo en un clic** `F1`: interruptor "Bombeo con el bombo" en cualquier
  pista, con la curva de bombeo a la vista. También existe el bombeo por
  forma (sin fuente), útil cuando no hay bombo.
- **Asistentes** `F2`: "Ganancia automática" (niveles de arranque),
  "Limpiar graves" (quita graves a lo que no es bajo ni bombo), "Choque de
  graves" (detecta cuando bombo y bajo se pisan y propone solución), **Mapa
  de mezcla** (vista 2D: izquierda-derecha = paneo, arriba-abajo = volumen,
  tamaño = energía; arrastras para mezclar).
- **Medidores**: pico, RMS, LUFS (integrado y de corto plazo), true peak,
  espectro, correlación estéreo.
- **Referencia** `F2`: cargas una canción que te guste y comparas A/B con el
  volumen igualado.
- **Master en un clic** `F1` básico, `F2` completo: ecualizador, compresor de
  "pegamento", saturación, anchura y limitador, con destinos: "Streaming
  (−14 LUFS)", "SoundCloud / club (−9 LUFS)", "Al máximo (−7 LUFS)", y
  carácter "Cálido", "Brillante" o "Con pegada". Avisa si el true peak pasa
  de −1 dBTP.
- **Congelar pistas** `F2` para ahorrar CPU.

## 3.8 Cabina DJ

Todo en `F4` salvo lo indicado.

### Biblioteca

- **Tus proyectos aparecen solos**: al guardar, la app renderiza en segundo
  plano el track completo y sus stems (batería, bajo, melodía, voz) y guarda
  BPM, tono, rejilla de beats y secciones exactos. No hay que adivinar nada.
- **Archivos importados**: análisis de BPM, beats, tono, energía y secciones;
  stems con IA opcionales `F5`.
- Listas, carpetas inteligentes (por BPM, tono, energía, género) e historial
  de sets.
- **Siguiente sugerido**: tracks compatibles por BPM (±6%), tono (rueda
  Camelot) y energía.

### Decks

- 2 decks (4 en Pro).
- Forma de onda general y con zoom, coloreada por frecuencia, con rejilla de
  beats y, en tus proyectos, las secciones.
- Play, cue, sync, tempo (±8 / 16 / 50%), bloqueo de tono, cambio de tono por
  semitonos, 8 hot cues, loops automáticos (1/4 a 32 beats), saltos de beat,
  slip, reversa.
- **Stems por deck**: botones Batería, Bajo, Melodía y Voz para apagar o
  aislar. **Intercambiar voz**: la voz del deck A sobre el instrumental del B.

### Mezclador DJ

- Por canal: ganancia, ecualizador de 3 bandas con corte total, filtro de
  una perilla (pasa bajos ↔ pasa altos), fader, botón de pre-escucha
  (audífonos) y medidor.
- Crossfader con curvas; nivel de master; nivel de audífonos; mezcla
  cue/master en audífonos; **split cue** (cue en un oído y master en el otro)
  para cuando solo hay una salida.
- Efectos de beat: eco, reverb, flanger, filtro, roll, subida.

### Aprender a mezclar

- **Mezcla asistida**: eliges el siguiente track y propone una transición
  ("intercambio de graves en 16 compases"). Puede hacerla sola o guiarte:
  muestra qué perilla mover y cuándo.
- **Piloto automático** para fiestas: mezcla sola una lista con transiciones
  del estilo elegido.

### Grabar y compartir el set

WAV o MP3 con la lista de tracks y sus tiempos, listo para SoundCloud o
Mixcloud.

### Controladores

Perfiles listos para los controladores de entrada más comunes (por ejemplo
Pioneer DDJ-FLX4, Hercules DJControl Inpulse, Numark Mixtrack) y "aprender
MIDI" para cualquier otro. Estos controladores traen tarjeta de sonido con
salida de master y de audífonos: es la manera más simple y estable de tener
cue y master (ver 3.9).

## 3.9 Entradas y salidas de audio

Diseño en `F0`, lo básico en `F1`, multi-dispositivo completo en `F4`.

### Buses: a dónde va cada sonido

La app no manda el audio "a la tarjeta": lo manda a buses, y cada bus se
asigna a una o varias salidas.

| Bus | Qué lleva | Salida típica |
|---|---|---|
| Master | Lo que escucha todo el mundo | Bocina |
| Pre-escucha (cue) | Lo que preparas antes de que suene | Audífonos |
| Metrónomo | El clic | Solo audífonos |
| Monitoreo | Tu voz mientras grabas | Solo audífonos |
| Cabina `F5` | El monitor del DJ | Segunda bocina |

Cada bus se asigna a un dispositivo y a sus canales (1-2, 3-4…). Un bus
puede ir a varias salidas a la vez.

### Perfiles listos

- **Solo audífonos** (por defecto): todo por un dispositivo.
- **DJ en casa**: Master › bocina; Pre-escucha › audífonos.
- **Grabar voz**: todo a audífonos; bocina en silencio para evitar eco.
- **Fiesta con visuales**: DJ en casa + Visuales en la pantalla 2.

### Dos dispositivos distintos

Por ejemplo, una bocina USB o Bluetooth y los audífonos en la salida de la
laptop:

- El dispositivo del Master es el **reloj maestro**. Los demás reciben su
  audio con **remuestreo adaptativo** que corrige la diferencia de reloj
  entre aparatos (la misma idea que usa Mixxx). Sin esto, a los pocos
  minutos se oyen clics o se desfasan.
- **Alinear salidas**: cada dispositivo tiene su propio retraso. La app
  retrasa el más rápido para que los dos suenen al mismo tiempo. Calibración
  automática con el micrófono (un "chirp" por cada salida, medido al llegar)
  o manual con un deslizador en milisegundos.
- **Aviso Bluetooth**: "Esta bocina Bluetooth tiene unos 200 ms de retraso.
  Para DJ funciona si activas Alinear salidas. Para grabar voz o tocar pads,
  usa algo con cable."
- Si tienes una interfaz o controlador con 4 salidas, la app recomienda usar
  ese único dispositivo: cero deriva, cero problemas.

### Micrófono y entradas

Selección de dispositivo y canales, ganancia, monitoreo y latencia (ver 3.5).
Varias entradas a la vez `F5` (p. ej. dos micros).

### Motor

- Frecuencia de muestreo (44.1 / 48 kHz) y tamaño de buffer (64 a 1024), con
  la latencia resultante en ms.
- Driver: Windows (WASAPI compartido o exclusivo, ASIO); macOS (CoreAudio);
  Linux (PipeWire, JACK, ALSA).
- Prueba de audio, reinicio del motor sin cerrar la app.
- Si un dispositivo se desconecta: pausa segura, aviso claro y reconexión
  automática, sin ruidos.

## 3.10 Visuales

Todo en `F3` salvo lo indicado.

### La ventana

- Se abre solo cuando la pides (botón "Visuales" o F6). Cerrada no consume
  nada.
- **Abrir en pantalla 2**: la manda al monitor elegido y la pone en pantalla
  completa; recuerda tu configuración. Si conectas un segundo monitor, la app
  ofrece mandar los visuales ahí.
- La ventana no tiene controles encima (limpia para proyectar). Se maneja
  desde el panel de Visuales en la ventana principal, que además muestra una
  vista previa pequeña. En la ventana: F pantalla completa, B apagón, Esc
  salir.

### Ánimo

Un deslizador de **Relax** a **Psicodélico** que ajusta escenas, paleta,
velocidad e intensidad al mismo tiempo.

### Escenas

| Psicodélicas | Relajantes | Fiesta |
|---|---|---|
| Caleidoscopio (espejos de 6 a 12 lados) | Aurora (cortinas de luz lentas) | Láser (haces geométricos al beat) |
| Túnel infinito (retroalimentación con zoom) | Océano de noche (olas y luna) | Ecualizador sonidero (barras gigantes con focos) |
| Mandala op-art (líneas que vibran, moiré) | Lluvia en la ventana (gotas y bokeh) | Letras (tipografía en movimiento: track o tu letra) |
| Plasma líquido (colores que se derriten) | Luciérnagas (partículas suaves) | Espejo webcam (tu cámara con efectos) |
| Fractal (zoom sincronizado al bombo) | Nebulosa (espacio profundo) | Retícula retro (horizonte que corre al BPM) |
| Mercurio (metal líquido) | Lámpara de lava | Estrobo seguro (limitado) |
| MilkDrop (cientos de presets) | Respira (círculo de respiración al ritmo de los pads) | |
| | Azotea al atardecer (cielo y siluetas de la ciudad) | |

### Qué mueve a los visuales

La ventana recibe, 60 veces por segundo:

- **Frecuencias**: graves, medios, agudos y 32 bandas finas; volumen y energía.
- **Golpes exactos**: bombo, caja/palmas y hats, tomados de las notas del
  proyecto (no adivinados). En DJ o con audio importado se detectan.
- **Tiempo**: BPM, compás, fase del beat, sección actual y cuánto falta para
  el drop.
- **Armonía**: tonalidad, acorde y notas que suenan (modo **Sinestesia**:
  cada nota tiene su color).
- **Voz**: nivel, tono y la línea de la letra que va.

### Mapeo

"Qué mueve qué", con presets ("Bombo › zoom", "Palmas › destello",
"Bajo › ondulación", "Voz › brillo", "Acorde › paleta") y, en Pro, cualquier
señal a cualquier parámetro.

### Piloto automático

Cambia de escena al empezar cada sección, sube la intensidad en las
subidas, "explota" al entrar el drop y baja a algo tranquilo en las pausas.

### Capas

Texto (artista, track, letra en karaoke), logo o imagen, video y webcam.

### Grabar

- **Grabar video**: MP4 horizontal (16:9) o vertical (9:16 para TikTok y
  Reels) con el audio.
- **Exportar canción con visuales**: render cuadro por cuadro, sin tirones.

### Para pros `F5`

Salidas Spout (Windows), Syphon (macOS) y NDI para OBS, Resolume o
proyectores en red. Editor de escenas con recarga en vivo; importar ISF y
shaders tipo Shadertoy respetando sus licencias. Luces LED al ritmo (WLED).

### Seguridad y rendimiento

- **Fotosensibilidad**: aviso la primera vez. **Modo seguro** activado por
  defecto: máximo 3 destellos por segundo, sin cambios bruscos de luz en
  áreas grandes, sin rojo saturado parpadeando. Se puede desactivar con
  confirmación.
- **Calidad automática**: baja la resolución interna si el equipo no llega a
  60 fps; escenas "ligeras" para gráficos integrados.
- La ventana corre en su propio proceso: si se traba, el audio sigue.

## 3.11 Aprender y ayuda

- **Modo Fácil / Pro**, global y por instrumento `F1`.
- **Retos** (3 en `F1`, más de 10 en `F2`): misiones cortas dentro de la app
  real, no videos. "Tu primer dembow", "Bombeo como pro", "Arma un drop",
  "Graba un coro con tres tomas", "Tu primera mezcla de dos tracks".
  Progreso y logros, sin exagerar.
- **Tips** contextuales (se pueden apagar) con "¿Por qué suena así?" y un
  antes/después para escuchar.
- **Glosario** en español con audio de ejemplo (swing, bombeo, reverb…).
- **Copiloto** `F5`: asistente con IA que responde preguntas sobre tu
  proyecto y, si se lo pides, hace cambios con vista previa y deshacer (ver
  doc 5).

## 3.12 Proyectos, exportar y compartir

- Proyecto = carpeta `.house` con el documento, los audios y los renders `F1`.
- **Exportar**: WAV, FLAC, MP3 `F1`; OGG, stems por pista o por grupo, MIDI
  `F2`; video con visuales `F3`; **paquete de remix** (stems + BPM + tono)
  para compartir `F2`.
- **Importar**: MIDI, audio y sample packs `F1`/`F2`; DAWproject `F5`.
- **Enviar a DJ**: automático al guardar `F4`.

## 3.13 Accesibilidad y ajustes

- Todo se puede operar con teclado, con foco visible; etiquetas para lectores
  de pantalla en cada control.
- Menos movimiento, alto contraste, escala de interfaz del 80 al 200%.
- Familias distinguibles sin color (pictograma y claridad distinta).
- Español de México primero; inglés después.
- Espejo para zurdos `F5`.

## 3.14 Atajos principales

Los atajos de una sola letra solo funcionan con el **teclado musical
apagado**. Los demás funcionan siempre.

| Acción | Siempre | Con el teclado musical apagado |
|---|---|---|
| Reproducir / parar | Espacio | |
| Grabar | F9 | R |
| Teclado musical | Tab | |
| Patrón, Canción, Mezcla, Voz, DJ | F1 a F5 | |
| Abrir o cerrar Visuales | F6 | V |
| Metrónomo | F7 | M |
| Bucle | F8 | L |
| Deshacer / rehacer | Ctrl+Z / Ctrl+Shift+Z (⌘ en Mac) | |
| Guardar | Ctrl+S | |
| Duplicar | Ctrl+D | |
| Exportar | Ctrl+E | |
| Buscar sonidos | Ctrl+F | |
