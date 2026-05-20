import * as THREE from 'three'
import { clamp } from './Utils.js'
import { PITCH } from './Stadium.js'

const RADIUS        = 0.22
const FRICTION      = 0.985
const SHOOT_NORMAL  = 22
const SHOOT_SPRINT  = 34
const DRIBBLE_RANGE = 1.6
const DRIBBLE_AHEAD = 1.15
const DRIBBLE_SPEED = 18
const GRAVITY       = 20
const BOUNCE        = 0.45

export class Ball {
  constructor(scene) {
    this.mesh      = this._buildMesh()
    this.velocity  = new THREE.Vector3()
    this._inAir    = false
    this._hasBall  = false
    this._shootCooldown = 0
    scene.add(this.mesh)
    this.reset()
  }

  _buildMesh() {
    // Checkerboard ball texture via canvas
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#111111'
    const tiles = [[0,0],[2,0],[4,0],[1,1],[3,1],[0,2],[2,2],[4,2],[1,3],[3,3],[0,4],[2,4],[4,4]]
    tiles.forEach(([tx, ty]) => ctx.fillRect(tx * 51, ty * 51, 51, 51))
    const tex = new THREE.CanvasTexture(canvas)

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 16, 12),
      new THREE.MeshLambertMaterial({ map: tex })
    )
    mesh.castShadow = true
    return mesh
  }

  update(player, controls, delta) {
    if (this._shootCooldown > 0) this._shootCooldown -= delta

    const dist = player.mesh.position.distanceTo(this.mesh.position)
    this._hasBall = dist < DRIBBLE_RANGE && this._shootCooldown <= 0

    if (this._hasBall) {
      // Dribble: pull ball in front of player
      const fwd  = player.getForward()
      const ahead = controls.sprint ? DRIBBLE_AHEAD * 1.6 : DRIBBLE_AHEAD
      const target = player.mesh.position.clone()
        .add(fwd.multiplyScalar(ahead))
      target.y = RADIUS

      const toTarget = target.clone().sub(this.mesh.position)
      const spd = Math.min(DRIBBLE_SPEED * delta, toTarget.length())
      toTarget.normalize().multiplyScalar(spd)
      this.mesh.position.add(toTarget)
      this.velocity.set(0, 0, 0)
    } else {
      // Free ball physics
      if (this._inAir) {
        this.velocity.y -= GRAVITY * delta
      }

      this.mesh.position.addScaledVector(this.velocity, delta)

      // Ground check
      if (this.mesh.position.y <= RADIUS) {
        this.mesh.position.y = RADIUS
        if (this._inAir && this.velocity.y < -1) {
          this.velocity.y *= -BOUNCE
          const horizSpd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2)
          if (Math.abs(this.velocity.y) < 0.5 || horizSpd < 0.5) {
            this.velocity.y = 0; this._inAir = false
          }
        } else {
          this.velocity.y = 0; this._inAir = false
        }
      }

      // Friction (horizontal only)
      this.velocity.x *= FRICTION
      this.velocity.z *= FRICTION

      // Rolling rotation
      const horizSpd = Math.sqrt(this.velocity.x**2 + this.velocity.z**2)
      if (horizSpd > 0.01) {
        const axis  = new THREE.Vector3(-this.velocity.z, 0, this.velocity.x).normalize()
        const angle = (horizSpd * delta) / RADIUS
        const q     = new THREE.Quaternion().setFromAxisAngle(axis, angle)
        this.mesh.quaternion.premultiply(q)
      }

      // Pitch soft boundaries (ball bounces off sides, ends open for goals)
      if (Math.abs(this.mesh.position.x) > PITCH.halfWidth - 0.1) {
        this.mesh.position.x = Math.sign(this.mesh.position.x) * (PITCH.halfWidth - 0.1)
        this.velocity.x *= -0.6
      }
      // Past goal line but off-target: reset
      const gz = PITCH.halfLength + PITCH.goalDepth + 1
      if (this.mesh.position.z > gz || this.mesh.position.z < -gz) {
        this.reset()
      }
    }
  }

  shoot(player, controls) {
    if (!this._hasBall) return
    const power = controls.sprint ? SHOOT_SPRINT : SHOOT_NORMAL
    const fwd   = player.getForward()
    this.velocity.set(fwd.x * power, power * 0.18, fwd.z * power)
    this._inAir = true
    this._hasBall = false
    this._shootCooldown = 0.6
  }

  hasBall() { return this._hasBall }

  reset() {
    this.mesh.position.set(0, RADIUS, 0)
    this.velocity.set(0, 0, 0)
    this._inAir = false
    this._hasBall = false
    this._shootCooldown = 0
  }
}
