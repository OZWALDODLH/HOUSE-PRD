// AudioWorklet that runs the HOUSE engine (Rust compiled to WebAssembly).
// Loaded from a Blob URL, so it must stay dependency-free plain JS.

const STATUS_EVERY = 5; // blocks between status messages (~13 ms at 48 kHz)

class HouseEngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.pending = [];
    this.blocks = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    if (msg.type === 'init') {
      try {
        const instance = new WebAssembly.Instance(new WebAssembly.Module(msg.bytes), {});
        this.ex = instance.exports;
        this.ex.he_init(sampleRate);
        this.cmdPtr = this.ex.he_cmd_ptr();
        this.statusLen = this.ex.he_status_len();
        this.views();
        this.ready = true;
        for (const c of this.pending) this.apply(c);
        this.pending = [];
        this.port.postMessage({ type: 'ready', sampleRate });
      } catch (err) {
        this.port.postMessage({ type: 'error', message: String(err) });
      }
      return;
    }
    if (msg.type === 'cmds') {
      if (!this.ready) {
        for (const c of msg.cmds) this.pending.push(c);
        return;
      }
      for (const c of msg.cmds) this.apply(c);
      return;
    }
    if (msg.type === 'sample' && this.ready) {
      const data = msg.data;
      const ptr = this.ex.he_sample_alloc(data.length);
      new Float32Array(this.ex.memory.buffer, ptr, data.length).set(data);
      this.ex.he_sample_commit(msg.slot, msg.sampleRate);
      this.views();
    }
  }

  views() {
    const mem = this.ex.memory.buffer;
    this.mem = mem;
    const max = this.ex.he_max_block();
    this.cmdView = new Float64Array(mem, this.cmdPtr, 64);
    this.outL = new Float32Array(mem, this.ex.he_out_ptr(0), max);
    this.outR = new Float32Array(mem, this.ex.he_out_ptr(1), max);
    this.status = new Float32Array(mem, this.ex.he_status_ptr(), this.statusLen);
  }

  apply(c) {
    if (this.ex.memory.buffer !== this.mem) this.views();
    const n = Math.min(c.length, 64);
    for (let i = 0; i < n; i++) this.cmdView[i] = c[i];
    this.ex.he_cmd(n);
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.ready || !out || out.length === 0) return true;
    const frames = out[0].length;
    this.ex.he_process(frames);
    if (this.ex.memory.buffer !== this.mem) this.views();
    out[0].set(this.outL.subarray(0, frames));
    if (out[1]) out[1].set(this.outR.subarray(0, frames));
    if (++this.blocks % STATUS_EVERY === 0) {
      this.port.postMessage({ type: 'status', status: this.status.slice() });
      this.ex.he_status_ack();
    }
    return true;
  }
}

registerProcessor('house-engine', HouseEngineProcessor);
