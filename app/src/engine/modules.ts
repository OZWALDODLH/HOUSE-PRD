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
