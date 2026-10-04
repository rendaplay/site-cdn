const CONFIG = window.CONFIG;
const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temGsap = Boolean(window.gsap && window.ScrollTrigger);
const animar = temGsap && !reduzir;
if (temGsap) gsap.registerPlugin(ScrollTrigger);

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];
const entre = (min, max) => min + Math.random() * (max - min);
const formatar = (n) => Math.round(n).toLocaleString('pt-BR');

function quandoVisivel(el, aoMudar, limiar = 0.2) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { aoMudar(true); return; }
  new IntersectionObserver(([e]) => aoMudar(e.isIntersecting), { threshold: limiar }).observe(el);
}

// ───────── links ─────────

function aplicarLinks(periodo) {
  const sufixo = periodo === 'anual' ? 'Anual' : 'Mensal';
  for (const botao of $$('[data-plano]')) botao.href = CONFIG.checkout[botao.dataset.plano + sufixo];
  for (const botao of $$('[data-checkout]')) botao.href = CONFIG.checkout[botao.dataset.checkout];
  for (const link of $$('[data-link]')) link.href = CONFIG.links[link.dataset.link];
}

// ───────── preços que rolam ─────────
// Ao trocar o período, cada caractere do preço antigo sobe e sai e o novo entra por baixo, em cascata.

function letrasDe(texto) {
  const caixa = document.createElement('span');
  caixa.className = 'odo-texto';
  for (const c of texto) {
    const l = document.createElement('span');
    l.className = 'odo-letra';
    l.textContent = c === ' ' ? ' ' : c;
    caixa.append(l);
  }
  return caixa;
}

function ajustarOdometro(odo, periodo, instantaneo) {
  const texto = odo.dataset[periodo];
  const sr = odo.parentElement.querySelector('[data-sr-preco]');
  if (sr) sr.textContent = texto + ' por mês';
  if (odo.dataset.atual === texto) return;
  odo.dataset.atual = texto;
  // Troca rápida no meio da animação: o que ainda estava saindo some na hora,
  // senão os preços se acumulam um do lado do outro.
  for (const saindo of odo.querySelectorAll('.odo-texto.saindo')) {
    if (window.gsap) gsap.killTweensOf(saindo.children);
    saindo.remove();
  }
  const velho = odo.querySelector('.odo-texto');
  const novo = letrasDe(texto);
  odo.append(novo);
  if (!velho) return;
  if (instantaneo || !animar || !window.gsap) { velho.remove(); return; }
  velho.classList.add('saindo');
  gsap.to(velho.children, { yPercent: -110, opacity: 0, duration: 0.35, stagger: 0.03, ease: 'power2.in', onComplete: () => velho.remove() });
  gsap.from(novo.children, { yPercent: 110, opacity: 0, duration: 0.5, stagger: 0.04, delay: 0.12, ease: 'back.out(1.8)' });
}

const odometros = $$('.odo');

// ───────── mensal / anual ─────────

const botoesPeriodo = $$('[data-periodo]');
const pilula = $('.periodo-pilula');

function moverPilula() {
  const ativo = botoesPeriodo.find((b) => b.getAttribute('aria-pressed') === 'true');
  if (!ativo || !pilula) return;
  pilula.style.width = ativo.offsetWidth + 'px';
  pilula.style.transform = `translateX(${ativo.offsetLeft}px)`;
}

function escolherPeriodo(periodo, instantaneo = false) {
  const anual = periodo === 'anual';
  for (const botao of botoesPeriodo) botao.setAttribute('aria-pressed', String(botao.dataset.periodo === periodo));
  for (const el of $$('[data-mensal-only]')) el.hidden = anual;
  for (const el of $$('[data-anual-only]')) el.hidden = !anual;
  for (const odo of odometros) ajustarOdometro(odo, periodo, instantaneo || reduzir);
  moverPilula();
  aplicarLinks(periodo);
}

for (const botao of botoesPeriodo) botao.addEventListener('click', () => escolherPeriodo(botao.dataset.periodo));
escolherPeriodo('mensal', true);
window.addEventListener('resize', moverPilula);
document.fonts && document.fonts.ready.then(moverPilula);

// ───────── abas dos jogos: cortina verde passa e troca o jogo ─────────

const abas = $$('[role="tab"]');
const cortina = $('.cortina');
let trocando = false;

const notaFaixas = document.querySelector('.jogos-rodape .nota');

function mostrarPainel(aba) {
  for (const outra of abas) {
    const ativa = outra === aba;
    outra.setAttribute('aria-selected', String(ativa));
    outra.tabIndex = ativa ? 0 : -1;
    document.getElementById(outra.getAttribute('aria-controls')).hidden = !ativa;
  }
  // A Batalha não tem faixas de presente: a nota das faixas não vale pra ela.
  notaFaixas.hidden = aba.getAttribute('aria-controls').includes('batalha');
}

function abrirAba(aba, focar) {
  if (focar) aba.focus();
  aba.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
  if (aba.getAttribute('aria-selected') === 'true') return;
  if (!animar || trocando) { mostrarPainel(aba); return; }

  trocando = true;
  for (const outra of abas) outra.setAttribute('aria-selected', String(outra === aba));
  const painel = document.getElementById(aba.getAttribute('aria-controls'));
  const atual = $$('.jogo').find((j) => !j.hidden);
  const alturaDe = (p) => p && $('.jogo-tela > img', p).offsetHeight;
  gsap.timeline({ onComplete: () => { trocando = false; } })
    .set(cortina, { transformOrigin: 'left center', height: alturaDe(atual) || 'auto' })
    .to(cortina, { scaleX: 1, duration: 0.3, ease: 'power2.in' })
    .add(() => { mostrarPainel(aba); gsap.set(cortina, { height: alturaDe(painel) || 'auto' }); })
    .set(cortina, { transformOrigin: 'right center' })
    .to(cortina, { scaleX: 0, duration: 0.45, ease: 'power3.out' })
    .from($$('.jogo-info > *', painel), { y: 14, opacity: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, '<')
    .from($$('.tabela-presentes tr', painel), { x: -12, opacity: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' }, '<0.15')
    .from($('.jogo-tela-2', painel), { y: 24, rotation: 4, opacity: 0, duration: 0.5, ease: 'back.out(1.8)' }, '<');
}

abas.forEach((aba, i) => {
  aba.addEventListener('click', () => abrirAba(aba, false));
  aba.addEventListener('keydown', (ev) => {
    const destino = {
      ArrowRight: abas[(i + 1) % abas.length],
      ArrowLeft: abas[(i - 1 + abas.length) % abas.length],
      Home: abas[0],
      End: abas[abas.length - 1],
    }[ev.key];
    if (!destino) return;
    ev.preventDefault();
    abrirAba(destino, true);
  });
});

// ───────── vitrine em cascata ─────────
// Distribui os cards em colunas que rolam em sentidos alternados. Cada coluna leva a própria
// lista duas vezes: andar -50% cai exatamente no começo da cópia, então o loop não tem emenda.
const cascata = $('#cascata');
if (cascata && !reduzir) {
  const cards = $$('.cascata-lista .cascata-card', cascata);
  const largas = window.matchMedia('(min-width: 1600px)');
  const medias = window.matchMedia('(min-width: 720px)');
  const ritmo = [1, 1.18, 0.9, 1.08];

  const montar = () => {
    $$('.cascata-coluna', cascata).forEach((col) => col.remove());
    const total = largas.matches ? 4 : medias.matches ? 3 : 2;
    const colunas = Array.from({ length: total }, () => []);
    cards.forEach((card, i) => colunas[i % total].push(card));

    colunas.forEach((lista, i) => {
      const coluna = document.createElement('div');
      coluna.className = 'cascata-coluna';
      const trilho = document.createElement('div');
      trilho.className = 'cascata-trilho';
      trilho.style.setProperty('--duracao', `${(lista.length * 7 * ritmo[i]).toFixed(1)}s`);
      for (const card of lista) trilho.append(card.cloneNode(true));
      for (const card of lista) {
        const copia = card.cloneNode(true);
        copia.setAttribute('aria-hidden', 'true');
        copia.tabIndex = -1;
        trilho.append(copia);
      }
      coluna.append(trilho);
      cascata.append(coluna);
    });
    cascata.style.setProperty('--colunas', total);
    cascata.classList.add('viva');
  };

  montar();
  largas.addEventListener('change', montar);
  medias.addEventListener('change', montar);

  new IntersectionObserver(([entrada]) => {
    cascata.classList.toggle('parada', !entrada.isIntersecting);
  }).observe(cascata);
}

// card da grade abre o detalhe do jogo nas abas logo abaixo
// (delegado: a cascata recria os cards quando muda o número de colunas)
document.addEventListener('click', (ev) => {
  const card = ev.target.closest('[data-aba]');
  if (!card) return;
  ev.preventDefault();
  const aba = document.getElementById('aba-' + card.dataset.aba);
  document.getElementById('jogos-detalhe').scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth' });
  abrirAba(aba, false);
  history.replaceState(null, '', '#jogo-' + card.dataset.aba);
});

// rendaplay.com.br/#jogo-duelo abre direto na aba do jogo (bom pra link na bio)
const abaDoLink = location.hash.startsWith('#jogo-') && document.getElementById('aba-' + location.hash.slice(6));
if (abaDoLink) {
  mostrarPainel(abaDoLink);
  const trilho = abaDoLink.parentElement;
  trilho.scrollLeft = abaDoLink.offsetLeft - trilho.clientWidth / 2 + abaDoLink.offsetWidth / 2;
  document.getElementById('jogos-detalhe').scrollIntoView();
}

// ───────── topo, ticker, barra de CTA ─────────

const topo = $('#topo');
const marcarTopo = () => topo.classList.toggle('rolou', window.scrollY > 8);
window.addEventListener('scroll', marcarTopo, { passive: true });
marcarTopo();

const ticker = $('.ticker-lista');
if (ticker) {
  const copia = ticker.cloneNode(true);
  copia.setAttribute('aria-hidden', 'true');
  ticker.after(copia);
}

const barraCta = $('#barra-cta');
const visiveis = { hero: true, precos: false, final: false };
const atualizarBarra = () => barraCta.classList.toggle('visivel', !visiveis.hero && !visiveis.precos && !visiveis.final);
quandoVisivel($('#hero'), (v) => { visiveis.hero = v; atualizarBarra(); }, 0);
quandoVisivel($('#precos'), (v) => { visiveis.precos = v; atualizarBarra(); }, 0);
quandoVisivel($('#final'), (v) => { visiveis.final = v; atualizarBarra(); }, 0);

// ───────── partículas em canvas (confete, moedas, corações) ─────────

const CORES_CONFETE = ['#17F864', '#FF3D7F', '#61FC78', '#8FF7FF', '#F4F8F3'];

class Particulas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lista = [];
    this.rodando = false;
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
  }

  ajustar() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, r.width * dpr);
    this.canvas.height = Math.max(1, r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
  }

  // posição de um elemento em coordenadas do canvas
  ponto(el, fx = 0.5, fy = 0.5) {
    const c = this.canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - c.left + r.width * fx, y: r.top - c.top + r.height * fy };
  }

  confete(x, y, n, forca = 1) {
    for (let i = 0; i < n; i++) {
      const ang = entre(-Math.PI * 0.95, -Math.PI * 0.05);
      const vel = entre(3, 8) * forca;
      this.lista.push({
        tipo: 'confete', x, y,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
        rot: entre(0, 6.28), vrot: entre(-0.3, 0.3),
        w: entre(4, 8), h: entre(7, 12),
        cor: sortear(CORES_CONFETE), vida: entre(70, 110), idade: 0,
      });
    }
    this.iniciar();
  }

  // moedas voam de um ponto até outro numa curva; aoChegar roda quando cada uma chega
  moedas(de, para, n, aoChegar) {
    for (let i = 0; i < n; i++) {
      this.lista.push({
        tipo: 'moeda-voo',
        x0: de.x + entre(-14, 14), y0: de.y + entre(-8, 8),
        x1: para.x, y1: para.y,
        cx: (de.x + para.x) / 2 + entre(-40, 40), cy: Math.min(de.y, para.y) - entre(60, 130),
        t: -i * 0.07, dur: entre(0.022, 0.03), giro: entre(0, 6.28), r: entre(6, 8),
        aoChegar,
      });
    }
    this.iniciar();
  }

  chuva(n) {
    for (let i = 0; i < n; i++) {
      this.lista.push({
        tipo: 'moeda', x: entre(0, this.w), y: entre(-this.h * 0.6, -20),
        vx: entre(-0.6, 0.6), vy: entre(1, 3), giro: entre(0, 6.28), vgiro: entre(0.08, 0.2),
        r: entre(9, 16), vida: 400, idade: 0,
      });
    }
    this.iniciar();
  }

  coracao(x, y) {
    this.lista.push({
      tipo: 'coracao', x, y, vx: entre(-0.4, 0.4), vy: entre(-1.6, -1), fase: entre(0, 6.28),
      s: entre(0.7, 1.15), cor: sortear(['#FF3D7F', '#FF3D7F', '#FF7BAA', '#FFB3CC']), vida: 90, idade: 0,
    });
    this.iniciar();
  }

  iniciar() {
    if (this.rodando) return;
    this.rodando = true;
    requestAnimationFrame(() => this.quadro());
  }

  desenharMoeda(x, y, r, giro) {
    const ctx = this.ctx;
    const sx = Math.max(0.15, Math.abs(Math.cos(giro)));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);
    ctx.fillStyle = this.contorno ? '#A86A00' : '#D9920B';
    ctx.beginPath(); ctx.arc(0, r * 0.18, r, 0, 6.283); ctx.fill();
    if (this.contorno) {
      ctx.strokeStyle = '#031610';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();
    }
    ctx.fillStyle = '#FFC81E';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#FFE27A';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  desenharCoracao(x, y, s, cor, alfa) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-11, -2, -6, -11, 0, -5);
    ctx.bezierCurveTo(6, -11, 11, -2, 0, 6);
    ctx.fill();
    ctx.restore();
  }

  quadro() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const vivos = [];
    for (const p of this.lista) {
      if (p.tipo === 'confete') {
        p.idade++; p.vy += 0.2; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        const alfa = Math.min(1, (p.vida - p.idade) / 25);
        ctx.save();
        ctx.globalAlpha = Math.max(0, alfa);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        if (p.idade < p.vida) vivos.push(p);
      } else if (p.tipo === 'moeda-voo') {
        p.t += p.dur; p.giro += 0.25;
        if (p.t < 0) { vivos.push(p); continue; }
        const t = Math.min(1, p.t);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const u = 1 - e;
        const x = u * u * p.x0 + 2 * u * e * p.cx + e * e * p.x1;
        const y = u * u * p.y0 + 2 * u * e * p.cy + e * e * p.y1;
        this.desenharMoeda(x, y, p.r * (1 - e * 0.35), p.giro);
        if (t < 1) vivos.push(p); else if (p.aoChegar) p.aoChegar();
      } else if (p.tipo === 'moeda') {
        p.idade++; p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
        this.desenharMoeda(p.x, p.y, p.r, p.giro);
        if (p.y < this.h + 30 && p.idade < p.vida) vivos.push(p);
      } else if (p.tipo === 'coracao') {
        p.idade++; p.fase += 0.12; p.x += p.vx + Math.sin(p.fase) * 0.5; p.y += p.vy;
        const alfa = Math.min(1, (p.vida - p.idade) / 30, p.idade / 8);
        this.desenharCoracao(p.x, p.y, p.s * (0.6 + Math.min(1, p.idade / 12) * 0.4), p.cor, Math.max(0, alfa));
        if (p.idade < p.vida) vivos.push(p);
      }
    }
    this.lista = vivos;
    if (vivos.length) requestAnimationFrame(() => this.quadro());
    else { this.rodando = false; ctx.clearRect(0, 0, this.w, this.h); }
  }
}

// ───────── chat que rola de verdade ─────────

function empurrarChat(lista, usuario, texto, classe, maximo = 8) {
  const li = document.createElement('li');
  if (classe) li.className = classe;
  const b = document.createElement('b');
  b.textContent = usuario;
  li.append(b, document.createTextNode(texto));
  const antes = [...lista.children].map((e) => e.offsetTop);
  lista.append(li);
  if (animar) {
    [...lista.children].forEach((e, i) => {
      if (e === li) return;
      const d = antes[i] - e.offsetTop;
      if (d) gsap.fromTo(e, { y: d }, { y: 0, duration: 0.32, ease: 'power2.out', overwrite: true });
    });
    gsap.from(li, { y: 14, opacity: 0, scale: 0.92, transformOrigin: 'left bottom', duration: 0.32, ease: 'back.out(1.6)' });
  }
  while (lista.children.length > maximo) lista.firstElementChild.remove();
}

// ───────── HERO: a live acontecendo ─────────

const ESPECTADORES = [
  { tt: 'bia.joga', rbx: 'BiaPlays_22', presente: 'Galáxia', qtd: 'x1', moedas: 1000 },
  { tt: 'pedrinho_rbx', rbx: 'Pedrinho_RBX', presente: 'Rosquinha', qtd: 'x5', moedas: 150 },
  { tt: 'caio.zz', rbx: 'CaioZz_07', presente: 'Rosa', qtd: 'x10', moedas: 10 },
  { tt: 'duda_tt', rbx: 'DudaPlays', presente: 'Perfume', qtd: 'x2', moedas: 40 },
  { tt: 'nina.live', rbx: 'Nina_007', presente: 'Rosquinha', qtd: 'x3', moedas: 90 },
];
const USUARIOS = ['lucas.rbx', 'gabi', 'theo.live', 'mari_tt', 'joaozin', 'kaka.rbx', 'lele', 'fe.rbx', 'vini_07'];
const FALAS = ['kkkkk', 'entrei!!', 'manda turbo', 'olha eu ali', 'boa noite live', 'TURBOOO', 'cadê meu avatar', 'eu sou o de chapéu', 'bora bora', 'quero ser rei do baile', 'LuaGamer09', 'Fe_rbx', 'KakaPlays', 'eitaaa', 'que fogo'];

function iniciarHero() {
  const cena = $('#cena');
  if (!cena) return;
  const celular = $('#celular');
  const cartao = $('#cartao-live');
  const chat = $('#chat');
  const tag = $('#palco-tag');
  const toast = $('#toast');
  const contador = $('#contador-moedas');
  const ultimo = $('#cl-ultimo');
  const pessoas = $('#pessoas');
  const curtidas = $('#curtidas');
  let moedas = 4320;

  if (!animar) return;

  const fx = new Particulas($('#cena-canvas'));
  const coracaoIcone = $('.live-barra .ico-cheio');
  let ativo = false;
  let indice = 0;
  let timers = [];
  const depois = (ms, fn) => timers.push(setTimeout(fn, ms));

  gsap.set(tag, { opacity: 0 });
  gsap.set(toast, { opacity: 0 });
  gsap.set(celular, { rotation: -2 });

  function evento() {
    if (!ativo) return;
    const e = ESPECTADORES[indice++ % ESPECTADORES.length];
    empurrarChat(chat, e.tt, e.rbx, 'chat-nick');

    depois(800, () => {
      tag.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = e.rbx;
      tag.append(b, document.createTextNode(' entrou no palco'));
      gsap.fromTo(tag, { opacity: 0, scale: 0.6, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2.4)' });
      const p = fx.ponto(tag, 0.5, 0.5);
      fx.confete(p.x, p.y, 10, 0.6);
    });

    depois(2000, () => {
      $('.lp-avatar', toast).textContent = e.tt[0].toUpperCase();
      $('.lp-texto b', toast).textContent = e.tt;
      $('.lp-texto span', toast).textContent = 'mandou ' + e.presente;
      $('.lp-qtd', toast).textContent = e.qtd;
      gsap.fromTo(toast, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.45, ease: 'back.out(1.7)' });
      gsap.fromTo($('.lp-qtd', toast), { scale: 2.2 }, { scale: 1, duration: 0.5, delay: 0.2, ease: 'back.out(3)' });
    });

    depois(2350, () => {
      const palco = fx.ponto($('.celular-jogo'), 0.5, 0.36);
      const grande = e.moedas >= 500;
      fx.confete(palco.x, palco.y, grande ? 70 : 28, grande ? 1.2 : 0.85);
      if (grande) depois(260, () => fx.confete(palco.x + entre(-50, 50), palco.y - 30, 40, 1));
      gsap.fromTo(celular, { x: 0 }, { x: grande ? 5 : 2, duration: 0.05, repeat: grande ? 7 : 3, yoyo: true, ease: 'none', clearProps: 'x' });

      const de = fx.ponto(toast, 0.85, 0.5);
      const para = fx.ponto(contador, 0.5, 0.5);
      const n = grande ? 14 : 7;
      let chegaram = 0;
      const inicio = moedas;
      moedas += e.moedas;
      fx.moedas(de, para, n, () => {
        chegaram++;
        const alvo = { v: Number(contador.textContent.replace(/\./g, '')) };
        gsap.to(alvo, { v: inicio + (e.moedas * chegaram) / n, duration: 0.25, ease: 'power2.out', onUpdate: () => { contador.textContent = formatar(alvo.v); } });
        if (chegaram === 1) gsap.fromTo(cartao, { scale: 1 }, { scale: 1.05, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
        if (chegaram === n) {
          ultimo.innerHTML = '';
          const b = document.createElement('b');
          b.textContent = '+' + formatar(e.moedas);
          ultimo.append(document.createTextNode(`${e.tt} mandou ${e.presente} `), b);
          gsap.fromTo(contador, { scale: 1.25 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', transformOrigin: 'left center' });
        }
      });
    });

    depois(4600, () => {
      gsap.to(toast, { opacity: 0, x: -30, duration: 0.3, ease: 'power2.in' });
      gsap.to(tag, { opacity: 0, scale: 0.8, duration: 0.25, ease: 'power2.in' });
    });

    depois(5600, evento);
  }

  function falaSolta() {
    if (!ativo) return;
    empurrarChat(chat, sortear(USUARIOS), sortear(FALAS));
    depois(entre(900, 1700), falaSolta);
  }

  function coracoes() {
    if (!ativo) return;
    const p = fx.ponto(coracaoIcone, 0.5, 0.2);
    fx.coracao(p.x + entre(-4, 4), p.y);
    depois(entre(220, 520), coracoes);
  }

  function publico() {
    if (!ativo) return;
    const v = Number(pessoas.textContent.replace(/\./g, '')) + Math.round(entre(-6, 14));
    pessoas.textContent = formatar(v);
    curtidas.textContent = formatar(Number(curtidas.textContent.replace(/\./g, '')) + Math.round(entre(3, 19)));
    depois(1400, publico);
  }

  function ligar() {
    if (ativo) return;
    ativo = true;
    depois(500, evento);
    depois(1200, falaSolta);
    depois(300, coracoes);
    depois(1000, publico);
  }

  function desligar() {
    ativo = false;
    timers.forEach(clearTimeout);
    timers = [];
  }

  // abertura: título sobe linha a linha, celular entra girando, cartão encaixa
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .from('.hero h1 .linha', { y: 60, opacity: 0, rotation: 2, duration: 0.8, stagger: 0.12 })
    .from('.hero-lead, .hero-acoes, .hero .selos-mini', { y: 20, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=0.45')
    .from(celular, { y: 120, rotation: 8, opacity: 0, duration: 1, ease: 'back.out(1.2)' }, 0.15)
    .from(cartao, { x: 40, scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.8)' }, 0.75);
  document.documentElement.classList.add('pronto');

  quandoVisivel(cena, (v) => (v && !document.hidden ? ligar() : desligar()), 0.25);
  document.addEventListener('visibilitychange', () => (document.hidden ? desligar() : ligar()));

  // leve parallax com o mouse
  if (window.matchMedia('(pointer: fine)').matches) {
    const rotY = gsap.quickTo(celular, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const rotX = gsap.quickTo(celular, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const cx = gsap.quickTo(cartao, 'x', { duration: 0.8, ease: 'power3.out' });
    const cy = gsap.quickTo(cartao, 'y', { duration: 0.8, ease: 'power3.out' });
    $('#hero').addEventListener('pointermove', (ev) => {
      const nx = ev.clientX / window.innerWidth - 0.5;
      const ny = ev.clientY / window.innerHeight - 0.5;
      rotY(nx * 12); rotX(-ny * 8); cx(-nx * 18); cy(-ny * 14);
    });
  }
}

// ───────── frase que acende palavra por palavra no scroll ─────────

function iniciarFrase() {
  const frase = $('#frase-scroll');
  if (!frase) return;
  if (!animar) { frase.classList.add('revelada'); return; }
  const palavras = frase.textContent.trim().split(/\s+/);
  frase.textContent = '';
  frase.setAttribute('aria-label', palavras.join(' '));
  palavras.forEach((p, i) => {
    const s = document.createElement('span');
    s.className = 'palavra';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = p;
    frase.append(s, i < palavras.length - 1 ? ' ' : '');
  });
  gsap.to($$('.palavra', frase), {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: frase, start: 'top 82%', end: 'bottom 40%', scrub: 0.4 },
  });
}

// ───────── sem rosto: a câmera encolhe e leva a fita ─────────

function iniciarSemRosto() {
  const webcam = $('#webcam');
  if (!webcam || !animar) return;
  const fita = $('.fita', webcam);
  const off = $('.webcam-off', webcam);
  const rosto = $('.webcam-rosto', webcam);
  gsap.set(fita, { opacity: 0 });
  gsap.set(off, { opacity: 0 });

  gsap.timeline({ scrollTrigger: { trigger: '#stream', start: 'top 85%', end: 'center 50%', scrub: 0.6 } })
    .fromTo(webcam, { scale: 2.1 }, { scale: 1, ease: 'power2.inOut' })
    .to(rosto, { opacity: 0.35, ease: 'none' }, 0.55)
    .to(off, { opacity: 1, ease: 'none' }, 0.6);

  ScrollTrigger.create({
    trigger: '#stream', start: 'center 52%', once: true,
    onEnter: () => {
      gsap.fromTo(fita, { opacity: 0, scale: 2.6, rotation: -32 }, { opacity: 1, scale: 1, rotation: -14, duration: 0.45, ease: 'back.out(2.6)' });
      gsap.fromTo(webcam, { rotation: 0 }, { rotation: 2, duration: 0.06, repeat: 5, yoyo: true, delay: 0.3, ease: 'none' });
    },
  });

  gsap.from('.hud li', {
    x: -36, opacity: 0, duration: 0.45, stagger: 0.12, ease: 'back.out(1.8)',
    scrollTrigger: { trigger: '.hud', start: 'top 82%', once: true },
  });
  gsap.to('.hud-vivo', { boxShadow: 'inset 0 0 0 1.5px #FF3D7F, 0 0 22px rgba(255,61,127,.55)', duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
}

// ───────── como funciona: o app muda de estado conforme as etapas passam ─────────

function iniciarComoFunciona() {
  const disp = $('#disp');
  if (!disp) return;
  const etapas = $$('.etapa');
  const progresso = $('#disp-progresso');
  const prog = $('#prog');
  const pct = $('#prog-pct');
  const digitado = $('#digitado');
  const statusItens = $$('.disp-status li');
  const aoVivo = $('.disp-aovivo');
  const botao = $('#disp-botao');
  const toasts = $$('.dt');
  const fx = $('#disp-canvas') ? new Particulas($('#disp-canvas')) : null;
  let anima = null;
  let atual = 0;

  function estadoFinal(n) {
    if (n === 1) { prog.style.transform = 'scaleX(1)'; pct.textContent = '100'; }
    if (n === 2) digitado.textContent = 'seucanal';
    if (n === 3) { statusItens.forEach((li) => li.classList.add('ok')); aoVivo.style.opacity = 1; }
    if (n === 4) toasts.forEach((t) => { t.style.opacity = 1; });
  }

  function mudar(n) {
    if (n === atual) return;
    atual = n;
    disp.dataset.estado = String(n);
    progresso.style.transform = `scaleX(${n / 4})`;
    etapas.forEach((e) => e.classList.toggle('ativa', Number(e.dataset.etapa) === n));
    if (anima) anima.kill();
    if (!animar) { estadoFinal(n); return; }

    if (n === 1) {
      const v = { p: 0 };
      anima = gsap.timeline()
        .fromTo(prog, { scaleX: 0 }, { scaleX: 1, duration: 1.8, ease: 'power1.inOut' })
        .to(v, { p: 100, duration: 1.8, ease: 'power1.inOut', onUpdate: () => { pct.textContent = Math.round(v.p); } }, 0);
    } else if (n === 2) {
      const alvo = 'seucanal';
      const v = { i: 0 };
      digitado.textContent = '';
      anima = gsap.to(v, { i: alvo.length, duration: alvo.length * 0.11, delay: 0.35, ease: 'none', onUpdate: () => { digitado.textContent = alvo.slice(0, Math.round(v.i)); } });
    } else if (n === 3) {
      statusItens.forEach((li) => li.classList.remove('ok'));
      anima = gsap.timeline({ delay: 0.3 })
        .set(aoVivo, { opacity: 0 })
        .to(botao, { scaleX: 1.06, scaleY: 0.88, y: 6, duration: 0.09, ease: 'power2.out' })
        .to(botao, { scaleX: 1, scaleY: 1, y: 0, duration: 0.4, ease: 'back.out(3)' })
        .add(() => statusItens[0].classList.add('ok'), '+=0.15')
        .add(() => statusItens[1].classList.add('ok'), '+=0.35')
        .add(() => statusItens[2].classList.add('ok'), '+=0.35')
        .fromTo(aoVivo, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' });
    } else if (n === 4) {
      gsap.set(toasts, { opacity: 0 });
      anima = gsap.timeline({ delay: 0.25 });
      toasts.forEach((t, i) => {
        anima.fromTo(t, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, ease: 'back.out(1.8)' }, i * 0.55);
        anima.add(() => fx && fx.confete(fx.w * entre(0.35, 0.65), fx.h * 0.4, 40, 0.9), i * 0.55 + 0.1);
      });
    }
  }

  if (!animar || !temGsap) {
    etapas.forEach((e) => e.classList.add('ativa'));
    disp.dataset.estado = '4';
    progresso.style.transform = 'scaleX(1)';
    [1, 2, 3, 4].forEach(estadoFinal);
    return;
  }

  // no celular o app fica fixo no topo e o texto da etapa aparece logo abaixo dele, então a troca acontece mais embaixo
  const linha = window.matchMedia('(min-width: 980px)').matches ? '62%' : '78%';
  etapas.forEach((etapa) => {
    ScrollTrigger.create({
      trigger: etapa,
      start: `top ${linha}`,
      end: `bottom ${linha}`,
      onToggle: (st) => { if (st.isActive) mudar(Number(etapa.dataset.etapa)); },
    });
  });
  mudar(1);
}

// ───────── live comum x live jogando ─────────

const PARADA = [['ana', 'oi'], ['user8812', '...'], ['ana', 'alguém?'], ['rafa_', 'boa noite'], ['user8812', 'kk']];
const JOGANDO_NICKS = ['LuaGamer09', 'Fe_rbx', 'KakaPlays', 'Nina_007', 'Theo_rbx', 'Vini07'];
const JOGANDO_FALAS = ['TURBOOO', 'vai vai vai', 'olha eu na frente', 'me empurra', 'kkkkk a banana', 'quase'];
const AVISOS = ['Fe_rbx ligou o TURBO', 'Nina_007 jogou banana!', 'RAIO em 22 corredores', 'KakaPlays pegou o FOGUETE'];

function iniciarLives() {
  const parada = $('#live-parada .mini-chat');
  const jogando = $('#live-jogando .mini-chat');
  const aviso = $('#live-jogando .mini-aviso');
  if (!parada || !jogando) return;

  [['ana', 'oi'], ['user8812', '...']].forEach(([u, t]) => empurrarChat(parada, u, t));
  [['mari_tt', 'LuaGamer09', 'mc-nick'], ['joaozin', 'TURBOOO'], ['lele', 'mandou Rosa x10', 'mc-presente'], ['kaka.rbx', 'KakaPlays', 'mc-nick'], ['theo.live', 'me empurra']]
    .forEach(([u, t, c]) => empurrarChat(jogando, u, t, c));
  if (!animar) return;

  let ativo = false;
  let timers = [];
  let iParada = 2;
  const depois = (ms, fn) => timers.push(setTimeout(fn, ms));

  function tickParada() {
    if (!ativo) return;
    const [u, t] = PARADA[iParada++ % PARADA.length];
    empurrarChat(parada, u, t);
    depois(entre(3200, 4600), tickParada);
  }
  function tickJogando() {
    if (!ativo) return;
    const r = Math.random();
    const u = sortear(USUARIOS);
    if (r < 0.4) empurrarChat(jogando, u, sortear(JOGANDO_NICKS), 'mc-nick');
    else if (r < 0.62) empurrarChat(jogando, u, 'mandou ' + sortear(['Rosa x10', 'Rosquinha x5', 'Perfume x2', 'Galáxia']), 'mc-presente');
    else empurrarChat(jogando, u, sortear(JOGANDO_FALAS));
    depois(entre(380, 750), tickJogando);
  }
  function tickAviso() {
    if (!ativo) return;
    aviso.textContent = sortear(AVISOS);
    gsap.timeline()
      .fromTo(aviso, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.6)' })
      .to(aviso, { opacity: 0, y: -10, duration: 0.3, delay: 1.2 })
      .set(aviso, { y: 0 });
    depois(entre(2400, 3200), tickAviso);
  }

  quandoVisivel($('#comparativo .lives'), (v) => {
    if (v && !ativo) { ativo = true; tickParada(); tickJogando(); depois(800, tickAviso); }
    if (!v && ativo) { ativo = false; timers.forEach(clearTimeout); timers = []; }
  }, 0.2);

  gsap.from('.live-parada', { x: -40, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: '.lives', start: 'top 80%', once: true } });
  gsap.from('.live-jogando', { x: 40, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: '.lives', start: 'top 80%', once: true } });
  gsap.from('.lives-vs', { scale: 0, rotation: -90, duration: 0.6, delay: 0.35, ease: 'back.out(2.4)', scrollTrigger: { trigger: '.lives', start: 'top 80%', once: true } });
}

// ───────── demais momentos de scroll ─────────

function iniciarScroll() {
  if (!animar) return;

  gsap.from('.missoes li', {
    x: 50, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(1.6)',
    scrollTrigger: { trigger: '.missoes', start: 'top 82%', once: true },
  });

  gsap.fromTo('#janela', { rotationX: 22, y: 70, scale: 0.92 }, {
    rotationX: 0, y: 0, scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.app-visual', start: 'top 95%', end: 'top 40%', scrub: 0.6 },
  });

  ScrollTrigger.create({
    trigger: '.painel', start: 'top 85%', once: true,
    onEnter: () => {
      $$('.painel-top b').forEach((b, i) => {
        const v = { n: 0 };
        gsap.to(v, { n: Number(b.dataset.conta), duration: 1.2, delay: i * 0.12, ease: 'power3.out', onUpdate: () => { b.textContent = formatar(v.n); } });
      });
      gsap.from('.painel', { y: 30, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' });
    },
  });

  gsap.from('.plano', {
    y: 40, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.planos', start: 'top 85%', once: true },
  });

  ScrollTrigger.create({
    trigger: '.garantia', start: 'top 80%', once: true,
    onEnter: () => {
      gsap.timeline()
        .fromTo('#carimbo', { scale: 2.4, opacity: 0, rotation: -40 }, { scale: 1, opacity: 1, rotation: -8, duration: 0.5, ease: 'back.out(2)' })
        .fromTo('.garantia', { x: 0 }, { x: 4, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' }, '-=0.1');
    },
  });

  // CTA final: letras pulam e chovem moedas, uma vez
  const titulo = $('#final-titulo');
  const texto = titulo.textContent;
  titulo.setAttribute('aria-label', texto);
  titulo.textContent = '';
  texto.split(' ').forEach((palavra, i, todas) => {
    const p = document.createElement('span');
    p.style.display = 'inline-block';
    p.style.whiteSpace = 'nowrap';
    p.setAttribute('aria-hidden', 'true');
    for (const letra of palavra) {
      const l = document.createElement('span');
      l.className = 'letra';
      l.textContent = letra;
      p.append(l);
    }
    titulo.append(p, i < todas.length - 1 ? ' ' : '');
  });
  const chuva = new Particulas($('#final-canvas'));
  chuva.contorno = true;
  ScrollTrigger.create({
    trigger: '#final', start: 'top 65%', once: true,
    onEnter: () => {
      gsap.from('#final-titulo .letra', { y: 50, opacity: 0, rotation: () => entre(-25, 25), duration: 0.6, stagger: 0.022, ease: 'back.out(2.2)' });
      chuva.ajustar();
      chuva.chuva(window.innerWidth < 700 ? 34 : 70);
    },
  });
}

iniciarHero();
iniciarFrase();
iniciarSemRosto();
iniciarComoFunciona();
iniciarLives();
iniciarScroll();
document.documentElement.classList.add('pronto');
