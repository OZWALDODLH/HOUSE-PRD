// Loads inline scripts (the worklet, the recorder, the export worker).
// Blob URLs first; data: URLs as a fallback for pages without a real origin
// (a file opened from disk, a sandboxed frame), where blob modules fail.

export async function addWorkletModule(ctx: BaseAudioContext, source: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await ctx.audioWorklet.addModule(url);
    return;
  } catch {
    // Fall through to the data: URL.
  } finally {
    URL.revokeObjectURL(url);
  }
  await ctx.audioWorklet.addModule(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

export function makeWorker(source: string): Worker {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    return new Worker(url);
  } catch {
    return new Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Bytes of a bundled file. Inline data: URLs are decoded here, without fetch. */
export async function loadBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma);
    const body = url.slice(comma + 1);
    if (meta.endsWith(';base64')) {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(body)).buffer as ArrayBuffer;
  }
  return (await fetch(url)).arrayBuffer();
}

/** Inside another page (an embedded preview), downloads can be blocked. */
export const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};
