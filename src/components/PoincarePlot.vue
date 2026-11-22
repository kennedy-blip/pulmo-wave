<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
const props = defineProps<{ x: number[]; y: number[] }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const w = c.width, h = c.height
  ctx.fillStyle = 'rgba(4,9,17,0.6)'
  ctx.fillRect(0, 0, w, h)
  if (props.x.length < 2) {
    ctx.fillStyle = 'rgba(226,232,240,0.6)'
    ctx.font = '12px ui-monospace, monospace'
    ctx.fillText('Sustain "Ahhh" to populate Poincaré attractor…', 16, h / 2)
    return
  }
  const all = [...props.x, ...props.y]
  const mn = Math.min(...all), mx = Math.max(...all)
  const pad = 30
  const X = (v: number) => pad + ((v - mn) / Math.max(0.001, mx - mn)) * (w - pad * 1.5)
  const Y = (v: number) => h - pad - ((v - mn) / Math.max(0.001, mx - mn)) * (h - pad * 1.5)
  ctx.strokeStyle = 'rgba(148,163,184,0.25)'
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(w - pad * 0.5, h - pad); ctx.stroke()
  ctx.fillStyle = '#2dd4bf'
  props.x.forEach((v, i) => {
    ctx.beginPath()
    ctx.arc(X(v), Y(props.y[i] ?? v), 3, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = 'rgba(226,232,240,0.7)'
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText('T(n) ms →', w - 90, h - 10)
  ctx.fillText('T(n+1) ↑', 6, 16)
}
function loop() { draw(); raf = requestAnimationFrame(loop) }
onMounted(() => { const c = canvasRef.value!; c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio; loop() })
onUnmounted(() => cancelAnimationFrame(raf))
watch(() => [props.x, props.y], draw, { deep: true })
</script>
<template>
  <canvas ref="canvasRef" class="h-56 w-full rounded-xl" />
</template>
