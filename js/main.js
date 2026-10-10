const CONFIG = window.CONFIG;

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function quandoVisivel(el, aoMudar, limiar = 0.2) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { aoMudar(true); return; }
  new IntersectionObserver(([e]) => aoMudar(e.isIntersecting), { threshold: limiar }).observe(el);
}

// ───────── links ─────────

// Os UTMs do anúncio precisam chegar no checkout, senão a venda não é atribuída à campanha.
// Por isso a troca de link preserva o que já estava na URL (inclusive o que a UTMify acrescentou).
function comParametros(base, hrefAtual) {
  const url = new URL(base);
  const extras = [new URLSearchParams(location.search)];
  try { extras.push(new URL(hrefAtual, location.href).searchParams); } catch (e) { /* href relativo sem query */ }
  for (const params of extras) {
    for (const [chave, valor] of params) if (!url.searchParams.has(chave)) url.searchParams.set(chave, valor);
  }
  return url.toString();
}

function apontar(link, base) {
  if (base) link.href = comParametros(base, link.getAttribute('href'));
}

function aplicarLinks() {
  for (const botao of $$('[data-checkout]')) apontar(botao, CONFIG.checkout[botao.dataset.checkout]);
  for (const link of $$('[data-link]')) link.href = CONFIG.links[link.dataset.link];
}

aplicarLinks();

// ───────── topo e barra de CTA ─────────

const topo = $('#topo');
if (topo) {
  const marcarTopo = () => topo.classList.toggle('rolou', window.scrollY > 8);
  window.addEventListener('scroll', marcarTopo, { passive: true });
  marcarTopo();
}

const barraCta = $('#barra-cta');
if (barraCta) {
  const visiveis = { hero: true, precos: false, final: false };
  const atualizarBarra = () => barraCta.classList.toggle('visivel', !visiveis.hero && !visiveis.precos && !visiveis.final);
  for (const id of Object.keys(visiveis)) quandoVisivel($('#' + id), (v) => { visiveis[id] = v; atualizarBarra(); }, 0);
}

// ───────── vídeos: só baixam no play ─────────

// Vídeo parado com play: tocar já liga o som, um vídeo por vez.
function tocar(video) {
  for (const outro of $$('video')) if (outro !== video) outro.pause();
  video.muted = false;
  video.play().catch(() => { video.controls = true; });
}

function botaoDePlay(video) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'video-play';
  botao.innerHTML = '<svg class="ico ico-cheio" aria-hidden="true"><use href="#i-play"/></svg><span>Assistir com som</span>';
  botao.addEventListener('click', () => tocar(video));
  video.addEventListener('click', () => (video.paused ? tocar(video) : video.pause()));
  const mostrar = () => {
    botao.hidden = !video.paused;
    video.closest('.moldura')?.classList.toggle('tocando', !video.paused);
  };
  video.addEventListener('play', mostrar);
  video.addEventListener('pause', mostrar);
  video.after(botao);
}

// No Clarity tinha gente tocando no preço: o cartão inteiro vale como o botão dele.
for (const plano of $$('.plano')) {
  const botao = plano.querySelector('[data-checkout]');
  plano.addEventListener('click', (e) => { if (!e.target.closest('a, button')) botao.click(); });
}

// ───────── tutorial: barra de controle própria ─────────

const ESCONDER_BARRA_MS = 2500;

function minutos(segundos) {
  const s = Math.floor(segundos || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function icone(nome, cheio = false) {
  return `<svg class="ico${cheio ? ' ico-cheio' : ''}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;
}

// O tutorial é longo: precisa avançar e voltar, e a barra nativa destoa da página.
function barraDeControle(video) {
  const moldura = video.closest('.moldura');
  const barra = document.createElement('div');
  barra.className = 'player';
  barra.innerHTML = `
    <button type="button" class="player-botao" data-acao="play"></button>
    <div class="player-trilha" role="slider" tabindex="0" aria-label="Posição do vídeo" aria-valuemin="0">
      <div class="player-carregado"></div><div class="player-andou"></div>
    </div>
    <span class="player-tempo">0:00</span>
    <button type="button" class="player-botao" data-acao="som"></button>
    <button type="button" class="player-botao" data-acao="tela" aria-label="Tela cheia">${icone('tela')}</button>`;
  moldura.append(barra);

  const [botaoPlay, botaoSom] = [$('[data-acao="play"]', barra), $('[data-acao="som"]', barra)];
  const trilha = $('.player-trilha', barra);
  const tempo = $('.player-tempo', barra);

  const desenharPlay = () => {
    botaoPlay.innerHTML = icone(video.paused ? 'play' : 'pausa', true);
    botaoPlay.setAttribute('aria-label', video.paused ? 'Tocar' : 'Pausar');
  };
  const desenharSom = () => {
    botaoSom.innerHTML = icone(video.muted ? 'mudo' : 'som');
    botaoSom.setAttribute('aria-label', video.muted ? 'Ligar o som' : 'Tirar o som');
  };
  const desenharTempo = () => {
    const total = video.duration || 0;
    const fracao = total ? video.currentTime / total : 0;
    trilha.style.setProperty('--andou', fracao);
    trilha.setAttribute('aria-valuemax', Math.floor(total));
    trilha.setAttribute('aria-valuenow', Math.floor(video.currentTime));
    trilha.setAttribute('aria-valuetext', `${minutos(video.currentTime)} de ${minutos(total)}`);
    tempo.textContent = `${minutos(video.currentTime)} / ${minutos(total)}`;
  };
  const desenharCarregado = () => {
    const { buffered, duration } = video;
    if (buffered.length && duration) trilha.style.setProperty('--carregado', buffered.end(buffered.length - 1) / duration);
  };

  let esconder;
  const mexeu = () => {
    moldura.classList.add('mexendo');
    clearTimeout(esconder);
    esconder = setTimeout(() => moldura.classList.remove('mexendo'), ESCONDER_BARRA_MS);
  };

  const irPara = (e) => {
    const { left, width } = trilha.getBoundingClientRect();
    if (video.duration) video.currentTime = Math.min(Math.max((e.clientX - left) / width, 0), 1) * video.duration;
  };
  trilha.addEventListener('pointerdown', (e) => {
    trilha.setPointerCapture(e.pointerId);
    moldura.classList.add('arrastando');
    irPara(e);
  });
  trilha.addEventListener('pointermove', (e) => { if (trilha.hasPointerCapture(e.pointerId)) irPara(e); });
  trilha.addEventListener('pointerup', () => moldura.classList.remove('arrastando'));
  trilha.addEventListener('keydown', (e) => {
    const passo = { ArrowRight: 5, ArrowLeft: -5 }[e.key];
    if (!passo) return;
    e.preventDefault();
    video.currentTime = Math.min(Math.max(video.currentTime + passo, 0), video.duration || 0);
  });

  botaoPlay.addEventListener('click', () => (video.paused ? tocar(video) : video.pause()));
  botaoSom.addEventListener('click', () => { video.muted = !video.muted; });
  $('[data-acao="tela"]', barra).addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (moldura.requestFullscreen) moldura.requestFullscreen();
    // iPhone só deixa o próprio vídeo ir pra tela cheia.
    else video.webkitEnterFullscreen?.();
  });

  video.addEventListener('play', () => { moldura.classList.add('comecou'); desenharPlay(); mexeu(); });
  video.addEventListener('pause', desenharPlay);
  video.addEventListener('volumechange', desenharSom);
  video.addEventListener('timeupdate', desenharTempo);
  video.addEventListener('loadedmetadata', desenharTempo);
  video.addEventListener('progress', desenharCarregado);
  // No toque, com a barra escondida, o primeiro toque só mostra a barra em vez de pausar.
  let soMostrar = false;
  video.addEventListener('pointerdown', (e) => {
    soMostrar = e.pointerType === 'touch' && !video.paused && !moldura.classList.contains('mexendo');
  });
  moldura.addEventListener('click', (e) => {
    if (soMostrar && e.target === video) e.stopPropagation();
    soMostrar = false;
  }, true);
  moldura.addEventListener('pointermove', mexeu);
  moldura.addEventListener('pointerdown', mexeu);
  barra.addEventListener('focusin', mexeu);
  desenharPlay();
  desenharSom();
}

// ───────── tutorial: aba do celular ou do PC ─────────

function abrirAba(aba) {
  for (const outra of $$('.tutorial-aba')) {
    const ativa = outra === aba;
    outra.setAttribute('aria-selected', ativa);
    outra.tabIndex = ativa ? 0 : -1;
    const painel = document.getElementById(outra.getAttribute('aria-controls'));
    painel.hidden = !ativa;
    if (!ativa) painel.querySelector('video')?.pause();
  }
}

const abas = $$('.tutorial-aba');
for (const aba of abas) {
  aba.addEventListener('click', () => abrirAba(aba));
  aba.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const vizinha = abas[(abas.indexOf(aba) + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
    abrirAba(vizinha);
    vizinha.focus();
  });
}
// O HTML já abre no celular (a maioria chega por ele); no computador abre no PC.
const abaPc = $('#aba-pc');
if (abaPc && matchMedia('(pointer: fine) and (min-width: 900px)').matches) abrirAba(abaPc);

for (const video of $$('video')) {
  botaoDePlay(video);
  if (video.hasAttribute('data-controles')) barraDeControle(video);
  quandoVisivel(video, (visivel) => { if (!visivel) video.pause(); }, 0.25);
}
