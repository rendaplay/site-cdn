/* Ligação dos jogos web com a live: WebSocket do conector (tiktok/conector.py)
   ou uma plateia de demonstração, entregando sempre o mesmo evento:

     { tipo: 'presente'|'comentario'|'curtida'|'seguiu'|'compartilhou',
       usuario: { id, nome, foto },
       presente?: { nome, moedas, quantidade, total },
       texto?, curtidas?, simulado }

   O jogo não sabe (nem precisa saber) de onde o evento veio. A URL ganha da
   chamada: ?ws=8766 (ou ?ws=ws://host:porta) troca o conector, ?demo=1 liga
   a plateia falsa e ?canal=<código> lê o conector da nuvem (live feita só
   pelo celular), com ?relay=https://... pra trocar o servidor.

   Ouve o WebSocket, e não o relay, porque o feeder só repassa ao relay quem
   comentou o nick do Roblox. O conector aceita vários clientes: o jogo escuta
   junto do feeder sem roubar evento de ninguém. */
"use strict";

(function (raiz) {
  const WS_PADRAO = "ws://127.0.0.1:8765";
  const RELAY_PADRAO = "https://relay.rendaplay.com.br";
  const INTERVALO_NUVEM = 700;
  const TIPOS = { gift: "presente", chat: "comentario", like: "curtida", follow: "seguiu", share: "compartilhou" };
  const MOCK_ID = /^mock\d+$/;

  function inteiro(v, minimo = 0) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(minimo, n) : minimo;
  }

  function usuarioDe(u) {
    u = u || {};
    const id = String(u.id ?? u.nickname ?? u.nome ?? "").trim();
    const nome = String(u.nickname ?? u.nome ?? "").trim() || id || "anônimo";
    const foto = u.avatar ?? u.foto ?? null;
    return { id: id || nome, nome, foto: typeof foto === "string" && /^https?:\/\//.test(foto) ? foto : null };
  }

  /* Aceita o pacote cru do conector ({type, user, data}) ou um evento já no
     formato do jogo (útil pra injetar teste). Devolve null pro que não é
     evento de jogo (bridge_status, viewers, lixo). */
  function normalizarEvento(p) {
    if (!p || typeof p !== "object") return null;

    if (p.tipo) {
      if (!Object.values(TIPOS).includes(p.tipo)) return null;
      const ev = { tipo: p.tipo, usuario: usuarioDe(p.usuario), simulado: !!p.simulado };
      if (p.tipo === "presente") {
        const pr = p.presente || {};
        const quantidade = inteiro(pr.quantidade ?? 1, 1);
        const moedas = inteiro(pr.moedas);
        ev.presente = { nome: String(pr.nome || ""), moedas, quantidade, total: inteiro(pr.total ?? moedas * quantidade) };
      }
      if (p.tipo === "comentario") ev.texto = String(p.texto ?? "");
      if (p.tipo === "curtida") ev.curtidas = inteiro(p.curtidas ?? 1, 1);
      return ev;
    }

    const tipo = TIPOS[p.type];
    if (!tipo) return null;
    const d = p.data || {};
    const ev = { tipo, usuario: usuarioDe(p.user), simulado: MOCK_ID.test(String((p.user || {}).id || "")) };
    if (tipo === "presente") {
      const quantidade = inteiro(d.count ?? 1, 1);
      const moedas = inteiro(d.coins);
      /* total_coins já vem multiplicado pelo combo; coins é o valor de um. */
      ev.presente = { nome: String(d.name || ""), moedas, quantidade, total: inteiro(d.total_coins) || moedas * quantidade };
    }
    if (tipo === "comentario") ev.texto = String(d.text ?? "");
    if (tipo === "curtida") ev.curtidas = inteiro(d.count ?? 1, 1);
    return ev;
  }

  function lerUrl() {
    let q;
    try { q = new URLSearchParams(raiz.location ? raiz.location.search : ""); } catch (e) { return {}; }
    const saida = {};
    const ws = (q.get("ws") || "").trim();
    if (/^\d{2,5}$/.test(ws)) saida.ws = `ws://127.0.0.1:${ws}`;
    else if (/^wss?:\/\//.test(ws)) saida.ws = ws;
    if (q.has("demo")) saida.demo = q.get("demo") !== "0";
    const canal = (q.get("canal") || "").trim();
    if (/^[a-z0-9]{6,32}$/.test(canal)) saida.canal = canal;
    const relay = (q.get("relay") || "").trim();
    if (/^https?:\/\/[^\s]+$/.test(relay)) saida.relay = relay.replace(/\/+$/, "");
    return saida;
  }

  /* ───────────────────────── plateia de demonstração ───────────────────────── */

  const NICKS = [
    "mari.alves", "joaozin_77", "tia_cida", "dudu.rj", "bia_santos", "careca_do_gas", "nanda.bh",
    "pedrinho.vlog", "luh_mendes", "seu_arnaldo", "kaka.oficial", "gabi_ssa", "rafa_motoboy",
    "dona_neide", "thi_barbeiro", "lari.costa", "zeca_fortal", "jessy.lima", "vini_fut", "carol_poa",
    "neto_caminhoneiro", "manu.recife", "brunao_gym", "aline.mkt", "tonhao_bar", "duda.mg",
    "leo_uber", "pri.manaus", "matheus.tech", "cris_cabelereira", "fefe_curitiba", "juninho.gamer",
    "vovo_lurdes", "gui_skate", "talita.nails", "diego_pedreiro", "isa.floripa", "renan_bombeiro",
    "paty.sp", "marcos_taxi", "lu_professora", "biel.mc", "keka_goiania", "robson.eletricista",
    "jana.natal", "fabinho_dj", "sil_confeiteira", "wesley.mototaxi", "rose_do_acai", "caio.santos",
  ];

  /* Valores reais da loja do TikTok. Peso = quão comum é na live: rosa
     aparece o tempo todo, leão quase nunca. */
  const PRESENTES_PADRAO = [
    { nome: "Rose", moedas: 1, peso: 34 },
    { nome: "TikTok", moedas: 1, peso: 12 },
    { nome: "GG", moedas: 1, peso: 10 },
    { nome: "Ice Cream Cone", moedas: 1, peso: 8 },
    { nome: "Finger Heart", moedas: 5, peso: 10 },
    { nome: "Perfume", moedas: 20, peso: 6 },
    { nome: "Doughnut", moedas: 30, peso: 5 },
    { nome: "Hat and Mustache", moedas: 99, peso: 3 },
    { nome: "Hand Hearts", moedas: 100, peso: 3 },
    { nome: "Confetti", moedas: 100, peso: 2 },
    { nome: "Money Gun", moedas: 500, peso: 0.7 },
    { nome: "Galaxy", moedas: 1000, peso: 0.4 },
    { nome: "Interstellar", moedas: 10000, peso: 0.04 },
    { nome: "Lion", moedas: 29999, peso: 0.02 },
  ];

  const CHAT_PADRAO = [
    "boa noite live", "kkkkkk", "kkkkkkkkk", "boraaa", "eita", "salve salve", "cheguei",
    "que isso kkk", "manda mais", "tá pegando fogo", "aí sim", "vai vai vai", "nãooo", "olha isso",
    "de onde vcs são?", "sp aqui", "bahia na área", "primeira vez aqui", "segue de volta", "🔥🔥🔥",
  ];

  /* Gerador com semente (mulberry32): a mesma semente repete a mesma
     plateia, pra gravar vídeo e print sempre iguais. */
  function sorteador(semente) {
    if (semente == null) return Math.random;
    let a = inteiro(semente) >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Plateia falsa que se comporta como live de verdade: poucos regulares
     falam muito, rosa vem em combo, presente grande é raro e quase sempre
     de quem já mandou antes, e o chat tem ondas: esquenta, esfria (às vezes
     só curtida e conversa por quase um minuto) e volta.

     `lados`: cada pessoa torce por um lado fixo, comenta os comandos dele e
     só manda o presente-símbolo dele (presente com `lado`). */
  const RELOGIO = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id) };

  function criarPlateia(cfg, emitir, relogio = RELOGIO) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    const rnd = sorteador(cfg.semente);
    const ritmo = Math.max(0.1, Number(cfg.ritmo) || 1.2);
    const presentes = (cfg.presentes || PRESENTES_PADRAO).map(p => ({ peso: 1, ...p }));
    const chat = cfg.comentarios || CHAT_PADRAO;
    const lados = cfg.lados || [];
    const esfriar = cfg.esfriar !== false;

    const pessoas = (cfg.nicks || NICKS).map((nome, i) => ({
      id: "demo" + i,
      nome,
      peso: [1, 1, 1, 1, 2, 2, 4][Math.floor(rnd() * 7)],
      generoso: rnd() < 0.12,
      lado: lados.length ? Math.floor(rnd() * lados.length) : -1,
      apresentou: false,
      doou: false,
    }));

    const escolher = (lista, peso) => {
      let r = rnd() * lista.reduce((s, x) => s + peso(x), 0);
      for (const x of lista) if ((r -= peso(x)) <= 0) return x;
      return lista[lista.length - 1];
    };
    const qualquer = lista => lista[Math.floor(rnd() * lista.length)];

    let timer = null;
    let fase = { nome: "normal", ate: 0 };
    let agoraDemo = 0;

    const enviar = (tipo, p, extra) => emitir({ tipo, usuario: { id: p.id, nome: p.nome, foto: null }, simulado: true, ...extra });

    const presenteDe = p => {
      const possiveis = presentes.filter(g => g.lado == null || g.lado === p.lado);
      const baleia = p.generoso && p.doou;
      const g = escolher(possiveis, x => x.peso * (baleia && x.moedas >= 99 ? 6 : 1));
      const combo = g.moedas <= 5 ? qualquer([1, 1, 1, 1, 5, 5, 10, 10, 30, 99]) : rnd() < 0.15 ? 2 : 1;
      p.doou = true;
      return { nome: g.nome, moedas: g.moedas, quantidade: combo, total: g.moedas * combo };
    };

    const comentarioDe = p => {
      const comandos = p.lado >= 0 ? lados[p.lado].comentarios || [] : [];
      if (comandos.length && rnd() < (p.apresentou ? 0.35 : 0.7)) return qualquer(comandos);
      return qualquer(chat);
    };

    const passo = () => {
      agoraDemo += 1;
      if (agoraDemo > fase.ate) {
        const r = rnd();
        fase = esfriar && r < 0.18 ? { nome: "fria", ate: agoraDemo + 25 + Math.floor(rnd() * 25) }
          : r < 0.45 ? { nome: "quente", ate: agoraDemo + 15 + Math.floor(rnd() * 20) }
          : { nome: "normal", ate: agoraDemo + 20 + Math.floor(rnd() * 30) };
      }
      const p = escolher(pessoas, x => x.peso * (x.generoso ? 2 : 1));
      const chancePresente = fase.nome === "fria" ? 0 : fase.nome === "quente" ? 0.42 : 0.24;
      const dado = rnd();

      if (!p.apresentou) {
        enviar("comentario", p, { texto: comentarioDe(p) });
        p.apresentou = true;
      } else if (dado < chancePresente) {
        enviar("presente", p, { presente: presenteDe(p) });
      } else if (dado < chancePresente + 0.3) {
        enviar("comentario", p, { texto: comentarioDe(p) });
      } else if (dado < chancePresente + 0.62) {
        enviar("curtida", p, { curtidas: 1 + Math.floor(rnd() * 15) });
      } else if (dado < chancePresente + 0.66) {
        enviar("seguiu", p, {});
      } else if (dado < chancePresente + 0.69) {
        enviar("compartilhou", p, {});
      }

      const media = 1000 / (ritmo * (fase.nome === "quente" ? 1.6 : fase.nome === "fria" ? 0.6 : 1));
      timer = relogio.setTimeout(passo, media * (0.3 + rnd() * 1.4));
    };

    return {
      iniciar() { if (!timer) timer = relogio.setTimeout(passo, 400); },
      parar() { relogio.clearTimeout(timer); timer = null; },
      get fase() { return fase.nome; },
    };
  }

  /* ───────────────────────── conexão ───────────────────────── */

  function conectarLive(opcoes = {}) {
    const url = lerUrl();
    const canal = url.canal || opcoes.canal || null;
    const relay = url.relay || opcoes.relay || RELAY_PADRAO;
    const buscar = opcoes.fetch || (typeof fetch === "function" ? fetch.bind(raiz) : null);
    const endereco = canal ? `${relay}/pull_bruto` : url.ws || opcoes.ws || WS_PADRAO;
    /* `demo` pode ser true, false ou a configuração da plateia. Com
       `ligado: false` é só configuração: liga por ?demo=1 ou ligarDemo(). */
    const demoObj = opcoes.demo && typeof opcoes.demo === "object" ? opcoes.demo : null;
    const demoLigado = "demo" in url ? url.demo : demoObj ? demoObj.ligado !== false : !!opcoes.demo;

    const aoEvento = opcoes.aoEvento || (() => {});
    /* O pacote cru do conector, antes de normalizar: pra jogo que já fala
       {type, user, data} (a Batalha). */
    const aoPacote = opcoes.aoPacote || null;
    const aoEstado = opcoes.aoEstado || (() => {});

    let socket = null;
    let timer = null;
    /* Último evento da nuvem já entregue; null até a primeira leitura, que só
       marca a posição: abrir o jogo no meio da live não repete o que passou. */
    let cursor = null;
    let plateia = null;
    let vivo = true;
    let espera = 1000;
    let modoConector = "live";

    const live = {
      endereco,
      estado: "conectando",
      /* "live" (TikTok de verdade), "mock" (conector --mock) ou "demo". */
      modo: "live",
      /* Na nuvem, o estado do conector de lá: conectando, conectado,
         live_offline, usuario_nao_encontrado, restrito, erro ou parado. */
      conector: null,
      parar,
      ligarDemo,
      simular(evento) { entregar(normalizarEvento(evento)); },
    };

    function mudarEstado(estado) {
      if (live.estado === estado) return;
      live.estado = estado;
      aoEstado(estado, live);
    }

    function entregar(ev) {
      if (!ev) return;
      if (modoConector === "mock") ev.simulado = true;
      try { aoEvento(ev, live); } catch (e) { console.error("[live] erro no jogo ao tratar evento", e); }
    }

    function receber(pacote) {
      if (aoPacote && pacote && typeof pacote === "object") {
        try { aoPacote(pacote, live); } catch (e) { console.error("[live] erro no jogo ao tratar pacote", e); }
      }
      if (pacote && pacote.type === "bridge_status") {
        const d = pacote.data || {};
        if (d.mode === "mock" || d.mode === "live") modoConector = d.mode;
        live.modo = modoConector;
        return;
      }
      /* O conector só avisa "mock" uma vez, ao subir; se o jogo abriu
         depois, reconhece a simulação pelo id dos espectadores falsos. */
      if (modoConector !== "mock" && pacote && pacote.user && MOCK_ID.test(String(pacote.user.id))) {
        modoConector = live.modo = "mock";
      }
      entregar(normalizarEvento(pacote));
    }

    function puxar() {
      timer = null;
      if (!vivo || plateia) return;
      const desde = cursor === null ? 0 : cursor;
      buscar(`${endereco}?since=${desde}`, { headers: { "x-canal": canal }, cache: "no-store" })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => {
          if (!vivo || plateia) return;
          const seq = inteiro(d.seq);
          /* Relay reiniciado volta a contar do zero: recomeça dali. */
          if (cursor !== null && seq >= cursor) (d.eventos || []).forEach(receber);
          cursor = seq;
          live.conector = (d.conector && d.conector.estado) || "parado";
          espera = 1000;
          mudarEstado(live.conector === "conectado" ? "conectado" : "conectando");
          timer = setTimeout(puxar, INTERVALO_NUVEM);
        })
        .catch(() => {
          if (!vivo || plateia) return;
          mudarEstado("desconectado");
          espera = Math.min(5000, espera * 1.5);
          timer = setTimeout(puxar, espera);
        });
    }

    function abrir() {
      if (!vivo || plateia) return;
      if (canal) { puxar(); return; }
      let ws;
      try { ws = new WebSocket(endereco); } catch (e) { setTimeout(abrir, espera); return; }
      socket = ws;
      ws.onopen = () => { espera = 1000; mudarEstado("conectado"); };
      ws.onmessage = m => {
        let pacote;
        try { pacote = JSON.parse(m.data); } catch (e) { return; }
        receber(pacote);
      };
      ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        if (!vivo || plateia) return;
        mudarEstado("desconectado");
        /* O conector costuma subir depois do jogo: tenta de novo sem encher
           o log, até 5 s entre tentativas. */
        espera = Math.min(5000, espera * 1.5);
        setTimeout(abrir, espera);
      };
    }

    function ligarDemo(cfg = demoObj) {
      if (plateia) return live;
      if (socket) { const s = socket; socket = null; s.close(); }
      if (timer) { clearTimeout(timer); timer = null; }
      live.modo = "demo";
      plateia = criarPlateia(cfg, entregar);
      plateia.iniciar();
      mudarEstado("demo");
      return live;
    }

    function parar() {
      vivo = false;
      if (timer) { clearTimeout(timer); timer = null; }
      if (plateia) plateia.parar();
      if (socket) { const s = socket; socket = null; s.close(); }
    }

    if (demoLigado) ligarDemo();
    else abrir();
    return live;
  }

  const api = { conectarLive, normalizarEvento, criarPlateia, PRESENTES_PADRAO };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(raiz, api);
})(typeof window !== "undefined" ? window : globalThis);
