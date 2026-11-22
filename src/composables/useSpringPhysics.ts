import { ref, onUnmounted, type Ref } from 'vue'

/** Hooke's-law spring: stiffness 310, damping 24, mass 0.85 (spec §5). */
export function useSpringPhysics(initial = 0, stiffness = 310, damping = 24, mass = 0.85) {
  const value: Ref<number> = ref(initial)
  const velocity = ref(0)
  const target = ref(initial)
  let raf = 0
  let last = 0

  function step(now: number) {
    if (!last) last = now
    const dt = Math.min(0.032, (now - last) / 1000)
    last = now
    const force = -stiffness * (value.value - target.value) - damping * velocity.value
    const acc = force / mass
    velocity.value += acc * dt
    value.value += velocity.value * dt
    if (Math.abs(value.value - target.value) > 0.001 || Math.abs(velocity.value) > 0.001) {
      raf = requestAnimationFrame(step)
    } else {
      value.value = target.value
      velocity.value = 0
    }
  }
  function setTarget(v: number) {
    target.value = v
    cancelAnimationFrame(raf)
    last = 0
    raf = requestAnimationFrame(step)
  }
  function snap(v: number) {
    value.value = v
    target.value = v
    velocity.value = 0
  }
  onUnmounted(() => cancelAnimationFrame(raf))
  return { value, velocity, target, setTarget, snap }
}

/** Card tilt driven by a spring (specular lighting / squish & press). */
export function useCardTilt() {
  const rx = useSpringPhysics(0, 310, 24, 0.85)
  const ry = useSpringPhysics(0, 310, 24, 0.85)
  const scale = useSpringPhysics(1, 310, 24, 0.85)
  function onMove(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    rx.setTarget(-py * 8)
    ry.setTarget(px * 8)
  }
  function onEnter() { scale.setTarget(1.015) }
  function onLeave() { rx.setTarget(0); ry.setTarget(0); scale.setTarget(1) }
  function onDown() { scale.setTarget(0.96) }
  function onUp() { scale.setTarget(1.015) }
  const transform = () =>
    `perspective(900px) rotateX(${rx.value.value.toFixed(2)}deg) rotateY(${ry.value.value.toFixed(2)}deg) scale(${scale.value.value.toFixed(3)})`
  return { onMove, onEnter, onLeave, onDown, onUp, transform }
}
