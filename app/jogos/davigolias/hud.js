/* O que fica por cima do vale, em DOM: o placar da live e o tempo no alto,
   quem é o Golias, as duas barras (o gigante chegando e a funda
   carregando), as faixas de anúncio, o placar entre as rodadas, o aviso de
   conector e a pausa. */
"use strict";

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

function escapar(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function encurtar(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const Hud = {
  montar(palco) {
    const q = s => palco.querySelector(s);
    this.$ = {
      topo: q(".topo"), davi: q(".topo .davi b"), golias: q(".topo .golias b"), tempo: q(".topo .tempo"),
      dono: q(".dono"), donoNome: q(".dono b"),
      perto: q(".barra.perto i"), funda: q(".barra.funda i"), barraFunda: q(".barra.funda"), barraPerto: q(".barra.perto"),
      faixa: q(".faixa"), placar: q(".placar"), sinal: q(".sem-sinal"),
    };
    this.ultimoTempo = null;
    this._importancia = 0;
    this._ate = 0;
  },

  /* Uma vez por quadro: só mexe no DOM quando o número muda. */
  quadro(duelo) {
    const $ = this.$;
    const seg = duelo.fase === "rodada" ? Math.ceil(duelo.resta()) : duelo.fase === "intervalo" ? duelo.cfg.rodada.duracao : this.ultimoTempo;
    if (seg !== this.ultimoTempo) {
      this.ultimoTempo = seg;
      $.tempo.textContent = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
      $.tempo.classList.toggle("acabando", duelo.fase === "rodada" && seg <= 10);
    }
    const perto = 1 - duelo.dist / duelo.cfg.golias.distancia;
    $.perto.style.height = `${(perto * 100).toFixed(2)}%`;
    $.funda.style.height = `${(duelo.fracao() * 100).toFixed(2)}%`;
    $.barraFunda.classList.toggle("quente", duelo.fracao() >= 0.5);
  },

  placarDaLive(p) {
    this.$.davi.textContent = p.davi;
    this.$.golias.textContent = p.golias;
  },

  dono(nome) {
    this.$.dono.hidden = !nome;
    if (nome) {
      this.$.donoNome.textContent = `@${encurtar(nome, 16)}`;
      this.$.dono.classList.remove("chegou");
      void this.$.dono.offsetWidth;
      this.$.dono.classList.add("chegou");
    }
  },

  /* Barra que pula com brilho quando um presente mexe nela. */
  pular(lado, nivel) {
    const b = lado === "golias" ? this.$.barraPerto : this.$.barraFunda;
    b.style.setProperty("--forca", (1 + nivel * 0.12).toFixed(2));
    b.classList.remove("pula");
    void b.offsetWidth;
    b.classList.add("pula");
  },

  /* Faixa grande no meio da tela; a nova troca a anterior, menos quando
     é de menor importância e a de agora ainda está na tela. */
  anunciar(texto, cor = "ouro", seg = 2.6, importancia = 1) {
    const f = this.$.faixa;
    const agora = performance.now();
    if (importancia < this._importancia && agora < this._ate) return;
    this._importancia = importancia;
    this._ate = agora + seg * 1000;
    f.className = `faixa ${cor}`;
    f.textContent = texto;
    f.style.fontSize = "";
    f.hidden = false;
    /* Sempre numa linha só: diminui a letra até caber. */
    let tam = parseFloat(getComputedStyle(f).fontSize);
    while (f.scrollWidth > f.clientWidth && tam > 40) {
      tam -= 4;
      f.style.fontSize = `${tam}px`;
    }
    void f.offsetWidth;
    f.classList.add("entra");
    clearTimeout(this._faixa);
    this._faixa = setTimeout(() => { f.hidden = true; }, seg * 1000);
  },

  mostrarPlacar(placar, vencedor) {
    const t = placar.temido;
    this.$.placar.innerHTML = `
      <h2>Placar da live</h2>
      <div class="lados">
        <div class="lado davi${vencedor === "davi" ? " venceu" : ""}"><span>Davi</span><b>${placar.davi}</b></div>
        <div class="x">×</div>
        <div class="lado golias${vencedor === "golias" ? " venceu" : ""}"><span>Golias</span><b>${placar.golias}</b></div>
      </div>
      ${t ? `<div class="temido">Golias mais temido<b>👑 @${escapar(encurtar(t.nome, 18))}</b><small>${t.rodadas} ${t.rodadas === 1 ? "rodada" : "rodadas"} como gigante</small></div>` : ""}
      <div class="proxima"></div>`;
    this.$.placar.hidden = false;
  },

  proxima(seg) {
    const p = this.$.placar.querySelector(".proxima");
    if (p) p.innerHTML = `Próxima rodada em <b>${Math.ceil(seg)}</b>`;
  },

  esconderPlacar() { this.$.placar.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
