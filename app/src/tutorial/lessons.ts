// Lessons of the tutorial. Each step points at a part of the studio by its
// `data-tour` name and, when it asks the person to do something, waits for it.
// Each lesson opens its own practice project, so the person's work stays safe.
import type { Lesson } from './tourState';
import { ST } from '../engine/protocol';
import { getStatus } from '../engine/live';
import { useStudio } from '../state/store';
import { useUi, closeDialog, openDialog } from '../state/ui';
import { useAudioEdit } from '../state/audioEdit';
import { enterStudio } from '../state/actions';
import { saveNow } from '../state/persist';
import { blankProject, newProjectFromGenre } from '../state/templates';
import { soundById, trackFromSound } from '../state/instruments';
import { played } from '../input/play';
import type { GenreId, Pict, Project, Track } from '../state/model';

// ---------------------------------------------------------------- helpers --

const ui = () => useUi.getState();
const proj = (): Project => useStudio.getState().project;
const playing = (): boolean => getStatus()[ST.PLAYING] > 0.5;
const byPict = (...picts: Pict[]): Track | undefined => proj().tracks.find((t) => picts.includes(t.pict));
const stepsOn = (t: Track | undefined, steps: number[]): boolean => !!t && steps.every((i) => t.steps[i]?.on);
const countOn = (t: Track | undefined): number => (t ? t.steps.slice(0, t.length).filter((s) => s.on).length : 0);
const chordSteps = (t: Track | undefined): number => (t ? t.steps.slice(0, t.length).filter((s) => s.on && s.notes.length > 2).length : 0);
const noteCount = (t: Track | undefined): number => (t ? t.steps.slice(0, t.length).reduce((a, s) => a + (s.on ? s.notes.length : 0), 0) : 0);
const byName = (name: string): Track | undefined => proj().tracks.find((t) => t.name === name);
const select = (t: Track | undefined) => t && ui().set({ selected: t.id });

/** Opens a practice project (the person's own stays saved in "Tus proyectos"). */
function practice(name: string, make: () => Project): () => void {
  return () => {
    saveNow();
    const p = make();
    p.name = `Práctica: ${name}`;
    enterStudio(p);
    ui().set({ nav: true, dock: true, navTab: 'sonidos', kbMode: 'pads', pro: false });
  };
}

const fromGenre = (g: GenreId) => () => newProjectFromGenre(g);

/** A small beat plus empty tracks, for the lessons about notes. */
function beatWith(extra: { sound: string; name: string }[], key: Project['key'], bpm: number): Project {
  const p = blankProject();
  p.key = key;
  p.bpm = bpm;
  p.genre = 'house';
  const hit = (id: string, name: string, steps: number[], vol: number) => {
    const t = trackFromSound(soundById(id)!, name);
    for (const i of steps) t.steps[i] = { ...t.steps[i], on: true, vel: 0.85 };
    t.vol = vol;
    return t;
  };
  const tracks = [
    hit('bombo-cuerpo', 'Bombo', [0, 4, 8, 12], -1),
    hit('palmas-secas', 'Palmas', [4, 12], -6),
    hit('hat-cobre', 'Hat', [2, 6, 10, 14], -13),
    ...extra.map((e) => {
      const t = trackFromSound(soundById(e.sound)!, e.name, 64);
      t.vol = -8;
      return t;
    }),
  ];
  p.tracks = tracks;
  p.sidechainTrack = tracks[0].id;
  p.sections = p.sections.map((s) => ({ ...s, tracks: tracks.map((t) => t.id) }));
  return p;
}

/** Values a step remembers when it starts, to see if the person changed them. */
const base = { pads: 0, notes: 0, shots: 0, bpm: 0, steps: null as unknown, preset: '', sections: '', samplers: 0, noteCount: 0 };
const snapshot = () => {
  base.pads = played.pads;
  base.notes = played.notes;
  base.shots = played.shots;
};

// ---------------------------------------------------------------- lessons --

export const LESSONS: Lesson[] = [
  {
    id: 'conoce',
    title: 'Conoce el estudio',
    summary: 'Dónde está cada cosa: menús, transporte, línea de tiempo, vistas, sonidos y teclado.',
    minutes: 3,
    setup: practice('conoce el estudio', fromGenre('techhouse')),
    steps: [
      {
        title: 'Bienvenida a HOUSE',
        body: 'Este es tu estudio. En tres minutos vas a saber para qué sirve cada parte.\n\nAbrimos un proyecto de práctica; lo tuyo quedó guardado. Si un paso te pide hacer algo, el tutorial espera y sigue solo cuando lo logras.',
      },
      {
        target: 'menu-archivo',
        title: 'Los menús',
        body: 'Como en cualquier programa. En Archivo creas proyectos en blanco, abres, guardas, importas audio y exportas tu canción. En Ayuda vuelves a este tutorial cuando quieras.',
      },
      {
        target: 'transporte',
        title: 'Reproducir y parar',
        body: 'El triángulo reproduce y el cuadro para. La barra espaciadora hace lo mismo.',
        hazlo: 'Dale play (o presiona Espacio).',
        done: playing,
      },
      {
        target: 'posicion',
        title: 'Dónde vas',
        body: 'Esta pantalla dice el compás, el tiempo y el paso que suena, y abajo el minuto de la canción. Un compás tiene 4 tiempos y cada tiempo tiene 4 pasos.',
      },
      {
        target: 'tempo',
        title: 'El tempo',
        body: 'Qué tan rápido va la música, en golpes por minuto (BPM). Arrástralo hacia arriba o abajo, o haz doble clic para escribirlo. El house va entre 120 y 128; el reggaetón, cerca de 95.',
      },
      {
        target: 'modo',
        title: 'Loop o Canción',
        body: 'En Loop se repite el patrón que estás armando. En Canción suena toda la canción, parte por parte, de principio a fin.',
        hazlo: 'Cambia a Canción.',
        done: () => proj().mode === 'cancion',
      },
      {
        target: 'linea-tiempo',
        title: 'La línea de tiempo',
        body: 'Toda tu canción de un vistazo: sus partes (intro, subida, drop…) y la línea que avanza mientras suena. Haz clic o arrastra en la regla de números para brincar a cualquier punto. Con las flechas la mueves un tiempo.',
      },
      {
        target: 'vista-arreglo',
        title: 'Las cuatro vistas',
        body: 'Patrón: los pasos de cada pista. Arreglo: qué suena en cada parte. Piano roll: notas y acordes. Mezcla: volumen y efectos. También con F1, F2, F4 y F3.',
        hazlo: 'Abre el Arreglo.',
        done: () => ui().tab === 'arreglo',
      },
      {
        target: 'navegador',
        title: 'El navegador',
        body: 'Todos los sonidos: baterías, bajos, teclas, guitarras, efectos de transición. Clic para escucharlo; doble clic o arrástralo para agregarlo. En Mis samples quedan tus grabaciones y en Efectos, los efectos.',
        enter: () => ui().set({ tab: 'patron', nav: true, navTab: 'sonidos' }),
      },
      {
        target: 'dock',
        title: 'Instrumento y teclado',
        body: 'Abajo ajustas el sonido de la pista elegida y tocas con tu teclado: cada tecla es un pad o una nota. En el menú Ver lo escondes para tener más espacio.',
      },
      {
        target: 'nivel',
        title: 'El nivel',
        body: 'Estas barras muestran qué tan fuerte suena todo. Verde está bien. Si llega a rosa, está saturando: baja volúmenes en la Mezcla.',
      },
      {
        title: '¡Ya conoces el estudio!',
        body: 'Sigue con “Tu primer ritmo” para hacer un beat desde cero.',
      },
    ],
  },
  {
    id: 'ritmo',
    title: 'Tu primer ritmo',
    summary: 'Arma un beat desde cero: bombo, palmas, hats, tempo y swing.',
    minutes: 5,
    setup: practice('tu primer ritmo', () => {
      const p = blankProject();
      p.genre = 'techhouse';
      return p;
    }),
    steps: [
      {
        title: 'Un beat desde cero',
        body: 'Vas a armar el ritmo más famoso de la música de baile: bombo en cada tiempo, palmas en el 2 y el 4, y hats entre bombos.\n\nEl proyecto está en blanco.',
      },
      {
        target: 'lista-sonidos',
        title: 'Busca un bombo',
        body: 'Esta lista tiene todos los sonidos. Haz clic en uno para escucharlo antes de agregarlo.',
        hazlo: 'Haz doble clic en “Bombo con cuerpo” (o arrástralo a las pistas).',
        enter: () => ui().set({ nav: true, navTab: 'sonidos', tab: 'patron' }),
        done: () => !!byPict('bombo'),
      },
      {
        target: 'pistas',
        title: 'Prende el bombo',
        body: 'Cada cuadrito es un paso; 16 pasos son un compás. Cada grupo de 4 es un tiempo: por eso se ven en bloques.',
        hazlo: 'Prende el primer paso de cada grupo: 1, 5, 9 y 13.',
        done: () => stepsOn(byPict('bombo'), [0, 4, 8, 12]),
      },
      {
        target: 'transporte',
        title: 'Escúchalo',
        body: 'Ese golpe en cada tiempo es el “cuatro al piso” del house y el techno.',
        hazlo: 'Dale play.',
        done: playing,
      },
      {
        target: 'lista-sonidos',
        title: 'Ahora unas palmas',
        body: 'Las palmas (o la caja) marcan el tiempo 2 y el 4.',
        hazlo: 'Agrega “Palmas secas”.',
        done: () => !!byPict('palmas', 'caja', 'chasquido'),
      },
      {
        target: 'pistas',
        title: 'El dos y el cuatro',
        body: 'Así suena el “uno, DOS, tres, CUATRO” que te hace mover la cabeza.',
        hazlo: 'Prende los pasos 5 y 13 de las palmas.',
        done: () => stepsOn(byPict('palmas', 'caja', 'chasquido'), [4, 12]),
      },
      {
        target: 'lista-sonidos',
        title: 'Hats',
        body: 'Los hats son los platillos cerrados que llenan los huecos.',
        hazlo: 'Agrega “Hat cerrado de cobre”.',
        done: () => !!byPict('hat'),
      },
      {
        target: 'pistas',
        title: 'Entre los bombos',
        body: 'Pon hats entre los bombos: pasos 3, 7, 11 y 15. Luego prueba otros y escucha cómo cambia el movimiento.',
        hazlo: 'Prende al menos 4 pasos del hat.',
        done: () => countOn(byPict('hat')) >= 4,
      },
      {
        target: 'tempo',
        title: 'Más rápido',
        body: 'El tempo cambia la energía. El house suena bien entre 120 y 128.',
        hazlo: 'Sube el tempo a 124 o más: arrastra el número hacia arriba.',
        done: () => proj().bpm >= 124,
      },
      {
        target: 'swing',
        title: 'El swing',
        body: 'El swing atrasa un poquito los pasos pares y le da balanceo. Arrástralo y escucha. Entre 54 y 60 % suena a house; 50 % es completamente recto.',
      },
      {
        target: 'dados',
        title: 'Los dados',
        body: 'Si no se te ocurre nada, los dados inventan un patrón nuevo dentro del estilo para la pista elegida. Ctrl+Z lo regresa.',
        enter: () => select(byPict('hat')),
      },
      {
        title: '¡Tu primer beat!',
        body: 'Así empieza casi toda la música de baile. Sigue con “Toca con los pads”.',
      },
    ],
  },
  {
    id: 'pads',
    title: 'Toca con los pads',
    summary: 'Tu teclado como instrumento: pads, piano, escala, soundboard y grabar lo que tocas.',
    minutes: 4,
    setup: practice('pads', fromGenre('techhouse')),
    steps: [
      {
        target: 'teclado-musical',
        title: 'Tu teclado es un instrumento',
        body: 'Cuando aquí dice “Teclado: Pads”, las teclas de tu compu tocan sonidos. Tab lo prende o lo apaga (apágalo si vas a escribir).',
        enter: () => ui().set({ keyboardOn: true, kbMode: 'pads', dock: true, tab: 'patron' }),
      },
      {
        target: 'pads',
        title: 'Los pads',
        body: 'Cada pad es una pista. Las teclas 1 2 3 4, Q W E R, A S D F y Z X C V los tocan; el mouse también.',
        hazlo: 'Toca 4 pads.',
        enter: snapshot,
        done: () => played.pads - base.pads >= 4,
      },
      {
        target: 'transporte',
        title: 'Toca encima de la música',
        body: 'Los pads se prenden solos cuando el patrón los toca: así ves qué suena.',
        hazlo: 'Dale play y toca algunos pads al ritmo.',
        done: playing,
      },
      {
        target: 'grabar-pads',
        title: 'Graba lo que tocas',
        body: 'Con este botón prendido, lo que tocas mientras suena queda en los pasos, ajustado al ritmo. Así grabas un patrón sin dibujarlo.',
        hazlo: 'Préndelo.',
        done: () => ui().recArmed,
      },
      {
        target: 'grabar-pads',
        title: 'Apágalo al terminar',
        body: 'Toca un poco y escucha cómo se queda en el patrón. Si no te gusta, Ctrl+Z.',
        hazlo: 'Apaga la grabación.',
        done: () => !ui().recArmed,
      },
      {
        target: 'modo-teclado',
        title: 'Piano y Escala',
        body: 'En Piano, las teclas son como las de un piano. En Escala, solo tocan notas que combinan con tu canción: imposible desafinar.',
        hazlo: 'Cambia a Escala.',
        done: () => ui().kbMode === 'escala',
      },
      {
        target: 'pads',
        title: 'Una melodía sin miedo',
        body: 'Cada fila de letras sube de nota. Toca lo que quieras: todo combina.',
        hazlo: 'Toca 6 notas.',
        enter: snapshot,
        done: () => played.notes - base.notes >= 6,
      },
      {
        target: 'modo-teclado',
        title: 'Soundboard',
        body: 'Cualquier sonido en cualquier tecla: golpes, corneta, láser o tus grabaciones. Ideal para tocar en vivo o como DJ.',
        hazlo: 'Cambia a Soundboard y toca 3 teclas.',
        enter: snapshot,
        done: () => ui().kbMode === 'soundboard' && played.shots - base.shots >= 3,
      },
      {
        target: 'pads',
        title: 'Cambia el sonido de una tecla',
        body: 'Clic derecho en una tecla para elegir su sonido. También puedes arrastrar encima un sonido del navegador, uno de tus samples o un archivo de audio.',
      },
      {
        title: '¡Ya tocas!',
        body: 'Sigue con “El bajo y la escala”.',
        enter: () => ui().set({ kbMode: 'pads' }),
      },
    ],
  },
  {
    id: 'bajo',
    title: 'El bajo y la escala',
    summary: 'Escribe un bajo en el piano roll sin saber teoría: la escala te protege.',
    minutes: 4,
    setup: practice('el bajo', fromGenre('techhouse')),
    steps: [
      {
        title: 'El bajo',
        body: 'Es la nota grave que se siente en el pecho y que amarra la batería con los acordes. Vas a escribir uno sin saber teoría.',
      },
      {
        target: 'tonalidad',
        title: 'La tonalidad',
        body: 'Tu canción está en una escala: 7 notas que suenan bien juntas. Menor suena más oscura; mayor, más alegre. Si la cambias, las notas de tus pistas se acomodan solas.',
      },
      {
        target: 'pistas',
        title: 'Elige el bajo',
        body: 'La pista elegida es la que editas y la que suena con las notas de tu teclado.',
        hazlo: 'Haz clic en el nombre de la pista “Bajo”.',
        enter: () => ui().set({ tab: 'patron' }),
        done: () => proj().tracks.find((t) => t.id === ui().selected)?.family === 'bajo',
      },
      {
        target: 'vista-piano',
        title: 'El piano roll',
        body: 'Aquí se ven las notas: más arriba, más agudas; más a la derecha, más tarde.',
        hazlo: 'Abre el Piano roll (o presiona F4).',
        done: () => ui().tab === 'piano',
      },
      {
        target: 'solo-escala',
        title: 'Solo notas de la escala',
        enter: () => ui().set({ tab: 'piano' }),
        body: 'Con esto prendido, las filas que no son de tu escala se ven más oscuras y las notas se pegan a las buenas. Déjalo prendido mientras aprendes.',
      },
      {
        target: 'rejilla-notas',
        title: 'Dibuja una nota',
        body: 'Haz clic en un espacio vacío para agregar una nota. Si arrastras mientras la pones, queda más larga.',
        hazlo: 'Agrega una nota.',
        enter: () => {
          base.noteCount = noteCount(proj().tracks.find((t) => t.id === ui().selected));
        },
        done: () => noteCount(proj().tracks.find((t) => t.id === ui().selected)) > base.noteCount,
      },
      {
        target: 'rejilla-notas',
        title: 'Mueve, alarga y borra',
        body: 'Arrastra una nota para moverla y su orilla derecha para alargarla. Doble clic o clic derecho la borra. Con el teclado: flechas para moverla y Supr para borrarla.',
      },
      {
        target: 'dados',
        title: 'Si te atoras',
        body: 'Los dados escriben un bajo nuevo dentro de la escala. Pruébalos varias veces hasta que uno te guste.',
        hazlo: 'Presiona Dados.',
        enter: () => {
          base.steps = proj().tracks.find((t) => t.id === ui().selected)?.steps ?? null;
        },
        done: () => proj().tracks.find((t) => t.id === ui().selected)?.steps !== base.steps,
      },
      {
        target: 'preset',
        title: 'Otro sonido',
        body: 'Las flechas cambian el sonido del bajo sin tocar sus notas.',
        hazlo: 'Cambia el preset con una flecha.',
        enter: () => {
          base.preset = proj().tracks.find((t) => t.id === ui().selected)?.preset ?? '';
        },
        done: () => (proj().tracks.find((t) => t.id === ui().selected)?.preset ?? '') !== base.preset,
      },
      {
        title: '¡Tienes bajo!',
        body: 'Sigue con “Tu primera melodía”.',
      },
    ],
  },
  {
    id: 'piano',
    title: 'Tu primera melodía',
    summary: 'Escribe notas en el piano roll y toca el piano con tu teclado.',
    minutes: 4,
    setup: practice('melodía', () => beatWith([{ sound: 'piano-fm', name: 'Piano' }], { root: 0, scale: 'mayor' }, 110)),
    steps: [
      {
        title: 'Una melodía',
        body: 'Es una fila de notas que puedes cantar. Vas a escribir una en el piano roll y a tocarla con tu teclado. Estás en Do mayor: las teclas blancas.',
        enter: () => {
          select(byName('Piano'));
          ui().set({ tab: 'piano' });
        },
      },
      {
        target: 'rejilla-notas',
        title: 'Dibuja la melodía',
        body: 'Pon notas en distintos lugares y alturas. Arrastra mientras la pones para hacerla más larga.',
        hazlo: 'Dibuja 4 notas.',
        done: () => noteCount(byName('Piano')) >= 4,
      },
      {
        target: 'transporte',
        title: 'Escúchala',
        body: 'Si una nota no te gusta, arrástrala a otra altura: suena mientras la mueves.',
        hazlo: 'Dale play.',
        done: playing,
      },
      {
        target: 'fuerza',
        title: 'La fuerza',
        body: 'Cada barrita es qué tan fuerte suena una nota. Arrástralas para que unas peguen más que otras: así suena más humano.',
      },
      {
        target: 'pads',
        title: 'El piano en tu teclado',
        body: 'Ahora tu teclado es un piano: A S D F G H J K son las teclas blancas y W E T Y U, las negras. Z y X cambian de octava.',
        hazlo: 'Toca 6 notas.',
        enter: () => {
          ui().set({ kbMode: 'piano', keyboardOn: true, dock: true });
          snapshot();
        },
        done: () => played.notes - base.notes >= 6,
      },
      {
        target: 'grabar-pads',
        title: 'Graba tu melodía',
        body: 'Prende grabar, dale play y toca: las notas quedan en el piano roll, ajustadas al ritmo. Apágalo cuando termines.',
      },
      {
        title: '¡Ya escribes melodías!',
        body: 'Sigue con “Acordes”: la parte que le da emoción a la canción.',
      },
    ],
  },
  {
    id: 'acordes',
    title: 'Acordes',
    summary: 'Agrega, mueve y cambia acordes; usa progresiones y haz que el bajo los siga.',
    minutes: 5,
    setup: practice('acordes', () =>
      beatWith(
        [
          { sound: 'rhodes-fm', name: 'Acordes' },
          { sound: 'bajo-fm', name: 'Bajo' },
        ],
        { root: 9, scale: 'menor' },
        100,
      ),
    ),
    steps: [
      {
        title: '¿Qué es un acorde?',
        body: 'Tres o más notas que suenan al mismo tiempo. Las canciones cambian de acorde cada compás o cada medio compás, y eso les da emoción.\n\nNo necesitas saber cuáles son: HOUSE te da los que combinan con tu canción.',
        enter: () => {
          select(byName('Acordes'));
          ui().set({ tab: 'piano' });
        },
      },
      {
        target: 'tira-acordes',
        title: 'La tira de acordes',
        body: 'Arriba del piano roll está la tira de acordes. Cada bloque es un acorde con su nombre: Lam es La menor, Fa es Fa mayor.',
        hazlo: 'Haz clic en la tira y elige un acorde.',
        done: () => chordSteps(byName('Acordes')) >= 1,
      },
      {
        target: 'agregar-acorde',
        title: 'Los 7 que combinan',
        body: 'Tu escala tiene 7 acordes que siempre combinan. El número romano dice su lugar (i es “la casa”) y al lado ves qué se siente: oscuro, épico, melancólico…',
        hazlo: 'Agrega otro acorde con “+ Acorde”.',
        done: () => chordSteps(byName('Acordes')) >= 2,
      },
      {
        target: 'progresiones',
        title: 'Progresiones',
        body: 'Una progresión son acordes en un orden que ya se sabe que funciona. “La del reggaetón” está en cientos de canciones; “Épica”, en los drops de festival.',
        hazlo: 'Elige una progresión.',
        done: () => chordSteps(byName('Acordes')) >= 4,
      },
      {
        target: 'transporte',
        title: 'Escúchala',
        body: 'Cada acorde dura un compás. Fíjate cómo cambia el sentimiento con cada uno.',
        hazlo: 'Dale play.',
        done: playing,
      },
      {
        target: 'tira-acordes',
        title: 'Mueve, alarga y cambia',
        body: 'Arrastra un bloque para moverlo o su orilla derecha para alargarlo. La flechita del bloque abre su menú: cambiarlo por otro, invertirlo (las mismas notas en otro orden), subirlo de octava, copiarlo o borrarlo.',
      },
      {
        target: 'seguir-acordes',
        title: 'Un bajo que sigue los acordes',
        body: 'El bajo casi siempre toca la nota principal de cada acorde. HOUSE lo escribe por ti.',
        hazlo: 'Abre “Seguir acordes” y elige la pista Acordes.',
        enter: () => select(byName('Bajo')),
        done: () => noteCount(byName('Bajo')) > 0,
      },
      {
        title: '¡Ya tienes armonía!',
        body: 'Batería, bajo y acordes: eso es una canción. Sigue con “Arma tu canción” para darle partes.',
      },
    ],
  },
  {
    id: 'estructura',
    title: 'Arma tu canción',
    summary: 'Intro, subida, drop, pausa y salida: decide qué suena en cada parte.',
    minutes: 4,
    setup: practice('estructura', fromGenre('techhouse')),
    steps: [
      {
        title: 'Una canción tiene partes',
        body: 'Intro, subida, drop, pausa, salida… Cada parte deja sonar distintas pistas. Así la canción crece, respira y vuelve a explotar.',
      },
      {
        target: 'secciones',
        title: 'Las partes',
        body: 'Cada bloque de la línea de tiempo es una sección. El más ancho dura más compases.',
        hazlo: 'Haz clic en la sección “Subida”.',
        done: () => proj().sections.find((s) => s.id === ui().selectedSection)?.kind === 'subida',
      },
      {
        target: 'vista-arreglo',
        title: 'El arreglo',
        body: 'Aquí ves toda la canción como en FL Studio o Ableton: pistas hacia abajo y tiempo hacia la derecha.',
        hazlo: 'Abre el Arreglo (F2).',
        done: () => ui().tab === 'arreglo',
      },
      {
        target: 'arreglo-filas',
        title: 'Qué suena en cada parte',
        body: 'Cada fila es una pista y cada bloque, una sección. Con dibujo, la pista suena ahí; vacío, se calla. Puedes arrastrar para pintar varios bloques.',
        hazlo: 'Haz clic en un bloque para prender o callar una pista.',
        enter: () => {
          ui().set({ tab: 'arreglo' });
          base.sections = JSON.stringify(proj().sections.map((s) => s.tracks));
        },
        done: () => JSON.stringify(proj().sections.map((s) => s.tracks)) !== base.sections,
      },
      {
        target: 'editor-seccion',
        title: 'Cambia la sección',
        body: 'Con una sección elegida cambias su tipo, sus compases (− y +), la mueves, la duplicas, le pones una transición o agregas otra después.',
        enter: () => {
          ui().set({ tab: 'arreglo' });
          if (!ui().selectedSection) ui().set({ selectedSection: proj().sections.find((s) => s.kind === 'subida')?.id ?? proj().sections[0]?.id ?? null });
        },
      },
      {
        target: 'modo',
        title: 'Escucha la canción completa',
        body: 'En modo Canción suenan las partes en orden. La línea de tiempo te muestra dónde vas.',
        hazlo: 'Cambia a Canción y dale play.',
        done: () => proj().mode === 'cancion' && playing(),
      },
      {
        title: '¡Tienes una canción!',
        body: 'Sigue con “Transiciones y curvas” para que el drop pegue más.',
      },
    ],
  },
  {
    id: 'transiciones',
    title: 'Transiciones y curvas',
    summary: 'Filtros que se abren, ecos que crecen: curvas entre las partes de tu canción.',
    minutes: 3,
    setup: practice('transiciones', fromGenre('techhouse')),
    steps: [
      {
        title: 'Transiciones',
        body: 'Lo que hace que un drop pegue: un filtro que se abre, un eco que crece, un silencio justo antes del golpe. En HOUSE son curvas que mueven una perilla con el tiempo.',
        enter: () => ui().set({ tab: 'arreglo', selectedSection: null }),
      },
      {
        target: 'secciones',
        title: 'Elige la subida',
        body: 'La subida es la parte que prepara el drop.',
        hazlo: 'Haz clic en la sección “Subida”.',
        done: () => proj().sections.find((s) => s.id === ui().selectedSection)?.kind === 'subida',
      },
      {
        target: 'transicion',
        title: 'Transiciones listas',
        enter: () => {
          ui().set({ tab: 'arreglo' });
          if (!ui().selectedSection) ui().set({ selectedSection: proj().sections.find((s) => s.kind === 'subida')?.id ?? null });
        },
        body: 'Cada una dibuja la curva por ti. “Filtro que se abre” es la clásica: empieza opaco y se abre justo al llegar al drop.',
        hazlo: 'Elige una transición.',
        done: () => proj().lanes.length > 0,
      },
      {
        target: 'curvas',
        title: 'La curva',
        body: 'Los cuadritos son puntos: arrástralos. El círculo del medio dobla la curva para que cambie más al principio o al final. Clic en un espacio agrega un punto; doble clic lo quita.',
      },
      {
        target: 'agregar-curva',
        title: 'Tus propias curvas',
        body: 'Agrega curvas para el volumen, el filtro, el espacio o el eco de toda la canción, o para una pista y hasta sus efectos.',
      },
      {
        target: 'modo',
        title: 'Escúchala',
        body: 'Las curvas suenan en modo Canción. Haz clic en la regla, un poco antes de la subida, para no esperar.',
        hazlo: 'Cambia a Canción y dale play.',
        done: () => proj().mode === 'cancion' && playing(),
      },
      {
        title: '¡Así se hace un drop!',
        body: 'Sigue con “Tu voz y tus samples”.',
      },
    ],
  },
  {
    id: 'voz',
    title: 'Tu voz y tus samples',
    summary: 'Graba, elige tu parte favorita, úsala en un pad, córtala y guárdala en Mis samples.',
    minutes: 4,
    setup: practice('voz', fromGenre('reggaeton')),
    steps: [
      {
        title: 'Tu voz y tus sonidos',
        body: 'Puedes grabar tu voz o cualquier sonido, recortar tu parte favorita y tocarla como un pad. También sirve cualquier audio que tengas en tu compu.',
        enter: () => {
          base.samplers = proj().tracks.filter((t) => t.kind === 'sampler').length;
        },
      },
      {
        target: 'grabar',
        title: 'Grabar',
        body: 'Está abajo del navegador y en el menú Agregar (Ctrl+R).',
        hazlo: 'Abre “Grabar voz o sonido”.',
        enter: () => ui().set({ nav: true, navTab: 'sonidos', tab: 'patron' }),
        done: () => ui().dialog === 'grabar' || !!useAudioEdit.getState().source,
      },
      {
        target: 'grabar-toma',
        title: 'Graba una toma',
        enter: () => {
          if (ui().dialog !== 'grabar' && !useAudioEdit.getState().source) openDialog('grabar');
        },
        body: 'Dale Grabar toma, di o canta algo y luego Parar. Si el navegador pide permiso para usar el micrófono, dáselo.',
        hazlo: 'Graba una toma (si no tienes micrófono, salta este paso e importa un audio después).',
        done: () => !!useAudioEdit.getState().source,
      },
      {
        target: 'editor-onda',
        title: 'Elige tu parte favorita',
        body: 'Arrastra las orillas para recortar, o arrastra sobre la onda para elegir otra parte. La rueda del mouse acerca. Espacio escucha la parte elegida.',
      },
      {
        target: 'editor-usar',
        title: 'Úsala',
        body: 'Tu parte se vuelve una pista con su pad. El audio completo se guarda, así que puedes cambiar el corte después.',
        hazlo: 'Dale “Usar en un pad nuevo”.',
        done: () => proj().tracks.filter((t) => t.kind === 'sampler').length > base.samplers,
      },
      {
        target: 'editar-audio',
        title: 'Cámbiale el corte cuando quieras',
        body: 'Editar audio vuelve a abrir el editor: otra parte, orillas suaves o al revés. Ahí mismo puedes cortar un audio en varios pads, por partes iguales o en cada golpe.',
        enter: () => {
          closeDialog();
          const t = [...proj().tracks].reverse().find((x) => x.kind === 'sampler');
          select(t);
          ui().set({ dock: true, tab: 'patron' });
        },
      },
      {
        target: 'navegador',
        title: 'Mis samples',
        body: 'Lo que guardes en Mis samples sirve en todos tus proyectos. Y puedes arrastrar archivos de audio desde tu compu a las pistas, a un pad o a una tecla del Soundboard.',
        enter: () => ui().set({ nav: true, navTab: 'samples' }),
      },
      {
        title: '¡Tu voz ya es un instrumento!',
        body: 'Sigue con “Mezcla y efectos”.',
      },
    ],
  },
  {
    id: 'mezcla',
    title: 'Mezcla y efectos',
    summary: 'Volúmenes, mute y solo, efectos por pista y el master.',
    minutes: 4,
    setup: practice('mezcla', fromGenre('techhouse')),
    steps: [
      {
        target: 'vista-mezcla',
        title: 'La mezcla',
        body: 'Mezclar es acomodar los volúmenes y efectos para que todo se escuche claro.',
        hazlo: 'Abre la Mezcla (F3).',
        done: () => ui().tab === 'mezcla',
      },
      {
        target: 'mezcla',
        title: 'Un canal por pista',
        enter: () => ui().set({ tab: 'mezcla' }),
        body: 'Cada columna es una pista: arriba sus efectos, en medio el filtro, el espacio y el eco, y abajo su volumen con su medidor.',
      },
      {
        target: 'mezcla',
        title: 'Volumen, mute y solo',
        body: 'Arrastra el fader (la palanquita) para subir o bajar. Doble clic lo regresa. M calla la pista y S deja sonar solo esa.',
        hazlo: 'Silencia una pista con M.',
        done: () => proj().tracks.some((t) => t.mute),
      },
      {
        target: 'fx-canal',
        title: 'Efectos',
        enter: () => ui().set({ tab: 'mezcla' }),
        body: 'Cada pista tiene dos espacios para efectos: coro, phaser, distorsión, wobble, lo-fi, vinilo y más. Clic para agregar uno y otra vez para mover sus perillas.',
        hazlo: 'Agrega un efecto.',
        done: () => proj().tracks.some((t) => t.fx.some((f) => f.kind)),
      },
      {
        target: 'master',
        title: 'El master',
        enter: () => ui().set({ tab: 'mezcla' }),
        body: 'Todo termina aquí. El pegamento junta la mezcla y el limitador evita que sature.',
      },
      {
        target: 'destino',
        title: '¿Para dónde va?',
        body: 'Streaming deja el volumen como en las apps de música. Club, más fuerte para bocinas grandes.',
      },
      {
        title: '¡A mezclar!',
        body: 'Un consejo: primero baja lo que sobra y luego sube lo que falta. Sigue con “Exporta y comparte”.',
        enter: () => ui().set({ tab: 'patron' }),
      },
    ],
  },
  {
    id: 'exportar',
    title: 'Exporta y comparte',
    summary: 'Tu canción en WAV, tu proyecto en un archivo y visuales para tu set.',
    minutes: 2,
    steps: [
      {
        target: 'exportar',
        title: 'Exportar',
        body: 'Convierte tu proyecto en un archivo de audio para compartirlo o subirlo.',
        hazlo: 'Abre Exportar (Ctrl+E).',
        done: () => ui().dialog === 'exportar',
      },
      {
        target: 'exportar-opciones',
        title: 'Canción o loop',
        enter: () => {
          if (ui().dialog !== 'exportar') openDialog('exportar');
        },
        body: 'La canción completa con todas sus partes, o solo el loop para usarlo en otra app o en tu set. WAV de 16 bits para compartir; de 24 para seguir mezclando.',
      },
      {
        target: 'visuales',
        title: 'Visuales',
        body: 'Abre una ventana con visuales que se mueven con tu música, para proyectar en otra pantalla. El modo seguro cuida a quienes son sensibles a los destellos.',
        enter: closeDialog,
      },
      {
        title: '¡Terminaste el tutorial!',
        body: 'Ya sabes hacer una canción completa: ritmo, bajo, acordes, estructura, transiciones, voz, mezcla y exportar. Todo se guarda solo. Ahora haz la tuya: Archivo, Proyecto en blanco.',
      },
    ],
  },
];

