export class Controls {
  constructor() {
    this.move = { x: 0, z: 0 }
    this.sprint = false
    this.shoot = false
    this._shootPressed = false
    this._resetPressed = false
    this._pausePressed = false
    this._sprintTouch = false
    this._shootTouch = false
    this._joystickDir = { x: 0, y: 0 }
    this._keys = {}
    this._initKeyboard()
    this._initMobile()
  }

  _initKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true
      if (e.code === 'Space') { e.preventDefault(); this._shootPressed = true }
      if (e.code === 'Escape') this._pausePressed = true
      if (e.code === 'KeyR') this._resetPressed = true
    })
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false
    })
    window.addEventListener('mousedown', e => {
      if (e.button === 0) this._shootPressed = true
    })
  }

  _initMobile() {
    const zone = document.getElementById('joystick-zone')
    const base = document.getElementById('joystick-base')
    const thumb = document.getElementById('joystick-thumb')
    const shootBtn = document.getElementById('btn-shoot-mobile')
    const sprintBtn = document.getElementById('btn-sprint-mobile')
    if (!zone) return

    const RADIUS = 44
    let touchId = null, originX = 0, originY = 0

    const onTouchStart = e => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (touchId !== null) continue
        touchId = t.identifier
        const rect = zone.getBoundingClientRect()
        originX = t.clientX - rect.left
        originY = t.clientY - rect.top
        base.style.left = (originX - 55) + 'px'
        base.style.top = (originY - 55) + 'px'
        base.style.opacity = '1'
      }
    }

    const onTouchMove = e => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue
        const rect = zone.getBoundingClientRect()
        let dx = (t.clientX - rect.left) - originX
        let dy = (t.clientY - rect.top) - originY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > RADIUS) { dx = dx / dist * RADIUS; dy = dy / dist * RADIUS }
        this._joystickDir.x = dx / RADIUS
        this._joystickDir.y = dy / RADIUS
        thumb.style.transform = `translate(${dx}px, ${dy}px)`
      }
    }

    const onTouchEnd = e => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue
        touchId = null
        this._joystickDir.x = 0
        this._joystickDir.y = 0
        thumb.style.transform = 'translate(0,0)'
        base.style.opacity = '0.5'
      }
    }

    zone.addEventListener('touchstart', onTouchStart, { passive: false })
    zone.addEventListener('touchmove', onTouchMove, { passive: false })
    zone.addEventListener('touchend', onTouchEnd, { passive: false })
    zone.addEventListener('touchcancel', onTouchEnd, { passive: false })

    shootBtn?.addEventListener('touchstart', e => { e.preventDefault(); this._shootTouch = true; this._shootPressed = true }, { passive: false })
    shootBtn?.addEventListener('touchend', e => { e.preventDefault(); this._shootTouch = false }, { passive: false })
    sprintBtn?.addEventListener('touchstart', e => { e.preventDefault(); this._sprintTouch = true }, { passive: false })
    sprintBtn?.addEventListener('touchend', e => { e.preventDefault(); this._sprintTouch = false }, { passive: false })
  }

  update() {
    let mx = this._joystickDir.x
    let mz = this._joystickDir.y
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) mx -= 1
    if (this._keys['KeyD'] || this._keys['ArrowRight']) mx += 1
    if (this._keys['KeyW'] || this._keys['ArrowUp']) mz -= 1
    if (this._keys['KeyS'] || this._keys['ArrowDown']) mz += 1
    const len = Math.sqrt(mx * mx + mz * mz)
    if (len > 0.01) {
      this.move.x = mx / len
      this.move.z = mz / len
    } else {
      this.move.x = 0
      this.move.z = 0
    }
    this.sprint = !!(this._keys['ShiftLeft'] || this._keys['ShiftRight'] || this._sprintTouch)
    this.shoot = !!(this._keys['Space'] || this._shootTouch)
  }

  consumeShoot() { const v = this._shootPressed; this._shootPressed = false; return v }
  consumeReset() { const v = this._resetPressed; this._resetPressed = false; return v }
  consumePause() { const v = this._pausePressed; this._pausePressed = false; return v }
}
