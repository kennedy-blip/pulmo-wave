<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useSpringPhysics } from '../composables/useSpringPhysics'

const protocol = ref<'incentive' | 'pursed' | 'box' | 'altitude'>('incentive')
const phase = ref('Ready')
const orb = useSpringPhysics(0)
const holdSeconds = ref(0)
const score = ref(0)
let timer: number | null = null
let audioCtx: AudioContext | null = null
let stream: MediaStream | null = null
let analyser: AnalyserNode | null = null
let raf = 0
let capturing = false

const orbStyle = computed(() => {
  const y = orb.value.value // 0..1
  return {
    transform: `translate(-50%, ${-y * 140}px) scale(${0.7 + y * 0.6})`,
    boxShadow: y >= 0.4 && y <= 0.75 ? '0 0 40px rgba(16,185,129,0.9)' : '0 0 18px rgba(6,182,212,0.6)',
  }
})

function haptic(pattern: number | number[]) {
  try { (navigator as any).vibrate?.(pattern) } catch { /* unsupported */ }
}
function drone(freq: number) {
  try {
    audioCtx = audioCtx ?? new AudioContext()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.frequency.value = freq
    g.gain.value = 0.04
    o.connect(g); g.connect(audioCtx.destination)
    o.start()
    setTimeout(() => { o.stop(); g.disconnect() }, 900)
  } catch { /* audio blocked */ }
}

function startProtocol() {
  stopProtocol()
  holdSeconds.value = 0
  score.value = 0
  if (protocol.value === 'incentive') {
    phase.value = 'Blow steady 1.5–2.5 L/s to levitate the orb…'
    startMic()
  } else if (protocol.value === 'pursed') {
    phase.value = 'Inhale 2s…'
    let cycle = 0
    timer = window.setInterval(() => {
      cycle++
      if (cycle % 6 === 0) { phase.value = 'Inhale 2s…'; drone(392); haptic(80) }
      else if (cycle % 6 === 1) { phase.value = 'Pursed-lip exhale 4s…'; drone(262); haptic([60, 40, 60]) }
      else phase.value = `Pursed-lip exhale… (${6 - (cycle % 6)})`
    }, 1000)
  } else if (protocol.value === 'box') {
    phase.value = 'Box 4-4-4-4: Inhale 4s…'
    let cycle = 0
    const steps = ['Inhale 4s…', 'Hold 4s…', 'Exhale 4s…', 'Hold 4s…']
    timer = window.setInterval(() => {
      cycle++
      phase.value = steps[Math.floor(cycle / 4) % 4]
      if (cycle % 4 === 0) { drone(330 + (cycle % 16)); haptic(70) }
    }, 1000)
  } else {
    phase.value = 'Altitude CO₂ builder: exhale into mic, hold 10s…'
    timer = window.setInterval(() => {
      holdSeconds.value++
      phase.value = `Hold… ${holdSeconds.value}s (target 30s)`
      if (holdSeconds.value % 10 === 0) { drone(220); haptic(100) }
    }, 1000)
  }
}
function stopProtocol() {
  if (timer) { clearInterval(timer); timer = null }
  capturing = false
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as any })
    audioCtx = new AudioContext({ sampleRate: 48000 })
    const src = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    src.connect(analyser)
    capturing = true
    const buf = new Float32Array(analyser.fftSize)
    const tick = () => {
      if (!capturing || !analyser) return
      analyser.getFloatTimeDomainData(buf)
      let peak = 0
      buf.forEach((v) => { peak = Math.max(peak, Math.abs(v)) })
      const flow = peak * 12 // L/s estimate
      orb.setTarget(Math.min(1, Math.max(0, (flow - 0.5) / 4)))
      if (flow >= 1.5 && flow <= 2.5) {
        holdSeconds.value += 1 / 60
        if (holdSeconds.value >= 4) { score.value++; holdSeconds.value = 0; drone(523); haptic(120) }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
  } catch (e: any) { phase.value = 'Mic blocked: ' + e.message + ' — tap the orb to simulate flow.' }
}
function tapOrb() {
  orb.setTarget(0.55 + Math.random() * 0.2)
  holdSeconds.value += 0.5
  if (holdSeconds.value >= 4) { score.value++; holdSeconds.value = 0 }
}
onUnmounted(stopProtocol)
</script>
<template>
  <section class="glass-card p-5">
    <h2 class="text-xl font-bold tracking-tight">Pulmonary Rehab Pacer</h2>
    <p class="mb-3 text-xs text-slate-400">Incentive spirometer orb · pursed-lip COPD · box breathing · altitude CO₂ builder</p>
    <div class="mb-3 flex flex-wrap gap-2">
      <button class="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1" :class="protocol === 'incentive' ? 'bg-cyan-500/25 text-cyan-200 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="protocol = 'incentive'">🎯 Incentive Orb</button>
      <button class="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1" :class="protocol === 'pursed' ? 'bg-cyan-500/25 text-cyan-200 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="protocol = 'pursed'">👄 Pursed-Lip 2:4</button>
      <button class="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1" :class="protocol === 'box' ? 'bg-cyan-500/25 text-cyan-200 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="protocol = 'box'">📦 Box 4-4-4-4</button>
      <button class="rounded-xl px-3 py-1.5 text-xs font-semibold ring-1" :class="protocol === 'altitude' ? 'bg-cyan-500/25 text-cyan-200 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="protocol = 'altitude'">🏔 Altitude CO₂</button>
    </div>

    <div v-if="protocol === 'incentive'" class="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-2xl bg-slate-950/60">
      <div class="absolute inset-x-8 top-[30%] h-[35%] rounded-xl border-2 border-dashed border-emerald-400/60 bg-emerald-400/10" />
      <div class="absolute left-1/2 top-2 text-[10px] font-bold text-emerald-300" style="transform: translateX(-50%)">TARGET 1.5–2.5 L/s</div>
      <button class="absolute left-1/2 top-[68%] h-14 w-14 rounded-full bg-gradient-to-br from-cyan-300 to-emerald-400" :style="orbStyle" @click="tapOrb" aria-label="levitating orb" />
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 font-mono text-xs">Hold {{ holdSeconds.toFixed(1) }}s · Score {{ score }}</div>
    </div>
    <div v-else class="flex h-56 flex-col items-center justify-center rounded-2xl bg-slate-950/60">
      <div class="text-2xl font-bold">{{ phase }}</div>
      <div class="mt-2 text-xs text-slate-400">Haptic pacing + harmonic drone active</div>
    </div>

    <div class="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">{{ phase }}</div>
    <div class="mt-4 flex gap-2">
      <button class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40" @click="startProtocol">▶ Start Protocol</button>
      <button class="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20" @click="stopProtocol">■ Stop</button>
    </div>
  </section>
</template>
