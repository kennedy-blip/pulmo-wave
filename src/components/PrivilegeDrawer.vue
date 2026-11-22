<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ role: string; theme: string; lowGpu: boolean; mobilePreview: boolean }>()
const emit = defineEmits<{
  (e: 'role', v: string): void
  (e: 'theme', v: string): void
  (e: 'low-gpu', v: boolean): void
  (e: 'mobile-preview', v: boolean): void
  (e: 'close'): void
}>()

const roles = [
  { id: 'PATIENT', label: 'PATIENT / ATHLETE', tier: 'Standard', desc: 'Spirometer, Vocal Lab, Wheeze Classifier, Rehab Pacer' },
  { id: 'THERAPIST', label: 'RESPIRATORY THERAPIST PRO', tier: 'Pro', desc: 'NHANES III calibration, pre/post-inhaler overlay, Poincaré plotter' },
  { id: 'ADMIN', label: 'BIOMEDICAL SYSTEMS ADMIN', tier: 'Admin', desc: 'Polyglot inspector, PCM/CSV export, IndexedDB sync controller' },
]
const themes = [
  { id: 'obsidian', label: 'Pulmonary Obsidian', desc: 'Default dark glass #040911' },
  { id: 'daylight', label: 'Clinical Daylight Frost', desc: 'Pearl lab glass, dark slate type' },
  { id: 'nocturnal', label: 'Nocturnal Pediatric', desc: 'Midnight-amber low-glare' },
  { id: 'eco', label: 'Eco-Glass / Low-GPU', desc: 'No blur, 2D canvas, 60 FPS budget' },
]
const perms = ref([
  { name: 'Spirometry Mic (AGC OFF)', status: 'JAVA NATIVE / WEB DSP ACTIVE', on: true },
  { name: 'Posture & Distance Stabilizer', status: 'SIMULATOR ACTIVE', on: true },
  { name: 'Haptic Pacing Engine', status: 'JAVA NATIVE / WEB DSP ACTIVE', on: true },
  { name: 'PIN-Locked HIPAA Vault', status: 'RESTRICTED', on: false },
])
const pin = ref('')
const pinMsg = ref('')
function unlock() {
  pinMsg.value = pin.value === '1234' ? '✅ Vault unlocked (demo PIN 1234)' : '❌ Wrong PIN — try 1234'
}
</script>
<template>
  <div class="fixed inset-0 z-[70] flex justify-end bg-slate-950/60 backdrop-blur-sm" @click.self="emit('close')">
    <aside class="h-full w-full max-w-md overflow-y-auto bg-slate-950/90 p-5 backdrop-blur-xl" @click.stop>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">🔐 Privileges & Runtime</h3>
        <button class="rounded-lg bg-white/10 px-2 py-1 text-sm" @click="emit('close')">✕</button>
      </div>

      <h4 class="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">Role (RBAC)</h4>
      <div class="mt-2 space-y-2">
        <button v-for="r in roles" :key="r.id" class="w-full rounded-xl p-3 text-left ring-1"
          :class="props.role === r.id ? 'bg-cyan-500/20 ring-cyan-400/50' : 'bg-white/5 ring-white/15'" @click="emit('role', r.id)">
          <div class="flex justify-between text-sm font-bold"><span>{{ r.label }}</span><span class="text-cyan-300">{{ r.tier }}</span></div>
          <div class="text-[11px] text-slate-400">{{ r.desc }}</div>
        </button>
      </div>

      <h4 class="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">Theme & Environment</h4>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button v-for="t in themes" :key="t.id" class="rounded-xl p-3 text-left ring-1"
          :class="props.theme === t.id ? 'bg-emerald-500/20 ring-emerald-400/50' : 'bg-white/5 ring-white/15'" @click="emit('theme', t.id)">
          <div class="text-xs font-bold">{{ t.label }}</div>
          <div class="text-[10px] text-slate-400">{{ t.desc }}</div>
        </button>
      </div>
      <label class="mt-3 flex items-center gap-2 text-xs">
        <input type="checkbox" :checked="props.lowGpu" @change="emit('low-gpu', ($event.target as HTMLInputElement).checked)" />
        Eco-Glass low-GPU mode (disable blur + WGSL)
      </label>
      <label class="mt-2 flex items-center gap-2 text-xs">
        <input type="checkbox" :checked="props.mobilePreview" @change="emit('mobile-preview', ($event.target as HTMLInputElement).checked)" />
        Mobile APK Preview chassis
      </label>

      <h4 class="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">Hardware Permission Matrix</h4>
      <div class="mt-2 space-y-2">
        <div v-for="p in perms" :key="p.name" class="flex items-center justify-between rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <div>
            <div class="text-xs font-bold">{{ p.name }}</div>
            <div class="font-mono text-[10px]" :class="p.status === 'RESTRICTED' ? 'text-red-300' : 'text-emerald-300'">{{ p.status }}</div>
          </div>
          <input type="checkbox" v-model="p.on" />
        </div>
      </div>

      <h4 class="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">HIPAA Vault PIN</h4>
      <div class="mt-2 flex gap-2">
        <input v-model="pin" type="password" inputmode="numeric" maxlength="4" placeholder="4-digit PIN"
          class="w-32 rounded-xl bg-slate-900 px-3 py-2 text-center font-mono ring-1 ring-white/15" />
        <button class="rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/40" @click="unlock">Unlock</button>
      </div>
      <p class="mt-1 text-xs">{{ pinMsg }}</p>
    </aside>
  </div>
</template>
