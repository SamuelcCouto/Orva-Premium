/* =========================================================
   rings.js — anéis 3D em Three.js
   - createRing(type): monta um anel (aro + cabeça/pedra)
   - createHeroScene(canvas, { state }): cena do hero (substitui o vídeo)
   - renderProductShots(types): renderiza cada anel em PNG para os cards
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------- renderer e iluminação de estúdio ---------- */
export function setupRenderer(canvas, { alpha = true, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias: true,
    preserveDrawingBuffer: preserve,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

// Um "estúdio" virtual gerado por código: é o que faz o metal refletir e parecer prata.
export function studioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

/* ---------- materiais ---------- */
const materials = {
  silver: () => new THREE.MeshPhysicalMaterial({ color: 0xd9dce0, metalness: 1, roughness: 0.16 }),
  ruby: () => new THREE.MeshPhysicalMaterial({
    color: 0x7d0414, emissive: 0x1c0003, roughness: 0.02, metalness: 0, ior: 1.77,
    specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.4,
  }),
  onyx: () => new THREE.MeshPhysicalMaterial({
    color: 0x0b0b0d, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, flatShading: true,
  }),
  moonstone: () => new THREE.MeshPhysicalMaterial({
    color: 0xe8eef5, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    sheen: 1, sheenColor: 0x8fb6ff, sheenRoughness: 0.35, iridescence: 0.7, iridescenceIOR: 1.3,
  }),
  pave: () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.9, roughness: 0.02, flatShading: true, envMapIntensity: 1.6,
  }),
};

/* ---------- geometrias ---------- */

// Aro: perfil de retângulo arredondado girado 360° em torno do eixo Y (LatheGeometry).
// O perfil é percorrido no sentido anti-horário para as normais apontarem para fora.
function bandGeometry({ inner = 1, thickness = 0.14, width = 0.3, round = 0.05 } = {}) {
  const pts = [];
  const x0 = inner;
  const x1 = inner + thickness;
  const h = width / 2;
  const r = Math.min(round, thickness / 2, h);
  const corner = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  corner(x0 + r, -h + r, Math.PI, 1.5 * Math.PI);     // interno-baixo
  corner(x1 - r, -h + r, 1.5 * Math.PI, 2 * Math.PI); // externo-baixo
  corner(x1 - r, h - r, 0, 0.5 * Math.PI);            // externo-cima
  corner(x0 + r, h - r, 0.5 * Math.PI, Math.PI);      // interno-cima
  pts.push(pts[0].clone());
  return new THREE.LatheGeometry(pts, 160);
}

// Coração centralizado, com a ponta para baixo (-y). s = escala.
function heartShape(s) {
  const p = (x, y) => [(x - 5) * s, (9.5 - y) * s];
  const shape = new THREE.Shape();
  shape.moveTo(...p(5, 5));
  shape.bezierCurveTo(...p(5, 5), ...p(4, 0), ...p(0, 0));
  shape.bezierCurveTo(...p(-6, 0), ...p(-6, 7), ...p(-6, 7));
  shape.bezierCurveTo(...p(-6, 11), ...p(-3, 15.4), ...p(5, 19));
  shape.bezierCurveTo(...p(12, 15.4), ...p(16, 11), ...p(16, 7));
  shape.bezierCurveTo(...p(16, 7), ...p(16, 0), ...p(10, 0));
  shape.bezierCurveTo(...p(7, 0), ...p(5, 5), ...p(5, 5));
  return shape;
}

// Extrusão deitada: a face da peça fica voltada para +Y (para cima do anel).
function flatExtrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 40,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 6,
  });
  g.center();
  g.rotateX(-Math.PI / 2);
  return g;
}

// Olho azul desenhado num canvas 2D e usado como textura.
function eyeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const m = 128;
  const disc = (r, fill) => { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  g.fillStyle = '#1d3f86';
  g.fillRect(0, 0, 256, 256);
  disc(94, '#f2f4f6');
  const iris = g.createRadialGradient(m, m, 12, m, m, 66);
  iris.addColorStop(0, '#c4e6f8');
  iris.addColorStop(0.6, '#5aa6d6');
  iris.addColorStop(1, '#2b6fae');
  disc(66, iris);
  disc(26, '#0d1420');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- fábrica de anéis ---------- */
// O aro fica com o eixo em X; a cabeça (pedra) fica no topo, em +Y.
export function createRing(type) {
  const ring = new THREE.Group();
  const silver = materials.silver();
  const OUTER = 1.14;

  const bands = new THREE.Group();
  bands.rotation.z = Math.PI / 2;
  ring.add(bands);

  const head = new THREE.Group();
  head.position.y = OUTER - 0.03;
  ring.add(head);

  const mesh = (geometry, material, y = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.y = y;
    return m;
  };

  if (type === 'triple') {
    [-0.13, 0, 0.13].forEach((offset, i) => {
      const b = mesh(bandGeometry({ inner: 1.02, thickness: 0.1, width: 0.1, round: 0.05 }), silver, offset);
      b.rotation.z = (i - 1) * 0.05;
      bands.add(b);
    });
    return ring;
  }

  bands.add(mesh(bandGeometry(), silver));

  switch (type) {
    case 'heart': {
      head.add(mesh(flatExtrude(heartShape(0.036), 0.04, 0.012), silver, 0.03));
      head.add(mesh(flatExtrude(heartShape(0.029), 0.02, 0.13), materials.ruby(), 0.16));
      break;
    }
    case 'eye': {
      const eye = new THREE.MeshPhysicalMaterial({ map: eyeTexture(), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 });
      head.add(mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.07, 64), silver, 0.03));
      head.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 64), [silver, eye, silver], 0.08));
      const bezel = mesh(new THREE.TorusGeometry(0.31, 0.035, 20, 80), silver, 0.105);
      bezel.rotation.x = Math.PI / 2;
      head.add(bezel);
      break;
    }
    case 'pave': {
      head.add(mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.11, 72), silver, 0.05));
      // ~100 pedrinhas em anéis concêntricos, desenhadas com uma única InstancedMesh
      const spots = [[0, 0]];
      [0.08, 0.16, 0.24, 0.32, 0.395].forEach((r) => {
        const n = Math.round((2 * Math.PI * r) / 0.078);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r * 7;
          spots.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
      });
      const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.036, 0), materials.pave(), spots.length);
      const dummy = new THREE.Object3D();
      spots.forEach(([x, z], i) => {
        dummy.position.set(x, 0.115, z);
        dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        dummy.updateMatrix();
        stones.setMatrixAt(i, dummy.matrix);
      });
      head.add(stones);
      break;
    }
    case 'onyx': {
      const base = mesh(new THREE.CylinderGeometry(0.41, 0.38, 0.07, 6), silver, 0.03);
      const stone = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.09, 6), materials.onyx(), 0.1);
      base.rotation.y = stone.rotation.y = Math.PI / 6;
      head.add(base, stone);
      break;
    }
    case 'moon': {
      head.add(mesh(new THREE.CylinderGeometry(0.34, 0.31, 0.06, 64), silver, 0.03));
      const cab = mesh(new THREE.SphereGeometry(0.29, 64, 32), materials.moonstone(), 0.07);
      cab.scale.y = 0.5;
      const bezel = mesh(new THREE.TorusGeometry(0.295, 0.03, 20, 80), silver, 0.075);
      bezel.rotation.x = Math.PI / 2;
      head.add(cab, bezel);
      break;
    }
    default:
      break;
  }
  return ring;
}

function disposeObject(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    list.forEach((m) => { m.map?.dispose(); m.dispose(); });
  });
}

/* =========================================================
   CENA DO HERO
   Anéis flutuando em profundidades diferentes; a neblina branca
   funciona como "profundidade de campo" barata.
   state.intro (0→1) = entrada | state.scroll (0→1) = câmera avança na rolagem
   ========================================================= */
export function createHeroScene(canvas, { state, reduced = false }) {
  const renderer = setupRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.fog = new THREE.Fog(0xf1f1ef, 7, 17);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const rig = new THREE.Group();
  scene.add(rig);

  const layout = [
    { type: 'heart',  pos: [1.35, -0.25, 1.0], rot: [0.55, 0.9, 0.2],   scale: 1,    spin: 0.14 },
    { type: 'pave',   pos: [-0.5, 1.35, -2.2], rot: [0.95, -0.6, 0.3],  scale: 1,    spin: -0.1 },
    { type: 'triple', pos: [3.5, 1.7, -3.8],   rot: [1.2, 0.4, -0.5],   scale: 1,    spin: 0.08 },
    { type: 'eye',    pos: [-3.3, -1.3, -5],   rot: [0.4, 1.4, 0],      scale: 1,    spin: -0.12 },
  ];
  const items = layout.map((cfg, i) => {
    const holder = new THREE.Group();
    const ring = createRing(cfg.type);
    ring.rotation.set(...cfg.rot);
    holder.add(ring);
    holder.position.set(...cfg.pos);
    rig.add(holder);
    return { ...cfg, holder, ring, phase: i * 1.7 };
  });

  // parallax com o ponteiro (desligado em movimento reduzido)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let baseZ = 8.2;
  let dirty = true;
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // em telas verticais, afasta a câmera e centraliza os anéis
    baseZ = camera.aspect < 1 ? 12.5 : 8.2;
    rig.position.x = camera.aspect < 1 ? -1.2 : 0;
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  let running = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  let last = { intro: -1, scroll: -1 };

  renderer.setAnimationLoop(() => {
    if (!visible || !running) return;
    const t = reduced ? 0 : clock.getElapsedTime();
    // em movimento reduzido só redesenha quando algo mudou
    if (reduced && !dirty && last.intro === state.intro && last.scroll === state.scroll) return;
    last = { intro: state.intro, scroll: state.scroll };
    dirty = false;

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    const { intro, scroll } = state;
    camera.position.set(0, 0.1 - scroll * 0.4, baseZ - scroll * 3.4 + (1 - intro) * 2.5);
    camera.lookAt(0, 0.1 - scroll * 0.3, 0);
    rig.rotation.y = pointer.x * 0.12 + scroll * 0.25;
    rig.rotation.x = pointer.y * 0.08;

    items.forEach((it) => {
      it.holder.position.y = it.pos[1] + Math.sin(t * 0.6 + it.phase) * 0.08;
      it.ring.rotation.y = it.rot[1] + t * it.spin + (1 - intro) * 1.6;
      it.holder.scale.setScalar(it.scale * (0.65 + 0.35 * intro));
    });

    renderer.render(scene, camera);
  });

  return {
    stop() { running = false; renderer.setAnimationLoop(null); },
  };
}

/* =========================================================
   FOTOS DE PRODUTO
   Um renderer temporário "fotografa" cada anel em PNG (fundo transparente).
   ========================================================= */
export function renderProductShots(types, { width = 480, height = 640 } = {}) {
  const renderer = setupRenderer(undefined, { preserve: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 50);
  camera.position.set(0, 1.5, 6.3);
  camera.lookAt(0, 0.2, 0);

  const shots = {};
  types.forEach((type) => {
    const ring = createRing(type);
    ring.rotation.set(0.32, 0.95, 0);
    ring.position.y = -0.1;
    scene.add(ring);
    renderer.render(scene, camera);
    shots[type] = renderer.domElement.toDataURL('image/png');
    scene.remove(ring);
    disposeObject(ring);
  });

  scene.environment.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return shots;
}
