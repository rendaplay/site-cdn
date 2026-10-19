(() => {
  const SUGESTOES_INICIAIS = ['Roda só no celular?', 'Tem tutorial?', 'Quanto custa?', 'É confiável?', 'Como ganho dinheiro?', 'Preciso aparecer?'];
  const CDN = 'https://cdn.jsdelivr.net/gh/rendaplay/site-cdn@2c133e6700c4/video/';
  const VIDEOS_JOGOS = 'https://r2.fivemanage.com/q2mFLddn9Ulmua6uY0t2n/rendaplay/jogos/';
  const NOMES_JOGOS = {
    batalha: 'Batalha de Torres', urna: 'Urna Eletrônica', presidencial: 'Corrida Presidencial', pipa: 'Pipa Combate',
    escalada: 'Escalada', racha: 'Racha da Live', chefao: 'Chefão Coletivo', flappy: 'Voa, Tuca!', bolinha: 'Chuva de Bolinha',
    baile: 'Baile da Live', corrida: 'Corrida da Live', duelo: 'Duelo de Aura', desfile: 'Desfile', show: 'Show da Live', ilha: 'Sobreviva à Ilha',
  };
  const PLANOS = {
    celular: { nome: 'Celular', preco: 'R$ 49,90', de: '', detalhe: '9 jogos · só o celular · 30 dias', checkout: 'celularPasse' },
    pro: { nome: 'Pro', preco: 'R$ 79,90', de: 'R$ 119,90', detalhe: '15 jogos · celular + Roblox no PC · lançamentos', checkout: 'proPasse', destaque: true },
    vitalicio: { nome: 'Vitalício', preco: 'R$ 397', de: '', detalhe: 'Os 15 jogos de hoje, pra sempre', checkout: 'vitalicio' },
  };
  const ZAP_EQUIPE = 'https://wa.me/5511941867789?text=' + encodeURIComponent('Oi! Vim pelo chat do site da Renda Play e queria falar com a equipe.');
  const EMAIL_EQUIPE = 'contato.rendaplay@gmail.com';

  const conversaId = Math.random().toString(36).slice(2, 10);
  const conversa = [];
  let esperando = false;
  const celular = matchMedia('(max-width: 599px)');
  // Teste A/B contra o botão do WhatsApp: metade das visitas segue com o zap. ?atendimento=chat|zap força um lado.
  const LADOS = ['chat', 'zap'];
  const variante = (() => {
    const pedida = new URLSearchParams(location.search).get('atendimento');
    let salva = null;
    try { salva = localStorage.getItem('rendaplay.atendimento'); } catch (e) { /* aba privada */ }
    const lado = LADOS.includes(pedida) ? pedida : LADOS.includes(salva) ? salva : LADOS[Math.random() < 0.5 ? 0 : 1];
    try { localStorage.setItem('rendaplay.atendimento', lado); } catch (e) { /* aba privada */ }
    return lado;
  })();
  const evento = (nome) => { if (typeof gtag === 'function') gtag('event', nome, { variante_atendimento: variante }); };
  if (typeof gtag === 'function') gtag('set', 'user_properties', { variante_atendimento: variante });
  evento('ab_atendimento');
  if (variante === 'zap') return;

  document.querySelector('.zap')?.remove();

  const botao = document.createElement('button');
  botao.className = 'chat-botao';
  botao.type = 'button';
  botao.setAttribute('aria-label', 'Tirar dúvida no chat');
  botao.innerHTML = `
    <svg class="chat-ico-abrir" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.4 3.6c-.6.5-1.6.1-1.6-.8V5.5Z"/><circle cx="8.5" cy="9.5" r="1.2"/><circle cx="12" cy="9.5" r="1.2"/><circle cx="15.5" cy="9.5" r="1.2"/></svg>
    <svg class="chat-ico-fechar" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

  const convite = document.createElement('button');
  convite.className = 'chat-convite';
  convite.type = 'button';
  convite.hidden = true;
  convite.innerHTML = `
    <img src="marca/simbolo.svg" alt="" width="32" height="32">
    <span><b>Ficou com dúvida?</b>Pergunta aqui, respondo em segundos.</span>`;

  const painel = document.createElement('section');
  painel.className = 'chat-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Chat da Renda Play');
  painel.hidden = true;
  painel.innerHTML = `
    <header class="chat-topo">
      <button type="button" class="chat-voltar" aria-label="Fechar chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="chat-avatar"><img src="marca/simbolo.svg" alt="" width="40" height="40"></span>
      <div class="chat-quem">
        <b>Assistente Renda Play</b>
        <span><i></i>Online · responde em segundos</span>
      </div>
      <button type="button" class="chat-fechar" aria-label="Fechar chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="chat-lista" role="log" aria-live="polite">
      <div class="chat-intro">
        <span class="chat-avatar chat-avatar-grande"><img src="marca/simbolo.svg" alt="" width="56" height="56"></span>
        <b>Oi! Eu sou a assistente da Renda Play</b>
        <p>Fui treinada pela nossa equipe com as dúvidas reais de quem já faz live com os jogos. Se precisar, chamo alguém da equipe pra você.</p>
        <ul>
          <li>7 dias de garantia</li>
          <li>Pagamento pela Kiwify</li>
          <li>Acesso na hora</li>
          <li>Suporte no WhatsApp</li>
        </ul>
      </div>
    </div>
    <form class="chat-form">
      <input type="text" name="texto" placeholder="Escreva sua dúvida…" autocomplete="off" enterkeyhint="send" maxlength="500" aria-label="Sua mensagem">
      <button type="submit" aria-label="Enviar" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z"/></svg></button>
    </form>
    <p class="chat-rodape">Assistente virtual treinada pela equipe Renda Play</p>`;

  document.body.append(painel, convite, botao);

  const lista = painel.querySelector('.chat-lista');
  const form = painel.querySelector('.chat-form');
  const campo = form.elements.texto;
  const enviarBotao = form.querySelector('button');

  // ───────── texto da IA ─────────

  const escapar = (t) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function comUtms(url) {
    return typeof comParametros === 'function' ? comParametros(url, url) : url;
  }

  // O texto vem da IA: escapa tudo primeiro e só então devolve negrito, riscado e links.
  function formatarTexto(texto) {
    return escapar(texto.trim())
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/https?:\/\/[^\s<)]+[^\s<).,!?;:]/g, (url) => {
        const limpo = url.replace(/&#38;/g, '&');
        const rotulo = limpo.includes('#rodando') ? 'Ver lives reais' : limpo.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        return `<a class="chat-link" href="${escapar(limpo)}" target="_blank" rel="noopener">${escapar(rotulo)}</a>`;
      })
      .replace(/\n+/g, '<br>');
  }

  // Separa o texto dos marcadores [[...]]; um marcador ainda chegando no stream fica escondido.
  function interpretar(bruto) {
    const partes = [];
    const sugestoes = [];
    const semPedaco = bruto.replace(/\[\[[^\]]*$/, '');
    const resto = semPedaco
      .replace(/\[\[\s*sugest[oõ]es\s*:([^\]]*)\]\]/gi, (_, lista) => {
        sugestoes.push(...lista.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 3));
        return '';
      })
      .replace(/\[\[\s*(?!plano|video|humano|erro)[^\]]*\]\]/gi, '');
    const regex = /\[\[\s*(plano|video|humano|erro)\s*:?\s*([\w-]*)\s*\]\]/gi;
    let ultimo = 0;
    for (const m of resto.matchAll(regex)) {
      partes.push({ tipo: 'texto', valor: resto.slice(ultimo, m.index) });
      partes.push({ tipo: m[1].toLowerCase(), valor: m[2].toLowerCase() });
      ultimo = m.index + m[0].length;
    }
    partes.push({ tipo: 'texto', valor: resto.slice(ultimo) });
    return { partes: partes.filter((p) => p.tipo !== 'texto' || p.valor.trim()), sugestoes };
  }

  function cartaoPlano(id) {
    const p = PLANOS[id];
    if (!p) return null;
    const base = window.CONFIG?.checkout?.[p.checkout];
    if (!base) return null;
    const el = document.createElement('a');
    el.className = 'chat-plano' + (p.destaque ? ' chat-plano-destaque' : '');
    el.href = comUtms(base);
    el.target = '_blank';
    el.rel = 'noopener';
    el.innerHTML = `
      ${p.destaque ? '<em>Mais completo</em>' : ''}
      <span class="chat-plano-linha">
        <span class="chat-plano-nome">${p.nome}</span>
        <span class="chat-plano-preco">${p.de ? `<s>${p.de}</s>` : ''}<b>${p.preco}</b></span>
      </span>
      <span class="chat-plano-detalhe">${p.detalhe}</span>
      <span class="chat-plano-cta">Garantir meu acesso</span>
      <span class="chat-plano-garantia">7 dias de garantia · acesso na hora</span>`;
    el.addEventListener('click', () => evento('chat_checkout'));
    return el;
  }

  function cartaoVideo(id) {
    let src, titulo;
    if (id === 'tutorial-celular') { src = CDN + 'tutorial-celular.mp4'; titulo = 'Tutorial: live pelo celular · 1:29'; }
    else if (id === 'tutorial-pc') { src = CDN + 'tutorial-pc.mp4'; titulo = 'Tutorial: live pelo PC · 4:55'; }
    else if (NOMES_JOGOS[id]) { src = VIDEOS_JOGOS + id + '.mp4'; titulo = NOMES_JOGOS[id]; }
    else return null;
    const el = document.createElement('figure');
    el.className = 'chat-video' + (id.startsWith('tutorial') ? '' : ' chat-video-jogo');
    el.innerHTML = `<video src="${src}#t=0.5" preload="metadata" playsinline controls></video><figcaption>${titulo}</figcaption>`;
    el.querySelector('video').addEventListener('loadedmetadata', () => enquadrar(el.closest('.chat-resposta')), { once: true });
    el.querySelector('video').addEventListener('play', () => evento('chat_video'), { once: true });
    return el;
  }

  function cartaoHumano() {
    const el = document.createElement('div');
    el.className = 'chat-humano';
    el.innerHTML = `
      <a href="${ZAP_EQUIPE}" target="_blank" rel="noopener">Falar com a equipe no WhatsApp</a>
      <a href="mailto:${EMAIL_EQUIPE}">${EMAIL_EQUIPE}</a>`;
    el.querySelector('a').addEventListener('click', () => evento('chat_humano'));
    return el;
  }

  function desenhar(caixa, bruto, final) {
    const { partes, sugestoes } = interpretar(bruto);
    const pedacos = [];
    for (const p of partes) {
      if (p.tipo === 'texto') {
        const bolha = document.createElement('p');
        bolha.className = 'chat-msg chat-ia';
        bolha.innerHTML = formatarTexto(p.valor);
        pedacos.push(bolha);
      } else if (p.tipo === 'erro') {
        const bolha = document.createElement('p');
        bolha.className = 'chat-msg chat-ia';
        bolha.textContent = 'Opa, travei aqui. Manda de novo?';
        pedacos.push(bolha, cartaoHumano());
      } else if (final) {
        const cartao = p.tipo === 'plano' ? cartaoPlano(p.valor) : p.tipo === 'video' ? cartaoVideo(p.valor) : cartaoHumano();
        if (cartao) pedacos.push(cartao);
      }
    }
    caixa.replaceChildren(...pedacos);
    if (final && sugestoes.length) mostrarSugestoes(sugestoes);
  }

  // ───────── conversa ─────────

  function rolarProFim() {
    lista.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
  }

  // Resposta com cartão costuma passar da tela: rola até o fim, mas nunca além do começo
  // da resposta (com a pergunta logo acima), senão a pessoa só vê o cartão e perde o texto.
  function enquadrar(resposta) {
    if (!resposta || resposta !== [...lista.querySelectorAll('.chat-resposta')].at(-1)) return;
    const pergunta = resposta.previousElementSibling;
    const inicio = (pergunta || resposta).offsetTop - 12;
    lista.scrollTo({ top: Math.min(lista.scrollHeight, inicio), behavior: 'smooth' });
  }

  function mostrarSugestoes(textos, iniciais = false) {
    lista.querySelector('.chat-sugestoes')?.remove();
    const caixa = document.createElement('div');
    caixa.className = 'chat-sugestoes' + (iniciais ? ' chat-sugestoes-iniciais' : '');
    for (const t of textos) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = t;
      chip.addEventListener('click', () => enviar(t, 'sugestao'));
      caixa.append(chip);
    }
    lista.append(caixa);
  }

  async function enviar(texto, origem = 'digitada') {
    texto = texto.trim();
    if (!texto || esperando) return;
    esperando = true;
    enviarBotao.disabled = true;
    lista.querySelector('.chat-sugestoes')?.remove();
    conversa.push({ de: 'cliente', texto });

    const minha = document.createElement('p');
    minha.className = 'chat-msg chat-cliente';
    minha.textContent = texto;
    lista.append(minha);
    campo.value = '';

    const resposta = document.createElement('div');
    resposta.className = 'chat-resposta';
    resposta.innerHTML = '<p class="chat-msg chat-ia chat-digitando" aria-label="Digitando"><i></i><i></i><i></i></p>';
    lista.append(resposta);
    rolarProFim();

    let bruto = '';
    try {
      const r = await fetch('/chat/mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa: conversaId, origem, mensagens: conversa }),
      });
      if (!r.ok || !r.body) throw new Error(r.status);
      const leitor = r.body.getReader();
      const decodificador = new TextDecoder();
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        bruto += decodificador.decode(value, { stream: true });
        if (interpretar(bruto).partes.length) desenhar(resposta, bruto, false);
        lista.scrollTop = lista.scrollHeight;
      }
      if (!bruto.trim()) throw new Error('vazio');
    } catch (e) {
      bruto = '[[erro]]';
    }
    if (bruto !== '[[erro]]') conversa.push({ de: 'ia', texto: bruto });
    desenhar(resposta, bruto, true);
    requestAnimationFrame(() => enquadrar(resposta));
    evento('chat_mensagem');
    esperando = false;
    enviarBotao.disabled = !campo.value.trim();
    if (!celular.matches) campo.focus();
  }

  // ───────── abrir e fechar ─────────

  // No iPhone o teclado não encolhe o 100dvh: a altura vem do visualViewport.
  function ajustarAltura() {
    const vv = window.visualViewport;
    painel.style.setProperty('--chat-altura', vv ? `${vv.height}px` : '100dvh');
    if (vv) painel.style.setProperty('--chat-topo', `${vv.offsetTop}px`);
  }

  function abrir() {
    if (!painel.hidden) return;
    painel.hidden = false;
    convite.hidden = true;
    botao.classList.add('aberto');
    document.documentElement.classList.add('chat-aberto');
    ajustarAltura();
    // O "voltar" do Android fecha o chat em vez de sair do site.
    if (celular.matches) history.pushState({ chat: true }, '');
    if (!conversa.length && !lista.querySelector('.chat-sugestoes')) mostrarSugestoes(SUGESTOES_INICIAIS, true);
    evento('chat_abrir');
    if (!celular.matches) campo.focus();
  }

  function fechar(peloVoltar = false) {
    if (painel.hidden) return;
    painel.hidden = true;
    botao.classList.remove('aberto');
    document.documentElement.classList.remove('chat-aberto');
    if (!peloVoltar && history.state?.chat) history.back();
  }

  botao.addEventListener('click', () => (painel.hidden ? abrir() : fechar()));
  convite.addEventListener('click', abrir);
  for (const b of painel.querySelectorAll('.chat-fechar, .chat-voltar')) b.addEventListener('click', () => fechar());
  window.addEventListener('popstate', () => fechar(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  window.visualViewport?.addEventListener('resize', ajustarAltura);
  window.visualViewport?.addEventListener('scroll', ajustarAltura);

  campo.addEventListener('input', () => { enviarBotao.disabled = esperando || !campo.value.trim(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); enviar(campo.value); });

  // Convite aparece uma vez por visita, depois que a pessoa já leu um pouco da página.
  let jaConvidou = false;
  try { jaConvidou = sessionStorage.getItem('chat-convite') === '1'; } catch (e) { /* aba privada */ }
  if (!jaConvidou) {
    setTimeout(() => {
      if (!painel.hidden) return;
      convite.hidden = false;
      try { sessionStorage.setItem('chat-convite', '1'); } catch (e) { /* aba privada */ }
      setTimeout(() => { convite.hidden = true; }, 12000);
    }, 9000);
  }

  // Mesma regra do botão do zap: sobe quando a barra de compra aparece.
  const barra = document.getElementById('barra-cta');
  if (barra) {
    const acompanhar = () => document.documentElement.classList.toggle('chat-barra', barra.classList.contains('visivel'));
    new MutationObserver(acompanhar).observe(barra, { attributes: true, attributeFilter: ['class'] });
    acompanhar();
  }
})();
