// Microphone: list inputs, show the level and record a take (raw, no codec).

const RECORDER = `
class HouseRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.buf = new Float32Array(4096);
    this.n = 0;
    this.peak = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.n = 0; }
      if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ type: 'end' }); }
    };
  }
  flush() {
    this.port.postMessage({ type: 'data', data: this.on ? this.buf.slice(0, this.n) : null, peak: this.peak });
    this.n = 0;
    this.peak = 0;
  }
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length) {
      const len = ch[0].length;
      for (let i = 0; i < len; i++) {
        let x = 0;
        for (let c = 0; c < ch.length; c++) x += ch[c][i];
        x /= ch.length;
        const a = x < 0 ? -x : x;
        if (a > this.peak) this.peak = a;
        this.buf[this.n++] = x;
        if (this.n === this.buf.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('house-recorder', HouseRecorder);
`;

export interface Input {
  id: string;
  name: string;
}

export async function listInputs(): Promise<Input[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'audioinput').map((d, i) => ({ id: d.deviceId, name: d.label || `Micrófono ${i + 1}` }));
}

/** Spanish message for a getUserMedia error. */
export function micError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'HOUSE no tiene permiso para usar el micrófono. Dale permiso en tu navegador o en los ajustes del sistema y vuelve a intentar.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No encuentro tu micrófono. Conéctalo o elige otro en la lista.';
  if (name === 'NotReadableError') return 'Otra app está usando el micrófono. Ciérrala y vuelve a intentar.';
  return 'No pude abrir el micrófono. Revisa que esté conectado y vuelve a intentar.';
}

export class Mic {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private ending: (() => void) | null = null;
  level = 0;
  recording = false;

  async open(deviceId: string | null): Promise<void> {
    this.close();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const url = URL.createObjectURL(new Blob([RECORDER], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(this.stream);
    // Some browsers only run nodes that reach the speakers: connect through silence.
    const node = new AudioWorkletNode(ctx, 'house-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute).connect(ctx.destination);
    node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'data') {
        this.level = Math.max(m.peak, this.level * 0.6);
        if (m.data && this.recording) this.chunks.push(m.data);
      } else if (m.type === 'end') {
        this.ending?.();
        this.ending = null;
      }
    };
    src.connect(node);
    this.node = node;
    if (ctx.state !== 'running') await ctx.resume();
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  start(): void {
    this.chunks = [];
    this.recording = true;
    this.node?.port.postMessage('start');
  }

  async stop(): Promise<Float32Array> {
    if (!this.node) return new Float32Array(0);
    await new Promise<void>((resolve) => {
      this.ending = resolve;
      this.node!.port.postMessage('stop');
      setTimeout(resolve, 500);
    });
    this.recording = false;
    const len = this.chunks.reduce((a, c) => a + c.length, 0);
    const out = new Float32Array(len);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    this.chunks = [];
    return out;
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.node?.disconnect();
    this.node = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.recording = false;
  }
}
