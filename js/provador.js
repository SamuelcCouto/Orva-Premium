/* =========================================================
   provador.js — a coleção em arco (receita da site-premium, midia.md §7)
   Os seis anéis ficam num carrossel 3D; o escolhido vem para a frente,
   maior e girando devagar, e os outros recuam na névoa branca.
   Gesto da ORVA: giro de mesa de joalheiro, lento e preciso (expo.inOut),
   com a profundidade feita de luz, não de sombra.
   ========================================================= */
import * as THREE from 'three';
import { compilarSemTravar, createRing, setupRenderer, studioEnvironment } from './rings.js';

const RAIO = 3.4;

export function createProvador(canvas, { tipos, reduced = false }) {
  const { gsap } = window;
  const renderer = setupRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.fog = new THREE.Fog(0xf4f4f2, 8, 13);

  const luz = new THREE.DirectionalLight(0xffffff, 1.3);
  luz.position.set(2, 4, 5);
  scene.add(luz);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.1, 8.4);
  camera.lookAt(0, 0.45, 0);

  // O carrossel gira em torno de um eixo atrás do anel da frente.
  const carrossel = new THREE.Group();
  carrossel.position.z = -RAIO;
  scene.add(carrossel);

  const passo = (Math.PI * 2) / tipos.length;
  const itens = tipos.map((tipo, i) => {
    const suporte = new THREE.Group();
    const angulo = i * passo;
    suporte.position.set(Math.sin(angulo) * RAIO, 0, Math.cos(angulo) * RAIO);
    const anel = createRing(tipo);
    anel.rotation.set(0.6, 0.95, 0); // inclinado para a pedra aparecer mesmo parado (movimento reduzido)
    suporte.add(anel);
    suporte.scale.setScalar(0.62);
    carrossel.add(suporte);
    return { suporte, anel };
  });

  const estado = { indice: 0, giro: 0, arrasto: 0 };
  let sujo = true;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em tela estreita, afasta a câmera para o anel caber inteiro
    camera.position.z = camera.aspect < 0.9 ? 11 : 8.4;
    camera.updateProjectionMatrix();
    sujo = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visivel = false;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(canvas);

  function irPara(indice) {
    const total = tipos.length;
    const alvo = ((indice % total) + total) % total;
    // caminho mais curto no círculo: evita dar a volta inteira de 5 para 0
    let delta = alvo - (estado.indice % total);
    if (delta > total / 2) delta -= total;
    if (delta < -total / 2) delta += total;
    estado.indice += delta;
    const rotacao = -estado.indice * passo;
    itens.forEach((it, i) => {
      const escala = i === alvo ? 1 : 0.62;
      if (reduced) it.suporte.scale.setScalar(escala);
      else gsap.to(it.suporte.scale, { x: escala, y: escala, z: escala, duration: 1.1, ease: 'expo.inOut' });
    });
    if (reduced) carrossel.rotation.y = rotacao;
    else gsap.to(carrossel.rotation, { y: rotacao, duration: 1.2, ease: 'expo.inOut', onUpdate: () => { sujo = true; } });
    sujo = true;
    return alvo;
  }

  // Arrastar gira o anel da frente; ao soltar, ele volta devagar à pose.
  let ultimoX = null;
  canvas.addEventListener('pointerdown', (e) => { ultimoX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (ultimoX === null) return;
    estado.arrasto += (e.clientX - ultimoX) * 0.012;
    ultimoX = e.clientX;
    sujo = true;
  });
  const soltar = () => { ultimoX = null; };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  const relogio = new THREE.Clock();
  compilarSemTravar(renderer, scene, camera).then(() => renderer.setAnimationLoop(() => {
    if (!visivel) return;
    const dt = Math.min(relogio.getDelta(), 0.05);
    if (reduced && !sujo) return;
    const frente = itens[((estado.indice % tipos.length) + tipos.length) % tipos.length];
    if (!reduced) {
      estado.giro += dt * 0.35;
      if (ultimoX === null) estado.arrasto *= 0.96;
    }
    itens.forEach((it) => {
      it.anel.rotation.y = 0.95 + (it === frente ? estado.giro + estado.arrasto : 0);
    });
    renderer.render(scene, camera);
    sujo = false;
  }));

  irPara(0);
  return { irPara };
}
