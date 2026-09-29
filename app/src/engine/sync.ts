// Turns the project document into engine commands: everything at once when
// the engine starts or a project opens, and only the differences after that.
import { KIND, MASTER, MAX_TRACKS, MIX, SECTION_KIND, cmd, type Cmd } from './protocol';
import { KIND_CODE } from '../state/instruments';
import type { Master, Project, Step, Track } from '../state/model';

const NO_SIDECHAIN = 255;

const stepCmd = (i: number, k: number, s: Step): Cmd => cmd.step(i, k, s.on, s.vel, s.len, s.accent, s.slide, s.notes, s.lens);

function mixCmds(i: number, t: Track): Cmd[] {
  return [
    cmd.mix(i, MIX.VOLUME_DB, t.vol),
    cmd.mix(i, MIX.PAN, t.pan),
    cmd.mix(i, MIX.MUTE, t.mute ? 1 : 0),
    cmd.mix(i, MIX.SOLO, t.solo ? 1 : 0),
    cmd.mix(i, MIX.SEND_REVERB, t.sendRev),
    cmd.mix(i, MIX.SEND_DELAY, t.sendDel),
    cmd.mix(i, MIX.DUCK, t.duck),
    cmd.mix(i, MIX.ONCE_PER_SECTION, t.once ? 1 : 0),
    cmd.mix(i, MIX.FILTER, t.filter),
    cmd.mix(i, MIX.EQ_LOW, t.eq[0]),
    cmd.mix(i, MIX.EQ_MID, t.eq[1]),
    cmd.mix(i, MIX.EQ_HIGH, t.eq[2]),
    cmd.mix(i, MIX.DRIVE, t.drive),
    cmd.mix(i, MIX.ACTIVE, 1),
  ];
}

/** Everything the engine needs to know about one track. */
export function trackCmds(i: number, t: Track): Cmd[] {
  const out: Cmd[] = [cmd.kind(i, KIND_CODE[t.kind], t.model)];
  t.params.forEach((v, k) => out.push(cmd.param(i, k, v)));
  if (t.kind === 'sampler') out.push(cmd.sampleSlot(i, t.sampleSlot ?? 0));
  out.push(...mixCmds(i, t), cmd.length(i, t.length), cmd.clearSteps(i));
  t.steps.forEach((s, k) => {
    if (s.on) out.push(stepCmd(i, k, s));
  });
  return out;
}

function diffTrack(i: number, a: Track, b: Track): Cmd[] {
  if (a === b) return [];
  if (a.kind !== b.kind || a.model !== b.model) return trackCmds(i, b);
  const out: Cmd[] = [];
  if (a.params !== b.params) b.params.forEach((v, k) => v !== a.params[k] && out.push(cmd.param(i, k, v)));
  if (b.kind === 'sampler' && a.sampleSlot !== b.sampleSlot) out.push(cmd.sampleSlot(i, b.sampleSlot ?? 0));
  if (a.vol !== b.vol) out.push(cmd.mix(i, MIX.VOLUME_DB, b.vol));
  if (a.pan !== b.pan) out.push(cmd.mix(i, MIX.PAN, b.pan));
  if (a.mute !== b.mute) out.push(cmd.mix(i, MIX.MUTE, b.mute ? 1 : 0));
  if (a.solo !== b.solo) out.push(cmd.mix(i, MIX.SOLO, b.solo ? 1 : 0));
  if (a.sendRev !== b.sendRev) out.push(cmd.mix(i, MIX.SEND_REVERB, b.sendRev));
  if (a.sendDel !== b.sendDel) out.push(cmd.mix(i, MIX.SEND_DELAY, b.sendDel));
  if (a.duck !== b.duck) out.push(cmd.mix(i, MIX.DUCK, b.duck));
  if (a.once !== b.once) out.push(cmd.mix(i, MIX.ONCE_PER_SECTION, b.once ? 1 : 0));
  if (a.filter !== b.filter) out.push(cmd.mix(i, MIX.FILTER, b.filter));
  if (a.eq !== b.eq) {
    if (a.eq[0] !== b.eq[0]) out.push(cmd.mix(i, MIX.EQ_LOW, b.eq[0]));
    if (a.eq[1] !== b.eq[1]) out.push(cmd.mix(i, MIX.EQ_MID, b.eq[1]));
    if (a.eq[2] !== b.eq[2]) out.push(cmd.mix(i, MIX.EQ_HIGH, b.eq[2]));
  }
  if (a.drive !== b.drive) out.push(cmd.mix(i, MIX.DRIVE, b.drive));
  if (a.length !== b.length) out.push(cmd.length(i, b.length));
  if (a.steps !== b.steps) b.steps.forEach((s, k) => s !== a.steps[k] && out.push(stepCmd(i, k, s)));
  return out;
}

/** Which tracks play in each section, as bit masks over engine track slots. */
export function sectionCmds(p: Project, extra: { bars: number; mask: number; kind: number }[] = []): Cmd[] {
  const index = new Map(p.tracks.map((t, i) => [t.id, i]));
  const list = p.sections.slice(0, 32 - extra.length).map((s) => ({
    bars: s.bars,
    mask: s.tracks.reduce((m, id) => (index.has(id) ? m | (1 << index.get(id)!) : m), 0) >>> 0,
    kind: SECTION_KIND[s.kind],
  }));
  const all = [...list, ...extra];
  return [cmd.sectionCount(all.length), ...all.map((s, i) => cmd.section(i, s.bars, s.mask, s.kind))];
}

const sidechainIndex = (p: Project): number => {
  const i = p.tracks.findIndex((t) => t.id === p.sidechainTrack);
  return i < 0 ? NO_SIDECHAIN : i;
};

function masterCmds(m: Master): Cmd[] {
  return [
    cmd.master(MASTER.VOLUME_DB, m.vol),
    cmd.master(MASTER.GLUE, m.glue),
    cmd.master(MASTER.CEILING_DB, m.ceiling),
    cmd.master(MASTER.REVERB_SIZE, m.reverbSize),
    cmd.master(MASTER.DELAY_STEPS, m.delaySteps),
    cmd.master(MASTER.DELAY_FEEDBACK, m.delayFeedback),
    cmd.master(MASTER.AUTO_BUILD, m.autoBuild ? 1 : 0),
  ];
}

function diffMaster(a: Master, b: Master): Cmd[] {
  if (a === b) return [];
  const all = masterCmds(b);
  const before = masterCmds(a);
  return all.filter((c, k) => c[2] !== before[k][2]);
}

/** The whole project, for a freshly started engine or a newly opened file. */
export function projectCmds(p: Project): Cmd[] {
  const out: Cmd[] = [cmd.bpm(p.bpm), cmd.swing(p.swing), cmd.mode(p.mode === 'cancion' ? 1 : 0), cmd.master(MASTER.METRONOME, p.metronome ? 1 : 0)];
  out.push(...masterCmds(p.master));
  for (let i = 0; i < MAX_TRACKS; i++) {
    const t = p.tracks[i];
    out.push(...(t ? trackCmds(i, t) : [cmd.kind(i, KIND.NONE, 0)]));
  }
  out.push(...sectionCmds(p), cmd.sidechain(sidechainIndex(p)));
  return out;
}

const sameSections = (a: Project, b: Project): boolean =>
  a.sections === b.sections && (a.tracks === b.tracks || (a.tracks.length === b.tracks.length && a.tracks.every((t, i) => t.id === b.tracks[i].id)));

/** Only what changed between two versions of the same project. */
export function diffCmds(a: Project, b: Project): Cmd[] {
  if (a.id !== b.id) return projectCmds(b);
  const out: Cmd[] = [];
  if (a.bpm !== b.bpm) out.push(cmd.bpm(b.bpm));
  if (a.swing !== b.swing) out.push(cmd.swing(b.swing));
  if (a.mode !== b.mode) out.push(cmd.mode(b.mode === 'cancion' ? 1 : 0));
  if (a.metronome !== b.metronome) out.push(cmd.master(MASTER.METRONOME, b.metronome ? 1 : 0));
  out.push(...diffMaster(a.master, b.master));
  if (a.tracks !== b.tracks) {
    const n = Math.max(a.tracks.length, b.tracks.length);
    for (let i = 0; i < n; i++) {
      const ta = a.tracks[i];
      const tb = b.tracks[i];
      if (!tb) out.push(cmd.kind(i, KIND.NONE, 0));
      else if (!ta || ta.id !== tb.id) out.push(...trackCmds(i, tb));
      else out.push(...diffTrack(i, ta, tb));
    }
  }
  if (!sameSections(a, b)) out.push(...sectionCmds(b));
  if (sidechainIndex(a) !== sidechainIndex(b)) out.push(cmd.sidechain(sidechainIndex(b)));
  return out;
}
