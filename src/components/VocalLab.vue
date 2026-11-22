<script setup lang="ts">
import { ref } from 'vue'
import PoincarePlot from './PoincarePlot.vue'
import { tsAnalyzeVocal, synthVowel, type VocalResult } from '../wasm/pulmoWasmBridge'
import { saveLog } from '../stores/vault'

const emit = defineEmits<{ (e: 'open-report', payload: unknown): void }>()
const result = ref<VocalResult | null>(null)
const status = ref('Sustain "Ahhh" for 3 s or pick a preset')

function apply(r: VocalResult, label: string) {
  result.value = r
  status.value = `${label} — f0 ${r.f0_hz.toFixed(1)} Hz · Jitter ${r.jitter_pct.toFixed(2)}% · Shimmer ${r.shimmer_db.toFixed(2)} dB · HNR ${r.hnr_db.toFixed(1)} dB`
  saveLog('vocal', status.value, { f0: r.f0_hz, jitter: r.jitter_pct, shimmer: r.shimmer_db, hnr: r.hnr_db })
}
function preset(kind: 'clear' | 'strain' | 'hoarse' | 'tremor') {
  const labels = { clear: 'Clear Hydrated Voice', strain: 'Vocal Fold Strain / Teacher Burnout', hoarse: 'Morning Dehydration / Hoarseness', tremor: 'Sub-Clinical Vocal Tremor 5.5 Hz' }
  apply(tsAnalyzeVocal(synthVowel(kind)), labels[kind])
}

let audioCtx: AudioContext | null = null
let stream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let capturing = false
let raf = 0
const liveBuf = ref<Float32Array>(new Float32Array(0))

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any })
    audioCtx = new AudioContext({ sampleRate: 48000 })
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(analyser)
    capturing = true
    status.value = 'MIC LIVE — sustain "Ahhh"…'
    const buf = new Float32Array(analyser.fftSize)
    const collect: number[] = []
    const tick = () => {
      if (!capturing || !analyser) return
      analyser.getFloatTimeDomainData(buf)
      buf.forEach((v) => collect.push(v))
      liveBuf.value = new Float32Array(collect.slice(-48000 * 3))
      raf = requestAnimationFrame(tick)
    }
    tick()
  } catch (e: any) { status.value = 'Mic blocked: ' + e.message }
}
function stopMic() {
  capturing = false
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (liveBuf.value.length > 2000) apply(tsAnalyzeVocal(liveBuf.value), 'Live phonation')
  else status.value = 'Too short — sustain 3 s or use a preset.'
}
function openReport() {
  if (!result.value) return
  const r = result.value
  emit('open-report', {
    title: 'Vocal Biomarker Report',
    kind: 'vocal',
    metrics: [
      ['Fundamental f0', r.f0_hz.toFixed(1) + ' Hz'],
      ['Local Jitter', r.jitter_pct.toFixed(2) + ' % (healthy < 1.04%)'],
      ['Local Shimmer', r.shimmer_db.toFixed(2) + ' dB (healthy < 0.35 dB)'],
      ['HNR', r.hnr_db.toFixed(1) + ' dB (healthy > 20 dB)'],
      ['Formants', `F1 ${r.f1_hz} Hz · F2 ${r.f2_hz} Hz`],
      ['Pitch Stability', r.pitch_stability.toFixed(0) + ' %'],
    ],
    note: status.value,
  })
}
</script>
<template>
  <section class="glass-card p-5">
    <h2 class="text-xl font-bold tracking-tight">Vocal Biomarker Lab</h2>
    <p class="mb-3 text-xs text-slate-400">Glottal Jitter · Shimmer · HNR · Formants F1/F2 · Poincaré attractor</p>
    <PoincarePlot :x="result?.poincare_x ?? []" :y="result?.poincare_y ?? []" />
    <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      <div class="rounded-xl bg-slate-950/60 p-3 text-center">
        <div class="text-lg font-bold text-cyan-300">{{ result ? result.f0_hz.toFixed(1) : '—' }}</div>
        <div class="text-[10px] text-slate-400">f0 Hz</div>
      </div>
      <div class="rounded-xl bg-slate-950/60 p-3 text-center">
        <div class="text-lg font-bold" :class="result && result.jitter_pct > 1.04 ? 'text-red-300' : 'text-emerald-300'">{{ result ? result.jitter_pct.toFixed(2) + '%' : '—' }}</div>
        <div class="text-[10px] text-slate-400">Jitter (&lt;1.04%)</div>
      </div>
      <div class="rounded-xl bg-slate-950/60 p-3 text-center">
        <div class="text-lg font-bold" :class="result && result.shimmer_db > 0.35 ? 'text-red-300' : 'text-emerald-300'">{{ result ? result.shimmer_db.toFixed(2) + ' dB' : '—' }}</div>
        <div class="text-[10px] text-slate-400">Shimmer (&lt;0.35)</div>
      </div>
      <div class="rounded-xl bg-slate-950/60 p-3 text-center">
        <div class="text-lg font-bold" :class="result && result.hnr_db < 20 ? 'text-amber-300' : 'text-emerald-300'">{{ result ? result.hnr_db.toFixed(1) + ' dB' : '—' }}</div>
        <div class="text-[10px] text-slate-400">HNR (&gt;20 dB)</div>
      </div>
    </div>
    <div class="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">{{ status }}</div>
    <div class="mt-4 flex flex-wrap gap-2">
      <button v-if="!capturing" class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40" @click="startMic">🎙 Live "Ahhh"</button>
      <button v-else class="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40" @click="stopMic">■ Stop & Analyze</button>
      <button class="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/40" @click="preset('clear')">💧 Clear Hydrated</button>
      <button class="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/40" @click="preset('strain')">🎤 Teacher Strain</button>
      <button class="rounded-xl bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-200 ring-1 ring-orange-400/40" @click="preset('hoarse')">🌵 Hoarse / Dry</button>
      <button class="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-200 ring-1 ring-violet-400/40" @click="preset('tremor')">〰 Tremor 5.5 Hz</button>
      <button v-if="result" class="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20" @click="openReport">📋 Full Report</button>
    </div>
  </section>
</template>
