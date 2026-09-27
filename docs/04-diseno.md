# 4. Diseño de interfaz

La interfaz es lo más importante de HOUSE. Este documento explica la
dirección visual, por qué se eligió cada cosa y cómo se ve cada pantalla.
Las reglas exactas (colores, tamaños, radios) están en
[`DESIGN.md`](../DESIGN.md).

Los bocetos de Inicio, Estudio, Cabina DJ, Voz y Visuales están en
[`diseno/`](../diseno/README.md): capturas, HTML para abrir en el navegador y
un [canvas en Claude](https://claude.ai/artifact/7toJbEqNAjbrJkWBkyS6FA)
para verlos con zoom y comentarlos.

## 4.1 Lo que no queremos

Hoy casi todas las apps hechas con ayuda de IA se ven iguales. Reconocerlo es
el primer paso para no caer ahí:

- Fondo casi negro con un solo acento verde ácido o morado, halos de neón.
- Degradados morado-azul, "vidrio" translúcido, manchas de color difuminadas.
- Todo metido en tarjetas redondeadas idénticas, con el mismo borde gris y la
  misma sombra.
- Tipografía Inter (o Space Grotesk) en todo; etiquetitas en MAYÚSCULAS
  encima de cada bloque; textos tipo "A · B · C"; flechas "→" en los botones.
- Íconos genéricos, emoji, el ícono de "destellos" para cualquier cosa de IA.
- Animaciones de "aparecer deslizando" en cada panel.

Un DAW genérico además suele ser gris azulado, plano y sin personalidad. HOUSE
tiene que sentirse como un **instrumento** y como **algo de aquí**.

## 4.2 La dirección: "Sonidero"

HOUSE mezcla tres mundos que tienen que ver con quién la usa y con lo que
hace:

1. **Los aparatos de música.** Grooveboxes, cajas de ritmos y mezcladoras de
   DJ: chasis de metal, pantallas oscuras, pads de hule, teclas de pasos en
   colores por grupos, perillas con marca, LEDs. Esto da el "cuerpo" de la
   interfaz: se ve como algo que se toca.
2. **El cartel sonidero y la rotulación.** Los carteles de bailes y sonidos en
   México se imprimen con tintas fluorescentes y letras enormes, con texto
   negro sobre rosa, amarillo o verde. Esto da el color y la actitud: tintas
   planas, fuertes, con texto negro encima.
3. **Chicago y el house.** El house nació en Chicago. La tipografía de display,
   Big Shoulders, se diseñó para la ciudad de Chicago a partir de su historia
   industrial y de baile. Condensada, alta y dura, cabe mucho en poco espacio
   (perfecto para nombres de pistas y secciones) y se ve como letrero.

A esto se suma una referencia de señalética: los **pictogramas del Metro de
la Ciudad de México**, donde cada estación se reconoce por un dibujo simple y
cada línea por un color. En HOUSE cada instrumento tiene un pictograma sólido
y cada familia su color, para que quien no lee música reconozca todo de un
vistazo.

## 4.3 Color

La base es un **chasis gris cálido** (`#2A2724`), no negro azulado: cansa
menos la vista en sesiones largas de noche y hace que las tintas se vean como
tinta y no como neón. Las **pantallas** (secuenciador, línea de tiempo, formas
de onda) son más oscuras, como las pantallas de un aparato.

Encima van seis **tintas fluorescentes**, cada una con un significado que no
cambia en toda la app:

| Tinta | Familia | Por qué |
|---|---|---|
| Naranja `#FF6B1A` | Batería | El naranja de las cajas de ritmos clásicas. |
| Amarillo `#FFCB1F` | Bajo | El color más visible, como el bajo en la mezcla. |
| Azul `#6F8BFF` | Sintes y acordes | Frío y armónico. |
| Rosa mexicano `#F0168A` | Voz y grabación; marca | Lo vivo: grabar, saturar, la voz. |
| Verde `#7ED957` | Samples y loops | Material "encontrado". |
| Turquesa `#19C2C2` | Efectos y ambientes | Aire y espacio. |

La regla que más identidad da: **sobre tinta, texto negro**. Nunca blanco.
Así se imprime un cartel y así se cumple el contraste de accesibilidad
(ver números en `DESIGN.md`).

Lo que no se hace: degradados decorativos, halos de color, transparencias
tipo vidrio. La luz de un pad encendido es un relleno más claro, no un brillo.

## 4.4 Tipografía

- **Big Shoulders** (display): logo, BPM, nombres de sección de la
  marquesina, títulos, etiquetas de pads y perillas. Pesos 700 a 900. Tiene
  un eje de tamaño óptico: en chico se abre para leerse bien.
- **Atkinson Hyperlegible Next** (interfaz): todo lo que se lee de corrido:
  menús, tips, listas, ajustes, números que cambian. Fue diseñada para
  personas con baja visión: cada letra es inconfundible (la I, la l y el 1
  no se parecen). Para una app que quiere que cualquiera la entienda, es una
  decisión de fondo, no de estilo.

Reglas: tipo oración en todo (solo "HOUSE" en mayúsculas), signos de apertura
siempre ("¡Drop!", "¿Qué suena hoy?"), números que corren con cifras
tabulares para que no brinquen.

## 4.5 Formas y materiales

- **Paneles sin tarjetas.** Las zonas se separan con **surcos** (una línea
  oscura y una clara), como las placas atornilladas de un aparato. Sin sombras.
- **Pads de hule** con radio de 10 px; al tocarlos se llenan de su tinta y se
  hunden un poco.
- **Teclas de paso** con radio de 3 px, en grupos de cuatro con matices
  distintos (como las cajas de ritmos clásicas) para leer los tiempos sin
  contar.
- **Perillas** con arco de color, marca de posición y el valor abajo.
- **Medidores de segmentos**, no barras lisas.
- **La bocina**: el medidor maestro es un cono de bocina que late con los
  graves. Es un guiño a los sonideros y el único adorno animado permanente.
- **Radios por jerarquía**: 0 en paneles, 3 en teclas, 6 en botones, 8 en
  ventanas, 10 en pads. Nunca uno solo para todo.

## 4.6 Pictogramas e íconos

- **Pictogramas de instrumentos**: figuras sólidas y geométricas dentro de un
  cuadrito del color de la familia. Bombo (círculo con centro), caja
  (cilindro visto de lado), palmas (dos manos abiertas simplificadas), hat
  (dos platillos), bajo (onda gruesa), sinte (teclas), acordes (tres barras
  apiladas), voz (micrófono), sample (tijeras sobre onda), efecto (espiral).
- **Íconos de interfaz**: trazo de 2 px, esquinas rectas, dibujados para
  HOUSE. En la Fase 0 se dibuja el set completo (unos 60 íconos).

## 4.7 Movimiento

"Lo que se mueve solo es lo que suena." Se mueven el cabezal, el paso que
suena, los medidores, la bocina y las luces de la marquesina. Nada entra
deslizándose ni aparece con fundidos al abrir una pantalla.

El **único momento orquestado**: cuando la canción entra a una sección nueva,
la marquesina corre sus luces como los focos de una feria (400 ms). Con
"Menos movimiento", todo pulso se vuelve un cambio de color sin animación.

## 4.8 Voz y textos

- Español de México, de tú, claro antes que chistoso.
- Los botones dicen lo que pasa: "Grabar toma", "Exportar canción", "Abrir en
  pantalla 2". La acción no cambia de nombre en el camino: el botón "Exportar
  canción" termina en el aviso "Canción exportada".
- Nombres humanos con el término pro al lado la primera vez: "Brillo
  (cutoff)", "Bombeo (sidechain)".
- Errores que dicen qué pasó y cómo arreglarlo, sin disculpas: "No encuentro
  tu micrófono. Conéctalo o elige otro en Ajustes › Audio."
- Estados vacíos que invitan a hacer algo: "Presiona una tecla o arrastra un
  sonido aquí."
- La personalidad se guarda para los retos, los tips y los carteles de Inicio.

## 4.9 Pantallas

Todas están pensadas para 1440 × 900 como referencia y se adaptan desde
1280 × 720 hasta pantallas 4K (escala de interfaz).

### Inicio

```
┌──────────────────────────────────────────────────────────────────────┐
│ HOUSE                                              Ajustes  Tu perfil │
├───────────────────────────────┬──────────────────────────────────────┤
│                               │  Hacer un beat              (naranja)│
│  ¿Qué                         │  Grabar mi voz              (rosa)   │
│  suena                        │  Mezclar como DJ            (amarillo)│
│  hoy?                         │  Tocar pads                 (verde)  │
│                               │  Aprender con retos         (azul)   │
│  (cartel tipográfico enorme)  ├──────────────────────────────────────┤
│                               │  Elige un estilo: tiras con BPM y    │
│                               │  pre-escucha al pasar el cursor      │
├───────────────────────────────┴──────────────────────────────────────┤
│  Tus proyectos: tira con mini-marquesina de secciones de cada uno    │
└──────────────────────────────────────────────────────────────────────┘
```

Es la única pantalla con composición de cartel: letras enormes, tiras de
tinta con texto negro, alineado a la izquierda. Cada estilo suena al pasar el
cursor (8 compases de su plantilla).

### Estudio · Patrón (pantalla principal)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HOUSE  Proyecto ▾ │ ■ ▶ ● │ 126 BPM │ La menor │ Swing 56% │ Fácil|Pro │ (o) │
├────────┬─────────────────────────────────────────────────────────────────┤
│Sonidos │ Patrón  Canción  Mezcla  Voz  DJ                    Visuales    │
│        │ ┌ MARQUESINA: Intro │ Subida │ ¡Drop! │ Pausa │ ¡Drop! │ Salida ┐│
│ buscar │ └ curva de energía ─────────────────────────────────────────────┘│
│ chips  │ [pict] Bombo    ■□□□ ■□□□ ■□□□ ■□□□   S M  ──●──                  │
│ lista  │ [pict] Palmas   □□□□ ■□□□ □□□□ ■□□□                               │
│ con    │ [pict] Hat      □□■□ □□■□ □□■□ □□■□                               │
│ pre-   │ [pict] Shaker   ■■■■ ■■■■ ■■■■ ■■■■                               │
│ escucha│ [pict] Bajo     mini piano roll                                   │
│        │ [pict] Acordes  mini piano roll                                   │
├────────┴──────────────────────────────┬──────────────────────────────────┤
│ Instrumento: Ácido · 4 perillas       │ Pads 4×4 con la tecla de cada uno │
│ grandes + preset + Dados              │ Pads | Piano | Escala | Acordes   │
└───────────────────────────────────────┴──────────────────────────────────┘
```

`(o)` es la bocina: el medidor maestro, arriba a la derecha.

El protagonista es la **marquesina**. Todo lo demás es disciplinado: chasis,
pantallas, surcos. Las pistas se reconocen por pictograma y tinta.

### Mezcla

Canales verticales con pictograma y tinta arriba, faders con medidor de
segmentos, envíos "Espacio" y "Eco", y a la derecha el **Mapa de mezcla** (cada
pista es un círculo de su tinta que arrastras en 2D). Abajo, el master con
destino de volumen (Streaming / Club / Al máximo) y el medidor LUFS.

### Voz

```
┌──────────────────────────────────────────────────────────────────────┐
│ barra superior                                                        │
├──────────────────────────────────────────┬───────────────────────────┤
│ Micrófono: [Micrófono USB ▾]  canal 1    │ Letra                     │
│ Medidor grande con "zona buena"          │  Coro                     │
│ Ganancia ──●──   Monitoreo: 6 ms         │   línea 1                 │
│ Quitar ruido [on]  Graves 80 Hz [on]     │   línea 2                 │
│                                          │  Verso 1                  │
│         ( ● GRABAR TOMA )                │   …                       │
│                                          │                           │
│ Tomas: Toma 1 ★  Toma 2  Toma 3          │                           │
│ Presets: Voz reggaetón · Radio · Robot   │                           │
└──────────────────────────────────────────┴───────────────────────────┘
```

### DJ

Dos decks a los lados, mezclador al centro, formas de onda apiladas arriba
(para empatar beats con los ojos), biblioteca abajo. Cada deck con sus stems
(pictogramas de Batería, Bajo, Melodía, Voz). En la esquina, el **chip de
salidas**: "Master › Bocina · Cue › Audífonos", con el aviso de Bluetooth
cuando aplica.

### Visuales (panel en la ventana principal)

Vista previa grande de lo que se ve en la pantalla 2, el deslizador
**Relax ↔ Psicodélico**, escenas en miniatura, "Qué mueve qué", piloto
automático, modo seguro, "Abrir en pantalla 2" y "Grabar video". La ventana de
visuales en sí no tiene interfaz: solo la imagen.

## 4.10 Temas

- **Noche** (por defecto): la paleta de `DESIGN.md`.
- **Día**: chasis claro de aluminio, mismas tintas. Para trabajar de día o
  con mucho sol.
- **Alto contraste**: negro y blanco puros con contornos en todo.

Los Visuales tienen sus propias paletas por escena.

## 4.11 Cómo mantenerlo "no hecho por IA" mientras se construye

1. **`DESIGN.md` es contrato.** Ninguna pantalla usa colores, tamaños o
   radios que no estén ahí. Si hace falta algo nuevo, se decide y se agrega.
2. **Skills del proyecto.** En `.claude/skills/` están `frontend-design`
   (de Anthropic) y `house-ui` (la de este proyecto). Cualquier sesión de IA
   que toque la interfaz las carga antes de escribir código.
3. **Componentes primero.** En la Fase 0 se construye la biblioteca de
   componentes (pad, tecla de paso, perilla, fader, medidor, bocina,
   marquesina, pictogramas) en una página de catálogo. Las pantallas solo
   combinan componentes del catálogo.
4. **Íconos propios.** Se dibuja el set de íconos y pictogramas; no se usa un
   set genérico tal cual.
5. **Revisión con capturas.** Cada pantalla nueva se revisa con captura
   contra la lista de la sección 9 de `DESIGN.md` antes de darse por buena.
6. **Pruebas con personas reales.** Cada fase termina probando con 5
   personas que nunca han hecho música (ver doc 6). Si no entienden algo, se
   cambia el diseño, no se agrega un tutorial.
