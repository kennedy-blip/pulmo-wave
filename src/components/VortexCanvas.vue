<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ flow: number; zone: string; lowGpu: boolean }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let start = performance.now()

function zoneTint(): [number, number, number] {
  if (props.zone === 'RED') return [0.94, 0.27, 0.27]
  if (props.zone === 'YELLOW') return [0.96, 0.62, 0.04]
  return [0.02, 0.71, 0.83]
}

function draw2D(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const [r, g, b] = zoneTint()
  const energy = Math.min(1, props.flow / 10)
  const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7)
  grad.addColorStop(0, `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${0.25 + energy * 0.4})`)
  grad.addColorStop(0.5, 'rgba(16,185,129,0.18)')
  grad.addColorStop(1, 'rgba(4,9,17,0.95)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  // vortex particles
  const N = props.lowGpu ? 40 : 140
  ctx.save()
  ctx.translate(w / 2, h / 2)
  for (let i = 0; i < N; i++) {
    const a = t * (0.3 + energy * 1.2) + (i / N) * Math.PI * 2
    const rad = (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * Math.min(w, h) * 0.42 + 20
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad * 0.72
    ctx.beginPath()
    ctx.arc(x, y, 1.5 + energy * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${0.35 + energy * 0.5})`
    ctx.fill()
  }
  ctx.restore()
}

async function initWebGPU(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const nav = navigator as any
    if (!nav.gpu) return false
    const adapter = await nav.gpu.requestAdapter()
    if (!adapter) return false
    const device = await adapter.requestDevice()
    const ctx = canvas.getContext('webgpu') as any
    if (!ctx) return false
    const format = nav.gpu.getPreferredCanvasFormat()
    ctx.configure({ device, format, alphaMode: 'opaque' })
    const shader = await (await fetch('/src/shaders/airflow_turbulence.wgsl')).text().catch(() => '')
    const src = shader || `
      struct U { time: f32, flow: f32, tint: vec3<f32>, res: vec2<f32>, low: f32 };
      @group(0) @binding(0) var<uniform> u: U;
      @vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
        var p = array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));
        return vec4<f32>(p[i],0.,1.); }
      @fragment fn fs(@builtin(position) f: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = f.xy / u.res; let c = uv - .5; let r = length(c)+.0001;
        let a = atan2(c.y,c.x); let sw = u.time*(.25+u.flow*.55)+a*2.-r*6.;
        let bands = sin(sw*3.14159)*.5+.5;
        var col = vec3<f32>(.016,.035,.067);
        col += u.tint * bands * (.15 + clamp(u.flow/10.,0.,1.)*.4);
        col += vec3<f32>(.02,.71,.83) * exp(-pow(length(c-vec2<f32>(sin(u.time*.4)*.28,cos(u.time*.3)*.28)),2.)*6.) * .5;
        return vec4<f32>(col,1.); }`
    const module = device.createShaderModule({ code: src })
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    })
    const buf = device.createBuffer({ size: 32, usage: 0x40 | 0x08 })
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] })
    const loop = () => {
      const t = (performance.now() - start) / 1000
      const [r, g, b] = zoneTint()
      const data = new Float32Array([t, props.flow, r, g, b, canvas.width, canvas.height, props.lowGpu ? 1 : 0])
      device.queue.writeBuffer(buf, 0, data)
      const cmd = device.createCommandEncoder()
      const pass = cmd.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: { r: 0.016, g: 0.035, b: 0.067, a: 1 }, storeOp: 'store' }] })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bind)
      pass.draw(3)
      pass.end()
      device.queue.submit([cmd.finish()])
      raf = requestAnimationFrame(loop)
    }
    loop()
    return true
  } catch { return false }
}

onMounted(async () => {
  const canvas = canvasRef.value!
  const resize = () => { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio }
  resize()
  window.addEventListener('resize', resize)
  const ok = await initWebGPU(canvas)
  if (!ok) {
    const ctx = canvas.getContext('2d')!
    const loop2 = () => {
      const t = (performance.now() - start) / 1000
      draw2D(ctx, canvas.width, canvas.height, t)
      raf = requestAnimationFrame(loop2)
    }
    loop2()
  }
  onUnmounted(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) })
})
watch(() => props.lowGpu, () => { /* lowGpu flag read each frame in 2D fallback; WGSL quantizes via uniform */ })
</script>
<template>
  <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" style="will-change: transform" />
</template>
