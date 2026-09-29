---
name: house-ui
description: Lenguaje visual "Estudio" de HOUSE. Úsala SIEMPRE antes de diseñar, maquetar o modificar cualquier pantalla, componente, boceto, ícono o texto de interfaz de HOUSE (estudio, arreglo, piano roll, pads, mezcla, editor de audio, tutorial, visuales, inicio), para que todo salga con la misma identidad, se vea como una herramienta profesional y nada parezca genérico, "hecho por IA" o de videojuego.
---

# HOUSE · Lenguaje visual "Estudio"

HOUSE es una app de escritorio para crear música (tech house, techno,
reggaetón y mucho más), mezclarla como DJ y proyectar visuales. Su público:
gente joven de habla hispana, muchas personas sin estudios de música. Quien la
usa pidió que se sienta como un programa de producción de verdad (como FL
Studio), no como un juego, sin perder lo fácil.

## Antes de tocar una pantalla

1. Lee `DESIGN.md` en la raíz del repositorio. Es el contrato: colores,
   tipografía, radios, distribución, movimiento, textos. No inventes tokens
   nuevos sin agregarlos ahí.
2. Lee la sección de la pantalla en `docs/04-diseno.md` (la 4.9 explica el
   cambio de "Sonidero" a "Estudio").
3. Si existe la skill `frontend-design`, sigue su proceso (plan de tokens,
   revisar contra lo genérico, construir, criticar con capturas).

## Lo que hace que HOUSE se vea como HOUSE

- Chasis gris cálido (nunca negro azulado), paneles separados por ranuras de
  `fondo` como un rack, pantallas oscuras para todo lo que se edita.
- Densidad de estudio: texto de 12–13 px, controles de 26 px, filas de 30 px.
  Nada grande porque sí; lo más grande de la app son los dígitos del transporte.
- Colores de familia con significado (naranja = batería, amarillo = bajo,
  azul = sintes, rosa = voz y grabar, verde = samples, turquesa = efectos):
  puros en objetos chicos (pasos, notas, pictogramas), mezclados al 22–30 %
  sobre `pantalla` en rellenos grandes (bloques del arreglo, fila elegida).
- Atkinson Hyperlegible Next para todo lo que se lee; Big Shoulders solo para
  la marca y los dígitos de hardware (posición, BPM).
- Pictogramas sólidos estilo señalética del Metro, a 18–20 px en listas.
- La línea de tiempo con el cabezal es el único protagonista.
- Menús de programa de verdad con palabras llanas en español de México, de tú.

## Prohibido (se ve genérico, de IA o de videojuego)

- Títulos gigantes, carteles, "¿Qué suena hoy?" a 96 px, pads enormes.
- Rellenos grandes con la tinta pura; superficies color papel en el estudio.
- Degradados morado-azul, halos de neón, glassmorphism, blobs difuminados.
- Tarjetas redondeadas idénticas con sombra gris; un solo radio para todo.
- Inter, Roboto, Arial, Space Grotesk; monoespaciadas para etiquetas.
- Etiquetas en MAYÚSCULAS SOSTENIDAS, sobre-títulos, textos "A · B · C",
  flechas "→" pegadas a los botones.
- Emoji como íconos; el ícono de "destellos" para cualquier cosa de IA.
- Números que brincan al cambiar (usa `tabular-nums` o celdas fijas).
- Animaciones de entrada. Lo único que se mueve solo es lo que suena.

## Recetas rápidas

- Botón: 26 px, `chasis-alto`, radio 4 px, texto 12–13 px Atkinson 600,
  línea clara de 1 px arriba por dentro; activo en `chasis-activo`.
- Botón primario: tinta del contexto (o `rosa` para grabar), texto `negro-tinta`.
- Pestaña de vista: texto 13 px; la activa en `chasis-activo` con línea de
  2 px `tinta` abajo.
- Menú flotante: `chasis`, borde 1 px `linea`, radio 8 px, sombra de flotar,
  filas de 28 px con atajo a la derecha en `tinta-3`.
- Seleccionado / foco: contorno 2 px `tinta` con 2 px de separación.
- Título de panel: 12 px Atkinson 700, `tinta-2`, tipo oración.
- Número que corre: Atkinson `tabular-nums`, o Big Shoulders en celdas fijas
  si es un display del transporte.
- Relleno de bloque o fila de una familia:
  `color-mix(in srgb, var(--c) 26%, var(--pantalla))` + tira de 3 px en `var(--c)`.

## Al terminar

Recorre la lista de revisión de la sección 10 de `DESIGN.md` y toma una
captura para criticarla antes de darla por buena. Quita un adorno antes de
entregar.
