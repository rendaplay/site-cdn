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

// ───────── vídeos: só baixam quando chegam na tela ─────────

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const video of $$('video')) {
  video.muted = true;
  if (reduzir) { video.pause(); video.controls = true; continue; }
  if (!('quandoVisivel' in video.dataset)) continue;
  quandoVisivel(video, (visivel) => {
    if (visivel) video.play().catch(() => { video.controls = true; });
    else video.pause();
  }, 0.25);
}
