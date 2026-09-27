// WebGL2 renderer for the visuals: scenes, crossfades and the safe mode.
//
// Safe mode (always on): the picture is measured on a 4×4 grid every frame
// (GPU downsample, then a 16-pixel read). Each region's luminance may change
// at most 0.6 per second (relative luminance, 0..1). A WCAG flash is a rise
// and a fall of 0.1 or more, so each one takes at least 1/3 s: never more
// than 3 flashes per second. Saturated red is also toned down.
import { SCENES, sceneSource } from './scenes';
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

// Averages each quarter of the picture (reading a coarse mip level).
const PROBE = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uLod;
out vec4 o;
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 uv = (cell + (vec2(float(i), float(j)) + 0.5) / 4.0) / 4.0;
      acc += textureLod(uSrc, uv, uLod);
    }
  o = acc / 16.0;
}
`;

const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uGain;
uniform vec2 uSize;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c = texture(uSrc, uv).rgb;
  // Gain map: 4×4 regions, smooth between their centers.
  float g = texture(uGain, uv).r;
  c *= g;
  // Safe mode: saturated red is the most dangerous colour; soften it.
  float red = max(0.0, c.r - max(c.g, c.b));
  c.r -= red * 0.35;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
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

const MAX_RATE = 0.6; // relative luminance per second
const GRID = 4;

export class VisualsRenderer {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private scenes = new Map<SceneId, Prog>();
  private mixP: Prog;
  private probeP: Prog;
  private finalP: Prog;
  private a: Target | null = null;
  private b: Target | null = null;
  private m: Target | null = null;
  private probe: Target;
  private gainTex: WebGLTexture;
  private px = new Uint8Array(GRID * GRID * 4);
  private lumaOut = new Float32Array(GRID * GRID).fill(-1);
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
  /** Opposite luminance swings of 0.1+ seen per region (for the safety test). */
  private swings: { dir: number; ref: number; times: number[] }[] = Array.from({ length: GRID * GRID }, () => ({ dir: 0, ref: 0, times: [] }));
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
    this.probeP = this.program(PROBE, ['uSrc', 'uLod']);
    this.finalP = this.program(FINAL, ['uSrc', 'uGain', 'uSize']);
    this.probe = this.target(GRID, GRID, false);
    this.gainTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.gainTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, GRID, GRID, 0, gl.RED, gl.FLOAT, this.gains);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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

    // Measure 4×4 regions.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, M.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.probe.fb);
    gl.viewport(0, 0, GRID, GRID);
    gl.useProgram(this.probeP.p);
    gl.uniform1i(this.probeP.u.uSrc, 0);
    gl.uniform1f(this.probeP.u.uLod, Math.max(0, Math.log2(Math.max(M.w, M.h) / (GRID * 4))));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, GRID, GRID, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
    this.limit(dt, f);

    // Final picture on screen, with the gain map.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.gainTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RED, gl.FLOAT, this.gains);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.finalP.p);
    gl.uniform1i(this.finalP.u.uSrc, 0);
    gl.uniform1i(this.finalP.u.uGain, 1);
    gl.uniform2f(this.finalP.u.uSize, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Slew-limits each region's luminance and turns the result into gains. */
  private limit(dt: number, f: FrameInput): void {
    const max = MAX_RATE * dt;
    const bright = f.blackout ? 0 : Math.max(0, Math.min(1, f.brightness));
    for (let i = 0; i < GRID * GRID; i++) {
      const r = srgbToLinear(this.px[i * 4] / 255);
      const g = srgbToLinear(this.px[i * 4 + 1] / 255);
      const b = srgbToLinear(this.px[i * 4 + 2] / 255);
      const lin = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const want = lin * bright;
      const prev = this.lumaOut[i] < 0 ? Math.min(want, 0.05) : this.lumaOut[i];
      const out = Math.min(prev + max, Math.max(prev - max, want));
      this.lumaOut[i] = out;
      // Linear gain, applied to sRGB values: g^(1/2.2).
      const G = lin > 0.002 ? Math.min(4, out / lin) : out > 0.002 ? 4 : bright;
      this.gains[i] = Math.pow(G, 1 / 2.2);
      this.track(i, out);
    }
  }

  private track(i: number, l: number): void {
    const s = this.swings[i];
    if (s.dir === 0) {
      s.ref = l;
      s.dir = 1;
      return;
    }
    if (s.dir > 0) {
      if (l > s.ref) s.ref = l;
      else if (s.ref - l >= 0.1) {
        s.times.push(this.clock);
        s.dir = -1;
        s.ref = l;
      }
    } else {
      if (l < s.ref) s.ref = l;
      else if (l - s.ref >= 0.1) {
        s.times.push(this.clock);
        s.dir = 1;
        s.ref = l;
      }
    }
    while (s.times.length && this.clock - s.times[0] > 1) s.times.shift();
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
    for (const s of this.swings) most = Math.max(most, Math.floor(s.times.length / 2));
    return most;
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
    this.free(this.probe);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
