# PULMO-WAVE — Acoustic Vortex Spirometer & Vocal Biomarker Lab

Polyglot (5-language) pulmonary + vocal biomarker app: **Vue 3.5 + Rust/WASM + Go 1.22 + WGSL + Java 17**.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # zero-error Vercel build (TS mirror guarantees success without cargo)
```

## Modules
- **Vortex Spirometer** — live mic blow (AGC off) or 1-tap synthetic patients (athlete / bronchospasm / asthma / post-inhaler). Flow-Volume Loop + V(t), PEFR/FEV1/FVC/ratio, GREEN/YELLOW/RED zones.
- **Vocal Biomarker Lab** — "Ahhh" phonation or presets → f0, Jitter %, Shimmer dB, HNR dB, F1/F2, Poincaré plot.
- **Wheeze & Cough Classifier** — 100 Hz–3 kHz waterfall spectrogram, wheeze/rhonchi/cough triage, 4 simulators.
- **Rehab Pacer** — incentive orb game, pursed-lip 2:4, box 4-4-4-4, altitude CO2 builder (haptics + drones).
- **Polyglot Inspector & Vault** — live source viewer, Go endpoint tester, IndexedDB sync queue, CSV export.

## Polyglot sources
| Language | File |
|---|---|
| Rust/WASM | `rust-dsp-kernel/src/lib.rs` (+ `src/wasm/pulmoWasmBridge.ts` mirror) |
| Go 1.22 | `api/pulmo_triage.go` (Vercel serverless) |
| WGSL | `src/shaders/airflow_turbulence.wgsl` (Canvas2D fallback) |
| Java 17 | `android/app/src/main/java/com/pulmowave/bio/AudioSpirometryPlugin.java` |
| Vue 3.5 TS | `src/**/*.vue`, `src/composables/useSpringPhysics.ts` |

## APK
`capacitor.config.ts` (`com.pulmowave.bio`) + `.github/workflows/build-and-bundle-apk.yml`
builds the APK and bundles it to `public/releases/pulmowave-release.apk`.
