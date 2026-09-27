# DESIGN.md — Sistema visual "Sonidero"

Este archivo es el contrato de diseño de HOUSE. Cualquier pantalla, componente o
boceto nuevo (lo haga una persona o una IA) parte de aquí. Si algo no está
definido, se decide a propósito y se agrega aquí; no se rellena con lo "típico".

La explicación de por qué se eligió cada cosa está en
[`docs/04-diseno.md`](docs/04-diseno.md). Aquí van las reglas.

---

## 1. Idea en una línea

Un groovebox de hardware pintado con tintas de cartel sonidero: chasis gris
cálido, pantallas oscuras, pads de hule y tinta fluorescente con texto negro
encima, como un cartel de baile impreso en serigrafía.

## 2. Color

### 2.1 Neutros (el chasis)

| Token | Hex | Uso |
|---|---|---|
| `chasis` | `#2A2724` | Fondo de paneles y barras. Gris cálido, nunca negro azulado. |
| `chasis-alto` | `#35312D` | Controles en reposo, filas en hover, pestañas inactivas. |
| `pantalla` | `#181614` | "Pantallas": secuenciador, línea de tiempo, formas de onda, visor de visuales. |
| `surco` | `#12100F` | Línea oscura de las uniones entre paneles (ver 4.2). |
| `bisel` | `#3F3A35` | Línea clara que acompaña al surco. |
| `tinta` | `#F3EDE2` | Texto principal sobre chasis o pantalla (12.7:1 sobre chasis). |
| `tinta-2` | `#B9B0A3` | Texto secundario (6.9:1). |
| `tinta-3` | `#9A9185` | Texto de apoyo, nunca para algo que haya que leer para operar (4.8:1). |
| `negro-tinta` | `#161412` | Texto SIEMPRE que va sobre una tinta fluorescente. |
| `papel` | `#F3EDE2` | Superficie de "cartel": marquesina de secciones, hoja de la letra, caminos de Inicio. Texto encima en `negro-tinta`. |
| `papel-2` | `#E2D9C9` | Hover y relleno suave sobre `papel`. |

### 2.2 Tintas (familias de sonido)

Cada familia tiene una tinta. El color siempre significa lo mismo en toda la
app: pista, pad, clip, forma de onda, medidor de canal y pictograma.

| Token | Hex | Familia | Contraste con `negro-tinta` |
|---|---|---|---|
| `naranja` | `#FF6B1A` | Batería (bombo, caja, palmas, hats, percusión) | 6.5:1 |
| `amarillo` | `#FFCB1F` | Bajo (Ácido, 808, bajos del Analógico) | 12.1:1 |
| `azul` | `#6F8BFF` | Sintes y acordes (Analógico, Ondas, Teclas) | 6.0:1 |
| `rosa` | `#F0168A` | Voz y grabación. También marca, botón de grabar y saturación. | 4.5:1 |
| `verde` | `#7ED957` | Samples y loops | 10.5:1 |
| `turquesa` | `#19C2C2` | Efectos, ambientes, texturas (Nubes) | 8.3:1 |

Tintas extra solo para que la persona coloree pistas a mano: `lila #B69CFF`,
`cobre #D08A57`, `hueso #F3EDE2`.

### 2.3 Reglas de color

1. Sobre una tinta, el texto y los íconos van en `negro-tinta`. Nunca blanco.
   Así se ven los carteles impresos y así se cumple contraste AA.
2. Las tintas son planas. Sin degradados, sin brillos de neón (`box-shadow`
   de color), sin vidrio esmerilado. La luz se representa con un relleno más
   claro, no con un halo.
3. La selección y el foco se marcan con un contorno de 2 px en `tinta`
   (como el LED blanco de un aparato), no con el color de marca.
4. El `rosa` es "en vivo / caliente": grabar, clip saturado, errores y la marca.
   No se usa como decoración.
5. Medidores: `verde` hasta −12 dBFS, `amarillo` hasta −3 dBFS, `rosa` arriba.
6. Si dos cosas deben distinguirse, además del color cambian de forma,
   pictograma o claridad (daltonismo).
7. Tres tintas tienen además un significado de estado, siempre acompañado de
   texto o ícono:
   - `amarillo` = "aquí y ahora": la sección que suena en la marquesina, la
     línea de la letra que va, el camino elegido en Inicio, avisos suaves
     (por ejemplo, "Bocina Bluetooth alineada").
   - `verde` = "bien": nivel correcto, "Combina con A", interruptor encendido.
   - `rosa` = "en vivo o peligro": grabando, saturación, errores.
8. Interruptores encendidos: `verde`, salvo que controlen algo de una familia;
   entonces usan la tinta de esa familia (el bombeo del bajo es `amarillo`).
9. La marquesina es `papel` con secciones separadas por líneas `negro-tinta`
   de 2 px; la sección actual va en `amarillo`, sus focos en `amarillo` con
   contorno negro, y el cabezal es una línea `rosa`.

## 3. Tipografía

| Rol | Familia | Pesos | Notas |
|---|---|---|---|
| Display: logo, BPM grande, nombres de sección, títulos de pantalla, etiquetas de pad | **Big Shoulders** (Google Fonts, OFL, variable `wght` 100–900 y `opsz` 10–72) | 700–900 | Condensada, industrial, hecha para Chicago, donde nació el house. Dígitos proporcionales: para números que cambian, cada dígito va en una celda de ancho fijo. |
| Interfaz y texto: botones, menús, tips, listas, ajustes | **Atkinson Hyperlegible Next** (Google Fonts, OFL, variable `wght` 200–800) | 400, 500, 700 | Diseñada para máxima legibilidad. Tiene `tnum`: usar `font-variant-numeric: tabular-nums` en tiempos, dB, ms y BPM que corren. |

- No se usan Inter, Roboto, Arial, Space Grotesk ni monoespaciadas para
  etiquetas pequeñas.
- Mayúsculas sostenidas: solo en el nombre de marca (HOUSE). Todo lo demás en
  tipo oración: "Pre-escucha", no "PRE-ESCUCHA".
- Nada de etiquetas "sobre-título" encima de cada bloque.
- El signo de apertura (¡ ¿) se usa siempre. Es parte de la identidad: "¡Drop!".

### Escala (px)

`11 · 12 · 13 · 14 · 16 · 20 · 28 · 40 · 64 · 96`

- Texto base de interfaz: 13 px Atkinson 500, interlineado 1.35.
- Etiqueta de control (serigrafía): 12 px Big Shoulders 700, `letter-spacing: .02em`.
- Título de pantalla: 28 px Big Shoulders 800.
- BPM y marquesina: 40–64 px Big Shoulders 900.
- Carteles de Inicio y estados vacíos: 64–96 px Big Shoulders 900.

## 4. Forma y material

### 4.1 Radios por jerarquía (nunca uno solo para todo)

| Elemento | Radio |
|---|---|
| Paneles del chasis | 0 (se separan por surcos) |
| Teclas de paso (secuenciador) | 3 px |
| Botones y campos | 6 px |
| Pads de hule | 10 px |
| Ventanas, menús flotantes, diálogos | 8 px |
| Chips de filtro | píldora (999 px) |

### 4.2 Surcos en lugar de tarjetas

Los paneles no son tarjetas con borde y sombra. Se separan como las placas de
un aparato: una línea `surco` de 2 px seguida de una línea `bisel` de 1 px.
Sin sombras bajo los paneles.

### 4.3 Controles físicos

- **Pad**: relleno `chasis-alto`, línea clara de 1 px arriba por dentro,
  etiqueta de tecla abajo a la izquierda. Al tocar: se llena de la tinta de su
  familia y baja a escala 0.97 durante 90 ms.
- **Tecla de paso**: grupos de 4 pasos con matiz de serigrafía distinto
  (heredado de las cajas de ritmos clásicas) para que el tiempo se lea de un
  vistazo. Paso activo = tinta de la pista. Paso que suena = contorno `tinta`.
- **Perilla**: círculo `chasis-alto` con arco de valor en la tinta de la pista
  (3 px), marca de posición, valor debajo en Atkinson tabular. Arrastre
  vertical, Shift para fino, doble clic para regresar al valor por defecto.
- **Fader**: riel `pantalla` de 4 px, perilla rectangular de 28×14 px con
  línea central.
- **Medidor**: escalera de segmentos de 3 px con 1 px de separación.
- **Bocina** (medidor maestro): cono de círculos concéntricos que se mueve con
  los graves. Es el único adorno animado permanente de la barra superior.

### 4.4 Profundidad

Solo lo que flota proyecta sombra: menús, diálogos, ventana de visuales en
modo vista previa (`0 24px 64px rgba(0,0,0,.5)`). Todo lo demás es plano.

## 5. Íconos y pictogramas

- **Íconos de interfaz**: cuadrícula de 24 px, trazo de 2 px, remates rectos,
  dibujados para este proyecto. No se usa un set genérico tal cual.
- **Pictogramas de instrumentos**: figuras sólidas y geométricas dentro de un
  cuadro de 28 px con radio 7 px, en la tinta de su familia (inspiración:
  la señalética de pictogramas del Metro de la Ciudad de México). Uno por
  instrumento: bombo, caja, palmas, hat, percusión, bajo, sinte, acordes, voz,
  sample, efecto.
- Nunca emoji. Nunca el ícono de "destellos" para funciones de IA.

## 6. Movimiento

| Caso | Duración | Curva |
|---|---|---|
| Presionar (pad, botón) | 90 ms | `cubic-bezier(.2,.8,.2,1)` |
| Alternar, expandir | 160 ms | igual |
| Paneles, cambios de espacio | 240 ms | igual |

- Lo que se mueve solo es lo que suena: cabezal, paso activo, medidores,
  bocina, luces de la marquesina. Nada de entradas "fade + slide" por sección.
- Un solo momento orquestado: al cruzar a una sección nueva, la marquesina
  corre sus luces como los focos de una feria (400 ms).
- `prefers-reduced-motion` o el ajuste "Menos movimiento": los pulsos se
  vuelven cambios de color sin animación.

## 7. Voz y textos

- Español de México, de tú. Claro antes que ingenioso.
- Botones con verbo que dice lo que pasa: "Grabar toma", "Exportar canción",
  "Abrir en pantalla 2". La acción conserva su nombre en todo el flujo.
- Término pro al lado, en `tinta-3`, la primera vez: "Brillo (cutoff)".
- Errores: qué pasó y cómo se arregla. Sin disculpas.
  "No encuentro tu micrófono. Conéctalo o elige otro en Ajustes › Audio."
- Estados vacíos invitan a hacer algo: "Presiona una tecla o arrastra un sonido aquí."
- La personalidad vive en tips, retos y carteles, no en los controles.

## 8. Temas

| Tema | Cambios |
|---|---|
| Noche (default) | Tokens de arriba. |
| Día | `chasis #D9D4CA`, `chasis-alto #E6E2D9`, `pantalla #F4F1EA`, texto `#1F1C19`. Las tintas no cambian. |
| Alto contraste | `chasis #000`, `pantalla #000`, texto `#FFF`, contornos de 2 px en todo control. |

La ventana de Visuales no sigue estos temas: tiene su propio lenguaje (escenas).

## 9. Lista de revisión antes de dar por buena una pantalla

- [ ] ¿Usa solo tokens de este archivo?
- [ ] ¿El texto sobre tintas es `negro-tinta`?
- [ ] ¿Hay algún degradado decorativo, halo de neón, vidrio o tarjeta con sombra? Quitarlo.
- [ ] ¿Hay etiquetas en mayúsculas sostenidas, sobre-títulos, flechas "→" en botones o textos "A · B · C"? Quitarlos.
- [ ] ¿Cada color significa una familia o un estado?
- [ ] ¿Se entiende sin color (forma, pictograma, texto)?
- [ ] ¿Los números que cambian no brincan (tabulares o celdas fijas)?
- [ ] ¿Foco visible con teclado? ¿Objetivos de al menos 32 px (44 px en táctil)?
- [ ] ¿Respeta "Menos movimiento"?
- [ ] ¿Hay un solo elemento protagonista en la pantalla?
