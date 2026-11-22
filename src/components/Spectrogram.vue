<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
const props = defineProps<{ pcm: Float32Array | null; label: string }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
const history: number[][] = []

function spectrum(frame: Float32Array): number[] {
  // 64-bin log-spaced magnitude 100Hz–3kHz (Goertzel bank)
  const bins: number[] = []
  const n = Math.min(frame.length, 4096)
  const mean = Array.from(frame.subarray(0, n)).reduce((a, b) => a + b, 0) / n
  for (let b = 0; b < 64; b++) {
    const f = 100 * Math.pow(30, b / 63)
    let re = 0, im = 0
    for (let i = 0; i < n; i++) {
      const w = 2 * Math.PI * f * i / 48000
      const c = frame[i] - mean
      re += c * Math.cos(w); im += c * Math.sin(w)
    }
    bins.push(Math.min(1, Math.sqrt(re * re + im * im) / (n * 0.5)))
  }
  return bins
}
function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const w = c.width, h = c.height
  ctx.fillStyle = '#040911'
  ctx.fillRect(0, 0, w, h)
  const rows = 48
  const colW = w / rows
  const binH = h / 64
  history.forEach((bins, r) => {
    const x = w - (r + 1) * colW
    if (x < 0) return
    bins.forEach((m, b) => {
      const y = h - (b + 1) * binH
      const hue = 190 - m * 190
      ctx.fillStyle = `hsl(${hue}, 90%, ${12 + m * 45}%)`
      ctx.fillRect(x, y, colW, binH)
    })
  })
  ctx.fillStyle = 'rgba(226,232,240,0.8)'
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText('100 Hz', 6, h - 6)
  ctx.fillText('3 kHz', 6, 14)
  ctx.fillText(props.label || 'Waterfall 100 Hz – 3,000 Hz', w - 220, 14)
  // wheeze band marker 350–950 Hz
  const y950 = h - ((Math.log(950 / 100) / Math.log(30)) * 64) * binH
  const y350 = h - ((Math.log(350 / 100) / Math.log(30)) * 64) * binH
  ctx.strokeStyle = 'rgba(245,158,11,0.7)'
  ctx.setLineDash([4, 4])
  ctx.strokeRect(0, y950, w, y350 - y950)
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(245,158,11,0.9)'
  ctx.fillText('Wheeze 350–950 Hz', 8, y950 - 4)
}
function loop() {
  if (props.pcm && props.pcm.length > 512) {
    history.push(spectrum(props.pcm))
    if (history.length > 60) history.shift()
  }
  draw()
  raf = requestAnimationFrame(loop)
}
onMounted(() => { const c = canvasRef.value!; c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio; loop() })
onUnmounted(() => cancelAnimationFrame(raf))
watch(() => props.pcm, () => { history.length = 0 })
</script>
<template>
  <canvas ref="canvasRef" class="h-64 w-full rounded-xl" />
</template>
