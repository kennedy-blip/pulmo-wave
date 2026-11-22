<script setup lang="ts">
import { ref } from 'vue'
import Spectrogram from './Spectrogram.vue'
import { tsAnalyzeWheeze, synthAirway, type WheezeResult } from '../wasm/pulmoWasmBridge'
import { saveLog } from '../stores/vault'

const result = ref<WheezeResult | null>(null)
const pcm = ref<Float32Array | null>(null)
const status = ref('Classify wheeze vs cough vs clear breath')

function apply(kind: 'wheeze' | 'dry' | 'wet' | 'clear') {
  const buf = synthAirway(kind)
  pcm.value = buf
  const r = tsAnalyzeWheeze(buf)
  result.value = r
  status.value = `${r.classification} — confidence ${r.wheeze_confidence.toFixed(0)}% · dominant ${r.dominant_hz} Hz · cough transients ${r.cough_transients}`
  saveLog('wheeze', status.value, { ...r })
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
    analyser.fftSize = 4096
    src.connect(analyser)
    capturing = true
    status.value = 'MIC LIVE — cough / wheeze / breathe…'
    const buf = new Float32Array(analyser.fftSize)
    const collect: number[] = []
    const tick = () => {
      if (!capturing || !analyser) return
      analyser.getFloatTimeDomainData(buf)
      buf.forEach((v) => collect.push(v))
      liveBuf.value = new Float32Array(collect.slice(-48000 * 3))
      pcm.value = liveBuf.value
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
  if (liveBuf.value.length > 2000) {
    const r = tsAnalyzeWheeze(liveBuf.value)
    result.value = r
    status.value = `${r.classification} — confidence ${r.wheeze_confidence.toFixed(0)}%`
    saveLog('wheeze', status.value, { ...r })
  }
}
</script>
<template>
  <section class="glass-card p-5">
    <h2 class="text-xl font-bold tracking-tight">Wheeze & Cough Classifier</h2>
    <p class="mb-3 text-xs text-slate-400">Waterfall spectrogram 100 Hz – 3 kHz · wheeze 350–950 Hz &gt;250 ms · rhonchi 150–300 Hz · cough transients</p>
    <Spectrogram :pcm="pcm" :label="result ? result.classification : ''" />
    <div class="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">{{ status }}</div>
    <div v-if="result" class="mt-3 flex items-center gap-3">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" :style="{ width: result.wheeze_confidence + '%' }" />
      </div>
      <span class="text-xs font-bold">{{ result.wheeze_confidence.toFixed(0) }}%</span>
    </div>
    <div class="mt-4 flex flex-wrap gap-2">
      <button v-if="!capturing" class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40" @click="startMic">🎙 Live Airway Mic</button>
      <button v-else class="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40" @click="stopMic">■ Stop & Classify</button>
      <button class="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40" @click="apply('wheeze')">🫁 Polyphonic Wheeze 480+720 Hz</button>
      <button class="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/40" @click="apply('dry')">🐕 Dry Barking Cough</button>
      <button class="rounded-xl bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-200 ring-1 ring-orange-400/40" @click="apply('wet')">💧 Wet Congestion Cough</button>
      <button class="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/40" @click="apply('clear')">🍃 Clear Vesicular</button>
    </div>
  </section>
</template>
