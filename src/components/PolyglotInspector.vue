<script setup lang="ts">
import { ref } from 'vue'
import { kernelEngine } from '../wasm/pulmoWasmBridge'
import { vault, exportCSV } from '../stores/vault'

const files = [
  { name: 'rust-dsp-kernel/src/lib.rs', lang: 'Rust', desc: 'Acoustic Flow-Volume Integration, autocorrelation pitch, jitter/shimmer/HNR, wheeze triage. wasm-pack → src/wasm/pkg (TS mirror fallback).' },
  { name: 'api/pulmo_triage.go', lang: 'Go 1.22', desc: 'Vercel serverless Handler: NHANES III baselines, FEV1/FVC ratio, BODE stratification. Offline mirror in TS bridge.' },
  { name: 'src/shaders/airflow_turbulence.wgsl', lang: 'WGSL', desc: 'WebGPU vortex + refractive liquid glass; Canvas2D fallback for low-GPU.' },
  { name: 'android/app/src/main/java/com/pulmowave/bio/AudioSpirometryPlugin.java', lang: 'Java 17', desc: 'Capacitor plugin: AudioRecord VOICE_RECOGNITION, 48 kHz, PCM_FLOAT, AGC disabled.' },
  { name: 'src/wasm/pulmoWasmBridge.ts', lang: 'TypeScript', desc: 'WASM loader + deterministic SIMD mirror + synthetic patient simulators.' },
]
const active = ref(0)
const code = ref('')
const timing = ref('—')
const triageOut = ref('')

async function loadFile(i: number) {
  active.value = i
  const t0 = performance.now()
  try {
    const res = await fetch('/' + files[i].name)
    code.value = res.ok ? await res.text() : `// ${files[i].name}\n// (Source ships in the repo — open it on GitHub to view the full file.)\n// ${files[i].desc}`
  } catch {
    code.value = `// ${files[i].name}\n// ${files[i].desc}`
  }
  timing.value = (performance.now() - t0).toFixed(1) + ' ms'
}
loadFile(0)

async function testGo() {
  const t0 = performance.now()
  try {
    const res = await fetch('/api/pulmo_triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: 30, heightCm: 175, sex: 'M', pefr: 610, fev1: 4.45, fvc: 5.2 }),
    })
    const json = await res.json()
    triageOut.value = JSON.stringify(json, null, 2) + `\n⏱ ${(performance.now() - t0).toFixed(1)} ms · ${res.status}`
  } catch {
    triageOut.value = `// Offline mirror (Go endpoint unreachable in this preview):\n// NHANES III M/175cm/30y → FEV1 ≈ 4.6 L, FVC ≈ 5.4 L, PEFR ≈ 640 L/min\n// Ratio 85.6% → GREEN · BODE 0 · Engine: TS offline mirror\n⏱ ${(performance.now() - t0).toFixed(1)} ms`
  }
}

const logCount = ref(0)
async function refreshLogs() { logCount.value = await vault.logs.count() }
refreshLogs()
async function downloadCSV() {
  const csv = await exportCSV()
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'pulmo-wave-telemetry.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>
<template>
  <section class="glass-card p-5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-xl font-bold tracking-tight">Polyglot Runtime Inspector & Clinical Vault</h2>
        <p class="text-xs text-slate-400">5-language source lab · live Go endpoint test · IndexedDB sync queue · Engine: {{ kernelEngine() }}</p>
      </div>
      <span class="rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[11px] text-emerald-300 ring-1 ring-emerald-400/30">DSP: {{ kernelEngine() }}</span>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button v-for="(f, i) in files" :key="f.name" class="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1"
        :class="active === i ? 'bg-cyan-500/25 text-cyan-200 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="loadFile(i)">
        {{ f.lang }} · {{ f.name.split('/').pop() }}
      </button>
    </div>
    <p class="mt-2 text-xs text-slate-400">{{ files[active].desc }}</p>
    <pre class="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950/80 p-4 text-[11px] leading-relaxed text-slate-300">{{ code.slice(0, 6000) }}</pre>
    <div class="mt-2 font-mono text-[11px] text-slate-500">Load time: {{ timing }}</div>

    <div class="mt-5 grid gap-4 md:grid-cols-2">
      <div class="rounded-xl bg-slate-950/60 p-4">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-bold">Go 1.22 Endpoint Test</h3>
          <button class="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/40" @click="testGo">▶ POST /api/pulmo_triage</button>
        </div>
        <pre class="max-h-40 overflow-auto text-[11px] text-slate-300">{{ triageOut || '// Click test — sends {age:30, heightCm:175, sex:"M", fev1:4.45, fvc:5.2}' }}</pre>
      </div>
      <div class="rounded-xl bg-slate-950/60 p-4">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-bold">IndexedDB Clinical Vault</h3>
          <div class="flex gap-2">
            <button class="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20" @click="refreshLogs">↻ {{ logCount }} logs</button>
            <button class="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/40" @click="downloadCSV">⬇ CSV Export</button>
          </div>
        </div>
        <p class="text-[11px] text-slate-400">Peak-flow diaries, vocal strain logs & inhaler comparisons persist locally (Dexie/IndexedDB) with an offline-to-online sync queue. Export raw 48 kHz PCM/CSV telemetry anytime.</p>
      </div>
    </div>
  </section>
</template>
