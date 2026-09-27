# Bocetos de interfaz

Cinco pantallas de referencia de HOUSE con el sistema visual "Sonidero"
(reglas en [`../DESIGN.md`](../DESIGN.md), explicación en
[`../docs/04-diseno.md`](../docs/04-diseno.md)).

Hay tres formas de verlas:

1. **Capturas** en [`capturas/`](capturas/) (se ven directo en GitHub).
2. **HTML** en [`bocetos/`](bocetos/): ábrelos en el navegador para verlos a
   1440 × 900 con las tipografías reales.
3. **Canvas en Claude**: [Interfaz HOUSE](https://claude.ai/artifact/7toJbEqNAjbrJkWBkyS6FA),
   con zoom, comentarios y algunos controles que responden (pasos del
   secuenciador, pads, caminos y estilos de Inicio, interruptores de
   Visuales). Es privado hasta que lo compartas desde su menú.

| Pantalla | Qué muestra | Archivo |
|---|---|---|
| **Inicio** | "¿Qué suena hoy?": caminos (beat, voz, DJ, pads, retos), estilos con su ritmo dibujado y la plantilla que trae cada uno, tus proyectos con su mini marquesina. | [`inicio.html`](bocetos/inicio.html) · [captura](capturas/inicio.png) |
| **Estudio: Patrón** | Barra de transporte, bocina que late, panel de Sonidos, marquesina de secciones con curva de energía, secuenciador de 16 pasos con pictogramas, instrumento Ácido en cara fácil, bombeo en un clic y los 16 pads con su tecla. | [`estudio.html`](bocetos/estudio.html) · [captura](capturas/estudio.png) |
| **Cabina DJ** | Formas de onda apiladas con el drop marcado, dos decks con stems, hot cues, loops y efectos, mezclador con pre-escucha, salidas Master › bocina Bluetooth alineada y Pre-escucha › audífonos, biblioteca con "Combina con A". | [`dj.html`](bocetos/dj.html) · [captura](capturas/dj.png) |
| **Voz** | Asistente de micrófono con zona buena, ganancia, limpieza de ruido, monitoreo con su latencia, botón de grabar toma, presets de voz, tomas con estrellas y la letra en papel con la línea que suena. | [`voz.html`](bocetos/voz.html) · [captura](capturas/voz.png) |
| **Visuales** | Vista previa de la pantalla 2 (caleidoscopio con karaoke), piloto automático por sección, señales que escuchan los visuales ("Pausa en 4 compases"), ánimo Relax ↔ Psicodélico, escenas, "Qué mueve qué", modo seguro, grabar video. | [`visuales.html`](bocetos/visuales.html) · [captura](capturas/visuales.png) |

Los bocetos son de dirección visual: fijan el lenguaje, no cada pixel. Al
construir la app, los componentes salen de `DESIGN.md` y de la skill
`house-ui`, no de copiar este HTML.
