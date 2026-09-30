/* =========================================================
   main.js — orquestra a dinâmica do site
   1. Rolagem suave (Lenis) ligada ao ScrollTrigger
   2. Título quebrado em letras + animação de entrada
   3. Hero fixado: letras se desfazem com blur conforme a rolagem
   4. Coleção fixada: rolagem vertical vira movimento horizontal
   5. Revelação: clip-path abre uma faixa do centro até a tela inteira
   6. Ateliê: coluna sticky (CSS) + números que contam
   7. Menu, sacola e newsletter
   A parte 3D (rings.js / water.js) é carregada depois, sem travar o resto.
   ========================================================= */

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('is-reduced', reduceMotion);

const header = $('[data-header]');
const headerHeight = () => header.offsetHeight;
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const announcer = $('[data-announcer]');
const announce = (message) => {
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = message; });
};

/* ---------------------------------------------------------
   1. ROLAGEM SUAVE
   O Lenis suaviza a rolagem e avisa o ScrollTrigger a cada quadro.
   --------------------------------------------------------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function lockScroll(locked) {
  if (lenis) locked ? lenis.stop() : lenis.start();
  else document.documentElement.style.overflow = locked ? 'hidden' : '';
}

let collectionST = null; // preenchido na etapa 4
function scrollToTarget(target) {
  let y;
  if (target === 'top') {
    y = 0;
  } else if (target === '#colecao' && collectionST) {
    y = collectionST.start; // início exato do trecho fixado
  } else {
    const el = $(target);
    if (!el) return;
    y = el.getBoundingClientRect().top + window.scrollY - (target === '#atelie' ? headerHeight() : 0);
  }
  if (lenis) lenis.scrollTo(y, { duration: 1.6 });
  else window.scrollTo({ top: y });
}

/* ---------------------------------------------------------
   2. TÍTULO EM LETRAS
   Cada letra vira <span class="char"><span class="char__in">x</span></span>.
   .char__in é animado na entrada e .char na rolagem, assim as duas
   animações nunca disputam a mesma propriedade.
   --------------------------------------------------------- */
function splitChars(el) {
  const outer = [];
  const inner = [];
  $$('.line', el).forEach((line) => {
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    words.forEach((word, index) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      for (const letter of word) {
        const c = document.createElement('span');
        c.className = 'char';
        const ci = document.createElement('span');
        ci.className = 'char__in';
        ci.textContent = letter;
        c.append(ci);
        wordEl.append(c);
        outer.push(c);
        inner.push(ci);
      }
      line.append(wordEl);
      if (index < words.length - 1) line.append(' ');
    });
  });
  return { outer, inner };
}

const { outer: chars, inner: charsIn } = splitChars($('[data-split]'));

// Estado compartilhado com a cena 3D (ela lê estes valores a cada quadro)
const heroState = { intro: reduceMotion ? 1 : 0, scroll: 0 };
const waterState = { open: reduceMotion ? 1 : 0 };

function playIntro() {
  gsap.set(['.hero__content', header], { opacity: 1 });
  if (reduceMotion) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo(heroState, { intro: 0 }, { intro: 1, duration: 2.8, ease: 'power3.out' }, 0)
    .fromTo(charsIn,
      { yPercent: 70, opacity: 0, filter: 'blur(14px)' },
      { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.5, stagger: 0.045 }, 0.25)
    .fromTo('.hero__cta', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1 }, 0.9);
}

// espera as fontes por no máximo 400 ms: a fonte do título vem pré-carregada, e
// esperar mais atrasava o maior elemento da tela (LCP), que é o próprio título
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 400))]).then(() => {
  playIntro();
  ScrollTrigger.refresh();
});

/* ---------------------------------------------------------
   3. HERO FIXADO
   pin: true segura a seção na tela por 80% da altura da janela.
   scrub: true amarra o progresso da animação à posição da rolagem.
   --------------------------------------------------------- */
if (!reduceMotion) {
  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '+=80%',
      pin: true,
      scrub: true,
      onUpdate: (self) => { heroState.scroll = self.progress; },
    },
  })
    // letras somem da esquerda para a direita, com desfoque
    .to(chars, { opacity: 0, filter: 'blur(14px)', xPercent: 18, ease: 'power1.in', duration: 0.35, stagger: 0.05 }, 0)
    .to('.hero__cta-wrap', { opacity: 0, y: 10, duration: 0.3 }, 0.05);

  // depois de soltar, a mídia do hero desce mais devagar que a página (parallax)
  gsap.to('[data-hero-media]', {
    yPercent: 30,
    scale: 1.08,
    ease: 'none',
    scrollTrigger: { trigger: '.collection', start: 'top bottom', end: 'top top', scrub: true },
  });
}

// cabeçalho ganha fundo de vidro fosco quando sai do hero
ScrollTrigger.create({
  trigger: '.collection',
  start: () => `top ${headerHeight()}px`,
  onEnter: () => header.classList.add('is-solid'),
  onLeaveBack: () => header.classList.remove('is-solid'),
});

/* ---------------------------------------------------------
   4 + 5. COLEÇÃO HORIZONTAL E REVELAÇÃO
   Uma única timeline fixada:
   [ trilha anda para a esquerda ][ painel abre do centro ][ pausa ]
   --------------------------------------------------------- */
const collection = $('.collection');
const track = $('[data-track]');
const products = $$('.product', track);
const reveal = $('[data-reveal]');
const trackDistance = () => Math.max(0, track.scrollWidth - collection.clientWidth);

if (!reduceMotion) {
  const TRACK = 1;
  const REVEAL = 0.6;
  const HOLD = 0.25;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: collection,
      start: 'top top',
      end: () => `+=${trackDistance() + window.innerHeight * 1.4}`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true, // recalcula distâncias ao redimensionar
    },
  });

  tl.to(track, { x: () => -trackDistance(), duration: TRACK })
    .fromTo(reveal,
      { clipPath: 'inset(0% 50% 0% 50%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: REVEAL,
        ease: 'power2.inOut',
        onUpdate() { waterState.open = this.progress(); },
      },
      TRACK - 0.12) // começa um pouco antes da trilha parar
    .fromTo('[data-reveal-media]', { scale: 1.3 }, { scale: 1, duration: REVEAL, ease: 'power2.out' }, '<')
    .fromTo('.reveal__caption', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.2 }, '>-0.1')
    .to({}, { duration: HOLD });

  collectionST = tl.scrollTrigger;

  // Acessibilidade: ao focar um produto fora da tela com Tab, rola até ele
  products.forEach((product, index) => {
    product.addEventListener('focusin', () => {
      const distance = trackDistance();
      if (!distance) return;
      const width = product.offsetWidth;
      const viewport = collection.clientWidth;
      const left = index * width + gsap.getProperty(track, 'x');
      if (left >= -1 && left + width <= viewport + 1) return;
      const targetX = gsap.utils.clamp(-distance, 0, -(index * width - (viewport - width) / 2));
      const fraction = (-targetX / distance) * (TRACK / tl.duration());
      const y = collectionST.start + (collectionST.end - collectionST.start) * fraction;
      if (lenis) lenis.scrollTo(y, { duration: 0.8 });
      else window.scrollTo({ top: y });
    });
  });
}

/* ---------------------------------------------------------
   6. ATELIÊ — números contam ao aparecer (a coluna sticky é só CSS)
   --------------------------------------------------------- */
if (!reduceMotion) {
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const counter = { value: 0 };
    el.textContent = '0';
    gsap.to(counter, {
      value: end,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = Math.round(counter.value); },
      scrollTrigger: { trigger: el.closest('.stat'), start: 'top 80%', once: true },
    });
  });
}

/* ---------------------------------------------------------
   7a. MENU EM TELA CHEIA
   --------------------------------------------------------- */
const menu = $('[data-menu]');
const menuToggle = $('[data-menu-toggle]');
const pageRegions = [$('main'), $('.site-footer')];
let menuOpen = false;

const menuTl = gsap.timeline({
  paused: true,
  defaults: { ease: 'expo.inOut' },
  onReverseComplete: () => gsap.set(menu, { visibility: 'hidden' }),
})
  .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9 })
  .fromTo('.menu__link span', { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' }, 0.35)
  .fromTo('.menu__foot', { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.6);

function openMenu() {
  if (menuOpen) return;
  if (bagOpen) closeBag({ returnFocus: false });
  menuOpen = true;
  document.body.classList.add('menu-open');
  menu.inert = false;
  pageRegions.forEach((el) => { el.inert = true; });
  gsap.set(menu, { visibility: 'visible' });
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Fechar menu');
  lockScroll(true);
  if (reduceMotion) menuTl.progress(1);
  else menuTl.timeScale(1).play();
  $('.menu__link', menu).focus({ preventScroll: true });
}

function closeMenu({ returnFocus = true } = {}) {
  if (!menuOpen) return;
  menuOpen = false;
  document.body.classList.remove('menu-open');
  menu.inert = true;
  pageRegions.forEach((el) => { el.inert = false; });
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
  lockScroll(false);
  if (reduceMotion) {
    menuTl.progress(0);
    gsap.set(menu, { visibility: 'hidden' });
  } else {
    menuTl.timeScale(1.6).reverse();
  }
  if (returnFocus) menuToggle.focus({ preventScroll: true });
}

menuToggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));

/* ---------------------------------------------------------
   7b. SACOLA
   --------------------------------------------------------- */
const bagEl = $('[data-bag]');
const bagPanel = $('.bag__panel', bagEl);
const bagScrim = $('.bag__scrim', bagEl);
const bagList = $('[data-bag-list]');
const bagEmpty = $('[data-bag-empty]');
const bagTotal = $('[data-bag-total]');
const bagCount = $('[data-bag-count]');
const bagOpenBtn = $('[data-bag-open]');
const bagItems = new Map(); // id -> { id, name, ring, price, qty }
let bagOpen = false;
let productShots = {};

gsap.set(bagPanel, { xPercent: 100 });
const bagTl = gsap.timeline({
  paused: true,
  onReverseComplete: () => gsap.set(bagEl, { visibility: 'hidden' }),
})
  .to(bagScrim, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
  .to(bagPanel, { xPercent: 0, duration: 0.8, ease: 'expo.out' }, 0);

function bagSummary() {
  const items = [...bagItems.values()];
  return {
    items,
    count: items.reduce((n, it) => n + it.qty, 0),
    total: items.reduce((n, it) => n + it.qty * it.price, 0),
  };
}

function renderBag() {
  const { items, count, total } = bagSummary();
  bagCount.hidden = count === 0;
  bagCount.textContent = count;
  bagOpenBtn.setAttribute('aria-label', count ? `Abrir sacola, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Abrir sacola');
  bagTotal.textContent = brl.format(total);
  bagEmpty.hidden = items.length > 0;

  bagList.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    li.className = 'bag__item';

    const thumb = document.createElement('img');
    thumb.className = 'bag__thumb';
    thumb.alt = '';
    if (productShots[item.ring]) thumb.src = productShots[item.ring];

    const info = document.createElement('div');
    const name = document.createElement('p');
    name.textContent = item.name;
    const meta = document.createElement('p');
    meta.className = 'bag__meta';
    meta.textContent = `${item.qty} × ${brl.format(item.price)}`;
    info.append(name, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bag__remove';
    remove.dataset.remove = item.id;
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover ${item.name}`);

    li.append(thumb, info, remove);
    return li;
  }));
}

function addToBag(product, button) {
  const { id, name, ring, price } = product.dataset;
  const item = bagItems.get(id) || { id, name, ring, price: Number(price), qty: 0 };
  item.qty += 1;
  bagItems.set(id, item);
  renderBag();

  if (!reduceMotion) {
    gsap.fromTo(bagCount, { yPercent: -80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
  }
  button.textContent = 'Adicionado';
  button.classList.add('is-added');
  clearTimeout(button.resetTimer);
  button.resetTimer = setTimeout(() => {
    button.textContent = 'Adicionar à sacola';
    button.classList.remove('is-added');
  }, 1600);

  const { count } = bagSummary();
  announce(`${name} adicionado à sacola. ${count} ${count === 1 ? 'item' : 'itens'} na sacola.`);
}

function openBag() {
  if (bagOpen) return;
  if (menuOpen) closeMenu({ returnFocus: false });
  bagOpen = true;
  bagEl.inert = false;
  [...pageRegions, header].forEach((el) => { el.inert = true; });
  gsap.set(bagEl, { visibility: 'visible' });
  bagOpenBtn.setAttribute('aria-expanded', 'true');
  lockScroll(true);
  if (reduceMotion) bagTl.progress(1);
  else bagTl.timeScale(1).play();
  $('.bag__close', bagEl).focus({ preventScroll: true });
}

function closeBag({ returnFocus = true } = {}) {
  if (!bagOpen) return;
  bagOpen = false;
  bagEl.inert = true;
  [...pageRegions, header].forEach((el) => { el.inert = false; });
  bagOpenBtn.setAttribute('aria-expanded', 'false');
  lockScroll(false);
  if (reduceMotion) {
    bagTl.progress(0);
    gsap.set(bagEl, { visibility: 'hidden' });
  } else {
    bagTl.timeScale(1.4).reverse();
  }
  if (returnFocus) bagOpenBtn.focus({ preventScroll: true });
}

bagOpenBtn.addEventListener('click', openBag);

track.addEventListener('click', (e) => {
  const button = e.target.closest('[data-add]');
  if (button) addToBag(button.closest('.product'), button);
});

bagList.addEventListener('click', (e) => {
  const button = e.target.closest('[data-remove]');
  if (!button) return;
  const item = bagItems.get(button.dataset.remove);
  bagItems.delete(button.dataset.remove);
  renderBag();
  announce(`${item.name} removido da sacola.`);
  $('.bag__close', bagEl).focus({ preventScroll: true });
});

/* ---------------------------------------------------------
   Cliques de navegação (âncoras suaves, fechar sacola/menu)
   --------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-scroll-to], [data-bag-close]');
  if (!el) return;
  if (el.hasAttribute('data-bag-close')) closeBag({ returnFocus: !el.dataset.scrollTo });
  if (el.closest('[data-menu]')) closeMenu({ returnFocus: false });
  if (el.dataset.scrollTo) {
    e.preventDefault();
    scrollToTarget(el.dataset.scrollTo);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeMenu();
  closeBag();
});

/* ---------------------------------------------------------
   7c. NEWSLETTER (demonstração: nada é enviado)
   --------------------------------------------------------- */
const form = $('[data-newsletter]');
const formMsg = $('[data-newsletter-msg]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = form.elements.email;
  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    input.setAttribute('aria-invalid', 'true');
    formMsg.classList.add('is-error');
    formMsg.textContent = 'Digite um e-mail válido, como nome@exemplo.com.';
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  formMsg.classList.remove('is-error');
  // Site de demonstração: não diga que a inscrição foi feita, porque nada é enviado.
  formMsg.textContent = 'E-mail válido. Este site é uma demonstração: nenhum e-mail foi registrado.';
  form.reset();
});

/* ---------------------------------------------------------
   MÍDIA: vídeo real (se houver data-src) ou cena 3D
   --------------------------------------------------------- */
function mountVideo(video) {
  const isPhone = window.matchMedia('(max-width: 760px)').matches;
  const src = (isPhone && video?.dataset.srcMobile) || video?.dataset.src;
  if (!src) return Promise.resolve(false);
  return new Promise((resolve) => {
    video.addEventListener('canplay', () => {
      video.classList.add('is-ready');
      if (!reduceMotion) video.play().catch(() => {});
      resolve(true);
    }, { once: true });
    video.addEventListener('error', () => resolve(false), { once: true });
    video.src = src;
  });
}

const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 1200));

// Roda uma vez quando o elemento chega a uma tela de distância. O 3D fora da
// primeira dobra deixa de pesar no carregamento (antes, tudo nascia de uma vez).
function quandoPerto(el, fn, margem = '100% 0px') {
  if (!el) return;
  const observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    observador.disconnect();
    fn();
  }, { rootMargin: margem });
  observador.observe(el);
}

/* ---------------------------------------------------------
   PROVADOR (coleção em arco): texto e controles.
   A cena 3D (js/provador.js) só gira o carrossel; o resto é HTML.
   --------------------------------------------------------- */
const provadorEl = $('[data-provador]');
const pecas = products.map((p) => ({ id: p.dataset.id, nome: p.dataset.name, preco: Number(p.dataset.price), tipo: p.dataset.ring }));
const DETALHES = {
  heart: 'Rubi sintético lapidado em coração, cravado num engaste de prata 925.',
  eye: 'Esmalte vitrificado em três camadas sobre prata polida.',
  pave: 'Sinete cravejado de pequenas pedras claras, assentadas uma a uma.',
  triple: 'Três aros finos de prata, soldados lado a lado.',
  onyx: 'Ônix negro em corte hexagonal, polido até espelhar.',
  moon: 'Pedra-da-lua em cabochão, com reflexo azulado sob luz fria.',
};
// um tom baixo da pedra, misturado ao papel: a cor vem do assunto, não de um degradê
const TONS = { heart: '#F7EFEF', eye: '#EEF2F7', pave: '#F4F4F2', triple: '#F3F3F1', onyx: '#ECECEB', moon: '#F0F2F6' };
let provador = null;
let pecaAtual = 0;

function mostrarPeca(indice) {
  const total = pecas.length;
  pecaAtual = ((indice % total) + total) % total;
  const peca = pecas[pecaAtual];
  $('[data-provador-posicao]').textContent = `${pecaAtual + 1} de ${total}`;
  $('[data-provador-nome]').textContent = peca.nome;
  $('[data-provador-detalhe]').textContent = DETALHES[peca.tipo];
  $('[data-provador-preco]').textContent = brl.format(peca.preco);
  provadorEl.style.setProperty('--provador-tom', TONS[peca.tipo]);
  const fundo = $('[data-provador-fundo]');
  fundo.classList.add('is-trocando');
  setTimeout(() => { fundo.textContent = peca.nome; fundo.classList.remove('is-trocando'); }, reduceMotion ? 0 : 450);
  provador?.irPara(pecaAtual);
}

if (provadorEl) {
  $('[data-provador-anterior]').addEventListener('click', () => mostrarPeca(pecaAtual - 1));
  $('[data-provador-proximo]').addEventListener('click', () => mostrarPeca(pecaAtual + 1));
  provadorEl.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrarPeca(pecaAtual - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrarPeca(pecaAtual + 1); }
  });
  // O canvas recebe foco para as setas do teclado funcionarem sem precisar achar os botões.
  $('.provador__canvas').tabIndex = 0;

  const botaoAdicionar = $('[data-provador-adicionar]');
  botaoAdicionar.addEventListener('click', () => {
    const produto = products.find((p) => p.dataset.ring === pecas[pecaAtual].tipo);
    $('[data-add]', produto).click(); // reaproveita a sacola da coleção
    const rotulo = $('.label', botaoAdicionar);
    rotulo.textContent = 'Adicionado';
    clearTimeout(botaoAdicionar.resetTimer);
    botaoAdicionar.resetTimer = setTimeout(() => { rotulo.textContent = 'Adicionar à sacola'; }, 1600);
  });
}

// O 3D só começa depois da primeira pintura. Com os arquivos em cache, o
// Three.js chegava tão rápido que era interpretado antes de o navegador pintar
// o cabeçalho, e a primeira pintura (FCP) ficava ~0,9 s atrás do DOM pronto.
// Dois quadros garantem que a página já pintou.
const depoisDaPrimeiraPintura = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

depoisDaPrimeiraPintura()
  .then(() => import('./rings.js'))
  .then(async ({ createHeroScene, renderProductShots }) => {
    if (!(await mountVideo($('.hero__video')))) {
      createHeroScene($('.hero__canvas'), { state: heroState, reduced: reduceMotion });
    }

    // "fotografa" os anéis só quando a coleção se aproxima e o navegador está livre
    quandoPerto(collection, () => whenIdle(async () => {
      productShots = await renderProductShots([...new Set(products.map((p) => p.dataset.ring))]);
      products.forEach((product) => {
        const img = $('img', product);
        img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
        img.src = productShots[product.dataset.ring];
      });
      renderBag();
    }));

    quandoPerto(collection, async () => {
      if (!(await mountVideo($('.reveal__video')))) {
        const { createWaterScene } = await import('./water.js');
        createWaterScene($('.reveal__canvas'), { state: waterState, reduced: reduceMotion });
      }
    }, '50% 0px');

    quandoPerto(provadorEl, async () => {
      const { createProvador } = await import('./provador.js');
      provador = createProvador($('.provador__canvas'), { tipos: pecas.map((p) => p.tipo), reduced: reduceMotion });
      provador.irPara(pecaAtual);
    });
  })
  .catch((error) => {
    // sem 3D (ex.: CDN fora do ar) a página continua funcionando
    console.warn('Cena 3D indisponível:', error);
  });

renderBag();
