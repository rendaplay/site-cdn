/* O que fica por cima do canvas, em DOM: placar com o relógio, pressão da
   torcida, o @ em cima de cada boneco, faixas do telão, cartões de presente,
   o "GOL DE @fulano", o telão da chuva, a abertura do clássico, a chamada
   quando ninguém comenta, o ranking entre as partidas e o aviso de conector. */
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

function luminancia(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
}

const NOME_EFEITO = {
  brilho: "Bola brilhante", canhao: "Canhão", gelo: "Gelo no goleiro", fogo: "Bola de fogo", chuva: "Chuva de bolas",
};
const SIMBOLO_EFEITO = { brilho: "✨", canhao: "💣", gelo: "🧊", fogo: "🔥", chuva: "🌧️" };
const SIMBOLO_FORMA = { estrela: "⭐", coracao: "💖", raio: "⚡" };

const Hud = {
  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    this.times = new Map(cfg.times.map(t => [t.id, t]));
    const q = s => palco.querySelector(s);
    this.$ = {
      placar: q(".placar"), rotulo: q(".placar .rotulo"), relogio: q(".placar .relogio"),
      lado: { a: q(".placar .lado.a"), b: q(".placar .lado.b") },
      pressao: { a: q(".pressao.a"), b: q(".pressao.b") },
      pronto: { a: q(".pronto.a"), b: q(".pronto.b") },
      rotulos: q(".rotulos"), faixas: q(".faixas"), presentes: q(".presentes"), resultado: q(".resultado"),
      telao: q(".telao"), dica: q(".dica"), abertura: q(".abertura"), chamada: q(".chamada"), ranking: q(".ranking"),
      sinal: q(".sem-sinal"),
    };
    this.etiquetas = [];
    this.posicoes = [];
    this.dicas = [];
    this.iDica = 0;
    setInterval(() => this.trocarDica(), 6500);
  },

  time(id) { return this.times.get(id) || { nome: "", sigla: "", cor: "#888", cor2: "#444" }; },

  cores(id) {
    const t = (this.kits && this.kits.get(id)) || this.time(id);
    const claro = luminancia(t.cor) > 0.6;
    return `--c1:${t.cor};--c2:${t.cor2};--tx:${claro ? "#111" : "#fff"};--bd:${claro ? "#111" : "#fff"}`;
  },

  chip(id) { return `<span class="chip" style="${this.cores(id)}"></span>`; },

  /* ───────── clássico ───────── */

  classico(a, b, { revanche = false } = {}) {
    this.a = a;
    this.b = b;
    const A = this.time(a), B = this.time(b);
    /* Rótulo do boneco na cor da camisa em campo, que pode ser a reserva. */
    const [kA, kB] = uniformes(A, B);
    this.kits = new Map([[a, kA], [b, kB]]);
    const s = this.palco.style;
    s.setProperty("--a1", A.cor); s.setProperty("--a2", A.cor2);
    s.setProperty("--b1", B.cor); s.setProperty("--b2", B.cor2);
    this.$.lado.a.querySelector(".sigla").textContent = A.sigla;
    this.$.lado.b.querySelector(".sigla").textContent = B.sigla;
    this.$.placar.hidden = false;
    this.$.chamada.hidden = true;
    this.$.ranking.hidden = true;
    this.$.telao.hidden = true;

    const ab = this.$.abertura;
    ab.innerHTML = `
      <div class="titulo">${revanche ? "Revanche!" : "Pebolim Gigante"}</div>
      <div class="times">
        <div class="time">${this.chip(a)}${escapar(A.nome)}</div>
        <div class="x">×</div>
        <div class="time">${this.chip(b)}${escapar(B.nome)}</div>
      </div>
      <div class="sub">Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> e vire um boneco em campo</div>`;
    ab.hidden = false;
    clearTimeout(this._abertura);
    this._abertura = setTimeout(() => { ab.hidden = true; }, (this.cfg.tempos.abertura - 0.3) * 1000);

    this.dicas = [
      `Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> pra entrar em campo`,
      "Escreva <b>chuta</b> ou <b>bomba</b> e o seu boneco solta a bomba",
      "Curtidas enchem a <b>pressão</b>: cheia, o time entra no turbo",
      "Fez o gol? Seu <b>@</b> vai pro ranking da live",
      "Comente <b>outro time</b> pra desafiar o vencedor",
    ];
    this.iDica = -1;
    this.trocarDica();
    this.zerarPlacar();
    for (const e of this.etiquetas) e.dataset.chave = "";
  },

  zerarPlacar() {
    for (const k of ["a", "b"]) {
      this.$.lado[k].querySelector(".gols").textContent = "0";
      this.$.pressao[k].querySelector("i").style.width = "0%";
      this.$.pressao[k].classList.remove("cheia", "turbo");
      this.$.pronto[k].hidden = true;
    }
    this.rotulo("");
  },

  /* ───────── placar ───────── */

  gols(gols) {
    for (const [k, id] of [["a", this.a], ["b", this.b]]) {
      const g = this.$.lado[k].querySelector(".gols");
      const novo = String(gols[id]);
      if (g.textContent === novo) continue;
      g.textContent = novo;
      g.classList.remove("pulou");
      void g.offsetWidth;
      g.classList.add("pulou");
    }
  },

  rotulo(texto, ouro = false) {
    this.$.rotulo.textContent = texto;
    this.$.placar.classList.toggle("ouro", ouro);
  },

  /* Pressão, turbo, relógio e o efeito pronto de cada time, todo quadro. */
  atualizar(jogo, fase, t) {
    if (!jogo) return;
    const seg = Math.ceil(jogo.relogio);
    const relogio = jogo.ouro ? "OURO" : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
    if (this.$.relogio.textContent !== relogio) this.$.relogio.textContent = relogio;
    this.$.relogio.classList.toggle("acabando", !jogo.ouro && seg <= 10 && fase === "jogo");
    const rotulo = jogo.ouro ? "Gol de ouro" : fase === "pausa" ? "Parado" : `Vale ${this.cfg.gols} gols`;
    if (this.$.rotulo.textContent !== rotulo) this.rotulo(rotulo, jogo.ouro);
    for (const [k, id] of [["a", jogo.a], ["b", jogo.b]]) {
      const p = this.$.pressao[k];
      const turbo = jogo.turbo[id] > t;
      const v = turbo ? Math.max(0, (jogo.turbo[id] - t) / this.cfg.turbo) : jogo.pressao[id];
      p.querySelector("i").style.width = `${Math.round(v * 100)}%`;
      p.classList.toggle("turbo", turbo);
      p.querySelector("span").textContent = turbo ? "TURBO!" : "PRESSÃO";
      const e = jogo.especial[id];
      const pronto = this.$.pronto[k];
      const chave = e ? `${e.efeito}|${e.de}` : "";
      if (pronto.dataset.chave !== chave) {
        pronto.dataset.chave = chave;
        pronto.hidden = !e;
        if (e) {
          const simbolo = e.efeito === "brilho" ? SIMBOLO_FORMA[e.forma] || "✨" : SIMBOLO_EFEITO[e.efeito];
          pronto.innerHTML = `${simbolo} <b>${NOME_EFEITO[e.efeito]}</b> <span>@${escapar(encurtar(e.de, 12))}</span>`;
        }
      }
    }
  },

  /* ───────── @ em cima dos bonecos ───────── */

  /* `pos` vem da cena (px do palco); `jogo.bonecos` diz quem é o dono. */
  donos(pos, jogo, fase) {
    const camada = this.$.rotulos;
    const mostrar = jogo && fase !== "fim" && fase !== "intervalo";
    camada.hidden = !mostrar;
    if (!mostrar) return;
    while (this.etiquetas.length < pos.length) {
      const e = el("div", "dono");
      camada.appendChild(e);
      this.etiquetas.push(e);
    }
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i], e = this.etiquetas[i];
      const time = jogo.lado[p.lado];
      const b = jogo.bonecos[time][p.lugar];
      const dono = b.dono;
      const chave = `${time}|${dono ? dono.id : ""}|${b.craque ? 1 : 0}|${b.gols}`;
      if (e.dataset.chave !== chave) {
        const novo = dono && !(e.dataset.chave || "").startsWith(`${time}|${dono.id}|`);
        e.dataset.chave = chave;
        e.className = `dono ${p.lado}${dono ? " tem" : ""}${b.craque ? " craque" : ""}`;
        e.style.cssText = this.cores(time);
        e.innerHTML = dono
          ? `<span>${b.craque ? "⭐ " : ""}@${escapar(encurtar(dono.nome, 11))}${b.gols ? ` <i>⚽${b.gols > 1 ? b.gols : ""}</i>` : ""}</span>`
          : `<span>${b.numero}</span>`;
        if (novo) {
          e.classList.add("pop");
          setTimeout(() => e.classList.remove("pop"), 700);
        }
      }
      /* No fundo da mesa os bonecos ficam colados: o @ diminui com a distância
         e os meias se revezam de altura, senão um nome tapa o outro. */
      const escala = Math.min(1, Math.max(0.62, 0.2 + 1.1 * p.perto));
      const sobe = p.lugar === 4 || p.lugar === 6 ? 46 * escala : 0;
      e.style.transform = `translate(${p.x.toFixed(1)}px, ${(p.y - sobe).toFixed(1)}px) scale(${escala.toFixed(3)})`;
      e.style.zIndex = String(Math.round((1 - p.prof) * 10000));
    }
  },

  /* ───────── avisos ───────── */

  faixa(texto, cor = "") {
    const f = el("div", `faixa ${cor}`, texto);
    this.$.faixas.prepend(f);
    while (this.$.faixas.children.length > 2) this.$.faixas.lastChild.remove();
    setTimeout(() => f.remove(), 3300);
  },

  presente({ nome, simbolo, quantidade, efeito, forma, time, desafiante, semTime }) {
    const c = el("div", `presente f${["brilho", "canhao", "gelo", "fogo", "chuva"].indexOf(efeito)}`);
    c.style.cssText = this.cores(time);
    const t = this.time(time);
    const icone = efeito === "brilho" ? SIMBOLO_FORMA[forma] || "✨" : SIMBOLO_EFEITO[efeito] || "";
    const linha = desafiante
      ? `força pro ${escapar(t.sigla || t.nome)} entrar`
      : `${icone} ${NOME_EFEITO[efeito] || ""}${semTime ? ` · ${escapar(t.sigla)}` : ""}`;
    c.innerHTML = `<div class="simbolo">${simbolo}</div>`
      + `<div class="quem">@${escapar(encurtar(nome, 18))}${quantidade > 1 ? ` ×${quantidade}` : ""}</div>`
      + `<div class="efeito">${linha}</div>`;
    this.$.presentes.prepend(c);
    while (this.$.presentes.children.length > 2) this.$.presentes.lastChild.remove();
    setTimeout(() => c.remove(), 4300);
  },

  /* GOL DE @fulano; sem dono, o gol é do time com o número da camisa. */
  gol(ev) {
    const t = this.time(ev.time);
    const r = this.$.resultado;
    const quem = ev.autor ? `de @${escapar(encurtar(ev.autor.nome, 14))}` : `do ${escapar(t.nome)}`;
    const extra = ev.ouro ? "Gol de ouro!" : ev.efeito === "fogo" ? "Bola de fogo!" : ev.efeito === "canhao" ? "De canhão!" : ev.desvio ? "Desviou!" : "";
    r.className = `resultado gol${ev.chuva ? " pequeno" : ""}`;
    r.style.cssText = this.cores(ev.time);
    r.innerHTML = `Gol!<small>${quem}</small>${extra ? `<em>${extra}</em>` : ""}`;
    r.hidden = false;
    r.style.animation = "none";
    void r.offsetWidth;
    r.style.animation = "";
    clearTimeout(this._resultado);
    this._resultado = setTimeout(() => { r.hidden = true; }, ev.chuva ? 1300 : 2300);
  },

  /* Telão da chuva de bolas: o nome de quem mandou fica enquanto chove. */
  telao(ev, segundos) {
    const tl = this.$.telao;
    tl.style.cssText = this.cores(ev.time);
    tl.innerHTML = `<div class="topo">🌧️ Chuva de bolas</div><div class="nome">@${escapar(encurtar(ev.de, 16))}</div>`
      + `<div class="sub">todo gol vale · goleiro paredão</div>`;
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

  /* Ninguém comentou time ainda (`aguardando`) ou a partida parou esperando
     alguém (`ocioso`). */
  chamada(tipo, timesEmCampo = null) {
    const lista = timesEmCampo || this.cfg.times.map(t => t.id);
    const titulo = tipo === "ocioso" ? "Bola parada!" : "Comente seu time!";
    const texto = tipo === "ocioso"
      ? "Comente seu time pra entrar em campo"
      : "Os dois times mais comentados entram na mesa";
    this.$.chamada.innerHTML = `<h2>${titulo}</h2><p>${texto}</p>`
      + `<div class="times">${lista.map(id => `<span>${this.chip(id)}${escapar(this.time(id).sigla)}</span>`).join("")}</div>`;
    this.$.chamada.hidden = false;
    if (tipo === "aguardando") {
      this.dicas = ["Comente o <b>nome do seu time</b> pra começar", "Os <b>dois mais comentados</b> fazem o clássico"];
    } else {
      const [a, b] = lista.map(id => escapar(this.time(id).sigla));
      this.dicas = [`Comente <b>${a}</b> ou <b>${b}</b> pra entrar em campo`];
    }
    this.iDica = -1;
    this.trocarDica();
  },

  esconderChamada() {
    if (this.$.chamada.hidden) return;
    this.$.chamada.hidden = true;
    if (this.a) this.classicoDicas();
  },

  classicoDicas() {
    const A = this.time(this.a), B = this.time(this.b);
    this.dicas = [
      `Comente <b>${escapar(A.sigla)}</b> ou <b>${escapar(B.sigla)}</b> pra entrar em campo`,
      "Escreva <b>chuta</b> ou <b>bomba</b> e o seu boneco solta a bomba",
      "Curtidas enchem a <b>pressão</b>: cheia, o time entra no turbo",
      "Comente <b>outro time</b> pra desafiar o vencedor",
    ];
    this.iDica = -1;
    this.trocarDica();
  },

  ranking(partida, vencedor, gols) {
    const v = this.time(vencedor);
    const perdedor = vencedor === this.a ? this.b : this.a;
    const art = partida.rankingArtilheiros(5);
    const linhasArt = art.length
      ? art.map((x, i) => `<li><b class="n">${i + 1}</b>${this.chip(x.time)}<span class="nome">@${escapar(encurtar(x.nome, 18))}</span><span>⚽ ${x.gols}</span></li>`).join("")
      : `<li><b class="n">–</b><span></span><span class="nome">Ninguém marcou ainda</span><span></span></li>`;
    const times = partida.rankingTimes().slice(0, 3);
    this.$.ranking.innerHTML = `
      <h2>Fim de jogo</h2>
      <div class="campeao">${this.chip(vencedor)}🏆 ${escapar(v.nome)} ${gols[vencedor]} × ${gols[perdedor]}</div>
      <h3>Artilheiros da live</h3>
      <ol>${linhasArt}</ol>
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
