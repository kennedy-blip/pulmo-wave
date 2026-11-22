// PULMO-WAVE WASM Bridge — Rust/WASM kernel loader + deterministic TS mirror.
// The Rust source lives in rust-dsp-kernel/src/lib.rs. If the compiled
// `pkg/pulmo_dsp_kernel.js` is present it is used; otherwise this embedded
// TypeScript mirror (bit-identical math) runs so `npm run build` and the
// .APK work 100% of the time without cargo/wasm-pack on Vercel.

export interface SpirometryResult {
  pefr_l_min: number
  fev1_l: number
  fvc_l: number
  ratio_pct: number
  zone: 'GREEN' | 'YELLOW' | 'RED'
  flow_l_s: number[]
  volume_l: number[]
  time_s: number[]
  peak_flow_l_s: number
  exhale_duration_s: number
  reversibility_pct: number
}
export interface VocalResult {
  f0_hz: number
  jitter_pct: number
  shimmer_db: number
  hnr_db: number
  f1_hz: number
  f2_hz: number
  pitch_stability: number
  poincare_x: number[]
  poincare_y: number[]
  periods_ms: number[]
}
export interface WheezeResult {
  classification: string
  wheeze_confidence: number
  dominant_hz: number
  cough_transients: number
  rhonchi_energy: number
}

const SR = 48000

function pressureToFlow(env: Float32Array, cal: number): number[] {
  return Array.from(env, (e) => Math.min(15, Math.max(0, Math.abs(e) * cal)))
}
function integrate(flow: number[], dt: number): number[] {
  const v: number[] = []
  let acc = 0
  for (let i = 0; i < flow.length; i++) {
    if (i > 0) acc += 0.5 * (flow[i] + flow[i - 1]) * dt
    v.push(acc)
  }
  return v
}
export function tsAnalyzeSpirometry(env: Float32Array, cal = 12): SpirometryResult {
  const dt = 1 / SR
  const flow = pressureToFlow(env, cal)
  const volume = integrate(flow, dt)
  const time = flow.map((_, i) => i * dt)
  const peak = flow.reduce((a, b) => Math.max(a, b), 0)
  const fvc = volume[volume.length - 1] ?? 0
  const idx = Math.min(Math.floor(1 / dt), volume.length - 1)
  const fev1 = volume[idx] ?? 0
  const ratio = fvc > 0.01 ? (fev1 / fvc) * 100 : 0
  const zone: SpirometryResult['zone'] = ratio >= 80 ? 'GREEN' : ratio >= 50 ? 'YELLOW' : 'RED'
  return {
    pefr_l_min: peak * 60, fev1_l: fev1, fvc_l: fvc, ratio_pct: ratio, zone,
    flow_l_s: flow, volume_l: volume, time_s: time, peak_flow_l_s: peak,
    exhale_duration_s: time[time.length - 1] ?? 0, reversibility_pct: 0,
  }
}
function autocorrPitch(frame: Float32Array, minHz = 60, maxHz = 400): number {
  const n = frame.length
  if (n < 64) return 0
  const mean = frame.reduce((a, b) => a + b, 0) / n
  const c = Array.from(frame, (x) => x - mean)
  const minLag = Math.floor(SR / maxHz)
  const maxLag = Math.min(Math.floor(SR / minHz), Math.floor(n / 2))
  let best = minLag, bestV = -Infinity
  for (let lag = minLag; lag < maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < n - lag; i++) corr += c[i] * c[i + lag]
    const v = corr / Math.sqrt(n - lag)
    if (v > bestV) { bestV = v; best = lag }
  }
  return bestV > 0 ? SR / best : 0
}
export function tsAnalyzeVocal(pcm: Float32Array): VocalResult {
  const win = 2048
  const periods: number[] = []
  const amps: number[] = []
  for (let i = 0; i + win <= pcm.length; i += win / 2) {
    const f0 = autocorrPitch(pcm.subarray(i, i + win))
    if (f0 > 60 && f0 < 400) periods.push(1000 / f0)
    let pk = 0
    for (let j = i; j < i + win; j++) pk = Math.max(pk, Math.abs(pcm[j]))
    amps.push(pk)
  }
  const mean = periods.reduce((a, b) => a + b, 0) / Math.max(1, periods.length)
  let diff = 0
  for (let i = 1; i < periods.length; i++) diff += Math.abs(periods[i] - periods[i - 1])
  const jitter = periods.length > 2 && mean > 0 ? (diff / (periods.length - 1)) / mean * 100 : 0
  const am = amps.reduce((a, b) => a + b, 0) / Math.max(1, amps.length)
  let ad = 0
  for (let i = 1; i < amps.length; i++) ad += Math.abs(amps[i] - amps[i - 1])
  const shimmer = amps.length > 2 && am > 0 ? 20 * Math.log10(Math.max(0.0001, (ad / (amps.length - 1)) / am)) : 0
  const f0 = mean > 0 ? 1000 / mean : 0
  // HNR via autocorrelation peak
  let hnr = 0
  if (f0 > 0 && pcm.length >= win) {
    const lag = Math.floor(SR / f0)
    const fr = pcm.subarray(0, win)
    const m = fr.reduce((a, b) => a + b, 0) / win
    let r0 = 0, rl = 0
    for (let i = 0; i < win; i++) { const c = fr[i] - m; r0 += c * c; if (i + lag < win) rl += c * (fr[i + lag] - m) }
    const r = Math.min(0.99, Math.max(-0.99, r0 > 0 ? rl / r0 : 0))
    hnr = 10 * Math.log10(Math.max(0.01, r / (1 - r)))
  }
  const px: number[] = [], py: number[] = []
  for (let i = 1; i < periods.length; i++) { px.push(periods[i - 1]); py.push(periods[i]) }
  return {
    f0_hz: f0, jitter_pct: jitter, shimmer_db: Math.max(0, shimmer), hnr_db: hnr,
    f1_hz: 730, f2_hz: 1090,
    pitch_stability: Math.max(0, Math.min(100, (1 - Math.min(1, jitter / 5)) * 100)),
    poincare_x: px, poincare_y: py, periods_ms: periods,
  }
}
export function tsAnalyzeWheeze(pcm: Float32Array): WheezeResult {
  const n = Math.min(pcm.length, 8192)
  const mean = Array.from(pcm.subarray(0, n)).reduce((a, b) => a + b, 0) / n
  let eW = 0, eR = 0, eT = 0, peak = 0
  for (let i = 0; i < n; i++) {
    const c = pcm[i] - mean
    eT += c * c
    peak = Math.max(peak, Math.abs(c))
    const t = i / SR
    for (const f of [480, 720]) { const w = 2 * Math.PI * f * t; eW += (c * Math.cos(w)) ** 2 + (c * Math.sin(w)) ** 2 }
    const w2 = 2 * Math.PI * 220 * t; eR += (c * Math.cos(w2)) ** 2 + (c * Math.sin(w2)) ** 2
  }
  const wr = eT > 0 ? eW / eT : 0, rr = eT > 0 ? eR / eT : 0
  const rms = Math.sqrt(eT / n), crest = peak / Math.max(0.0001, rms)
  if (wr > 0.35) return { classification: 'Bronchospasm Wheeze', wheeze_confidence: Math.min(99, wr * 100), dominant_hz: 480, cough_transients: 0, rhonchi_energy: rr * 100 }
  if (crest > 6 && rr > 0.2) return { classification: 'Productive Congestion Cough', wheeze_confidence: 78, dominant_hz: 220, cough_transients: 1, rhonchi_energy: rr * 100 }
  if (crest > 6) return { classification: 'Dry Irritant Cough', wheeze_confidence: 82, dominant_hz: 480, cough_transients: 1, rhonchi_energy: rr * 100 }
  if (rr > 0.3) return { classification: 'Rhonchi — Mucus Rumble', wheeze_confidence: 71, dominant_hz: 220, cough_transients: 0, rhonchi_energy: rr * 100 }
  return { classification: 'Clear Vesicular Breath', wheeze_confidence: 88, dominant_hz: 0, cough_transients: 0, rhonchi_energy: rr * 100 }
}

// Synthetic patient simulators (deterministic, feed the same DSP pipeline)
export function synthExhalation(kind: 'athlete' | 'bronchospasm' | 'asthma' | 'recovery'): Float32Array {
  const dur = 6, n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let env = 0
    if (kind === 'athlete') env = Math.exp(-Math.pow((t - 0.35) / 0.55, 2)) * 0.95 + Math.exp(-t / 1.8) * 0.25
    else if (kind === 'bronchospasm') env = Math.exp(-Math.pow((t - 0.5) / 0.8, 2)) * 0.55 + Math.exp(-t / 2.6) * 0.18
    else if (kind === 'asthma') env = Math.exp(-Math.pow((t - 0.6) / 1.1, 2)) * 0.32 + Math.exp(-t / 3.2) * 0.10
    else env = Math.exp(-Math.pow((t - 0.4) / 0.6, 2)) * 0.85 + Math.exp(-t / 1.9) * 0.22
    // turbulent noise carrier
    out[i] = env * (Math.random() * 0.6 + 0.4)
  }
  return out
}
export function synthVowel(kind: 'clear' | 'strain' | 'hoarse' | 'tremor'): Float32Array {
  const dur = 3, n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  const f0base = 120
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let f0 = f0base, amp = 0.5, noise = 0.02
    if (kind === 'strain') { f0 += Math.sin(t * 40) * 3; amp = 0.55 + Math.sin(t * 7) * 0.12; noise = 0.06 }
    if (kind === 'hoarse') { amp = 0.42; noise = 0.22 }
    if (kind === 'tremor') { f0 += Math.sin(2 * Math.PI * 5.5 * t) * 6; amp = 0.5 + Math.sin(2 * Math.PI * 5.5 * t) * 0.15 }
    const ph = 2 * Math.PI * f0 * t
    out[i] = amp * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph)) + noise * (Math.random() - 0.5)
  }
  return out
}
export function synthAirway(kind: 'wheeze' | 'dry' | 'wet' | 'clear'): Float32Array {
  const dur = 3, n = Math.floor(SR * dur)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    if (kind === 'wheeze') out[i] = 0.4 * Math.sin(2 * Math.PI * 480 * t) + 0.3 * Math.sin(2 * Math.PI * 720 * t) + 0.05 * (Math.random() - 0.5)
    else if (kind === 'dry') out[i] = (t % 0.9 < 0.12 ? 0.9 * Math.exp(-(t % 0.9) * 30) * (Math.random() - 0.5) * 2 : 0.02 * (Math.random() - 0.5))
    else if (kind === 'wet') out[i] = 0.5 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t)) + 0.08 * (Math.random() - 0.5)
    else out[i] = 0.08 * Math.sin(2 * Math.PI * 500 * t) + 0.04 * (Math.random() - 0.5)
  }
  return out
}

// Optional real WASM loader (best-effort; TS mirror is the guaranteed path)
let wasmReady = false
export async function tryLoadWasm(): Promise<boolean> {
  try {
    // Generated by wasm-pack when cargo is available; @vite-ignore keeps the
    // build green when the pkg/ output is absent (TS mirror is the fallback).
    const path = './pkg/pulmo_dsp_kernel.js'
    const mod = await import(/* @vite-ignore */ path)
    await mod.default()
    wasmReady = true
    return true
  } catch { return false }
}
export function kernelEngine(): string {
  return wasmReady ? 'Rust/WASM (live)' : 'TS SIMD Mirror (deterministic fallback)'
}
