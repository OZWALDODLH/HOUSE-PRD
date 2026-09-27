// Desktop host: the same engine compiled natively, driven by cpal in Rust.
import { Channel, invoke } from '@tauri-apps/api/core';
import type { Cmd } from './protocol';
import type { EngineBridge, OutputDevice, OutputRouting } from './bridge';

interface StartInfo {
  sampleRate: number;
  latencyMs: number;
}

export class NativeBridge implements EngineBridge {
  readonly kind = 'native' as const;
  private listeners = new Set<(s: Float32Array) => void>();
  private sr = 48000;
  private latency = 0;

  async start(): Promise<void> {
    const channel = new Channel<number[]>();
    channel.onmessage = (s) => {
      const f = Float32Array.from(s);
      for (const cb of this.listeners) cb(f);
    };
    const info = await invoke<StartInfo>('engine_start', { onStatus: channel });
    this.sr = info.sampleRate;
    this.latency = info.latencyMs;
  }

  async resume(): Promise<void> {}

  send(cmds: Cmd[]): void {
    if (cmds.length) invoke('engine_cmds', { cmds }).catch((e) => console.error('engine_cmds', e));
  }

  loadSample(slot: number, data: Float32Array, sampleRate: number): void {
    const bytes = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    invoke('engine_load_sample', bytes, { headers: { slot: String(slot), 'sample-rate': String(sampleRate) } }).catch((e) =>
      console.error('engine_load_sample', e),
    );
  }

  onStatus(cb: (s: Float32Array) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  latencyMs(): number {
    return this.latency;
  }

  sampleRate(): number {
    return this.sr;
  }

  listOutputs(): Promise<OutputDevice[]> {
    return invoke<OutputDevice[]>('audio_outputs');
  }

  async setRouting(r: OutputRouting): Promise<string | null> {
    try {
      const info = await invoke<StartInfo>('audio_set_routing', { routing: r });
      this.latency = info.latencyMs;
      return null;
    } catch (e) {
      return String(e);
    }
  }

  supportsSecondOutput(): boolean {
    return true;
  }
}
