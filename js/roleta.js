// Roleta de saída: quem ameaça sair ganha o Pro pelo preço do Celular, com o Kit Live Lotada
// e a aula de estreia. Todo pedaço é algo que a pessoa recebe de verdade; a roleta para sempre
// no Pro porque ele leva os outros dois junto. Sem back redirect: a política do Meta veta.
(function () {
  'use strict';

  const R = window.RoletaRegras;
  const CONFIG = window.CONFIG || {};
  const LINK = CONFIG.checkout && CONFIG.checkout.proRoleta;
  const WHATS = CONFIG.links && CONFIG.links.whatsapp;
  if (!R) return;

  const CHAVE = 'rendaplay.roleta';
  const guardado = ler('localStorage', CHAVE) || {};
  if (!guardado.grupo) {
    guardado.grupo = R.sortearGrupo(Math.random());
    // Sem armazenamento a roleta não lembraria que já apareceu e voltaria a cada página.
    if (!gravar('localStorage', CHAVE, guardado)) guardado.grupo = 'controle';
  }
  const sessao = ler('sessionStorage', CHAVE) || {};
  if (!sessao.entrada) {
    sessao.entrada = Date.now();
    gravar('sessionStorage', CHAVE, sessao);
  }

  marcarGrupo();

  const FATIAS = [
    { linhas: ['Pro por', 'R$ 49,90'], cor: 'var(--verde)', tinta: 'var(--noite)' },
    { linhas: ['Kit Live', 'Lotada'], cor: 'var(--noite-3)', tinta: 'var(--branco)' },
    { linhas: ['Aula', 'ao vivo'], cor: 'var(--ouro)', tinta: 'var(--noite)' },
    { linhas: ['Pro por', 'R$ 49,90'], cor: 'var(--verde)', tinta: 'var(--noite)' },
    { linhas: ['Kit Live', 'Lotada'], cor: 'var(--noite-3)', tinta: 'var(--branco)' },
    { linhas: ['Aula', 'ao vivo'], cor: 'var(--ouro)', tinta: 'var(--noite)' },
  ];

  let aberta = false;
  let relogioId = 0;

  if (guardado.expira && R.restanteMs(guardado.expira, Date.now()) > 0) mostrarPilula();
  else armarGatilhos();

  // ───────── gatilhos ─────────

  function armarGatilhos() {
    if (guardado.grupo !== 'roleta' || guardado.viu || !LINK) return;

    const amostras = [];
    window.addEventListener('scroll', () => {
      const agora = performance.now();
      amostras.push({ t: agora, y: window.scrollY });
      while (amostras.length && agora - amostras[0].t > 600) amostras.shift();
      if (R.subiuRapido(amostras)) tentar('subiu');
    }, { passive: true });

    let saiuEm = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { saiuEm = Date.now(); return; }
      if (R.voltouDepoisDeSair(saiuEm, Date.now())) tentar(abriuCheckout() ? 'voltou_checkout' : 'voltou_aba');
      saiuEm = null;
    });

    // Voltar da Kiwify: com bfcache chega pelo pageshow; sem ele a página recarrega.
    window.addEventListener('pageshow', (e) => { if (e.persisted && abriuCheckout()) tentar('voltou_checkout'); });
    if (abriuCheckout()) setTimeout(() => tentar('voltou_checkout'), 1200);

    if (matchMedia('(pointer: fine)').matches) {
      document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget && e.clientY <= 0) tentar('mouse_saiu');
      });
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('a[href*="pay.kiwify.com.br"]') && !e.target.closest('.roleta')) {
        sessao.checkout = true;
        gravar('sessionStorage', CHAVE, sessao);
      }
    }, true);
  }

  function abriuCheckout() {
    return !!sessao.checkout;
  }

  function rolagem() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    return total > 0 ? (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight : 1;
  }

  function tentar(gatilho) {
    if (aberta) return;
    const pode = R.podeMostrar({
      grupo: guardado.grupo, jaViu: !!guardado.viu, temCheckout: !!LINK,
      desdeEntradaMs: Date.now() - sessao.entrada, rolagem: rolagem(), gatilho,
    });
    if (!pode) return;
    guardado.viu = true;
    gravar('localStorage', CHAVE, guardado);
    marcar('viu', { gatilho });
    abrir();
  }

  // ───────── janela ─────────

  function abrir() {
    aberta = true;
    const fundo = document.createElement('div');
    fundo.className = 'roleta';
    fundo.innerHTML = `
      <div class="roleta-caixa" role="dialog" aria-modal="true" aria-labelledby="roleta-titulo">
        <button class="roleta-fechar" type="button" aria-label="Fechar">×</button>
        <div class="roleta-giro">
          <p class="roleta-selo">Antes de ir</p>
          <h2 id="roleta-titulo">Você ganhou um giro</h2>
          <p class="roleta-sub">Todo prêmio da roleta é seu de verdade. Gira e vê o que cai.</p>
          <div class="roleta-roda">
            <span class="roleta-ponteiro" aria-hidden="true"></span>
            <svg class="roleta-disco" viewBox="-100 -100 200 200" aria-hidden="true">${desenharFatias()}</svg>
            <span class="roleta-miolo" aria-hidden="true">🎁</span>
          </div>
          <button class="botao botao-g roleta-girar" type="button">Girar a roleta</button>
        </div>
        <div class="roleta-premio" hidden>
          <p class="roleta-selo">🎉 Caiu no maior prêmio</p>
          <h2>Pro pelo preço do Celular</h2>
          <p class="roleta-preco"><s>R$ 79,90</s> <b>R$ 49,90</b></p>
          <ul class="roleta-itens">
            <li><b>Todos os jogos</b>: os do celular e os do Roblox no PC</li>
            <li><b>Kit Live Lotada</b>: capas, roteiro do que falar e títulos de live</li>
            <li><b>Aula ao vivo de estreia</b>: a gente monta sua 1ª live junto com você</li>
          </ul>
          <p class="roleta-relogio">Seu prêmio fica guardado por <b data-relogio>10:00</b></p>
          <a class="botao botao-g roleta-pegar" data-plano="roleta_pro" href="#">Quero meu prêmio</a>
          <p class="roleta-micro">30 dias de acesso, pagamento único. Garantia de 7 dias.</p>
          ${WHATS ? '<a class="roleta-aula" href="#">Agora não. Quero só a aula grátis</a>' : ''}
        </div>
      </div>`;
    document.body.appendChild(fundo);
    document.body.classList.add('roleta-aberta');
    requestAnimationFrame(() => fundo.classList.add('visivel'));

    const girar = fundo.querySelector('.roleta-girar');
    girar.focus();
    girar.addEventListener('click', () => girarRoda(fundo, girar), { once: true });
    fundo.querySelector('.roleta-fechar').addEventListener('click', () => fechar(fundo));
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(fundo); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key !== 'Escape' || !fundo.isConnected) return;
      document.removeEventListener('keydown', esc);
      fechar(fundo);
    });
  }

  function desenharFatias() {
    const passo = 360 / FATIAS.length;
    return FATIAS.map((f, i) => {
      // A fatia 0 nasce centrada no topo, embaixo do ponteiro.
      const ini = (i * passo - passo / 2 - 90) * Math.PI / 180;
      const fim = ((i + 1) * passo - passo / 2 - 90) * Math.PI / 180;
      const p = (a) => `${(96 * Math.cos(a)).toFixed(2)} ${(96 * Math.sin(a)).toFixed(2)}`;
      const meio = i * passo;
      return `<path d="M0 0 L${p(ini)} A96 96 0 0 1 ${p(fim)} Z" style="fill:${f.cor}"/>`
        + `<text transform="rotate(${meio})" style="fill:${f.tinta}">`
        + `<tspan x="0" y="-70">${f.linhas[0]}</tspan><tspan x="0" y="-56">${f.linhas[1]}</tspan></text>`;
    }).join('');
  }

  function girarRoda(fundo, botao) {
    marcar('girou');
    botao.disabled = true;
    botao.textContent = 'Girando…';
    const disco = fundo.querySelector('.roleta-disco');
    const rapido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duracao = rapido ? 600 : 3600;
    disco.style.transitionDuration = `${duracao}ms`;
    // Voltas inteiras: para com a fatia 0 de novo no ponteiro.
    disco.style.transform = `rotate(${(rapido ? 1 : 6) * 360}deg)`;
    setTimeout(() => {
      guardado.expira = Date.now() + R.VALIDADE_MS;
      gravar('localStorage', CHAVE, guardado);
      mostrarPremio(fundo);
    }, duracao + 250);
  }

  function mostrarPremio(fundo) {
    fundo.querySelector('.roleta-giro').hidden = true;
    const premio = fundo.querySelector('.roleta-premio');
    premio.hidden = false;
    prepararLinks(premio);
    contar(premio.querySelector('[data-relogio]'));
    premio.querySelector('.roleta-pegar').focus();
    marcar('premio');
  }

  function prepararLinks(raiz) {
    const pegar = raiz.querySelector('.roleta-pegar');
    pegar.href = comOrigem(LINK);
    pegar.addEventListener('click', () => marcar('checkout'));
    const aula = raiz.querySelector('.roleta-aula');
    if (aula) {
      // encodeURIComponent e não searchParams: o "+" no lugar do espaço aparece cru em alguns WhatsApp.
      const url = new URL(WHATS);
      const texto = 'Oi! Ganhei na roleta do site e quero a aula grátis de como fazer minha primeira live.';
      aula.href = `${url.origin}${url.pathname}?text=${encodeURIComponent(texto)}`;
      aula.addEventListener('click', () => marcar('aula'));
    }
  }

  function fechar(fundo) {
    marcar('fechou', { tinha_premio: guardado.expira ? 'sim' : 'nao' });
    fundo.classList.remove('visivel');
    document.body.classList.remove('roleta-aberta');
    setTimeout(() => fundo.remove(), 250);
    aberta = false;
    if (guardado.expira) mostrarPilula();
  }

  // ───────── lembrete com o tempo ─────────

  function mostrarPilula() {
    if (document.querySelector('.roleta-pilula')) return;
    const pilula = document.createElement('a');
    pilula.className = 'roleta-pilula';
    pilula.dataset.plano = 'roleta_pro';
    pilula.href = comOrigem(LINK);
    pilula.innerHTML = '<span aria-hidden="true">🎁</span> Pro por R$&nbsp;49,90&nbsp;· <b data-relogio></b>';
    pilula.addEventListener('click', () => marcar('checkout', { de: 'pilula' }));
    document.body.appendChild(pilula);
    document.body.classList.add('roleta-ativa');
    contar(pilula.querySelector('[data-relogio]'), () => {
      pilula.remove();
      document.body.classList.remove('roleta-ativa');
      marcar('expirou');
    });
  }

  function contar(el, aoAcabar) {
    clearInterval(relogioId);
    const tique = () => {
      const resta = R.restanteMs(guardado.expira, Date.now());
      for (const alvo of document.querySelectorAll('[data-relogio]')) alvo.textContent = R.relogio(resta);
      if (resta > 0) return;
      clearInterval(relogioId);
      if (aoAcabar) aoAcabar();
    };
    tique();
    relogioId = setInterval(tique, 1000);
  }

  // ───────── apoio ─────────

  // Mesma regra do main.js: o que veio no anúncio vai pro checkout, senão a venda fica sem campanha.
  function comOrigem(base) {
    const url = new URL(base);
    for (const [chave, valor] of new URLSearchParams(location.search)) {
      if (!url.searchParams.has(chave)) url.searchParams.set(chave, valor);
    }
    url.searchParams.set('sck', 'roleta');
    return url.toString();
  }

  function marcarGrupo() {
    if (window.clarity) clarity('set', 'roleta_grupo', guardado.grupo);
    else setTimeout(() => window.clarity && clarity('set', 'roleta_grupo', guardado.grupo), 3000);
    if (typeof gtag === 'function') gtag('event', 'roleta_grupo', { grupo: guardado.grupo });
  }

  function marcar(etapa, extra) {
    if (typeof gtag === 'function') gtag('event', 'roleta', { etapa, ...extra });
    if (window.clarity) clarity('event', `roleta_${etapa}`);
  }

  function ler(armazem, chave) {
    try { return JSON.parse(window[armazem].getItem(chave)); } catch (e) { return null; }
  }

  function gravar(armazem, chave, valor) {
    try {
      window[armazem].setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }
})();
