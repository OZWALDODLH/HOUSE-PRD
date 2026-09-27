#!/usr/bin/env bash
# Compiles the audio engine to WebAssembly and copies it into the app.
set -euo pipefail
cd "$(dirname "$0")/.."
rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true
cargo build -p house-engine --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/house_engine.wasm app/src/engine/house_engine.wasm
echo "Motor WebAssembly listo: app/src/engine/house_engine.wasm ($(wc -c < app/src/engine/house_engine.wasm) bytes)"
