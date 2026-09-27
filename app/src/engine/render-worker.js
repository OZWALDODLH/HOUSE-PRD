// Offline render with the same WebAssembly engine the app plays with.
// Loaded from a Blob URL, so it stays plain JS without imports.

self.onmessage = (e) => {
  const m = e.data;
  try {
    const ex = new WebAssembly.Instance(new WebAssembly.Module(m.bytes), {}).exports;
    ex.he_init(m.sampleRate);
    const cmdPtr = ex.he_cmd_ptr();
    const apply = (c) => {
      const view = new Float64Array(ex.memory.buffer, cmdPtr, 64);
      const n = Math.min(64, c.length);
      for (let i = 0; i < n; i++) view[i] = c[i];
      ex.he_cmd(n);
    };
    for (const s of m.samples) {
      const ptr = ex.he_sample_alloc(s.data.length);
      new Float32Array(ex.memory.buffer, ptr, s.data.length).set(s.data);
      ex.he_sample_commit(s.slot, s.sr);
    }
    for (const c of m.cmds) apply(c);
    const total = m.frames;
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const max = ex.he_max_block();
    let pos = 0;
    let reported = 0;
    while (pos < total) {
      const n = Math.min(max, total - pos);
      ex.he_process(n);
      const mem = ex.memory.buffer;
      left.set(new Float32Array(mem, ex.he_out_ptr(0), n), pos);
      right.set(new Float32Array(mem, ex.he_out_ptr(1), n), pos);
      ex.he_status_ack();
      pos += n;
      if (pos - reported >= m.sampleRate) {
        reported = pos;
        self.postMessage({ type: 'progress', value: pos / total });
      }
    }
    self.postMessage({ type: 'done', left, right }, [left.buffer, right.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
