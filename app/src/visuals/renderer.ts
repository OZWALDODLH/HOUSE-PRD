// WebGL2 renderer for the visuals: scenes, crossfades and the safe mode.
//
// Safe mode (always on). A WCAG flash is a pair of opposite changes of 0.1 or
// more in relative luminance. Every frame, the luminance (linear, 0..1) of
// each region of a 4×4 grid is measured exactly on the GPU (a power-of-two
// luminance image and its mip chain), and per region:
// - Content that keeps pulsing (3+ swings in 2 s) is smoothed: it may change
//   at most 0.6 per second, so a flash would take at least 1/3 s.
// - Hard cap: after 4 swings (2 flashes) in the last second, no new swing is
//   allowed until the oldest one is a second old. That leaves a margin under
//   the limit of 3 flashes per second.
// The gains are applied in linear light, and the finished picture is measured
// again before it is shown; a region outside its limits is corrected and
// redrawn. Calm content is never touched. Saturated red is toned down.
import { PRELUDE, SCENES, sceneSource } from './scenes';
import type { SceneId } from './link';

export interface FrameInput {
  dt: number;
  speed: number;
  beats: number;
  kick: number;
  snare: number;
  hat: number;
  low: number;
  mid: number;
  high: number;
  energy: number;
  mood: number;
  build: number;
  drop: number;
  bands: ArrayLike<number>;
  brightness: number;
  blackout: boolean;
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const MIX = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uFade;
uniform vec2 uSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  o = mix(texture(uA, uv), texture(uB, uv), uFade);
}
`;

const SRGB = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`;

// Relative luminance of a picture, into a 256×256 image (its mip level 6 is
// the 4×4 grid of exact averages).
const MEASURE = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uLod;
out vec4 o;
${SRGB}
void main() {
  vec3 c = textureLod(uSrc, gl_FragCoord.xy / 256.0, uLod).rgb;
  float l = dot(toLinear(c), vec3(0.2126, 0.7152, 0.0722));
  o = vec4(l, l, l, 1.0);
}
`;

const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uGain;
uniform vec2 uSize;
out vec4 o;
${SRGB}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c = toLinear(texture(uSrc, uv).rgb);
  // Safe mode: saturated red is the most dangerous colour; soften it.
  float red = max(0.0, c.r - max(c.g, c.b));
  c.r -= red * 0.5;
  // One gain per region of the 4×4 grid (exactly the measured area), in linear light.
  c *= texture(uGain, uv).r;
  o = vec4(toSrgb(clamp(c, 0.0, 1.0)), 1.0);
}
`;

const COPY = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSize;
out vec4 o;
void main() { o = texture(uSrc, gl_FragCoord.xy / uSize); }
`;

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  w: number;
  h: number;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

interface Prog {
  p: WebGLProgram;
  u: Uniforms;
}

const MAX_RATE = 0.6; // relative luminance per second, when smoothing
const SWING = 0.09; // a bit under WCAG's 0.1, to keep a margin
const GRID = 4;

/** Swing detector: counts reversals of at least `SWING` in luminance. */
interface Swings {
  dir: number;
  ref: number;
  times: number[];
}

function feed(sw: Swings, v: number, now: number, keep: number): void {
  if (sw.dir === 0) {
    sw.dir = 1;
    sw.ref = v;
  } else if (sw.dir > 0) {
    if (v > sw.ref) sw.ref = v;
    else if (sw.ref - v >= SWING) {
      sw.times.push(now);
      sw.dir = -1;
      sw.ref = v;
    }
  } else if (v < sw.ref) sw.ref = v;
  else if (v - sw.ref >= SWING) {
    sw.times.push(now);
    sw.dir = 1;
    sw.ref = v;
  }
  while (sw.times.length && now - sw.times[0] > keep) sw.times.shift();
}

interface Region {
  /** What the scene wants to show (to detect pulsing content). */
  want: Swings;
  /** What was shown (for the hard cap). */
  shown: Swings;
  out: number;
  smooth: boolean;
  lo: number;
  hi: number;
}

export class VisualsRenderer {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private scenes = new Map<SceneId, Prog>();
  private mixP: Prog;
  private measureP: Prog;
  private finalP: Prog;
  private copyP: Prog;
  private a: Target | null = null;
  private b: Target | null = null;
  private m: Target | null = null;
  private f: Target | null = null;
  private lum: { tex: WebGLTexture; draw: WebGLFramebuffer; read: WebGLFramebuffer };
  private gainTex: WebGLTexture;
  private px = new Uint8Array(GRID * GRID * 4);
  private measured = new Float32Array(GRID * GRID);
  private regions: Region[] = Array.from({ length: GRID * GRID }, () => ({
    want: { dir: 0, ref: 0, times: [] },
    shown: { dir: 0, ref: 0, times: [] },
    out: -1,
    smooth: false,
    lo: 0,
    hi: 1,
  }));
  private light = 1;
  private gains = new Float32Array(GRID * GRID).fill(1);
  private time = 0;
  private current: SceneId;
  private next: SceneId | null = null;
  private fade = 0;
  private fadeTime = 1.6;
  /** Internal resolution, lowered automatically on slow machines. */
  scale = 1;
  private slow = 0;
  private fast = 0;
  private clock = 0;
  lost = false;

  constructor(private canvas: HTMLCanvasElement, first: SceneId = 'aurora') {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.current = first;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
    this.mixP = this.program(MIX, ['uA', 'uB', 'uFade', 'uSize']);
    this.measureP = this.program(MEASURE, ['uSrc', 'uLod']);
    this.finalP = this.program(FINAL, ['uSrc', 'uGain', 'uSize']);
    this.copyP = this.program(COPY, ['uSrc', 'uSize']);
    // 256×256 luminance image with all 9 mip levels; level 6 is 4×4.
    const lumTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, lumTex);
    gl.texStorage2D(gl.TEXTURE_2D, 9, gl.RGBA8, 256, 256);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const draw = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, draw);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lumTex, 0);
    const read = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, read);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lumTex, 6);
    this.lum = { tex: lumTex, draw, read };
    this.gainTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.gainTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, GRID, GRID, 0, gl.RED, gl.FLOAT, this.gains);
    // Nearest, not linear: blending with a neighbour's gain would let a
    // strobing region leak through its edges.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  private program(frag: string, names: string[]): Prog {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    const u: Uniforms = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }

  private sceneProg(id: SceneId): Prog {
    let s = this.scenes.get(id);
    if (!s) {
      s = this.program(sceneSource(id), ['uRes', 'uTime', 'uBeats', 'uKick', 'uSnare', 'uHat', 'uLow', 'uMid', 'uHigh', 'uEnergy', 'uMood', 'uBuild', 'uDrop', 'uBands']);
      this.scenes.set(id, s);
    }
    return s;
  }

  /**
   * Test helper: installs a scene from a GLSL body under a scene id (used by
   * the safe-mode test to feed a picture that tries to strobe).
   */
  replaceScene(id: SceneId, body: string): void {
    this.scenes.set(id, this.program(PRELUDE + body, ['uRes', 'uTime', 'uBeats', 'uKick', 'uSnare', 'uHat', 'uLow', 'uMid', 'uHigh', 'uEnergy', 'uMood', 'uBuild', 'uDrop', 'uBands']));
  }

  /** Compiles every scene now (avoids a hitch the first time each one appears). */
  warmUp(): void {
    for (const s of SCENES) this.sceneProg(s.id);
  }

  private target(w: number, h: number, mips: boolean): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  private free(t: Target | null): void {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fb);
  }

  private ensureTargets(): void {
    const w = Math.max(64, Math.round(this.canvas.width * this.scale));
    const h = Math.max(36, Math.round(this.canvas.height * this.scale));
    if (!this.f || this.f.w !== this.canvas.width || this.f.h !== this.canvas.height) {
      this.free(this.f);
      this.f = this.target(this.canvas.width, this.canvas.height, true);
    }
    if (this.a && this.a.w === w && this.a.h === h) return;
    this.free(this.a);
    this.free(this.b);
    this.free(this.m);
    this.a = this.target(w, h, false);
    this.b = this.target(w, h, false);
    this.m = this.target(w, h, true);
  }

  get scene(): SceneId {
    return this.next ?? this.current;
  }

  /** Changes scene with a crossfade (never a cut: cuts are flashes). */
  setScene(id: SceneId, seconds = 1.6): void {
    if (id === this.scene) return;
    if (this.next) {
      this.current = this.fade > 0.5 ? this.next : this.current;
    }
    this.next = id;
    this.fade = 0;
    this.fadeTime = Math.max(0.8, seconds);
  }

  private drawScene(id: SceneId, t: Target, f: FrameInput): void {
    const gl = this.gl;
    const s = this.sceneProg(id);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.useProgram(s.p);
    const u = s.u;
    gl.uniform2f(u.uRes, t.w, t.h);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uBeats, f.beats);
    gl.uniform1f(u.uKick, f.kick);
    gl.uniform1f(u.uSnare, f.snare);
    gl.uniform1f(u.uHat, f.hat);
    gl.uniform1f(u.uLow, f.low);
    gl.uniform1f(u.uMid, f.mid);
    gl.uniform1f(u.uHigh, f.high);
    gl.uniform1f(u.uEnergy, f.energy);
    gl.uniform1f(u.uMood, f.mood);
    gl.uniform1f(u.uBuild, f.build);
    gl.uniform1f(u.uDrop, f.drop);
    gl.uniform1fv(u.uBands, Float32Array.from(f.bands));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  frame(f: FrameInput): void {
    if (this.lost) return;
    const gl = this.gl;
    const dt = Math.min(0.1, Math.max(0, f.dt));
    this.clock += dt;
    this.time += dt * f.speed;
    this.adapt(dt);
    this.ensureTargets();
    gl.bindVertexArray(this.vao);
    const A = this.a!;
    const B = this.b!;
    const M = this.m!;

    this.drawScene(this.current, A, f);
    if (this.next) {
      this.fade = Math.min(1, this.fade + dt / this.fadeTime);
      this.drawScene(this.next, B, f);
    }

    // Mix both scenes into the measured picture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, M.fb);
    gl.viewport(0, 0, M.w, M.h);
    gl.useProgram(this.mixP.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.next ? B.tex : A.tex);
    gl.uniform1i(this.mixP.u.uA, 0);
    gl.uniform1i(this.mixP.u.uB, 1);
    gl.uniform1f(this.mixP.u.uFade, this.next ? smooth(this.fade) : 0);
    gl.uniform2f(this.mixP.u.uSize, M.w, M.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.next && this.fade >= 1) {
      this.current = this.next;
      this.next = null;
    }

    // Measure the mixed picture, decide the gains, draw the final picture.
    this.measure(M);
    this.limit(dt, f);
    const F = this.f!;
    this.drawFinal(M, F);
    // Check what will really be shown; correct any region outside its limits.
    this.measure(F);
    let fix = false;
    for (let i = 0; i < GRID * GRID; i++) {
      const r = this.regions[i];
      const m = this.measured[i];
      if (m > r.hi + 0.003 && m > 0) {
        this.gains[i] *= r.hi / m;
        fix = true;
      } else if (m < r.lo - 0.003) {
        this.gains[i] = Math.min(4, this.gains[i] * (m > 0.002 ? r.lo / m : 2));
        fix = true;
      }
    }
    if (fix) {
      this.drawFinal(M, F);
      this.measure(F);
    }
    // The limiter follows what was actually shown.
    for (let i = 0; i < GRID * GRID; i++) {
      const r = this.regions[i];
      r.out = this.measured[i];
      feed(r.shown, r.out, this.clock, 1);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.copyP.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.uniform1i(this.copyP.u.uSrc, 0);
    gl.uniform2f(this.copyP.u.uSize, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Exact relative luminance of each grid region of `t` into `this.measured`. */
  private measure(t: Target): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lum.draw);
    gl.viewport(0, 0, 256, 256);
    gl.useProgram(this.measureP.p);
    gl.uniform1i(this.measureP.u.uSrc, 0);
    gl.uniform1f(this.measureP.u.uLod, Math.max(0, Math.log2(Math.max(t.w, t.h) / 256)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, this.lum.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lum.read);
    // A synchronous read (it waits for the GPU): the limit must apply to this
    // very frame, or a one-frame flash could slip through.
    gl.readPixels(0, 0, GRID, GRID, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
    for (let i = 0; i < GRID * GRID; i++) this.measured[i] = this.px[i * 4] / 255;
  }

  private drawFinal(M: Target, F: Target): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gainTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RED, gl.FLOAT, this.gains);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, M.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.fb);
    gl.viewport(0, 0, F.w, F.h);
    gl.useProgram(this.finalP.p);
    gl.uniform1i(this.finalP.u.uSrc, 0);
    gl.uniform1i(this.finalP.u.uGain, 1);
    gl.uniform2f(this.finalP.u.uSize, F.w, F.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Decides, per region, what may be shown this frame and the gain for it. */
  private limit(dt: number, f: FrameInput): void {
    // Brightness and blackout fade (never a cut).
    const goal = f.blackout ? 0 : Math.max(0, Math.min(1, f.brightness));
    this.light += Math.max(-0.5 * dt, Math.min(0.5 * dt, goal - this.light));
    const now = this.clock;
    for (let i = 0; i < GRID * GRID; i++) {
      const r = this.regions[i];
      const lin = this.measured[i];
      const want = lin * this.light;
      feed(r.want, want, now, 2);
      if (r.want.times.length >= 3) r.smooth = true;
      else if (r.want.times.length === 0) r.smooth = false;
      let lo = 0;
      let hi = 1;
      if (r.out >= 0 && r.smooth) {
        lo = r.out - MAX_RATE * dt;
        hi = r.out + MAX_RATE * dt;
      }
      // Hard cap: two flashes in the last second, then no new swing.
      const recent = r.shown.times.filter((t) => now - t < 1).length;
      if (r.out >= 0 && recent >= 4) {
        if (r.shown.dir >= 0) lo = Math.max(lo, r.shown.ref - SWING + 0.006);
        if (r.shown.dir <= 0) hi = Math.min(hi, r.shown.ref + SWING - 0.006);
      }
      if (lo > hi) lo = hi;
      const out = Math.min(hi, Math.max(lo, want));
      r.lo = lo;
      r.hi = hi;
      this.gains[i] = lin > 0.004 ? Math.min(4, out / lin) : out > 0.004 ? 4 : this.light;
    }
  }

  /**
   * Test helper: relative luminance of the picture on screen, averaged on the
   * 4×4 grid. Must be called right after `frame`, in the same task.
   */
  readOutputLuma(): number[] {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // (Reads the screen itself, not the renderer's own measurement.)
    const sum = new Array(GRID * GRID).fill(0);
    const n = new Array(GRID * GRID).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const cell = Math.min(GRID - 1, Math.floor((y / h) * GRID)) * GRID + Math.min(GRID - 1, Math.floor((x / w) * GRID));
        sum[cell] += 0.2126 * srgbToLinear(px[k] / 255) + 0.7152 * srgbToLinear(px[k + 1] / 255) + 0.0722 * srgbToLinear(px[k + 2] / 255);
        n[cell]++;
      }
    }
    return sum.map((v, i) => v / Math.max(1, n[i]));
  }

  /** Most flashes (pairs of opposite swings) seen in any region during the last second. */
  flashesPerSecond(): number {
    let most = 0;
    for (const r of this.regions) most = Math.max(most, Math.floor(r.shown.times.filter((t) => this.clock - t < 1).length / 2));
    return most;
  }

  /** How many regions are being smoothed right now (0 when the scene is calm). */
  smoothing(): number {
    return this.regions.filter((r) => r.smooth).length;
  }

  private adapt(dt: number): void {
    if (dt > 0.024) {
      this.slow += dt;
      this.fast = 0;
    } else if (dt < 0.015) {
      this.fast += dt;
      this.slow = Math.max(0, this.slow - dt);
    }
    if (this.slow > 2 && this.scale > 0.4) {
      this.scale = Math.max(0.4, this.scale * 0.8);
      this.slow = 0;
    } else if (this.fast > 6 && this.scale < 1) {
      this.scale = Math.min(1, this.scale * 1.15);
      this.fast = 0;
    }
  }

  dispose(): void {
    this.free(this.a);
    this.free(this.b);
    this.free(this.m);
    this.free(this.f);
    this.gl.deleteTexture(this.lum.tex);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
