<script setup lang="ts">
import { ref, computed } from 'vue'
import FlowVolumeChart from './FlowVolumeChart.vue'
import { tsAnalyzeSpirometry, synthExhalation, type SpirometryResult } from '../wasm/pulmoWasmBridge'
import { saveLog } from '../stores/vault'
import { useSpringPhysics } from '../composables/useSpringPhysics'

const props = defineProps<{ role: string; age: number; height: number; sex: string }>()
const emit = defineEmits<{ (e: 'flow', v: number): void; (e: 'zone', v: string): void; (e: 'open-report', payload: unknown): void }>()

const result = ref<SpirometryResult | null>(null)
const overlay = ref<number[]>([])
const liveFlow = ref(0)
const status = ref('Ready — blow or run a simulator')
const needle = useSpringPhysics(0)
const predicted = computed(() => {
  const h = props.height / 100
  return props.sex === 'M'
    ? { fev1: 5.76 * h * h - 0.026 * props.age - 0.00028 * props.age * props.age - 0.041, fvc: 6.48 * h * h - 0.028 * props.age - 0.00032 * props.age * props.age - 0.041, pefr: 610 * h * h / 3.24 }
    : { fev1: 4.43 * h * h - 0.024 * props.age - 0.00025 * props.age * props.age - 0.041, fvc: 5.5 * h * h - 0.03 * props.age - 0.00028 * props.age * props.age - 0.041, pefr: 500 * h * h / 2.89 }
})

function apply(r: SpirometryResult) {
  result.value = r
  liveFlow.value = r.peak_flow_l_s
  needle.setTarget(Math.min(850, r.pefr_l_min))
  emit('flow', r.peak_flow_l_s)
  emit('zone', r.zone)
  status.value = `${r.zone} ZONE — PEFR ${r.pefr_l_min.toFixed(0)} L/min · FEV1 ${r.fev1_l.toFixed(2)} L · FVC ${r.fvc_l.toFixed(2)} L · ${r.ratio_pct.toFixed(1)}%`
  saveLog('spirometry', status.value, { pefr: r.pefr_l_min, fev1: r.fev1_l, fvc: r.fvc_l, ratio: r.ratio_pct, zone: r.zone })
}

function runSim(kind: 'athlete' | 'bronchospasm' | 'asthma' | 'recovery') {
  const env = synthExhalation(kind)
  const r = tsAnalyzeSpirometry(env, 12)
  if (kind === 'recovery' && result.value) {
    overlay.value = result.value.flow_l_s
    const boosted: SpirometryResult = { ...r, fev1_l: r.fev1_l * 1.18, ratio_pct: Math.min(100, r.ratio_pct * 1.18), reversibility_pct: 18 }
    apply(boosted)
    status.value += ' · +18% reversibility overlay'
  } else {
    overlay.value = []
    apply(r)
  }
}

let audioCtx: AudioContext | null = null
let stream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let raf = 0
let capturing = false
const liveBuf = ref<Float32Array>(new Float32Array(0))

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any,
    })
    audioCtx = new AudioContext({ sampleRate: 48000 })
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(analyser)
    capturing = true
    status.value = 'MIC LIVE — blow forcefully at 30 cm…'
    const buf = new Float32Array(analyser.fftSize)
    const collect: number[] = []
    const tick = () => {
      if (!capturing || !analyser) return
      analyser.getFloatTimeDomainData(buf)
      let peak = 0
      buf.forEach((v) => { peak = Math.max(peak, Math.abs(v)); collect.push(v) })
      liveFlow.value = peak * 12
      needle.setTarget(Math.min(850, peak * 12 * 60))
      emit('flow', liveFlow.value)
      liveBuf.value = new Float32Array(collect.slice(-48000 * 6))
      raf = requestAnimationFrame(tick)
    }
    tick()
  } catch (e: any) {
    status.value = 'Mic blocked: ' + e.message + ' — use a simulator below.'
  }
}
function stopMic() {
  capturing = false
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (liveBuf.value.length > 1000) {
    apply(tsAnalyzeSpirometry(liveBuf.value, 12))
  } else {
    status.value = 'No exhalation captured — try again or use a simulator.'
  }
}

function openReport() {
  if (!result.value) return
  emit('open-report', {
    title: 'Spirometry Clinical Report',
    kind: 'spirometry',
    metrics: [
      ['PEFR', result.value.pefr_l_min.toFixed(0) + ' L/min'],
      ['FEV1', result.value.fev1_l.toFixed(2) + ' L'],
      ['FVC', result.value.fvc_l.toFixed(2) + ' L'],
      ['FEV1/FVC', result.value.ratio_pct.toFixed(1) + ' %'],
      ['Zone', result.value.zone],
      ['Predicted FEV1', predicted.value.fev1.toFixed(2) + ' L (NHANES III)'],
      ['Predicted PEFR', predicted.value.pefr.toFixed(0) + ' L/min'],
    ],
    note: status.value,
  })
}
</script>
<template>
  <section class="glass-card p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold tracking-tight">Acoustic Vortex Spirometer</h2>
        <p class="text-xs text-slate-400">Flow-Volume Loop · FEV₁ / FVC / PEFR · NHANES III norms · 30 cm blow distance</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative h-16 w-16">
          <svg viewBox="0 0 64 64" class="h-16 w-16 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(148,163,184,0.2)" stroke-width="6" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="#06b6d4" stroke-width="6" stroke-linecap="round"
              :stroke-dasharray="`${(needle.value.value / 850) * 163} 163`" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-sm font-bold">{{ Math.round(needle.value.value) }}</span>
            <span class="text-[9px] text-slate-400">L/min</span>
          </div>
        </div>
      </div>
    </div>

    <FlowVolumeChart v-if="result" :flow="result.flow_l_s" :volume="result.volume_l" :time="result.time_s" :zone="result.zone" :overlay="overlay" />
    <div v-else class="flex h-64 items-center justify-center rounded-xl bg-slate-950/50 text-sm text-slate-400">
      Blow into the mic or inject a synthetic patient profile to plot the Flow-Volume Loop.
    </div>

    <div class="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs" :class="result?.zone === 'RED' ? 'text-red-300' : result?.zone === 'YELLOW' ? 'text-amber-300' : 'text-emerald-300'">
      {{ status }}
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button v-if="!capturing" class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40 hover:bg-cyan-500/30" @click="startMic">🎙 Live Mic Blow</button>
      <button v-else class="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40" @click="stopMic">■ Stop & Analyze</button>
      <button class="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/40" @click="runSim('athlete')">🏃 Healthy Athlete</button>
      <button class="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/40" @click="runSim('bronchospasm')">🌫 Mild Bronchospasm</button>
      <button class="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/40" @click="runSim('asthma')">🚨 Acute Asthma</button>
      <button v-if="role !== 'PATIENT'" class="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-200 ring-1 ring-violet-400/40" @click="runSim('recovery')">💊 Post-Inhaler +18%</button>
      <button v-if="result" class="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20" @click="openReport">📋 Full Report</button>
    </div>
    <p v-if="role === 'PATIENT'" class="mt-2 text-[11px] text-slate-500">Post-bronchodilator overlay is a PRO feature — switch role in the Privileges drawer.</p>
  </section>
</template>
