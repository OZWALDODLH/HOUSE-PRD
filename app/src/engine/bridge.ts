import type { Cmd } from './protocol';

export interface OutputDevice {
  id: string;
  name: string;
  /** Rough guess from the name: Bluetooth adds 100–300 ms of delay. */
  bluetooth: boolean;
}

export interface OutputRouting {
  master: string | null;
  cue: string | null;
  /** Extra delay (ms) applied to the faster device so both line up. */
  alignMs: number;
}

/** What the interface needs from an audio engine host (browser or desktop). */
export interface EngineBridge {
  readonly kind: 'web' | 'native';
  start(): Promise<void>;
  resume(): Promise<void>;
  send(cmds: Cmd[]): void;
  loadSample(slot: number, data: Float32Array, sampleRate: number): void;
  onStatus(cb: (s: Float32Array) => void): () => void;
  latencyMs(): number;
  sampleRate(): number;
  listOutputs(): Promise<OutputDevice[]>;
  setRouting(r: OutputRouting): Promise<string | null>;
  supportsSecondOutput(): boolean;
}

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const looksBluetooth = (name: string): boolean => /bluetooth|airpods|buds|bt\b|jbl|bose|beats|wh-|wf-|soundcore|headset/i.test(name);

let current: EngineBridge | null = null;
let creating: Promise<EngineBridge> | null = null;

/** Returns the engine host, creating it on first use (must follow a user gesture in browsers). */
export function getBridge(): Promise<EngineBridge> {
  if (current) return Promise.resolve(current);
  if (!creating) {
    creating = (async () => {
      let b: EngineBridge;
      if (isTauri()) {
        const { NativeBridge } = await import('./native');
        b = new NativeBridge();
      } else {
        const { WebBridge } = await import('./web');
        b = new WebBridge();
      }
      await b.start();
      current = b;
      return b;
    })();
    creating.catch(() => {
      creating = null;
    });
  }
  return creating;
}

export function bridgeIfReady(): EngineBridge | null {
  return current;
}
