import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export class AssetLoader {
  constructor() {
    this._gltfLoader = new GLTFLoader()
    this._audio = {}
    this._audioCtx = null
    this._audioBuffers = {}
  }

  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this._gltfLoader.load(
        url,
        gltf => resolve(gltf),
        undefined,
        err => {
          console.warn(`[AssetLoader] GLB not found at ${url}, using fallback.`, err)
          reject(err)
        }
      )
    })
  }

  async initAudio() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      console.warn('[AssetLoader] Web Audio unavailable.')
    }
  }

  async loadSound(name, url) {
    if (!this._audioCtx) return
    try {
      const res = await fetch(url)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      this._audioBuffers[name] = await this._audioCtx.decodeAudioData(buf)
    } catch {
      // audio missing – silent fallback
    }
  }

  playSound(name, { loop = false, volume = 1.0 } = {}) {
    if (!this._audioCtx || !this._audioBuffers[name]) return null
    const src = this._audioCtx.createBufferSource()
    src.buffer = this._audioBuffers[name]
    src.loop = loop
    const gain = this._audioCtx.createGain()
    gain.gain.value = volume
    src.connect(gain).connect(this._audioCtx.destination)
    src.start(0)
    return src
  }

  resumeAudio() {
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {})
    }
  }
}
