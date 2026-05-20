import { formatTime } from './Utils.js'

export class UI {
  constructor(game) {
    this._game = game
    this._scoreHome = document.getElementById('score-home')
    this._scoreAway = document.getElementById('score-away')
    this._timer     = document.getElementById('match-timer')
    this._overlayStart    = document.getElementById('overlay-start')
    this._overlayPause    = document.getElementById('overlay-pause')
    this._overlayGoal     = document.getElementById('overlay-goal')
    this._overlayFulltime = document.getElementById('overlay-fulltime')
    this._goalText  = document.getElementById('goal-text')
    this._goalTeam  = document.getElementById('goal-team')
    this._finalHome = document.getElementById('final-home')
    this._finalAway = document.getElementById('final-away')
    this._resultTxt = document.getElementById('result-text')
  }

  init() {
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this._game.startMatch()
    })
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this._game.resumeGame()
    })
    document.getElementById('btn-restart-pause')?.addEventListener('click', () => {
      this._game.restart()
    })
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this._game.restart()
    })
  }

  update(score, timeLeft) {
    this._scoreHome.textContent = score.home
    this._scoreAway.textContent = score.away
    this._timer.textContent     = formatTime(timeLeft)
    if (timeLeft <= 30) this._timer.style.color = '#ff4444'
    else                this._timer.style.color = ''
  }

  showStart()    { this._overlayStart.classList.remove('hidden') }
  hideStart()    { this._overlayStart.classList.add('hidden') }

  showPause()    { this._overlayPause.classList.remove('hidden') }
  hidePause()    { this._overlayPause.classList.add('hidden') }

  showGoal(team) {
    this._goalText.textContent = 'GOAL!'
    this._goalTeam.textContent = team === 'home' ? 'HOME TEAM' : 'AWAY TEAM'
    this._overlayGoal.classList.remove('hidden')
    // Re-trigger animation
    this._goalText.style.animation = 'none'
    void this._goalText.offsetWidth
    this._goalText.style.animation = ''
  }
  hideGoal()     { this._overlayGoal.classList.add('hidden') }

  showFullTime(score) {
    this._finalHome.textContent = score.home
    this._finalAway.textContent = score.away
    if (score.home > score.away)      this._resultTxt.textContent = 'HOME WIN!'
    else if (score.away > score.home) this._resultTxt.textContent = 'AWAY WIN!'
    else                              this._resultTxt.textContent = 'DRAW!'
    this._overlayFulltime.classList.remove('hidden')
  }
  hideFullTime() { this._overlayFulltime.classList.add('hidden') }
}
