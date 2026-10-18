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

// ───────── WhatsApp: origem ─────────

// O wa.me só leva o texto: sem isto as UTMs do anúncio morrem no clique e a venda
// fechada no zap cai na Utmify como "sem UTM". O código vai no fim do texto pronto
// e as UTMs ficam no TrelaDesk esperando a primeira mensagem com ele.
const ORIGEM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'fbclid'];
// 32 símbolos (sem 0/O/1/I): byte % 32 não puxa nenhum para mais vezes.
const ALFABETO_REF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function novoRef() {
  return [...crypto.getRandomValues(new Uint8Array(5))].map((b) => ALFABETO_REF[b % 32]).join('');
}

// A Utmify guarda as UTMs da página de entrada no localStorage, com "<chave>_exp".
function origemGuardada(chave) {
  try {
    const valor = localStorage.getItem(chave);
    const expira = localStorage.getItem(chave + '_exp');
    return valor && (!expira || new Date(expira) > new Date()) ? valor : '';
  } catch (e) {
    return '';
  }
}

function origemDaVisita() {
  const daUrl = new URLSearchParams(location.search);
  const temNaUrl = ORIGEM.some((k) => daUrl.get(k));
  const origem = {};
  for (const k of ORIGEM) {
    const valor = temNaUrl ? daUrl.get(k) : origemGuardada(k);
    if (valor) origem[k] = valor;
  }
  return origem;
}

// Form-urlencoded não dispara preflight: o beacon sai mesmo com a aba indo para o WhatsApp.
function registrarOrigem(ref) {
  const dados = new URLSearchParams({ ref, page: location.href.slice(0, 2000), ...origemDaVisita() });
  if (navigator.sendBeacon && navigator.sendBeacon(CONFIG.leadRef, dados)) return;
  fetch(CONFIG.leadRef, { method: 'POST', body: dados, keepalive: true, mode: 'no-cors' }).catch(() => {});
}

// encodeURIComponent e não searchParams: o "+" no lugar do espaço aparece cru em alguns WhatsApp.
function comRef(href, ref) {
  const url = new URL(href);
  const texto = (url.searchParams.get('text') || '').replace(/\s*\(ref [A-Z2-9]{5}\)$/, '');
  return `${url.origin}${url.pathname}?text=${encodeURIComponent(`${texto} (ref ${ref})`.trim())}`;
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href*="wa.me/"]');
  if (!link || !CONFIG.leadRef) return;
  // Qualquer falha aqui abre o wa.me como estava: o clique nunca trava.
  try {
    const ref = novoRef();
    link.href = comRef(link.href, ref);
    registrarOrigem(ref);
  } catch (err) { /* segue sem código */ }
}, true);

// ───────── topo e barra de CTA ─────────

const topo = $('#topo');
if (topo) {
  const marcarTopo = () => topo.classList.toggle('rolou', window.scrollY > 8);
  window.addEventListener('scroll', marcarTopo, { passive: true });
  marcarTopo();
}

const barraCta = $('#barra-cta');
if (barraCta) {
  // No celular o hero tem o vídeo e passa de uma tela: esperar ele sumir atrasava a barra demais.
  const visiveis = { precos: false, final: false };
  const atualizarBarra = () => {
    const rolouUmaTela = window.scrollY > window.innerHeight * 0.9;
    barraCta.classList.toggle('visivel', rolouUmaTela && !visiveis.precos && !visiveis.final);
  };
  window.addEventListener('scroll', atualizarBarra, { passive: true });
  for (const id of Object.keys(visiveis)) quandoVisivel($('#' + id), (v) => { visiveis[id] = v; atualizarBarra(); }, 0);
}

// ───────── vídeos: só baixam no play ─────────

// Vídeo parado com play: tocar já liga o som, um vídeo por vez.
// Tirar o mudo e dar play têm que sair no mesmo toque, sem await no meio: o navegador do
// Instagram só libera o som dentro do gesto, e no Clarity o 1º toque ficava mudo.
function tocar(video) {
  for (const outro of $$('video')) if (outro !== video) outro.pause();
  video.muted = false;
  video.play().catch(() => { video.controls = true; });
}

function botaoDePlay(video) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'video-play';
  botao.innerHTML = `${video.hasAttribute('data-auto') ? icone('som') : icone('play', true)}<span>Assistir com som</span>`;
  const rotulo = botao.querySelector('span');
  let carregando = false;
  botao.addEventListener('click', () => { if (!carregando) tocar(video); });
  // No Clarity tinha gente tocando várias vezes enquanto o vídeo baixava: o 2º toque pausava.
  video.addEventListener('click', () => {
    if (carregando) return;
    if (video.paused || video.muted) tocar(video); else video.pause();
  });
  // Mudo não conta como carregando: o toque pra ligar o som nunca pode ser ignorado.
  const mostrar = () => {
    carregando = !video.paused && !video.muted && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    botao.classList.toggle('carregando', carregando);
    rotulo.textContent = carregando ? 'Carregando…' : 'Assistir com som';
    botao.hidden = !video.paused && !video.muted && !carregando;
    video.closest('.moldura')?.classList.toggle('tocando', !video.paused);
  };
  video.addEventListener('play', mostrar);
  video.addEventListener('playing', mostrar);
  video.addEventListener('pause', mostrar);
  video.addEventListener('volumechange', mostrar);
  video.after(botao);
}

// O criativo do topo roda mudo sozinho, mas só depois que a página carregou, pra não
// disputar banda com a primeira tela. Volta a rodar quando reaparece, enquanto ninguém ligou o som.
function tocarMudo(video) {
  let visivel = false;
  let liberado = false;
  const seguir = () => {
    if (visivel && liberado && video.paused && video.muted) video.play().catch(() => {});
  };
  const liberar = () => { liberado = true; seguir(); };
  if (document.readyState === 'complete') liberar();
  else {
    window.addEventListener('load', liberar, { once: true });
    setTimeout(liberar, 2500);
  }
  quandoVisivel(video, (v) => { visivel = v; seguir(); }, 0.25);
}

// No Clarity tinha gente tocando no preço: o cartão inteiro vale como o botão dele.
for (const plano of $$('.plano')) {
  const botao = plano.querySelector('[data-checkout]');
  plano.addEventListener('click', (e) => { if (!e.target.closest('a, button')) botao.click(); });
}

// ───────── jogos: tocar no card abre o vídeo (ou a capa grande) ─────────

// Jogo do PC só vem no Pro; o resto entra no Celular, que é o passe mais barato.
const COMPRA_JOGO = {
  celular: { micro: 'Vem em todos os planos: Celular a partir de R$ 49,90 ou Pro com os jogos do PC.', selo: 'Roda no celular', icone: 'celular' },
  pc: { micro: 'Vem no plano Pro e no Vitalício, junto com os 9 jogos do celular.', selo: 'PC com avatar do Roblox', icone: 'windows' },
};

const modalJogo = $('#modal-jogo');
if (modalJogo) {
  const videoModal = $('video', modalJogo);
  const telaModal = $('.modal-tela', modalJogo);
  const imagemModal = $('.modal-capa', modalJogo);
  const comprar = $('.modal-comprar', modalJogo);

  // O vídeo vem do CDN e o primeiro acesso demora uns segundos: começa a baixar
  // na intenção (mouse em cima, dedo encostando) pra ganhar esse tempo antes do clique.
  function carregar({ video, poster }) {
    if (!video || videoModal.getAttribute('src') === video) return;
    videoModal.poster = poster;
    videoModal.preload = 'auto';
    videoModal.src = video;
  }

  for (const card of $$('.jogo-abrir')) {
    for (const evento of ['pointerenter', 'pointerdown', 'focus']) {
      card.addEventListener(evento, () => carregar(card.dataset), { passive: true });
    }
    card.addEventListener('click', () => {
      const { video, imagem } = card.dataset;
      const compra = COMPRA_JOGO[card.closest('.jogos-grade-pc') ? 'pc' : 'celular'];
      const frase = [...card.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
      $('#modal-jogo-nome').textContent = $('b', card).textContent;
      $('.modal-frase', modalJogo).textContent = frase;
      $('.modal-selo span', modalJogo).textContent = compra.selo;
      $('.modal-selo use', modalJogo).setAttribute('href', `#i-${compra.icone}`);
      $('.modal-micro', modalJogo).textContent = compra.micro;
      comprar.dataset.cta = card.dataset.cta.replace('jogo_', 'planos_');
      telaModal.hidden = !video;
      imagemModal.hidden = !imagem;
      if (imagem) imagemModal.src = imagem;
      modalJogo.showModal();
      if (video) {
        carregar(card.dataset);
        tocar(videoModal);
      }
    });
  }
  $('.modal-fechar', modalJogo).addEventListener('click', () => modalJogo.close());
  comprar.addEventListener('click', () => modalJogo.close());
  modalJogo.addEventListener('click', (e) => { if (e.target === modalJogo) modalJogo.close(); });
  modalJogo.addEventListener('close', () => videoModal.pause());
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
  if (video.hasAttribute('data-auto')) tocarMudo(video);
}
