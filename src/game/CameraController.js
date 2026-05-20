import * as THREE from 'three'
import { smoothLerp } from './Utils.js'

const BASE_HEIGHT    = 8
const BASE_DIST      = 14
const SPRINT_DIST    = 18
const FOLLOW_SPEED   = 6
const LOOK_SPEED     = 8

export class CameraController {
  constructor(camera) {
    this._cam      = camera
    this._target   = new THREE.Vector3()
    this._lookAt   = new THREE.Vector3()
  }

  update(player, ball, delta, isSprinting = false) {
    const pp  = player.mesh.position
    const bp  = ball.mesh.position

    // Camera sits behind the player in the direction they're facing
    const fwd = player.getForward()
    const dist = isSprinting ? SPRINT_DIST : BASE_DIST

    this._target.set(
      pp.x - fwd.x * dist,
      pp.y + BASE_HEIGHT,
      pp.z - fwd.z * dist
    )

    // Smooth follow
    this._cam.position.x = smoothLerp(this._cam.position.x, this._target.x, FOLLOW_SPEED, delta)
    this._cam.position.y = smoothLerp(this._cam.position.y, this._target.y, FOLLOW_SPEED * 0.6, delta)
    this._cam.position.z = smoothLerp(this._cam.position.z, this._target.z, FOLLOW_SPEED, delta)

    // Look at midpoint between player and ball (biased toward player)
    const lookX = pp.x * 0.7 + bp.x * 0.3
    const lookY = pp.y + 0.9
    const lookZ = pp.z * 0.7 + bp.z * 0.3

    this._lookAt.x = smoothLerp(this._lookAt.x, lookX, LOOK_SPEED, delta)
    this._lookAt.y = smoothLerp(this._lookAt.y, lookY, LOOK_SPEED, delta)
    this._lookAt.z = smoothLerp(this._lookAt.z, lookZ, LOOK_SPEED, delta)

    this._cam.lookAt(this._lookAt)
  }
}
