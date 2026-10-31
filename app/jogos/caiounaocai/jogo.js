/* Liga as peças: live (comum/live.js) → Tabela (regras.js) → cena, HUD e
   som, mais as teclas de teste. O que acontece em sequência (queda um por
   um, fanfarra) anda no relógio do jogo, então a pausa segura tudo junto. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const W = 1080;

const CHAT_DEMO = [
  "boa noite live", "kkkkkk", "kkkkkkkkk", "vai cair", "não cai não", "aí sim", "eita", "que isso",
  "cheguei", "bora", "olha a tabela", "nãooo", "🔥🔥🔥", "segura", "sobe sobe", "kkk tá no z4",
];

/* Sorteio com semente (mulberry32): ?semente= repete a mesma tabela. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cada pessoa da plateia falsa torce por um time fixo; time com mais `peso`
   aparece mais vezes na lista e junta mais torcida. */
function ladosDaDemo(times) {
  const lados = [];
  for (const t of times) {
    const frases = [t.nome, ...t.apelidos, `vamo ${t.apelidos[0]}`, `${t.apelidos[0]} não cai`, `${t.nome} ${t.nome}`];
    for (let i = 0; i < Math.max(1, Math.round(t.peso / 2)); i++) lados.push({ comentarios: frases });
  }
  return lados;
}

const Jogo = {
  pausado: false,
  agenda: [],
  pontuados: 0,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    const aleatorio = opcoes.semente != null ? sorteio(opcoes.semente + 1) : Math.random;
    this.tabela = new Tabela(config, aleatorio);
    this.nomes = new Map(config.times.map(t => [t.id, t.nome.toUpperCase()]));

    Cena.montar(document.getElementById("mesa"), config);
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    this.configurar = montarConfigurar({
      jogo: "caiounaocai",
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
    this.depois(1.5, () => { Som.tocar("apito"); Som.falar("inicio"); });

    let antes = performance.now();
    const quadro = () => {
      const ms = performance.now();
      const dt = Math.min(0.05, Math.max(0, ms - antes) / 1000);
      antes = ms;
      this.quadro(dt, ms / 1000);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  /* Celular mais comprido que 9:16 (até 9:21): o palco cresce pra baixo em
     vez de sobrar faixa preta, e a escada estica junto. */
  aplicarFormato(primeira = false) {
    const H = innerWidth && innerHeight ? Math.min(2520, Math.max(1920, Math.round(W * innerHeight / innerWidth))) : 1920;
    if (H !== this.altura || primeira) {
      this.altura = H;
      this.palco.style.height = `${H}px`;
      Cena.aplicarFormato(W, H, this.tabela);
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  /* ───────── live ───────── */

  receber(ev) {
    const tab = this.tabela;
    const quem = ev.usuario;
    if (ev.tipo === "comentario") this.contar(tab.comentario(quem, ev.texto));
    else if (ev.tipo === "curtida") this.contar(tab.curtida(quem, ev.curtidas));
    else if (ev.tipo === "presente") {
      const pr = ev.presente;
      const faixa = this.configurar.faixa(pr.nome, pr.moedas);
      this.contar(tab.presente(quem, { nome: pr.nome, moedas: pr.total, quantidade: pr.quantidade, faixa }));
    }
  },

  nome(id) { return this.nomes.get(id) || ""; },

  contar(lista) {
    for (const a of lista) {
      switch (a.tipo) {
        case "comentou":
          if (this.tabela.fase === "rodada") Cena.pop(a.time, `@${encurtar(a.nome, 14)}`);
          if (!a.pontuou) break;
          Cena.comemorar(a.time);
          if (Math.random() < 0.35) Som.bip(false);
          if (++this.pontuados % 40 === 0) { Som.onda(); Som.falar("torcida"); }
          break;
        case "curtiu": Cena.comemorar(a.time); break;
        case "presente": this.presente(a); break;
        case "presidente":
          if (!a.tomou) break;
          Cena.faixa(`👑 @${encurtar(a.nome, 14)} TOMOU A PRESIDÊNCIA DO ${this.nome(a.time)}`, OURO);
          Som.falar("presidente");
          break;
        case "mudou": Cena.mudou(a.time, a.de, a.para); break;
        case "saiuZ4":
          Cena.faixa(a.por ? `@${encurtar(a.por, 14)} TIROU O ${this.nome(a.time)} DO Z4!` : `${this.nome(a.time)} SAIU DO Z4!`, VERDE);
          Som.falar("salvou", a.time);
          Som.onda();
          break;
        case "entrouZ4":
          Cena.faixa(`${this.nome(a.time)} ENTROU NO Z4 😱`, VERMELHO);
          Som.falar("z4", a.time);
          break;
        case "lider":
          Cena.faixa(`${this.nome(a.time)} É O LÍDER!`, OURO);
          Som.falar("lider", a.time);
          Som.onda();
          break;
        case "fim": this.fim(a); break;
        case "intervalo": Hud.ranking(this.tabela, this.campeao); break;
        case "rodada":
          Hud.esconderRanking();
          Cena.novaRodada(this.tabela);
          Cena.faixa("NOVA RODADA!", OURO);
          Som.tocar("apito");
          this.depois(0.6, () => Som.falar("inicio"));
          break;
      }
    }
  },

  presente(a) {
    const simbolo = simboloDoPresente(a.presente);
    Cena.pop(a.time, `@${encurtar(a.nome, 12)} ${simbolo}${a.quantidade > 1 ? "×" + a.quantidade : ""}`, true);
    Cena.comemorar(a.time);
    switch (Math.min(4, a.faixa)) {
      case 0:
        Cena.confete(a.time, 14);
        Som.tocar("confete", { volume: 0.6 });
        break;
      case 1:
        Cena.confete(a.time, 30);
        Cena.saltoDuplo(a.time);
        Som.tocar("nitro", { volume: 0.8 });
        if (Math.random() < 0.5) Som.falar("pulo");
        break;
      case 2:
        Cena.confete(a.time, 70);
        Cena.foguete(a.time);
        Som.tocar("jato");
        Som.falar("foguete");
        Som.onda();
        break;
      case 3:
        Cena.confete(a.time, 40);
        Cena.terremoto(a.time, this.tabela.time(a.time).pos);
        Som.estrondo();
        Som.tocar("nitro", { volume: 0.6, taxa: 0.7 });
        Som.falar("terremoto");
        break;
      case 4:
        Cena.confete(a.time, 120);
        Cena.lendario(a.time);
        Som.tocar("jato");
        Som.tocar("torcida-forte", { volume: 0.9 });
        Som.falar("lendario");
        Som.onda();
        break;
    }
  },

  /* Apito, os do Z4 escorregam um por vez do último pra cima, carimbo,
     torcida e fanfarra; o campeão fica com o troféu até a rodada nova. */
  fim(a) {
    this.campeao = a.campeao;
    Som.tocar("apito");
    a.caidos.forEach((id, i) => this.depois(0.9 + i * 0.7, () => {
      Cena.cair(id);
      Som.tocar("escorregao", { taxa: 0.9 + i * 0.08 });
    }));
    const carimbo = 0.9 + a.caidos.length * 0.7;
    this.depois(carimbo, () => {
      Cena.carimbar(a.caidos.map(id => this.tabela.time(id).nome));
      Cena.trofeu = a.campeao;
      Cena.comemorar(a.campeao);
      Som.falar("caiu", a.caidos[0]);
      Som.tocar("torcida-forte");
    });
    this.depois(carimbo + 1.8, () => Som.tocar("fanfarra", { volume: 0.7 }));
    this.depois(carimbo + 3.6, () => Som.falar("campeao"));
  },

  /* ───────── relógio ───────── */

  depois(seg, f) {
    this.agenda.push({ em: this.tabela.t + seg, f });
  },

  quadro(dt, agora) {
    const tab = this.tabela;
    const dtJogo = this.pausado ? 0 : dt;
    if (tab.fase === "rodada" && dtJogo) this.contagem(tab.resta(), tab.resta() - dtJogo);
    this.contar(tab.passo(dtJogo));
    if (this.agenda.length) {
      const prontos = this.agenda.filter(x => x.em <= tab.t);
      this.agenda = this.agenda.filter(x => x.em > tab.t);
      for (const x of prontos) x.f();
    }
    if (tab.fase === "intervalo") Hud.proxima(tab.resta());
    Cena.quadro(tab, dtJogo, agora);
  },

  /* Últimos 10 s: rufar em 3 ondas cada vez mais rápidas e bipe nos 5 finais. */
  contagem(antes, depois) {
    const passou = s => antes > s && depois <= s;
    if (passou(10)) { Som.falar("dez"); Som.tocar("rufar", { volume: 0.8 }); }
    if (passou(6.5)) Som.tocar("rufar", { volume: 0.9, taxa: 1.08 });
    if (passou(3.2)) Som.tocar("rufar", { volume: 1, taxa: 1.16 });
    if (depois > 0 && depois <= 5 && Math.ceil(antes) !== Math.ceil(depois)) Som.bip(true);
  },

  /* ───────── teclas e testes ───────── */

  testeId: 0,
  testador() {
    const ids = ["teste.ana", "teste.beto", "teste.cida", "teste.dudu", "teste.edu", "teste.fefe"];
    return { id: ids[this.testeId++ % ids.length], nome: nomeDeTeste() };
  },

  /* O presente de teste vai pra um time sorteado: o testador comenta o time
     antes, senão o presente não teria pra quem contar. */
  presenteTeste(presente) {
    const usuario = this.testador();
    const t = config.times[Math.floor(Math.random() * config.times.length)];
    this.live.simular({ tipo: "comentario", usuario, texto: t.apelidos[0] });
    this.live.simular({ tipo: "presente", usuario, presente });
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
    else if (k === "e") this.tabela.encerrar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "r") this.zerar();
    else if (k === "t") {
      for (let i = 0; i < 10; i++) {
        const nome = "espectador" + Math.floor(Math.random() * 400);
        const t = config.times[Math.floor(Math.random() * config.times.length)];
        this.live.simular({ tipo: "comentario", usuario: { id: nome, nome }, texto: t.apelidos[Math.floor(Math.random() * t.apelidos.length)] });
      }
    }
  },

  zerar() {
    this.tabela.zerar();
    this.agenda = [];
    this.pontuados = 0;
    Hud.esconderRanking();
    Cena.novaRodada(this.tabela);
  },
};

/* A cena desenha com a Lilita One: espera a fonte pra não sair o primeiro
   quadro (e a capa) com a letra de reserva. */
document.fonts.load('40px "Lilita One"').catch(() => {}).finally(() => {
  Jogo.iniciar();
  window.Jogo = Jogo;
});
