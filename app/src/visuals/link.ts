// Link between the main window and the visuals window: opening it (also on a
// second screen) and sending what sounds, 60 times per second.
import { isTauri } from '../engine/bridge';
import { toast } from '../state/ui';
import type { SectionKind } from '../engine/protocol';

export interface VisualMeta {
  name: string;
  bpm: number;
  mode: 'patron' | 'cancion';
  sections: { name: string; kind: SectionKind; bars: number }[];
}

export type SceneId = 'caleidoscopio' | 'tunel' | 'plasma' | 'aurora' | 'oceano' | 'luciernagas' | 'ecualizador' | 'reticula';

export interface VisualSettings {
  scene: SceneId | 'auto';
  /** 0 = Relax, 1 = Psicodélico. */
  mood: number;
  brightness: number;
  blackout: boolean;
}

export type LinkMsg =
  | { t: 'live'; s: number[] }
  | { t: 'meta'; meta: VisualMeta }
  | { t: 'settings'; settings: VisualSettings }
  | { t: 'hello' }
  | { t: 'bye' };

const CHANNEL = 'house-visuales';
const EVENT = 'house-visuales';

let bc: BroadcastChannel | null = null;
const channel = (): BroadcastChannel | null => {
  if (!bc && typeof BroadcastChannel !== 'undefined') bc = new BroadcastChannel(CHANNEL);
  return bc;
};

export function post(msg: LinkMsg): void {
  if (isTauri()) {
    void import('@tauri-apps/api/event').then(({ emit }) => emit(EVENT, msg)).catch(() => undefined);
    return;
  }
  channel()?.postMessage(msg);
}

export function listen(cb: (m: LinkMsg) => void): () => void {
  if (isTauri()) {
    let off: (() => void) | null = null;
    let dead = false;
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<LinkMsg>(EVENT, (e) => cb(e.payload)).then((u) => {
        if (dead) u();
        else off = u;
      }),
    );
    return () => {
      dead = true;
      off?.();
    };
  }
  const c = channel();
  if (!c) return () => undefined;
  const h = (e: MessageEvent<LinkMsg>) => cb(e.data);
  c.addEventListener('message', h);
  return () => c.removeEventListener('message', h);
}

let popup: Window | null = null;

const visualsUrl = (): string => `${location.href.split('#')[0]}#visuales`;

interface ScreenDetailed {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
  label?: string;
}

/** Opens the visuals window; with `second`, on the other screen if there is one. */
export async function openVisuals(second = false): Promise<void> {
  if (isTauri()) return openTauri(second);
  let features = 'popup,width=1280,height=720';
  let placed = false;
  if (second) {
    const w = window as Window & { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> };
    try {
      const d = await w.getScreenDetails?.();
      const other = d?.screens.find((s) => s !== d.currentScreen);
      if (other) {
        features = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
        placed = true;
      }
    } catch {
      // Permission refused or not supported: open it here and explain.
    }
  }
  if (popup && !popup.closed) {
    popup.focus();
  } else {
    popup = window.open(visualsUrl(), 'house-visuales', features);
  }
  if (!popup) {
    toast('Tu navegador bloqueó la ventana. Permite ventanas emergentes para HOUSE y vuelve a intentar.', 'error', 6000);
    return;
  }
  if (second && !placed) toast('Arrastra la ventana a tu segunda pantalla y presiona F para pantalla completa.', 'info', 6000);
  else if (second) toast('Haz doble clic en los visuales para ponerlos en pantalla completa.', 'info', 5000);
}

async function openTauri(second: boolean): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const { availableMonitors, currentMonitor, PhysicalPosition } = await import('@tauri-apps/api/window');
  let win = await WebviewWindow.getByLabel('visuales');
  if (!win) {
    win = new WebviewWindow('visuales', { url: 'index.html#visuales', title: 'HOUSE · Visuales', width: 1280, height: 720 });
    await new Promise<void>((resolve) => {
      void win!.once('tauri://created', () => resolve());
      void win!.once('tauri://error', () => resolve());
    });
  }
  if (second) {
    const [all, here] = await Promise.all([availableMonitors(), currentMonitor()]);
    const other = all.find((m) => !here || m.name !== here.name || m.position.x !== here.position.x);
    if (other) {
      await win.setPosition(new PhysicalPosition(other.position.x + 40, other.position.y + 40));
      await win.setFullscreen(true);
    } else {
      toast('Solo encuentro una pantalla. Conecta la segunda y vuelve a intentar.', 'info', 5000);
    }
  }
  await win.setFocus();
}
