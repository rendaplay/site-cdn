/* Liga as peças: live (comum/live.js) → Pinball (regras.js) → mesa, HUD e
   som, mais as teclas de teste. A física anda em passo fixo dentro do
   regras.js; aqui o quadro só entrega o tempo e desenha. O que acontece em
   sequência (fogos depois do jackpot, pódio) anda no relógio do jogo, então
   a pausa segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const LARGURA_PALCO = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "lança a minha", "bora", "cheguei", "olha minha bola", "aí sim", "eita",
  "que isso", "uuuuh", "vai vai vai", "🔥🔥🔥", "segura essa", "quase caiu kkk", "joga a minha", "pinball!!",
];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma live. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOM_BUMPER = [1, 1.12, 0.9];

const Jogo = {
  pausado: false,
  agenda: [],

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;
    this.partida = new Pinball(config, aleatorio);

    Mesa.montar(document.getElementById("mesa"), config, this.partida, opcoes.leve);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "pinball",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
      regras: [
        "Comentou, lançou: a bola entra na mesa com o @ de quem comentou.",
        "Todo ponto que a bola faz vai pra quem comentou. Os flippers jogam sozinhos.",
        "Comentou de novo com a bola na mesa: ela pula (uma vez a cada 10 s).",
        "Curtidas enchem o 2X. Todo ponto enche o jackpot da live.",
        "Rodada de 3 min, pódio com o top 3 e a melhor bola.",
      ],
      efeitos: () => [
        "bola extra com brilho, vale dobrado",
        `bola gruda nos bumpers por ${config.ima} s`,
        "4 bolas de uma vez",
        `queima a mesa por ${config.fogo} s e enche o jackpot`,
        `${config.mesa} s: todo ponto pra quem mandou, ninguém cai`,
      ],
    });
    this.aplicarFormato(true);

    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));

    Hud.sinal("demo");
    setTimeout(() => { if (this.live.estado === "conectando") Hud.sinal("conectando"); }, 3000);
    this.live = conectarLive({
      demo: { ligado: false, comentarios: CHAT_DEMO, ...config.demo },
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => { if (estado !== "conectando") Hud.sinal(estado); },
    });
    Hud.chamada("aguardando");
    Mesa.ocioso(true);

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.5, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt, ms / 1000);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra cima, e a
     mesa fica sempre encostada no pé da tela. */
  aplicarFormato(primeira = false) {
    const W = LARGURA_PALCO;
    const H = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, Math.round(W * innerHeight / innerWidth))) : 1920;
    const s = Math.min(innerWidth / W, innerHeight / H) || 1;
    if (H !== this.altura || primeira || s !== this.escala) {
      this.altura = H;
      this.escala = s;
      this.palco.style.height = `${H}px`;
      this.palco.style.setProperty("--topo", `${H - 1640}px`);
      Mesa.aplicarFormato(W, H, s);
    }
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  /* ───────── live ───────── */

  receber(ev) {
    const P = this.partida;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(P.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(P.curtida(quem, ev.curtidas));
    else if (ev.tipo === "seguiu") this.contar(P.seguiu(quem));
    else if (ev.tipo === "compartilhou") this.contar(P.compartilhou(quem));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(P.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    }
  },

  contar(lista) {
    if (!lista.length) return;
    Mesa.ver(lista);
    for (const a of lista) {
      switch (a.tipo) {
        case "lancou": this.lancou(a); break;
        case "relancou": Som.curto("lancamento", 0.5, 200); break;
        case "bumper": Som.curto("bumper", 0.75, 40, TOM_BUMPER[a.i]); break;
        case "estilingue": Som.curto("estilingue", 0.7, 60); break;
        case "alvo": Som.curto("alvo", 0.7, 50); break;
        case "banco":
          Som.tocar("alvo", { volume: 0.8, taxa: 1.25 });
          if (Math.random() < 0.3) Som.falar("banco");
          break;
        case "rampa": Som.curto("rampa", 0.75, 200); break;
        case "rollovers": Som.tocar("alvo", { volume: 0.6, taxa: 1.5 }); break;
        case "roleta":
          Som.curto("roleta", 0.8, 400);
          if (Math.random() < 0.4) Som.falar("roleta");
          break;
        case "premio": this.premio(a); break;
        case "flipper": Som.curto("flipper", 0.4, 70); break;
        case "caiu": this.caiu(a); break;
        case "tilt":
          Som.curto("tilt", 0.8, 150);
          if (Math.random() < 0.3) Som.falar("tilt");
          break;
        case "multiplicador":
          Hud.faixa(`⚡ 2X LIGADO! Valeu, @${encurtar(a.nome, 14)}`, "verde");
          Som.tocar("multibola", { volume: 0.6, taxa: 1.2 });
          Som.falar("multiplicador");
          break;
        case "jackpot": this.jackpot(a); break;
        case "presente": this.presente(a); break;
        case "efeito": this.efeito(a); break;
        case "acabou":
          if (a.efeito === "mesa") Hud.esconderTelao();
          break;
        case "reforco":
          Hud.faixa(`⭐ REFORÇO! Bola dourada de @${encurtar(a.nome, 14)}`, "ouro");
          Som.tocar("confete", { volume: 0.5 });
          Som.falar("reforco");
          break;
        case "compartilhou":
          Hud.faixa(`📣 @${encurtar(a.nome, 16)} chamou a galera!`, "verde");
          Som.tocar("confete", { volume: 0.6 });
          break;
        case "recorde":
          Hud.resultado("Novo<br>recorde!", `@${escapar(encurtar(a.nome, 14))} · ${milhar(a.pontos)}`, a.cor, 2800);
          Som.tocar("fanfarra", { volume: 0.7 });
          Som.falar("recorde");
          break;
        case "ultimos":
          Hud.faixa("⏱️ Últimos 10 segundos!", "vermelha");
          Som.falar("ultimos");
          break;
        case "rodada": this.rodada(a); break;
        case "fim": this.fim(a); break;
        case "aguardando":
          Hud.chamada("aguardando");
          Mesa.ocioso(true);
          break;
        case "ocioso":
          Hud.chamada("ocioso");
          Mesa.ocioso(true);
          Som.falar("ocioso");
          break;
        case "retomou":
          if (this.partida.fase === "jogo") Hud.esconderChamada();
          Mesa.ocioso(false);
          break;
      }
    }
  },

  /* O locutor não fala de toda bola: com a mesa cheia virava ladainha. */
  lancou(a) {
    Som.curto("lancamento", 0.7, 120);
    if (a.principal && this.partida.bolas.length <= 4 && Math.random() < 0.35) Som.falar("lancou");
  },

  caiu(a) {
    Hud.caiu(a);
    Som.curto("caiu", 0.75, 150);
    if (a.pontos >= 40000 && Math.random() < 0.5) this.depois(0.3, () => Som.falar("caiu"));
  },

  premio(a) {
    const pr = PREMIOS_ROLETA[a.premio];
    Som.tocar("alvo", { volume: 0.7, taxa: 1.4 });
    if (pr.id === "bola") Hud.faixa(`🎱 Bola extra pra @${encurtar(a.nome, 14)}!`, "", "bola");
    else if (pr.id === "jackpot") Hud.faixa(`💰 Roleta encheu o jackpot!`, "ouro");
  },

  jackpot(a) {
    Hud.resultado("Jackpot!", `@${escapar(encurtar(a.nome, 14))} +${milhar(a.bonus)}`, a.cor, 3200);
    Som.tocar("jackpot", { volume: 0.9 });
    this.depois(0.6, () => Som.tocar("fogos", { volume: 0.8 }));
    Som.falar("jackpot");
  },

  presente(a) {
    Hud.presente({
      nome: a.nome, cor: a.cor, simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade,
      efeito: a.efeito, forma: a.forma, faixa: a.faixa,
    });
    Som.subida(a.faixa);
  },

  /* O efeito começa quando sai da fila da pessoa, não quando o presente chega. */
  efeito(a) {
    const quem = `@${encurtar(a.nome, 14)}`;
    if (a.efeito === "brilho") {
      Som.tocar("confete", { volume: 0.4, taxa: 1.2 });
      if (Math.random() < 0.4) Som.falar("brilho");
    } else if (a.efeito === "ima") {
      Hud.faixa(`🧲 ÍMÃ NA BOLA DE ${quem}!`, "", "ima");
      Som.tocar("ima", { volume: 0.8 });
      Som.falar("ima");
    } else if (a.efeito === "multibola") {
      Hud.resultado("Multibola!", escapar(quem), a.cor, 2200);
      Som.tocar("multibola", { volume: 0.9 });
      Som.falar("multibola");
    } else if (a.efeito === "fogo") {
      Hud.faixa(`🔥 BOLA DE FOGO DE ${quem}!`, "vermelha", "fogo");
      Som.tocar("fogo", { volume: 0.8 });
      Som.falar("fogo");
    } else if (a.efeito === "mesa") {
      Hud.telao(a);
      Som.tocar("fanfarra", { volume: 0.7 });
      Som.tocar("fogos", { volume: 0.8 });
      Som.falar("mesa");
    }
  },

  rodada(a) {
    Hud.esconderPodio();
    Hud.esconderChamada();
    Mesa.ocioso(false);
    if (a.n > 1) Hud.faixa(`🎱 Rodada ${a.n}!`);
    Som.tocar("lancamento", { volume: 0.6, taxa: 0.8 });
    this.depois(0.3, () => Som.falar("rodada"));
  },

  fim(a) {
    Hud.esconderTelao();
    Som.tocar("fanfarra", { volume: 0.7 });
    this.depois(0.5, () => Som.tocar("fogos", { volume: 0.8 }));
    Som.falar("podio");
    Hud.podio(a, this.partida.rankingLive(5));
  },

  /* ───────── relógio ───────── */

  depois(seg, f) {
    this.agenda.push({ em: this.partida.t + seg, f });
  },

  quadro(dt, agora) {
    const P = this.partida;
    const dtJogo = this.pausado ? 0 : dt;
    this.contar(P.passo(dtJogo));
    if (this.agenda.length) {
      const prontos = this.agenda.filter(x => x.em <= P.t);
      this.agenda = this.agenda.filter(x => x.em > P.t);
      for (const x of prontos) x.f();
    }
    Hud.atualizar(P);
    Mesa.quadro(Math.min(0.05, dtJogo), agora);
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  testador() {
    const ids = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    return { id: ids[this.testeId++ % ids.length], nome: nomeDeTeste() };
  },

  presenteTeste(presente) {
    this.live.simular({ tipo: "presente", usuario: this.testador(), presente });
  },

  alguemNaMesa() {
    const P = this.partida;
    const b = P.bolas[Math.floor(Math.random() * P.bolas.length)];
    return b ? { id: b.id, nome: b.nome } : null;
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    const digito = /^Digit([1-5])$/.exec(e.code);
    if (digito) {
      const m = config.faixas[Number(digito[1]) - 1].moedas;
      this.presenteTeste({ nome: "Rose", moedas: m, quantidade: 1, total: m });
      return;
    }
    const nomeFalso = () => { const n = "fã" + Math.floor(Math.random() * 400); return { id: n, nome: n }; };
    const daqui = () => this.alguemNaMesa() || nomeFalso();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "e") this.partida.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "f") this.live.simular({ tipo: "seguiu", usuario: daqui() });
    else if (k === "h") this.live.simular({ tipo: "compartilhou", usuario: daqui() });
    else if (k === "c") this.live.simular({ tipo: "curtida", usuario: daqui(), curtidas: 15 });
    else if (k === "j") {
      const P = this.partida, lista = [];
      if (P.fase !== "jogo") return;
      P.encher(P.pessoa(daqui()), P.jackpot.meta - P.jackpot.valor, lista);
      this.contar(lista);
    } else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: CHAT_DEMO[i % CHAT_DEMO.length] });
      }
    }
  },

  zerar() {
    this.partida.zerar();
    this.agenda = [];
    Mesa.zerarEfeitos();
    Mesa.sprites();
    Hud.esconderPodio();
    Hud.esconderTelao();
    Hud.chamada("aguardando");
    Mesa.ocioso(true);
  },
};

/* A mesa e o HUD desenham com a Lilita One e a Figtree: espera as fontes
   pra não sair o letreiro do tampo com a letra de reserva. */
Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('800 27px "Figtree"')]).catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
