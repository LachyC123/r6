import * as THREE from 'three'
import { AssetLoader }      from './AssetLoader.js'
import { Stadium }          from './Stadium.js'
import { Player }           from './Player.js'
import { Ball }             from './Ball.js'
import { CameraController } from './CameraController.js'
import { Controls }         from './Controls.js'
import { UI }               from './UI.js'
import { Goals }            from './Goals.js'

const MATCH_DURATION = 180

export class Game {
  constructor() {
    this.state    = 'start'
    this.score    = { home: 0, away: 0 }
    this.timeLeft = MATCH_DURATION
    this._goalPending = false
  }

  async init() {
    this._initRenderer()
    this._initScene()
    this._initLighting()

    this._controls = new Controls()
    this._ui       = new UI(this)
    this._loader   = new AssetLoader()
    await this._loader.initAudio()

    // Attempt to load sounds (silent fallback if missing)
    const base = './assets/audio/'
    await Promise.all([
      this._loader.loadSound('kick',    base + 'kick.mp3'),
      this._loader.loadSound('goal',    base + 'goal.mp3'),
      this._loader.loadSound('whistle', base + 'whistle.mp3'),
      this._loader.loadSound('crowd',   base + 'crowd.mp3')
    ])

    this._stadium = new Stadium(this._scene, this._loader)
    await this._stadium.load()

    this._goals  = new Goals()
    this._player = new Player(this._scene)
    this._ball   = new Ball(this._scene)
    this._cam    = new CameraController(this._camera)

    this._ui.init()
    window.addEventListener('resize', () => this._onResize())
    // Unlock audio on first interaction
    window.addEventListener('pointerdown', () => this._loader.resumeAudio(), { once: true })
  }

  start() {
    this._ui.showStart()
    this._clock = new THREE.Clock(true)
    this._loop()
  }

  startMatch() {
    this._ui.hideStart()
    this._ui.update(this.score, this.timeLeft)
    this.state = 'playing'
  }

  resumeGame() {
    this._ui.hidePause()
    this.state = 'playing'
    this._clock.getDelta() // drain stall
  }

  restart() {
    this.score    = { home: 0, away: 0 }
    this.timeLeft = MATCH_DURATION
    this._goalPending = false
    this._player.reset()
    this._ball.reset()
    this._goals._prevBallZ = 0
    this._ui.hidePause()
    this._ui.hideFullTime()
    this._ui.hideGoal()
    this._ui.update(this.score, this.timeLeft)
    this.state = 'playing'
    this._clock.getDelta()
  }

  _loop() {
    requestAnimationFrame(() => this._loop())
    const delta = Math.min(this._clock.getDelta(), 0.05)
    this._update(delta)
    this._renderer.render(this._scene, this._camera)
  }

  _update(delta) {
    this._controls.update()

    if (this.state !== 'playing') {
      // Keep camera alive so scene renders nicely on start/pause screens
      this._cam.update(this._player, this._ball, delta, false)
      return
    }

    // Pause
    if (this._controls.consumePause()) {
      this.state = 'paused'
      this._ui.showPause()
      return
    }

    // Timer
    this.timeLeft -= delta
    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this._ui.update(this.score, this.timeLeft)
      this._endMatch()
      return
    }

    // Reset ball
    if (this._controls.consumeReset()) this._ball.reset()

    // Shoot
    if (this._controls.consumeShoot() && !this._goalPending) {
      this._ball.shoot(this._player, this._controls)
      this._loader.playSound('kick', { volume: 0.8 })
    }

    this._player.update(this._controls, delta)
    this._ball.update(this._player, this._controls, delta)

    // Goal detection
    if (!this._goalPending) {
      const goal = this._goals.check(this._ball)
      if (goal) this._onGoal(goal)
    }

    this._ui.update(this.score, this.timeLeft)
    this._cam.update(this._player, this._ball, delta, this._controls.sprint)
  }

  _onGoal(team) {
    this.score[team]++
    this.state = 'goal'
    this._goalPending = true
    this._ui.showGoal(team)
    this._loader.playSound('goal', { volume: 1.0 })
    setTimeout(() => {
      this._player.reset()
      this._ball.reset()
      this._goals._prevBallZ = 0
      this._ui.hideGoal()
      this._goalPending = false
      this.state = 'playing'
    }, 2600)
  }

  _endMatch() {
    this.state = 'fulltime'
    this._loader.playSound('whistle', { volume: 1.0 })
    this._ui.showFullTime(this.score)
  }

  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance'
    })
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this._renderer.shadowMap.enabled = true
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping
    this._renderer.toneMappingExposure = 1.2
    document.getElementById('game-canvas').appendChild(this._renderer.domElement)
  }

  _initScene() {
    this._scene = new THREE.Scene()
    this._scene.background = new THREE.Color(0x6ab0d9)
    this._scene.fog = new THREE.Fog(0x6ab0d9, 90, 220)
    this._camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500)
    this._camera.position.set(0, 12, -20)
  }

  _initLighting() {
    this._scene.add(new THREE.HemisphereLight(0xddeeff, 0x3a6b3a, 0.7))

    const sun = new THREE.DirectionalLight(0xfff8e8, 1.6)
    sun.position.set(40, 70, -30)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(1024)
    const sc = sun.shadow.camera
    sc.left = sc.bottom = -70; sc.right = sc.top = 70
    sc.near = 1; sc.far = 200
    this._scene.add(sun)

    const fill = new THREE.DirectionalLight(0x88aaff, 0.3)
    fill.position.set(-30, 20, 40)
    this._scene.add(fill)

    ;[[-36, -44],[36, -44],[-36, 44],[36, 44]].forEach(([x, z]) => {
      const fl = new THREE.PointLight(0xfff4d0, 1.0, 120)
      fl.position.set(x, 22, z)
      this._scene.add(fl)
    })
  }

  _onResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight
    this._camera.updateProjectionMatrix()
    this._renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
