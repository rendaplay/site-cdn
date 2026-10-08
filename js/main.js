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
  const mostrar = () => { botao.hidden = !video.paused; };
  video.addEventListener('play', mostrar);
  video.addEventListener('pause', mostrar);
  video.after(botao);
}

// No Clarity tinha gente tocando no preço: o cartão inteiro vale como o botão dele.
for (const plano of $$('.plano')) {
  const botao = plano.querySelector('[data-checkout]');
  plano.addEventListener('click', (e) => { if (!e.target.closest('a, button')) botao.click(); });
}

for (const video of $$('video')) {
  botaoDePlay(video);
  quandoVisivel(video, (visivel) => { if (!visivel) video.pause(); }, 0.25);
}
