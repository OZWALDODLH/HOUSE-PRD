// Physical key positions (KeyboardEvent.code), so every layout works the same:
// Latin American, Spain or US. The screen shows what is printed on yours.

export const BANK_A = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'];
export const BANK_B = ['Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'KeyM', 'Comma', 'Period', 'Slash'];

/** Piano: A S D F G H J K L Ñ are white keys, W E T Y U O P the black ones. */
export const PIANO: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};

/** Escala: each row is one octave of the scale, the lowest row at the bottom. */
export const SCALE_ROWS = [
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
];

export const SCALE_DEGREE: Record<string, number> = Object.fromEntries(SCALE_ROWS.flatMap((row, r) => row.map((code, k) => [code, r * 7 + k])));

// Latin American layout as the default drawing until the browser tells us.
const FALLBACK: Record<string, string> = { Semicolon: 'Ñ', Comma: ',', Period: '.', Slash: '-', Quote: '{', BracketLeft: '´', Minus: "'", Equal: '¿' };

let layout: Map<string, string> | null = null;
const listeners = new Set<() => void>();

/** Asks Chromium-based browsers for the real layout (not available everywhere). */
export async function loadLayout(): Promise<void> {
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  if (!kb?.getLayoutMap) return;
  try {
    layout = await kb.getLayoutMap();
    for (const f of listeners) f();
  } catch {
    // Keep the fallback drawing.
  }
}

export const onLayout = (f: () => void): (() => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

export function keyLabel(code: string): string {
  const fromLayout = layout?.get(code);
  if (fromLayout) return fromLayout.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return FALLBACK[code] ?? code;
}

/** Soundboard: every letter and number key, top row first. */
export const SOUNDBOARD_ROWS = [...SCALE_ROWS].reverse();
export const SOUNDBOARD_CODES = new Set(SCALE_ROWS.flat());
