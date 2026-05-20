import { PITCH } from './Stadium.js'

export class Goals {
  constructor() {
    this._prevBallZ = 0
  }

  // Returns 'home' | 'away' | null
  check(ball) {
    const p = ball.mesh.position
    const hw = PITCH.goalWidth / 2
    const gh = PITCH.goalHeight

    const inGoalX = Math.abs(p.x) < hw
    const inGoalY = p.y < gh + 0.5

    let result = null

    // Ball crossed AWAY goal line (positive Z) → HOME scores
    if (inGoalX && inGoalY && p.z >= PITCH.halfLength && this._prevBallZ < PITCH.halfLength) {
      result = 'home'
    }
    // Ball crossed HOME goal line (negative Z) → AWAY scores
    if (inGoalX && inGoalY && p.z <= -PITCH.halfLength && this._prevBallZ > -PITCH.halfLength) {
      result = 'away'
    }

    this._prevBallZ = p.z
    return result
  }
}
