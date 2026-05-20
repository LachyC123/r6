import * as THREE from 'three'

// Pitch dimensions (world units)
export const PITCH = {
  halfLength: 50,  // Z axis
  halfWidth:  32,  // X axis
  goalWidth:   7.32,
  goalHeight:  2.44,
  goalDepth:   2.0
}

export class Stadium {
  constructor(scene, loader) {
    this._scene  = scene
    this._loader = loader
    this._group  = new THREE.Group()
    scene.add(this._group)

    // Tweak these to adjust stadium GLB
    this.glbScale    = 1.0
    this.glbPosition = new THREE.Vector3(0, 0, 0)
  }

  async load() {
    const glbPaths = [
      './assets/stadium/stadium.glb',
      './assets/stadium/arena.glb',
      './assets/stadium/pitch.glb',
      './assets/stadium/soccer.glb',
      './assets/stadium/football.glb'
    ]
    let loaded = false
    for (const path of glbPaths) {
      try {
        const gltf = await this._loader.loadGLTF(path)
        this._setupGLB(gltf.scene)
        loaded = true
        console.log(`[Stadium] Loaded GLB: ${path}`)
        break
      } catch { /* try next */ }
    }
    if (!loaded) {
      console.warn('[Stadium] No GLB found – using procedural fallback.')
    }
    this._buildPitch()
    this._buildMarkings()
    this._buildGoals()
    if (!loaded) this._buildFallbackStands()
  }

  _setupGLB(model) {
    model.traverse(n => {
      if (n.isMesh) {
        n.castShadow = true
        n.receiveShadow = true
      }
    })
    // Auto-normalise: fit bounding box so pitch span ~ 100 units
    const box  = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.z)
    if (maxDim > 0) model.scale.setScalar(this.glbScale * 100 / maxDim)
    // Centre at ground
    box.setFromObject(model)
    const centre = new THREE.Vector3()
    box.getCenter(centre)
    model.position.set(-centre.x, -box.min.y, -centre.z)
    model.position.add(this.glbPosition)
    this._group.add(model)
  }

  _buildPitch() {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1a6e2e' : '#1d7d34'
      ctx.fillRect(0, i * 64, 512, 64)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)

    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH.halfWidth * 2, PITCH.halfLength * 2),
      new THREE.MeshLambertMaterial({ map: tex })
    )
    pitch.rotation.x = -Math.PI / 2
    pitch.receiveShadow = true
    this._group.add(pitch)
  }

  _buildMarkings() {
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff })
    const Y   = 0.02
    const pts = []
    const add = (x1, z1, x2, z2) => {
      pts.push(x1, Y, z1, x2, Y, z2)
    }
    const W = PITCH.halfWidth, L = PITCH.halfLength

    // Touchlines & goal lines
    add(-W, -L, -W, L); add( W, -L, W, L)
    add(-W, -L,  W, -L); add(-W, L, W, L)
    // Halfway
    add(-W, 0, W, 0)
    // Penalty boxes
    const pb = 16.5, pbW = 20.16
    add(-pbW, -L, -pbW, -L+pb); add( pbW, -L,  pbW, -L+pb); add(-pbW, -L+pb, pbW, -L+pb)
    add(-pbW,  L, -pbW,  L-pb); add( pbW,  L,  pbW,  L-pb); add(-pbW,  L-pb, pbW,  L-pb)
    // Goal boxes
    const gb = 5.5, gbW = 9.16
    add(-gbW, -L, -gbW, -L+gb); add( gbW, -L,  gbW, -L+gb); add(-gbW, -L+gb, gbW, -L+gb)
    add(-gbW,  L, -gbW,  L-gb); add( gbW,  L,  gbW,  L-gb); add(-gbW,  L-gb, gbW,  L-gb)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this._group.add(new THREE.LineSegments(geo, mat))

    // Centre circle
    this._addCircle(0, 0, 9.15, Y)
    // Penalty spots
    this._addCircle(0, -L + 11, 0.3, Y, 12)
    this._addCircle(0,  L - 11, 0.3, Y, 12)
    // Centre spot
    this._addCircle(0, 0, 0.3, Y, 12)
  }

  _addCircle(cx, cz, r, y, segs = 64) {
    const pts = []
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      pts.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this._group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff })))
  }

  _buildGoals() {
    const gw = PITCH.goalWidth, gh = PITCH.goalHeight, gd = PITCH.goalDepth
    const r  = 0.08
    const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    const netMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 0.25, transparent: true })

    const makeGoal = (z, dir) => {
      const g = new THREE.Group()
      // Posts
      const post = () => new THREE.Mesh(new THREE.CylinderGeometry(r, r, gh, 8), postMat)
      const lp = post(); lp.position.set(-gw/2, gh/2, 0); g.add(lp)
      const rp = post(); rp.position.set( gw/2, gh/2, 0); g.add(rp)
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, gw+r*2, 8), postMat)
      bar.rotation.z = Math.PI/2; bar.position.set(0, gh, 0); g.add(bar)
      // Back post
      const bp = new THREE.Mesh(new THREE.CylinderGeometry(r, r, gh, 8), postMat)
      bp.position.set(0, gh/2, dir * gd); g.add(bp)
      // Net
      const net = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), netMat)
      net.position.set(0, gh/2, dir * gd/2); g.add(net)
      g.position.set(0, 0, z)
      this._group.add(g)
    }
    makeGoal(-PITCH.halfLength,  1)
    makeGoal( PITCH.halfLength, -1)
  }

  _buildFallbackStands() {
    const standMat = c => new THREE.MeshLambertMaterial({ color: c })
    const standConfigs = [
      { w:90, h:6, d:8, x:0,   z:0,  rx: 0.3, tz:  46, col: 0x2255aa },
      { w:90, h:6, d:8, x:0,   z:0,  rx:-0.3, tz: -46, col: 0x2255aa },
      { w:70, h:5, d:7, x: 44, z:0,  rz:-0.3, col: 0x1a4488 },
      { w:70, h:5, d:7, x:-44, z:0,  rz: 0.3, col: 0x1a4488 }
    ]
    standConfigs.forEach(({ w, h, d, x, z, rx=0, rz=0, tz=0, col }) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), standMat(col))
      mesh.position.set(x, h/2 + 0.5, z + tz)
      mesh.rotation.set(rx, 0, rz)
      mesh.receiveShadow = true
      this._group.add(mesh)
    })

    // Floodlight poles
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
    const polePos = [[-36,43],[36,43],[-36,-43],[36,-43]]
    polePos.forEach(([px, pz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 22, 6), poleMat)
      pole.position.set(px, 11, pz)
      this._group.add(pole)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.4), poleMat)
      arm.position.set(px, 22, pz)
      this._group.add(arm)
    })

    // Ad boards
    const boardMat = new THREE.MeshBasicMaterial({ color: 0x0077cc })
    const boards = [
      { w:80, x:0, z: 33.5, ry:0 },
      { w:80, x:0, z:-33.5, ry:Math.PI }
    ]
    boards.forEach(({ w, x, z, ry }) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 0.2), boardMat)
      b.position.set(x, 0.6, z); b.rotation.y = ry
      this._group.add(b)
    })
  }
}
