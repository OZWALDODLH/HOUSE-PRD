# 6. Hoja de ruta

## 6.1 Supuestos

- Equipo: **1 persona desarrollando de tiempo completo con ayuda de IA**
  (Claude Code). Con 2 personas, las Fases 3 y 4 pueden ir en paralelo con la
  2 y el total baja a unos 5–6 meses.
- Las duraciones son estimaciones para planear, no promesas. Cada fase
  termina con una **prueba con personas** y solo se pasa a la siguiente si se
  cumplen sus criterios de salida.
- Orden elegido: primero lo que hace que la app suene y se sienta bien
  (motor + estudio), luego canción y voz, luego visuales y DJ, al final lo
  pro y la IA. La multi-salida se **diseña** desde la Fase 0 aunque la cabina
  DJ llegue después, porque cambiarla luego sería rehacer el motor.

## 6.2 Fases

### Fase 0 · Cimientos (≈4 semanas)

**Objetivo:** demostrar que lo difícil funciona y fijar el diseño.

- Pruebas técnicas ("spikes"):
  1. Tauri + `cpal`: presionar una tecla y oír un bombo; medir latencia.
  2. Dos dispositivos de salida con compensación de deriva durante 30 minutos.
  3. Ventana secundaria en el monitor 2, en pantalla completa, con WebGL2 a
     60 fps recibiendo datos del motor.
  4. Grabar el micrófono y reproducirlo alineado con el beat.
- Sistema de diseño v1: tokens de `DESIGN.md` en código, tipografías,
  catálogo con los componentes base (pad, tecla de paso, perilla, fader,
  medidor, bocina, marquesina), set de íconos y pictogramas.
- Prototipo navegable de las pantallas (a partir de los bocetos).
- Repositorio de código, CI, política de licencias.

**Criterios de salida:** tecla › sonido en menos de 10 ms (ASIO/CoreAudio);
dos salidas 30 minutos sin clics; visuales a 60 fps en el monitor 2; 5
personas entienden el prototipo de Inicio y Patrón sin ayuda.

### Fase 1 · "Mi primer beat" — MVP (≈10 semanas)

- Motor: transporte, tempo, swing, patrones de 16/32/64 pasos, metrónomo.
- Instrumentos: **Máquina**, **Ácido**, **808**, **Analógico**, **Sampler**
  básico.
- Teclado musical: Pads (32), Piano, Escala, Soundboard.
- Mezclador básico con dos envíos, **bombeo en un clic**, efectos esenciales
  (EQ, filtro, compresor, reverb, delay, saturación, limitador), master
  básico.
- Plantillas: **Tech house, Techno, House, Reggaetón, Lo-fi**.
- Pantallas: Inicio y Patrón; Modo Fácil/Pro; 3 retos.
- Guardar y abrir, autoguardado, deshacer; exportar WAV y MP3.
- Salida por un dispositivo con buses (metrónomo solo a audífonos si hay dos
  canales).

**Criterios de salida:** una persona que nunca ha hecho música hace un beat
de 8 compases que le gusta en menos de 10 minutos (probar con 5–10
personas); 1 hora sin cortes de audio con 12 pistas en una laptop de gama
media.

### Fase 2 · "Mi canción" (≈8 semanas)

- Canción: línea de tiempo, **marquesina de secciones**, **De loop a
  canción**, vista de clips, piano roll, automatización.
- Audio: importar y arrastrar, editor de sample, chops, ajustar a tempo y
  tono, remuestrear.
- **Voz**: asistente de micrófono, monitoreo, tomas en bucle, punch,
  afinación, quitar ruido, presets, panel de letra.
- Instrumentos: **Ondas**, **Nubes**, **Teclas**, **Voces** (chops).
- Efectos de la lista F2; grupos; asistentes de mezcla; mapa de mezcla;
  referencia A/B; master completo.
- Teclado musical: Acordes, Lanzador, FX en vivo, repetición de nota.
- Más plantillas (afro house, trap, moombahton, tribal guarachero, psytrance,
  amapiano, funk brasileño, phonk, hard techno, melódico, ambient).
- Exportar stems, MIDI y paquete de remix; Máquina del tiempo.

**Criterios de salida:** una canción completa de 3 minutos con voz grabada,
hecha por alguien con 2 semanas usando la app; las 5 personas de prueba
logran grabar su voz a tiempo sin ayuda.

### Fase 3 · "Visuales" (≈6 semanas)

- Ventana de visuales, "Abrir en pantalla 2", pantalla completa, memoria de
  configuración.
- Motor de escenas, **16 escenas** (6 psicodélicas, 6 relajantes, 4 de
  fiesta) + MilkDrop.
- Señales exactas del proyecto (golpes, secciones, drop), mapeo "Qué mueve
  qué", ánimo Relax ↔ Psicodélico, piloto automático.
- Capas de texto, logo y letra; webcam.
- Modo seguro, calidad automática.
- Grabar video 16:9 y 9:16; exportar canción con visuales.

**Criterios de salida:** 60 fps a 1080p en gráficos integrados con escenas
ligeras; el drop se "siente" en los visuales (prueba a ciegas con personas:
¿notan cuándo entra el drop?); cero destellos arriba de 3 por segundo en
modo seguro (medido).

### Fase 4 · "Cabina DJ" (≈8 semanas)

- Biblioteca con **renders automáticos de tus proyectos** (track + stems +
  análisis exacto) y análisis de archivos importados.
- 2 decks (4 en Pro), mezclador DJ, sync, key lock, hot cues, loops, efectos
  de beat, **stems por deck**, intercambio de voz.
- **Multi-salida completa**: Master y Pre-escucha en dispositivos distintos,
  remuestreo adaptativo, alinear salidas, aviso Bluetooth, split cue.
- Perfiles de controladores comunes y aprender MIDI.
- Mezcla asistida, piloto automático, grabar el set.

**Criterios de salida:** 2 horas con bocina y audífonos en dispositivos
distintos sin desfase audible; una persona sin experiencia hace una
transición limpia con Mezcla asistida en su primer intento.

### Fase 5 · "Pro + IA" (continua)

- Separación de stems con IA, audio del sistema, "parecidos a este".
- Plugins VST3 y CLAP en proceso aparte.
- Instrumentos **FM** y **Cuerdas y maderas**; vocoder; comping.
- **Copiloto** con IA.
- Tararea tu idea, beatbox a batería, ayudante de rimas.
- Celular como pads, control de videojuegos, luces LED (WLED).
- Spout, Syphon y NDI; editor de escenas; ISF.
- DAWproject; Linux; inglés.

**Hito "1.0"**: al cerrar la Fase 4 (≈36 semanas con una persona; ≈5–6
meses con dos).

## 6.3 Resumen visual

```
Semana  0   4         14      22    28      36
F0      ▇▇▇▇
F1          ▇▇▇▇▇▇▇▇▇▇
F2                    ▇▇▇▇▇▇▇▇
F3                            ▇▇▇▇▇▇
F4                                  ▇▇▇▇▇▇▇▇
F5                                          ▇▇▇▇▇▇▇▇▇▇ …
```

## 6.4 Contenido: sonidos, presets y retos

Una app de música es tan buena como sus sonidos. Plan:

- **Batería sintetizada** en la Máquina: la mayoría de los kits se generan con
  el propio motor (sin problemas de licencia y muy ligeros).
- **Presets propios**: mínimo 30 por instrumento en F1 y F2, etiquetados por
  género y ánimo, hechos con criterio de productor (contratar o colaborar con
  productores locales de tech house, techno y reggaetón).
- **Samples**: grabar percusión latina, voces y efectos propios; complementar
  con bancos de licencia libre (revisando cada licencia, p. ej. CC0).
- **Plantillas** por género con groove, kit, escala y estructura.
- **Retos** escritos y probados con personas reales.

## 6.5 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Latencia alta en Windows sin interfaz ni ASIO | Alta | Alto | Modo WASAPI exclusivo; guía para elegir buffer; recomendar interfaz económica; indicador de latencia visible. |
| Bocinas Bluetooth con 150–300 ms de retraso | Alta | Medio | Detectar y avisar; "Alinear salidas"; recomendar cable para grabar y tocar. |
| Deriva entre dos dispositivos | Media | Alto | Remuestreo adaptativo desde la Fase 0; recomendar un solo dispositivo con 4 salidas. |
| El proyecto es enorme y nunca se termina | Alta | Alto | Fases con criterios de salida; el MVP ya es útil; decir que no a lo que no esté en la fase. |
| Diferencias entre WebViews (Windows vs macOS) | Media | Medio | Matriz de pruebas desde F0; evitar CSS experimental; visuales con WebGL2 como base. |
| Fallas al colocar ventanas en otro monitor (Tauri) | Media | Medio | Mover y luego pantalla completa; probar en F0; plan B con código nativo por plataforma. |
| Licencias incompatibles | Media | Alto | Política de licencias y revisión automática en CI. |
| Sonidos mediocres | Media | Alto | Presupuesto y tiempo para diseño sonoro; productores invitados. |
| Visuales que provocan convulsiones | Baja | Muy alto | Modo seguro por defecto con límite medido; aviso; pruebas. |
| La interfaz termina viéndose genérica | Media | Alto | `DESIGN.md` como contrato, skills del proyecto, catálogo de componentes, revisión con capturas, pruebas con personas. |
| Teclados que no registran varias teclas | Media | Bajo | "Prueba tu teclado"; recomendaciones; MIDI. |
| Nombre ya registrado | Media | Medio | Revisar IMPI/USPTO/EUIPO antes de lanzar. |

## 6.6 Cómo medimos si va bien

| Métrica | Meta |
|---|---|
| Tiempo al primer beat que a la persona le gusta | Menos de 5 minutos para el 80% |
| Latencia tecla › sonido | Menos de 10 ms (ASIO/CoreAudio), menos de 25 ms (WASAPI compartido) |
| Cortes de audio | 0 en una hora con 16 pistas en laptop de gama media, buffer 256 |
| Visuales | 60 fps a 1080p con escenas ligeras en gráficos integrados |
| Deriva en DJ | Imperceptible en 2 horas con dos dispositivos |
| Retención | La persona vuelve a abrir la app en la semana siguiente |
| Canciones terminadas | Porcentaje de proyectos que llegan a exportarse |

## 6.7 Decisiones que te tocan a ti

1. **Nombre** público (HOUSE, Latido u otro).
2. **Plataforma principal**: ¿Windows, Mac o las dos desde el inicio?
3. **Código abierto o cerrado**: cambia qué librerías se pueden usar (ver
   5.10) y el modelo de negocio.
4. **Tu equipo**: qué micrófono, interfaz, bocina, audífonos y controlador
   tienes o piensas comprar, para probar con eso desde la Fase 0.
5. **Presupuesto para sonidos** y si quieres invitar productores.
6. **Gratis, de pago o mixto** (por ejemplo, la app gratis y paquetes de
   sonidos o funciones Pro de pago).

## 6.8 Cómo seguir con Claude

- Cada fase se trabaja en ramas y sesiones enfocadas en un entregable
  ("Fase 0 · spike de multi-salida").
- Toda sesión que toque la interfaz usa las skills `house-ui` y
  `frontend-design` de `.claude/skills/` y respeta `DESIGN.md`.
- `CLAUDE.md` en la raíz resume las decisiones para que cada sesión nueva
  arranque con el contexto correcto.

## 6.9 Estado (septiembre de 2026)

La Fase 0 y el núcleo de la Fase 1 están construidos y probados de forma
automática. Lo que falta es medir en equipo real y probar con personas.

### Fase 0

| Entregable | Estado |
|---|---|
| Spike 1: tecla › sonido | Hecho: audio nativo con `cpal`, bloques de 256 muestras (5.3 ms a 48 kHz) y la tecla dispara el sonido sin pasar por el secuenciador. **Falta medir** los 10 ms en Windows y Mac con equipo real. |
| Spike 2: dos salidas 30 minutos | Hecho: pre-escucha en otro aparato con remuestreo adaptativo. Prueba automática: 30 minutos simulados con ±200 ppm de deriva y bloques distintos, sin cortes ni clics. **Falta** la prueba con dos aparatos reales. |
| Spike 3: visuales en el monitor 2 | Hecho: ventana aparte (navegador y escritorio), "Abrir en pantalla 2", 8 escenas y modo seguro medido. **Falta medir** 60 fps en gráficos integrados. |
| Spike 4: grabar el micrófono | Grabar tomas y usarlas en pads: hecho. Alinear la toma con el beat (compensar latencia de entrada) pasa a la Fase 2 con el módulo Voz. |
| Sistema de diseño v1 en código | Hecho: tokens de `DESIGN.md`, tipografías empaquetadas, pad, tecla de paso, perilla, fader, medidor, bocina, marquesina, pictogramas e íconos propios. La página de catálogo (Storybook o Ladle) queda pendiente. |
| Prototipo navegable | Reemplazado por la app real. |
| Repositorio, CI, licencias | Hecho: CI con formato, clippy, pruebas, pruebas en navegador, revisión de licencias (`cargo-deny` y npm) e instaladores de los tres sistemas. |

### Fase 1

| Entregable | Estado |
|---|---|
| Motor: transporte, tempo, swing, 16/32/64 pasos, metrónomo | Hecho. |
| Máquina, Ácido, 808, Analógico, Sampler básico | Hecho. |
| Teclado musical: Pads, Piano, Escala, Soundboard | Hecho: 16 pads de pistas + 16 notas en escala (32 teclas), piano, escala y Soundboard (40 teclas, cualquier sonido o tu voz, suena aunque la canción esté parada). |
| Mezclador, bombeo en un clic, efectos esenciales, master | Hecho: dos envíos (espacio y eco), filtro de DJ, EQ de 3 bandas, saturación, compresor de pegamento, limitador y destino de volumen. |
| Plantillas: tech house, techno, house, reggaetón, lo-fi | Hecho. |
| Inicio, Patrón, Modo Fácil/Pro, 3 retos | Hecho, y además la pestaña Mezcla. |
| Guardar, abrir, autoguardado, deshacer | Hecho (archivo `.house` con el audio adentro). |
| Exportar WAV y MP3 | WAV hecho (16 y 24 bits, más rápido que tiempo real). **MP3 pendiente**: el codificador libre (LAME) es LGPL y solo puede ir enlazado dinámicamente o como programa aparte. |
| Salida por un dispositivo con buses | Hecho, y en escritorio también en dos aparatos. |

**Adelantado de otras fases** porque las plantillas lo necesitaban o porque
cambiarlo después sería rehacer el motor: marquesina con secciones y modo
Canción (F2), ventana de visuales con piloto automático (F3), dos salidas con
compensación de deriva (F4) y grabar voz a un pad (F2).

**Criterios de salida pendientes**: la prueba con 5 a 10 personas (primer beat
en menos de 10 minutos) y una hora sin cortes con 12 pistas en una laptop de
gama media.


### Segunda ronda: lo que se pidió después de probar la app

Después de probar la Fase 1 se pidieron estos cambios. Varios son de la Fase 2
(arreglo, piano roll, automatización, editor de audio) y se adelantaron por
ese pedido explícito.

| Pedido | Estado |
|---|---|
| Recortar el audio al grabar para elegir la parte favorita | Hecho: al parar la toma se abre el editor de audio (asas, zoom, escuchar la parte, suavizar, al revés). El mismo editor abre archivos importados o soltados y el audio de cualquier pista ("Editar audio"). |
| Mover la línea de tiempo que avanza al reproducir | Hecho: clic o arrastre en la regla (se pega al tiempo; con Shift, al paso), flechas para mover un tiempo o un compás, y la pantalla de posición muestra compás, tiempo y paso aunque esté parado. |
| Más sonidos y una interfaz que no parezca videojuego | Hecho: 72 sonidos (toms, bongos, clave, pandero, ride, 808, láser, corneta, caída de sub, teclas FM, supersaw, guitarras, arpa, koto…) y el diseño "Estudio" (ver 4.12). |
| Proyectos nuevos en blanco | Hecho: en Inicio, en Archivo y con Ctrl+N. |
| Agregar, mover y borrar acordes | Hecho: tira de acordes en el piano roll, los 7 acordes de la tonalidad con lo que se siente, progresiones, inversiones, octavas, copiar y un bajo que sigue los acordes. |
| Curvas de transición entre partes | Hecho: vista Arreglo con curvas editables (puntos y tensión) y ocho transiciones listas para cualquier sección. |
| Más audios, efectos y géneros | Hecho: 12 efectos por pista (dos espacios en cada una) y 21 plantillas en cuatro grupos: tech house, techno, house, EDM, trance, dubstep, drum & bass, UK garage, reggaetón, trap, drill, hip hop, phonk, dembow, cumbia, moombahton, afrobeats, amapiano, lo-fi, pop y synthwave. |
| Un tutorial que enseñe todo y señale dónde está cada cosa | Hecho: 11 lecciones (estudio, ritmo, pads, bajo y escala, melodía, acordes, estructura, transiciones, voz y samples, mezcla y efectos, exportar), cada una con su proyecto de práctica. |
| Hacer samples arrastrando o metiendo audios | Hecho: soltar archivos en el estudio, en una pista, en un pad o en una tecla del Soundboard; cortar en pads (partes iguales o por golpes) y Mis samples para usarlos en cualquier proyecto. |
| Extender el programa como FL Studio, sin perder lo que había | Hecho: barra de menús, navegador, cuatro vistas (Patrón, Arreglo, Piano roll, Mezcla) y efectos en la mezcla; Fácil/Pro, pads, Soundboard, retos, visuales y exportar siguen igual. |

**Pendiente de esta ronda**: probar el tutorial con personas que nunca han
hecho música y medir cuánto tardan en terminar las lecciones 1 a 6.
