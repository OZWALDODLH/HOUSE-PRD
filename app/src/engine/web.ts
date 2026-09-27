// Browser host: runs the Rust engine (WebAssembly) inside an AudioWorklet.
import workletSource from './worklet.js?raw';
import wasmUrl from './house_engine.wasm?url';
import type { Cmd } from './protocol';
import { looksBluetooth, type EngineBridge, type OutputDevice, type OutputRouting } from './bridge';

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };

export class WebBridge implements EngineBridge {
  readonly kind = 'web' as const;
  private ctx: SinkContext | null = null;
  private node: AudioWorkletNode | null = null;
  private listeners = new Set<(s: Float32Array) => void>();
  private queue: Cmd[] = [];

  async start(): Promise<void> {
    const ctx: SinkContext = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    // Resume right away, while the click or key press still counts: the
    // worklet only answers once the audio thread runs.
    void ctx.resume().catch(() => undefined);
    const url = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const bytes = await (await fetch(wasmUrl)).arrayBuffer();
    const node = new AudioWorkletNode(ctx, 'house-engine', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node = node;
    const ready = new Promise<void>((resolve, reject) => {
      node.port.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'status') {
          for (const cb of this.listeners) cb(m.status as Float32Array);
        } else if (m.type === 'ready') {
          resolve();
        } else if (m.type === 'error') {
          reject(new Error(m.message));
        }
      };
    });
    // Bytes, not a compiled module: Chromium drops modules sent to worklets.
    node.port.postMessage({ type: 'init', bytes });
    node.connect(ctx.destination);
    await ready;
    if (this.queue.length) {
      node.port.postMessage({ type: 'cmds', cmds: this.queue });
      this.queue = [];
    }
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume();
  }

  send(cmds: Cmd[]): void {
    if (!cmds.length) return;
    if (!this.node) {
      this.queue.push(...cmds);
      return;
    }
    this.node.port.postMessage({ type: 'cmds', cmds });
  }

  loadSample(slot: number, data: Float32Array, sampleRate: number): void {
    this.node?.port.postMessage({ type: 'sample', slot, data, sampleRate });
  }

  onStatus(cb: (s: Float32Array) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  latencyMs(): number {
    const c = this.ctx;
    if (!c) return 0;
    return ((c.baseLatency || 0) + ((c as AudioContext & { outputLatency?: number }).outputLatency || 0)) * 1000;
  }

  sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  async listOutputs(): Promise<OutputDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === 'audiooutput')
      .map((d, i) => ({ id: d.deviceId, name: d.label || `Salida ${i + 1}`, bluetooth: looksBluetooth(d.label) }));
  }

  /** The browser can move the whole mix to one device; a second device needs the desktop app. */
  async setRouting(r: OutputRouting): Promise<string | null> {
    if (!this.ctx) return 'El audio todavía no arranca.';
    if (r.master && this.ctx.setSinkId) {
      try {
        await this.ctx.setSinkId(r.master === 'default' ? '' : r.master);
      } catch {
        return 'Este navegador no deja elegir la salida. Usa la app de escritorio o cambia la salida en tu sistema.';
      }
    } else if (r.master && !this.ctx.setSinkId) {
      return 'Este navegador no deja elegir la salida. Usa la app de escritorio o cambia la salida en tu sistema.';
    }
    if (r.cue) return 'Mandar la pre-escucha a otro aparato necesita la app de escritorio.';
    return null;
  }

  supportsSecondOutput(): boolean {
    return false;
  }
}
