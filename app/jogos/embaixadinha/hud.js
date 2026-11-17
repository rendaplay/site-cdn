/* O que fica por cima do canvas, em DOM: placar com o relógio e o recorde
   da live, o contador grande e o fôlego em cima de cada craque, o @ que
   salta da bola, o CAIU!, o nome do truque, faixas, cartões de presente, o
   NOVO RECORDE!, o telão do show do craque, a abertura do clássico, a
   chamada quando ninguém comenta, o ranking entre as rodadas e o aviso de
   conector. */
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

const NOME_EFEITO = {
  brilho: "Bola brilhante", lento: "Câmera lenta", vento: "Vento no rival", fogo: "Bola de fogo", show: "Show do craque",
};
const SIMBOLO_EFEITO = { brilho: "✨", lento: "🐢", vento: "🌪️", fogo: "🔥", show: "⭐" };
const SIMBOLO_FORMA = { estrela: "⭐", coracao: "💖", raio: "⚡" };

const Hud = {
  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    this.times = new Map(cfg.times.map(t => [t.id, t]));
    const q = s => palco.querySelector(s);
    this.$ = {
      placar: q(".placar"), relogio: q(".placar .relogio"), rotulo: q(".placar .rotulo"), recorde: q(".placar .recorde"),
      lado: { a: q(".placar .lado.a"), b: q(".placar .lado.b") },
      contador: { a: q(".contador.a"), b: q(".contador.b") },
      caiu: { a: q(".caiu.a"), b: q(".caiu.b") },
      pops: q(".pops"), faixas: q(".faixas"), presentes: q(".presentes"), resultado: q(".resultado"),
      telao: q(".telao"), dica: q(".dica"), abertura: q(".abertura"), chamada: q(".chamada"), ranking: q(".ranking"),
      sinal: q(".sem-sinal"),
    };
    this.pos = [];
    this.dicas = [];
    this.iDica = 0;
    this.visto = { a: {}, b: {} };
    setInterval(() => this.trocarDica(), 6500);
  },

  time(id) { return this.times.get(id) || { nome: "", sigla: "", cor: "#888", cor2: "#444" }; },

  cores(id) {
    const t = this.time(id);
    return `--c1:${t.cor};--c2:${t.cor2}`;
  },

  chip(id) { return `<span class="chip" style="${this.cores(id)}"></span>`; },

  ladoDo(id) { return id === this.b ? "b" : "a"; },

  /* ───────── clássico ───────── */

  classico(a, b, { revanche = false } = {}) {
    this.a = a;
    this.b = b;
    const A = this.time(a), B = this.time(b);
    const s = this.palco.style;
    s.setProperty("--a1", A.cor); s.setProperty("--a2", A.cor2);
    s.setProperty("--b1", B.cor); s.setProperty("--b2", B.cor2);
    this.$.lado.a.querySelector(".sigla").textContent = A.sigla;
    this.$.lado.b.querySelector(".sigla").textContent = B.sigla;
    this.$.placar.hidden = false;
    this.$.chamada.hidden = true;
    this.$.ranking.hidden = true;
    this.$.telao.hidden = true;
    for (const k of ["a", "b"]) {
      this.$.contador[k].hidden = false;
      this.$.caiu[k].hidden = true;
      this.visto[k] = {};
    }

    const ab = this.$.abertura;
    ab.innerHTML = `
      <div class="titulo">${revanche ? "Revanche!" : escapar(this.cfg.titulo)}</div>
      <div class="times">
        <div class="time">${this.chip(a)}${escapar(A.nome)}</div>
        <div class="x">×</div>
        <div class="time">${this.chip(b)}${escapar(B.nome)}</div>
      </div>
      <div class="sub">Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> e a bola sobe.<br>Maior sequência em ${Math.round(this.cfg.duracao / 60)} min vence</div>`;
    ab.hidden = false;
    clearTimeout(this._abertura);
    this._abertura = setTimeout(() => { ab.hidden = true; }, (this.cfg.tempos.abertura - 0.3) * 1000);
    this.classicoDicas();
  },

  classicoDicas() {
    const A = this.time(this.a), B = this.time(this.b);
    this.dicas = [
      `Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b>: cada comentário é um toque`,
      "Escreva <b>lambreta</b>, <b>chapéu</b> ou <b>bicicleta</b> e o craque faz o truque",
      "Curtidas dão <b>fôlego</b>: sem fôlego a bola cai",
      "A <b>maior sequência</b> da rodada vence",
      "Comente <b>outro time</b> pra desafiar o vencedor",
    ];
    this.iDica = -1;
    this.trocarDica();
  },

  /* ───────── todo quadro ───────── */

  atualizar(jogo, fase, t, recorde) {
    if (recorde) {
      const texto = recorde.n ? `🏆 Recorde da live <b>${recorde.n}</b>${recorde.nome ? ` · @${escapar(encurtar(recorde.nome, 14))}` : ""}` : "";
      if (this.$.recorde.innerHTML !== texto) this.$.recorde.innerHTML = texto;
      this.$.recorde.hidden = !texto;
    }
    if (!jogo) return;
    const seg = Math.ceil(jogo.relogio);
    const relogio = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
    if (this.$.relogio.textContent !== relogio) this.$.relogio.textContent = relogio;
    this.$.relogio.classList.toggle("acabando", seg <= 10 && fase === "jogo");
    const rotulo = fase === "pausa" ? "Parado" : fase === "fim" || fase === "intervalo" ? "Fim" : "Maior sequência";
    if (this.$.rotulo.textContent !== rotulo) this.$.rotulo.textContent = rotulo;

    for (const [k, id] of [["a", jogo.a], ["b", jogo.b]]) {
      const lado = jogo.lados[id];
      const v = this.visto[k];
      const melhor = this.$.lado[k].querySelector(".melhor");
      if (v.melhor !== lado.melhor) {
        v.melhor = lado.melhor;
        melhor.textContent = String(lado.melhor);
      }
      const c = this.$.contador[k];
      const num = c.querySelector(".num");
      if (v.seq !== lado.seq) {
        const subiu = lado.seq > (v.seq || 0);
        v.seq = lado.seq;
        num.textContent = String(lado.seq);
        if (subiu) {
          num.classList.remove("pulou");
          void num.offsetWidth;
          num.classList.add("pulou");
        }
      }
      const folego = c.querySelector(".folego i");
      const nivel = Math.round(lado.folego * 100);
      if (v.folego !== nivel) {
        v.folego = nivel;
        folego.style.width = `${nivel}%`;
        c.classList.toggle("aflito", nivel < 25 && !lado.caida);
      }
      const reforco = t < lado.reforcoAte;
      if (v.reforco !== reforco) {
        v.reforco = reforco;
        c.querySelector(".reforco").hidden = !reforco;
      }
      /* O efeito que está valendo agora, com o @ de quem mandou. */
      const e = lado.ativo;
      const chave = e ? `${e.efeito}|${e.ate}` : t < lado.ventoAte ? "ventoRival" : "";
      if (v.efeito !== chave) {
        v.efeito = chave;
        const chip = c.querySelector(".efeito");
        chip.hidden = !chave;
        if (e) {
          const dono = this._donoAtivo && this._donoAtivo[id];
          const simbolo = e.efeito === "brilho" ? SIMBOLO_FORMA[lado.forma] || "✨" : SIMBOLO_EFEITO[e.efeito];
          chip.innerHTML = `${simbolo} <b>${NOME_EFEITO[e.efeito]}</b>${dono ? ` <span>@${escapar(encurtar(dono, 11))}</span>` : ""}`;
        } else if (chave) chip.innerHTML = "🌪️ <b>Ventania!</b>";
      }
    }
  },

  /* Guarda quem mandou o efeito que começou (pro chip em cima do craque). */
  efeito(ev) {
    this._donoAtivo = this._donoAtivo || {};
    this._donoAtivo[ev.time] = ev.de;
  },

  /* `pos` vem da cena (px do palco): contador em cima de cada craque. */
  posicionar(pos, jogo, fase) {
    this.pos = pos;
    const mostrar = jogo && fase !== "intervalo";
    let fundo = 0;
    for (const [i, k] of [[0, "a"], [1, "b"]]) {
      const c = this.$.contador[k];
      c.hidden = !mostrar;
      if (!mostrar || !pos[i]) continue;
      const p = pos[i].topo;
      const x = Math.min(1080 - 200, Math.max(200, p.x));
      const y = Math.max(430, p.y);
      fundo = Math.max(fundo, y);
      c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const caiu = this.$.caiu[k];
      if (!caiu.hidden) caiu.style.transform = `translate(${x.toFixed(1)}px, ${pos[i].cabeca.y.toFixed(1)}px)`;
    }
    /* Faixas e telão descem junto com os selos de efeito, que seguem o craque
       na tela; em degraus de 20 px pra não recalcular o estilo todo quadro. */
    const abaixo = Math.ceil((fundo + 130) / 20) * 20;
    if (abaixo !== this._abaixo) {
      this._abaixo = abaixo;
      this.palco.style.setProperty("--abaixo", `${abaixo}px`);
    }
  },

  /* ───────── o que salta da bola ───────── */

  /* "@fulano" saindo da bola do lado. Muitos toques seguidos: só alguns
     viram balão, senão a tela vira sopa de letras. */
  pop(timeId, html, cls = "") {
    const k = this.ladoDo(timeId);
    const p = this.pos[k === "a" ? 0 : 1];
    if (!p) return;
    const camada = this.$.pops;
    if (!cls && camada.querySelectorAll(`.pop.${k}:not(.truque)`).length >= 3) return;
    /* Truque novo toma o lugar do anterior do mesmo lado: empilhados viravam um borrão amarelo. */
    if (cls === "truque") camada.querySelectorAll(`.pop.${k}.truque`).forEach(t => t.remove());
    const e = el("div", `pop ${k} ${cls}`);
    e.style.cssText = this.cores(timeId);
    e.style.left = `${p.bola.x.toFixed(0)}px`;
    e.style.top = `${p.bola.y.toFixed(0)}px`;
    e.innerHTML = `<span>${html}</span>`;
    camada.appendChild(e);
    setTimeout(() => e.remove(), cls ? 1900 : 1100);
  },

  toque(ev) {
    if (!ev.nome) return;
    this.pop(ev.time, `@${escapar(encurtar(ev.nome, 13))}${ev.valor > 1 ? ` <i>+${ev.valor}</i>` : ""}`);
  },

  truque(ev) {
    const nome = NOME_TRUQUE[ev.truque] || ev.truque;
    this.pop(ev.time, `<b>${escapar(nome)}!</b>${ev.nome ? `<small>@${escapar(encurtar(ev.nome, 13))}</small>` : ""}<i>+${ev.valor}</i>`, "truque");
  },

  caiu(ev) {
    const k = this.ladoDo(ev.time);
    const c = this.$.caiu[k];
    c.style.cssText = this.cores(ev.time);
    c.innerHTML = `<b>Caiu!</b><small>${ev.seq ? `sequência de ${ev.seq}` : "de primeira"}</small>`;
    c.hidden = false;
    c.style.animation = "none";
    void c.offsetWidth;
    c.style.animation = "";
    const p = this.pos[k === "a" ? 0 : 1];
    if (p) c.style.transform = `translate(${p.topo.x.toFixed(1)}px, ${p.cabeca.y.toFixed(1)}px)`;
    clearTimeout(this["_caiu" + k]);
    this["_caiu" + k] = setTimeout(() => { c.hidden = true; }, (this.cfg.recomeco + 0.2) * 1000);
  },

  recomecou(ev) { this.$.caiu[this.ladoDo(ev.time)].hidden = true; },

  /* ───────── avisos ───────── */

  faixa(texto, cor = "") {
    const f = el("div", `faixa ${cor}`, texto);
    this.$.faixas.prepend(f);
    while (this.$.faixas.children.length > 2) this.$.faixas.lastChild.remove();
    setTimeout(() => f.remove(), 3300);
  },

  presente({ nome, simbolo, quantidade, efeito, forma, time, desafiante, semTime }) {
    const c = el("div", `presente f${FAIXAS_EFEITO.indexOf(efeito)}`);
    c.style.cssText = this.cores(time);
    const t = this.time(time);
    const icone = efeito === "brilho" ? SIMBOLO_FORMA[forma] || "✨" : SIMBOLO_EFEITO[efeito] || "";
    const linha = desafiante
      ? `força pro ${escapar(t.sigla || t.nome)} entrar`
      : `${icone} ${NOME_EFEITO[efeito] || ""}${semTime && t.sigla ? ` · ${escapar(t.sigla)}` : ""}`;
    c.innerHTML = `<div class="simbolo">${simbolo}</div>`
      + `<div class="quem">@${escapar(encurtar(nome, 18))}${quantidade > 1 ? ` ×${quantidade}` : ""}</div>`
      + `<div class="efeito">${linha}</div>`;
    this.$.presentes.prepend(c);
    while (this.$.presentes.children.length > 2) this.$.presentes.lastChild.remove();
    setTimeout(() => c.remove(), 4300);
  },

  /* NOVO RECORDE! ou marco grande, no meio da tela. */
  resultado(titulo, sub, timeId, ms = 2400) {
    const r = this.$.resultado;
    r.className = "resultado";
    r.style.cssText = this.cores(timeId);
    r.innerHTML = `${titulo}${sub ? `<small>${sub}</small>` : ""}`;
    r.hidden = false;
    r.style.animation = "none";
    void r.offsetWidth;
    r.style.animation = "";
    /* Faixa e truque no mesmo instante embolavam com o letreiro grande. */
    this.palco.classList.add("com-resultado");
    clearTimeout(this._resultado);
    this._resultado = setTimeout(() => { r.hidden = true; this.palco.classList.remove("com-resultado"); }, ms);
  },

  recorde(ev) {
    const quem = ev.nome ? `@${escapar(encurtar(ev.nome, 14))} · ${ev.n}` : `${escapar(this.time(ev.time).nome)} · ${ev.n}`;
    this.resultado("Novo<br>recorde!", quem, ev.time, 2800);
  },

  /* Telão do show do craque: o nome de quem mandou fica enquanto dura. */
  telao(ev, segundos) {
    const tl = this.$.telao;
    tl.style.cssText = this.cores(ev.time);
    tl.innerHTML = `<div class="topo">⭐ Show do craque</div><div class="nome">@${escapar(encurtar(ev.de, 16))}</div>`
      + `<div class="sub">bola blindada · truque atrás de truque</div>`;
    tl.hidden = false;
    clearTimeout(this._telao);
    this._telao = setTimeout(() => { tl.hidden = true; }, segundos * 1000);
  },

  esconderTelao() { this.$.telao.hidden = true; },

  trocarDica() {
    if (!this.dicas.length) return;
    const d = this.$.dica;
    d.classList.add("trocando");
    setTimeout(() => {
      this.iDica = (this.iDica + 1) % this.dicas.length;
      d.innerHTML = this.dicas[this.iDica];
      d.classList.remove("trocando");
    }, 400);
  },

  /* ───────── telas grandes ───────── */

  /* Ninguém comentou time ainda (`aguardando`) ou as bolas pararam
     esperando alguém (`ocioso`). */
  chamada(tipo, timesEmCampo = null) {
    const lista = timesEmCampo || this.cfg.times.map(t => t.id);
    const titulo = tipo === "ocioso" ? "Bola parada!" : "Comente seu time!";
    const texto = tipo === "ocioso"
      ? "Comente seu time pra entrar no jogo"
      : "Os dois times mais comentados entram na embaixadinha";
    this.$.chamada.innerHTML = `<h2>${titulo}</h2><p>${texto}</p>`
      + `<div class="times">${lista.map(id => `<span>${this.chip(id)}${escapar(this.time(id).sigla)}</span>`).join("")}</div>`;
    this.$.chamada.hidden = false;
    if (tipo === "aguardando") {
      this.dicas = ["Comente o <b>nome do seu time</b> pra começar", "Os <b>dois mais comentados</b> entram em campo"];
    } else {
      const [a, b] = lista.map(id => escapar(this.time(id).sigla));
      this.dicas = [`Comente <b>${a}</b> ou <b>${b}</b> e a bola volta a subir`];
    }
    this.iDica = -1;
    this.trocarDica();
  },

  esconderChamada() {
    if (this.$.chamada.hidden) return;
    this.$.chamada.hidden = true;
    if (this.a) this.classicoDicas();
  },

  ranking(partida, ev) {
    const v = this.time(ev.vencedor);
    const p = ev.perdedor;
    const pessoas = partida.rankingToques(5);
    const linhas = pessoas.length
      ? pessoas.map((x, i) => `<li><b class="n">${i + 1}</b>${this.chip(x.time)}<span class="nome">@${escapar(encurtar(x.nome, 18))}</span><span>⚽ ${x.toques}</span></li>`).join("")
      : `<li><b class="n">–</b><span></span><span class="nome">Ninguém tocou ainda</span><span></span></li>`;
    const times = partida.rankingTimes().slice(0, 3);
    this.$.ranking.innerHTML = `
      <h2>Fim da rodada</h2>
      <div class="campeao">${this.chip(ev.vencedor)}🏆 ${escapar(v.nome)} ${ev.melhor[ev.vencedor]} × ${ev.melhor[p]}</div>
      <h3>Quem mais tocou na bola</h3>
      <ol>${linhas}</ol>
      ${times.length ? `<h3>Vitórias</h3><ol>${times.map((x, i) => `<li><b class="n">${i + 1}</b>${this.chip(x.time)}<span class="nome">${escapar(this.time(x.time).nome)}</span><span>🏆 ${x.vitorias}</span></li>`).join("")}</ol>` : ""}
      <div class="proxima"></div>`;
    this.$.ranking.hidden = false;
    this.$.telao.hidden = true;
  },

  proxima(seg, desafiante, vencedor) {
    const p = this.$.ranking.querySelector(".proxima");
    if (!p) return;
    const quem = desafiante
      ? `<b>${escapar(this.time(vencedor).sigla)} × ${escapar(this.time(desafiante).sigla)}</b>`
      : "<b>revanche</b>";
    const texto = `Próximo clássico: ${quem} em <b>${Math.ceil(seg)}</b><br>Comente outro time pra desafiar`;
    if (p.innerHTML !== texto) p.innerHTML = texto;
  },

  esconderRanking() { this.$.ranking.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
