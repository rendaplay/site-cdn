/* Liga as peças: live (comum/live.js) → Aquario (regras.js) → desenho, HUD
   e som, mais as teclas de teste. O nado anda em passo fixo dentro do
   regras.js; aqui o quadro só entrega o tempo e desenha. O que acontece em
   sequência (baú depois da baleia) anda no relógio do jogo, então a pausa
   segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const LARGURA_PALCO = 1080;

const CHAT_DEMO = [
  "boa noite live", "cheguei", "cadê meu peixe", "que lindo", "kkkkkk", "pula", "dança peixinho", "olha o meu",
  "meu peixe tá grande", "come peixinho", "aí sim", "pula pula", "que fofo", "bora crescer", "🐟🐟🐟", "dança",
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

const Jogo = {
  pausado: false,
  agenda: [],

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;
    this.partida = new Aquario(config, aleatorio);

    Tanque.montar(document.getElementById("aquario"), config, this.partida, opcoes.leve);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "aquario",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
      regras: [
        "Comentou, ganhou um peixe com o @. Comentou de novo: cai um petisco e o peixe cresce.",
        "Escreveu \"pula\" ou \"dança\": o peixe dá um salto ou uma pirueta.",
        "Curtidas soltam flocos de comida. Sem comer por muito tempo, o peixe fica com fome.",
        `Até ${config.maxPeixes} peixes nadando; quem some há mais tempo dorme na toca.`,
        "Tudo enche o aquário da live: cada nível ganha decoração nova.",
      ],
      efeitos: () => [
        "petisco grande e bolhas com forma",
        "águas-vivas em volta e o peixe cresce",
        `${config.tartaruga} s de carona numa tartaruga gigante`,
        `tubarão passa e o peixe vira o maior por ${config.maiorTubarao} s`,
        "baleia, festa no aquário e tamanho máximo",
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

  /* Celular mais comprido que 9:16 (até 9:21): o aquário cresce pra baixo e
     a superfície fica sempre embaixo do placar. Altura múltipla de 4 pra
     cada pixel da arte virar um quadrado inteiro. */
  aplicarFormato(primeira = false) {
    const W = LARGURA_PALCO;
    const alvo = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, W * innerHeight / innerWidth)) : 1920;
    const H = Math.round(alvo / ARTE) * ARTE;
    const s = Math.min(innerWidth / W, innerHeight / H) || 1;
    if (H !== this.altura || primeira || s !== this.escala) {
      this.altura = H;
      this.escala = s;
      this.palco.style.height = `${H}px`;
      this.partida.formato(H / ARTE);
      Tanque.aplicarFormato(W, H, s);
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
    Tanque.ver(lista);
    for (const a of lista) {
      const quem = a.nome ? `@${encurtar(a.nome, 14)}` : "";
      switch (a.tipo) {
        case "chegou":
          Som.curto("pop", 0.55, 90);
          if (Math.random() < 0.25) Som.falar("chegou");
          break;
        case "voltou": Som.curto("pop", 0.45, 90, 0.85); break;
        case "petisco": Som.curto("petisco", 0.45, 120); break;
        case "flocos": Som.curto("petisco", 0.3, 250, 1.3); break;
        case "comeu": Som.curto("nhac", a.comida === "floco" ? 0.3 : 0.5, 80, Math.max(0.75, 1.25 - a.tamanho * 0.05)); break;
        case "cresceu": Som.curto("pop", 0.5, 120, Math.min(1.4, 0.95 + a.tamanho * 0.05)); break;
        case "splash": Som.curto("splash", a.sobe ? 0.45 : 0.6, 150); break;
        case "pulo": if (Math.random() < 0.5) Som.falar("pulo"); break;
        case "danca":
          Som.curto("brilho", 0.35, 300, 1.2);
          if (Math.random() < 0.5) Som.falar("danca");
          break;
        case "reforco":
          Hud.faixa(`⭐ REFORÇO! Coroa pro peixe de ${quem}`, "ouro");
          Som.tocar("brilho", { volume: 0.6 });
          Som.falar("reforco");
          break;
        case "compartilhou":
          Hud.faixa(`📣 ${quem} chamou a galera! Cardume junto`, "verde");
          Som.tocar("pop", { volume: 0.5, taxa: 1.2 });
          Som.falar("cardume");
          break;
        case "presente":
          Hud.presente({ nome: a.nome, cor: a.cor, simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade, efeito: a.efeito, faixa: a.faixa });
          Som.subida(a.faixa);
          break;
        case "efeito": this.efeito(a, quem); break;
        case "acabou":
          if (a.efeito === "baleia") Hud.esconderTelao();
          break;
        case "nivel": this.nivel(a); break;
        case "maior":
          Hud.faixa(`🐟 ${quem} tem o maior peixe da live!`, "ouro", "maior");
          if (Math.random() < 0.6) Som.falar("maior");
          break;
        case "ocioso":
          Hud.chamada("ocioso");
          Som.falar("dormindo");
          break;
        case "retomou":
          Hud.esconderChamada();
          Som.falar("comecou");
          break;
      }
    }
  },

  /* O efeito começa quando sai da fila da pessoa, não quando o presente chega. */
  efeito(a, quem) {
    if (a.efeito === "bolhas") {
      Som.curto("bolha", 0.6, 60);
      this.depois(0.25, () => Som.curto("bolha", 0.5, 60, 1.2));
      Som.tocar("brilho", { volume: 0.35, taxa: 1.15 });
      if (Math.random() < 0.4) Som.falar("bolhas");
    } else if (a.efeito === "aguaviva") {
      Hud.faixa(`🪼 Águas-vivas pro peixe de ${quem}`, "rosa", "aguaviva");
      Som.tocar("brilho", { volume: 0.55 });
      Som.falar("aguaviva");
    } else if (a.efeito === "tartaruga") {
      Hud.faixa(`🐢 Carona de tartaruga pra ${quem}!`, "verde", "tartaruga");
      Som.tocar("splash", { volume: 0.5, taxa: 0.8 });
      Som.falar("tartaruga");
    } else if (a.efeito === "tubarao") {
      Hud.resultado("Tubarão!", `${escapar(quem)} é o maior`, a.cor, 2600);
      Som.tocar("tubarao", { volume: 0.85 });
      Som.falar("tubarao");
    } else if (a.efeito === "baleia") {
      Hud.telao(a);
      Hud.resultado("Baleia!", escapar(quem), a.cor, 2600);
      Som.tocar("baleia", { volume: 0.9 });
      this.depois(1.6, () => Som.tocar("bau", { volume: 0.75 }));
      Som.falar("baleia");
    }
  },

  nivel(a) {
    const sub = a.decoracao ? `${NOME_DECORACAO[a.decoracao]}` : "festa no aquário";
    Hud.resultado(`Nível ${a.nivel}!`, sub, "#38d9ff", 2600);
    Som.tocar("brilho", { volume: 0.7 });
    if (a.decoracao === "bau") this.depois(0.4, () => Som.tocar("bau", { volume: 0.6 }));
    Som.falar(a.decoracao === "noturno" ? "noturno" : "nivel");
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
    Tanque.quadro(Math.min(0.05, dtJogo), agora);
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

  alguemNaAgua() {
    const P = this.partida;
    const p = P.peixes[Math.floor(Math.random() * P.peixes.length)];
    return p ? { id: p.id, nome: p.nome } : null;
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
    const daqui = () => this.alguemNaAgua() || nomeFalso();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "f") this.live.simular({ tipo: "seguiu", usuario: daqui() });
    else if (k === "h") this.live.simular({ tipo: "compartilhou", usuario: daqui() });
    else if (k === "c") this.live.simular({ tipo: "curtida", usuario: daqui(), curtidas: 15 });
    else if (k === "j") this.live.simular({ tipo: "comentario", usuario: daqui(), texto: "pula" });
    else if (k === "k") this.live.simular({ tipo: "comentario", usuario: daqui(), texto: "dança" });
    else if (k === "n") {
      const P = this.partida, lista = [];
      P.encher(P.aquario.meta - P.aquario.valor, lista, null);
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
    Tanque.zerar();
    Hud.esconderTelao();
    Hud.chamada("aguardando");
  },
};

/* O @ dos peixes e o HUD usam a Lilita One e a Figtree: espera as fontes
   pra não sair o nome com a letra de reserva. */
Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('800 27px "Figtree"')]).catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
