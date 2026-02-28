import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.setClearColor(0x7eb6ff);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fc7ff, 28, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 180);
scene.add(camera);
const world = new THREE.Group();
scene.add(world);

const ui = {
  phase: document.getElementById('phase'),
  timer: document.getElementById('timer'),
  score: document.getElementById('score'),
  round: document.getElementById('round'),
  aliveCount: document.getElementById('aliveCount'),
  compassBar: document.getElementById('compassBar'),
  health: document.getElementById('health'),
  ammo: document.getElementById('ammo'),
  stance: document.getElementById('stance'),
  objective: document.getElementById('objective'),
  gadgetA: document.getElementById('gadgetA'),
  gadgetB: document.getElementById('gadgetB'),
  feed: document.getElementById('feed'),
  deathBanner: document.getElementById('deathBanner'),
  scoreboard: document.getElementById('scoreboard'),
  teamRole: document.getElementById('teamRole'),
  operatorPlate: document.getElementById('operatorPlate'),
  hint: document.getElementById('hint'),
  mobileControls: document.getElementById('mobileControls'),
  movePad: document.getElementById('movePad'),
  moveStick: document.getElementById('moveStick'),
  lookPad: document.getElementById('lookPad'),
  btnFire: document.getElementById('btnFire'),
  btnAds: document.getElementById('btnAds'),
  btnSprint: document.getElementById('btnSprint'),
  btnCrouch: document.getElementById('btnCrouch'),
  btnWalk: document.getElementById('btnWalk'),
  btnLeanL: document.getElementById('btnLeanL'),
  btnLeanR: document.getElementById('btnLeanR'),
  btnReload: document.getElementById('btnReload'),
  btnGadgetA: document.getElementById('btnGadgetA'),
  btnGadgetB: document.getElementById('btnGadgetB'),
  btnMelee: document.getElementById('btnMelee'),
  btnDrone: document.getElementById('btnDrone'),
  btnCams: document.getElementById('btnCams'),
  btnPing: document.getElementById('btnPing')
};

const ambient = new THREE.HemisphereLight(0xd7ebff, 0x6f8aa9, 1.42);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xfff1d4, 2.8);
keyLight.position.set(8, 16, 4);
keyLight.castShadow = true;
scene.add(keyLight);
const bounceLight = new THREE.PointLight(0x9cc7ff, 32, 62, 2);
bounceLight.position.set(0, 6, 2);
scene.add(bounceLight);
const sunFill = new THREE.DirectionalLight(0xffd9a6, 1.6);
sunFill.position.set(-10, 12, -6);
scene.add(sunFill);

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#87c7ff');
  grad.addColorStop(0.45, '#b2ddff');
  grad.addColorStop(1, '#f4dcb0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  return new THREE.CanvasTexture(c);
}

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(160, 32, 24),
  new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
);
scene.add(skyDome);

const state = {
  phase: 'prep',
  phaseTime: 10,
  phaseConfig: { prep: 10, action: 165, postPlant: 45 },
  round: 1,
  maxRounds: 3,
  score: { atk: 0, def: 0 },
  bombPlanted: false,
  bombTimer: 45,
  bombCarrier: null,
  bombDropped: false,
  bombDropPos: new THREE.Vector3(),
  gameOver: false,
  objectivePos: new THREE.Vector3(0.2, 0, -11.2),
  atkObjectiveKnown: false
};

const input = { keys: {}, mouseDx: 0, mouseDy: 0, ads: false, fire: false, lean: 0, melee: false };
const raycaster = new THREE.Raycaster();

const mobile = {
  enabled: window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  movePointerId: null,
  lookPointerId: null,
  lookLastX: 0,
  lookLastY: 0,
  moveX: 0,
  moveY: 0,
  sprint: false,
  crouch: false,
  walk: false,
  ads: false,
  fire: false,
  lean: 0
};

function setupMobileControls() {
  if (!mobile.enabled || !ui.mobileControls) return;
  ui.mobileControls.classList.remove('hidden');
  ui.mobileControls.setAttribute('aria-hidden', 'false');
  if (ui.hint) ui.hint.textContent = 'Mobile: left pad move · right look area aim · touch buttons for all actions';

  const setStick = (x, y) => {
    ui.moveStick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  ui.movePad.addEventListener('pointerdown', (e) => {
    mobile.movePointerId = e.pointerId;
    ui.movePad.setPointerCapture(e.pointerId);
  });

  ui.movePad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== mobile.movePointerId) return;
    const rect = ui.movePad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width * 0.36;
    const len = Math.hypot(dx, dy);
    const scale = len > radius ? radius / len : 1;
    const clampedX = dx * scale;
    const clampedY = dy * scale;
    mobile.moveX = clampedX / radius;
    mobile.moveY = clampedY / radius;
    setStick(clampedX, clampedY);
  });

  const resetMove = (e) => {
    if (e.pointerId !== mobile.movePointerId) return;
    mobile.movePointerId = null;
    mobile.moveX = 0;
    mobile.moveY = 0;
    setStick(0, 0);
  };
  ui.movePad.addEventListener('pointerup', resetMove);
  ui.movePad.addEventListener('pointercancel', resetMove);

  ui.lookPad.addEventListener('pointerdown', (e) => {
    mobile.lookPointerId = e.pointerId;
    mobile.lookLastX = e.clientX;
    mobile.lookLastY = e.clientY;
    ui.lookPad.setPointerCapture(e.pointerId);
  });
  ui.lookPad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== mobile.lookPointerId) return;
    const dx = e.clientX - mobile.lookLastX;
    const dy = e.clientY - mobile.lookLastY;
    mobile.lookLastX = e.clientX;
    mobile.lookLastY = e.clientY;
    input.mouseDx += dx * 1.8;
    input.mouseDy += dy * 1.8;
  });
  const resetLook = (e) => {
    if (e.pointerId !== mobile.lookPointerId) return;
    mobile.lookPointerId = null;
  };
  ui.lookPad.addEventListener('pointerup', resetLook);
  ui.lookPad.addEventListener('pointercancel', resetLook);

  const bindHold = (el, setter) => {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      setter(true);
      el.classList.add('active');
    });
    const off = () => {
      setter(false);
      el.classList.remove('active');
    };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  };

  bindHold(ui.btnFire, (v) => { mobile.fire = v; });
  bindHold(ui.btnAds, (v) => { mobile.ads = v; });
  bindHold(ui.btnSprint, (v) => { mobile.sprint = v; });

  const bindTap = (el, fn) => {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 120);
    });
  };

  bindTap(ui.btnCrouch, () => {
    mobile.crouch = !mobile.crouch;
    ui.btnCrouch.classList.toggle('active', mobile.crouch);
  });
  bindTap(ui.btnWalk, () => {
    mobile.walk = !mobile.walk;
    ui.btnWalk.classList.toggle('active', mobile.walk);
  });

  bindHold(ui.btnLeanL, (v) => {
    if (v) mobile.lean = -1;
    else if (mobile.lean === -1) mobile.lean = 0;
  });
  bindHold(ui.btnLeanR, (v) => {
    if (v) mobile.lean = 1;
    else if (mobile.lean === 1) mobile.lean = 0;
  });

  bindTap(ui.btnReload, () => {
    if (player.ammo < 30 && player.reserve > 0) {
      const need = Math.min(30 - player.ammo, player.reserve);
      player.ammo += need;
      player.reserve -= need;
      beep(350, 0.05);
    }
  });
  bindTap(ui.btnGadgetA, () => placeBreachCharge());
  bindTap(ui.btnGadgetB, () => pulseScan());
  bindTap(ui.btnMelee, () => { input.melee = true; });
  bindTap(ui.btnDrone, () => deployDrone(true));
  bindTap(ui.btnCams, () => { if (!(state.phase === 'prep' && player.team === 'atk')) cycleCams(); });
  bindTap(ui.btnPing, () => addPing((player.droneActive && player.droneMesh) ? player.droneMesh.position.clone() : player.pos.clone(), player.team));
}

function applyMobileInput() {
  if (!mobile.enabled) return;
  const dead = 0.18;
  input.keys['KeyA'] = mobile.moveX < -dead;
  input.keys['KeyD'] = mobile.moveX > dead;
  input.keys['KeyW'] = mobile.moveY < -dead;
  input.keys['KeyS'] = mobile.moveY > dead;
  input.keys['ShiftLeft'] = mobile.sprint;
  input.keys['ControlLeft'] = mobile.crouch;
  input.keys['AltLeft'] = mobile.walk;
  input.fire = mobile.fire;
  input.ads = mobile.ads;
  input.lean = mobile.lean;
}


const colliders = [];
const destructibles = [];
const bots = [];
const gadgets = [];
const pings = [];
const impacts = [];
const bullets = [];
const trails = [];
const teammateOutlines = [];
const visionOccluders = [];
const doorways = [];
const noiseEvents = [];
const rainDrops = [];
let bombCarryMesh;
let bombDropCore;
let bombDropRing;
const breachSignals = [];
let objectiveIntelMesh;
let objectiveIntelPulse;
const tacticalFxMeshes = [];

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

  const opticLens = box(0.06, 0.045, 0.02, 0x8dc8ff, { roughness: 0.05, metalness: 0.92, emissive: 0x1b7ac2, emissiveIntensity: 0.28 });
  opticLens.position.set(0, 0.11, -0.45);
  opticLens.material.transparent = true;
  opticLens.material.opacity = 0.78;
  gunRoot.add(opticLens);

  const grip = box(0.08, 0.26, 0.12, 0x2f3642, { roughness: 0.66, metalness: 0.42 });
  grip.rotation.x = -0.25;
  grip.position.set(-0.01, -0.14, -0.21);
  gunRoot.add(grip);

  const mag = box(0.09, 0.22, 0.13, 0x262d38, { roughness: 0.38, metalness: 0.78 });
  mag.rotation.x = -0.14;
  mag.position.set(0, -0.16, -0.34);
  gunRoot.add(mag);

  const foregrip = box(0.06, 0.18, 0.09, 0x2a313c, { roughness: 0.4, metalness: 0.62 });
  foregrip.position.set(-0.02, -0.12, -0.62);
  gunRoot.add(foregrip);

  const topRail = box(0.04, 0.02, 0.52, 0x2d3644, { roughness: 0.25, metalness: 0.82 });
  topRail.position.set(0, 0.09, -0.47);
  gunRoot.add(topRail);

  const accentStripe = box(0.018, 0.018, 0.5, 0x77d7ff, {
    roughness: 0.2,
    metalness: 0.65,
    emissive: 0x2a9ed3,
    emissiveIntensity: 0.6
  });
  accentStripe.position.set(0.05, 0.05, -0.44);
  gunRoot.add(accentStripe);

  const leftGlove = box(0.11, 0.12, 0.18, 0x161b24, { roughness: 0.8, metalness: 0.15 });
  leftGlove.position.set(-0.14, -0.1, -0.58);
  leftGlove.rotation.z = 0.2;
  gunRoot.add(leftGlove);

  const rightGlove = box(0.11, 0.13, 0.17, 0x1a1f2b, { roughness: 0.78, metalness: 0.12 });
  rightGlove.position.set(0.08, -0.13, -0.2);
  rightGlove.rotation.z = -0.25;
  gunRoot.add(rightGlove);

  const wristScreen = box(0.05, 0.03, 0.04, 0x8ee9ff, { roughness: 0.1, metalness: 0.55, emissive: 0x43c6ff, emissiveIntensity: 0.9 });
  wristScreen.position.set(0.06, -0.07, -0.28);
  gunRoot.add(wristScreen);

  weaponMuzzle.position.set(0, 0.004, -1.17);
  gunRoot.add(weaponMuzzle);

  weaponRig.add(gunRoot);
  weaponRig.position.set(0.33, -0.29, -0.45);
  camera.add(weaponRig);
}
buildWeaponViewModel();

function buildBotWeapon(team = 'atk') {
  const gunRoot = new THREE.Group();
  const tint = team === 'atk' ? 0x3a4e6d : 0x694040;
  const body = box(0.11, 0.09, 0.46, tint, { roughness: 0.38, metalness: 0.74 });
  body.position.set(0, 0.02, -0.22);
  gunRoot.add(body);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x10151e, roughness: 0.3, metalness: 0.95 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.5);
  gunRoot.add(barrel);

  const stock = box(0.09, 0.09, 0.15, 0x262d36, { roughness: 0.45, metalness: 0.65 });
  stock.position.set(0, 0.01, 0.03);
  gunRoot.add(stock);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.015, -0.67);
  gunRoot.add(muzzle);
  return { gunRoot, muzzle };
}

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

const teamSpawns = {
  atk: [
    new THREE.Vector3(-17.8, 1, 13.7),
    new THREE.Vector3(-16.8, 1, 8.8),
    new THREE.Vector3(1.6, 1, 17.3),
    new THREE.Vector3(17.2, 1, -13.8)
  ],
  def: [
    new THREE.Vector3(-1.2, 1, -11.2),
    new THREE.Vector3(0.9, 1, -10.3),
    new THREE.Vector3(2.1, 1, -12.2),
    new THREE.Vector3(-2.4, 1, -9.8)
  ]
};

function findSafeGroundPosition(origin, opts = {}) {
  const radius = opts.radius ?? 1.4;
  const maxTries = opts.maxTries ?? 16;
  const outsideOnly = !!opts.outsideOnly;
  const candidate = origin.clone();
  for (let i = 0; i < maxTries; i++) {
    const offset = i === 0
      ? new THREE.Vector3()
      : new THREE.Vector3((Math.random() - 0.5) * radius * 2, 0, (Math.random() - 0.5) * radius * 2);
    candidate.copy(origin).add(offset).setY(1);
    const probe = new THREE.Box3().setFromCenterAndSize(candidate, new THREE.Vector3(0.8, 1.8, 0.8));
    const blocked = isBlockedProbe(probe);
    if (blocked) continue;
    if (outsideOnly && isInsideBuilding(candidate)) continue;
    return candidate.clone();
  }
  return origin.clone();
}

const prepSpots = {
  atk: [
    new THREE.Vector3(-15.2, 1, 7),
    new THREE.Vector3(0.8, 1, 15),
    new THREE.Vector3(14.2, 1, -11.1),
    new THREE.Vector3(-14.4, 1, 5.7)
  ],
  def: [
    new THREE.Vector3(-2.4, 1, -10.8),
    new THREE.Vector3(1.9, 1, -11.8),
    new THREE.Vector3(0.4, 1, -9.5),
    new THREE.Vector3(2.8, 1, -10.2)
  ]
};

const defenderSetupSpots = {
  tripwire: [
    new THREE.Vector3(-3.6, 0.06, -8.2),
    new THREE.Vector3(2.4, 0.06, -9.4),
    new THREE.Vector3(-0.2, 0.06, -6.9)
  ],
  jammer: [
    new THREE.Vector3(2, 0.17, -9),
    new THREE.Vector3(-2.6, 0.17, -11.4)
  ]
};

const attackerDroneRoutes = [
  [new THREE.Vector3(-11.2, 0.06, 9.8), new THREE.Vector3(-8.8, 0.06, 2.2), new THREE.Vector3(-6.1, 0.06, -6.4), new THREE.Vector3(-1.4, 0.06, -10.4)],
  [new THREE.Vector3(7.4, 0.06, 11.8), new THREE.Vector3(8.6, 0.06, 4.2), new THREE.Vector3(5.6, 0.06, -3.2), new THREE.Vector3(1.2, 0.06, -10.8)],
  [new THREE.Vector3(13.2, 0.06, -4.8), new THREE.Vector3(9.6, 0.06, -8.8), new THREE.Vector3(4.2, 0.06, -10.2), new THREE.Vector3(0.8, 0.06, -11.4)],
  [new THREE.Vector3(-12.8, 0.06, -2.4), new THREE.Vector3(-7.2, 0.06, -8.6), new THREE.Vector3(-2.8, 0.06, -11.2), new THREE.Vector3(0.4, 0.06, -11.1)]
];

const defenderHoldPoints = {
  Anchor: [new THREE.Vector3(-1.5, 1, -11.8), new THREE.Vector3(1.7, 1, -11.1)],
  Roamer: [new THREE.Vector3(-8.5, 1, -0.5), new THREE.Vector3(7.1, 1, -1.8), new THREE.Vector3(3.2, 1, 6.8)],
  Intel: [new THREE.Vector3(1.8, 1, -9.4), new THREE.Vector3(-2.2, 1, -9.9)],
  Denier: [new THREE.Vector3(2.8, 1, -10.4), new THREE.Vector3(-3.2, 1, -10.7)]
};

const attackerExecuteOffsets = {
  Planter: new THREE.Vector3(0, 0, 0.4),
  Entry: new THREE.Vector3(-2.6, 0, 1.6),
  Fragger: new THREE.Vector3(2.7, 0, 2.1),
  Support: new THREE.Vector3(0, 0, 3.6)
};

const OPERATOR_ROSTERS = {
  atk: [
    { codename: 'Wraith', role: 'Entry', ability: 'shockBreach', abilityLabel: 'Shock Breach', accent: 0x7be084, helmet: 0x4e7359, visor: 0x9fffb6, emblem: 0x7cf8b2 },
    { codename: 'Atlas', role: 'Planter', ability: 'hardBreach', abilityLabel: 'Hard Breach', accent: 0xe2bd62, helmet: 0x546580, visor: 0x6fd8ff, emblem: 0xf6cc74 },
    { codename: 'Specter', role: 'Fragger', ability: 'scannerPulse', abilityLabel: 'Hunter Pulse', accent: 0xd86d5c, helmet: 0x6e4f5c, visor: 0xff9a82, emblem: 0xff9474 },
    { codename: 'Relay', role: 'Support', ability: 'intelPing', abilityLabel: 'Data Ping', accent: 0x62a3e2, helmet: 0x4d6788, visor: 0x8fe9ff, emblem: 0x74d0ff }
  ],
  def: [
    { codename: 'Bulwark', role: 'Anchor', ability: 'armorTrap', abilityLabel: 'Razor Trap', accent: 0xbf7bff, helmet: 0x6e4b7e, visor: 0xd5a5ff, emblem: 0xd29dff },
    { codename: 'Ghost', role: 'Roamer', ability: 'ambushMine', abilityLabel: 'Ambush Mine', accent: 0xff8f73, helmet: 0x774949, visor: 0xffb7a1, emblem: 0xffaa8d },
    { codename: 'Oracle', role: 'Intel', ability: 'jamBurst', abilityLabel: 'Jam Burst', accent: 0x69d7ff, helmet: 0x466f86, visor: 0x9feaff, emblem: 0x7bdfff },
    { codename: 'Doc-7', role: 'Denier', ability: 'medStim', abilityLabel: 'Stim Heal', accent: 0xffd26d, helmet: 0x7c653f, visor: 0xffed9f, emblem: 0xffdf8f }
  ]
};

const operatorDesigns = Object.fromEntries(
  Object.values(OPERATOR_ROSTERS)
    .flat()
    .map((op) => [op.role, op])
);

const defenderPatrolPoints = [
  new THREE.Vector3(-9.8, 1, -4.8),
  new THREE.Vector3(8.7, 1, -3.6),
  new THREE.Vector3(-7.4, 1, 6.2),
  new THREE.Vector3(7.9, 1, 6.6),
  new THREE.Vector3(-1.2, 1, 0.8)
];

const roomClearCorners = [
  new THREE.Vector3(-3.2, 1, -8.6),
  new THREE.Vector3(3.1, 1, -8.5),
  new THREE.Vector3(-3.1, 1, -13.4),
  new THREE.Vector3(3.2, 1, -13.5),
  new THREE.Vector3(-6.8, 1, -8.6),
  new THREE.Vector3(6.9, 1, -8.5)
];

function isInsideBuilding(pos) {
  return Math.abs(pos.x) < 14.3 && Math.abs(pos.z) < 14.3;
}

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

function botTaskToCallout(task, bot, target) {
  const area = target ? getAreaNameFromPos(target).toUpperCase() : 'CURRENT POSITION';
  const map = {
    breach: `breaching ${area}`,
    clear: `clearing ${area}`,
    flank: `flanking through ${area}`,
    fallback: `falling back to ${area}`,
    hold: `holding ${area}`,
    patrol: `patrolling ${area}`,
    rotate: `rotating to ${area}`,
    plant: `planting at ${area}`,
    pinch: `pinching from ${area}`,
    contest: `contesting ${area}`,
    investigate: `investigating ${area}`,
    hunt: `hunting near ${area}`,
    retake: `retaking ${area}`,
    reposition: `repositioning ${area}`
  };
  return `${bot.codename}: ${map[task] || `moving to ${area}`}`;
}

function announceBotIntent(bot, task, target) {
  const now = performance.now() * 0.001;
  const sameTask = bot.lastTaskCallout === task;
  const closeTarget = bot.lastTaskTarget && target ? bot.lastTaskTarget.distanceTo(target) < 1.5 : false;
  if (bot.nextTaskCalloutAt && now < bot.nextTaskCalloutAt && sameTask && closeTarget) return;
  addFeed(botTaskToCallout(task, bot, target));
  bot.lastTaskCallout = task;
  bot.lastTaskTarget = target ? target.clone() : null;
  bot.nextTaskCalloutAt = now + 5.2 + Math.random() * 1.8;
}

function makeNameplate(text, color = '#aee0ff') {
  const plate = document.createElement('canvas');
  plate.width = 320;
  plate.height = 96;
  const ctx = plate.getContext('2d');
  ctx.fillStyle = 'rgba(4, 12, 24, 0.72)';
  ctx.fillRect(0, 16, 320, 56);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 22, 308, 44);
  ctx.fillStyle = color;
  ctx.font = '600 28px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(text, 160, 54);
  const tex = new THREE.CanvasTexture(plate);
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.7, 0.48, 1);
  sprite.renderOrder = 30;
  return sprite;
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

function addStaticCollider(mesh) {
  colliders.push(new THREE.Box3().setFromObject(mesh));
  visionOccluders.push(mesh);
}

function addDoorway(center, size) {
  doorways.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...center), new THREE.Vector3(...size)));
}

function isBlockedProbe(probe) {
  const inDoorway = doorways.some((doorway) => doorway.intersectsBox(probe));
  return colliders.some((c) => c.intersectsBox(probe) && !inDoorway)
    || destructibles.some((d) => !d.destroyed && d.bounds.intersectsBox(probe));
}

function isBlockedPoint(point) {
  const inDoorway = doorways.some((doorway) => doorway.containsPoint(point));
  return colliders.some((c) => c.containsPoint(point) && !inDoorway)
    || destructibles.some((d) => !d.destroyed && d.bounds.containsPoint(point));
}

function makeMap() {
  const floorTex = makeNoiseTexture('#68809b', '#4a6078');
  const wallTex = makeNoiseTexture('#d4bea2', '#9daec2');
  const concreteTex = makeNoiseTexture('#3f4752', '#323943');
  const trimTex = makeNoiseTexture('#5c6d80', '#3f4f62');

  const floor = box(30, 0.2, 30, 0x6c8298, { map: floorTex, roughness: 0.66, metalness: 0.2 });
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  world.add(floor);

  const exteriorApron = box(58, 0.16, 58, 0x33424f, { roughness: 0.9, metalness: 0.06, emissive: 0x132534, emissiveIntensity: 0.16 });
  exteriorApron.position.y = -0.18;
  world.add(exteriorApron);

  const perimeterLane = new THREE.Mesh(
    new THREE.RingGeometry(20, 27, 52),
    new THREE.MeshStandardMaterial({ color: 0x3a4b5f, roughness: 0.84, metalness: 0.08, emissive: 0x1c2f45, emissiveIntensity: 0.16, side: THREE.DoubleSide })
  );
  perimeterLane.rotation.x = -Math.PI / 2;
  perimeterLane.position.y = -0.09;
  world.add(perimeterLane);

  const ceiling = box(30, 0.3, 30, 0x71859b, { map: trimTex, roughness: 0.88, metalness: 0.2 });
  ceiling.position.y = 4;
  world.add(ceiling);

  const walls = [
    [0, 1.5, 15, 30, 3, 0.4],
    [-11, 1.5, -15, 8, 3, 0.4], [-0.6, 1.5, -15, 10.8, 3, 0.4], [10.8, 1.5, -15, 8.4, 3, 0.4],
    [15, 1.5, 9.2, 0.4, 3, 11.2], [15, 1.5, -2.6, 0.4, 3, 9.2], [15, 1.5, -14, 0.4, 3, 1.8],
    [-15, 1.5, 9.2, 0.4, 3, 11.2], [-15, 1.5, -5.8, 0.4, 3, 16.2],
    [-7.4, 1.5, 9.6, 6.2, 3, 0.4], [0.6, 1.5, 9.6, 7.2, 3, 0.4], [9.1, 1.5, 9.6, 4.8, 3, 0.4],
    [-11.2, 1.5, 5.6, 7.2, 3, 0.4], [7.5, 1.5, 6.4, 15, 3, 0.4],
    [-7.2, 1.5, 6.8, 0.4, 3, 5.8], [-7.2, 1.5, -1.4, 0.4, 3, 6.8], [-7.2, 1.5, -8.8, 0.4, 3, 5.6],
    [6.6, 1.5, 5.9, 0.4, 3, 5.4], [6.6, 1.5, -1.8, 0.4, 3, 5.8], [6.6, 1.5, -8.6, 0.4, 3, 5.6],
    [0, 1.5, -3.8, 10, 3, 0.4], [-5, 1.5, -9.7, 6.6, 3, 0.4], [5.2, 1.5, -9.7, 6.2, 3, 0.4],
    [-3.8, 1.5, -7.1, 0.4, 3, 5.6], [4.8, 1.5, -12, 0.4, 3, 6],
    [10.5, 1.5, -2, 9, 3, 0.4], [-11.3, 1.5, -1.8, 7.4, 3, 0.4]
  ];
  const wallPalette = [0xb6c9d9, 0xb8cdbf, 0xd5be9f, 0xc4b7d6];
  walls.forEach(([x, y, z, w, h, d], i) => {
    const m = box(w, h, d, wallPalette[i % wallPalette.length], { map: wallTex, roughness: 0.76, metalness: 0.1 });
    m.position.set(x, y, z);
    m.castShadow = true;
    world.add(m);
    addStaticCollider(m);
  });


  const doorwayDefs = [
    { center: [-3.3, 1, 9.6], size: [1.8, 2.2, 1.2] },
    { center: [4.8, 1, 9.6], size: [1.8, 2.2, 1.2] },
    { center: [-7.2, 1, 2.8], size: [1.2, 2.2, 1.8] },
    { center: [-7.2, 1, -5.2], size: [1.2, 2.2, 1.8] },
    { center: [6.6, 1, 2.1], size: [1.2, 2.2, 1.8] },
    { center: [6.6, 1, -5.3], size: [1.2, 2.2, 1.8] },
    { center: [0.1, 1, -9.7], size: [2, 2.2, 1.2] }
  ];
  doorwayDefs.forEach(({ center, size }) => addDoorway(center, size));

  const bombRoomFloor = box(7.4, 0.12, 7.4, 0x3f5672, { emissive: 0x153052, emissiveIntensity: 0.42, metalness: 0.28, roughness: 0.44 });
  bombRoomFloor.position.set(0.2, 0.03, -11.2);
  world.add(bombRoomFloor);

  const siteRing = box(8.2, 0.04, 8.2, 0x16273b, { emissive: 0x39a5ff, emissiveIntensity: 0.3, roughness: 0.6 });
  siteRing.position.set(0.2, 0.07, -11.2);
  world.add(siteRing);

  const bombCrate = box(1.8, 1.4, 1.4, 0x6a4f34, { roughness: 0.72, metalness: 0.2 });
  bombCrate.position.set(0.2, 0.7, -11.2);
  world.add(bombCrate);
  addStaticCollider(bombCrate);

  objectiveIntelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: 0x7de6ff, emissive: 0x1e9ad3, emissiveIntensity: 1.2, transparent: true, opacity: 0.65 })
  );
  objectiveIntelMesh.position.set(0.2, 0.12, -11.2);
  objectiveIntelMesh.material.depthTest = false;
  objectiveIntelMesh.renderOrder = 30;
  objectiveIntelMesh.visible = false;
  world.add(objectiveIntelMesh);

  objectiveIntelPulse = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.08, 12, 34),
    new THREE.MeshStandardMaterial({ color: 0x9de8ff, emissive: 0x2dbdff, emissiveIntensity: 1.1, transparent: true, opacity: 0.6 })
  );
  objectiveIntelPulse.position.set(0.2, 1.55, -11.2);
  objectiveIntelPulse.rotation.x = Math.PI / 2;
  objectiveIntelPulse.material.depthTest = false;
  objectiveIntelPulse.renderOrder = 30;
  objectiveIntelPulse.visible = false;
  world.add(objectiveIntelPulse);

  const bombRack = box(4.8, 2.2, 1.1, 0x222d3b, { map: trimTex, roughness: 0.52, metalness: 0.55 });
  bombRack.position.set(-4.2, 1.1, -11.5);
  world.add(bombRack);
  addStaticCollider(bombRack);

  const lockers = [[8.6, -11.1], [8.6, -9.7], [8.6, -8.3], [8.6, -6.9], [-12.2, 7.8], [-10.8, 7.8], [-9.4, 7.8]];
  lockers.forEach(([x, z], i) => {
    const locker = box(0.92, 2.2, 0.9, i < 4 ? 0x3d4956 : 0x4c3f34, { roughness: 0.68, metalness: 0.3 });
    locker.position.set(x, 1.1, z);
    world.add(locker);
    addStaticCollider(locker);
  });

  const coverSpots = [
    [-12, 0.65, 10.5], [-9.5, 0.65, 10.1], [-6.8, 0.65, 10.3], [5.8, 0.65, 8.8],
    [10.8, 0.65, 4.8], [11.2, 0.65, -5], [2.3, 0.65, -6.2], [-1.3, 0.65, -5.8],
    [-9.8, 0.65, -1.2], [7.8, 0.65, 1.1], [-5.5, 0.65, -12.5], [3.2, 0.65, -13]
  ];
  coverSpots.forEach(([x, y, z], i) => {
    const c = box(1.3, 1.1 + (i % 4) * 0.28, 1.3, 0x2f3b49, { map: concreteTex, roughness: 0.83 });
    c.position.set(x, y, z);
    world.add(c);
    addStaticCollider(c);
  });

  const laneStripes = [
    [-13.6, 13.2, 0.34, 2.6, 0xffb347],
    [-10.4, 13.2, 0.34, 2.1, 0x4bb7ff],
    [9.8, -13.3, 0.34, 2.4, 0xff7a7a],
    [13.1, -13.3, 0.34, 2.1, 0x7de2ff]
  ];
  laneStripes.forEach(([x, z, w, d, color]) => {
    const stripe = box(w, 0.02, d, color, { roughness: 0.22, metalness: 0.42, emissive: color, emissiveIntensity: 0.22 });
    stripe.position.set(x, 0.01, z);
    world.add(stripe);
  });

  const sandbagRows = [[-13.1, 0.4, 9.2], [12.8, 0.4, -10.1], [10.2, 0.4, 8.6], [-10.4, 0.4, -6.8]];
  sandbagRows.forEach(([x, y, z], row) => {
    for (let i = 0; i < 4; i++) {
      const bag = box(0.68, 0.34, 0.42, 0x665941, { roughness: 0.92, metalness: 0.04 });
      bag.position.set(x + (i - 1.5) * 0.55, y, z + (row % 2 ? (i - 1.5) * 0.08 : 0));
      world.add(bag);
      addStaticCollider(bag);
    }
  });

  const banners = [
    [-14.78, 2.4, 5.5, 0x4fa5ff],
    [14.78, 2.4, -6.8, 0xff7c5d],
    [0, 2.4, 14.78, 0x58d5c4]
  ];
  banners.forEach(([x, y, z, c]) => {
    const banner = box(Math.abs(x) > 14 ? 0.04 : 2.4, 1.2, Math.abs(x) > 14 ? 2.4 : 0.04, c, {
      roughness: 0.55,
      metalness: 0.2,
      emissive: c,
      emissiveIntensity: 0.12
    });
    banner.position.set(x, y, z);
    world.add(banner);
  });

  const exteriorStructures = [
    [-21, 2.6, -16, 5.8, 5.2, 4.8, 0x2f3c4a],
    [22, 2.1, 15, 7.2, 4.2, 4.4, 0x3a3342],
    [-23, 1.8, 14, 4.6, 3.6, 5.6, 0x354252],
    [19.5, 2.7, -18, 6.4, 5.4, 5.2, 0x423a34]
  ];
  exteriorStructures.forEach(([x, y, z, w, h, d, color], i) => {
    const structure = box(w, h, d, color, { roughness: 0.9, metalness: 0.06, emissive: i % 2 ? 0x15202f : 0x2a1f1f, emissiveIntensity: 0.18 });
    structure.position.set(x, y, z);
    world.add(structure);
  });

  const policeVans = [
    [-17.2, 0.7, 12.4, 0x304c80, 0x6ec5ff],
    [17.2, 0.7, -12.1, 0x5f3f2e, 0xffb182]
  ];
  policeVans.forEach(([x, y, z, bodyColor, lightColor]) => {
    const van = box(2.8, 1.4, 1.4, bodyColor, { roughness: 0.5, metalness: 0.45 });
    van.position.set(x, y, z);
    world.add(van);

    const beacon = box(0.5, 0.08, 0.25, lightColor, {
      roughness: 0.2,
      metalness: 0.65,
      emissive: lightColor,
      emissiveIntensity: 0.95
    });
    beacon.position.set(x, y + 0.76, z);
    world.add(beacon);
  });

  doorwayDefs.forEach((doorway) => {
    const horizontal = doorway.size[0] >= doorway.size[2];
    const rot = horizontal ? 0 : Math.PI / 2;
    const pos = [doorway.center[0], 1.2, doorway.center[2]];
    const frameHalfWidth = 0.86;
    const frameDepth = 0.14;
    const sideA = box(0.18, 2.6, frameDepth, 0x273242, { roughness: 0.62, metalness: 0.45 });
    const sideB = box(0.18, 2.6, frameDepth, 0x273242, { roughness: 0.62, metalness: 0.45 });
    const lintel = box(1.9, 0.18, frameDepth, 0x273242, { roughness: 0.62, metalness: 0.45 });
    sideA.position.set(pos[0] - frameHalfWidth, pos[1], pos[2]);
    sideB.position.set(pos[0] + frameHalfWidth, pos[1], pos[2]);
    lintel.position.set(pos[0], pos[1] + 1.22, pos[2]);
    [sideA, sideB, lintel].forEach((piece) => {
      piece.rotation.y = rot;
      world.add(piece);
    });

    const door = box(1.2, 2.4, 0.14, 0x6b523c, { roughness: 0.8, emissive: 0x1f1610, emissiveIntensity: 0.2 });
    door.position.set(...pos);
    door.rotation.y = rot;
    world.add(door);
    visionOccluders.push(door);
    destructibles.push({
      type: 'door',
      hp: 80,
      mesh: door,
      spawnPos: door.position.clone(),
      spawnRot: door.rotation.clone(),
      bounds: new THREE.Box3().setFromObject(door),
      destroyed: false
    });
  });

  const weakWall = box(0.4, 2.4, 3.6, 0x735f4d, { map: concreteTex, roughness: 0.92 });
  weakWall.position.set(6.6, 1.2, -7.5);
  world.add(weakWall);
  visionOccluders.push(weakWall);
  destructibles.push({ type: 'wall', hp: 70, mesh: weakWall, bounds: new THREE.Box3().setFromObject(weakWall), destroyed: false });

  const windowSpots = [
    { pos: [14.75, 1.5, -8.2], rot: 0, size: [0.08, 1.6, 2.7] },
    { pos: [14.75, 1.5, -11.8], rot: 0, size: [0.08, 1.6, 2.7] },
    { pos: [-14.75, 1.5, 6], rot: 0, size: [0.08, 1.6, 2.7] },
    { pos: [2, 1.45, 14.75], rot: Math.PI / 2, size: [2.6, 1.5, 0.08] },
    { pos: [8.4, 1.45, -14.75], rot: Math.PI / 2, size: [2.1, 1.5, 0.08] }
  ];
  windowSpots.forEach(({ pos, rot, size }, i) => {
    const glass = box(size[0], size[1], size[2], 0x7ba9d2, { metalness: 0.3, roughness: 0.16 });
    glass.material.transparent = true;
    glass.material.opacity = 0.5;
    glass.position.set(...pos);
    glass.rotation.y = rot;
    world.add(glass);
    visionOccluders.push(glass);
    destructibles.push({ type: 'window', hp: 32, mesh: glass, bounds: new THREE.Box3().setFromObject(glass), destroyed: false, breachLane: i });

    const frame = box(size[0] + 0.16, size[1] + 0.2, size[2] + 0.16, 0x1b2533, { roughness: 0.55, metalness: 0.64 });
    frame.position.copy(glass.position);
    frame.rotation.copy(glass.rotation);
    world.add(frame);
  });

  const stripGeo = new THREE.BoxGeometry(0.15, 0.06, 3.8);
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x9bdaff, emissive: 0x3c8dbb, emissiveIntensity: 1, roughness: 0.25, metalness: 0.65 });
  [[-10.5, -11.5], [-1.2, -11.5], [8.3, -11.5], [-11, 8.8], [9.5, 8.8]].forEach(([x, z]) => {
    const strip = new THREE.Mesh(stripGeo, stripMat.clone());
    strip.position.set(x, 3.45, z);
    world.add(strip);
  });

  const bombLights = [
    new THREE.PointLight(0xff4f4f, 0.86, 12, 2),
    new THREE.PointLight(0x4f8dff, 0.65, 11, 2),
    new THREE.PointLight(0xffb16a, 0.5, 8, 2)
  ];
  bombLights[0].position.set(-1.2, 1.2, -11.2);
  bombLights[1].position.set(1.5, 1.2, -11.2);
  bombLights[2].position.set(0.2, 2.5, -9.8);
  bombLights.forEach((l) => {
    world.add(l);
    flickerLights.push(l);
  });

  const tacticalRings = [1.6, 2.3, 3.1];
  tacticalRings.forEach((radius, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 10, 42),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x7fd4ff : 0x79b6ff,
        emissive: i % 2 ? 0x1f8fff : 0x2e66d9,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    ring.position.set(0.2, 0.12 + i * 0.02, -11.2);
    ring.rotation.x = Math.PI / 2;
    ring.userData.fxType = 'ring';
    ring.userData.dir = i % 2 ? -1 : 1;
    ring.renderOrder = 25;
    world.add(ring);
    tacticalFxMeshes.push(ring);
  });

  const warningBeams = [
    { pos: new THREE.Vector3(-4.8, 1.85, -11.2), color: 0x59c0ff },
    { pos: new THREE.Vector3(5.2, 1.85, -11.2), color: 0xff8f6d }
  ];
  warningBeams.forEach(({ pos, color }, i) => {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 3.2, 16, 1, true),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.95, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    beam.position.copy(pos);
    beam.userData.fxType = 'beam';
    beam.userData.phase = i * Math.PI;
    world.add(beam);
    tacticalFxMeshes.push(beam);
  });

  const accentA = new THREE.PointLight(0x5ec8ff, 1.1, 21, 2);
  accentA.position.set(-9.5, 2.8, -6.5);
  world.add(accentA);
  flickerLights.push(accentA);

  const accentB = new THREE.PointLight(0x8dffd2, 0.95, 18, 2);
  accentB.position.set(7.2, 2.4, 6.8);
  world.add(accentB);
  flickerLights.push(accentB);

  const policeBlue = new THREE.PointLight(0x3e8dff, 1.2, 20, 2);
  policeBlue.position.set(-13.8, 3.2, 12.4);
  world.add(policeBlue);
  const policeAmber = new THREE.PointLight(0xff9a63, 1.1, 20, 2);
  policeAmber.position.set(13.8, 3.1, -12.6);
  world.add(policeAmber);
  flickerLights.push(policeBlue, policeAmber);

  const rainGeo = new THREE.BoxGeometry(0.025, 0.42, 0.025);
  const rainMat = new THREE.MeshBasicMaterial({ color: 0x9ecbff, transparent: true, opacity: 0.26 });
  for (let i = 0; i < 180; i++) {
    const drop = new THREE.Mesh(rainGeo, rainMat);
    drop.position.set((Math.random() - 0.5) * 34, 2.5 + Math.random() * 10, (Math.random() - 0.5) * 34);
    drop.userData.speed = 6 + Math.random() * 7;
    world.add(drop);
    rainDrops.push(drop);
  }

  const camPoints = [new THREE.Vector3(-12, 3.3, -11), new THREE.Vector3(12, 3.3, 8), new THREE.Vector3(1, 3.4, -5), new THREE.Vector3(13.2, 3.3, -10.8)];
  camPoints.forEach((p, i) => {
    const cam = box(0.3, 0.2, 0.3, 0x9bc0e8);
    cam.position.copy(p);
    world.add(cam);
    gadgets.push({ type: 'cctv', team: 'def', mesh: cam, pos: p.clone(), id: i });
  });
}
makeMap();

function makeBombVisuals() {
  bombCarryMesh = box(0.18, 0.18, 0.18, 0xffd26d, { emissive: 0xd38c22, emissiveIntensity: 1.1, roughness: 0.32, metalness: 0.28 });
  bombCarryMesh.visible = false;
  world.add(bombCarryMesh);

  bombDropCore = box(0.2, 0.2, 0.2, 0xffca4f, { emissive: 0xe1941f, emissiveIntensity: 1.2, roughness: 0.36, metalness: 0.24 });
  bombDropCore.visible = false;
  world.add(bombDropCore);

  bombDropRing = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffe08b, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  bombDropRing.rotation.x = -Math.PI / 2;
  bombDropRing.visible = false;
  world.add(bombDropRing);
}
makeBombVisuals();

const playerOperator = OPERATOR_ROSTERS.atk[0];
const player = {
  team: 'atk', role: playerOperator.role, codename: playerOperator.codename, ability: playerOperator.ability, abilityLabel: playerOperator.abilityLabel,
  hp: 100, pos: new THREE.Vector3(-16, 1.7, 12), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  grounded: true, crouch: false, sprint: false, ammo: 30, reserve: 90, recoil: 0, spread: 0.015,
  breachCharges: 2, pulseCd: 0, pulseReady: true, droneActive: false, camMode: false, pingCd: 0, abilityCd: 0, alive: true, hasBomb: false,
  deathAnim: 0, deathTilt: 0, deathCause: ''
};
camera.position.copy(player.pos);

function makeBot(team, operator, pos, spawnIndex = 0) {
  const role = operator.role;
  const design = operator || operatorDesigns[role] || {};
  const m = box(0.76, 1.16, 0.52, team === 'atk' ? 0x2f435b : 0x4e2d2d, {
    roughness: 0.58,
    metalness: 0.34,
    emissive: team === 'atk' ? 0x0f1f2d : 0x2f0f0f,
    emissiveIntensity: 0.22
  });
  m.castShadow = true;
  m.position.copy(pos);
  m.position.y = 1.02;
  world.add(m);

  const vest = box(0.82, 0.64, 0.56, team === 'atk' ? 0x1f2938 : 0x2f1f1f, { roughness: 0.68, metalness: 0.22 });
  vest.position.set(0, 0.02, 0);
  m.add(vest);

  const helmet = box(0.52, 0.32, 0.52, design.helmet || (team === 'atk' ? 0x3a4f66 : 0x5c3434), { roughness: 0.3, metalness: 0.55 });
  helmet.position.set(0, 0.77, 0.02);
  m.add(helmet);

  const visor = box(0.34, 0.14, 0.06, 0x111723, {
    roughness: 0.1,
    metalness: 0.82,
    emissive: design.visor || 0x0d4c80,
    emissiveIntensity: 0.28
  });
  visor.position.set(0, -0.02, -0.24);
  helmet.add(visor);

  const headset = box(0.1, 0.2, 0.1, 0x232a36, { roughness: 0.35, metalness: 0.62 });
  headset.position.set(-0.26, 0, 0.02);
  helmet.add(headset);
  const headsetR = headset.clone();
  headsetR.position.x = 0.26;
  helmet.add(headsetR);

  const shoulderL = box(0.18, 0.2, 0.2, design.accent || (team === 'atk' ? 0x334a64 : 0x6a3d3d), { roughness: 0.58, metalness: 0.22 });
  shoulderL.position.set(-0.38, 0.3, -0.02);
  m.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.38;
  m.add(shoulderR);

  const leftLeg = box(0.2, 0.56, 0.2, 0x212833, { roughness: 0.76, metalness: 0.1 });
  leftLeg.position.set(-0.18, -0.86, 0);
  m.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.18;
  m.add(rightLeg);

  const leftArm = box(0.14, 0.56, 0.16, team === 'atk' ? 0x2b3747 : 0x432828, { roughness: 0.72, metalness: 0.14 });
  leftArm.position.set(-0.49, 0.02, -0.02);
  m.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.49;
  m.add(rightArm);

  const patch = box(0.24, 0.18, 0.04, design.emblem || (team === 'atk' ? 0x2e86ff : 0xff7a5f), {
    roughness: 0.3,
    metalness: 0.28,
    emissive: team === 'atk' ? 0x0f4fb5 : 0xb53f25,
    emissiveIntensity: 0.4
  });
  patch.position.set(0, 0.12, -0.3);
  m.add(patch);

  const roleStripe = box(0.58, 0.08, 0.04, design.accent || (team === 'atk' ? 0x53a4ff : 0xff8d73), {
    roughness: 0.38,
    metalness: 0.3,
    emissive: design.accent || 0x3d7bc7,
    emissiveIntensity: 0.35
  });
  roleStripe.position.set(0, -0.14, -0.31);
  m.add(roleStripe);

  const abilityRig = box(0.2, 0.2, 0.2, design.emblem || 0x7fc4ff, {
    roughness: 0.24,
    metalness: 0.45,
    emissive: design.accent || 0x3d7bc7,
    emissiveIntensity: 0.5
  });
  abilityRig.position.set(0, 0.38, 0.3);
  m.add(abilityRig);

  const kneeL = box(0.18, 0.12, 0.2, team === 'atk' ? 0x31465f : 0x5d3b3b, { roughness: 0.52, metalness: 0.3 });
  kneeL.position.set(-0.18, -0.62, -0.04);
  m.add(kneeL);
  const kneeR = kneeL.clone();
  kneeR.position.x = 0.18;
  m.add(kneeR);

  const commAntenna = box(0.05, 0.28, 0.05, 0x1d2532, { roughness: 0.4, metalness: 0.48, emissive: design.accent || 0x3d7bc7, emissiveIntensity: 0.28 });
  commAntenna.position.set(0, 0.8, 0.26);
  m.add(commAntenna);

  const nameplate = makeNameplate(`${design.codename || role} · ${role}`, team === 'atk' ? '#8fd0ff' : '#ffae99');
  nameplate.position.set(0, 1.45, 0);
  m.add(nameplate);

  const outline = box(0.92, 1.96, 0.92, team === 'atk' ? 0x62bcff : 0xff7777, {
    roughness: 0.2,
    metalness: 0,
    emissive: team === 'atk' ? 0x1f86ff : 0xb73434,
    emissiveIntensity: 1.1
  });
  outline.material.transparent = true;
  outline.material.opacity = 0;
  outline.material.depthTest = false;
  outline.material.depthWrite = false;
  outline.renderOrder = 20;
  outline.visible = false;
  world.add(outline);
  teammateOutlines.push({ mesh: outline, owner: m, team });
  const weapon = buildBotWeapon(team);
  weapon.gunRoot.position.set(0, 0.22, -0.36);
  m.add(weapon.gunRoot);
  return {
    team, role, codename: design.codename || role, ability: design.ability || (team === 'atk' ? 'hardBreach' : 'armorTrap'), abilityLabel: design.abilityLabel || 'Utility', mesh: m, hp: 100, armor: team === 'def' ? 20 : 10, targetNode: null, alert: 0, reaction: 0.2 + Math.random() * 0.5,
    shootTimer: 0, state: 'hold', pingTarget: null, retreat: false, lastHeard: null, dead: false, gadgetCd: 8 + Math.random() * 4,
    setupDone: false, spawnIndex, dronePhase: false, objectiveKnown: false, gunMesh: weapon.gunRoot, gunMuzzle: weapon.muzzle,
    strafeDir: Math.random() > 0.5 ? 1 : -1, strafeTimer: 0.5 + Math.random() * 0.8,
    aggression: 0.75 + Math.random() * 0.45, discipline: 0.65 + Math.random() * 0.3, crouchBias: Math.random(), inCover: false,
    leftLeg, rightLeg, leftArm, rightArm, helmet,
    gait: Math.random() * Math.PI * 2, lean: 0, task: 'hold',
    cornerIndex: spawnIndex % roomClearCorners.length, cornerLookTimer: 0.5 + Math.random() * 1.2,
    scanDir: Math.random() > 0.5 ? 1 : -1, lastMoveSpeed: 0, hearing: 1.1 + Math.random() * 0.4,
    squadLead: spawnIndex === 0, suppressing: 0, regroupCd: 0, calloutCd: Math.random() * 2, abilityCd: 4 + Math.random() * 5, abilityAnim: 0,
    patrolIndex: spawnIndex % defenderPatrolPoints.length, nameplate, abilityRig,
    hasBomb: false, deathAnim: 0, deathTilt: 0, deathDir: new THREE.Vector3(),
    lastTaskCallout: '', lastTaskTarget: null, nextTaskCalloutAt: 0,
    routeBias: ((spawnIndex % 2) ? 1 : -1) * (0.9 + Math.random() * 0.7),
    tacticalOffset: new THREE.Vector3((Math.random() - 0.5) * 1.9, 0, (Math.random() - 0.5) * 1.9)
  };
}

function entityLabel(entity) {
  if (!entity) return 'Unknown';
  return entity === player ? `You/${player.codename}` : `${entity.codename || entity.role}`;
}

function setBombCarrier(entity, announce = true) {
  player.hasBomb = false;
  bots.forEach((b) => { b.hasBomb = false; });
  state.bombCarrier = entity || null;
  state.bombDropped = false;
  if (entity) {
    entity.hasBomb = true;
    if (announce) addFeed(`${entityLabel(entity)} secured the Rift Charge`);
  }
}

function dropBombFrom(entity, pos) {
  if (!entity?.hasBomb || state.bombPlanted) return;
  entity.hasBomb = false;
  if (state.bombCarrier === entity) state.bombCarrier = null;
  state.bombDropped = true;
  state.bombDropPos.copy(pos).setY(0.14);
  addFeed(`Rift Charge dropped by ${entityLabel(entity)}`);
}

function tryPickupDroppedBomb(entity, pos) {
  if (!state.bombDropped || entity.team !== 'atk' || entity.dead || entity.hp <= 0 || state.bombPlanted) return false;
  if (pos.distanceTo(state.bombDropPos) > 1.2) return false;
  setBombCarrier(entity, false);
  addFeed(`${entityLabel(entity)} recovered the Rift Charge`);
  return true;
}

function onBotEliminated(bot, killerLabel, hitPos = null) {
  if (bot.dead) return;
  bot.dead = true;
  bot.deathAnim = 0.01;
  bot.deathTilt = (Math.random() > 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.45);
  bot.deathDir.set((Math.random() - 0.5) * 0.8, 0, -0.45 - Math.random() * 0.8).normalize();
  if (bot.hasBomb) dropBombFrom(bot, bot.mesh.position);
  if (killerLabel) addFeed(`${killerLabel} eliminated ${bot.codename} at ${getAreaNameFromPos(hitPos || bot.mesh.position).toUpperCase()}`);
}

function showDeathBanner(text) {
  if (!ui.deathBanner) return;
  ui.deathBanner.textContent = text;
  ui.deathBanner.classList.remove('show');
  void ui.deathBanner.offsetWidth;
  ui.deathBanner.classList.add('show');
}

function onPlayerEliminated(reason = 'You were neutralized') {
  if (!player.alive) return;
  player.alive = false;
  player.deathAnim = 0.01;
  player.deathTilt = (Math.random() > 0.5 ? 1 : -1) * 0.35;
  player.deathCause = reason;
  if (player.hasBomb) dropBombFrom(player, player.pos);
  showDeathBanner('You are down');
  addFeed(reason);
}

function assignRoundBombCarrier() {
  const choices = bots.filter((b) => b.team === 'atk' && !b.dead);
  if (player.team === 'atk' && player.alive) choices.push(player);
  const pick = choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  setBombCarrier(pick, !!pick);
}

function updateBombVisuals(dt) {
  if (!bombCarryMesh || !bombDropCore || !bombDropRing) return;
  const pulse = 0.95 + Math.sin(performance.now() * 0.009) * 0.1;
  if (state.bombPlanted) {
    bombCarryMesh.visible = false;
    bombDropCore.visible = false;
    bombDropRing.visible = false;
    return;
  }

  if (state.bombCarrier?.hasBomb) {
    const anchor = state.bombCarrier === player ? player.pos : state.bombCarrier.mesh.position;
    bombCarryMesh.visible = true;
    bombCarryMesh.position.copy(anchor).add(new THREE.Vector3(0, 0.2, 0));
    bombCarryMesh.rotation.y += dt * 1.8;
    bombCarryMesh.scale.setScalar(pulse);
  } else {
    bombCarryMesh.visible = false;
  }

  if (state.bombDropped) {
    bombDropCore.visible = true;
    bombDropRing.visible = true;
    bombDropCore.position.copy(state.bombDropPos);
    bombDropCore.rotation.y += dt * 2.6;
    bombDropCore.scale.setScalar(0.95 + Math.sin(performance.now() * 0.011) * 0.08);
    bombDropRing.position.copy(state.bombDropPos).setY(0.05);
    bombDropRing.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.16);
    bombDropRing.material.opacity = 0.62 + Math.sin(performance.now() * 0.012) * 0.25;
  } else {
    bombDropCore.visible = false;
    bombDropRing.visible = false;
  }
}

function spawnTeams() {
  bots.forEach((bot) => {
    world.remove(bot.mesh);
    if (bot.droneMesh) world.remove(bot.droneMesh);
  });
  teammateOutlines.forEach((entry) => world.remove(entry.mesh));
  bots.length = 0;
  teammateOutlines.length = 0;
  for (let i = 0; i < OPERATOR_ROSTERS.atk.length; i++) {
    bots.push(makeBot('atk', OPERATOR_ROSTERS.atk[i], teamSpawns.atk[i].clone(), i));
    bots.push(makeBot('def', OPERATOR_ROSTERS.def[i], teamSpawns.def[i].clone(), i));
  }
}
spawnTeams();
assignRoundBombCarrier();

const roomZones = [
  { name: 'Bomb Room', min: new THREE.Vector3(-4.2, 0, -14.8), max: new THREE.Vector3(4.5, 4, -7.8) },
  { name: 'Server Hall', min: new THREE.Vector3(-12.8, 0, -8.8), max: new THREE.Vector3(-3.9, 4, 2.4) },
  { name: 'Archives', min: new THREE.Vector3(4, 0, -8.2), max: new THREE.Vector3(14.8, 4, 4) },
  { name: 'Front Office', min: new THREE.Vector3(-13.5, 0, 2.6), max: new THREE.Vector3(2.8, 4, 14.8) },
  { name: 'Loading Dock', min: new THREE.Vector3(2.9, 0, 3.2), max: new THREE.Vector3(14.8, 4, 14.8) }
];



function getAreaNameFromPos(pos) {
  const zone = roomZones.find((r) => pos.x >= r.min.x && pos.x <= r.max.x && pos.z >= r.min.z && pos.z <= r.max.z);
  return zone ? zone.name : 'Exterior';
}
function makeNoise(pos, radius = 6.8, team = null) {
  noiseEvents.push({ pos: pos.clone(), radius, ttl: 1.8, team });
}

function updateAIWorldState(dt) {
  for (let i = noiseEvents.length - 1; i >= 0; i--) {
    noiseEvents[i].ttl -= dt;
    if (noiseEvents[i].ttl <= 0) noiseEvents.splice(i, 1);
  }
  for (let i = breachSignals.length - 1; i >= 0; i--) {
    breachSignals[i].ttl -= dt;
    if (breachSignals[i].ttl <= 0) breachSignals.splice(i, 1);
  }
}

function getCompassLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function getPlayerArea() {
  const p = player.pos;
  const zone = roomZones.find((r) => p.x >= r.min.x && p.x <= r.max.x && p.z >= r.min.z && p.z <= r.max.z);
  if (zone) return `INSIDE · ${zone.name.toUpperCase()}`;
  return 'OUTSIDE · STAGING';
}

function updateUI() {
  ui.phase.textContent = state.bombPlanted ? 'POST-PLANT' : state.phase.toUpperCase() + ' PHASE';
  const t = state.bombPlanted ? state.bombTimer : state.phaseTime;
  ui.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  ui.score.textContent = `Vanguard ${state.score.atk} - ${state.score.def} Bastion`;
  ui.round.textContent = `Round ${state.round} / ${state.maxRounds}`;
  const atkAlive = (player.team === 'atk' && player.alive ? 1 : 0) + bots.filter((b) => b.team === 'atk' && !b.dead).length;
  const defAlive = (player.team === 'def' && player.alive ? 1 : 0) + bots.filter((b) => b.team === 'def' && !b.dead).length;
  ui.aliveCount.textContent = `ALIVE ${atkAlive}v${defAlive}`;
  const heading = THREE.MathUtils.radToDeg(player.yaw);
  ui.compassBar.textContent = `${getCompassLabel(heading)} · ${String(Math.round((heading + 360) % 360)).padStart(3, '0')}°`;
  ui.health.textContent = `HP ${Math.max(0, Math.floor(player.hp))}`;
  if (!player.alive && ui.health) ui.health.textContent += ' · DOWN';
  ui.ammo.textContent = `AMMO ${player.ammo} / ${player.reserve}`;
  ui.stance.textContent = player.crouch ? 'CROUCH' : (player.sprint ? 'SPRINT' : 'STAND');
  ui.teamRole.textContent = `${player.team === 'atk' ? 'ATTACKER' : 'DEFENDER'} · ${player.role.toUpperCase()} · ${getPlayerArea()}`;
  if (ui.operatorPlate) ui.operatorPlate.textContent = `OPERATOR: ${player.codename.toUpperCase()} · ${player.abilityLabel.toUpperCase()}`;
  ui.gadgetA.textContent = `[G] Breach Charge: ${player.breachCharges}`;
  ui.gadgetB.textContent = `[F] ${player.abilityLabel}: ${player.abilityCd <= 0 ? 'Ready' : player.abilityCd.toFixed(1) + 's'}`;
  if (state.phase === 'prep') {
    ui.objective.innerHTML = player.team === 'atk'
      ? `Prep Phase: Attackers are locked on drones and must scout from outside to locate Bomb Room.${state.atkObjectiveKnown ? ' <span class="ok">Objective found.</span>' : ''}`
      : 'Prep Phase: Defenders barricade, place traps, and fortify the site before action starts.';
  } else if (state.bombPlanted) {
    ui.objective.innerHTML = '<span class="warn">Post-Plant: Defend the Rift Charge detonation.</span>';
  } else if (state.bombDropped) {
    ui.objective.innerHTML = '<span class="warn">Rift Charge dropped. Attackers must recover it before planting.</span>';
  } else {
    ui.objective.innerHTML = state.bombCarrier?.hasBomb
      ? `${entityLabel(state.bombCarrier)} has the Rift Charge. Reach Bomb Room and plant.`
      : 'Action Phase: Attack through windows, clear rooms, and plant in Bomb Room.';
  }
}

function shoot(shooter, dir, damage = 34, spread = 0.02) {
  const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
  const shotStart = shooter === player
    ? weaponMuzzle.getWorldPosition(new THREE.Vector3())
    : (shooter.gunMuzzle ? shooter.gunMuzzle.getWorldPosition(new THREE.Vector3()) : shooter.mesh.position.clone().setY(1.3));
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
      const armorMitigation = headshot ? 0 : Math.min(0.45, (b.armor || 0) / 100);
      b.hp -= damage * (headshot ? 2 : 1) * (1 - armorMitigation);
      if (!headshot && b.armor) b.armor = Math.max(0, b.armor - damage * 0.45);
      if (b.hp <= 0) {
        onBotEliminated(b, shooter === player ? 'You' : shooter.role, p);
      }
    } else if (hitDes) {
      const dObj = destructibles.find(x => x.mesh === hitDes.object);
      if (dObj.type === 'door') {
        dObj.hp = 0;
        if (!dObj.destroyed) destroyDestructible(dObj);
      } else {
        dObj.hp -= damage;
        if (dObj.hp <= 0 && !dObj.destroyed) destroyDestructible(dObj);
      }
    }
  }
  makeNoise(shotStart, shooter === player ? 9.2 : 7.2, shooter.team || null);
  beep(180 + Math.random() * 50, 0.04, 'square', 0.02);
}

function hasLineOfSight(from, to) {
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance <= 0.001) return true;
  raycaster.set(from, direction.normalize());
  const blockers = visionOccluders.filter((m) => m.visible !== false);
  const hit = raycaster.intersectObjects(blockers, false)[0];
  return !hit || hit.distance > distance - 0.05;
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
  if (d.type === 'glass' || d.type === 'window') {
    d.mesh.material.opacity = 0.05;
    for (let i = 0; i < 12; i++) {
      const shard = box(0.08, 0.08, 0.08, 0x9ad7ff);
      shard.position.copy(d.mesh.position).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 1));
      world.add(shard);
      bullets.push({ mesh: shard, vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), life: 1.2 });
    }
  } else {
    const debrisColor = d.type === 'door' ? 0x7b5d42 : 0x65686f;
    const chunkCount = d.type === 'door' ? 9 : 14;
    for (let i = 0; i < chunkCount; i++) {
      const chunk = box(0.12 + Math.random() * 0.14, 0.08 + Math.random() * 0.08, 0.08 + Math.random() * 0.14, debrisColor, { roughness: 0.88, metalness: 0.08 });
      chunk.position.copy(d.mesh.position).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2));
      world.add(chunk);
      bullets.push({ mesh: chunk, vel: new THREE.Vector3((Math.random() - 0.5) * 4.8, 1.5 + Math.random() * 2.4, (Math.random() - 0.5) * 4.8), life: 0.9 + Math.random() * 0.6 });
    }
    d.mesh.visible = false;
  }
  addFeed(`${d.type.toUpperCase()} breached`);
  breachSignals.push({ pos: d.mesh.position.clone(), ttl: 7 });
  makeNoise(d.mesh.position, 11.5, null);
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
  makeNoise(charge.position, 5.8, player.team);
  beep(800, 0.07, 'triangle', 0.03);
}

function pulseScan() {
  if (player.abilityCd > 0) return;
  player.abilityCd = 12;
  if (player.ability === 'shockBreach') {
    const breachable = destructibles
      .filter((d) => !d.destroyed && (d.type === 'door' || d.type === 'wall' || d.type === 'window'))
      .sort((a, b) => a.mesh.position.distanceTo(player.pos) - b.mesh.position.distanceTo(player.pos))[0];
    if (breachable && breachable.mesh.position.distanceTo(player.pos) < 4.2) {
      destroyDestructible(breachable);
      addFeed(`${player.codename} triggered Shock Breach`);
    }
  } else {
    bots.filter(b => !b.dead && b.team === 'def' && b.mesh.position.distanceTo(player.pos) < 14).forEach(b => {
      b.mesh.material.emissive = new THREE.Color(0xff0033);
      b.mesh.material.emissiveIntensity = 1.3;
      setTimeout(() => { if (!b.dead) b.mesh.material.emissiveIntensity = 0; }, 1000);
    });
    addPing(player.pos.clone().add(new THREE.Vector3(0, 0.2, -2)), 'atk');
    addFeed(`${player.codename} emitted ${player.abilityLabel}`);
  }
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
  if (state.phase === 'prep' && player.team === 'atk' && toggle === true && player.droneActive) return;
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

function setAttackerObjectiveKnown(source = 'Drones') {
  if (state.atkObjectiveKnown) return;
  state.atkObjectiveKnown = true;
  addFeed(`${source} located Bomb Room`);
  bots.filter((b) => b.team === 'atk' && !b.dead).forEach((b) => {
    b.pingTarget = state.objectivePos.clone();
    b.objectiveKnown = true;
  });
}

function beginActionPhase() {
  state.phase = 'action';
  state.phaseTime = state.phaseConfig.action;
  addFeed('Prep complete. Action phase live');

  if (player.team === 'atk') {
    deployDrone(false);
    player.camMode = false;
    const spawn = teamSpawns.atk[Math.floor(Math.random() * teamSpawns.atk.length)].clone();
    player.pos.copy(findSafeGroundPosition(spawn, { outsideOnly: true, radius: 2.1 })).setY(1.7);
    player.vel.set(0, 0, 0);
    if (player.droneMesh) player.droneMesh.position.copy(player.pos).add(new THREE.Vector3(0, -1.4, 0));
  }

  bots.forEach((bot) => {
    if (bot.dead) return;
    if (bot.team === 'atk') {
      const spawn = teamSpawns.atk[bot.spawnIndex % teamSpawns.atk.length].clone();
      bot.mesh.position.copy(findSafeGroundPosition(spawn, { outsideOnly: true, radius: 1.8 }));
      bot.dronePhase = false;
      if (bot.droneMesh) bot.droneMesh.visible = false;
      bot.entryPathIndex = 0;
    }
  });
  assignRoundBombCarrier();
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
  if (player.team === 'atk' && player.hasBomb && state.phase === 'action' && !state.bombPlanted && input.keys['KeyX']) {
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

function getNearestTacticalCover(origin, fallback, botTeam) {
  const candidates = colliders
    .map((bounds) => bounds.getCenter(new THREE.Vector3()))
    .filter((center) => center.distanceTo(origin) < 7 && (!fallback || center.distanceTo(fallback) < 9));
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.distanceTo(origin) - b.distanceTo(origin));
  const pick = candidates.find((point) => botTeam === 'def' ? point.distanceTo(state.objectivePos) < 12 : point.distanceTo(state.objectivePos) > 2.8);
  return pick ? pick.clone().setY(1) : candidates[0].clone().setY(1);
}


function getBotNavigationTarget(origin, desired) {
  const eyeOrigin = origin.clone().setY(1.2);
  const eyeDesired = desired.clone().setY(1.2);
  if (hasLineOfSight(eyeOrigin, eyeDesired)) return desired.clone();

  const viableNodes = navNodes.filter((node) => {
    if (isBlockedPoint(node)) return false;
    return hasLineOfSight(eyeOrigin, node.clone().setY(1.2));
  });
  if (!viableNodes.length) return desired.clone();

  viableNodes.sort((a, b) => a.distanceTo(desired) - b.distanceTo(desired));
  return viableNodes[0].clone();
}

function getClosestEntryPoint(pos) {
  const breachables = destructibles.filter((d) => !d.destroyed && (d.type === 'window' || d.type === 'door' || d.type === 'wall'));
  if (!breachables.length) return null;
  breachables.sort((a, b) => a.mesh.position.distanceTo(pos) - b.mesh.position.distanceTo(pos));
  return breachables[0];
}

function getRoleBreachPoint(bot) {
  const breachables = destructibles.filter((d) => !d.destroyed && (d.type === 'window' || d.type === 'door' || d.type === 'wall'));
  if (!breachables.length) return null;
  const roleBias = bot.role === 'Entry' ? ['door', 'window', 'wall'] : bot.role === 'Support' ? ['wall', 'door', 'window'] : ['window', 'door', 'wall'];
  breachables.sort((a, b) => {
    const apri = roleBias.indexOf(a.type);
    const bpri = roleBias.indexOf(b.type);
    if (apri !== bpri) return apri - bpri;
    return a.mesh.position.distanceTo(bot.mesh.position) - b.mesh.position.distanceTo(bot.mesh.position);
  });
  return breachables[0];
}

function animateBotPose(bot, dt, moveAmount, aimPoint, hostileVisible) {
  const gaitSpeed = THREE.MathUtils.clamp(moveAmount * 3.2, 0, 1.8);
  bot.gait += dt * (3.6 + gaitSpeed * 4.2);
  bot.abilityAnim = Math.max(0, bot.abilityAnim - dt * 1.9);
  bot.lastMoveSpeed = THREE.MathUtils.lerp(bot.lastMoveSpeed, moveAmount, dt * 8);
  const swing = Math.sin(bot.gait) * (0.18 + bot.lastMoveSpeed * 0.24);
  const armSwing = Math.sin(bot.gait + Math.PI * 0.5) * (0.12 + bot.lastMoveSpeed * 0.14);
  const adsBias = hostileVisible ? 1 : 0;
  const crouchBias = (bot.inCover || bot.retreat) ? 1 : 0;

  bot.leftLeg.rotation.x = THREE.MathUtils.lerp(bot.leftLeg.rotation.x, swing * (1 - crouchBias * 0.35), dt * 10);
  bot.rightLeg.rotation.x = THREE.MathUtils.lerp(bot.rightLeg.rotation.x, -swing * (1 - crouchBias * 0.35), dt * 10);
  bot.leftArm.rotation.x = THREE.MathUtils.lerp(bot.leftArm.rotation.x, -armSwing - adsBias * 0.6 - crouchBias * 0.24 - bot.abilityAnim * 0.55, dt * 10);
  bot.rightArm.rotation.x = THREE.MathUtils.lerp(bot.rightArm.rotation.x, armSwing - 0.2 - adsBias * 0.45 - crouchBias * 0.2 + bot.abilityAnim * 0.45, dt * 10);

  bot.lean = THREE.MathUtils.lerp(bot.lean, THREE.MathUtils.clamp(bot.strafeDir * bot.lastMoveSpeed * 0.25, -0.2, 0.2), dt * 6);
  bot.mesh.rotation.z = bot.lean;
  bot.mesh.position.y = THREE.MathUtils.lerp(bot.mesh.position.y, 1.02 - crouchBias * 0.16 + Math.abs(Math.sin(bot.gait * 2.1)) * 0.03 * bot.lastMoveSpeed, dt * 10);
  bot.helmet.rotation.y = THREE.MathUtils.lerp(bot.helmet.rotation.y, (aimPoint ? THREE.MathUtils.clamp(Math.sin(bot.gait * 0.5) * 0.12, -0.18, 0.18) : 0) + bot.lean * 0.4, dt * 6);
  bot.abilityRig.rotation.y = THREE.MathUtils.lerp(bot.abilityRig.rotation.y, bot.gait * 0.08 + bot.abilityAnim * 1.4, dt * 9);
  bot.abilityRig.position.y = THREE.MathUtils.lerp(bot.abilityRig.position.y, 0.38 + Math.sin(bot.gait * 1.8) * 0.03 + bot.abilityAnim * 0.08, dt * 9);

  if (bot.gunMesh && aimPoint) {
    bot.gunMesh.lookAt(aimPoint.clone().setY(1.22));
    bot.gunMesh.position.z = THREE.MathUtils.lerp(bot.gunMesh.position.z, hostileVisible ? -0.42 : -0.36, dt * 8);
    bot.gunMesh.position.y = THREE.MathUtils.lerp(bot.gunMesh.position.y, 0.22 - crouchBias * 0.06 + bot.abilityAnim * 0.03, dt * 8);
  }
}


function spawnAbilityBurst(pos, color, count = 5, lift = 1.4) {
  for (let i = 0; i < count; i++) {
    const spark = box(0.1, 0.1, 0.1, color, { emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
    spark.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * lift, (Math.random() - 0.5) * 0.5));
    spark.userData.temp = true;
    world.add(spark);
    impacts.push({ mesh: spark, t: 0.32 + Math.random() * 0.24 });
  }
}

function triggerBotAbility(bot, visibleEnemy) {
  const myPos = bot.mesh.position;
  bot.abilityAnim = 0.9;
  if (bot.ability === 'medStim') {
    const allies = bots.filter((b) => !b.dead && b.team === bot.team && b !== bot && b.hp < 75).sort((a, b) => a.hp - b.hp);
    const patient = allies[0];
    if (patient && patient.mesh.position.distanceTo(myPos) < 5.5) {
      patient.hp = Math.min(100, patient.hp + 28);
      const healFx = box(0.24, 0.24, 0.24, 0x88ffb2, { emissive: 0x33ff88, emissiveIntensity: 0.9 });
      healFx.position.copy(patient.mesh.position).setY(1.35);
      healFx.userData.temp = true;
      world.add(healFx);
      impacts.push({ mesh: healFx, t: 0.55 });
      spawnAbilityBurst(patient.mesh.position.clone().setY(1.2), 0x7dffb0, 6, 1.1);
      addFeed(`${bot.codename} healed ${patient.codename}`);
      return true;
    }
    return false;
  }
  if (bot.ability === 'jamBurst') {
    addPing(myPos.clone(), bot.team);
    gadgets.filter((g) => g.type === 'charge' && g.mesh.position.distanceTo(myPos) < 4.5).forEach((g) => {
      g.type = 'spent';
      g.mesh.visible = false;
    });
    spawnAbilityBurst(myPos.clone().setY(0.7), 0xb689ff, 7, 0.8);
    addFeed(`${bot.codename} emitted Jam Burst`);
    return true;
  }
  if (bot.ability === 'hardBreach' || bot.ability === 'shockBreach') {
    const breach = destructibles.filter((d) => !d.destroyed).sort((a, b) => a.mesh.position.distanceTo(myPos) - b.mesh.position.distanceTo(myPos))[0];
    if (breach && breach.mesh.position.distanceTo(myPos) < 4.7) {
      destroyDestructible(breach);
      spawnAbilityBurst(breach.mesh.position.clone().setY(1.1), 0xffc36f, 8, 1.8);
      addFeed(`${bot.codename} used ${bot.abilityLabel}`);
      return true;
    }
    return false;
  }
  if (bot.ability === 'armorTrap' || bot.ability === 'ambushMine') {
    const trap = box(0.14, 0.08, 0.14, bot.ability === 'armorTrap' ? 0xb883ff : 0xff8f73, { emissive: 0x331818, emissiveIntensity: 0.4 });
    trap.position.copy(myPos).setY(0.08);
    trap.userData.temp = true;
    world.add(trap);
    gadgets.push({ type: 'tripwire', team: bot.team, mesh: trap, hp: 22, temp: true });
    spawnAbilityBurst(myPos.clone().setY(0.35), 0xff8d73, 4, 0.7);
    addFeed(`${bot.codename} set ${bot.abilityLabel}`);
    return true;
  }
  if (bot.ability === 'scannerPulse' || bot.ability === 'intelPing') {
    if (visibleEnemy) bot.pingTarget = (visibleEnemy.mesh ? visibleEnemy.mesh.position : visibleEnemy.pos).clone();
    addPing((bot.pingTarget || myPos).clone(), bot.team);
    spawnAbilityBurst((bot.pingTarget || myPos).clone().setY(0.95), 0x74dbff, 5, 1.2);
    addFeed(`${bot.codename} marked target`);
    return true;
  }
  return false;
}

function botThink(bot, dt) {
  if (bot.dead) {
    bot.deathAnim = Math.min(1.4, (bot.deathAnim || 0) + dt * 1.15);
    const fall = THREE.MathUtils.smootherstep(Math.min(bot.deathAnim, 1), 0, 1);
    bot.mesh.rotation.x = THREE.MathUtils.lerp(bot.mesh.rotation.x, -1.36, fall * 0.45);
    bot.mesh.rotation.z = THREE.MathUtils.lerp(bot.mesh.rotation.z, bot.deathTilt || 0, fall * 0.35);
    bot.mesh.position.y = THREE.MathUtils.lerp(bot.mesh.position.y, 0.4, fall * 0.38);
    if (bot.deathDir?.lengthSq()) bot.mesh.position.addScaledVector(bot.deathDir, dt * (1 - Math.min(1, bot.deathAnim)) * 1.25);
    if (bot.leftArm) bot.leftArm.rotation.x = THREE.MathUtils.lerp(bot.leftArm.rotation.x, -1.1, dt * 8);
    if (bot.rightArm) bot.rightArm.rotation.x = THREE.MathUtils.lerp(bot.rightArm.rotation.x, -0.2, dt * 8);
    if (bot.leftLeg) bot.leftLeg.rotation.x = THREE.MathUtils.lerp(bot.leftLeg.rotation.x, 0.7, dt * 7);
    if (bot.rightLeg) bot.rightLeg.rotation.x = THREE.MathUtils.lerp(bot.rightLeg.rotation.x, -0.5, dt * 7);
    if (bot.nameplate) bot.nameplate.material.opacity = Math.max(0.06, 0.35 - bot.deathAnim * 0.18);
    return;
  }
  if (state.phase === 'prep' && !state.bombPlanted) {
    if (bot.team === 'atk') {
      const route = attackerDroneRoutes[bot.spawnIndex % attackerDroneRoutes.length];
      bot.dronePhase = true;
      bot.mesh.position.copy(teamSpawns.atk[bot.spawnIndex % teamSpawns.atk.length]);
      if (!bot.droneMesh) {
        const drone = box(0.26, 0.1, 0.26, 0x8fc9ff);
        drone.userData.temp = true;
        drone.position.copy(bot.mesh.position).setY(0.08);
        world.add(drone);
        bot.droneMesh = drone;
        bot.droneRouteIndex = 0;
      }
      if (bot.droneMesh) {
        bot.droneMesh.visible = true;
        const point = route[bot.droneRouteIndex % route.length];
        const step = point.clone().sub(bot.droneMesh.position);
        step.y = 0;
        if (step.lengthSq() > 0.06) bot.droneMesh.position.addScaledVector(step.normalize(), dt * 2.6);
        else bot.droneRouteIndex = (bot.droneRouteIndex + 1) % route.length;
        if (!bot.objectiveKnown && bot.droneMesh.position.distanceTo(state.objectivePos) < 2.6) {
          bot.objectiveKnown = true;
          setAttackerObjectiveKnown(`${bot.role} drone`);
        }
      }
      bot.shootTimer = 0;
      bot.alert = Math.max(0, bot.alert - dt);
      animateBotPose(bot, dt, 0, null, false);
      return;
    }

    const prepLane = prepSpots.def[bot.spawnIndex % prepSpots.def.length];
    const drift = prepLane.clone().add(new THREE.Vector3((bot.spawnIndex % 2) * 0.7, 0, (bot.spawnIndex % 3) * 0.45));
    const settle = drift.sub(bot.mesh.position);
    settle.y = 0;
    if (settle.lengthSq() > 0.08) bot.mesh.position.addScaledVector(settle.normalize(), dt * 1.25);

    const prepWindow = destructibles.find(d => !d.destroyed && d.type === 'window' && d.mesh.position.distanceTo(bot.mesh.position) < 4.2);
    if (prepWindow) {
      prepWindow.hp = Math.min(58, prepWindow.hp + dt * 10);
      prepWindow.mesh.material.opacity = Math.min(0.82, prepWindow.mesh.material.opacity + dt * 0.14);
    }

    const prepDoor = destructibles.find(d => !d.destroyed && d.type === 'door' && d.mesh.position.distanceTo(bot.mesh.position) < 3.2);
    if (prepDoor) {
      prepDoor.hp = Math.min(150, prepDoor.hp + dt * 20);
      prepDoor.mesh.material.color.lerp(new THREE.Color(0x7f5f3f), dt * 0.85);
    }

    if (!bot.setupDone) {
      if (bot.role === 'Intel' || bot.role === 'Denier') {
        const idx = (bot.spawnIndex + Math.floor(performance.now() * 0.001)) % defenderSetupSpots.jammer.length;
        const point = defenderSetupSpots.jammer[idx];
        if (!gadgets.some(g => g.type === 'jammer' && g.mesh.position.distanceTo(point) < 0.7)) {
          const j = box(0.5, 0.35, 0.5, 0xc783ff);
          j.position.copy(point);
          j.userData.temp = true;
          world.add(j);
          gadgets.push({ type: 'jammer', team: 'def', mesh: j, hp: 35, temp: true });
          addFeed(`${bot.role} AI deployed jammer`);
        }
        bot.setupDone = true;
      } else if (bot.role === 'Anchor' || bot.role === 'Roamer') {
        const idx = (bot.spawnIndex + Math.floor(performance.now() * 0.001)) % defenderSetupSpots.tripwire.length;
        const point = defenderSetupSpots.tripwire[idx];
        if (!gadgets.some(g => g.type === 'tripwire' && g.mesh.position.distanceTo(point) < 0.7)) {
          const t = box(0.3, 0.12, 0.3, 0xffb06f);
          t.position.copy(point);
          t.userData.temp = true;
          world.add(t);
          gadgets.push({ type: 'tripwire', team: 'def', mesh: t, hp: 25, temp: true });
          addFeed(`${bot.role} AI set a trap`);
        }
        bot.setupDone = true;
      }
    }

    bot.shootTimer = 0;
    bot.alert = Math.max(0, bot.alert - dt);
    animateBotPose(bot, dt, 0.2, state.objectivePos, false);
    return;
  }

  bot.gadgetCd -= dt;
  bot.abilityCd = Math.max(0, (bot.abilityCd || 0) - dt);
  bot.calloutCd = Math.max(0, (bot.calloutCd || 0) - dt);
  const enemy = bot.team === 'atk'
    ? [...bots.filter(b => b.team === 'def' && !b.dead), ...(player.team === 'def' && player.alive ? [player] : [])]
    : [...bots.filter(b => b.team === 'atk' && !b.dead), ...(player.team === 'atk' && player.alive ? [player] : [])];
  const myPos = bot.mesh.position;
  const visibleCandidates = enemy.filter((e) => {
    const targetPos = (e.mesh ? e.mesh.position : e.pos).clone().setY(1.2);
    return targetPos.distanceTo(myPos) < 19.5 && hasLineOfSight(myPos.clone().setY(1.2), targetPos);
  });
  visibleCandidates.sort((a, b) => (a.mesh ? a.mesh.position : a.pos).distanceTo(myPos) - (b.mesh ? b.mesh.position : b.pos).distanceTo(myPos));
  const visible = visibleCandidates[0];

  if (visible) {
    bot.alert = 2.5;
    bot.pingTarget = (visible.mesh ? visible.mesh.position : visible.pos).clone();
    bot.lastHeard = bot.pingTarget.clone();
    if (bot.calloutCd <= 0) {
      const enemyName = visible === player ? 'player' : visible.role;
      addFeed(`${bot.role} callout: ${enemyName} spotted in ${getAreaNameFromPos(bot.pingTarget).toUpperCase()}`);
      bot.calloutCd = 4 + Math.random() * 2.5;
    }
    bots.forEach((ally) => {
      if (ally !== bot && ally.team === bot.team && !ally.dead && ally.mesh.position.distanceTo(bot.mesh.position) < 12.5) {
        ally.lastHeard = bot.pingTarget.clone();
        ally.alert = Math.max(ally.alert, 1.7);
      }
    });
  } else {
    const heard = noiseEvents.find((n) => n.team !== bot.team && n.pos.distanceTo(myPos) < n.radius * bot.hearing);
    if (heard) {
      bot.lastHeard = heard.pos.clone();
      bot.alert = Math.max(bot.alert, 1.6);
      if (!bot.pingTarget || Math.random() > 0.5) bot.pingTarget = heard.pos.clone();
    }
  }
  bot.alert -= dt;

  const hotBreach = breachSignals.find((b) => b.pos.distanceTo(myPos) < 12);
  if (!visible && hotBreach && bot.team === 'def' && state.phase !== 'prep') {
    bot.alert = Math.max(bot.alert, 1.8);
    bot.lastHeard = hotBreach.pos.clone();
  }

  if (bot.hp < 30) bot.retreat = true;
  if (bot.retreat && bot.hp > 55) bot.retreat = false;

  const nearbyEnemy = visible || enemy.find((e) => (e.mesh ? e.mesh.position : e.pos).distanceTo(myPos) < 7.5);
  const allyLow = bots.some((ally) => !ally.dead && ally.team === bot.team && ally.hp < 72 && ally.mesh.position.distanceTo(myPos) < 6);
  const needAbility = (bot.ability === 'medStim' && allyLow)
    || ((bot.ability === 'armorTrap' || bot.ability === 'ambushMine') && !visible && bot.team === 'def' && bot.alert > 0.35)
    || ((bot.ability === 'hardBreach' || bot.ability === 'shockBreach') && bot.team === 'atk' && state.phase === 'action' && !state.bombPlanted)
    || ((bot.ability === 'jamBurst' || bot.ability === 'scannerPulse' || bot.ability === 'intelPing') && !!nearbyEnemy);
  if (bot.abilityCd <= 0 && needAbility) {
    if (triggerBotAbility(bot, nearbyEnemy)) bot.abilityCd = 8 + Math.random() * 5;
  }

  if (bot.team === 'atk' && !bot.hasBomb) tryPickupDroppedBomb(bot, myPos);

  let target = state.objectivePos.clone().add(bot.tacticalOffset || new THREE.Vector3());
  let aimPoint = visible ? (visible.mesh ? visible.mesh.position.clone() : visible.pos.clone()) : null;
  const activeBreach = getRoleBreachPoint(bot) || getClosestEntryPoint(myPos);
  const attackWindows = destructibles.filter(d => !d.destroyed && d.type === 'window');
  const squadMates = bots.filter((ally) => ally !== bot && !ally.dead && ally.team === bot.team);

  if (visible && bot.hp < 65) {
    const fallback = getNearestTacticalCover(myPos, bot.pingTarget || state.objectivePos, bot.team);
    if (fallback) {
      target = fallback;
      bot.task = 'fallback';
    }
  }

  if (bot.team === 'atk' && state.phase === 'action' && activeBreach) {
    const toObj = state.objectivePos.clone().sub(activeBreach.mesh.position).setY(0).normalize();
    const stackRight = new THREE.Vector3(-toObj.z, 0, toObj.x);
    const spread = (bot.spawnIndex - 1.5) * 1.45 + (bot.routeBias || 0);
    const staging = activeBreach.mesh.position.clone()
      .addScaledVector(toObj, -2.9)
      .addScaledVector(stackRight, spread);

    if (!activeBreach.destroyed) {
      bot.task = 'breach';
      target = staging;
      aimPoint = activeBreach.mesh.position.clone().setY(activeBreach.type === 'door' ? 1.05 : 1.45);
      if (myPos.distanceTo(activeBreach.mesh.position) < 5.1) {
        bot.shootTimer -= dt;
        if (bot.shootTimer <= 0) {
          shoot(bot, aimPoint.clone().sub(myPos).normalize(), bot.role === 'Support' ? 32 : 24, 0.03);
          bot.shootTimer = bot.role === 'Entry' ? 0.17 + Math.random() * 0.14 : 0.22 + Math.random() * 0.18;
        }
      }
    } else {
      bot.task = 'clear';
      bot.cornerLookTimer -= dt;
      if (bot.cornerLookTimer <= 0) {
        bot.cornerLookTimer = 0.65 + Math.random() * 1.1;
        bot.cornerIndex = (bot.cornerIndex + 1) % roomClearCorners.length;
      }
      const corner = roomClearCorners[(bot.cornerIndex + bot.spawnIndex) % roomClearCorners.length].clone();
      const executeOffset = attackerExecuteOffsets[bot.role] || new THREE.Vector3();
      target = ((bot.role === 'Planter' || bot.hasBomb) && !state.bombPlanted)
        ? state.objectivePos.clone().add(executeOffset)
        : corner;
      if (!visible) aimPoint = corner;
    }
  }

  if (bot.team === 'def' && defenderHoldPoints[bot.role]) {
    bot.task = 'hold';
    const hold = defenderHoldPoints[bot.role];
    target = hold[Math.floor((performance.now() * 0.001 + bot.spawnIndex) % hold.length)].clone();
    if (state.phase === 'action' && !state.bombPlanted && bot.alert < 0.55) {
      bot.task = 'patrol';
      const patrolPoint = defenderPatrolPoints[bot.patrolIndex % defenderPatrolPoints.length].clone();
      target = patrolPoint;
      if (myPos.distanceTo(patrolPoint) < 1.4) bot.patrolIndex = (bot.patrolIndex + 1) % defenderPatrolPoints.length;
    }
    if (state.atkObjectiveKnown && bot.alert <= 0) target = state.objectivePos.clone().add(new THREE.Vector3((bot.spawnIndex - 1.5) * 1.1, 0, -1.8));
    if (bot.role === 'Roamer' && activeBreach && activeBreach.mesh.position.distanceTo(state.objectivePos) > 4) {
      bot.task = 'rotate';
      target = activeBreach.mesh.position.clone().add(new THREE.Vector3(bot.spawnIndex % 2 ? 1.5 : -1.5, 0, 1.2));
    }
  } else if (bot.team === 'atk' && bot.role === 'Fragger' && bot.pingTarget && !attackWindows.length) {
    const flank = bot.pingTarget.clone().add(new THREE.Vector3((bot.spawnIndex % 2 ? 1 : -1) * 2.4, 0, 1.4));
    target = flank;
    bot.task = 'flank';
    if (!visible) aimPoint = flank;
  }

  if (bot.team === 'atk' && state.atkObjectiveKnown && bot.role !== 'Planter' && !bot.hasBomb && !activeBreach) {
    target = state.objectivePos.clone().add(attackerExecuteOffsets[bot.role] || new THREE.Vector3(0, 0, 2));
  }

  if (bot.team === 'atk' && bot.hasBomb && !state.bombPlanted) {
    target = state.objectivePos.clone();
    bot.task = 'plant';
  }

  if (!visible && state.phase === 'action' && enemy.length) {
    const nearestEnemy = enemy
      .slice()
      .sort((a, b) => (a.mesh ? a.mesh.position : a.pos).distanceTo(myPos) - (b.mesh ? b.mesh.position : b.pos).distanceTo(myPos))[0];
    const enemyPos = (nearestEnemy.mesh ? nearestEnemy.mesh.position : nearestEnemy.pos).clone();
    if (bot.team === 'atk' && bot.alert < 0.45 && !state.bombPlanted) {
      target = enemyPos;
      bot.task = 'pinch';
    }
    if (bot.team === 'def' && bot.alert > 0.8 && !state.bombPlanted) {
      target = enemyPos;
      bot.task = 'contest';
    }
  }
  if (!visible && bot.lastHeard && bot.alert > 0.2) {
    target = bot.lastHeard.clone().add(new THREE.Vector3((bot.spawnIndex % 2 ? 1 : -1) * 0.8, 0, 0.6));
    if (!aimPoint) aimPoint = bot.lastHeard.clone();
    bot.task = bot.team === 'def' ? 'investigate' : 'hunt';
  }
  if (bot.team === 'def' && state.bombPlanted && bot.alert <= 0.8) {
    target = state.objectivePos.clone().add(new THREE.Vector3((bot.spawnIndex - 1.5) * 0.95, 0, 2.2));
    bot.task = 'retake';
  }
  if (bot.retreat) {
    target = bot.team === 'atk' ? new THREE.Vector3(-13, 1, 13) : new THREE.Vector3(13, 1, -13);
    bot.task = 'fallback';
  }

  announceBotIntent(bot, bot.task, target);

  const avoid = new THREE.Vector3();
  squadMates.forEach((ally) => {
    const delta = myPos.clone().sub(ally.mesh.position);
    delta.y = 0;
    const dist = delta.length();
    if (dist > 0.01 && dist < 1.95) avoid.addScaledVector(delta.normalize(), (1.95 - dist) * 0.85);
  });
  if (avoid.lengthSq() > 0.001) {
    target.addScaledVector(avoid.normalize(), Math.min(1.45, avoid.length()));
    bot.task = bot.task === 'plant' ? bot.task : 'reposition';
  }

  const navTarget = getBotNavigationTarget(myPos, target);
  const move = navTarget.clone().sub(myPos); move.y = 0;
  let moveAmount = 0;
  if (move.length() > 0.35) {
    move.normalize();
    const moveSpeed = (bot.team === 'atk' ? 2.7 : 2.35) * (bot.inCover ? 0.86 : 1) * (bot.retreat ? 1.05 : 1);
    const step = move.clone().multiplyScalar(moveSpeed * dt);
    moveAmount = step.length();
    const next = myPos.clone().add(step);
    if (!isBlockedPoint(next)) myPos.copy(next);
    else {
      const sidestep = new THREE.Vector3(-move.z, 0, move.x).multiplyScalar(step.length() * 0.8 * bot.strafeDir);
      const alt = myPos.clone().add(sidestep);
      if (!isBlockedPoint(alt)) myPos.copy(alt);
      else bot.strafeDir *= -1;
    }
    const yawTarget = Math.atan2(move.x, move.z);
    bot.mesh.rotation.y = THREE.MathUtils.lerp(bot.mesh.rotation.y, yawTarget, dt * 8);
  }

  if (visible) {
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafeDir *= -1;
      bot.strafeTimer = 0.5 + Math.random() * 0.9;
    }
    const face = (visible.mesh ? visible.mesh.position : visible.pos).clone().sub(myPos);
    face.y = 0;
    if (face.lengthSq() > 0.001) {
      face.normalize();
      const side = new THREE.Vector3(-face.z, 0, face.x).multiplyScalar(bot.strafeDir * dt * 1.1);
      const probe = myPos.clone().add(side);
      if (!isBlockedPoint(probe)) myPos.add(side);
      bot.mesh.rotation.y = THREE.MathUtils.lerp(bot.mesh.rotation.y, Math.atan2(face.x, face.z), dt * 12);
      aimPoint = (visible.mesh ? visible.mesh.position.clone() : visible.pos.clone()).setY(1.22);
    }
  } else if (!aimPoint) {
    const forward = new THREE.Vector3(Math.sin(bot.mesh.rotation.y), 0, Math.cos(bot.mesh.rotation.y));
    aimPoint = myPos.clone().addScaledVector(forward, 3.5).setY(1.2);
  }

  bot.inCover = !!(target && target.distanceTo(myPos) < 1.8 && bot.task !== 'clear');
  const botAccuracy = 0.028 - Math.min(0.012, bot.discipline * 0.01) + (bot.inCover ? -0.004 : 0.005);
  bot.mesh.scale.y = THREE.MathUtils.lerp(bot.mesh.scale.y, visible && bot.crouchBias + bot.discipline > 1.05 ? 0.88 : 1, dt * 7);

  if (visible && Math.random() > bot.reaction * (1.18 - bot.aggression * 0.2)) {
    bot.shootTimer -= dt;
    if (bot.shootTimer <= 0) {
      const tPos = visible.mesh ? visible.mesh.position.clone().setY(1.2) : visible.pos.clone();
      const fireDir = tPos.sub(myPos).normalize();
      shoot(bot, fireDir, 20 + bot.aggression * 4, botAccuracy);
      bot.shootTimer = 0.16 + Math.random() * (0.32 - bot.discipline * 0.08);
      if (visible === player) {
        bot.suppressing = 0.9;
        const armorMitigation = player.crouch ? 0.18 : 0.1;
        player.hp -= (13 + Math.random() * 9) * (1 - armorMitigation);
        shakeT = 0.12;
        if (player.hp <= 0 && player.alive) onPlayerEliminated('You were neutralized');
      }
    }
  }

  animateBotPose(bot, dt, moveAmount, aimPoint, !!visible || bot.task === 'breach');
  bot.abilityAnim = Math.max(0, (bot.abilityAnim || 0) - dt * 1.8);
  if (bot.abilityRig) {
    bot.abilityRig.rotation.y += dt * (0.8 + bot.abilityAnim * 8);
    bot.abilityRig.scale.setScalar(1 + bot.abilityAnim * 0.35);
    bot.abilityRig.material.emissiveIntensity = 0.45 + bot.abilityAnim * 1.5;
  }
  if (bot.nameplate) {
    bot.nameplate.material.opacity = THREE.MathUtils.clamp(0.5 + bot.abilityAnim * 0.8, 0.35, 1);
  }

  if (bot.team === 'atk' && bot.hasBomb && state.phase === 'action' && !state.bombPlanted && myPos.distanceTo(state.objectivePos) < 1.8) {
    bot.plant = (bot.plant || 0) + dt;
    if (bot.plant > 3) {
      state.bombPlanted = true; state.bombTimer = state.phaseConfig.postPlant;
      addFeed('Enemy planter armed Rift Charge');
    }
  }

  gadgets.filter(g => g.type === 'tripwire').forEach(t => {
    if (t.mesh.position.distanceTo(myPos) < 0.7 && bot.team === 'atk') {
      bot.hp -= 18; t.mesh.visible = false; t.type = 'spent';
      myPos.add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
    }
  });

  if (bot.hp <= 0) onBotEliminated(bot);
}

function endRound(winner) {
  if (state.gameOver) return;
  state.score[winner]++;
  addFeed(`${winner === 'atk' ? 'Vanguard' : 'Bastion'} takes round ${state.round}`);
  ui.scoreboard.classList.remove('hidden');
  const rows = [player, ...bots].map(e => {
    const isP = e === player;
    return `<tr><td>${isP ? `You/${player.codename}` : `${e.codename} (${e.role})`}</td><td>${isP ? player.team : e.team}</td><td>${Math.max(0, Math.floor(e.hp))}</td><td>${(isP ? !player.alive : !e.dead) ? 'Down' : 'Alive'}</td></tr>`;
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
  state.atkObjectiveKnown = false;
  state.bombPlanted = false;
  state.bombTimer = state.phaseConfig.postPlant;
  state.bombDropped = false;
  state.bombCarrier = null;
  player.hp = 100;
  player.alive = true;
  player.hasBomb = false;
  const resetSpawn = findSafeGroundPosition(teamSpawns[player.team][0], { outsideOnly: player.team === 'atk', radius: 1.8 });
  player.pos.copy(resetSpawn).setY(1.7);
  player.vel.set(0, 0, 0);
  player.ammo = 30;
  player.breachCharges = 2;
  player.abilityCd = 0;
  player.deathAnim = 0;
  player.deathCause = '';
  if (ui.deathBanner) ui.deathBanner.classList.remove('show');
  deployDrone(false);
  camera.position.copy(player.pos);
  destructibles.forEach(d => {
    d.destroyed = false;
    d.mesh.visible = true;
    if (d.spawnPos) d.mesh.position.copy(d.spawnPos);
    if (d.spawnRot) d.mesh.rotation.copy(d.spawnRot);
    d.mesh.material.opacity = (d.type === 'glass' || d.type === 'window') ? 0.5 : 1;
    d.hp = (d.type === 'glass' || d.type === 'window') ? 32 : (d.type === 'door' ? 80 : 70);
    d.bounds.setFromObject(d.mesh);
  });
  world.children.filter(o => o.userData.temp).forEach(o => world.remove(o));
  for (let i = gadgets.length - 1; i >= 0; i--) {
    if (gadgets[i].temp) gadgets.splice(i, 1);
  }
  spawnTeams();
  assignRoundBombCarrier();
}

document.body.addEventListener('click', async () => {
  if (!mobile.enabled && document.pointerLockElement !== document.body) document.body.requestPointerLock();
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
  if (e.code === 'Digit6' && !(state.phase === 'prep' && player.team === 'atk')) cycleCams();
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
setupMobileControls();

let shootCd = 0;
let footTimer = 0;
let shakeT = 0;
const clock = new THREE.Clock();

function updatePlayer(dt) {
  if (!player.alive || state.gameOver) return;

  if (state.phase === 'prep' && player.team === 'atk') {
    if (player.camMode) player.camMode = false;
  }

  weaponRig.visible = !player.droneActive && !player.camMode;

  if (player.camMode) {
    if (input.keys['Space']) player.camMode = false;
    return;
  }

  if (player.droneActive && player.droneMesh) {
    const droneSprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const v = new THREE.Vector3((input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0), 0, (input.keys['KeyS'] ? 1 : 0) - (input.keys['KeyW'] ? 1 : 0));
    let lookDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    if (v.lengthSq()) {
      v.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), player.yaw);
      lookDir = v;
      const next = player.droneMesh.position.clone().addScaledVector(v, dt * (droneSprint ? 3.8 : 3));
      if (!jammersAffect(next, 'atk')) player.droneMesh.position.copy(next);
    }
    camera.position.copy(player.droneMesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    camera.lookAt(player.droneMesh.position.clone().add(lookDir));
    if (!state.atkObjectiveKnown && player.droneMesh.position.distanceTo(state.objectivePos) < 2.5) setAttackerObjectiveKnown('Player drone');
    if (input.keys['KeyC']) addPing(player.droneMesh.position.clone(), 'atk');
    if (input.keys['Space']) player.droneMesh.position.y = THREE.MathUtils.lerp(player.droneMesh.position.y, 0.2, dt * 8);
    else player.droneMesh.position.y = THREE.MathUtils.lerp(player.droneMesh.position.y, 0.08, dt * 10);
    return;
  }

  const maxMouseStep = 90;
  const clampedDx = THREE.MathUtils.clamp(input.mouseDx, -maxMouseStep, maxMouseStep);
  const clampedDy = THREE.MathUtils.clamp(input.mouseDy, -maxMouseStep, maxMouseStep);
  player.yaw -= clampedDx * 0.00165;
  player.pitch -= clampedDy * 0.00145;
  input.mouseDx = 0; input.mouseDy = 0;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.2, 1.2);

  player.crouch = input.keys['ControlLeft'] || input.keys['ControlRight'];
  player.sprint = !!((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && !player.crouch && !input.ads);
  const walk = input.keys['AltLeft'] || input.keys['AltRight'];

  const speedBase = player.crouch ? 2.2 : player.sprint ? 5.1 : walk ? 2.5 : input.ads ? 2.8 : 3.8;
  const suppressed = bots.some((b) => !b.dead && b.team !== player.team && b.suppressing > 0 && b.mesh.position.distanceTo(player.pos) < 9.5);
  const speed = speedBase * (suppressed ? 0.85 : 1);
  const move = new THREE.Vector3((input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0), 0, (input.keys['KeyS'] ? 1 : 0) - (input.keys['KeyW'] ? 1 : 0));
  if (move.lengthSq()) {
    move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    const next = player.pos.clone().addScaledVector(move, speed * dt);
    const probe = new THREE.Box3().setFromCenterAndSize(next.clone().setY(1), new THREE.Vector3(0.7, 1.8, 0.7));
    if (!isBlockedProbe(probe)) {
      player.pos.copy(next);
      footTimer -= dt;
      if (footTimer <= 0) {
        const f = player.crouch ? 140 : player.sprint ? 280 : 200;
        beep(f, 0.03, 'triangle', player.crouch ? 0.007 : 0.013);
        footTimer = player.crouch ? 0.45 : player.sprint ? 0.2 : 0.32;
        makeNoise(player.pos, player.crouch ? 3.2 : player.sprint ? 6.2 : 4.6, player.team);
      }
    }
  }

  if (state.phase === 'prep' && player.team === 'atk' && isInsideBuilding(player.pos)) {
    const shove = player.pos.clone().setY(0).normalize().multiplyScalar(dt * 4);
    player.pos.add(shove);
  }

  camera.fov = THREE.MathUtils.lerp(camera.fov, input.ads ? 56 : 75, dt * 8);
  camera.updateProjectionMatrix();

  const leanOffset = input.lean * (input.ads ? 0.22 : 0.14);
  const leanRoll = input.lean * (input.ads ? 0.06 : 0.1);
  const shake = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.8 : 0;
  camera.position.copy(player.pos).add(new THREE.Vector3(Math.cos(player.yaw) * leanOffset, player.crouch ? -0.45 : 0, Math.sin(player.yaw) * leanOffset));
  camera.rotation.order = 'YXZ';
  camera.rotation.set(player.pitch + shake, player.yaw, leanRoll);

  const moveSpeed = Math.min(1, move.length() + (player.sprint ? 0.45 : 0.2));
  const bob = Math.sin(performance.now() * (player.sprint ? 0.018 : 0.012)) * 0.008 * moveSpeed;
  const strafeBlend = (input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0);
  const forwardBlend = (input.keys['KeyW'] ? 1 : 0) - (input.keys['KeyS'] ? 1 : 0);
  const sprintPose = player.sprint ? 1 : 0;
  const targetGunX = input.ads ? 0.06 : 0.33;
  const targetGunY = input.ads ? -0.2 : -0.29;
  const targetGunZ = input.ads ? -0.24 : -0.45;
  weaponRig.position.x = THREE.MathUtils.lerp(weaponRig.position.x, targetGunX + strafeBlend * 0.016, dt * 11);
  weaponRig.position.y = THREE.MathUtils.lerp(weaponRig.position.y, targetGunY + bob - sprintPose * 0.06, dt * 11);
  weaponRig.position.z = THREE.MathUtils.lerp(weaponRig.position.z, targetGunZ + forwardBlend * 0.012 + sprintPose * 0.04, dt * 11);
  weaponRig.rotation.y = THREE.MathUtils.lerp(weaponRig.rotation.y, (input.ads ? 0 : -0.2) + strafeBlend * 0.07, dt * 10);
  weaponRig.rotation.x = THREE.MathUtils.lerp(weaponRig.rotation.x, player.recoil * 4 + bob * 1.8 + sprintPose * 0.18, dt * 12);
  weaponRig.rotation.z = THREE.MathUtils.lerp(weaponRig.rotation.z, input.lean * 0.06 - strafeBlend * 0.05, dt * 12);

  shootCd -= dt;
  if (input.fire && shootCd <= 0 && player.ammo > 0) {
    shootCd = input.ads ? 0.14 : 0.11;
    player.ammo--;
    player.recoil = Math.min(0.08, player.recoil + 0.01);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    shoot(player, dir, 34, (input.ads ? 0.012 : 0.022) + player.recoil);
  }
  player.recoil *= 0.92;

  if (input.melee) {
    const near = destructibles.find(d => !d.destroyed && d.mesh.position.distanceTo(player.pos) < 1.5 && (d.type === 'door' || d.type === 'wall'));
    if (near) { near.hp -= 28; if (near.hp <= 0) destroyDestructible(near); makeNoise(near.mesh.position, 6.2, player.team); }
    input.melee = false;
  }

  if (input.keys['KeyC']) addPing(player.pos.clone(), player.team);
  if (player.team === 'atk' && player.alive) tryPickupDroppedBomb(player, player.pos);
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
      beginActionPhase();
    }
    if (state.phase === 'action' && !state.bombPlanted && state.phaseTime <= 0) endRound('def');
    if (state.bombPlanted && state.bombTimer <= 0) endRound('atk');

    if (state.phase === 'action' || state.bombPlanted) {
      const atkAlive = bots.filter((b) => !b.dead && b.team === 'atk').length + (player.team === 'atk' && player.alive ? 1 : 0);
      const defAlive = bots.filter((b) => !b.dead && b.team === 'def').length + (player.team === 'def' && player.alive ? 1 : 0);
      if (atkAlive === 0) endRound('def');
      if (defAlive === 0) endRound('atk');
    }

    player.abilityCd -= dt;
    player.pingCd -= dt;
    shakeT = Math.max(0, shakeT - dt * 2.4);

    updateAIWorldState(dt);
    applyMobileInput();
    gamepadUpdate();
    updatePlayer(dt);
    bots.forEach(b => { b.suppressing = Math.max(0, b.suppressing - dt); botThink(b, dt); });
    updateBombVisuals(dt);

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

    rainDrops.forEach((drop) => {
      drop.position.y -= drop.userData.speed * dt;
      if (drop.position.y < 0.12) {
        drop.position.y = 3 + Math.random() * 9;
        drop.position.x = player.pos.x + (Math.random() - 0.5) * 30;
        drop.position.z = player.pos.z + (Math.random() - 0.5) * 30;
      }
    });

    trails.forEach(t => {
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.08);
      t.mesh.material.transparent = true;
      if (t.life <= 0) t.mesh.visible = false;
    });
    for (let i = trails.length - 1; i >= 0; i--) if (trails[i].life <= 0) trails.splice(i, 1);

    teammateOutlines.forEach((entry) => {
      const ownerBot = bots.find((b) => b.mesh === entry.owner);
      if (!ownerBot || ownerBot.dead || ownerBot.team !== player.team || !player.alive) {
        entry.mesh.visible = false;
        return;
      }
      entry.mesh.position.copy(ownerBot.mesh.position);
      const toMate = ownerBot.mesh.position.clone().setY(1.35).sub(player.pos);
      const distance = toMate.length();
      raycaster.set(player.pos.clone().setY(1.4), toMate.normalize());
      const blockers = visionOccluders.filter((m) => m.visible !== false);
      const hit = raycaster.intersectObjects(blockers, false)[0];
      const occluded = !!hit && hit.distance < distance;
      entry.mesh.visible = occluded && distance > 1.5;
      entry.mesh.material.opacity = occluded ? THREE.MathUtils.clamp(0.9 - distance / 24, 0.25, 0.75) : 0;
    });
  }

  flickerLights.forEach((l, i) => {
    l.intensity = 0.65 + Math.sin(performance.now() * 0.003 + i * 2) * 0.16 + Math.random() * 0.05;
  });
  tacticalFxMeshes.forEach((fx, i) => {
    if (fx.userData.fxType === 'ring') {
      fx.rotation.z += dt * (0.4 + i * 0.08) * fx.userData.dir;
      fx.material.opacity = 0.38 + Math.sin(performance.now() * 0.004 + i) * 0.14;
    } else if (fx.userData.fxType === 'beam') {
      fx.material.opacity = 0.16 + Math.sin(performance.now() * 0.005 + fx.userData.phase) * 0.09;
      fx.position.y = 1.75 + Math.sin(performance.now() * 0.003 + i) * 0.16;
    }
  });
  if (objectiveIntelMesh && objectiveIntelPulse) {
    const intelVisible = state.atkObjectiveKnown && player.team === 'atk';
    objectiveIntelMesh.visible = intelVisible;
    objectiveIntelPulse.visible = intelVisible;
    if (intelVisible) {
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.2;
      objectiveIntelMesh.scale.setScalar(pulse);
      objectiveIntelPulse.scale.setScalar(0.92 + Math.sin(performance.now() * 0.007) * 0.18);
      objectiveIntelPulse.material.opacity = 0.4 + Math.sin(performance.now() * 0.008) * 0.18;
      objectiveIntelPulse.rotation.z += dt * 0.7;
    }
  }
  if (damageVignette) damageVignette.style.opacity = (0.45 + (1 - Math.max(0, player.hp) / 100) * 0.35).toFixed(2);

  if (!player.alive) {
    player.deathAnim = Math.min(1.3, (player.deathAnim || 0) + dt * 1.5);
    const fall = THREE.MathUtils.smootherstep(Math.min(player.deathAnim, 1), 0, 1);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, player.deathTilt || 0.2, dt * 3.2);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, player.pos.y - 0.95, fall * 0.35);
  } else {
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, dt * 8);
  }

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
