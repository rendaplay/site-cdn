/* O que fica por cima do canvas, em DOM: placar, histórico das cobranças,
   pressão da torcida, cartão do batedor, filas, faixas do telão, cartões de
   presente, o grito do resultado, a abertura do clássico, a chamada quando
   ninguém comenta, o ranking entre as disputas e o aviso de conector. */
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
  brilho: "Bola brilhante", curva: "Chute com efeito", frango: "Frango do goleiro",
  fogo: "Chute de fogo", placa: "Gol de placa",
};
const SIMBOLO_EFEITO = { brilho: "✨", curva: "🌀", frango: "🐔", fogo: "🔥", placa: "🏆" };

const Hud = {
  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    this.times = new Map(cfg.times.map(t => [t.id, t]));
    const q = s => palco.querySelector(s);
    this.$ = {
      placar: q(".placar"), rotulo: q(".placar .rotulo"),
      lado: { a: q(".placar .lado.a"), b: q(".placar .lado.b") },
      hist: { a: q(".historico.a"), b: q(".historico.b") },
      pressao: { a: q(".pressao.a"), b: q(".pressao.b") },
      faixas: q(".faixas"), presentes: q(".presentes"), resultado: q(".resultado"),
      batedor: q(".batedor"), rodape: q(".rodape"),
      fila: { a: q(".fila.a"), b: q(".fila.b") },
      dica: q(".dica"), abertura: q(".abertura"), chamada: q(".chamada"), ranking: q(".ranking"),
      sinal: q(".sem-sinal"),
    };
    this.dicas = [];
    this.iDica = 0;
    setInterval(() => this.trocarDica(), 6500);
  },

  time(id) { return this.times.get(id) || { nome: "", sigla: "", cor: "#888", cor2: "#444" }; },

  cores(id) {
    const t = this.time(id);
    return `--c1:${t.cor};--c2:${t.cor2}`;
  },

  chip(id) { return `<span class="chip" style="${this.cores(id)}"></span>`; },

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
    this.$.fila.a.style.cssText = this.cores(a);
    this.$.fila.b.style.cssText = this.cores(b);
    this.$.placar.hidden = false;
    this.$.rodape.hidden = false;
    this.$.chamada.hidden = true;
    this.$.ranking.hidden = true;

    const ab = this.$.abertura;
    ab.innerHTML = `
      <div class="titulo">${revanche ? "Revanche!" : "Disputa de pênaltis"}</div>
      <div class="times">
        <div class="time">${this.chip(a)}${escapar(A.nome)}</div>
        <div class="x">×</div>
        <div class="time">${this.chip(b)}${escapar(B.nome)}</div>
      </div>
      <div class="sub">Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> pra entrar na fila e bater</div>`;
    ab.hidden = false;
    clearTimeout(this._abertura);
    this._abertura = setTimeout(() => { ab.hidden = true; }, (this.cfg.tempos.abertura - 0.3) * 1000);

    this.dicas = [
      `Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> pra bater o pênalti`,
      "Escreva <b>esquerda</b>, <b>direita</b> ou <b>meio</b> pra escolher o canto",
      "Curtidas enchem a <b>pressão da torcida</b> do seu time",
      "Comente <b>outro time</b> pra desafiar o vencedor",
      "<b>Alto</b> ou <b>baixo</b>? Você escolhe onde a bola vai",
    ];
    this.iDica = -1;
    this.trocarDica();
    this.zerarPlacar();
  },

  zerarPlacar() {
    for (const k of ["a", "b"]) {
      this.$.lado[k].querySelector(".gols").textContent = "0";
      this.$.hist[k].replaceChildren(...Array.from({ length: this.cfg.cobrancas }, () => el("li")));
      this.$.pressao[k].querySelector("i").style.width = "0%";
      this.$.pressao[k].classList.remove("cheia");
    }
    this.$.rotulo.textContent = "Disputa de pênaltis";
    this.$.rotulo.classList.remove("subita");
  },

  /* ───────── placar ───────── */

  placar(ev) {
    for (const [k, id] of [["a", this.a], ["b", this.b]]) {
      const g = this.$.lado[k].querySelector(".gols");
      const novo = String(ev.gols[id]);
      if (g.textContent !== novo) {
        g.textContent = novo;
        g.classList.remove("pulou");
        void g.offsetWidth;
        g.classList.add("pulou");
      }
      const hist = ev.historico[id];
      const ol = this.$.hist[k];
      const n = Math.max(this.cfg.cobrancas, hist.length);
      /* Na morte súbita a bolinha mais nova entra e a mais velha sai: cabe sempre. */
      const ini = Math.max(0, n - this.cfg.cobrancas);
      const itens = [];
      for (let i = ini; i < n; i++) {
        const li = el("li");
        if (i < hist.length) {
          li.className = hist[i] ? "gol" : "perdeu";
          li.textContent = hist[i] ? "✓" : "✕";
          if (i === hist.length - 1 && id === ev.time) li.classList.add("novo");
        }
        itens.push(li);
      }
      ol.replaceChildren(...itens);
    }
  },

  rotulo(texto, subita = false) {
    this.$.rotulo.textContent = texto;
    this.$.rotulo.classList.toggle("subita", subita);
  },

  pressao(valores) {
    for (const [k, id] of [["a", this.a], ["b", this.b]]) {
      const v = valores ? valores[id] || 0 : 0;
      const p = this.$.pressao[k];
      p.querySelector("i").style.width = `${Math.round(v * 100)}%`;
      p.classList.toggle("cheia", v >= 1);
    }
  },

  /* ───────── batedor ───────── */

  batedor(ev) {
    const t = this.time(ev.time);
    const b = ev.batedor;
    const box = this.$.batedor;
    box.style.cssText = this.cores(ev.time);
    box.querySelector(".cobranca").textContent = ev.morteSubita ? "Morte súbita" : `Cobrança ${ev.numeroCobranca}`;
    box.querySelector(".time").textContent = t.nome;
    const nome = b.bot ? b.nome : `@${encurtar(b.nome, 18)}`;
    box.querySelector(".nome").innerHTML = `<span class="num">${b.numero}</span>${escapar(nome)}`;
    const tags = [];
    if (ev.efeito) {
      tags.push(`<span class="tag forte">${SIMBOLO_EFEITO[ev.efeito.efeito]} ${NOME_EFEITO[ev.efeito.efeito]}`
        + `${ev.efeito.de ? ` · @${escapar(encurtar(ev.efeito.de, 14))}` : ""}</span>`);
    }
    if (b.craque) tags.push(`<span class="tag forte">⭐ Reforço</span>`);
    const canto = descreverCanto(b.canto);
    if (canto) tags.push(`<span class="tag">🎯 ${canto}</span>`);
    box.querySelector(".extra").innerHTML = tags.join("");
    box.hidden = false;
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";
  },

  /* O canto pedido no meio da preparação aparece no cartão na hora. */
  cantoPedido(canto) {
    const box = this.$.batedor;
    if (box.hidden) return;
    const extra = box.querySelector(".extra");
    extra.querySelectorAll(".tag.canto").forEach(e => e.remove());
    const texto = descreverCanto(canto);
    if (texto) extra.insertAdjacentHTML("beforeend", `<span class="tag canto">🎯 ${texto}</span>`);
  },

  esconderBatedor() { this.$.batedor.hidden = true; },

  /* ───────── filas ───────── */

  filas(jogo) {
    if (!jogo) return;
    for (const [k, id] of [["a", jogo.a], ["b", jogo.b]]) {
      const fila = jogo.filas[id];
      const caixa = this.$.fila[k];
      const t = this.time(id);
      caixa.querySelector("h3").innerHTML = `${escapar(t.sigla)} <small>${fila.length ? `${fila.length} na fila` : ""}</small>`;
      const ol = caixa.querySelector("ol");
      const assinatura = fila.slice(0, 3).map(x => x.id).join("|") + "#" + fila.length;
      if (ol.dataset.assinatura === assinatura) continue;
      ol.dataset.assinatura = assinatura;
      if (!fila.length) {
        ol.replaceChildren(el("li", "vazia", `Comente ${t.sigla} pra bater`));
        continue;
      }
      ol.replaceChildren(...fila.slice(0, 3).map(x => el("li", "", `@${encurtar(x.nome, 16)}`)));
    }
  },

  /* ───────── avisos ───────── */

  faixa(texto, cor = "") {
    const f = el("div", `faixa ${cor}`, texto);
    this.$.faixas.prepend(f);
    while (this.$.faixas.children.length > 2) this.$.faixas.lastChild.remove();
    setTimeout(() => f.remove(), 3300);
  },

  presente({ nome, simbolo, quantidade, efeito, time, desafiante }) {
    const c = el("div", `presente f${["brilho", "curva", "frango", "fogo", "placa"].indexOf(efeito)}`);
    c.style.cssText = this.cores(time);
    const t = this.time(time);
    const linha = desafiante
      ? `força pro ${escapar(t.sigla || t.nome)} entrar`
      : `${SIMBOLO_EFEITO[efeito] || ""} ${NOME_EFEITO[efeito] || ""}`;
    c.innerHTML = `<div class="simbolo">${simbolo}</div>`
      + `<div class="quem">@${escapar(encurtar(nome, 18))}${quantidade > 1 ? ` ×${quantidade}` : ""}</div>`
      + `<div class="efeito">${linha}</div>`;
    this.$.presentes.prepend(c);
    while (this.$.presentes.children.length > 3) this.$.presentes.lastChild.remove();
    setTimeout(() => c.remove(), 4300);
  },

  resultado(tipo, sub = "") {
    const textos = { gol: "Gol!", defesa: "Defendeu!", trave: "Na trave!", fora: "Pra fora!", frango: "Frango!", placa: "Golaço!" };
    const r = this.$.resultado;
    r.className = `resultado ${tipo === "frango" || tipo === "placa" ? "gol" : tipo}`;
    r.innerHTML = `${textos[tipo]}${sub ? `<small>${escapar(sub)}</small>` : ""}`;
    r.hidden = false;
    r.style.animation = "none";
    void r.offsetWidth;
    r.style.animation = "";
    clearTimeout(this._resultado);
    this._resultado = setTimeout(() => { r.hidden = true; }, 1900);
  },

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

  /* Ninguém comentou time ainda (`aguardando`) ou a disputa parou esperando
     alguém (`ocioso`). */
  chamada(tipo, timesEmCampo = null) {
    const lista = timesEmCampo || this.cfg.times.map(t => t.id);
    const titulo = tipo === "ocioso" ? "Quem bate agora?" : "Comente seu time!";
    const texto = tipo === "ocioso"
      ? "Comente o seu time pra bater o próximo pênalti"
      : "Os dois times mais comentados jogam a disputa de pênaltis";
    this.$.chamada.innerHTML = `<h2>${titulo}</h2><p>${texto}</p>`
      + `<div class="times">${lista.map(id => `<span>${this.chip(id)}${escapar(this.time(id).sigla)}</span>`).join("")}</div>`;
    this.$.chamada.hidden = false;
    if (tipo === "aguardando") {
      this.dicas = ["Comente o <b>nome do seu time</b> pra começar", "Os <b>dois mais comentados</b> fazem o clássico"];
      this.iDica = -1;
      this.trocarDica();
    }
  },

  esconderChamada() { this.$.chamada.hidden = true; },

  ranking(disputa, vencedor, gols) {
    const v = this.time(vencedor);
    const perdedor = vencedor === this.a ? this.b : this.a;
    const art = disputa.rankingArtilheiros(5);
    const linhasArt = art.length
      ? art.map((x, i) => `<li><b class="n">${i + 1}</b>${this.chip(x.time)}<span class="nome">@${escapar(encurtar(x.nome, 18))}</span><span>⚽ ${x.gols}</span></li>`).join("")
      : `<li><b class="n">–</b><span></span><span class="nome">Ninguém marcou ainda</span><span></span></li>`;
    const times = disputa.rankingTimes().slice(0, 3);
    this.$.ranking.innerHTML = `
      <h2>Fim de disputa</h2>
      <div class="campeao">${this.chip(vencedor)}🏆 ${escapar(v.nome)} ${gols[vencedor]} × ${gols[perdedor]}</div>
      <h3>Artilheiros da live</h3>
      <ol>${linhasArt}</ol>
      ${times.length ? `<h3>Vitórias</h3><ol>${times.map((x, i) => `<li><b class="n">${i + 1}</b>${this.chip(x.time)}<span class="nome">${escapar(this.time(x.time).nome)}</span><span>🏆 ${x.vitorias}</span></li>`).join("")}</ol>` : ""}
      <div class="proxima"></div>`;
    this.$.ranking.hidden = false;
    this.esconderBatedor();
  },

  proxima(seg, desafiante, vencedor) {
    const p = this.$.ranking.querySelector(".proxima");
    if (!p) return;
    const quem = desafiante
      ? `<b>${escapar(this.time(vencedor).sigla)} × ${escapar(this.time(desafiante).sigla)}</b>`
      : "<b>revanche</b>";
    p.innerHTML = `Próximo clássico: ${quem} em <b>${Math.ceil(seg)}</b><br>Comente outro time pra desafiar`;
  },

  esconderRanking() { this.$.ranking.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};

function descreverCanto(canto) {
  if (!canto) return "";
  if (canto.cavadinha) return "Cavadinha";
  const col = canto.col == null ? "" : ["Esquerda", "Meio", "Direita"][canto.col + 1];
  const lin = canto.lin == null ? "" : canto.lin ? "alto" : "baixo";
  const texto = [col, lin].filter(Boolean).join(" ");
  return texto ? texto[0].toUpperCase() + texto.slice(1) : "";
}
