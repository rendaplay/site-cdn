const CONFIG = window.CONFIG;

for (const link of document.querySelectorAll('[data-link]')) link.href = CONFIG.links[link.dataset.link];

// ───────── checklist de requisitos (lembra no navegador da pessoa) ─────────

const CHAVE = 'rendaplay-requisitos';
const caixas = [...document.querySelectorAll('[data-req]')];
const listas = [...document.querySelectorAll('.requisitos')];

function lerMarcados() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
}

function salvarMarcados(marcados) {
  try { localStorage.setItem(CHAVE, JSON.stringify(marcados)); } catch { /* sem armazenamento: só não lembra */ }
}

const marcados = lerMarcados();
for (const caixa of caixas) {
  caixa.checked = Boolean(marcados[caixa.dataset.req]);
  caixa.addEventListener('change', () => {
    marcados[caixa.dataset.req] = caixa.checked;
    salvarMarcados(marcados);
    atualizarPronto();
  });
}
// Celular e PC têm cada um a sua lista; "tiktok" vale pras duas.
function atualizarPronto() {
  for (const lista of listas) {
    const pronto = lista.nextElementSibling;
    pronto.hidden = ![...lista.querySelectorAll('[data-req]')].every((c) => c.checked);
  }
}
atualizarPronto();

// ───────── caminho: pelo celular ou pelo PC ─────────

const abas = [...document.querySelectorAll('[role="tab"]')];

function abrirCaminho(aba) {
  for (const outra of abas) {
    const ativa = outra === aba;
    outra.setAttribute('aria-selected', ativa);
    outra.tabIndex = ativa ? 0 : -1;
    const via = outra.getAttribute('aria-controls');
    document.getElementById(via).hidden = !ativa;
    document.querySelector(`.guia-nav[data-via="${via.replace('via-', '')}"]`).hidden = !ativa;
  }
}

for (const aba of abas) {
  aba.addEventListener('click', () => abrirCaminho(aba));
  aba.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const vizinha = abas[(abas.indexOf(aba) + 1) % abas.length];
    abrirCaminho(vizinha);
    vizinha.focus();
  });
}

// O HTML abre no celular (a maioria compra por ele). Link com ?via=pc, #pc ou âncora de um passo do PC abre no PC.
const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (new URLSearchParams(location.search).get('via') === 'pc' || location.hash === '#pc' || alvo?.closest('#via-pc')) {
  abrirCaminho(document.getElementById('aba-pc'));
  alvo?.scrollIntoView();
}

// ───────── copiar frases ─────────

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

for (const botao of document.querySelectorAll('.copiar')) {
  const rotulo = botao.querySelector('span');
  botao.addEventListener('click', async () => {
    const texto = botao.previousElementSibling.textContent.trim();
    const ok = await copiar(texto);
    rotulo.textContent = ok ? 'Copiado' : 'Selecione e copie';
    botao.classList.toggle('copiado', ok);
    setTimeout(() => { rotulo.textContent = 'Copiar'; botao.classList.remove('copiado'); }, 1800);
  });
}

// ───────── menu lateral acompanha o passo que está na tela ─────────

const linksNav = [...document.querySelectorAll('.guia-nav a')];
const secoes = linksNav.map((a) => document.querySelector(a.getAttribute('href')));
if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const i = secoes.indexOf(e.target);
      linksNav.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
      const trilho = linksNav[i].closest('ol');
      if (trilho.scrollWidth > trilho.clientWidth) {
        trilho.scrollTo({ left: linksNav[i].offsetLeft - trilho.clientWidth / 2 + linksNav[i].offsetWidth / 2, behavior: 'smooth' });
      }
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  secoes.forEach((s) => obs.observe(s));
}
