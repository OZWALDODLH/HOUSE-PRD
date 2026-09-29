// End-to-end checks in a real browser (Chromium): the app loads, every
// template sounds, the engine plays and every hit reaches the screen, the
// timeline moves the playhead, blank projects, the audio editor (trim, use,
// cut into pads, record), chords in the piano roll, transition curves,
// effects, the tutorial, export writes a valid WAV, undo works, the
// soundboard plays, the visuals window opens and the safe mode holds.
//
//   npm run build && npm run test:e2e
//
// Set CHROMIUM_PATH to use a Chromium that is already installed.
import { preview } from 'vite';
import { chromium } from 'playwright';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
const results = [];

async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, ms: Date.now() - t0 });
  } catch (e) {
    results.push({ name, ok: false, detail: String(e && e.message ? e.message : e), ms: Date.now() - t0 });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** A test loop: 0.8 s of silence, 4.4 s of kick, hats and a tone, silence. */
function testWav(seconds = 6, sr = 44100) {
  const n = seconds * sr;
  const data = new Int16Array(n);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t % 0.5;
    let v = 0;
    if (t > 0.8 && t < 5.2) {
      v += Math.sin(2 * Math.PI * 60 * beat) * Math.exp(-beat * 18) * 0.8;
      v += rnd() * Math.exp(-((t + 0.25) % 0.5) * 40) * 0.35;
      v += Math.sin(2 * Math.PI * 330 * t) * 0.12;
    }
    data[i] = Math.max(-1, Math.min(1, v)) * 30000;
  }
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  Buffer.from(data.buffer).copy(b, 44);
  return b;
}

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const status = () => page.evaluate(() => Array.from(window.__house.getStatus()));

  await check('Inicio carga con sus tipografías', async () => {
    await page.goto(`${URL}?debug`, { waitUntil: 'load' });
    await page.getByRole('heading', { name: 'Empezar' }).waitFor();
    await page.getByRole('heading', { name: 'Plantillas' }).waitFor();
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const big = await document.fonts.load('900 40px "Big Shoulders"', '¿Qué');
      const ui = await document.fonts.load('500 13px "Atkinson Hyperlegible Next"', 'Empezar');
      return [...big, ...ui].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    assert(fonts.includes('Big Shoulders') && fonts.includes('Atkinson Hyperlegible Next'), `tipografías: ${fonts.join(', ')}`);
    return [...new Set(fonts)].join(', ');
  });

  await check('Las 21 plantillas suenan', async () => {
    const out = await page.evaluate(async () => {
      const h = window.__house;
      await h.audio.startAudio();
      const silent = [];
      const names = [];
      for (const g of h.templates.TEMPLATE_GENRES) {
        const p = h.templates.newProjectFromGenre(g.id);
        await h.audio.audition(p);
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 900) {
          await new Promise((r) => setTimeout(r, 50));
          peak = Math.max(peak, h.getStatus()[8]);
        }
        names.push(g.id);
        if (peak < 0.05) silent.push(`${g.id} (${peak.toFixed(3)})`);
      }
      h.audio.endAudition();
      return { names, silent };
    });
    assert(out.names.length === 21, `${out.names.length} plantillas`);
    assert(!out.silent.length, `sin sonido: ${out.silent.join(', ')}`);
    return out.names.join(', ');
  });

  await check('El motor suena al presionar Espacio', async () => {
    await page.locator('.pl-fila', { hasText: 'Tech house' }).getByRole('button', { name: 'Crear' }).click();
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    const s = await status();
    assert(s[0] === 1, 'no está reproduciendo');
    assert(s[1] >= 8, `el paso no avanza (${s[1]})`);
    assert(s[8] > 0.1, `sin nivel de salida (${s[8]})`);
    assert(s[51] === 126, `BPM ${s[51]}`);
    return `paso ${s[1]}, pico ${s[8].toFixed(2)}`;
  });

  await check('Cada bombo prende su pad, aunque caiga entre dos cuadros', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('.rejilla .pad');
      let on = el.classList.contains('golpe');
      window.__flashes = 0;
      window.__step0 = window.__house.getStatus()[1];
      window.__obs = new MutationObserver(() => {
        const now = el.classList.contains('golpe');
        if (now && !on) window.__flashes++;
        on = now;
      });
      window.__obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    await page.waitForTimeout(4000);
    const [flashes, steps] = await page.evaluate(() => {
      window.__obs.disconnect();
      return [window.__flashes, window.__house.getStatus()[1] - window.__step0];
    });
    const kicks = steps / 4;
    assert(Math.abs(flashes - kicks) <= 1, `${flashes} destellos para ${kicks.toFixed(1)} bombos`);
    return `${flashes} destellos, ${kicks.toFixed(1)} bombos`;
  });

  await check('Modo Canción salta al ¡Drop!', async () => {
    await page.getByRole('radio', { name: 'Canción' }).click();
    await page.locator('.lt-sec', { hasText: '¡Drop!' }).first().click();
    await page.waitForTimeout(600);
    const s = await status();
    assert(s[53] === 1, 'no está en modo canción');
    assert(s[4] === 2 && s[49] === 3, `sección ${s[4]}, tipo ${s[49]}`);
    await page.keyboard.press('Space');
    return `compás ${s[2] + 1}`;
  });

  await check('La regla de la línea de tiempo mueve el cabezal', async () => {
    const regla = page.locator('.lt-regla');
    const box = await regla.boundingBox();
    // 50 % of 72 bars = bar 37 (it snaps to the beat).
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const s = await status();
    assert(s[0] === 0, 'no debería reproducir');
    assert(s[2] === 36 && s[3] % 4 === 0, `compás ${s[2] + 1}, paso ${s[3]}`);
    const lcd = await page.locator('.lcd').first().innerText();
    assert(lcd.replace(/\s/g, '').startsWith('37.1.1'), `pantalla: ${lcd}`);
    // Arrows move it a beat.
    await regla.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    const s2 = await status();
    assert(s2[1] - s[1] === 4, `flecha: ${s[1]} → ${s2[1]}`);
    await page.keyboard.press('Escape');
    return `compás ${s[2] + 1}`;
  });

  await check('Deshacer regresa un paso', async () => {
    const before = await page.evaluate(() => window.__house.useStudio.getState().project.tracks[0].steps[2].on);
    await page.getByRole('button', { name: /^Paso 3/ }).first().click();
    const mid = await page.evaluate(() => window.__house.useStudio.getState().project.tracks[0].steps[2].on);
    await page.keyboard.press('Control+z');
    const after = await page.evaluate(() => window.__house.useStudio.getState().project.tracks[0].steps[2].on);
    assert(mid !== before && after === before, `${before} → ${mid} → ${after}`);
    return 'ok';
  });

  await check('El Soundboard suena aunque la canción esté parada', async () => {
    await page.getByRole('radio', { name: 'Soundboard' }).click();
    await page.getByText('Teclado: Soundboard').waitFor({ timeout: 2000 });
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(150);
    const s = await status();
    assert(s[0] === 0, 'la canción debería estar parada');
    assert(s[8] > 0.1, `sin sonido (${s[8]})`);
    // Right click changes a key's sound; the picker marks the current one.
    await page.getByRole('button', { name: /^Bombo rumble, tecla A/ }).click({ button: 'right' });
    const marked = await page.locator('.sb-lista button.actual').innerText();
    assert(marked.includes('Bombo rumble'), `marcado: ${marked}`);
    await page.getByRole('button', { name: 'Conga alta', exact: true }).click();
    await page.getByRole('button', { name: /^Conga alta, tecla A/ }).waitFor();
    await page.getByRole('radio', { name: 'Pads' }).click();
    return `pico ${s[8].toFixed(2)}`;
  });

  await check('Exportar canción escribe un WAV válido', async () => {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dl = page.waitForEvent('download', { timeout: 90000 });
    await page.getByRole('button', { name: /Exportar canción \(/ }).click();
    const d = await dl;
    const file = join(mkdtempSync(join(tmpdir(), 'house-')), 'cancion.wav');
    await d.saveAs(file);
    const b = readFileSync(file);
    assert(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE', 'no es WAV');
    const sr = b.readUInt32LE(24);
    const ch = b.readUInt16LE(22);
    const bits = b.readUInt16LE(34);
    const secs = b.readUInt32LE(40) / (sr * ch * (bits / 8));
    // 72 bars at 126 BPM = 137.1 s, plus the tails of reverb and delay.
    assert(sr === 44100 && ch === 2 && bits === 16, `${sr} Hz, ${ch} canales, ${bits} bits`);
    assert(secs > 137 && secs < 141, `duración ${secs.toFixed(1)} s`);
    let peak = 0;
    for (let i = 44; i < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)));
    assert(peak > 20000 && peak < 32767 * 0.9, `pico ${peak}`);
    await page.keyboard.press('Escape');
    return `${secs.toFixed(1)} s, pico ${(20 * Math.log10(peak / 32767)).toFixed(1)} dB`;
  });

  await check('Efectos: agregar uno en la mezcla y mover su perilla', async () => {
    await page.keyboard.press('F3');
    await page.locator('.fx-mini').first().getByRole('button', { name: '+ Efecto' }).first().click();
    await page.getByRole('menuitemradio', { name: /^Distorsión/ }).click();
    const fx = () => page.evaluate(() => window.__house.useStudio.getState().project.tracks[0].fx[0]);
    const a = await fx();
    assert(a.kind === 6, `efecto ${a.kind}`);
    await page.locator('.fx-mini').first().getByRole('button', { name: 'Distorsión' }).click();
    const knob = page.locator('.fx-pop [role=slider]').first();
    await knob.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    const b = await fx();
    assert(Math.abs(b.knobs[0] - a.knobs[0] - 0.02) < 0.001, `perilla ${a.knobs[0]} → ${b.knobs[0]}`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F1');
    return `perilla ${b.knobs[0].toFixed(2)}`;
  });

  await check('Arreglo: una transición dibuja su curva', async () => {
    await page.keyboard.press('F2');
    await page.locator('.lt-sec', { hasText: 'Subida' }).first().click();
    await page.getByRole('button', { name: /Transición/ }).click();
    await page.getByRole('menuitem', { name: /Filtro que se abre/ }).click();
    await page.locator('.carril').first().waitFor();
    // The new curve scrolls into view; wait until it stops moving.
    await page.waitForTimeout(700);
    const lanes = await page.evaluate(() => window.__house.useStudio.getState().project.lanes);
    assert(lanes.length === 1 && lanes[0].points.length >= 2, `${lanes.length} curvas`);
    const pts = lanes[0].points;
    // Before the section the filter rests open; it starts closed and opens up to the drop.
    const low = Math.min(...pts.map((pt) => pt.value));
    assert(low < 0.2 && pts[pts.length - 1].value === 0.5, `la curva no se abre: ${pts.map((pt) => pt.value).join(', ')}`);
    // Drag the last point down: the curve changes where you drop it.
    const punto = page.locator('.carril .punto').last();
    const pb = await punto.boundingBox();
    await page.mouse.move(pb.x + 4, pb.y + 4);
    await page.mouse.down();
    await page.mouse.move(pb.x + 4, pb.y + 14, { steps: 4 });
    await page.mouse.up();
    const moved = await page.evaluate(() => window.__house.useStudio.getState().project.lanes[0].points.at(-1).value);
    assert(moved < 0.5, `punto 0.5 → ${moved}`);
    await page.getByRole('button', { name: 'Listo' }).click();
    return `${pts.length} puntos`;
  });

  await check('Proyecto en blanco desde el menú Archivo', async () => {
    await page.getByRole('menuitem', { name: 'Archivo' }).click();
    await page.getByRole('menuitem', { name: /Proyecto en blanco/ }).click();
    await page.waitForTimeout(400);
    const p = await page.evaluate(() => window.__house.useStudio.getState().project);
    assert(p.tracks.length === 0 && p.sections.length === 1, `${p.tracks.length} pistas, ${p.sections.length} secciones`);
    assert(p.name === 'Proyecto en blanco', p.name);
    await page.getByText('Tu proyecto está en blanco.').waitFor();
    return p.name;
  });

  await check('Editor de audio: recorta, usa la parte y la vuelve a abrir', async () => {
    await page.getByRole('tab', { name: 'Mis samples' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importar audio' }).click()]);
    await chooser.setFiles({ name: 'loop-prueba.wav', mimeType: 'audio/wav', buffer: testWav() });
    await page.locator('.ea-onda').waitFor();
    const e0 = await page.evaluate(() => ({ start: window.__house.useAudioEdit.getState().start, end: window.__house.useAudioEdit.getState().end }));
    // The silence at both ends is already left out.
    assert(e0.start > 0.1 && e0.start < 0.16 && e0.end > 0.84 && e0.end < 0.9, `selección ${e0.start.toFixed(3)}..${e0.end.toFixed(3)}`);
    // Drag the start handle to the middle.
    const onda = await page.locator('.ea-onda').boundingBox();
    const asa = await page.locator('.ea-asa.ini').boundingBox();
    await page.mouse.move(asa.x + asa.width / 2, asa.y + asa.height / 2);
    await page.mouse.down();
    await page.mouse.move(onda.x + onda.width * 0.5, asa.y + asa.height / 2, { steps: 6 });
    await page.mouse.up();
    const e1 = await page.evaluate(() => window.__house.useAudioEdit.getState().start);
    assert(Math.abs(e1 - 0.5) < 0.01, `inicio ${e1.toFixed(3)}`);
    await page.getByRole('button', { name: 'Usar en un pad nuevo' }).click();
    await page.locator('.ea-onda').waitFor({ state: 'detached' });
    const t = await page.evaluate(() => window.__house.useStudio.getState().project.tracks.at(-1));
    assert(t.kind === 'sampler' && Math.abs(t.params[4] - 0.5) < 0.01 && Math.abs(t.params[5] - e0.end) < 0.001, `pista ${t.kind} ${t.params.join(',')}`);
    // The pad sounds (the chosen part starts on a kick).
    await page.locator('.rejilla .pad').first().click();
    const peak = await page.evaluate(async () => {
      let m = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 400) {
        m = Math.max(m, window.__house.getStatus()[8]);
        await new Promise((r) => setTimeout(r, 10));
      }
      return m;
    });
    assert(peak > 0.1, `sin sonido (${peak})`);
    // "Editar audio" opens the same part.
    await page.getByRole('button', { name: 'Editar audio' }).click();
    await page.locator('.ea-onda').waitFor();
    const again = await page.evaluate(() => window.__house.useAudioEdit.getState().start);
    assert(Math.abs(again - t.params[4]) < 0.001, `reabre en ${again}`);
    await page.getByRole('button', { name: /^Usar en “loop-prueba”/ }).waitFor();
    return `parte ${t.params[4].toFixed(2)}..${t.params[5].toFixed(2)}`;
  });

  await check('Editor de audio: cortar en 4 pads', async () => {
    await page.getByRole('button', { name: /Cortar en pads/ }).click();
    await page.getByRole('menuitem', { name: '4 pads' }).click();
    await page.locator('.ea-onda').waitFor({ state: 'detached' });
    const tracks = await page.evaluate(() => window.__house.useStudio.getState().project.tracks.slice(-4));
    assert(tracks.length === 4 && tracks.every((t) => t.kind === 'sampler' && t.sampleSlot === tracks[0].sampleSlot), 'no son 4 pads del mismo audio');
    for (let i = 1; i < 4; i++) assert(Math.abs(tracks[i].params[4] - tracks[i - 1].params[5]) < 1e-6, `corte ${i}`);
    return tracks.map((t) => `${t.params[4].toFixed(2)}-${t.params[5].toFixed(2)}`).join(' ');
  });

  await check('Grabar: al parar se abre el editor con la toma', async () => {
    await page.getByRole('menuitem', { name: 'Agregar' }).click();
    await page.getByRole('menuitem', { name: /Grabar voz o sonido/ }).click();
    const rec = page.getByRole('button', { name: 'Grabar toma' });
    await rec.waitFor();
    await page.waitForFunction(() => !document.querySelector('.grabar-btn')?.hasAttribute('disabled'), null, { timeout: 5000 });
    await rec.click();
    await page.waitForTimeout(1500);
    await page.locator('.grabar-btn').click();
    await page.locator('.ea-onda').waitFor({ timeout: 5000 });
    const src = await page.evaluate(() => {
      const s = window.__house.useAudioEdit.getState().source;
      return { secs: s.data.length / s.sr, family: s.family, name: s.name };
    });
    assert(src.family === 'voz' && src.secs > 0.2, `toma de ${src.secs.toFixed(2)} s (${src.family})`);
    // Cancel goes back to the recording, which can open the editor again.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Recortar y usar' }).waitFor();
    await page.keyboard.press('Escape');
    return `${src.name}, ${src.secs.toFixed(1)} s`;
  });

  await check('Piano roll: progresión, mover y borrar acordes', async () => {
    await page.getByRole('tab', { name: 'Sonidos' }).click();
    await page.getByPlaceholder('Buscar sonidos').fill('piano fm');
    await page.locator('.lista .item', { hasText: 'Piano FM' }).first().dblclick();
    await page.getByPlaceholder('Buscar sonidos').fill('');
    await page.keyboard.press('F4');
    await page.getByRole('button', { name: /Progresiones/ }).click();
    await page.locator('.menu [role=menuitem]').first().click();
    await page.locator('.pr-acorde').nth(3).waitFor();
    const names = await page.locator('.pr-acorde b').allInnerTexts();
    assert(names.join(' ') === 'Dom Lab Mib Sib', `acordes: ${names.join(' ')}`);
    // Move the second chord half a bar later.
    const b = await page.locator('.pr-acorde').nth(1).boundingBox();
    const area = await page.locator('.pr-tira-area').boundingBox();
    const col = area.width / 64;
    await page.mouse.move(b.x + 30, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 30 + col * 8, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    const steps = await page.evaluate(() => {
      const t = window.__house.useStudio.getState().project.tracks.at(-1);
      return t.steps.map((s, i) => (s.on ? i : -1)).filter((i) => i >= 0);
    });
    assert(steps.join(',') === '0,24,32,48', `pasos ${steps.join(',')}`);
    // Delete it from its menu.
    await page.locator('.pr-acorde-mas').nth(1).click();
    await page.getByRole('menuitem', { name: 'Borrar acorde' }).click();
    assert((await page.locator('.pr-acorde').count()) === 3, 'no se borró');
    // It plays: the chords reach the track meter.
    await page.getByRole('radio', { name: 'Loop' }).click();
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
    const idx = await page.evaluate(() => window.__house.useStudio.getState().project.tracks.length - 1);
    const s = await status();
    await page.keyboard.press('Space');
    assert(s[64 + idx] > 0.01, `sin nivel en la pista (${s[64 + idx]})`);
    return names.join(' ');
  });

  await check('Tutorial: la lección sigue sola cuando haces el paso', async () => {
    await page.keyboard.press('F1');
    await page.getByRole('menuitem', { name: 'Ayuda' }).click();
    await page.getByRole('menuitem', { name: /Tutorial/ }).click();
    await page.getByRole('button', { name: /Conoce el estudio/ }).click();
    await page.locator('.tour-burbuja h3', { hasText: 'Bienvenida a HOUSE' }).waitFor();
    const p = await page.evaluate(() => window.__house.useStudio.getState().project.name);
    assert(p === 'Práctica: conoce el estudio', p);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.locator('.tour-burbuja h3', { hasText: 'Reproducir y parar' }).waitFor();
    assert(await page.locator('.tour-foco').count(), 'sin foco');
    await page.getByRole('button', { name: 'Reproducir' }).click();
    await page.locator('.tour-burbuja h3', { hasText: 'Dónde vas' }).waitFor({ timeout: 4000 });
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Salir del tutorial' }).click();
    return 'avanzó al reproducir';
  });

  await check('La ventana de Visuales abre y recibe la música', async () => {
    const vis = await ctx.newPage();
    const vErr = [];
    vis.on('pageerror', (e) => vErr.push(String(e)));
    await vis.goto(`${URL}#visuales`, { waitUntil: 'load' });
    await vis.waitForTimeout(1500);
    assert((await vis.title()) === 'HOUSE · Visuales', 'título');
    assert(await vis.locator('canvas').count(), 'sin canvas');
    assert(!vErr.length, vErr.join('\n'));
    await vis.close();
    return 'ok';
  });

  await check('Modo seguro: nunca más de 3 destellos por segundo', async () => {
    const out = await page.evaluate(() => {
      const count = (lum) => {
        let worst = 0;
        for (let cell = 0; cell < 16; cell++) {
          const series = lum.map((l) => l[cell]);
          const swings = [];
          let dir = 0;
          let ref = series[0];
          series.forEach((v, i) => {
            if (dir >= 0 && ref - v >= 0.1 && Math.min(ref, v) < 0.8) (swings.push(i), (dir = -1), (ref = v));
            else if (dir <= 0 && v - ref >= 0.1 && Math.min(ref, v) < 0.8) (swings.push(i), (dir = 1), (ref = v));
            else if ((dir >= 0 && v > ref) || (dir <= 0 && v < ref)) ref = v;
          });
          for (const s of swings) worst = Math.max(worst, Math.floor(swings.filter((t) => t >= s && t < s + 60).length / 2));
        }
        return worst;
      };
      const base = { speed: 1, beats: 0, snare: 0, hat: 0, low: 0, mid: 0, high: 0, energy: 0, mood: 0.5, build: 0, drop: 0, bands: new Array(16).fill(0), brightness: 1, blackout: false };
      const run = (scene, body, input) => {
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = 90;
        const r = new window.__house.VisualsRenderer(c, scene);
        if (body) r.replaceScene(scene, body);
        const lum = [];
        let smooth = 0;
        for (let i = 0; i < 360; i++) {
          r.frame({ ...base, ...input(i), dt: 1 / 60 });
          lum.push(r.readOutputLuma());
          smooth = Math.max(smooth, r.smoothing());
        }
        r.dispose();
        return { flashes: count(lum), smooth };
      };
      const strobe = (hz) => `vec3 scene(vec2 p) { return vec3(step(0.5, fract(uTime * ${hz.toFixed(1)}))); }`;
      const res = {};
      for (const hz of [4, 8, 15, 30]) res[`estrobo ${hz * 2} cambios/s`] = run('aurora', strobe(hz), () => ({ kick: 0 })).flashes;
      res['estrobo en un cuarto'] = run('aurora', `vec3 scene(vec2 p) { vec2 uv = gl_FragCoord.xy / uRes; return (uv.x < 0.5 && uv.y < 0.5) ? vec3(step(0.5, fract(uTime * 15.0))) : vec3(0.1); }`, () => ({ kick: 0 })).flashes;
      const hammer = (i) => {
        const k = Math.max(0, 1 - (((i / 60) * 8) % 1) * 4);
        return { kick: k, snare: k, hat: k, low: k, mid: k, high: k, energy: k, mood: 1, build: 1, drop: 1, speed: 1.6, beats: i / 30, bands: new Array(16).fill(k) };
      };
      let sm = 0;
      const groove = (i) => {
        const raw = Math.exp(-(((i / 60) * 2.1) % 1) / 0.25);
        sm += (raw - sm) * (1 - Math.exp(-1 / 60 / 0.06));
        return { kick: sm, low: 0.4 + 0.3 * sm, mid: 0.4, high: 0.3, energy: 0.5, mood: 0.6, beats: i / 30, bands: new Array(16).fill(0.5) };
      };
      const calm = [];
      for (const id of ['caleidoscopio', 'tunel', 'plasma', 'aurora', 'oceano', 'luciernagas', 'ecualizador', 'reticula']) {
        res[`${id} con el bombo a 8 Hz`] = run(id, null, hammer).flashes;
        sm = 0;
        const g = run(id, null, groove);
        res[`${id} con un groove`] = g.flashes;
        if (g.smooth) calm.push(id);
      }
      return { res, calm };
    });
    const bad = Object.entries(out.res).filter(([, v]) => v > 3);
    assert(!bad.length, bad.map(([k, v]) => `${k}: ${v}`).join(', '));
    assert(!out.calm.length, `escenas que activan el suavizado con música normal: ${out.calm.join(', ')}`);
    return `peor caso ${Math.max(...Object.values(out.res))} destellos/s`;
  });

  await check('Sin errores en la consola', async () => {
    const real = errors.filter((e) => !/GPU stall due to ReadPixels/.test(e));
    assert(!real.length, real.join('\n'));
    return 'ok';
  });
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FALLA'} ${r.name} (${(r.ms / 1000).toFixed(1)} s)${r.detail ? `: ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} prueba(s) fallaron.` : `\nLas ${results.length} pruebas pasaron.`);
process.exit(failed ? 1 : 0);
