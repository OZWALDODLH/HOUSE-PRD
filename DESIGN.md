# DESIGN.md — Sistema visual "Estudio"

Este archivo es el contrato de diseño de HOUSE. Cualquier pantalla, componente o
boceto nuevo (lo haga una persona o una IA) parte de aquí. Si algo no está
definido, se decide a propósito y se agrega aquí; no se rellena con lo "típico".

"Estudio" es la segunda versión del lenguaje visual. La primera ("Sonidero":
carteles de baile, tintas enormes, marquesina de papel, pads de hule) se veía
demasiado a videojuego para quien usa HOUSE, que pidió algo con la seriedad de
FL Studio sin perder lo que ya funciona. Lo que cambió y por qué está en
[`docs/04-diseno.md`](docs/04-diseno.md), sección 4.12. Aquí van las reglas.

---

## 1. Idea en una línea

Un estudio de producción de verdad, denso, preciso y tranquilo, con la
identidad de HOUSE en los detalles: chasis cálido, colores de familia que
siempre significan algo, pantallas de hardware con dígitos grandes y
pictogramas estilo Metro. Las palabras siguen siendo de principiante.

## 2. Color

### 2.1 Neutros

| Token | Hex | Uso |
|---|---|---|
| `fondo` | `#151312` | Lo que se ve entre paneles (las ranuras del rack). |
| `chasis` | `#1F1C1A` | Paneles: barras, navegador, dock, diálogos. Gris cálido, nunca negro azulado. |
| `chasis-alto` | `#2A2724` | Controles en reposo, filas en hover, pestañas inactivas. |
| `chasis-activo` | `#35312D` | Control presionado, pestaña activa, fila elegida. |
| `pantalla` | `#121110` | Editores: secuenciador, arreglo, piano roll, línea de tiempo, formas de onda. |
| `linea` | `#34302C` | Líneas de 1 px: bordes de campos, divisiones de compás. |
| `linea-suave` | `#25221F` | Rejilla fina dentro de las pantallas (tiempos, pasos). |
| `tinta` | `#EEE8DE` | Texto principal (13.9:1 sobre chasis). |
| `tinta-2` | `#B5AC9F` | Texto secundario (7.6:1). |
| `tinta-3` | `#958C80` | Apoyo: nunca algo que haya que leer para operar (5.1:1 sobre chasis; no usar sobre `chasis-activo`). |
| `negro-tinta` | `#161412` | Texto SIEMPRE que va sobre una tinta. |

### 2.2 Tintas (familias de sonido)

Cada familia tiene una tinta. El color siempre significa lo mismo en toda la
app: tira de color de la pista, pasos, notas, bloques del arreglo, pictograma y
medidor del canal.

| Token | Hex | Familia | Contraste con `negro-tinta` |
|---|---|---|---|
| `naranja` | `#FF6B1A` | Batería (bombo, caja, palmas, hats, percusión) | 6.4:1 |
| `amarillo` | `#FFCB1F` | Bajo (Ácido, 808, bajos pulsados, Reese) | 12.1:1 |
| `azul` | `#6F8BFF` | Sintes y acordes (Analógico, Teclas FM, Supersaw, Cuerdas) | 6.0:1 |
| `rosa` | `#F0168A` | Voz y grabación. También marca y botón de grabar. | 4.5:1 |
| `verde` | `#7ED957` | Samples y loops | 10.5:1 |
| `turquesa` | `#19C2C2` | Efectos, transiciones y ambientes | 8.3:1 |

### 2.3 Reglas de color

1. Sobre una tinta, el texto y los íconos van en `negro-tinta`. Nunca blanco.
2. Las tintas son planas: sin degradados decorativos, sin halos de neón, sin
   vidrio esmerilado.
3. **Rellenos grandes** (bloques del arreglo, fondo de un clip, la fila de la
   pista elegida) usan la tinta mezclada al 22–30 % sobre `pantalla`
   (`color-mix(in srgb, var(--c) 26%, var(--pantalla))`), con un borde de 1 px
   o una tira de 3 px en la tinta pura. La tinta pura se reserva para objetos
   chicos: pasos encendidos, notas, pictogramas, LEDs, arcos de perilla.
4. La selección y el foco se marcan con un contorno de 2 px en `tinta` (como el
   LED blanco de un aparato), no con el color de marca.
5. Estados, siempre con texto o ícono al lado:
   - `amarillo` = "aquí y ahora": la sección que suena, el acorde que suena.
   - `verde` = "bien": nivel correcto, interruptor encendido.
   - `rosa` = "en vivo o peligro": grabando, saturación, errores.
6. Medidores: `verde` hasta −12 dBFS, `amarillo` hasta −3 dBFS, `rosa` arriba.
7. Si dos cosas deben distinguirse, además del color cambian de forma,
   pictograma o claridad (daltonismo).
8. El cabezal de reproducción es una línea de 2 px en `tinta` con un
   triángulo arriba; mientras graba, en `rosa`.

### 2.4 Tonos de controles

Matices del chasis para piezas de los controles. No significan nada por sí mismos.

| Token | Hex | Uso |
|---|---|---|
| `paso` | `#2E2A27` | Tecla de paso apagada, tiempos 1 y 3 del compás. |
| `paso-b` | `#262320` | Tecla de paso apagada, tiempos 2 y 4 (el matiz que separa los tiempos). |
| `led-apagado` | `#3A3531` | Segmento de medidor apagado, riel de fader, interruptor apagado. |
| `tecla-blanca` | `#D9D2C6` | Teclas blancas del piano roll y del teclado en pantalla. |
| `tecla-negra` | `#1A1816` | Teclas negras. |

## 3. Tipografía

| Rol | Familia | Pesos | Notas |
|---|---|---|---|
| Interfaz y texto: todo lo que se lee | **Atkinson Hyperlegible Next** (OFL, variable 200–800) | 400, 500, 700 | Diseñada para máxima legibilidad. `font-variant-numeric: tabular-nums` en tiempos, dB, ms y BPM. |
| Pantallas de hardware: logo, dígitos del transporte (posición, BPM), números grandes de un diálogo | **Big Shoulders** (OFL, variable 100–900) | 700–900 | Condensada e industrial (Chicago, donde nació el house). Solo para números y la marca. Cada dígito que cambia va en una celda de ancho fijo. |

- No se usan Inter, Roboto, Arial, Space Grotesk ni monoespaciadas para etiquetas.
- Mayúsculas sostenidas: solo en la marca (HOUSE). Todo lo demás en tipo
  oración: "Pre-escucha", no "PRE-ESCUCHA".
- Nada de etiquetas "sobre-título" encima de cada bloque. Un panel tiene, a lo
  más, un título de 12 px en `tinta-2`.
- El signo de apertura (¡ ¿) se usa siempre: "¡Drop!".

### Escala (px)

`11 · 12 · 13 · 14 · 16 · 20 · 24 · 32`

- Texto base: 13 px Atkinson 500, interlineado 1.35.
- Controles densos (filas del rack, menús, etiquetas de perilla): 12 px.
- Anotaciones en `tinta-3`: 11 px, nunca menos.
- Título de panel: 12 px Atkinson 700 `tinta-2`. Título de diálogo: 16 px 700.
- Dígitos del transporte: 22–26 px Big Shoulders 800.
- El título más grande de la app (Inicio): 24 px Atkinson 700. Nada más grande.

## 4. Forma y material

### 4.1 Radios por jerarquía (nunca uno solo para todo)

| Elemento | Radio |
|---|---|
| Paneles | 0 |
| Pasos, notas, bloques del arreglo, puntos de curva | 2 px |
| Botones, campos, pestañas | 4 px |
| Pads del teclado musical | 6 px |
| Menús, diálogos, burbujas del tutorial | 8 px |
| Chips de filtro | píldora (999 px) |

### 4.2 El rack

Los paneles se separan por ranuras de 3 px de `fondo`, como los módulos de un
rack; dentro de un panel, las divisiones son líneas de 1 px `linea`. Sin
tarjetas con sombra.

### 4.3 Controles

- **Botón**: 26 px de alto (32 px en diálogos), `chasis-alto`, línea clara de
  1 px arriba por dentro. Presionado o activo: `chasis-activo`. Primario: tinta
  del contexto con texto `negro-tinta`.
- **Tecla de paso**: grupos de 4 con matiz alterno (`paso` / `paso-b`) para leer
  el tiempo de un vistazo. Encendido = tinta de la pista, con su claridad según
  la fuerza. Paso que suena = contorno 2 px `tinta`.
- **Nota** (piano roll): rectángulo de radio 2 px en la tinta de la pista,
  borde izquierdo más claro; elegida = contorno 2 px `tinta`.
- **Perilla**: 36 px (48 px en Fácil). Arco de valor de 3 px en la tinta de la
  pista sobre un arco `led-apagado`; cuerpo `chasis-alto`; marca de posición.
  Etiqueta 12 px arriba del valor en Atkinson tabular. Arrastre vertical,
  Shift para fino, doble clic para regresar al valor por defecto.
- **Fader**: riel `pantalla` de 4 px, perilla rectangular de 22×12 px.
- **Medidor**: segmentos de 2 px con 1 px de separación.
- **Medidor maestro**: dos barras de segmentos en la barra de herramientas con
  marca de pico. Sustituye a la bocina animada de "Sonidero".
- **Pad**: `chasis-alto`, radio 6 px, etiqueta de tecla abajo a la izquierda. Al
  tocar se llena de la tinta de su familia y baja a escala 0.97 durante 90 ms.

### 4.4 Profundidad

Solo lo que flota proyecta sombra: menús, diálogos, burbujas del tutorial
(`0 16px 48px rgba(0,0,0,.55)`). Todo lo demás es plano.

## 5. Íconos y pictogramas

- **Íconos de interfaz**: cuadrícula de 24 px, trazo de 2 px, remates rectos,
  dibujados para este proyecto. Se usan a 14–18 px.
- **Pictogramas de instrumentos**: figuras sólidas dentro de un cuadro con radio
  (7/28 del lado), en la tinta de su familia (inspiración: la señalética del
  Metro de la Ciudad de México). En filas y listas miden 18–20 px; 28 px solo en
  la cabecera del instrumento.
- Nunca emoji. Nunca el ícono de "destellos" para funciones de IA.

## 6. Movimiento

| Caso | Duración | Curva |
|---|---|---|
| Presionar (pad, botón) | 90 ms | `cubic-bezier(.2,.8,.2,1)` |
| Alternar, expandir | 160 ms | igual |
| Paneles, cambios de vista | 240 ms | igual |

- Lo que se mueve solo es lo que suena: cabezal, paso activo, medidores.
  Nada de entradas "fade + slide".
- `prefers-reduced-motion` o el ajuste "Menos movimiento": sin animaciones.

## 7. Voz y textos

- Español de México, de tú. Claro antes que ingenioso.
- Menús de programa de verdad (Archivo, Editar, Agregar, Ver, Ayuda) con
  palabras llanas adentro: "Proyecto en blanco", "Importar audio…".
- Botones con verbo que dice lo que pasa: "Grabar toma", "Exportar canción".
  La acción conserva su nombre en todo el flujo.
- Término pro al lado, en `tinta-3`, la primera vez: "Brillo (cutoff)".
- Errores: qué pasó y cómo se arregla. Sin disculpas.
- Estados vacíos invitan a hacer algo: "Arrastra un sonido o un audio aquí."
- La personalidad vive en el tutorial, los retos y los tips, no en los controles.

## 8. Distribución del estudio

```
┌─ Barra de menús ─ HOUSE  Archivo Editar Agregar Ver Ayuda   proyecto   salidas ─┐
├─ Herramientas ─ ■ ▶ ●  posición  BPM  tonalidad  swing  Loop|Canción  ↶ ↷  nivel ─┤
├──────────┬───────────────────────────────────────────────────────────────────────┤
│Navegador │ Vistas: Patrón · Arreglo · Piano roll · Mezcla              Visuales  │
│ Sonidos  ├───────────────────────────────────────────────────────────────────────┤
│ Mis      │ Línea de tiempo: regla, secciones, cabezal que se arrastra            │
│ samples  ├───────────────────────────────────────────────────────────────────────┤
│ Efectos  │ La vista elegida                                                       │
│          ├──────────────────────────────┬────────────────────────────────────────┤
│          │ Instrumento de la pista      │ Teclado musical (pads, piano…)         │
└──────────┴──────────────────────────────┴────────────────────────────────────────┘
```

- La línea de tiempo es el único protagonista: siempre visible, con el cabezal.
- El dock de abajo (instrumento y teclado) se puede ocultar para ganar espacio.
- Todo se alinea a la izquierda; los números, a la derecha dentro de su celda.

## 9. Temas

| Tema | Cambios |
|---|---|
| Noche (default) | Tokens de arriba. |
| Alto contraste | `chasis #000`, `pantalla #000`, texto `#FFF`, contornos de 2 px en todo control. |

La ventana de Visuales no sigue estos temas: tiene su propio lenguaje (escenas).

## 10. Lista de revisión antes de dar por buena una pantalla

- [ ] ¿Usa solo tokens de este archivo?
- [ ] ¿Se ve como herramienta y no como juego? Nada grande porque sí.
- [ ] ¿El texto sobre tintas es `negro-tinta`? ¿Los rellenos grandes usan la tinta mezclada?
- [ ] ¿Hay algún degradado decorativo, halo de neón, vidrio o tarjeta con sombra? Quitarlo.
- [ ] ¿Hay etiquetas en mayúsculas sostenidas, sobre-títulos, flechas "→" en botones o textos "A · B · C"? Quitarlos.
- [ ] ¿Cada color significa una familia o un estado?
- [ ] ¿Se entiende sin color (forma, pictograma, texto)?
- [ ] ¿Los números que cambian no brincan (tabulares o celdas fijas)?
- [ ] ¿Foco visible con teclado? ¿Objetivos de al menos 24 px en controles densos y 32 px en el resto?
- [ ] ¿Respeta "Menos movimiento"?
- [ ] ¿Hay un solo elemento protagonista en la pantalla?
