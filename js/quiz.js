(function () {
  const ETAPA_DEMO = 6;
  const ETAPA_DINHEIRO = 7;
  const ETAPA_MONTANDO = 8;
  const ETAPA_RESULTADO = 9;
  const ETAPA_OFERTA = 10;
  const PERGUNTAS = ETAPA_DINHEIRO;
  const ESPERA_JOGO_MS = 4000;
  const LIBERA_RESULTADO_MS = 15000;
  const TOQUES_PRA_LIBERAR = 3;

  // No ar o jogo vem do app publicado; servindo o repo local, da pasta dos jogos.
  const PIPA = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '/jogos_web/pipa/index.html'
    : '/app/jogos/pipa/index.html';
  const PIPA_URL = `${PIPA}?demo=1&formato=vertical&som=0&vitrine=1`;

  const NICKS = ['ana.lu', 'biel_gamer', 'carol.s', 'davizin', 'duda_oficial', 'gui.bs', 'ju_mendes', 'lele', 'mari.r', 'pedrinho', 'thay', 'vini07'];
  const RETORNO_APARECER = {
    nao: 'Perfeito: o jogo ocupa a tela inteira, o público olha pra ele, não pra você.',
    tantofaz: 'Perfeito: o jogo ocupa a tela inteira, o público olha pra ele, não pra você.',
    sim: 'Ótimo: você aparece num cantinho e o jogo segura o público por você.',
  };

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  // A fila rola metade do próprio comprimento: com a cópia ao lado, o fim encosta no começo sem salto.
  for (const fila of $$('.fila')) fila.append(...[...fila.children].map((li) => li.cloneNode(true)));

  const etapas = $$('.etapa');
  const respostas = {};
  let atual = 0;
  const registradas = new Set();
  const GUARDADO = 'rendaplay.quiz';

  // Voltar da Kiwify ou dos termos recarrega a página no navegador do Instagram: o resultado não pode sumir.
  function guardar() {
    try { sessionStorage.setItem(GUARDADO, JSON.stringify({ respostas, resultado: atual >= ETAPA_RESULTADO })); } catch (e) { /* aba anônima */ }
  }

  function guardado() {
    try { return JSON.parse(sessionStorage.getItem(GUARDADO)) || null; } catch (e) { return null; }
  }

  function registrar(etapa) {
    if (registradas.has(etapa)) return;
    registradas.add(etapa);
    if (typeof gtag === 'function') gtag('event', 'quiz_etapa', { etapa });
    if (window.clarity) clarity('event', `quiz_etapa_${etapa}`);
  }

  function mostrar(n, { empilhar = true, trocar = false } = {}) {
    atual = n;
    for (const etapa of etapas) etapa.classList.toggle('ativa', Number(etapa.dataset.etapa) === n);
    const barra = $('.progresso');
    barra.classList.toggle('visivel', n >= 1 && n <= PERGUNTAS);
    $('span', barra).style.width = `${Math.min(n, PERGUNTAS) / PERGUNTAS * 100}%`;
    $('.voltar').classList.toggle('visivel', n >= 1 && n <= PERGUNTAS);
    window.scrollTo(0, 0);
    if (trocar) history.replaceState({ n }, '');
    else if (empilhar) history.pushState({ n }, '');
    registrar(n);
    if (n === 1) prepararJogo();
    if (n === ETAPA_DEMO) abrirDemo();
    if (n === ETAPA_MONTANDO) setTimeout(() => { if (atual === ETAPA_MONTANDO) montarResultado(); }, 2000);
  }

  function avancar() {
    mostrar(atual + 1);
  }

  window.addEventListener('popstate', (e) => {
    const n = e.state && Number.isInteger(e.state.n) ? e.state.n : 0;
    // Voltar do resultado leva pra tela do dinheiro: a de "montando" avançaria de novo sozinha.
    mostrar(n === ETAPA_MONTANDO ? ETAPA_DINHEIRO : n, { empilhar: false });
  });
  $('.voltar').addEventListener('click', () => history.back());
  for (const botao of $$('[data-avancar]')) botao.addEventListener('click', avancar);

  // ───────── perguntas ─────────

  for (const grupo of $$('.opcoes')) {
    grupo.addEventListener('click', (e) => {
      const opcao = e.target.closest('.opcao, .opcao-capa');
      if (!opcao) return;
      const campo = grupo.dataset.campo;
      respostas[campo] = campo === 'tempo' ? Number(opcao.dataset.valor) : opcao.dataset.valor;
      for (const outra of $$('.opcao, .opcao-capa', grupo)) outra.classList.toggle('escolhida', outra === opcao);
      const etapa = grupo.closest('.etapa');
      const daqui = atual;
      const seguir = (ms) => setTimeout(() => { if (atual === daqui) avancar(); }, ms);
      guardar();

      if (campo === 'aparecer') {
        const retorno = $('.retorno', etapa);
        retorno.textContent = RETORNO_APARECER[respostas.aparecer];
        retorno.hidden = false;
        seguir(800);
        return;
      }
      seguir(180);
    });
  }

  // ───────── demo da Pipa ─────────

  const palco = $('.palco');
  const contador = $('.contador');
  const verResultado = $('.ver-resultado');
  let jogo = null;
  let jogoPronto = false;
  let presentes = 0;
  let toques = 0;

  function prepararJogo() {
    if (jogo) return;
    jogo = document.createElement('iframe');
    jogo.src = PIPA_URL;
    jogo.title = 'Pipa Combate rodando com uma plateia de demonstração';
    jogo.setAttribute('allow', 'autoplay');
    palco.prepend(jogo);
  }

  window.addEventListener('message', (e) => {
    if (jogo && e.source === jogo.contentWindow && e.data && e.data.rendaplay === 'pronto') jogoPronto = true;
  });

  function liberarResultado() {
    verResultado.disabled = false;
  }

  function trocarPorVideo() {
    if (jogo) jogo.remove();
    jogo = null;
    const video = $('.reserva', palco);
    video.hidden = false;
    video.play().catch(() => {});
    liberarResultado();
  }

  let demoAberta = false;
  function abrirDemo() {
    prepararJogo();
    if (demoAberta) return;
    demoAberta = true;
    setTimeout(() => { if (!jogoPronto) trocarPorVideo(); }, ESPERA_JOGO_MS);
    setTimeout(liberarResultado, LIBERA_RESULTADO_MS);
  }

  function evento(tipo) {
    const nome = NICKS[Math.floor(Math.random() * NICKS.length)];
    const usuario = { id: `quiz.${nome}`, nome };
    if (tipo === 'comentario') return { tipo: 'comentario', usuario, texto: 'que jogo top' };
    if (tipo === 'rosa') return { tipo: 'presente', usuario, presente: { nome: 'Rose', moedas: 1, quantidade: 1 } };
    return { tipo: 'presente', usuario, presente: { nome: 'Lion', moedas: 29999, quantidade: 1 } };
  }

  for (const botao of $$('[data-enviar]')) {
    botao.addEventListener('click', () => {
      const tipo = botao.dataset.enviar;
      if (jogo && jogo.contentWindow) jogo.contentWindow.postMessage({ rendaplay: 'simular', evento: evento(tipo) }, '*');
      if (tipo !== 'comentario') {
        presentes += 1;
        $('b', contador).textContent = presentes;
        contador.classList.remove('pulo');
        void contador.offsetWidth;
        contador.classList.add('pulo');
      }
      toques += 1;
      if (toques >= TOQUES_PRA_LIBERAR) liberarResultado();
    });
  }

  // ───────── resultado ─────────

  function capa(id) {
    const img = document.createElement('img');
    Object.assign(img, { src: `img/jogos/${id}-480.webp`, width: 480, height: 640, alt: '', decoding: 'async' });
    return img;
  }

  // Os dias são sugestão: a pessoa troca à vontade, e as horas do mês acompanham.
  function pintarAgenda() {
    const tempo = respostas.tempo || 1;
    const n = respostas.dias.length;
    const horas = QuizRegras.horasNoMes(tempo, n);
    $('.n-lives').textContent = n === 1 ? '1 live' : `${n} lives`;
    $('.n-duracao').textContent = QuizRegras.plano({ tempo }).duracao;
    $('.n-horas').textContent = `${horas} h`;
    $('.aviso-horas').hidden = horas >= QuizRegras.HORAS_GARANTIA;
    for (const botao of $$('.dias button')) botao.setAttribute('aria-pressed', String(respostas.dias.includes(Number(botao.dataset.dia))));
  }

  $('.dias').addEventListener('click', (e) => {
    const botao = e.target.closest('button');
    if (!botao) return;
    const dia = Number(botao.dataset.dia);
    respostas.dias = respostas.dias.includes(dia) ? respostas.dias.filter((d) => d !== dia) : [...respostas.dias, dia];
    pintarAgenda();
    guardar();
  });

  function montarResultado() {
    const r = { live: 'fez', jogo: 'pipa', aparecer: 'tantofaz', tempo: 1, meta: 'recuperar', ...respostas };
    const resultado = $('.resultado');
    const semanas = QuizRegras.semanas(r);
    const primeiro = semanas[0].jogo;
    $('.seu-jogo-capa', resultado).src = `img/jogos/${primeiro}-480.webp`;
    $('.seu-jogo-nome', resultado).textContent = QuizRegras.JOGOS[primeiro].nome;

    if (!Array.isArray(respostas.dias)) respostas.dias = QuizRegras.diasDeLive(QuizRegras.plano(r).livesPorSemana);
    pintarAgenda();

    $('.semanas', resultado).replaceChildren(...semanas.map((s, i) => {
      const li = document.createElement('li');
      const textos = [['quando', `Semana ${i + 1}`], ['nome', QuizRegras.JOGOS[s.jogo].nome], ['frase', s.frase]];
      li.append(capa(s.jogo), ...textos.map(([classe, texto]) => {
        const p = document.createElement('p');
        p.className = classe;
        p.textContent = texto;
        return p;
      }));
      return li;
    }));
    $('.meta', resultado).textContent = QuizRegras.meta(r);
    mostrar(ETAPA_RESULTADO, { trocar: true });
    guardar();
  }

  const tenhoPc = $('.tenho-pc');
  tenhoPc.addEventListener('click', () => {
    const abrir = tenhoPc.getAttribute('aria-expanded') !== 'true';
    tenhoPc.setAttribute('aria-expanded', String(abrir));
    $('.plano-pro').hidden = !abrir;
  });

  // No celular o trilho de provas já arrasta com o dedo; no PC, com o mouse. Um arrasto não vale como clique no vídeo.
  const trilho = $('.provas');
  let arrasto = null;
  trilho.addEventListener('dragstart', (e) => e.preventDefault());
  trilho.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) arrasto = { x: e.clientX, scroll: trilho.scrollLeft, moveu: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x;
    if (Math.abs(dx) > 6) arrasto.moveu = true;
    if (arrasto.moveu) trilho.scrollLeft = arrasto.scroll - dx;
  });
  window.addEventListener('pointerup', () => { setTimeout(() => { arrasto = null; }); });
  trilho.addEventListener('click', (e) => {
    if (arrasto && arrasto.moveu) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  let ofertaVista = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ofertaVista) { ofertaVista = true; registrar(ETAPA_OFERTA); }
    }, { threshold: 0.3 }).observe($('.plano-recomendado'));
  }

  const anterior = guardado();
  if (anterior && anterior.resultado) {
    Object.assign(respostas, anterior.respostas);
    montarResultado();
  } else {
    history.replaceState({ n: 0 }, '');
    registrar(0);
  }
})();
