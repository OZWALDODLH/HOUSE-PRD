// End-to-end checks in a real browser (Chromium): the app loads, the engine
// plays, song mode follows the sections, export writes a valid WAV, undo
// works, the visuals window opens and the safe mode holds under stress.
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
    await page.getByRole('heading', { name: '¿Qué suena hoy?' }).waitFor();
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const big = await document.fonts.load('900 40px "Big Shoulders"', '¿Qué');
      const ui = await document.fonts.load('500 13px "Atkinson Hyperlegible Next"', 'Elige');
      return [...big, ...ui].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    assert(fonts.includes('Big Shoulders') && fonts.includes('Atkinson Hyperlegible Next'), `tipografías: ${fonts.join(', ')}`);
    return [...new Set(fonts)].join(', ');
  });

  await check('El motor suena al presionar Espacio', async () => {
    await page.getByRole('button', { name: /Empezar con tech house/ }).click();
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

  await check('Modo Canción salta al ¡Drop!', async () => {
    await page.getByRole('radio', { name: 'Canción' }).click();
    await page.getByRole('button', { name: /^¡Drop!/ }).first().click();
    await page.waitForTimeout(600);
    const s = await status();
    assert(s[53] === 1, 'no está en modo canción');
    assert(s[4] === 2 && s[49] === 3, `sección ${s[4]}, tipo ${s[49]}`);
    await page.keyboard.press('Space');
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
