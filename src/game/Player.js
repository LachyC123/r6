import * as THREE from 'three'
import { smoothLerp, clamp } from './Utils.js'
import { PITCH } from './Stadium.js'

const SPEED        = 8
const SPRINT_MULT  = 1.7
const ACCEL        = 16
const DECEL        = 12
const TURN_SPEED   = 14

export class Player {
  constructor(scene) {
    this.mesh      = this._buildMesh()
    this.velocity  = new THREE.Vector3()
    this.facing    = new THREE.Quaternion()
    this._targetQ  = new THREE.Quaternion()
    scene.add(this.mesh)
    this.reset()
  }

  _buildMesh() {
    const g = new THREE.Group()

    // Body (capsule)
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x1a6bc7 })
    )
    body.position.y = 0.75
    body.castShadow = true
    g.add(body)

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xf0c070 })
    )
    head.position.y = 1.7
    head.castShadow = true
    g.add(head)

    // Shorts (darker band)
    const shorts = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.29, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x0a3a7a })
    )
    shorts.position.y = 0.45
    g.add(shorts)

    return g
  }

  update(controls, delta) {
    const maxSpeed = SPEED * (controls.sprint ? SPRINT_MULT : 1)
    const moving   = controls.move.x !== 0 || controls.move.z !== 0

    if (moving) {
      this.velocity.x = smoothLerp(this.velocity.x, controls.move.x * maxSpeed, ACCEL, delta)
      this.velocity.z = smoothLerp(this.velocity.z, controls.move.z * maxSpeed, ACCEL, delta)

      // Rotate player to face movement direction
      const angle = Math.atan2(controls.move.x, controls.move.z)
      this._targetQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle)
      this.mesh.quaternion.slerp(this._targetQ, 1 - Math.exp(-TURN_SPEED * delta))
    } else {
      this.velocity.x = smoothLerp(this.velocity.x, 0, DECEL, delta)
      this.velocity.z = smoothLerp(this.velocity.z, 0, DECEL, delta)
    }

    this.mesh.position.x += this.velocity.x * delta
    this.mesh.position.z += this.velocity.z * delta

    // Pitch bounds
    this.mesh.position.x = clamp(this.mesh.position.x, -PITCH.halfWidth + 0.5, PITCH.halfWidth - 0.5)
    this.mesh.position.z = clamp(this.mesh.position.z, -PITCH.halfLength + 0.5, PITCH.halfLength - 0.5)
  }

  getForward() {
    const fwd = new THREE.Vector3(0, 0, 1)
    fwd.applyQuaternion(this.mesh.quaternion)
    fwd.y = 0
    fwd.normalize()
    return fwd
  }

  reset() {
    this.mesh.position.set(0, 0, -8)
    this.velocity.set(0, 0, 0)
    this.mesh.quaternion.set(0, 0, 0, 1)
  }
}
