---
name: house-ui
description: Lenguaje visual "Sonidero" de HOUSE. Úsala SIEMPRE antes de diseñar, maquetar o modificar cualquier pantalla, componente, boceto, ícono o texto de interfaz de HOUSE (estudio, pads, mezcla, voz, cabina DJ, visuales, onboarding), para que todo salga con la misma identidad y nada se vea genérico o "hecho por IA".
---

# HOUSE · Lenguaje visual "Sonidero"

HOUSE es una app de escritorio para crear música (tech house, techno,
reggaetón y más), mezclarla como DJ y proyectar visuales. Su público: gente
joven de habla hispana, muchas personas sin estudios de música. La interfaz es
la prioridad número uno del proyecto.

## Antes de tocar una pantalla

1. Lee `DESIGN.md` en la raíz del repositorio. Es el contrato: colores,
   tipografía, radios, movimiento, textos. No inventes tokens nuevos sin
   agregarlos ahí.
2. Lee la sección de la pantalla en `docs/04-diseno.md` y los bocetos en
   `diseno/bocetos/` si existen para esa pantalla.
3. Si existe la skill `frontend-design`, sigue su proceso (plan de tokens,
   revisar contra lo genérico, construir, criticar con capturas).

## Lo que hace que HOUSE se vea como HOUSE

- Chasis gris cálido con pantallas oscuras, separado por surcos, no por
  tarjetas.
- Tintas fluorescentes planas con texto negro encima, cada una ligada a una
  familia de sonido (naranja = batería, amarillo = bajo, azul = sintes,
  rosa = voz/grabar, verde = samples, turquesa = efectos).
- Big Shoulders para lo grande (BPM, secciones, carteles) y Atkinson
  Hyperlegible Next para todo lo que se lee de corrido.
- Controles con cuerpo: pads de hule, teclas de paso en grupos de 4,
  perillas con arco de color, medidores de segmentos, la bocina que late.
- La marquesina de secciones ("Intro", "Subida", "¡Drop!", "Pausa", "Salida")
  como el único elemento protagonista del estudio.
- Pictogramas sólidos por instrumento, estilo señalética del Metro.
- Textos en español de México, de tú, con verbos claros.

## Prohibido (se ve genérico o de IA)

- Degradados morado-azul, halos de neón, glassmorphism, blobs difuminados.
- Tarjetas redondeadas idénticas con sombra gris debajo; un solo radio para todo.
- Inter, Roboto, Arial, Space Grotesk; monoespaciadas para etiquetas pequeñas.
- Etiquetas en MAYÚSCULAS SOSTENIDAS, sobre-títulos encima de cada bloque,
  textos "A · B · C", flechas "→" pegadas a los botones.
- Emoji como íconos; el ícono de "destellos" para cualquier cosa de IA.
- Números que brincan al cambiar (usa `tabular-nums` o celdas fijas).
- Animaciones de entrada en cada panel. Lo único que se mueve solo es lo que suena.

## Recetas rápidas

- Botón primario: fondo `rosa` o la tinta del contexto, texto `negro-tinta`
  Atkinson 700 13–14 px, radio 6 px, alto 32 px (44 px en táctil).
- Acción principal neutral (reproducir activo, "Abrir en pantalla 2"): fondo
  `tinta`, texto `negro-tinta`.
- Botón secundario: fondo `chasis-alto`, texto `tinta`, línea interior clara
  arriba de 1 px.
- Superficies de "cartel" (marquesina, hoja de letra, caminos de Inicio):
  fondo `papel`, texto `negro-tinta`, lo actual en `amarillo`.
- Seleccionado / foco: contorno 2 px `tinta` con 2 px de separación.
- Etiqueta de control: Big Shoulders 700 12 px, color `tinta-2`, tipo oración.
- Número que corre (tiempo, dB, ms): Atkinson 500 `tabular-nums`.
- Panel: fondo `chasis`; borde inferior = `surco` 2 px + `bisel` 1 px.
- Pantalla (secuenciador, onda, línea de tiempo): fondo `pantalla`, radio 0.

## Al terminar

Recorre la lista de revisión de la sección 9 de `DESIGN.md` y toma una
captura para criticarla antes de darla por buena. Quita un adorno antes de
entregar.
