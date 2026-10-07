/* Liga as peças: live → regras → cena e HUD, e o relógio do jogo.
   O relógio (`agora`, em ms) só anda fora da pausa e desacelera na
   câmera lenta da chegada; tudo que anima lê dele, então pausar congela a
   tela inteira e a gravação quadro a quadro sai igual à tela. */
"use strict";

const { chave, config, opcoes } = Config.carregar();
const racha = new Racha(config, 0);

/* Plateia do ?demo=1 / tecla D: os nicks e a loja vêm do comum/live.js;
   alguns comentários puxam o apoio "pro @fulano". */
const PLATEIA = {
  ligado: false,
  ritmo: 1.4,
  semente: opcoes.semente,
  comentarios: [
    "boa noite live", "kkkkkk", "boraaa", "acelera", "vai vai vai", "eita", "que carro é esse kkk",
    "cheguei", "sp aqui", "bahia na área", "turbo pro @mari.alves", "@careca_do_gas", "nitro pro @tia_cida",
    "olha o opala", "manda o míssil", "🔥🔥🔥", "vrum vrum",
  ],
};

const Jogo = {
  agora: 0,
  pausado: false,
  ultimo: null,
  formatoAtual: "vertical",
  zerarEm: -Infinity,
  lenta: 1,
  chegouEm: -Infinity,
  quadros: 0,

  iniciar() {
    Som.aplicar(config);
    this.palco = document.getElementById("palco");
    Hud.montar(this.palco, config);
    Painel.montar(chave, config);
    Cena.montar(document.getElementById("cena"), "vertical", this.palco);

    this.mudarFormato(opcoes.formato || (innerHeight >= innerWidth ? "vertical" : "horizontal"));
    addEventListener("resize", () => this.encaixar());
    addEventListener("keydown", e => this.tecla(e));

    this.live = conectarLive({
      demo: PLATEIA,
      aoEvento: ev => this.receber(ev),
      aoEstado: estado => Hud.sinal(estado),
    });
    Hud.sinal(this.live.estado);
    requestAnimationFrame(t => this.quadro(t));
  },

  receber(ev) {
    this.contar(racha.receber(ev, this.agora));
  },

  contar(lista) {
    if (!lista.length) return;
    Hud.contar(lista, racha);
    for (const a of lista) {
      Cena.aoAcontecer(a, racha);
      Som.tocar(a);
      if (a.tipo === "chegou" && a.posicao === 1) this.chegouEm = this.agora;
    }
  },

  /* Câmera lenta quando o 1º está a menos de 1,5 s da chegada e logo
     depois que ele cruza. */
  ritmo() {
    const lider = racha.lider;
    let alvo = 1;
    if (racha.fase === "corrida" && lider && racha.pista - lider.d < (lider.v || config.velocidade) * 1.5) alvo = 0.3;
    if (racha.fase === "chegada" && this.agora - this.chegouEm < 900) alvo = 0.3;
    return alvo;
  },

  quadro(ts) {
    const dt = this.ultimo == null ? 0 : Math.min(0.1, (ts - this.ultimo) / 1000);
    this.ultimo = ts;
    if (!this.pausado) {
      this.lenta += (this.ritmo() - this.lenta) * Math.min(1, dt * 6);
      const dtJogo = dt * this.lenta;
      this.agora += dtJogo * 1000;
      this.contar(racha.passo(dtJogo, this.agora));
      const teto = config.teto[this.formatoAtual] || 24;
      Cena.quadro(dtJogo, { racha, agora: this.agora, visiveis: racha.visiveis(teto, this.agora) });
      Hud.quadro(dt, racha, this.agora);
      this.quadros++;
    }
    requestAnimationFrame(t => this.quadro(t));
  },

  mudarFormato(nome) {
    this.formatoAtual = nome;
    this.palco.classList.toggle("vertical", nome === "vertical");
    this.palco.classList.toggle("horizontal", nome === "horizontal");
    Cena.formato(nome);
    Hud.formato(nome);
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

  presenteTeste(faixa) {
    const f = config.faixas[faixa];
    if (!f) return;
    const pilotos = [...racha.pilotos.values()];
    const quem = pilotos.length ? pilotos[Math.floor(Math.random() * pilotos.length)] : { id: "teste1", nome: "teste1" };
    this.receber({
      tipo: "presente",
      usuario: { id: quem.id, nome: quem.nome, foto: quem.foto || null },
      presente: { nome: "Teste", moedas: f.moedas, quantidade: 1, total: f.moedas },
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
    else if (k === "e" && !racha.evento) this.contar([racha.iniciarEvento(this.agora)]);
    else if (k === "n") this.contar(racha.avancar(this.agora));
    else if (/^[1-6]$/.test(k)) this.presenteTeste(Number(k) - 1);
    else if (k === "r") {
      /* Duas vezes em 2 s: zerar a live sem querer, no meio dela, dói. */
      if (this.agora - this.zerarEm < 2000) {
        racha.zerar(this.agora);
        Cena.zerar();
        Hud.zerar();
        Hud.aviso("Live zerada");
      } else {
        this.zerarEm = this.agora;
        Hud.aviso("Aperte R de novo pra zerar a live");
      }
    }
  },
};

Jogo.iniciar();
window.racha = racha;
window.Jogo = Jogo;
