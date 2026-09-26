/* =========================================================
   water.js — cena da "revelação": água com cáusticas + anel
   Passo 1: um quadrado em tela cheia com shader (a água)
   Passo 2: o anel 3D renderizado por cima
   state.open (0→1) vem do clip-path; só renderiza quando o painel está aberto.
   ========================================================= */
import * as THREE from 'three';
import { createRing, setupRenderer, studioEnvironment } from './rings.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uCenter;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return v;
  }
  // Linhas de cáustica = "cristas" de um ruído deformado por outro ruído
  float caustic(vec2 p, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, t * 0.12)), fbm(p + vec2(5.2, 1.3) - t * 0.1));
    float n = fbm(p + 1.8 * q + vec2(t * 0.05, -t * 0.04));
    float ridge = clamp(1.0 - abs(n - 0.5) * 4.0, 0.0, 1.0);
    return pow(ridge, 3.5);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 center = (uCenter - 0.5) * vec2(aspect, 1.0);

    // ondas concêntricas saindo do anel
    float d = length(p - center);
    float wave = sin(d * 34.0 - uTime * 1.4) * exp(-d * 2.2);
    vec2 warp = normalize(p - center + 1e-4) * wave * 0.012;

    vec2 cp = (p + warp) * 1.7;
    float c = caustic(cp, uTime) * caustic(cp * 1.6 + 7.3, uTime * 1.25) * 1.6 + 0.25 * caustic(cp * 0.8, uTime * 0.8);

    vec3 deep = vec3(0.78, 0.84, 0.87);
    vec3 shallow = vec3(0.93, 0.955, 0.965);
    vec3 col = mix(deep, shallow, smoothstep(-0.1, 1.1, uv.y));
    col += c * vec3(0.95, 0.98, 1.0) * 0.32;
    col += wave * 0.018;

    // sombra suave do anel no fundo
    float sh = smoothstep(0.42, 0.0, length((p - center - vec2(0.12, -0.2)) * vec2(1.0, 1.6)));
    col *= 1.0 - sh * 0.22;

    col *= 1.0 - 0.16 * pow(length(uv - 0.5) * 1.35, 2.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createWaterScene(canvas, { state, reduced = false }) {
  const renderer = setupRenderer(canvas, { alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.autoClear = false;

  // passo 1: água
  const uniforms = {
    uTime: { value: 6 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.65, 0.5) },
  };
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.Camera();
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false }),
  );
  quad.frustumCulled = false;
  bgScene.add(quad);

  // passo 2: anel
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 9);
  const ring = createRing('eye');
  const holder = new THREE.Group();
  holder.add(ring);
  scene.add(holder);

  const projected = new THREE.Vector3();
  let dirty = true;
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uRes.value.set(w, h);
    holder.position.set(camera.aspect < 1 ? 0 : 1.7, camera.aspect < 1 ? 0.7 : 0.1, 0);
    camera.updateMatrixWorld(); // sem isto a projeção usa uma matriz vazia e gera NaN no shader
    projected.copy(holder.position).project(camera);
    uniforms.uCenter.value.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
    dirty = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = false;
  let running = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  let lastOpen = -1;
  renderer.setAnimationLoop(() => {
    if (!running || !visible || state.open <= 0.001) return;
    if (reduced && !dirty && lastOpen === state.open) return;
    lastOpen = state.open;
    dirty = false;

    const t = reduced ? 6 : clock.getElapsedTime();
    uniforms.uTime.value = 6 + t;
    ring.rotation.set(0.9 + Math.sin(t * 0.5) * 0.08, 0.6 + t * 0.15, Math.sin(t * 0.4) * 0.06);
    holder.position.z = -0.6 + state.open * 0.6; // o anel "sobe" enquanto o painel abre

    renderer.clear();
    renderer.render(bgScene, bgCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  });

  return {
    stop() { running = false; renderer.setAnimationLoop(null); },
  };
}
