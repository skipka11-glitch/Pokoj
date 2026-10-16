// The Caffeine Trick — a deterministic, time-driven 3D explainer.
// Every visual is a pure function of time t (seconds), so the same page can
// play live in a browser or be captured frame-by-frame by render.mjs.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const W = 1920, H = 1080;
export const TOTAL = 33;
const S2 = 10, S3 = 23; // scene start times

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeInOut = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutBack = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const win = (t, a, b, fin = .35, fout = .35) => ss(a, a + fin, t) * (1 - ss(b - fout, b, t)); // fade-in/out window
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// piecewise keyframes: [[t, value], ...] with smooth interpolation
function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    if (t <= list[i][0]) {
      const [t0, a] = list[i - 1], [t1, b] = list[i];
      return lerp(a, b, easeInOut((t - t0) / (t1 - t0)));
    }
  }
  return list[list.length - 1][1];
}
function keysV(list, t) { // list of [t, Vector3]
  if (t <= list[0][0]) return list[0][1].clone();
  for (let i = 1; i < list.length; i++) {
    if (t <= list[i][0]) {
      const [t0, a] = list[i - 1], [t1, b] = list[i];
      return a.clone().lerp(b, easeInOut((t - t0) / (t1 - t0)));
    }
  }
  return list[list.length - 1][1].clone();
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  tex.userData.ctx = g; return tex;
}
function softDot(color = '#fff') {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color); gr.addColorStop(.35, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
RectAreaLightUniformsLib.init();

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.7, 0.55, 0.82);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

// =================================================================== ROOM
const room = new THREE.Scene();
room.background = new THREE.Color(0x04060c);
room.fog = new THREE.Fog(0x04060c, 2.5, 7);
const roomCam = new THREE.PerspectiveCamera(30, W / H, 0.02, 40);

const M = (color, rough = .7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

// floor + walls
add(room, new THREE.PlaneGeometry(12, 12), M(0x1a120e, .8), 0, 0, 0).rotation.x = -Math.PI / 2;
const wallM = M(0x161b2a, .95);
const leftWall = add(room, new THREE.PlaneGeometry(8, 4), wallM, -2.2, 2, 0); leftWall.rotation.y = Math.PI / 2;
const backWall = add(room, new THREE.PlaneGeometry(8, 4), wallM, 0, 2, 1.9); backWall.rotation.y = Math.PI;
add(room, new THREE.PlaneGeometry(8, 4), wallM, 0, 2, -2.4);

// night-city window on the left wall
const cityTex = canvasTex(1024, 700, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#060b22'); sky.addColorStop(1, '#1d2552');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(800, 120, 34, 0, 7); g.fill();
  const r = rng(7);
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < w) {
      const bw = 60 + r() * 110, bh = (layer ? 180 : 300) + r() * 300;
      g.fillStyle = layer ? '#0b1026' : '#05081a'; g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 14; wy < h - 10; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) {
        if (r() < (layer ? .18 : .28)) { g.fillStyle = r() < .7 ? '#ffc56b' : '#9fd6ff'; g.globalAlpha = .5 + r() * .5; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      }
      x += bw + 4;
    }
  }
});
const cityM = new THREE.MeshBasicMaterial({ map: cityTex, color: 0x9aa4c8 });
const cityPlane = add(room, new THREE.PlaneGeometry(1.7, 1.15), cityM, -2.18, 1.55, -0.2); cityPlane.rotation.y = Math.PI / 2;
const frameM = M(0x0c0d12, .6);
[.6, -.6].forEach(dy => add(room, new THREE.BoxGeometry(.06, .05, 1.8), frameM, -2.16, 1.55 + dy, -.2));
add(room, new THREE.BoxGeometry(.06, 1.2, .04), frameM, -2.16, 1.55, -.2);
add(room, new THREE.BoxGeometry(.06, 1.2, .05), frameM, -2.16, 1.55, -1.1);
add(room, new THREE.BoxGeometry(.06, 1.2, .05), frameM, -2.16, 1.55, .7);

// shelf with books on the left wall
const shelf = add(room, new THREE.BoxGeometry(.3, .03, 1.2), M(0x2a1d16, .7), -2.03, .95, .9);
{ const r = rng(3); let z = .35; while (z < 1.45) { const bw = .04 + r() * .04, bh = .18 + r() * .1; add(room, new THREE.BoxGeometry(.2, bh, bw), M(new THREE.Color().setHSL(r(), .45, .25), .8), -2.03, .965 + bh / 2, z); z += bw + .006; } }

// desk
const wood = M(0x2b1c14, .55);
add(room, new THREE.BoxGeometry(2.0, .05, .95), wood, 0, .725, -.8);
[[-.95, -1.22], [.95, -1.22], [-.95, -.38], [.95, -.38]].forEach(([x, z]) => add(room, new THREE.BoxGeometry(.05, .7, .05), wood, x, .35, z));
// monitor
const monX = -.06, monY = 1.13, monZ = -1.15;
add(room, new THREE.BoxGeometry(.7, .43, .03), M(0x0b0c10, .4), monX, monY, monZ);
add(room, new THREE.BoxGeometry(.05, .26, .04), M(0x15161c, .4), monX, .86, monZ - .03);
add(room, new THREE.BoxGeometry(.24, .015, .16), M(0x15161c, .4), monX, .757, monZ - .02);
const screenTex = canvasTex(1024, 600, () => {});
const screenM = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
add(room, new THREE.PlaneGeometry(.66, .39), screenM, monX, monY, monZ + .016);
// sticky notes
add(room, new THREE.PlaneGeometry(.06, .06), M(0xffd84d, .9, { emissive: 0x332a00 }), monX + .32, monY + .16, monZ + .02).rotation.z = .1;
add(room, new THREE.PlaneGeometry(.06, .06), M(0xff7aa8, .9, { emissive: 0x331020 }), monX + .33, monY + .09, monZ + .02).rotation.z = -.08;
// keyboard, papers, phone
const kb = add(room, new THREE.BoxGeometry(.46, .018, .15), M(0x1b1d24, .5), 0, .76, -.66);
const keyGlow = add(room, new THREE.PlaneGeometry(.43, .12), new THREE.MeshBasicMaterial({ color: 0x3a6bff, transparent: true, opacity: .25 }), 0, .7701 + .0005, -.66); keyGlow.rotation.x = -Math.PI / 2;
const paper = add(room, new THREE.BoxGeometry(.21, .003, .29), M(0xd8d2c4, .9), -.55, .752, -.6); paper.rotation.y = .25;
add(room, new THREE.BoxGeometry(.2, .003, .28), M(0xcfc8b8, .9), -.5, .755, -.66).rotation.y = -.1;
add(room, new THREE.BoxGeometry(.07, .008, .15), M(0x0a0a0c, .3), .55, .755, -.75).rotation.y = -.3;
// desk lamp (left of monitor)
const lampM = M(0x222428, .4, { metalness: .6 });
add(room, new THREE.CylinderGeometry(.07, .08, .02, 24), lampM, -.72, .76, -1.0);
const lampArm = add(room, new THREE.CylinderGeometry(.01, .01, .42, 8), lampM, -.72, .97, -1.0);
const lampHead = add(room, new THREE.ConeGeometry(.09, .12, 24, 1, true), M(0x222428, .4, { metalness: .6, side: THREE.DoubleSide }), -.66, 1.18, -.93);
lampHead.rotation.set(-.5, 0, -.6);
const bulb = add(room, new THREE.SphereGeometry(.03, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false }), -.655, 1.145, -.92);
// chair
const chairM = M(0x121318, .6);
add(room, new THREE.BoxGeometry(.5, .06, .48), chairM, 0, .5, .2);
add(room, new THREE.BoxGeometry(.48, .62, .05), chairM, 0, .86, .47).rotation.x = -.1;
add(room, new THREE.CylinderGeometry(.03, .03, .45, 8), chairM, 0, .25, .2);

// ---------------------------------------------------------------- person
const skinM = M(0xd49a76, .5), hoodM = M(0x2f3b5a, .9), hairM = M(0x1a120d, .95), darkM = M(0x2a0d0a, .5), jeansM = M(0x1d2433, .9);
const person = new THREE.Group(); room.add(person);
const torsoPivot = new THREE.Group(); torsoPivot.position.set(0, .55, .16); person.add(torsoPivot);
{ const t = add(torsoPivot, new THREE.CapsuleGeometry(.16, .3, 8, 24), hoodM, 0, .3, 0); t.scale.set(1.2, 1, .75);
  const hood = add(torsoPivot, new THREE.TorusGeometry(.1, .04, 10, 24), hoodM, 0, .5, .03); hood.rotation.x = Math.PI / 2 + .3; }
// legs (under desk)
[-.1, .1].forEach(x => {
  const th = add(person, new THREE.CapsuleGeometry(.065, .34, 6, 12), jeansM, x, .56, -.05); th.rotation.x = Math.PI / 2;
  add(person, new THREE.CapsuleGeometry(.055, .4, 6, 12), jeansM, x, .3, -.26);
});
const neck = new THREE.Group(); neck.position.set(0, .52, -.01); torsoPivot.add(neck);
add(neck, new THREE.CylinderGeometry(.045, .05, .1, 16), skinM, 0, .04, 0);
const head = new THREE.Group(); head.position.set(0, .17, -.015); neck.add(head);
{ const hs = add(head, new THREE.SphereGeometry(.125, 48, 32), skinM); hs.scale.set(.92, 1.06, 1);
  const hair = add(head, new THREE.SphereGeometry(.133, 48, 24, 0, Math.PI * 2, 0, Math.PI * .5), hairM, 0, .012, .012); hair.rotation.x = .55; hair.scale.set(.96, 1.04, 1.04);
  const fringe = add(head, new THREE.SphereGeometry(.05, 16, 8), hairM, .015, .1, -.075); fringe.scale.set(2.1, .6, 1.1); fringe.rotation.x = -.5;
  [-1, 1].forEach(s => add(head, new THREE.SphereGeometry(.025, 12, 8), skinM, s * .115, 0, .01).scale.set(.5, 1.1, .9));
  add(head, new THREE.SphereGeometry(.02, 16, 8), skinM, 0, -.015, -.128).scale.set(.9, 1, 1.3);
}
const eyes = [-1, 1].map(s => {
  const g = new THREE.Group(); g.position.set(s * .042, .018, -.1); head.add(g);
  add(g, new THREE.SphereGeometry(.018, 24, 16), M(0xf1efe8, .25));
  const iris = add(g, new THREE.SphereGeometry(.0095, 16, 12), M(0x2b1a10, .2), 0, 0, -.0135); iris.scale.z = .5;
  add(g, new THREE.SphereGeometry(.0026, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), .0035, .0035, -.018);
  const lid = add(g, new THREE.SphereGeometry(.0205, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skinM);
  const bag = add(head, new THREE.SphereGeometry(.016, 12, 8), new THREE.MeshStandardMaterial({ color: 0x5a3550, roughness: .8, transparent: true, opacity: .55 }), s * .042, -.008, -.104);
  bag.scale.set(1.3, .45, .4);
  const brow = add(head, new THREE.BoxGeometry(.04, .007, .01), hairM, s * .042, .052, -.115);
  return { g, lid, bag, brow, s };
});
const mouth = add(head, new THREE.SphereGeometry(.018, 16, 12), darkM, 0, -.062, -.11); mouth.scale.set(1.3, .25, .5);

function makeArm(side) {
  const shoulder = new THREE.Group(); shoulder.position.set(side * .2, .44, 0); torsoPivot.add(shoulder);
  add(shoulder, new THREE.SphereGeometry(.06, 16, 12), hoodM);
  add(shoulder, new THREE.CapsuleGeometry(.052, .2, 6, 16), hoodM, 0, -.14, 0);
  const elbow = new THREE.Group(); elbow.position.y = -.28; shoulder.add(elbow);
  add(elbow, new THREE.CapsuleGeometry(.047, .18, 6, 16), hoodM, 0, -.12, 0);
  const hand = new THREE.Group(); hand.position.y = -.26; elbow.add(hand);
  add(hand, new THREE.SphereGeometry(.042, 16, 12), skinM, 0, -.02, 0).scale.set(.8, 1.1, .9);
  return { shoulder, elbow, hand, side };
}
const armR = makeArm(1), armL = makeArm(-1);
const L1 = .28, L2 = .26 + .02;
// analytic two-bone IK: put the hand at a world-space target
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion();
function solveArm(arm, targetWorld, pole) {
  torsoPivot.updateMatrixWorld(true);
  _inv.copy(torsoPivot.matrixWorld).invert();
  const tgt = targetWorld.clone().applyMatrix4(_inv).sub(arm.shoulder.position);
  let d = Math.min(tgt.length(), L1 + L2 - 1e-3);
  const dn = tgt.clone().normalize();
  const cosE = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
  const bend = Math.PI - Math.acos(cosE);
  const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const p = pole.clone().sub(dn.clone().multiplyScalar(pole.dot(dn))).normalize();
  const u = dn.clone().multiplyScalar(Math.cos(alpha)).add(p.multiplyScalar(Math.sin(alpha))).normalize();
  const bendDir = dn.clone().sub(u.clone().multiplyScalar(dn.dot(u))).normalize();
  const Y = u.clone().negate(), Z = bendDir.clone().negate(), X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  Z.crossVectors(X, Y);
  _m.makeBasis(X, Y, Z); arm.shoulder.quaternion.setFromRotationMatrix(_m);
  arm.elbow.rotation.set(bend, 0, 0);
}

// mug
const mug = new THREE.Group(); room.add(mug);
{ const ceramic = M(0xe9dfd0, .35);
  const body = add(mug, new THREE.CylinderGeometry(.043, .039, .105, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9dfd0, roughness: .35, side: THREE.DoubleSide }));
  add(mug, new THREE.CircleGeometry(.039, 32), ceramic, 0, -.052, 0).rotation.x = Math.PI / 2;
  const coffee = add(mug, new THREE.CircleGeometry(.04, 32), M(0x2e1a0f, .15, { emissive: 0x1a0a02 }), 0, .035, 0); coffee.rotation.x = -Math.PI / 2;
  const handle = add(mug, new THREE.TorusGeometry(.027, .008, 10, 24, Math.PI * 1.2), ceramic, .043, 0, 0); handle.rotation.z = -Math.PI * .6;
  const band = add(mug, new THREE.CylinderGeometry(.0435, .0425, .018, 32, 1, true), M(0xc8553d, .5), 0, .02, 0);
}
const mugLight = new THREE.PointLight(0xff9a4d, .03, .4, 2); room.add(mugLight);
// steam
const steamTex = softDot('#ffffff');
const steam = Array.from({ length: 26 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffe9d6 })); room.add(s); return s; });

// energy FX for scene 3
const sparkTex = softDot('#ffd27a');
const sparks = Array.from({ length: 40 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false })); room.add(s); return s; });
const burst = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
room.add(burst);

// lights
const hemi = new THREE.HemisphereLight(0x3a4c86, 0x0a0705, .35); room.add(hemi);
const screenLight = new THREE.RectAreaLight(0x9cbcff, 14, .66, .39);
screenLight.position.set(monX, monY, monZ + .03); screenLight.lookAt(0, 1.25, 0); room.add(screenLight);
const lampLight = new THREE.PointLight(0xffa255, .9, 3.5, 2); lampLight.position.copy(bulb.position); room.add(lampLight);
const fill = new THREE.PointLight(0x6d8cff, 1.2, 3, 2); fill.position.set(1.0, 1.5, -.8); room.add(fill);
const moon = new THREE.DirectionalLight(0x6f88d4, .6); moon.position.set(-3, 2, .2); room.add(moon);
const rim = new THREE.SpotLight(0x7d93ff, 0, 5, .5, .6, 1.5); rim.position.set(-.6, 2.0, 1.4); rim.target.position.set(0, 1.25, 0); room.add(rim, rim.target);
const key = new THREE.SpotLight(0xffe0b8, 0, 6, .55, .7, 1.5); key.position.set(1.3, 2.1, -1.6); key.target.position.set(0, 1.2, 0); room.add(key, key.target);
const energyLight = new THREE.PointLight(0xffc35a, 0, 1.5, 2); room.add(energyLight);

// monitor content
const codeLines = (() => { const r = rng(11); return Array.from({ length: 200 }, () => {
  const indent = Math.floor(r() * 4), toks = []; let n = 1 + Math.floor(r() * 5);
  while (n--) toks.push([30 + r() * 140, ['#7aa2ff', '#ffb86b', '#c3e88d', '#f78c6c', '#c792ea', '#89ddff', '#a6accd'][Math.floor(r() * 7)]]);
  return { indent, toks, blank: r() < .1 };
}); })();
function drawScreen(t, energy) {
  const g = screenTex.userData.ctx, w = 1024, h = 600;
  g.fillStyle = '#0d1020'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#151a30'; g.fillRect(0, 0, w, 34); g.fillRect(0, 0, 60, h);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(22 + i * 22, 17, 6, 0, 7); g.fill(); });
  const speed = lerp(1.2, 14, energy), scroll = t * speed * 10, lh = 26;
  const first = Math.floor(scroll / lh);
  for (let i = 0; i < 24; i++) {
    const L = codeLines[(first + i) % codeLines.length], y = 50 + i * lh - (scroll % lh);
    if (y < 36) continue;
    g.fillStyle = '#3b4266'; g.fillRect(18, y + 6, 26, 8);
    if (L.blank) continue;
    let x = 80 + L.indent * 34;
    for (const [len, c] of L.toks) { g.fillStyle = c; g.globalAlpha = .9; g.fillRect(x, y + 4, len, 12); x += len + 14; }
    g.globalAlpha = 1;
  }
  // blinking cursor
  if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = '#ffffff'; g.fillRect(420, 50 + 15 * lh, 12, 20); }
  screenTex.needsUpdate = true;
}

// ============================================================ MICRO WORLD
const micro = new THREE.Scene();
micro.background = new THREE.Color(0x060818);
micro.fog = new THREE.FogExp2(0x070a20, .045);
const microCam = new THREE.PerspectiveCamera(40, W / H, .05, 120);

// cell membrane: bumpy surface carpeted with lipid heads
{ const geo = new THREE.PlaneGeometry(60, 40, 160, 110); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * .35) * .18 + Math.cos(z * .5 + x * .15) * .15); }
  geo.computeVertexNormals();
  add(micro, geo, new THREE.MeshStandardMaterial({ color: 0x2b1648, roughness: .6, emissive: 0x12062a }), 0, -1.3, 0);
  const n = 8000, r = rng(5);
  const lip = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc46be0, roughness: .35, emissive: 0x3a0f55 }), n);
  const o = new THREE.Object3D(); let k = 0;
  for (let gx = -16; gx < 16 && k < n; gx += .36) for (let gz = -14; gz < 9 && k < n; gz += .36) {
    const x = gx + (r() - .5) * .08, z = gz + (r() - .5) * .08;
    if ([-3.2, 0, 3.2].some(rx => Math.hypot(x - rx, z) < 1.25)) continue;
    o.position.set(x, -1.3 + Math.sin(x * .35) * .18 + Math.cos(z * .5 + x * .15) * .15 + .05, z);
    o.scale.setScalar(.85 + r() * .3); o.updateMatrix(); lip.setMatrixAt(k++, o.matrix);
  }
  lip.count = k; micro.add(lip);
}

// receptors
const receptorX = [-3.2, 0, 3.2];
const receptors = receptorX.map((x, i) => {
  const g = new THREE.Group(); g.position.set(x, -1.3, 0); micro.add(g);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x139c8e, roughness: .35, clearcoat: .8, emissive: 0x032622 });
  add(g, new THREE.CylinderGeometry(1.0, 1.25, .5, 40), mat, 0, 0, 0);
  [-1, 1].forEach(s => { const l = add(g, new THREE.CapsuleGeometry(.34, 1.0, 10, 24), mat, s * .78, .75, 0); l.rotation.z = -s * .16; });
  const back = add(g, new THREE.CapsuleGeometry(.36, .8, 10, 24), mat, 0, .62, -.62); back.rotation.x = .2;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5ff5dc, toneMapped: false, transparent: true, opacity: .9 });
  const ring = add(g, new THREE.TorusGeometry(.5, .035, 12, 64), ringMat, 0, 1.0, .05); ring.rotation.x = Math.PI / 2;
  const light = new THREE.PointLight(0x5ff5dc, 1, 3, 2); light.position.set(0, 1.0, .5); g.add(light);
  // "blocked" badge
  const badgeTex = canvasTex(256, 256, (c) => {
    c.strokeStyle = '#ff4d5e'; c.lineWidth = 22; c.shadowColor = '#ff4d5e'; c.shadowBlur = 20;
    c.beginPath(); c.arc(128, 128, 90, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(64, 192); c.lineTo(192, 64); c.stroke();
  });
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex, transparent: true, opacity: 0, toneMapped: false, depthTest: false }));
  badge.position.set(0, 2.55, .2); g.add(badge);
  // sleepy-signal wave along the membrane
  const wave = add(g, new THREE.RingGeometry(.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0xa58bff, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }), 0, .3, 0);
  wave.rotation.x = -Math.PI / 2;
  return { g, mat, ring, ringMat, light, badge, wave, dock: v3(x, -.42, .1) };
});

// molecules — adenosine and caffeine share the same purine core
function purine(b) {
  const hex = [...Array(6)].map((_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [b * Math.cos(a), b * Math.sin(a)]; });
  const R = b / (2 * Math.sin(Math.PI / 5)), cx = b * Math.cos(Math.PI / 6) + b / (2 * Math.tan(Math.PI / 5));
  const pent = [72, 0, -72].map(d => [cx + R * Math.cos(d * Math.PI / 180), R * Math.sin(d * Math.PI / 180)]);
  return { hex, pent, cx, R }; // hex[0]=30deg, hex[5]=-30deg are shared with pentagon
}
function buildMolecule(kind) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const b = .2, { hex, pent, cx, R } = purine(b);
  const base = kind === 'caf' ? 0xffa53a : 0x8c7bff;
  const atomM = new THREE.MeshStandardMaterial({ color: base, roughness: .25, emissive: base, emissiveIntensity: .55 });
  const nM = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: .25, emissive: 0x8899ff, emissiveIntensity: .35 });
  const oM = new THREE.MeshStandardMaterial({ color: 0xff5a6e, roughness: .25, emissive: 0xff2040, emissiveIntensity: .45 });
  const meM = new THREE.MeshStandardMaterial({ color: 0xffe2a8, roughness: .3, emissive: 0xffb347, emissiveIntensity: .4 });
  const bondM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3, emissive: base, emissiveIntensity: .3 });
  const atoms = [], bonds = [];
  const A = (x, y, r, m) => { atoms.push([x, y, r, m]); return atoms.length - 1; };
  const hI = hex.map((p, i) => A(p[0], p[1], .075, i % 2 ? nM : atomM));
  const pI = pent.map((p, i) => A(p[0], p[1], .075, i === 1 ? atomM : nM));
  for (let i = 0; i < 6; i++) bonds.push([hI[i], hI[(i + 1) % 6]]);
  bonds.push([hI[0], pI[0]], [pI[0], pI[1]], [pI[1], pI[2]], [pI[2], hI[5]]);
  const out = (idx, dirx, diry, len, r, m) => { const [x, y] = atoms[idx]; const k = A(x + dirx * len, y + diry * len, r, m); bonds.push([idx, k]); return k; };
  const dirOf = (p, c = [0, 0]) => { const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  if (kind === 'caf') {
    out(hI[1], ...dirOf(hex[1]), b, .09, oM);         // C=O
    out(hI[3], ...dirOf(hex[3]), b, .09, oM);         // C=O
    out(hI[2], ...dirOf(hex[2]), b * 1.05, .11, meM);   // CH3
    out(hI[4], ...dirOf(hex[4]), b * 1.05, .11, meM);   // CH3
    out(pI[0], ...dirOf(pent[0], [cx, 0]), b * 1.05, .11, meM); // CH3
  } else {
    out(hI[1], ...dirOf(hex[1]), b, .07, nM); // NH2
    const n9 = pI[2]; const [dx, dy] = dirOf(pent[2], [cx, 0]);
    const ribC = [pent[2][0] + dx * (b + R), pent[2][1] + dy * (b + R)], rot = Math.atan2(-dy, -dx);
    const rI = [...Array(5)].map((_, i) => { const a = rot + i * 2 * Math.PI / 5; return A(ribC[0] + R * Math.cos(a), ribC[1] + R * Math.sin(a), .07, i === 2 ? oM : atomM); });
    for (let i = 0; i < 5; i++) bonds.push([rI[i], rI[(i + 1) % 5]]);
    bonds.push([n9, rI[0]]);
    out(rI[1], ...dirOf(atoms[rI[1]], ribC), b * .9, .065, oM);
    out(rI[4], ...dirOf(atoms[rI[4]], ribC), b * .9, .065, oM);
  }
  // center the 2D drawing then lift to 3D (slight puckering for depth)
  let mx = 0, my = 0; atoms.forEach(a => { mx += a[0]; my += a[1]; }); mx /= atoms.length; my /= atoms.length;
  const P = atoms.map((a, i) => v3(a[0] - mx, a[1] - my, Math.sin(i * 1.7) * .03));
  const sph = new THREE.SphereGeometry(1, 24, 16), cyl = new THREE.CylinderGeometry(.022, .022, 1, 10);
  atoms.forEach((a, i) => { const m = new THREE.Mesh(sph, a[3]); m.scale.setScalar(a[2]); m.position.copy(P[i]); inner.add(m); });
  bonds.forEach(([i, j]) => {
    const m = new THREE.Mesh(cyl, bondM), d = P[j].clone().sub(P[i]);
    m.position.copy(P[i]).addScaledVector(d, .5); m.scale.y = d.length();
    m.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize()); inner.add(m);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(kind === 'caf' ? '#ffb347' : '#9a88ff'), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(1.6); g.add(halo);
  g.scale.setScalar(1.2); micro.add(g);
  return { g, inner, halo };
}

// floating ambient particles
{ const n = 900, r = rng(9), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * 30; pos[i * 3 + 1] = -1 + r() * 10; pos[i * 3 + 2] = -12 + r() * 16; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: .07, map: softDot('#bfa8ff'), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xb9a6ff }));
  micro.add(dust);
}

micro.add(new THREE.HemisphereLight(0x7d8cff, 0x200a3a, 1.1));
const mKey = new THREE.DirectionalLight(0xffffff, 1.6); mKey.position.set(3, 8, 6); micro.add(mKey);
const mRim = new THREE.DirectionalLight(0xff7bd5, 1.2); mRim.position.set(-6, 3, -6); micro.add(mRim);

// molecule cast and their paths (local scene-2 time u)
const crv = (...pts) => new THREE.CatmullRomCurve3(pts.map(p => v3(...p)));
const R = receptors.map(r => r.dock);
const slot = i => R[i].clone().add(v3(0, .5, .25));
const cast = {
  A0: { kind: 'ade', legs: [[.6, 3.5, crv([-9, 3.6, -3], [-6, 2.6, -.5], [-3.6, 1.1, .4], R[0].toArray())], [5.0, 7.0, crv(R[0].toArray(), [-3.8, 1.2, 1.2], [-6.2, 2.6, .8], [-7.5, 3.3, -.5])]], spin: 1 },
  C1: { kind: 'caf', legs: [[4.3, 5.6, crv([5.5, 5.2, 2.5], [2.4, 2.8, 1.6], [.3, .9, .5], R[1].toArray())]], spin: -1 },
  C2: { kind: 'caf', legs: [[4.5, 6.0, crv([9.5, 3.4, -2], [6, 2.1, .6], [3.5, .9, .4], R[2].toArray())]], spin: 1 },
  C0: { kind: 'caf', legs: [[5.4, 6.8, crv([-1.5, 5.6, 3.5], [-2.4, 2.4, 1.4], [-3.25, .7, .5], R[0].toArray())]], spin: -1 },
  A1: { kind: 'ade', legs: [[5.0, 7.0, crv([-7, 1.8, 3.5], [-3, 1.9, 2.3], slot(1).toArray())], [7.0, 9.0, crv(slot(1).toArray(), [-1.0, 2.0, 2.2], [-2.2, 3.0, 2.0])]], spin: 1, hit: 7.0, at: 1 },
  A2: { kind: 'ade', legs: [[5.5, 7.6, crv([9, 1.2, 3.5], [5.5, 1.6, 2.4], slot(2).toArray())], [7.6, 9.6, crv(slot(2).toArray(), [4.3, 2.2, 1.9], [5.6, 3.1, 1.2])]], spin: -1, hit: 7.6, at: 2 },
  A3: { kind: 'ade', legs: [[7.4, 9.3, crv([-6, 5.5, 2], [-4, 2.4, 1.6], slot(0).toArray())], [9.3, 11.2, crv(slot(0).toArray(), [-4.6, 2.0, 1.6], [-5.4, 2.6, -.4])]], spin: 1, hit: 9.3, at: 0 },
};
for (const k in cast) Object.assign(cast[k], buildMolecule(cast[k].kind));
// late-arriving adenosine that piles up (accumulation)
const drifters = (() => { const r = rng(21); return Array.from({ length: 9 }, (_, i) => ({ t0: 7.8 + i * .42, from: v3((r() < .5 ? -1 : 1) * (8 + r() * 3), 1 + r() * 4, -2 + r() * 4), home: v3(-5 + r() * 10, 1.4 + r() * 2.4, -1.5 + r() * 3), ph: r() * 6, ...buildMolecule('ade') })); })();

function moleculePos(c, u) {
  const L = c.legs;
  if (u < L[0][0]) return null;
  for (let i = 0; i < L.length; i++) {
    const [a, b, curve] = L[i];
    if (u <= b) { const k = (u - a) / (b - a); return curve.getPoint(i === 0 ? 1 - Math.pow(1 - k, 2.2) : k * k * (3 - 2 * k) * .6 + k * .4); }
    if (i === L.length - 1) return curve.getPoint(1);
    if (u < L[i + 1][0]) return curve.getPoint(1);
  }
}

// glowing directional arrows
function makeArrow(points, color) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => v3(...p)));
  const tube = new THREE.TubeGeometry(curve, 80, .045, 10, false);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const mesh = new THREE.Mesh(tube, mat); micro.add(mesh);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.16, .38, 24), mat); micro.add(head);
  const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot('#ffffff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); pulse.scale.setScalar(.5); micro.add(pulse);
  return { curve, tube, mat, mesh, head, pulse };
}
const arrows = [
  { a: makeArrow([[-7.2, 3.4, -1.6], [-5.3, 2.2, -.2], [-3.6, .95, .45]], 0xa58bff), draw: [1.1, 2.1], out: [3.3, 3.8] },
  { a: makeArrow([[4.6, 4.6, 2.2], [2.2, 2.5, 1.5], [.45, .95, .6]], 0xffb347), draw: [4.35, 5.0], out: [5.6, 6.1] },
  { a: makeArrow([[8.2, 3.1, -1.4], [5.6, 1.9, .5], [3.65, .95, .5]], 0xffb347), draw: [4.55, 5.2], out: [5.9, 6.4] },
  { a: makeArrow([[-1.3, 2.2, 2.3], [-.8, 1.4, 1.5], [-.25, .55, .7]], 0xa58bff), draw: [6.0, 6.6], out: [6.9, 7.2] },
  { a: makeArrow([[.25, .7, .7], [-.5, 1.7, 1.8], [-1.4, 2.6, 2.3]], 0xff4d5e), draw: [7.0, 7.45], out: [8.4, 8.9] },
  { a: makeArrow([[3.45, .7, .7], [4.1, 1.8, 1.7], [5.0, 2.8, 1.4]], 0xff4d5e), draw: [7.6, 8.05], out: [9.0, 9.5] },
  { a: makeArrow([[-2.95, .7, .7], [-3.9, 1.6, 1.6], [-4.9, 2.4, 1.3]], 0xff4d5e), draw: [9.3, 9.75], out: [10.6, 11.1] },
];
function updateArrow({ a, draw, out }, u) {
  const p = clamp((u - draw[0]) / (draw[1] - draw[0])), op = (u > draw[0] ? 1 : 0) * (1 - ss(out[0], out[1], u));
  a.mat.opacity = op * .95;
  const segs = Math.max(1, Math.round(p * 80));
  a.tube.setDrawRange(0, segs * 10 * 6);
  const end = a.curve.getPointAt(clamp(p, .001, 1)), tan = a.curve.getTangentAt(clamp(p, .001, 1));
  a.head.position.copy(end); a.head.quaternion.setFromUnitVectors(v3(0, 1, 0), tan);
  a.head.scale.setScalar(op > 0 ? easeOutBack(clamp(p * 1.3)) : 0);
  const q = ((u - draw[0]) * .9) % 1;
  a.pulse.position.copy(a.curve.getPointAt(clamp(q))); a.pulse.material.opacity = op * (p >= 1 ? .9 : 0) * Math.sin(Math.PI * q);
}

// ============================================================== OVERLAY UI
const $ = s => document.querySelector(s);
const tagsEl = $('#tags');
function makeTag(color, title, sub, chip, dir = 1) {
  const el = document.createElement('div'); el.className = 'tag'; el.style.setProperty('--c', color);
  el.innerHTML = `<div class="ring"></div><div class="dot"></div><div class="line"></div><div class="box">${chip ? `<div class="chip">${chip}</div>` : ''}<div class="title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
  tagsEl.appendChild(el);
  return { el, dir, line: el.querySelector('.line'), box: el.querySelector('.box'), ring: el.querySelector('.ring'), dot: el.querySelector('.dot') };
}
const tags = {
  ade: makeTag('#a58bff', 'Adenosine', 'builds up all day &rarr; the &ldquo;tired&rdquo; signal', 'MOLECULE · FATIGUE', 1),
  rec: makeTag('#3fe0c5', 'Adenosine receptor', 'the brain&rsquo;s &ldquo;slow down&rdquo; switch', 'NEURON SURFACE', -1),
  act: makeTag('#a58bff', 'Receptor activated', '&rarr; you feel sleepy', null, 1),
  caf: makeTag('#ffb347', 'Caffeine', 'a look-alike molecule', 'MOLECULE · IMPOSTOR', -1),
  blk: makeTag('#ff4d5e', 'Blocked receptor', 'occupied &mdash; but never switched on', 'NO SIGNAL', 1),
};
const _p = new THREE.Vector3();
function placeTag(tag, world, cam, k, lineLen = 120, angle = -40) {
  if (k <= .001) { tag.el.style.display = 'none'; return; }
  _p.copy(world).project(cam);
  const x = (_p.x + 1) / 2 * W, y = (1 - _p.y) / 2 * H;
  tag.el.style.display = 'block';
  tag.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  const a = (tag.dir > 0 ? angle : 180 - angle) * Math.PI / 180;
  const kl = ss(0, .45, k), kt = ss(.3, 1, k);
  tag.dot.style.transform = `scale(${easeOutBack(clamp(k * 2.5)).toFixed(3)})`;
  tag.ring.style.transform = `scale(${(1 + ((performanceTime * 1.4) % 1) * .9).toFixed(3)})`; tag.ring.style.opacity = (1 - (performanceTime * 1.4) % 1) * k;
  tag.line.style.width = `${(lineLen * kl).toFixed(1)}px`;
  tag.line.style.transform = `rotate(${(a * 180 / Math.PI).toFixed(1)}deg)`;
  const ex = Math.cos(a) * lineLen, ey = Math.sin(a) * lineLen;
  const bw = tag.box.offsetWidth;
  tag.box.style.left = `${(tag.dir > 0 ? ex + 14 : ex - 14 - bw).toFixed(1)}px`;
  tag.box.style.top = `${(ey - 48).toFixed(1)}px`;
  tag.box.style.opacity = kt.toFixed(3);
  tag.box.style.transform = `translateY(${((1 - kt) * 18).toFixed(1)}px)`;
  tag.box.style.filter = `blur(${((1 - kt) * 6).toFixed(1)}px)`;
  tag.el.style.opacity = Math.min(1, k * 3).toFixed(3);
}
let performanceTime = 0;

// caption track
const captions = [
  [1.8, 4.6, 'Deadline tonight. The brain is begging to <em>shut down</em>.'],
  [5.0, 7.6, 'One more cup&hellip;'],
  [7.9, 9.5, 'But what is caffeine <em>actually</em> doing in there?'],
  [S2 + 1.3, S2 + 4.4, 'All day, <b>adenosine</b> builds up and docks onto receptors &mdash; that&rsquo;s the feeling of tiredness.'],
  [S2 + 4.6, S2 + 7.0, '<em>Caffeine</em> has almost the same shape&hellip; so it slips into the receptors first.'],
  [S2 + 7.2, S2 + 12.3, 'But it never switches them on. <b>Adenosine</b> can&rsquo;t dock &mdash; the &ldquo;tired&rdquo; signal never arrives.'],
];
const chapters = [[.4, 9.3, '01 &mdash; THE LATE SHIFT'], [S2 + .5, S2 + 12.3, '02 &mdash; INSIDE THE BRAIN'], [S3 + .6, S3 + 9.6, '03 &mdash; THE TRICK']];
const capEl = $('#caption'), chapEl = $('#chapter'), chapText = chapEl.querySelector('span');
let lastCap = null, lastChap = null;

const l1 = $('#takeaway .l1'), l2 = $('#takeaway .l2');
const words = (el, list) => list.map(([txt, hl]) => { const s = document.createElement('span'); s.className = 'w' + (hl ? ' hl' : ''); s.textContent = txt; if (hl) { const u = document.createElement('i'); u.className = 'ul'; s.appendChild(u); } el.appendChild(s); el.appendChild(document.createTextNode(' ')); return s; });
const w1 = words(l1, [['Caffeine'], ['doesn’t'], ['give'], ['you'], ['energy'], ['—']]);
const w2 = words(l2, [['it'], ['just'], ['delays tiredness.', true]]);

// grain
{ const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256), r = rng(1);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); $('#grain').style.backgroundImage = `url(${c.toDataURL()})`; }

// ================================================================= UPDATE
const headWorld = new THREE.Vector3();
function updateRoom(t) {
  const s3 = t >= S3, v = t - S3;
  const energy = s3 ? ss(0, .6, v) : 0;
  person.updateMatrixWorld(true);

  // posture
  const slouch = s3 ? lerp(-.3, -.06, easeOutBack(clamp(v / .7))) : keys([[0, -.22], [2.4, -.32], [2.6, -.18], [4.5, -.2], [6, -.14], [8, -.2]], t);
  torsoPivot.rotation.x = slouch;
  let nod;
  if (!s3) nod = keys([[0, -.12], [2.35, -.48], [2.55, .06], [2.9, -.06], [3.2, .18], [4.2, .2], [4.6, -.05], [5.6, .02], [6.6, .12], [7.4, 0], [9, -.12]], t);
  else nod = .04 + Math.sin(v * 9) * .015 * energy - (1 - ss(0, .35, v)) * .4;
  neck.rotation.x = nod;
  neck.rotation.y = s3 ? Math.sin(v * 1.3) * .05 : Math.sin(t * .6) * .03;
  neck.rotation.z = s3 ? 0 : keys([[0, .04], [2.3, .12], [2.6, 0], [9, .05]], t);

  // eyes: heavy lids + slow blinks vs. wide awake
  let open;
  if (!s3) {
    open = keys([[0, .38], [2.2, .12], [2.5, .7], [2.9, .4], [3.1, .05], [4.2, .05], [4.5, .38], [5.6, .3], [6.0, .05], [6.7, .05], [7.1, .45], [7.9, .45], [8.05, .05], [8.25, .5], [9, .5]], t);
  } else {
    open = lerp(.35, 1.08, easeOutBack(clamp(v / .4)));
    const bl = (v % 3.2) - 2.6; if (bl > 0 && bl < .16) open *= Math.abs(bl - .08) / .08;
  }
  eyes.forEach(e => {
    e.lid.rotation.x = -Math.PI / 2 * 1.05 + open * (Math.PI / 2 + .55);
    e.bag.material.opacity = .55 * (1 - energy);
    e.brow.position.y = .052 + energy * .012 - (s3 ? 0 : .004);
    e.brow.rotation.z = e.s * (s3 ? -.12 * energy : .14);
  });
  const yawn = s3 ? 0 : ss(3.05, 3.5, t) * (1 - ss(4.0, 4.4, t));
  mouth.scale.set(1.3 - yawn * .3, lerp(.25, 1.25, yawn) + (s3 ? .35 * energy : 0), .5);
  mouth.position.y = -.062 - yawn * .01;

  // right hand + mug
  const rest = v3(.25, .805, -.5), sip = v3(.035, 1.17, -.215);
  let mugPos, tilt = 0;
  if (!s3) {
    const lift = ss(4.6, 5.7, t) * (1 - ss(6.9, 7.9, t));
    mugPos = rest.clone().lerp(sip, easeInOut(lift)).add(v3(0, Math.sin(Math.PI * lift) * .05, 0));
    tilt = ss(5.5, 6.0, t) * (1 - ss(6.7, 7.1, t)) * .95 + lift * .15;
    // slide the mug a little closer first
    mugPos.x += (1 - ss(4.3, 4.7, t)) * .06;
  } else {
    mugPos = v3(.42, .805, -.62); tilt = 0;
  }
  mug.position.copy(mugPos); mug.rotation.set(tilt, 0, 0);
  mugLight.position.copy(mugPos).add(v3(0, .12, 0)); mugLight.intensity = s3 ? .01 : .03;
  const handGrip = mugPos.clone().add(v3(.078, -.004 + Math.sin(tilt) * .01, 0));
  const reachHome = !s3 && t < 4.3;
  let rTarget = reachHome ? v3(.3, .79, -.42).lerp(handGrip, ss(4.0, 4.4, t)) : handGrip;
  if (s3) rTarget = v3(.13, .79, -.66).add(v3(Math.sin(v * 31) * .015, Math.max(0, Math.sin(v * 23)) * .025 * energy, 0));
  solveArm(armR, rTarget, v3(.8, -1, .8));
  const lTarget = s3 ? v3(-.13, .79, -.66).add(v3(Math.sin(v * 27 + 1) * .015, Math.max(0, Math.sin(v * 19 + 2)) * .025 * energy, 0))
    : v3(-.2, .78, -.47).add(v3(0, 0, Math.sin(t * .7) * .01));
  solveArm(armL, lTarget, v3(-.8, -1, .8));

  // steam
  const top = mugPos.clone().add(v3(0, .06, 0));
  steam.forEach((s, i) => {
    const ph = ((t * .32 + i / steam.length) % 1);
    const sw = Math.sin(i * 12.9 + t * 1.7 + ph * 5) * .025 * ph * 2;
    s.position.set(top.x + sw, top.y + ph * .32, top.z + Math.cos(i * 7.1 + t) * .015 * ph * 2);
    s.scale.setScalar(.03 + ph * .1);
    s.material.opacity = Math.sin(Math.PI * ph) * .18 * (s3 ? .5 : 1);
  });

  // energy sparks + burst
  head.getWorldPosition(headWorld);
  sparks.forEach((s, i) => {
    const r = rng(i * 77 + 3), a0 = r() * 6.28, rad = .22 + r() * .25, spd = .6 + r() * .9, y0 = r() * .5 - .2;
    const ph = (v * spd * .5 + r()) % 1;
    s.position.set(headWorld.x + Math.cos(a0 + v * spd) * rad, headWorld.y + y0 + ph * .25, headWorld.z + Math.sin(a0 + v * spd) * rad);
    s.scale.setScalar(.008 + .014 * Math.sin(Math.PI * ph));
    s.material.opacity = s3 ? energy * Math.sin(Math.PI * ph) * .9 * (1 - ss(7.5, 9.5, v) * .6) : 0;
  });
  const bk = clamp((v - .15) / 1.0);
  burst.position.copy(headWorld); burst.lookAt(roomCam.position);
  burst.scale.setScalar(.05 + easeInOut(bk) * .6); burst.material.opacity = s3 ? (1 - bk) * .5 * (bk > 0 ? 1 : 0) : 0;
  energyLight.position.copy(headWorld).add(v3(.2, .35, -.25)); energyLight.intensity = s3 ? energy * (.12 + Math.sin(v * 6) * .03) : 0;

  // lighting moods
  hemi.intensity = s3 ? lerp(.35, .8, energy) : .35;
  hemi.color.set(s3 ? 0x8a8fb8 : 0x3a4c86);
  screenLight.intensity = (s3 ? lerp(14, 26, energy) : 14) * (1 + Math.sin(t * 13) * .02);
  lampLight.intensity = s3 ? lerp(.9, 2.0, energy) : .9;
  key.intensity = s3 ? energy * 2.2 : 0;
  rim.intensity = s3 ? energy * 4 : 2;
  renderer.toneMappingExposure = s3 ? lerp(.95, 1.1, energy) : .95;
  cityM.color.set(s3 ? 0xb8c0e0 : 0x9aa4c8);
  keyGlow.material.opacity = s3 ? .35 + Math.sin(v * 7) * .1 : .2;
  drawScreen(t, energy);

  // camera
  if (!s3) {
    const sway = v3(Math.sin(t * .7) * .006, Math.sin(t * 1.1) * .005, 0);
    const pos = keysV([[0, v3(2.1, 1.62, -.25)], [6.5, v3(1.25, 1.36, -.52)], [9.2, v3(.85, 1.32, -.3)]], t).add(sway);
    const look = keysV([[0, v3(-.3, 1.08, -.62)], [6.5, v3(-.12, 1.2, -.52)], [9.2, v3(0, 1.26, -.12)]], t);
    // dive into the head
    const dive = ss(9.2, 10.0, t);
    pos.lerp(head.getWorldPosition(new THREE.Vector3()).add(v3(.06, .04, -.01)), easeInOut(dive) * .97);
    roomCam.position.copy(pos); roomCam.lookAt(look.lerp(headWorld, dive));
    roomCam.fov = 30 + dive * 40;
  } else {
    const shake = (1 - ss(0, .8, v)) * .012;
    const pos = keysV([[0, v3(.75, 1.36, -1.0)], [10, v3(1.0, 1.45, -1.4)]], v).add(v3(Math.sin(v * 41) * shake, Math.cos(v * 37) * shake, 0));
    roomCam.position.copy(pos);
    roomCam.lookAt(lerp(-.02, .52, ss(1, 3.5, v)), lerp(1.24, 1.14, ss(1, 3.5, v)), lerp(-.05, .34, ss(1, 3.5, v)));
    roomCam.fov = lerp(26, 37, ss(0, 1.6, v));
  }
  roomCam.updateProjectionMatrix();
}

const molPos = new Map();
function updateMicro(t) {
  const u = t - S2;
  // camera descends from above into the synapse
  const arrive = ss(0, 2.6, u);
  const camPos = v3(0, 11, 13).lerp(v3(0, 3.4, 8.8), easeInOut(arrive));
  camPos.x += Math.sin(u * .35) * .6; camPos.y += Math.sin(u * .5) * .12;
  const push = ss(8.5, 12.0, u); camPos.lerp(v3(.6, 2.6, 7.4), push * .5);
  const exit = ss(12.0, 13.0, u); camPos.lerp(v3(0, 12, 14), easeInOut(exit));
  microCam.position.copy(camPos);
  microCam.lookAt(0, lerp(.1, .3, push), 0);
  microCam.fov = 40 + exit * 25; microCam.updateProjectionMatrix(); microCam.updateMatrixWorld();

  dust.rotation.y = u * .02; dust.position.y = Math.sin(u * .3) * .2;

  for (const k in cast) {
    const c = cast[k];
    const p = moleculePos(c, u);
    if (!p) { c.g.visible = false; continue; }
    c.g.visible = true;
    p.y += Math.sin(u * 2.1 + k.length) * .04;
    // bounce shudder when hitting a blocked slot
    if (c.hit) { const dh = u - c.hit; if (dh > 0 && dh < .45) p.x += Math.sin(dh * 60) * .06 * (1 - dh / .45); }
    c.g.position.copy(p);
    const appear = ss(c.legs[0][0], c.legs[0][0] + .5, u);
    c.g.scale.setScalar(1.2 * easeOutBack(appear));
    c.inner.rotation.set(Math.sin(u * .8) * .35 + .4, u * .7 * c.spin, Math.sin(u * .5) * .3);
    const settled = c.legs.length === 1 && u > c.legs[0][1];
    if (settled) c.inner.rotation.set(1.2, Math.sin(u * 3) * .08, 0); // lies flat in the pocket
    if (k === 'A0' && u > 3.5 && u < 5.0) c.inner.rotation.set(1.2, Math.sin(u * 3) * .08, 0);
    c.halo.material.opacity = .3 + Math.sin(u * 4) * .08;
    molPos.set(k, p);
  }
  drifters.forEach(d => {
    const k = ss(d.t0, d.t0 + 1.6, u);
    d.g.visible = u > d.t0;
    if (!d.g.visible) return;
    const p = d.from.clone().lerp(d.home, easeInOut(k));
    p.add(v3(Math.sin(u * .9 + d.ph) * .35, Math.sin(u * 1.3 + d.ph) * .2, Math.cos(u * .7 + d.ph) * .3));
    d.g.position.copy(p); d.g.scale.setScalar(1.05 * easeOutBack(ss(d.t0, d.t0 + .5, u)));
    d.inner.rotation.set(u * .5 + d.ph, u * .6, 0);
  });

  // receptor states
  const state = [
    u < 3.5 ? 'idle' : u < 5.0 ? 'on' : u < 6.8 ? 'idle' : 'block',
    u < 5.6 ? 'idle' : 'block',
    u < 6.0 ? 'idle' : 'block',
  ];
  const since = [u < 5.0 ? u - 3.5 : u - 6.8, u - 5.6, u - 6.0];
  receptors.forEach((r, i) => {
    const s = state[i];
    const col = s === 'on' ? new THREE.Color(0xb48cff) : s === 'block' ? new THREE.Color(0xff4d5e) : new THREE.Color(0x5ff5dc);
    const pulse = s === 'on' ? .5 + .5 * Math.sin(u * 14) : s === 'block' ? .7 + .3 * Math.sin(u * 5 + i) : .8;
    r.ringMat.color.copy(col).multiplyScalar(.7 + pulse * .8);
    r.light.color.copy(col); r.light.intensity = .6 + pulse * 1.4;
    r.ring.scale.setScalar(1 + (s !== 'idle' ? Math.max(0, .35 - since[i]) * 1.2 : 0));
    r.mat.emissive.set(s === 'on' ? 0x241050 : s === 'block' ? 0x300810 : 0x032622);
    r.mat.color.set(s === 'block' ? 0x8f6a74 : 0x139c8e);
    const bk = s === 'block' ? clamp(since[i] / .4) : 0;
    r.badge.material.opacity = bk * (.85 + .15 * Math.sin(u * 6));
    r.badge.scale.setScalar(.95 * easeOutBack(bk));
    // purple "sleepy" waves only while adenosine is docked
    const wk = s === 'on' ? ((u - 3.5) * .9) % 1 : 1;
    r.wave.scale.setScalar(1 + wk * 5); r.wave.material.opacity = s === 'on' ? (1 - wk) * .8 : 0;
  });

  arrows.forEach(a => updateArrow(a, u));

  // tags
  placeTag(tags.ade, (molPos.get('A0') || v3()).clone().add(v3(.2, .45, 0)), microCam, win(u, 1.4, 3.35, .6, .35), 130, -38);
  placeTag(tags.rec, receptors[1].dock.clone().add(v3(.75, .6, .2)), microCam, win(u, 1.8, 3.5, .5, .3), 110, 28);
  placeTag(tags.act, receptors[0].dock.clone().add(v3(0, -.5, .9)), microCam, win(u, 3.6, 5.0, .4, .3), 110, 30);
  placeTag(tags.caf, (molPos.get('C2') || v3()).clone().add(v3(-.1, .45, 0)), microCam, win(u, 4.6, 6.6, .5, .4), 120, -42);
  placeTag(tags.blk, receptors[1].dock.clone().add(v3(.45, .3, .3)), microCam, win(u, 6.0, 12.1, .6, .4), 160, -30);
}

function updateOverlay(t) {
  const v = t - S3;
  // caption
  const cap = captions.find(([a, b]) => t >= a && t < b);
  if (cap !== lastCap) { capEl.innerHTML = cap ? cap[2] : ''; lastCap = cap; }
  if (cap) { const k = win(t, cap[0], cap[1], .35, .3); capEl.style.opacity = k; capEl.style.transform = `translateY(${(1 - ss(cap[0], cap[0] + .4, t)) * 16}px)`; capEl.style.filter = `blur(${(1 - k) * 5}px)`; }
  else capEl.style.opacity = 0;
  // chapter
  const ch = chapters.find(([a, b]) => t >= a && t < b);
  if (ch !== lastChap) { chapText.innerHTML = ch ? ch[2] : ''; lastChap = ch; }
  chapEl.style.opacity = ch ? win(t, ch[0], ch[1], .5, .4) : 0;
  chapEl.querySelector('i').style.transform = `scaleX(${ch ? ss(ch[0], ch[0] + .6, t) : 0})`;
  // clock (typed in)
  const clockK = win(t, .7, 9.2, .2, .4);
  const clockStr = '11:47 PM';
  $('#clock').textContent = clockStr.slice(0, Math.round(clamp((t - .7) / .6) * clockStr.length)) + (Math.floor(t * 2.4) % 2 && t < 2 ? '_' : '');
  $('#clock').style.opacity = clockK;
  // letterbox
  const bars = 1 - ss(9.3, 10.2, t) + ss(S3 - .2, S3 + .6, t);
  $('#barTop').style.transform = `translateY(${-(1 - clamp(bars)) * 100}%)`;
  $('#barBot').style.transform = `translateY(${(1 - clamp(bars)) * 100}%)`;
  // adenosine meter
  const mk = win(t, S2 + 8.0, S2 + 12.2, .5, .4);
  $('#meter').style.opacity = mk; $('#meter').style.transform = `translateX(${(1 - ss(S2 + 8, S2 + 8.6, t)) * 40}px)`;
  $('#meter .fill').style.width = `${lerp(28, 92, ss(S2 + 8.2, S2 + 12, t))}%`;
  // takeaway
  const tk = t >= S3 - .1;
  $('#takeaway').style.display = tk ? 'flex' : 'none';
  if (tk) {
    const stag = (arr, t0, step) => arr.forEach((w, i) => {
      const k = ss(t0 + i * step, t0 + i * step + .45, v);
      w.style.opacity = k; w.style.transform = `translateY(${(1 - easeOutBack(k)) * 50}px) scale(${lerp(1.15, 1, k)})`; w.style.filter = `blur(${(1 - k) * 10}px)`;
    });
    stag(w1, 1.3, .12); stag(w2, 2.9, .16);
    const ul = l2.querySelector('.ul'); ul.style.transform = `scaleX(${ss(3.6, 4.3, v)})`;
    const hlw = l2.querySelector('.hl'); hlw.style.textShadow = `0 0 ${20 + 20 * ss(3.6, 4.3, v)}px rgba(255,179,71,${.55 * ss(3.6, 4.3, v)})`;
    $('#takeaway .kicker').style.opacity = win(v, .8, 99, .5, .1);
    const sub = $('#takeaway .sub'); const sk = ss(5.4, 6.1, v); sub.style.opacity = sk; sub.style.transform = `translateY(${(1 - sk) * 20}px)`;
  }
  // flashes / fades between worlds
  const flash = Math.max(ss(9.45, 9.95, t) * (1 - ss(10.0, 10.7, t)), ss(S3 - .5, S3, t) * (1 - ss(S3, S3 + .55, t)));
  $('#flash').style.opacity = flash;
  $('#flash').style.background = t < 15 ? '#e6dcff' : '#fff6e0';
  // darken the room behind the takeaway text, then end
  $('#dim').style.opacity = t > S3 ? ss(1.0, 2.5, v) * .55 : 0;
  $('#fade').style.opacity = Math.max(ss(TOTAL - .8, TOTAL, t), 1 - ss(0, .8, t));
  capEl.style.bottom = (t >= S2 && t < S3) ? '64px' : '150px';
  // grain jitter
  const f = Math.floor(t * 30); $('#grain').style.backgroundPosition = `${(f * 73) % 256}px ${(f * 151) % 256}px`;
}

export function seek(t) {
  t = clamp(t, 0, TOTAL - 1e-3);
  performanceTime = t;
  const inMicro = t >= S2 && t < S3;
  if (inMicro) {
    updateMicro(t);
    renderPass.scene = micro; renderPass.camera = microCam;
    bloom.strength = .8; bloom.threshold = .72; bloom.radius = .5;
    renderer.toneMappingExposure = 1.05;
  } else {
    updateRoom(t);
    renderPass.scene = room; renderPass.camera = roomCam;
    bloom.strength = t >= S3 ? .75 : .6; bloom.threshold = .78; bloom.radius = .55;
  }
  tagsEl.style.display = inMicro ? 'block' : 'none';
  updateOverlay(t);
  composer.render();
}
window.seek = seek; window.TOTAL = TOTAL;

// ---------------------------------------------------------------- driver
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage');
if (params.has('render')) {
  document.body.classList.add('render');
  document.fonts.ready.then(() => { seek(0); window.__ready = true; });
} else {
  const fit = () => { const s = Math.min(innerWidth / W, (innerHeight - 40) / H); stage.style.transform = `scale(${s})`; stage.style.margin = `${(H * s - H) / 2}px ${(W * s - W) / 2}px`; };
  addEventListener('resize', fit); fit();
  let playing = true, t = parseFloat(params.get('t') || '0'), last = performance.now();
  const btn = $('#play'), bar = $('#scrub div'), tl = $('#time');
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; };
  addEventListener('keydown', e => { if (e.code === 'Space') btn.onclick(); });
  $('#scrub').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); t = (e.clientX - r.left) / r.width * TOTAL; };
  const loop = now => {
    if (playing) t = (t + (now - last) / 1000) % TOTAL; last = now;
    seek(t); bar.style.width = `${t / TOTAL * 100}%`; tl.textContent = `${t.toFixed(1)}s`;
    requestAnimationFrame(loop);
  };
  document.fonts.ready.then(() => requestAnimationFrame(loop));
}
