<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
const props = defineProps<{ flow: number[]; volume: number[]; time: number[]; zone: string; overlay?: number[] }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')!
  const w = c.width, h = c.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(4,9,17,0.55)'
  ctx.fillRect(0, 0, w, h)
  const pad = 34
  const maxV = Math.max(1, ...props.volume) * 1.1
  const maxF = Math.max(1, ...props.flow) * 1.15
  const X = (v: number) => pad + (v / maxV) * (w - pad * 1.6)
  const Y = (f: number) => h - pad - (f / maxF) * (h - pad * 1.7)
  // grid
  ctx.strokeStyle = 'rgba(148,163,184,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = pad + (i / 4) * (h - pad * 1.7)
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad * 0.6, y); ctx.stroke()
    const x = pad + (i / 4) * (w - pad * 1.6)
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(226,232,240,0.75)'
  ctx.font = '11px ui-monospace, monospace'
  ctx.fillText('Volume (L) →', w - 110, h - 10)
  ctx.fillText('Flow (L/s) ↑', 6, 16)
  ctx.fillText(maxV.toFixed(1) + ' L', w - pad * 1.6 - 8, h - pad + 16)
  ctx.fillText(maxF.toFixed(1), 6, pad + 4)
  // overlay (post-inhaler)
  if (props.overlay?.length) {
    ctx.strokeStyle = 'rgba(45,212,191,0.8)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.beginPath()
    props.overlay.forEach((f, i) => {
      const v = props.volume[i] ?? 0
      const x = X(v), y = Y(f)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }
  // flow-volume loop
  const col = props.zone === 'RED' ? '#ef4444' : props.zone === 'YELLOW' ? '#f59e0b' : '#06b6d4'
  ctx.strokeStyle = col
  ctx.lineWidth = 2.5
  ctx.shadowColor = col
  ctx.shadowBlur = 8
  ctx.beginPath()
  props.flow.forEach((f, i) => {
    const x = X(props.volume[i] ?? 0), y = Y(f)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.shadowBlur = 0
  // volume-time sparkline at bottom
  ctx.strokeStyle = 'rgba(16,185,129,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  props.volume.forEach((v, i) => {
    const x = pad + (i / Math.max(1, props.volume.length - 1)) * (w - pad * 1.6)
    const y = h - 8 - (v / maxV) * 26
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.fillStyle = 'rgba(16,185,129,0.8)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.fillText('V(t) 0→6s', pad, h - 8)
}
function loop() { draw(); raf = requestAnimationFrame(loop) }
onMounted(() => { const c = canvasRef.value!; c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio; loop() })
onUnmounted(() => cancelAnimationFrame(raf))
watch(() => [props.flow, props.volume], draw, { deep: true })
</script>
<template>
  <canvas ref="canvasRef" class="h-64 w-full rounded-xl" />
</template>
