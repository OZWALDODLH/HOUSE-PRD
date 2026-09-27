// Scenes for the visuals window (GLSL ES 3.00). The kick moves shapes, never
// the overall light: brightness is left to the safe-mode limiter.
import type { SceneId } from './link';

export interface SceneInfo {
  id: SceneId;
  name: string;
  kind: 'psicodelica' | 'relajante' | 'fiesta';
}

export const SCENES: SceneInfo[] = [
  { id: 'caleidoscopio', name: 'Caleidoscopio', kind: 'psicodelica' },
  { id: 'tunel', name: 'Túnel infinito', kind: 'psicodelica' },
  { id: 'plasma', name: 'Plasma líquido', kind: 'psicodelica' },
  { id: 'aurora', name: 'Aurora', kind: 'relajante' },
  { id: 'oceano', name: 'Océano de noche', kind: 'relajante' },
  { id: 'luciernagas', name: 'Luciérnagas', kind: 'relajante' },
  { id: 'ecualizador', name: 'Ecualizador sonidero', kind: 'fiesta' },
  { id: 'reticula', name: 'Retícula retro', kind: 'fiesta' },
];

export const PRELUDE = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uBeats;
uniform float uKick;
uniform float uSnare;
uniform float uHat;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uMood;
uniform float uBuild;
uniform float uDrop;
uniform float uBands[16];
out vec4 outColor;

vec3 pal(float t) {
  vec3 b = mix(vec3(0.26, 0.3, 0.34), vec3(0.5), uMood);
  vec3 d = mix(vec3(0.52, 0.58, 0.68), vec3(0.0, 0.33, 0.67), uMood);
  return vec3(0.5) + b * cos(6.2831853 * (t + d));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 scene(vec2 p);
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  outColor = vec4(clamp(scene(p), 0.0, 1.0), 1.0);
}
`;

const BODIES: Record<SceneId, string> = {
  caleidoscopio: `
vec3 scene(vec2 p) {
  float t = uTime;
  float n = 6.0 + floor(uMood * 6.0 + 0.5);
  float r = length(p);
  float a = atan(p.y, p.x) + t * 0.05;
  float seg = 6.2831853 / n;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r;
  q *= 1.6 - 0.22 * uKick - 0.1 * uDrop;
  q += vec2(t * 0.11, -t * 0.07);
  float v = sin(q.x * 7.0 + sin(q.y * 5.0 + t * 0.6) * 1.5) + sin(q.y * 8.0 - t * 0.9 + uLow * 2.0) + sin((q.x + q.y) * 6.0 + t * 0.4);
  v /= 3.0;
  float rings = 0.5 + 0.5 * sin(r * 18.0 - t * 1.5 - uKick * 1.5);
  vec3 col = pal(v * 0.35 + r * 0.4 + t * 0.03);
  col *= 0.55 + 0.45 * rings;
  col *= smoothstep(1.25, 0.15, r);
  return col;
}`,
  tunel: `
vec3 scene(vec2 p) {
  float t = uTime;
  float r = max(length(p), 0.001);
  float a = atan(p.y, p.x);
  float z = 0.4 / r + t * (0.6 + uBuild * 1.6) + uKick * 0.12;
  float ang = a / 6.2831853 * 8.0 + t * 0.1 + z * 0.08;
  float d = abs(fract(z * 1.5) - 0.5);
  float w = 0.06 + fwidth(z * 1.5);
  float rings = smoothstep(0.5 - w, 0.5, d);
  float spokes = 0.6 + 0.4 * smoothstep(0.2, 0.5, abs(fract(ang) - 0.5));
  vec3 col = pal(z * 0.06 + a * 0.02) * (0.25 + 0.75 * rings) * spokes;
  col *= smoothstep(0.02, 0.4, r);
  col += pal(z * 0.06 + 0.5) * 0.12 * uHigh * smoothstep(0.1, 0.6, r);
  return col;
}`,
  plasma: `
vec3 scene(vec2 p) {
  float t = uTime * 0.6;
  vec2 q = p * (1.8 - 0.2 * uKick);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    q += 0.32 * vec2(sin(q.y * 1.6 + t + fi * 1.3), cos(q.x * 1.4 - t * 0.8 + fi * 2.1));
  }
  float v = sin(q.x + q.y * 0.7 + uLow * 1.5) * 0.5 + 0.5;
  float w = sin(length(q) * 2.5 - t) * 0.5 + 0.5;
  vec3 col = pal(v * 0.6 + w * 0.3 + t * 0.02);
  return col * (0.55 + 0.3 * w + 0.15 * uEnergy);
}`,
  aurora: `
vec3 scene(vec2 p) {
  float t = uTime * 0.35;
  vec3 col = mix(vec3(0.01, 0.015, 0.04), vec3(0.02, 0.05, 0.1), clamp(p.y + 0.5, 0.0, 1.0));
  vec2 g = floor((p + 1.0) * 90.0);
  float h = hash(g);
  col += step(0.994, h) * (0.3 + 0.3 * sin(uTime * 1.2 + h * 60.0)) * smoothstep(-0.2, 0.5, p.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = p.x * (1.2 + fi * 0.3) + fi * 2.3;
    float curtain = 0.05 + fi * 0.08 + 0.12 * sin(x * 1.7 + t * (1.0 + fi * 0.3)) + 0.06 * fbm(vec2(x * 2.0, t * 0.5 + fi));
    float d = p.y - curtain;
    float glow = exp(-max(d, 0.0) * (5.0 - fi)) * smoothstep(-0.02, 0.03, d);
    float rays = 0.55 + 0.45 * fbm(vec2(x * 12.0, t * 2.0 + fi * 5.0));
    vec3 tint = mix(vec3(0.15, 0.95, 0.55), vec3(0.45, 0.35, 0.95), fi / 2.0);
    tint = mix(tint, pal(fi * 0.2 + t * 0.05), uMood * 0.6);
    col += glow * rays * tint * (0.26 + 0.2 * uEnergy + 0.08 * uLow);
  }
  float ground = -0.38 + 0.03 * sin(p.x * 3.0) + 0.02 * sin(p.x * 7.0 + 1.0);
  col = mix(col, vec3(0.005), smoothstep(ground + 0.005, ground - 0.005, p.y));
  return col;
}`,
  oceano: `
vec3 scene(vec2 p) {
  float t = uTime * 0.4;
  vec3 col = mix(vec3(0.08, 0.1, 0.2), vec3(0.02, 0.03, 0.08), smoothstep(-0.1, 0.5, p.y));
  vec2 moon = vec2(0.35, 0.22);
  float md = length(p - moon);
  col += vec3(0.9, 0.88, 0.8) * smoothstep(0.075, 0.07, md) + vec3(0.25, 0.25, 0.3) * exp(-md * 6.0) * 0.4;
  float horizon = -0.05;
  if (p.y < horizon) {
    float depth = horizon - p.y;
    float wave = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      wave += sin(p.x * (6.0 + fi * 5.0) / (depth * 3.0 + 0.2) + t * (1.0 + fi * 0.5) + fi) * (0.5 / (fi + 1.0));
    }
    wave *= 0.6 + 0.4 * uLow;
    vec3 water = mix(vec3(0.02, 0.05, 0.1), vec3(0.01, 0.02, 0.05), clamp(depth * 2.0, 0.0, 1.0));
    float path = exp(-abs(p.x - moon.x) * (6.0 + depth * 20.0)) * (0.5 + 0.5 * wave);
    col = water + vec3(0.8, 0.8, 0.75) * path * 0.35 * clamp(1.0 - depth, 0.0, 1.0);
    col += vec3(0.05, 0.1, 0.15) * smoothstep(0.6, 1.0, wave) * clamp(1.0 - depth * 1.5, 0.0, 1.0);
  }
  col += pal(0.6) * 0.05 * uMood;
  return col;
}`,
  luciernagas: `
vec3 scene(vec2 p) {
  float t = uTime * 0.3;
  vec3 col = mix(vec3(0.01, 0.02, 0.015), vec3(0.03, 0.05, 0.035), clamp(p.y + 0.5, 0.0, 1.0));
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float scale = 4.0 + fl * 3.0;
    vec2 q = p * scale + vec2(t * (0.3 + fl * 0.1), sin(t * 0.5 + fl) * 0.5);
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash(id + fl * 17.0);
    vec2 off = vec2(sin(t * (1.0 + h) + h * 30.0), cos(t * (0.8 + h) + h * 20.0)) * 0.3;
    float d = length(f - off);
    float blink = 0.5 + 0.5 * sin(uTime * (0.6 + h) + h * 40.0);
    float glow = exp(-d * (18.0 - fl * 3.0)) * blink * step(0.35, h);
    vec3 tint = mix(vec3(0.75, 0.95, 0.35), pal(h), uMood * 0.7);
    col += tint * glow * (0.5 + 0.35 * uEnergy) / (1.0 + fl * 0.5);
  }
  return col;
}`,
  ecualizador: `
vec3 scene(vec2 p) {
  vec2 uv = gl_FragCoord.xy / uRes;
  float n = 16.0;
  float i = floor(uv.x * n);
  float fx = fract(uv.x * n);
  float v = clamp(uBands[int(clamp(i, 0.0, 15.0))], 0.0, 1.0);
  float segs = 22.0;
  float sy = floor(uv.y * 0.9 * segs) / segs;
  float lit = step(sy, v * 0.9) * step(0.1, fx) * step(fx, 0.9) * step(0.18, fract(uv.y * 0.9 * segs)) * step(uv.y, 0.9);
  vec3 ink = pal(i / n * 0.8 + uTime * 0.02);
  vec3 col = vec3(0.025, 0.02, 0.03) + lit * ink * (0.5 + 0.5 * sy);
  float lamps = 8.0;
  float lx = fract(uv.x * lamps) - 0.5;
  float ly = (uv.y - 0.95) * uRes.y / uRes.x * lamps;
  float ld = length(vec2(lx, ly));
  col += pal(floor(uv.x * lamps) / lamps + 0.2) * exp(-ld * 9.0) * (0.25 + 0.25 * uLow);
  return col;
}`,
  reticula: `
vec3 scene(vec2 p) {
  vec3 col = vec3(0.03, 0.015, 0.05);
  float horizon = 0.02;
  vec2 sc = vec2(0.0, horizon + 0.2);
  float sd = length(p - sc);
  float bands = step(0.45, fract((p.y - horizon) * 18.0 - uTime * 0.2)) + step(sc.y - 0.02, p.y);
  vec3 sun = mix(vec3(1.0, 0.4, 0.25), vec3(1.0, 0.8, 0.3), clamp((p.y - horizon) * 3.0, 0.0, 1.0));
  sun = mix(sun, pal(0.1), uMood * 0.5);
  col += sun * smoothstep(0.27, 0.26, sd) * clamp(bands, 0.0, 1.0) * 0.85;
  col += vec3(0.45, 0.12, 0.4) * exp(-sd * 3.5) * 0.3;
  if (p.y < horizon) {
    float z = 0.22 / (horizon - p.y + 0.001);
    float x = p.x * z * 1.2;
    float gz = abs(fract(z * 0.7 + uBeats * 0.5) - 0.5);
    float gx = abs(fract(x) - 0.5);
    float g = max(gz, gx);
    float aa = fwidth(g) * 1.5 + 0.01;
    float line = smoothstep(0.5 - aa - 0.02, 0.5 - 0.02, g);
    vec3 lc = mix(vec3(0.95, 0.25, 0.75), pal(0.9), uMood);
    col = vec3(0.012, 0.0, 0.03) + lc * line * clamp(1.3 - z * 0.06, 0.0, 1.0) * (0.65 + 0.35 * uLow);
  }
  return col;
}`,
};

export const sceneSource = (id: SceneId): string => PRELUDE + BODIES[id];
