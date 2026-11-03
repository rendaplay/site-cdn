/* Liga as peças: live (comum/live.js) → Estadio (regras.js) → cena, HUD e
   som, mais as teclas de teste. A cena avisa pelo `aoMomento` quando o
   sinalizador acende, o bandeirão abre, os cartões viram, o ônibus buzina
   e os fogos estouram, e o som entra nessa hora. */
"use strict";

const { chave, config } = Config.carregar();
const W = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "cheguei", "bora", "que estádio", "olha a ola", "eita",
  "🔥🔥🔥", "lotou", "que isso", "arquibancada cheia", "vamo vamo", "a maior é a minha", "kkk",
];

/* Frases com o nome e os apelidos de cada time, mais vezes pros de mais
   torcida, pra plateia de demonstração. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const frases = [t.nome, ...t.apelidos, `vamo ${t.apelidos[0]}`, `${t.apelidos[0]} ${t.apelidos[0]}`, `sou ${t.nome}`];
    for (let i = 0; i < Math.max(1, Math.round(t.peso / 2)); i++) lados.push({ comentarios: frases });
  }
  return lados;
}

const Jogo = {
  pausado: false,
  chegadas: 0,
  ultimoPassou: -99,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    this.estadio = new Estadio(config);
    this.times = new Map(config.times.map(t => [t.id, t]));
    this.lotados = new Set();

    Cena.montar(document.getElementById("estadio"), this.palco, config, (m, dados) => this.momento(m, dados));
    Hud.montar(this.palco, config.times);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "torcida",
      opcoes: () => config.faixas.map(f => f.nome),
      testar: presente => this.presenteTeste(presente),
      avancado: () => Painel.alternar(true),
    });
    this.aplicarFormato(true);

    addEventListener("resize", () => this.aplicarFormato());
    addEventListener("keydown", e => this.tecla(e));

    Hud.sinal("demo");
    setTimeout(() => { if (this.live.estado === "conectando") Hud.sinal("conectando"); }, 3000);
    this.live = conectarLive({
      demo: { ligado: false, comentarios: CHAT_DEMO, lados: ladosDaDemo(config.times), ...config.demo },
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => { if (estado !== "conectando") Hud.sinal(estado); },
    });
    setTimeout(() => { Som.tocar("apito"); Som.falar("inicio"); }, 1500);

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.05, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra baixo e a
     câmera abre junto, em vez de sobrar faixa preta. */
  aplicarFormato(primeira = false) {
    const H = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, Math.round(W * innerHeight / innerWidth))) : 1920;
    if (H !== this.altura || primeira) {
      this.altura = H;
      this.palco.style.height = `${H}px`;
      Cena.aplicarFormato(W, H);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
    Cena.dimensionar(s);
  },

  nomeDoTime(id) {
    const t = this.times.get(id);
    return t ? (t.curto || t.nome).toUpperCase() : "";
  },

  /* ───────── live ───────── */

  receber(ev) {
    const e = this.estadio;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(e.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(e.curtida(quem, ev.curtidas));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(e.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    } else if (ev.tipo === "seguiu" || ev.tipo === "compartilhou") Som.onda(0.4, 1);
  },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "entrou": this.entrou(a); break;
        case "pulou": Cena.pulou(a); break;
        case "acenou": Cena.acenou(a); break;
        case "presente": this.presente(a); break;
        case "presidente": this.presidente(a); break;
        case "passou": this.passou(a); break;
        case "fim": this.fim(a); break;
        case "intervalo":
          Hud.esconderVencedor();
          Hud.mostrarRanking(this.estadio, a.vencedor);
          Cena.esvaziar();
          break;
        case "rodada":
          Hud.esconderRanking();
          this.lotados.clear();
          Som.final = false;
          Cena.novaRodada(this.estadio, a.reservas);
          Hud.anunciar(`RODADA ${a.rodada}`, "ouro", 1.8);
          Som.tocar("apito");
          setTimeout(() => Som.falar("rodada"), 400);
          break;
      }
    }
  },

  entrou(a) {
    Cena.entrou(a);
    if (Math.random() < 0.5) Som.plim();
    if (++this.chegadas % 40 === 0) { Som.onda(0.6); Som.falar("torcida"); }
    const n = this.estadio.lotacao(this.estadio.setor(a.time));
    if (n >= 30 && !this.lotados.has(a.time)) {
      this.lotados.add(a.time);
      Hud.anunciar(`A TORCIDA DO ${this.nomeDoTime(a.time)} TÁ LOTANDO`, "ouro", 2.4, 0);
      Som.falar("lotado", a.time);
    }
  },

  /* Ultrapassagem: a da liderança sempre, as outras uma de cada vez e só
     quando o time passado já tem gente (senão é só o placar se ajeitando). */
  passou(a) {
    if (!a.passados.length) return;
    const passado = this.estadio.setor(a.passados[0]);
    if (a.lider) {
      Hud.anunciar(`${this.nomeDoTime(a.time)} PASSOU O ${this.nomeDoTime(passado.id)}`, "ouro", 2.6, 1);
      Som.falar("lider", a.time);
      Som.onda(0.6);
      this.ultimoPassou = this.estadio.t;
      return;
    }
    if (this.estadio.lotacao(passado) < 2 || this.estadio.t - this.ultimoPassou < 2.5) return;
    this.ultimoPassou = this.estadio.t;
    Hud.anunciar(`${this.nomeDoTime(a.time)} PASSOU O ${this.nomeDoTime(passado.id)}`, "branco", 2.2, 0);
    if (Math.random() < 0.5) Som.falar("passou", a.time);
  },

  presidente(a) {
    Cena.presidente(a.time, a.nome, a.tomou);
    const quem = `👑 @${encurtar(a.nome, 14)}`;
    if (a.tomou) {
      Hud.anunciar(`${quem} TOMOU A PRESIDÊNCIA DO ${this.nomeDoTime(a.time)}`, "ouro", 3.2, 2);
      Som.corneta();
      Som.falar("presidente", a.time);
    } else setTimeout(() => Hud.anunciar(`${quem} PRESIDENTE DO ${this.nomeDoTime(a.time)}`, "ouro", 2.4, 0), 2600);
  },

  /* Cada faixa é um efeito no setor do time. O som entra pela cena, na hora
     da animação; aqui fica o narrador. */
  presente(a) {
    const rotulo = { nome: encurtar(a.nome, 14), simbolo: simboloDoPresente(a.presente), quantidade: a.quantidade };
    if (a.guardado) {
      Cena.guardado(a, rotulo);
      return;
    }
    Cena.presente(a, rotulo);
    const n = Math.min(4, a.faixa);
    const fala = ["sinalizador", "bandeirao", "mosaico", "caravana", null][n];
    if (fala && (n > 0 || Math.random() < 0.3)) Som.falar(fala, a.time);
  },

  fim(a) {
    Cena.fim(a);
    if (!a.vencedor) {
      Hud.anunciar("FIM DE RODADA", "branco", 3);
      return;
    }
    Hud.vencedor(this.times.get(a.vencedor));
    Som.tocar("apito");
    Som.tocar("torcida-forte");
    Som.tocar("confete", { volume: 0.8 });
    setTimeout(() => Som.tocar("fanfarra", { volume: 0.7 }), 900);
    Som.onda(1, 5);
    Som.falar("venceu", a.vencedor);
  },

  /* O que a cena avisa na hora exata da animação. */
  momento(m, dados = {}) {
    switch (m) {
      case "sinalizador": Som.chiado(4); break;
      case "bandeira": Som.vento(1.8); Som.onda(0.55); break;
      case "cartoes": Som.cartoes(1.4); Som.onda(0.7, 2); break;
      case "caravana": Som.buzina(1); break;
      case "buzina": Som.buzina(3); Som.onda(0.7, 2.5); break;
      case "fogos": Som.fogos(); break;
      case "lenda": {
        const r = dados.rotulo;
        Hud.anunciar(`${r.simbolo} @${r.nome}`, "ouro lenda", 3, 3);
        Som.apagao();
        Som.falar("lendario", dados.st.time.id);
        setTimeout(() => { Som.tocar("torcida-forte", { volume: 0.9 }); Som.onda(1, 5); }, 700);
        break;
      }
    }
  },

  /* ───────── relógio ───────── */

  quadro(dt) {
    const e = this.estadio;
    const dtJogo = this.pausado ? 0 : dt;
    if (e.fase === "rodada" && dtJogo) this.contagem(e.resta(), e.resta() - dtJogo);
    this.contar(e.passo(dtJogo));
    if (e.fase === "intervalo") Hud.proxima(e.resta());
    Hud.quadro(e);
    Cena.quadro(e, dtJogo);
    let soma = 0, maior = 0;
    for (const st of Cena.setores) { soma += st.agito; maior = Math.max(maior, st.agito); }
    Som.barulho = Math.min(1, (maior / 3) * 0.6 + (soma / 36) * 0.8);
    Som.quadro(this.pausado || e.fase === "intervalo");
  },

  /* Últimos 10 s: contagem no telão, rufar em 3 ondas, a batucada acelera
     e bipe nos 5 finais. */
  contagem(antes, depois) {
    const passou = s => antes > s && depois <= s;
    if (passou(10)) { Som.final = true; Som.falar("dez"); Som.tocar("rufar", { volume: 0.8 }); Som.onda(0.7, 3); }
    if (passou(6.5)) Som.tocar("rufar", { volume: 0.9, taxa: 1.08 });
    if (passou(3.2)) { Som.tocar("rufar", { volume: 1, taxa: 1.16 }); Som.onda(0.9, 3.5); }
    if (depois > 0 && depois <= 5 && Math.ceil(antes) !== Math.ceil(depois)) Som.bip(true);
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,

  /* Testador que já comentou um time (sorteado pelo peso), pro presente cair
     num setor de verdade. */
  testador() {
    const id = `teste.${this.testeId++ % 8}`;
    const usuario = { id, nome: nomeDeTeste() };
    const time = this.sortearTime();
    this.live.simular({ tipo: "comentario", usuario, texto: time.apelidos[0] });
    return usuario;
  },

  sortearTime() {
    const total = config.times.reduce((n, t) => n + t.peso, 0);
    let x = Math.random() * total;
    return config.times.find(t => (x -= t.peso) < 0) || config.times[0];
  },

  presenteTeste(presente) {
    this.live.simular({ tipo: "presente", usuario: this.testador(), presente });
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
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (e.key === "Enter") { this.pausado = !this.pausado; this.palco.querySelector(".pausa").hidden = !this.pausado; }
    else if (k === "s") Som.alternar();
    else if (k === "e") this.estadio.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "torcedor" + Math.floor(Math.random() * 900);
        const t = this.sortearTime();
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: `vamo ${t.apelidos[0]}` });
      }
    }
  },

  zerar() {
    this.estadio.zerar();
    this.chegadas = 0;
    this.lotados.clear();
    Som.final = false;
    Hud.esconderRanking();
    Hud.esconderVencedor();
    Cena.esvaziar();
    Cena.novaRodada(this.estadio);
  },
};

/* O telão e as faixas usam a Lilita One: espera a fonte pra não sair o
   primeiro quadro (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
