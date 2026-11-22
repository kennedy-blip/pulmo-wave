<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VortexCanvas from './components/VortexCanvas.vue'
import VortexSpirometer from './components/VortexSpirometer.vue'
import VocalLab from './components/VocalLab.vue'
import WheezeClassifier from './components/WheezeClassifier.vue'
import RehabPacer from './components/RehabPacer.vue'
import PolyglotInspector from './components/PolyglotInspector.vue'
import ApkModal from './components/ApkModal.vue'
import PrivilegeDrawer from './components/PrivilegeDrawer.vue'

type View = 'spiro' | 'vocal' | 'wheeze' | 'rehab' | 'polyglot'
const view = ref<View>('spiro')
const role = ref('PATIENT')
const theme = ref('obsidian')
const lowGpu = ref(false)
const mobilePreview = ref(false)
const showApk = ref(false)
const showDrawer = ref(false)
const liveFlow = ref(0)
const liveZone = ref('GREEN')
const age = ref(30)
const height = ref(175)
const sex = ref('M')
const report = ref<any>(null)
const specX = ref(0)
const specY = ref(0)

const nav = [
  { id: 'spiro' as View, icon: '🫁', label: 'Spirometer' },
  { id: 'vocal' as View, icon: '🎤', label: 'Vocal Lab' },
  { id: 'wheeze' as View, icon: '🌊', label: 'Wheeze' },
  { id: 'rehab' as View, icon: '🎯', label: 'Rehab' },
  { id: 'polyglot' as View, icon: '🧬', label: 'Polyglot' },
]

const themeClass = computed(() => ({
  obsidian: 'theme-obsidian',
  daylight: 'theme-daylight',
  nocturnal: 'theme-nocturnal',
  eco: 'theme-eco',
}[theme.value]))

function onSpecular(e: MouseEvent) {
  specX.value = e.clientX
  specY.value = e.clientY
}
function onTilt(e: DeviceOrientationEvent) {
  specX.value = (e.gamma ?? 0) * 10 + window.innerWidth / 2
  specY.value = (e.beta ?? 0) * 10 + window.innerHeight / 2
}
onMounted(() => {
  window.addEventListener('mousemove', onSpecular)
  window.addEventListener('deviceorientation', onTilt as any)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onSpecular)
  window.removeEventListener('deviceorientation', onTilt as any)
})
</script>
<template>
  <div :class="themeClass" class="min-h-full">
    <div class="noise-overlay" />
    <svg width="0" height="0" class="absolute">
      <defs>
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
        </filter>
      </defs>
    </svg>

    <div class="app-shell" :class="{ 'depth-push': showApk || showDrawer || report }">
      <!-- WGSL vortex underlay -->
      <div class="fixed inset-0 -z-10">
        <VortexCanvas :flow="liveFlow" :zone="liveZone" :low-gpu="lowGpu || theme === 'eco'" />
      </div>
      <!-- specular light sweep -->
      <div class="pointer-events-none fixed inset-0 z-40" :style="{ background: `radial-gradient(600px circle at ${specX}px ${specY}px, rgba(255,255,255,0.06), transparent 60%)` }" />

      <!-- Header -->
      <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🫁</span>
            <div>
              <div class="text-sm font-black tracking-widest">PULMO-WAVE</div>
              <div class="text-[10px] text-slate-400">Acoustic Vortex Spirometer · Vocal Biomarker Lab</div>
            </div>
          </div>
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <div class="hidden items-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10 md:flex">
              <button class="rounded-full px-3 py-1 text-[11px] font-semibold" :class="!mobilePreview ? 'bg-cyan-500/30 text-cyan-100' : 'text-slate-400'" @click="mobilePreview = false">🖥 Desktop Station</button>
              <button class="rounded-full px-3 py-1 text-[11px] font-semibold" :class="mobilePreview ? 'bg-cyan-500/30 text-cyan-100' : 'text-slate-400'" @click="mobilePreview = true">📱 APK Preview</button>
            </div>
            <button class="rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/25" @click="showApk = true">⬇ Download .APK</button>
            <button class="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20" @click="showDrawer = true">🔐 {{ role }}</button>
          </div>
        </div>
        <!-- NHANES calibration strip (PRO/ADMIN) -->
        <div v-if="role !== 'PATIENT'" class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pb-3 text-xs">
          <span class="font-bold text-slate-400">NHANES III:</span>
          <label>Age <input v-model.number="age" type="number" min="5" max="100" class="w-16 rounded-lg bg-slate-900 px-2 py-1 ring-1 ring-white/15" /></label>
          <label>Height cm <input v-model.number="height" type="number" min="100" max="230" class="w-20 rounded-lg bg-slate-900 px-2 py-1 ring-1 ring-white/15" /></label>
          <label>Sex
            <select v-model="sex" class="rounded-lg bg-slate-900 px-2 py-1 ring-1 ring-white/15">
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          <span class="font-mono text-[11px] text-slate-500">Predicted norms update live in the spirometer.</span>
        </div>
      </header>

      <!-- Main -->
      <main class="mx-auto max-w-6xl px-4 pb-28 pt-5">
        <div :class="mobilePreview ? 'mx-auto max-w-[390px] rounded-[36px] border-[10px] border-slate-800 bg-slate-950/60 p-3 shadow-2xl' : ''">
          <TransitionGroup name="fade-slide" tag="div">
            <VortexSpirometer v-if="view === 'spiro'" key="spiro" :role="role" :age="age" :height="height" :sex="sex"
              @flow="(v: number) => (liveFlow = v)" @zone="(z: string) => (liveZone = z)" @open-report="(p: unknown) => (report = p)" />
            <VocalLab v-else-if="view === 'vocal'" key="vocal" @open-report="(p: unknown) => (report = p)" />
            <WheezeClassifier v-else-if="view === 'wheeze'" key="wheeze" />
            <RehabPacer v-else-if="view === 'rehab'" key="rehab" />
            <PolyglotInspector v-else key="polyglot" />
          </TransitionGroup>
        </div>
      </main>

      <!-- Gooey Metaball Dock -->
      <nav class="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div class="gooey-filter flex items-center gap-1 rounded-full bg-slate-900/85 px-3 py-2 ring-1 ring-white/15 backdrop-blur-xl">
          <button v-for="n in nav" :key="n.id" class="flex flex-col items-center rounded-full px-3 py-1.5 text-[10px] font-semibold"
            :class="view === n.id ? 'bg-cyan-500/30 text-cyan-100' : 'text-slate-400'" @click="view = n.id">
            <span class="text-base leading-none">{{ n.icon }}</span>{{ n.label }}
          </button>
        </div>
      </nav>
    </div>

    <!-- Modals -->
    <Transition name="morph">
      <ApkModal v-if="showApk" @close="showApk = false" />
    </Transition>
    <Transition name="morph">
      <PrivilegeDrawer v-if="showDrawer" :role="role" :theme="theme" :low-gpu="lowGpu" :mobile-preview="mobilePreview"
        @role="(v: string) => (role = v)" @theme="(v: string) => (theme = v)"
        @low-gpu="(v: boolean) => (lowGpu = v)" @mobile-preview="(v: boolean) => (mobilePreview = v)"
        @close="showDrawer = false" />
    </Transition>
    <Transition name="morph">
      <div v-if="report" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" @click.self="report = null">
        <div class="glass-card w-full max-w-lg p-6">
          <div class="flex items-start justify-between">
            <h3 class="text-lg font-bold">📋 {{ report.title }}</h3>
            <button class="rounded-lg bg-white/10 px-2 py-1 text-sm" @click="report = null">✕</button>
          </div>
          <div class="mt-4 space-y-2">
            <div v-for="m in report.metrics" :key="m[0]" class="flex justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-sm">
              <span class="text-slate-400">{{ m[0] }}</span><span class="font-mono font-bold">{{ m[1] }}</span>
            </div>
          </div>
          <p class="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">{{ report.note }}</p>
          <p class="mt-2 text-[11px] text-slate-500">Saved to IndexedDB vault · 100% offline DSP · Rust/WASM + Go triage mirror.</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
