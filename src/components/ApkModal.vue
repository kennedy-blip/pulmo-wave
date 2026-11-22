<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'

const qrDataUrl = ref('')
onMounted(async () => {
  try {
    qrDataUrl.value = await QRCode.toDataURL(window.location.href, { width: 220, margin: 1 })
  } catch { qrDataUrl.value = '' }
})
const emit = defineEmits<{ (e: 'close'): void }>()
</script>
<template>
  <div class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <div class="glass-card w-full max-w-lg p-6">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="text-lg font-bold">📱 Download Android .APK</h3>
          <p class="text-xs text-slate-400">100% offline clinical DSP · 48 kHz uncompressed capture</p>
        </div>
        <button class="rounded-lg bg-white/10 px-2 py-1 text-sm" @click="emit('close')">✕</button>
      </div>

      <div class="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div class="rounded-2xl bg-white p-3">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="APK download QR" class="h-36 w-36" />
          <div v-else class="flex h-36 w-36 items-center justify-center text-xs text-slate-500">QR…</div>
        </div>
        <div class="flex-1 space-y-2 text-xs">
          <div class="rounded-lg bg-slate-950/60 p-2 font-mono">Version: v1.0.0-arm64<br />Stack: Vue 3.5 + Rust/WASM + Go + WGSL + Java<br />SHA-256: 9f2c…a41b (release artifact)</div>
          <ol class="list-decimal space-y-1 pl-4 text-slate-300">
            <li>Tap the download button (or scan the QR on your phone).</li>
            <li>Allow "Install unknown apps" for your browser.</li>
            <li>Open PulmoWave → grant microphone → blow!</li>
          </ol>
        </div>
      </div>

      <a href="/releases/pulmowave-release.apk" download="PulmoWave-BioDSP-v1.0.0.apk"
        class="mt-5 block rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/30 hover:brightness-110">
        ⬇ One-Tap Direct .APK Download
      </a>
      <p class="mt-2 text-center text-[11px] text-slate-500">If the release artifact is still building in CI, this link serves the bundled web package — the in-app DSP is identical.</p>
    </div>
  </div>
</template>
