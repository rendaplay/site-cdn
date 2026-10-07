/* Liga as peças: live → regras → cena e HUD, e o relógio do jogo.
   O relógio (`agora`, em ms) só anda fora da pausa, e tudo que anima lê
   dele: pausar congela a tela inteira e a gravação quadro a quadro sai
   igual à tela. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const escalada = new Escalada(config, 0);

/* Plateia do ?demo=1 / tecla D: cada pessoa torce por um time e manda o
   presente-símbolo dele; presente de valor sai de qualquer um. */
const PLATEIA = {
  ligado: false,
  ritmo: 1.1,
  semente: opcoes.semente,
  lados: config.times.map(t => ({ comentarios: [t.comandos[0], t.comandos[0], t.comandos[0], t.comandos[1]] })),
  presentes: [
    { nome: config.times[0].presente.aceitos[0], moedas: 1, peso: 30, lado: 0 },
    { nome: config.times[1].presente.aceitos[0], moedas: 1, peso: 24, lado: 1 },
    { nome: "Finger Heart", moedas: 5, peso: 9 },
    { nome: "Doughnut", moedas: 30, peso: 5 },
    { nome: "Hand Hearts", moedas: 100, peso: 2.4 },
    { nome: "Money Gun", moedas: 500, peso: 0.6 },
    { nome: "Galaxy", moedas: 1000, peso: 0.3 },
    { nome: "Interstellar", moedas: 10000, peso: 0.02 },
  ],
};

const Jogo = {
  agora: 0,
  pausado: false,
  ultimo: null,
  formatoAtual: "vertical",
  recordeDeSempre: 0,
  zerarEm: 0,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    Cena.montar(document.getElementById("cena"), "vertical", config.personagem);
    this.recordeDeSempre = Config.recordeDeSempre(chave, 0);

    this.mudarFormato(opcoes.formato || (innerHeight >= innerWidth ? "vertical" : "horizontal"));
    addEventListener("resize", () => this.encaixar());
    addEventListener("keydown", e => this.tecla(e));

    this.live = conectarLive({
      demo: PLATEIA,
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => Hud.sinal(estado),
    });
    Hud.sinal(this.live.estado);

    setInterval(() => { this.recordeDeSempre = Config.recordeDeSempre(chave, escalada.recorde); }, 5000);
    requestAnimationFrame(t => this.quadro(t));
  },

  receber(ev) {
    if (ev.simulado && this.live && this.live.modo === "mock") ev.mock = true;
    this.contar(escalada.receber(ev, this.agora));
  },

  contar(lista) {
    if (!lista.length) return;
    Hud.contar(lista);
    for (const a of lista) {
      Cena.aoAcontecer(a, escalada);
      Som.tocar(a);
    }
  },

  estado() {
    return {
      altura: escalada.altura,
      piso: escalada.piso,
      desgaste: escalada.desgaste,
      recorde: escalada.recorde,
      checkpoint: config.regras.checkpoint,
      evento: escalada.evento,
      atolado: escalada.atolado,
      agora: this.agora,
    };
  },

  quadro(ts) {
    const dt = this.ultimo == null ? 0 : Math.min(0.1, (ts - this.ultimo) / 1000);
    this.ultimo = ts;
    if (!this.pausado) {
      this.agora += dt * 1000;
      this.contar(escalada.passo(dt, this.agora));
      Cena.quadro(dt, this.estado());
      Hud.quadro(dt, Cena.zeTela());
      Hud.placar(escalada, Cena.vis, this.recordeDeSempre);
      Hud.surpresa(escalada.evento, this.agora);
      Hud.pendentes(escalada, this.agora);
    }
    requestAnimationFrame(t => this.quadro(t));
  },

  mudarFormato(nome) {
    this.formatoAtual = nome;
    this.palco.classList.toggle("vertical", nome === "vertical");
    this.palco.classList.toggle("horizontal", nome === "horizontal");
    Cena.formato(nome);
    this.encaixar();
  },

  /* O palco tem tamanho fixo (1080×1920 ou 1920×1080) e escala pra caber na
     janela sem distorcer. O canvas desenha no tamanho real da tela. */
  encaixar() {
    const { W, H } = Cena.L;
    const escala = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform = `translate(${(innerWidth - W * escala) / 2}px, ${(innerHeight - H * escala) / 2}px) scale(${escala})`;
    Cena.dimensionar(escala);
  },

  pausar() {
    this.pausado = !this.pausado;
    this.palco.querySelector(".pausa").hidden = !this.pausado;
  },

  presenteTeste(time) {
    const valores = [1, 1, 5, 10, 30, 100, 500, 1000, 3000];
    const total = valores[Math.floor(Math.random() * valores.length)];
    const id = `teste${time}${Math.floor(Math.random() * 4)}`;
    this.receber({
      tipo: "presente",
      usuario: { id, nome: `${id}`, foto: null },
      presente: { nome: config.times[time].presente.aceitos[0], moedas: total, quantidade: 1, total },
    });
  },

  tecla(e) {
    if (Painel.aberto()) {
      if (e.key === "Escape") Painel.alternar(false);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "p") { e.preventDefault(); Painel.alternar(true); }
    else if (k === " ") { e.preventDefault(); this.pausar(); }
    else if (k === "f") this.mudarFormato(this.formatoAtual === "vertical" ? "horizontal" : "vertical");
    else if (k === "s") Som.alternar();
    else if (k === "d") this.live.ligarDemo();
    else if (k === "e" && !escalada.evento) this.contar([escalada.iniciarEvento(this.agora)]);
    else if (k === "1" || k === "2") this.presenteTeste(Number(k) - 1);
    else if (k === "r") {
      /* Duas vezes em 2 s: zerar a live sem querer, no meio dela, dói. */
      if (this.agora - this.zerarEm < 2000) {
        escalada.zerar(this.agora);
        Cena.vis = 0;
        Cena.cordasRotas.clear();
        Hud.aviso("Live zerada");
      } else {
        this.zerarEm = this.agora;
        Hud.aviso("Aperte R de novo pra zerar a live");
      }
    }
  },
};

Jogo.iniciar();
window.escalada = escalada;
window.Jogo = Jogo;
