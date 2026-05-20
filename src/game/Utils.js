export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
export const randRange = (a, b) => a + Math.random() * (b - a)

export function smoothLerp(current, target, speed, delta) {
  return lerp(current, target, 1 - Math.exp(-speed * delta))
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function distanceSq(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z
  return dx * dx + dz * dz
}
