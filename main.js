import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x070b13);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050911, 16, 95);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 180);
scene.add(camera);
const world = new THREE.Group();
scene.add(world);

const ui = {
  phase: document.getElementById('phase'),
  timer: document.getElementById('timer'),
  score: document.getElementById('score'),
  round: document.getElementById('round'),
  health: document.getElementById('health'),
  ammo: document.getElementById('ammo'),
  stance: document.getElementById('stance'),
  objective: document.getElementById('objective'),
  gadgetA: document.getElementById('gadgetA'),
  gadgetB: document.getElementById('gadgetB'),
  feed: document.getElementById('feed'),
  scoreboard: document.getElementById('scoreboard')
};

const ambient = new THREE.HemisphereLight(0x89a6d4, 0x101820, 0.75);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xa8c8ff, 1.35);
keyLight.position.set(8, 16, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const state = {
  phase: 'prep',
  phaseTime: 45,
  phaseConfig: { prep: 45, action: 165, postPlant: 45 },
  round: 1,
  maxRounds: 3,
  score: { atk: 0, def: 0 },
  bombPlanted: false,
  bombTimer: 45,
  gameOver: false,
  objectivePos: new THREE.Vector3(0, 0, -10)
};

const input = { keys: {}, mouseDx: 0, mouseDy: 0, ads: false, fire: false, lean: 0, melee: false };
const raycaster = new THREE.Raycaster();

const colliders = [];
const destructibles = [];
const bots = [];
const gadgets = [];
const pings = [];
const impacts = [];
const bullets = [];
const trails = [];

const weaponRig = new THREE.Group();
const weaponMuzzle = new THREE.Object3D();

function buildWeaponViewModel() {
  const gunRoot = new THREE.Group();

  const body = box(0.18, 0.14, 0.9, 0x212734, { roughness: 0.42, metalness: 0.72 });
  body.position.set(0, -0.01, -0.42);
  gunRoot.add(body);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.35, metalness: 0.9 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.01, 0, -0.86);
  gunRoot.add(barrel);

  const sight = box(0.08, 0.06, 0.16, 0x1f2631, { roughness: 0.35, metalness: 0.78 });
  sight.position.set(0, 0.11, -0.36);
  gunRoot.add(sight);

  const grip = box(0.08, 0.26, 0.12, 0x2f3642, { roughness: 0.66, metalness: 0.42 });
  grip.rotation.x = -0.25;
  grip.position.set(-0.01, -0.14, -0.21);
  gunRoot.add(grip);

  const mag = box(0.09, 0.22, 0.13, 0x262d38, { roughness: 0.38, metalness: 0.78 });
  mag.rotation.x = -0.14;
  mag.position.set(0, -0.16, -0.34);
  gunRoot.add(mag);

  weaponMuzzle.position.set(0, 0.004, -1.17);
  gunRoot.add(weaponMuzzle);

  weaponRig.add(gunRoot);
  weaponRig.position.set(0.33, -0.29, -0.45);
  camera.add(weaponRig);
}
buildWeaponViewModel();

const damageVignette = document.getElementById('vignette');
const flickerLights = [];

function makeNoiseTexture(base = '#253242', accent = '#1b2736') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2400; i++) {
    const a = 0.04 + Math.random() * 0.12;
    ctx.fillStyle = accent + Math.floor(a * 255).toString(16).padStart(2, '0');
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}


const navNodes = [
  new THREE.Vector3(-10, 0, 8), new THREE.Vector3(-4, 0, 8), new THREE.Vector3(4, 0, 8), new THREE.Vector3(10, 0, 8),
  new THREE.Vector3(-10, 0, 0), new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4, 0, 0), new THREE.Vector3(10, 0, 0),
  new THREE.Vector3(-10, 0, -8), new THREE.Vector3(-4, 0, -8), new THREE.Vector3(4, 0, -8), new THREE.Vector3(10, 0, -8)
];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function beep(freq = 200, len = 0.05, type = 'triangle', vol = 0.03) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g).connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + len);
  o.stop(audioCtx.currentTime + len);
}

function addFeed(text) {
  const el = document.createElement('div');
  el.className = 'feed-line';
  el.textContent = text;
  ui.feed.prepend(el);
  while (ui.feed.children.length > 6) ui.feed.lastChild.remove();
}

function box(w, h, d, c, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: c,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.08,
    map: opts.map || null,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0
  });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function makeMap() {
  const floorTex = makeNoiseTexture('#2f3743', '#252e38');
  const wallTex = makeNoiseTexture('#556475', '#394756');
  const concreteTex = makeNoiseTexture('#3b434f', '#2f3641');
  const trimTex = makeNoiseTexture('#2c3542', '#202734');

  const floor = box(30, 0.2, 30, 0x2a3441, { map: floorTex, roughness: 0.68, metalness: 0.18 });
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  world.add(floor);

  const ceiling = box(30, 0.3, 30, 0x1b212b, { map: trimTex, roughness: 0.86, metalness: 0.24 });
  ceiling.position.y = 4;
  world.add(ceiling);

  const perimeter = box(29.4, 0.1, 29.4, 0x111722, { roughness: 0.9 });
  perimeter.position.set(0, 0.005, 0);
  world.add(perimeter);

  const walls = [
    [0, 1.5, 15, 30, 3, 0.4], [0, 1.5, -15, 30, 3, 0.4], [15, 1.5, 0, 0.4, 3, 30], [-15, 1.5, 0, 0.4, 3, 30],
    [0, 1.5, 9.2, 19, 3, 0.4], [0, 1.5, -9.2, 18, 3, 0.4],
    [-6.4, 1.5, 2.6, 0.4, 3, 13.4], [6.4, 1.5, -2.6, 0.4, 3, 13.4],
    [-2.8, 1.5, 0.2, 6.4, 3, 0.4], [3.2, 1.5, -0.2, 6.6, 3, 0.4],
    [-11, 1.5, -3.8, 8, 3, 0.4], [11, 1.5, 3.8, 8, 3, 0.4]
  ];
  walls.forEach(([x, y, z, w, h, d]) => {
    const m = box(w, h, d, 0x4a5b6e, { map: wallTex, roughness: 0.74, metalness: 0.12 });
    m.position.set(x, y, z);
    m.castShadow = true;
    world.add(m);
    colliders.push(new THREE.Box3().setFromObject(m));
  });

  const site = box(4.6, 0.12, 4.6, 0x465a72, { emissive: 0x10243d, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.38 });
  site.position.set(0, 0.05, -10);
  world.add(site);

  const siteRing = box(5.5, 0.04, 5.5, 0x162232, { emissive: 0x2f9fff, emissiveIntensity: 0.28 });
  siteRing.position.set(0, 0.08, -10);
  world.add(siteRing);

  const weakWall = box(0.4, 2.4, 3.6, 0x75644f, { map: concreteTex, roughness: 0.92 });
  weakWall.position.set(5.7, 1.2, -5.6);
  world.add(weakWall);
  destructibles.push({ type: 'wall', hp: 70, mesh: weakWall, bounds: new THREE.Box3().setFromObject(weakWall), destroyed: false });

  const door = box(1.2, 2.4, 0.2, 0x6b523c, { roughness: 0.8 });
  door.position.set(-5.9, 1.2, 3.3);
  world.add(door);
  destructibles.push({ type: 'door', hp: 80, mesh: door, bounds: new THREE.Box3().setFromObject(door), destroyed: false });

  const glass = box(3.2, 1.5, 0.1, 0x7ba9d2);
  glass.material.transparent = true;
  glass.material.opacity = 0.5;
  glass.position.set(10.8, 1.45, -3.2);
  world.add(glass);
  destructibles.push({ type: 'glass', hp: 25, mesh: glass, bounds: new THREE.Box3().setFromObject(glass), destroyed: false });


  const stripGeo = new THREE.BoxGeometry(0.15, 0.06, 3.4);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x87d6ff, emissive: 0x2b8ec2, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.65 });
  [-10.5, -2, 8.4].forEach((x, i) => {
    const strip = new THREE.Mesh(stripGeo, stripMat.clone());
    strip.position.set(x, 3.45, i === 0 ? -11.5 : 7.8);
    strip.castShadow = false;
    world.add(strip);
  });

  for (let i = 0; i < 20; i++) {
    const pillar = box(0.35, 2.8, 0.35, 0x203446, { roughness: 0.6, metalness: 0.35 });
    const edge = i % 4;
    const offset = -12 + (i % 4) * 8;
    pillar.position.set(edge < 2 ? offset : (edge === 2 ? -12 : 12), 1.4, edge < 2 ? (edge === 0 ? -12 : 12) : offset);
    world.add(pillar);
  }

  const coverSpots = [
    [-9.4, 0.65, 10.4], [-5.2, 0.65, 10.1], [8.8, 0.65, -10.2], [4.6, 0.65, -10.5],
    [-10.8, 0.65, 4.2], [10.8, 0.65, -4.2], [-1.4, 0.65, 6.1], [1.7, 0.65, -6.3],
    [-8.4, 0.65, -1.2], [8.2, 0.65, 1.3]
  ];
  coverSpots.forEach(([x, y, z], i) => {
    const c = box(1.2, 1.2 + (i % 3) * 0.35, 1.2, 0x2f3a49, { map: concreteTex, roughness: 0.82 });
    c.position.set(x, y, z);
    world.add(c);
    colliders.push(new THREE.Box3().setFromObject(c));
  });

  const serverStack = box(3.5, 2.4, 1.5, 0x222c3a, { map: trimTex, roughness: 0.55, metalness: 0.5 });
  serverStack.position.set(0, 1.2, -1.8);
  world.add(serverStack);
  colliders.push(new THREE.Box3().setFromObject(serverStack));

  const catwalk = box(6.8, 0.18, 1.8, 0x314152, { roughness: 0.45, metalness: 0.55 });
  catwalk.position.set(0, 2.7, -9.2);
  world.add(catwalk);

  const bombLights = [
    new THREE.PointLight(0xff4f4f, 0.7, 10, 2),
    new THREE.PointLight(0x4f8dff, 0.55, 10, 2)
  ];
  bombLights[0].position.set(-1.7, 1.1, -10);
  bombLights[1].position.set(1.7, 1.1, -10);
  bombLights.forEach((l) => {
    world.add(l);
    flickerLights.push(l);
  });

  const accentA = new THREE.PointLight(0x5ec8ff, 1.1, 20, 2);
  accentA.position.set(-10, 2.8, -8);
  world.add(accentA);
  flickerLights.push(accentA);

  const accentB = new THREE.PointLight(0x8dffd2, 0.9, 18, 2);
  accentB.position.set(6, 2.4, 7);
  world.add(accentB);
  flickerLights.push(accentB);

  const camPoints = [new THREE.Vector3(-12, 3.3, -11), new THREE.Vector3(12, 3.3, 8), new THREE.Vector3(0, 3.4, 0)];
  camPoints.forEach((p, i) => {
    const cam = box(0.3, 0.2, 0.3, 0x9bc0e8);
    cam.position.copy(p);
    world.add(cam);
    gadgets.push({ type: 'cctv', team: 'def', mesh: cam, pos: p.clone(), id: i });
  });
}
makeMap();

const player = {
  team: 'atk', role: 'Planbreaker', hp: 100, pos: new THREE.Vector3(-12, 1.7, 12), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  grounded: true, crouch: false, sprint: false, ammo: 30, reserve: 90, recoil: 0, spread: 0.015,
  breachCharges: 2, pulseCd: 0, pulseReady: true, droneActive: false, camMode: false, pingCd: 0, alive: true
};
camera.position.copy(player.pos);

function makeBot(team, role, pos) {
  const m = box(0.8, 1.8, 0.8, team === 'atk' ? 0x5894ff : 0xff6767);
  m.position.copy(pos);
  world.add(m);
  return {
    team, role, mesh: m, hp: 100, targetNode: null, alert: 0, reaction: 0.2 + Math.random() * 0.5,
    shootTimer: 0, state: 'hold', pingTarget: null, retreat: false, lastHeard: null, dead: false, gadgetCd: 8 + Math.random() * 4
  };
}

function spawnTeams() {
  bots.length = 0;
  const atkRoles = ['Planter', 'Support', 'Fragger'];
  const defRoles = ['Anchor', 'Roamer', 'Intel'];
  for (let i = 0; i < 3; i++) {
    bots.push(makeBot('atk', atkRoles[i], new THREE.Vector3(-12.5 + i * 1.8, 1, 11.6 - i * 0.7)));
    bots.push(makeBot('def', defRoles[i], new THREE.Vector3(10.8 - i * 1.6, 1, -10.8 + i * 1.1)));
  }
}
spawnTeams();

function updateUI() {
  ui.phase.textContent = state.bombPlanted ? 'POST-PLANT' : state.phase.toUpperCase() + ' PHASE';
  const t = state.bombPlanted ? state.bombTimer : state.phaseTime;
  ui.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  ui.score.textContent = `Vanguard ${state.score.atk} - ${state.score.def} Bastion`;
  ui.round.textContent = `Round ${state.round} / ${state.maxRounds}`;
  ui.health.textContent = `HP ${Math.max(0, Math.floor(player.hp))}`;
  ui.ammo.textContent = `AMMO ${player.ammo} / ${player.reserve}`;
  ui.stance.textContent = player.crouch ? 'CROUCH' : (player.sprint ? 'SPRINT' : 'STAND');
  ui.gadgetA.textContent = `[G] Breach Charge: ${player.breachCharges}`;
  ui.gadgetB.textContent = `[F] Scout Pulse: ${player.pulseCd <= 0 ? 'Ready' : player.pulseCd.toFixed(1) + 's'}`;
  if (state.phase === 'prep') {
    ui.objective.innerHTML = 'Prep Phase: Drone and set entries before assault begins.';
  } else if (state.bombPlanted) {
    ui.objective.innerHTML = '<span class="warn">Post-Plant: Defend the Rift Charge detonation.</span>';
  } else {
    ui.objective.innerHTML = 'Action Phase: Clear defenders and plant at Vault Nexus.';
  }
}

function shoot(shooter, dir, damage = 34, spread = 0.02) {
  const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
  const shotStart = shooter === player ? weaponMuzzle.getWorldPosition(new THREE.Vector3()) : shooter.mesh.position.clone().setY(1.3);
  raycaster.set(shotStart, d);
  const botMeshes = bots.filter(b => !b.dead && b.team !== (shooter.team || shooter.team === undefined ? shooter.team : player.team)).map(b => b.mesh);
  const hitBot = raycaster.intersectObjects(botMeshes, false)[0];
  const hitDes = raycaster.intersectObjects(destructibles.filter(x => !x.destroyed).map(d => d.mesh), false)[0];
  const nearest = !hitBot ? hitDes : !hitDes ? hitBot : (hitBot.distance < hitDes.distance ? hitBot : hitDes);
  const endPoint = nearest ? nearest.point.clone() : shotStart.clone().addScaledVector(d, 70);
  spawnTrail(shotStart, endPoint, shooter === player);
  if (nearest) {
    const p = nearest.point;
    const s = box(0.12, 0.12, 0.12, 0xfff0a0);
    s.position.copy(p); world.add(s); impacts.push({ mesh: s, t: 0.2 });
    if (hitBot && nearest.object === hitBot.object) {
      const b = bots.find(x => x.mesh === hitBot.object);
      const headshot = p.y > b.mesh.position.y + 1.15;
      b.hp -= damage * (headshot ? 2 : 1);
      if (b.hp <= 0) {
        b.dead = true; b.mesh.visible = false;
        addFeed(`${shooter === player ? 'You' : shooter.role} eliminated ${b.role}`);
      }
    } else if (hitDes) {
      const dObj = destructibles.find(x => x.mesh === hitDes.object);
      dObj.hp -= damage;
      if (dObj.hp <= 0 && !dObj.destroyed) destroyDestructible(dObj);
    }
  }
  beep(180 + Math.random() * 50, 0.04, 'square', 0.02);
}

function spawnTrail(start, end, fromPlayer) {
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len <= 0.001) return;
  const mid = start.clone().addScaledVector(dir, 0.5);
  const trail = box(0.018, 0.018, len, fromPlayer ? 0xffe1a4 : 0xff8f74, {
    emissive: fromPlayer ? 0xff9e30 : 0xcc4028,
    emissiveIntensity: 0.95,
    roughness: 0.22,
    metalness: 0.15
  });
  trail.position.copy(mid);
  trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  world.add(trail);
  trails.push({ mesh: trail, life: 0.08 });
}

function destroyDestructible(d) {
  d.destroyed = true;
  if (d.type === 'glass') {
    d.mesh.material.opacity = 0.05;
    for (let i = 0; i < 12; i++) {
      const shard = box(0.08, 0.08, 0.08, 0x9ad7ff);
      shard.position.copy(d.mesh.position).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 1));
      world.add(shard);
      bullets.push({ mesh: shard, vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), life: 1.2 });
    }
  } else {
    d.mesh.visible = false;
  }
  addFeed(`${d.type.toUpperCase()} breached`);
  beep(90, 0.15, 'sawtooth', 0.05);
}

function placeBreachCharge() {
  if (player.breachCharges <= 0) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, forward);
  const hit = raycaster.intersectObjects(destructibles.filter(d => !d.destroyed && (d.type === 'door' || d.type === 'wall')).map(d => d.mesh))[0];
  if (!hit || hit.distance > 2.2) return;
  player.breachCharges--;
  const charge = box(0.2, 0.2, 0.08, 0xe6bd78);
  charge.position.copy(hit.point).add(hit.face.normal.clone().multiplyScalar(0.05));
  world.add(charge);
  gadgets.push({ type: 'charge', mesh: charge, target: destructibles.find(d => d.mesh === hit.object), timer: 1.5 });
  addFeed('Breach charge armed');
  beep(800, 0.07, 'triangle', 0.03);
}

function pulseScan() {
  if (player.pulseCd > 0) return;
  player.pulseCd = 12;
  bots.filter(b => !b.dead && b.team === 'def' && b.mesh.position.distanceTo(player.pos) < 12).forEach(b => {
    b.mesh.material.emissive = new THREE.Color(0xff0033);
    b.mesh.material.emissiveIntensity = 1.3;
    setTimeout(() => { if (!b.dead) b.mesh.material.emissiveIntensity = 0; }, 1000);
  });
  addPing(player.pos.clone().add(new THREE.Vector3(0, 0.2, -2)), 'atk');
  addFeed('Scout Pulse emitted');
  beep(1200, 0.08, 'sine', 0.03);
}

function addPing(pos, team) {
  if (jammersAffect(pos, team)) return;
  const m = box(0.16, 0.16, 0.16, team === 'atk' ? 0x6fb4ff : 0xff7a7a);
  m.position.copy(pos);
  world.add(m);
  pings.push({ mesh: m, time: 4, team });
}

function jammersAffect(pos, team) {
  return gadgets.some(g => g.type === 'jammer' && g.team !== team && g.mesh.position.distanceTo(pos) < 4.2);
}

function deployDrone(toggle = true) {
  if (!toggle) { player.droneActive = false; return; }
  player.droneActive = !player.droneActive;
  if (player.droneActive) {
    if (!player.droneMesh) {
      player.droneMesh = box(0.3, 0.12, 0.3, 0xa0d6ff);
      player.droneMesh.position.copy(player.pos).add(new THREE.Vector3(0, -1.4, 0));
      world.add(player.droneMesh);
    }
    addFeed('Drone feed online');
  } else addFeed('Drone feed closed');
}

function cycleCams() {
  player.camMode = !player.camMode;
  if (!player.camMode) return;
  const cams = gadgets.filter(g => g.type === 'cctv');
  if (!cams.length) return;
  player.camIndex = ((player.camIndex ?? -1) + 1) % cams.length;
  const c = cams[player.camIndex];
  camera.position.copy(c.pos);
  camera.lookAt(state.objectivePos);
}

function plantOrDefuse(dt) {
  const near = player.pos.distanceTo(state.objectivePos) < 2.2;
  if (!near) { player.plantProg = 0; player.defProg = 0; return; }
  if (player.team === 'atk' && state.phase === 'action' && !state.bombPlanted && input.keys['KeyX']) {
    player.plantProg = (player.plantProg || 0) + dt;
    if (player.plantProg > 3) {
      state.bombPlanted = true; state.bombTimer = state.phaseConfig.postPlant; player.plantProg = 0;
      addFeed('Rift Charge planted'); beep(70, 0.2, 'square', 0.08);
    }
  }
  if (player.team === 'def' && state.bombPlanted && input.keys['KeyX']) {
    player.defProg = (player.defProg || 0) + dt;
    if (player.defProg > 4) {
      addFeed('Rift Charge disabled'); endRound('def');
    }
  }
}

function spawnDefGadgets() {
  const t1 = box(0.3, 0.12, 0.3, 0xffb06f);
  t1.position.set(-3.5, 0.06, -8.5); world.add(t1);
  gadgets.push({ type: 'tripwire', team: 'def', mesh: t1, hp: 25 });
  const j = box(0.5, 0.35, 0.5, 0xc783ff);
  j.position.set(2, 0.17, -9); world.add(j);
  gadgets.push({ type: 'jammer', team: 'def', mesh: j, hp: 35 });
}
spawnDefGadgets();

function botThink(bot, dt) {
  if (bot.dead) return;
  if (state.phase === 'prep' && !state.bombPlanted) {
    const prepHold = bot.team === 'atk' ? new THREE.Vector3(-11.5, 1, 10.5) : new THREE.Vector3(10.5, 1, -10.5);
    const drift = prepHold.clone().add(new THREE.Vector3((bot.mesh.id % 3) * 1.1, 0, (bot.mesh.id % 2) * 0.8));
    const settle = drift.sub(bot.mesh.position);
    settle.y = 0;
    if (settle.lengthSq() > 0.08) bot.mesh.position.addScaledVector(settle.normalize(), dt * 1.25);
    bot.shootTimer = 0;
    bot.alert = Math.max(0, bot.alert - dt);
    return;
  }

  bot.gadgetCd -= dt;
  const enemy = bot.team === 'atk' ? [...bots.filter(b => b.team === 'def' && !b.dead), ...(player.team === 'def' && player.alive ? [player] : [])] : [...bots.filter(b => b.team === 'atk' && !b.dead), ...(player.team === 'atk' && player.alive ? [player] : [])];
  const myPos = bot.mesh.position;
  const visible = enemy.find(e => (e.mesh ? e.mesh.position : e.pos).distanceTo(myPos) < 9);
  if (visible) { bot.alert = 2.5; bot.pingTarget = (visible.mesh ? visible.mesh.position : visible.pos).clone(); }
  bot.alert -= dt;

  if (bot.hp < 30) bot.retreat = true;
  if (bot.retreat && bot.hp > 55) bot.retreat = false;

  if ((bot.role === 'Intel' || bot.role === 'Support') && bot.gadgetCd <= 0) {
    addPing(myPos.clone(), bot.team);
    bot.gadgetCd = 8 + Math.random() * 4;
  }

  let target = state.objectivePos;
  if (bot.team === 'def' && bot.role === 'Anchor') target = state.objectivePos.clone().add(new THREE.Vector3(Math.sin(performance.now() * 0.001) * 1.5, 0, 1));
  else if (bot.team === 'def' && bot.role === 'Roamer') target = navNodes[(Math.floor(performance.now() * 0.001 + bot.mesh.id) % navNodes.length)];
  else if (bot.team === 'atk' && bot.role === 'Fragger' && bot.pingTarget) target = bot.pingTarget;
  if (bot.retreat) target = bot.team === 'atk' ? new THREE.Vector3(-13, 1, 13) : new THREE.Vector3(13, 1, -13);

  const move = target.clone().sub(myPos); move.y = 0;
  if (move.length() > 0.35) {
    move.normalize();
    myPos.add(move.multiplyScalar((bot.team === 'atk' ? 2.2 : 2) * dt));
  }

  if (visible && Math.random() > bot.reaction) {
    bot.shootTimer -= dt;
    if (bot.shootTimer <= 0) {
      const tPos = visible.mesh ? visible.mesh.position.clone().setY(1.2) : visible.pos.clone();
      shoot(bot, tPos.sub(myPos).normalize(), 22, 0.045);
      bot.shootTimer = 0.18 + Math.random() * 0.35;
      if (visible === player) {
        player.hp -= 15 + Math.random() * 10;
        shakeT = 0.12;
        if (player.hp <= 0 && player.alive) { player.alive = false; addFeed('You were neutralized'); }
      }
    }
  }

  // planter AI
  if (bot.team === 'atk' && bot.role === 'Planter' && state.phase === 'action' && !state.bombPlanted && myPos.distanceTo(state.objectivePos) < 1.8) {
    bot.plant = (bot.plant || 0) + dt;
    if (bot.plant > 3) {
      state.bombPlanted = true; state.bombTimer = state.phaseConfig.postPlant;
      addFeed('Enemy planter armed Rift Charge');
    }
  }

  // tripwire check
  gadgets.filter(g => g.type === 'tripwire').forEach(t => {
    if (t.mesh.position.distanceTo(myPos) < 0.7 && bot.team === 'atk') {
      bot.hp -= 18; t.mesh.visible = false; t.type = 'spent';
      myPos.add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
    }
  });

  if (bot.hp <= 0) { bot.dead = true; bot.mesh.visible = false; }
}

function endRound(winner) {
  if (state.gameOver) return;
  state.score[winner]++;
  addFeed(`${winner === 'atk' ? 'Vanguard' : 'Bastion'} takes round ${state.round}`);
  ui.scoreboard.classList.remove('hidden');
  const rows = [player, ...bots].map(e => {
    const isP = e === player;
    return `<tr><td>${isP ? 'You' : e.role}</td><td>${isP ? player.team : e.team}</td><td>${Math.max(0, Math.floor(e.hp))}</td><td>${(isP ? !player.alive : !e.dead) ? 'Down' : 'Alive'}</td></tr>`;
  }).join('');
  ui.scoreboard.innerHTML = `<h2>Round ${state.round} Complete</h2><table><tr><th>Name</th><th>Team</th><th>HP</th><th>Status</th></tr>${rows}</table>`;

  setTimeout(() => {
    ui.scoreboard.classList.add('hidden');
    if (state.score[winner] >= 2 || state.round >= state.maxRounds) {
      state.gameOver = true;
      ui.objective.innerHTML = `<span class="ok">Match complete: ${state.score.atk > state.score.def ? 'Vanguard Victory' : 'Bastion Victory'}</span>`;
      return;
    }
    state.round++;
    resetRound();
  }, 2800);
}

function resetRound() {
  state.phase = 'prep';
  state.phaseTime = state.phaseConfig.prep;
  state.bombPlanted = false;
  state.bombTimer = state.phaseConfig.postPlant;
  player.hp = 100; player.alive = true; player.pos.set(-12, 1.7, 12); player.ammo = 30; player.breachCharges = 2;
  camera.position.copy(player.pos);
  destructibles.forEach(d => { d.destroyed = false; d.mesh.visible = true; d.mesh.material.opacity = d.type === 'glass' ? 0.5 : 1; d.hp = d.type === 'glass' ? 25 : (d.type === 'door' ? 80 : 70); });
  world.children.filter(o => o.userData.temp).forEach(o => world.remove(o));
  spawnTeams();
}

document.body.addEventListener('click', async () => {
  if (document.pointerLockElement !== document.body) document.body.requestPointerLock();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== document.body || player.droneActive || player.camMode) return;
  input.mouseDx += e.movementX;
  input.mouseDy += e.movementY;
});
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyQ') input.lean = -1;
  if (e.code === 'KeyE') input.lean = 1;
  if (e.code === 'Digit5') deployDrone(true);
  if (e.code === 'Digit6') cycleCams();
  if (e.code === 'KeyG') placeBreachCharge();
  if (e.code === 'KeyF') pulseScan();
  if (e.code === 'KeyV') input.melee = true;
  if (e.code === 'KeyR' && player.ammo < 30 && player.reserve > 0) {
    const need = Math.min(30 - player.ammo, player.reserve); player.ammo += need; player.reserve -= need; beep(350, 0.05);
  }
});
window.addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'KeyQ' || e.code === 'KeyE') input.lean = 0;
});
window.addEventListener('mousedown', (e) => { if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

let shootCd = 0;
let footTimer = 0;
let shakeT = 0;
const clock = new THREE.Clock();

function updatePlayer(dt) {
  if (!player.alive || state.gameOver) return;
  weaponRig.visible = !player.droneActive && !player.camMode;

  if (player.camMode) {
    if (input.keys['Space']) player.camMode = false;
    return;
  }

  if (player.droneActive && player.droneMesh) {
    const v = new THREE.Vector3((input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0), 0, (input.keys['KeyS'] ? 1 : 0) - (input.keys['KeyW'] ? 1 : 0));
    if (v.lengthSq()) {
      v.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), player.yaw);
      const next = player.droneMesh.position.clone().addScaledVector(v, dt * 2.2);
      if (!jammersAffect(next, 'atk')) player.droneMesh.position.copy(next);
      camera.position.copy(player.droneMesh.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
      camera.lookAt(player.droneMesh.position.clone().add(v));
    }
    if (input.keys['KeyC']) addPing(player.droneMesh.position.clone(), 'atk');
    return;
  }

  player.yaw -= input.mouseDx * 0.002;
  player.pitch -= input.mouseDy * 0.002;
  input.mouseDx = 0; input.mouseDy = 0;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);

  player.crouch = input.keys['ControlLeft'] || input.keys['ControlRight'];
  player.sprint = !!((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && !player.crouch && !input.ads);
  const walk = input.keys['AltLeft'] || input.keys['AltRight'];

  const speed = player.crouch ? 2.2 : player.sprint ? 5.1 : walk ? 2.5 : input.ads ? 2.8 : 3.8;
  const move = new THREE.Vector3((input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0), 0, (input.keys['KeyS'] ? 1 : 0) - (input.keys['KeyW'] ? 1 : 0));
  if (move.lengthSq()) {
    move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    const next = player.pos.clone().addScaledVector(move, speed * dt);
    const probe = new THREE.Box3().setFromCenterAndSize(next.clone().setY(1), new THREE.Vector3(0.7, 1.8, 0.7));
    if (!colliders.some(c => c.intersectsBox(probe)) && !destructibles.some(d => !d.destroyed && d.bounds.intersectsBox(probe))) {
      player.pos.copy(next);
      footTimer -= dt;
      if (footTimer <= 0) {
        const f = player.crouch ? 140 : player.sprint ? 280 : 200;
        beep(f, 0.03, 'triangle', player.crouch ? 0.007 : 0.013);
        footTimer = player.crouch ? 0.45 : player.sprint ? 0.2 : 0.32;
      }
    }
  }

  camera.fov = THREE.MathUtils.lerp(camera.fov, input.ads ? 56 : 75, dt * 8);
  camera.updateProjectionMatrix();

  const leanOffset = input.lean * (input.ads ? 0.22 : 0.14);
  const shake = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.8 : 0;
  camera.position.copy(player.pos).add(new THREE.Vector3(Math.cos(player.yaw) * leanOffset, player.crouch ? -0.45 : 0, Math.sin(player.yaw) * leanOffset));
  camera.rotation.set(player.pitch + shake, player.yaw, 0);

  const moveSpeed = Math.min(1, move.length() + (player.sprint ? 0.45 : 0.2));
  const bob = Math.sin(performance.now() * (player.sprint ? 0.018 : 0.012)) * 0.008 * moveSpeed;
  const targetGunX = input.ads ? 0.06 : 0.33;
  const targetGunY = input.ads ? -0.2 : -0.29;
  const targetGunZ = input.ads ? -0.24 : -0.45;
  weaponRig.position.x = THREE.MathUtils.lerp(weaponRig.position.x, targetGunX, dt * 11);
  weaponRig.position.y = THREE.MathUtils.lerp(weaponRig.position.y, targetGunY + bob, dt * 11);
  weaponRig.position.z = THREE.MathUtils.lerp(weaponRig.position.z, targetGunZ, dt * 11);
  weaponRig.rotation.y = THREE.MathUtils.lerp(weaponRig.rotation.y, input.ads ? 0 : -0.2, dt * 10);
  weaponRig.rotation.x = THREE.MathUtils.lerp(weaponRig.rotation.x, player.recoil * 4 + bob * 1.8, dt * 12);
  weaponRig.rotation.z = THREE.MathUtils.lerp(weaponRig.rotation.z, input.lean * 0.06, dt * 12);

  shootCd -= dt;
  if (input.fire && shootCd <= 0 && player.ammo > 0) {
    shootCd = input.ads ? 0.14 : 0.11;
    player.ammo--;
    player.recoil = Math.min(0.08, player.recoil + 0.01);
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    shoot(player, dir, 34, (input.ads ? 0.012 : 0.022) + player.recoil);
  }
  player.recoil *= 0.92;

  if (input.melee) {
    const near = destructibles.find(d => !d.destroyed && d.mesh.position.distanceTo(player.pos) < 1.5 && (d.type === 'door' || d.type === 'wall'));
    if (near) { near.hp -= 28; if (near.hp <= 0) destroyDestructible(near); }
    input.melee = false;
  }

  if (input.keys['KeyC']) addPing(player.pos.clone(), player.team);
  plantOrDefuse(dt);
}

function gamepadUpdate() {
  const gp = navigator.getGamepads?.()[0];
  if (!gp) return;
  input.keys['KeyW'] = gp.axes[1] < -0.3;
  input.keys['KeyS'] = gp.axes[1] > 0.3;
  input.keys['KeyA'] = gp.axes[0] < -0.3;
  input.keys['KeyD'] = gp.axes[0] > 0.3;
  input.fire = gp.buttons[7]?.pressed;
  input.ads = gp.buttons[6]?.pressed;
  if (gp.buttons[0]?.pressed) placeBreachCharge();
  input.mouseDx += gp.axes[2] * 5;
  input.mouseDy += gp.axes[3] * 5;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (!state.gameOver) {
    if (!state.bombPlanted) state.phaseTime -= dt;
    else state.bombTimer -= dt;
    if (state.phase === 'prep' && state.phaseTime <= 0) {
      state.phase = 'action';
      state.phaseTime = state.phaseConfig.action;
      addFeed('Action phase live');
    }
    if (state.phase === 'action' && !state.bombPlanted && state.phaseTime <= 0) endRound('def');
    if (state.bombPlanted && state.bombTimer <= 0) endRound('atk');

    if (state.phase === 'action' || state.bombPlanted) {
      if (bots.filter(b => !b.dead && b.team === 'atk').length === 0 && player.team === 'atk') endRound('def');
      if (bots.filter(b => !b.dead && b.team === 'def').length === 0 && player.team === 'atk') endRound('atk');
      if (!player.alive && player.team === 'atk' && bots.filter(b => !b.dead && b.team === 'atk').length === 0) endRound('def');
    }

    player.pulseCd -= dt;
    player.pingCd -= dt;
    shakeT = Math.max(0, shakeT - dt * 2.4);

    gamepadUpdate();
    updatePlayer(dt);
    bots.forEach(b => botThink(b, dt));

    gadgets.forEach(g => {
      if (g.type === 'charge') {
        g.timer -= dt;
        if (g.timer <= 0) {
          destroyDestructible(g.target);
          g.mesh.visible = false; g.type = 'spent';
          shakeT = 0.35;
          for (let i = 0; i < 16; i++) {
            const p = box(0.08, 0.08, 0.08, 0xffc77f);
            p.position.copy(g.mesh.position); world.add(p);
            bullets.push({ mesh: p, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.7 });
          }
          beep(60, 0.22, 'sawtooth', 0.09);
        }
      }
    });

    pings.forEach(p => {
      p.time -= dt;
      p.mesh.position.y += Math.sin(performance.now() * 0.01) * 0.002;
      if (p.time <= 0) p.mesh.visible = false;
    });
    for (let i = pings.length - 1; i >= 0; i--) if (pings[i].time <= 0) pings.splice(i, 1);

    impacts.forEach(i => { i.t -= dt; i.mesh.scale.multiplyScalar(0.9); if (i.t <= 0) i.mesh.visible = false; });
    for (let i = impacts.length - 1; i >= 0; i--) if (impacts[i].t <= 0) impacts.splice(i, 1);

    bullets.forEach(b => { b.life -= dt; b.vel.y -= dt * 5; b.mesh.position.addScaledVector(b.vel, dt); if (b.life <= 0) b.mesh.visible = false; });
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);

    trails.forEach(t => {
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.08);
      t.mesh.material.transparent = true;
      if (t.life <= 0) t.mesh.visible = false;
    });
    for (let i = trails.length - 1; i >= 0; i--) if (trails[i].life <= 0) trails.splice(i, 1);
  }

  flickerLights.forEach((l, i) => {
    l.intensity = 0.65 + Math.sin(performance.now() * 0.003 + i * 2) * 0.16 + Math.random() * 0.05;
  });
  if (damageVignette) damageVignette.style.opacity = (0.45 + (1 - Math.max(0, player.hp) / 100) * 0.35).toFixed(2);

  updateUI();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
