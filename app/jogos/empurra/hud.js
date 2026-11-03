/* O que fica por cima do estádio, em DOM: o tempo, quantos estão em pé e
   as 12 placas dos times no alto, as faixas de anúncio, o cartão de quem
   mandou presente, a festa do vencedor, o ranking da live entre as
   rodadas, o aviso de conector e a pausa.

   Texto grande é sempre numa linha só: a letra diminui até caber. */
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

/* Largura do texto em px do palco, sem a escala do palco nem a da
   animação de entrada (scrollWidth não vê o que vaza pra esquerda quando o
   texto é centralizado). */
function larguraDoTexto(e) {
  const r = document.createRange();
  r.selectNodeContents(e);
  const caixa = e.getBoundingClientRect().width;
  return caixa ? r.getBoundingClientRect().width * e.offsetWidth / caixa : e.scrollWidth;
}

/* Diminui a letra até o texto caber com folga na caixa (o próprio elemento
   ou, quando ele encolhe no texto, quem o contém): a entrada passa um pouco
   do tamanho final e não pode vazar da tela. */
function caber(e, minimo = 30, folga = 0.92, caixa = e) {
  e.style.fontSize = "";
  let tam = parseFloat(getComputedStyle(e).fontSize);
  const cabe = () => larguraDoTexto(e) <= caixa.clientWidth * folga && e.scrollWidth <= e.clientWidth + 1;
  while (!cabe() && tam > minimo) {
    tam -= 3;
    e.style.fontSize = `${tam}px`;
  }
}

const TAMANHO_CARTAO = [54, 74, 96, 118, 144];
const FAISCAS_CARTAO = [0, 8, 14, 22, 32];
const TEMPO_CARTAO = [1.9, 2.2, 2.6, 3.2, 3.8];

const Hud = {
  montar(palco, cfg) {
    const q = s => palco.querySelector(s);
    this.cfg = cfg;
    this.$ = {
      tempo: q(".topo .tempo"), vivos: q(".topo .vivos b"), times: q(".times"),
      faixa: q(".faixa"), cartao: q(".cartao"), vitoria: q(".vitoria"),
      ranking: q(".ranking"), sinal: q(".sem-sinal"),
    };
    this.chips = new Map();
    for (const t of cfg.times) {
      const branco = Texturas.clareza(t.cor) > 0.7;
      const c = el("span", "chip", t.sigla);
      c.style.setProperty("--cor", branco ? t.cor2 : t.cor);
      c.style.setProperty("--cor2", branco ? t.cor : t.cor2);
      c.style.setProperty("--letra", Texturas.clareza(branco ? t.cor2 : t.cor) > 0.6 ? "#070b1c" : "#ffffff");
      this.$.times.append(c);
      this.chips.set(t.id, c);
    }
    this.ultimoTempo = null;
    this.ultimosVivos = null;
    this._importancia = 0;
    this._ate = 0;
    this.fila = [];
    this.atual = null;
  },

  quadro(arena, dt) {
    const $ = this.$;
    const seg = arena.fase === "rodada" ? Math.ceil(arena.resta()) : arena.fase === "intervalo" ? arena.cfg.rodada.duracao : this.ultimoTempo;
    if (seg !== this.ultimoTempo) {
      this.ultimoTempo = seg;
      $.tempo.textContent = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
      $.tempo.classList.toggle("acabando", arena.fase === "rodada" && seg <= 10);
    }
    const vivos = arena.vivos().length;
    if (vivos !== this.ultimosVivos) {
      this.ultimosVivos = vivos;
      $.vivos.textContent = vivos;
    }
    for (const t of arena.times) {
      const c = this.chips.get(t.id);
      const fora = !t.vivo, perigo = !!t.beira;
      if (c._fora !== fora) { c._fora = fora; c.classList.toggle("fora", fora); }
      if (c._perigo !== perigo) { c._perigo = perigo; c.classList.toggle("perigo", perigo); }
    }
    this.passoCartao(dt);
  },

  piscarChip(id) {
    const c = this.chips.get(id);
    if (!c) return;
    c.classList.remove("pisca");
    void c.offsetWidth;
    c.classList.add("pisca");
  },

  /* Faixa grande no alto; a nova troca a anterior, menos quando é de
     menor importância e a de agora ainda está na tela. */
  anunciar(texto, cor = "ouro", seg = 2.4, importancia = 1) {
    const f = this.$.faixa;
    if (!this.$.vitoria.hidden) return;
    const agora = performance.now();
    if (importancia < this._importancia && agora < this._ate) return;
    this._importancia = importancia;
    this._ate = agora + seg * 1000;
    f.className = `faixa ${cor}`;
    f.textContent = texto;
    f.hidden = false;
    caber(f, 44);
    void f.offsetWidth;
    f.classList.add("entra");
    clearTimeout(this._faixa);
    this._faixa = setTimeout(() => { f.hidden = true; }, seg * 1000);
  },

  /* ───────── cartão do presente ───────── */

  /* Um cartão por vez, embaixo do círculo. Quem manda de novo troca o
     próprio; os outros esperam na fila, que apressa quem está na tela. */
  cartao(d) {
    if (this.atual && this.atual.id === d.id) {
      d.linhas = this.atual.seq === d.seq ? this.atual.linhas : [];
      this.mostrarCartao(d);
      return;
    }
    const naFila = this.fila.findIndex(x => x.id === d.id);
    if (naFila >= 0) this.fila[naFila] = d;
    else if (this.atual) {
      this.fila.push(d);
      if (this.fila.length > 4) {
        let menor = 0;
        this.fila.forEach((x, i) => { if (x.faixa < this.fila[menor].faixa) menor = i; });
        this.fila.splice(menor, 1);
      }
    } else this.mostrarCartao(d);
  },

  mostrarCartao(d) {
    const c = this.$.cartao;
    d.linhas = this.festa ? [] : d.linhas || [];
    d.resta = TEMPO_CARTAO[d.faixa];
    d.visto = 0;
    this.atual = d;
    c.className = `cartao n${d.faixa}`;
    c.style.setProperty("--cor", d.cor);
    c.style.setProperty("--cor2", d.cor2);
    c.style.fontSize = `${TAMANHO_CARTAO[d.faixa]}px`;
    c.innerHTML = "";
    const l1 = el("div", "l1");
    const vezes = d.quantidade > 1 ? `×${d.quantidade}` : "";
    /* Da 3ª faixa pra cima o ícone sai da pílula e cresce em cima dela. */
    if (d.faixa >= 2) {
      c.append(el("div", "selo", d.simbolo));
      if (vezes) l1.append(el("span", "icone", vezes));
    } else l1.append(el("span", "icone", d.simbolo + vezes));
    l1.append(el("b", null, `@${d.nome}`));
    c.append(l1);
    c.hidden = false;
    caber(l1, 34, 1);
    this.desenharLinhas();
    this.faiscas(c, FAISCAS_CARTAO[d.faixa]);
    void c.offsetWidth;
    c.classList.add("entra");
  },

  /* Estouro de faíscas em volta do @, mais quanto maior a faixa. */
  faiscas(c, n) {
    for (let i = 0; i < n; i++) {
      const f = el("i", "faisca");
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 2.2 + Math.random() * 2.6;
      f.style.setProperty("--dx", `${(Math.cos(ang) * dist * 1.6).toFixed(2)}em`);
      f.style.setProperty("--dy", `${(Math.sin(ang) * dist * 0.7).toFixed(2)}em`);
      f.style.animationDelay = `${(Math.random() * 0.25).toFixed(2)}s`;
      f.addEventListener("animationend", () => f.remove());
      c.append(f);
    }
  },

  desenharLinhas() {
    const c = this.$.cartao, d = this.atual;
    let l2 = c.querySelector(".l2");
    if (!d.linhas.length) { if (l2) l2.remove(); return; }
    if (!l2) { l2 = el("div", "l2"); c.append(l2); }
    const nomes = d.linhas;
    l2.textContent = nomes.length === 1 ? `derrubou o ${nomes[0]}` : nomes.length === 2 ? `derrubou ${nomes[0]} e ${nomes[1]}` : `derrubou ${nomes.length} times`;
    caber(l2, 26, 1);
    l2.classList.remove("bate");
    void l2.offsetWidth;
    l2.classList.add("bate");
  },

  /* Queda que saiu de um presente vira a 2ª linha do cartão dele. */
  derrubou(seq, nomeTime) {
    if (this.festa) return true;
    const d = this.atual && this.atual.seq === seq ? this.atual : this.fila.find(x => x.seq === seq);
    if (!d) return false;
    d.linhas = d.linhas || [];
    if (!d.linhas.includes(nomeTime)) d.linhas.push(nomeTime);
    if (d === this.atual) {
      d.resta = Math.max(d.resta, 1.6);
      this.desenharLinhas();
    }
    return true;
  },

  passoCartao(dt) {
    const d = this.atual;
    if (!d) return;
    d.visto += dt;
    d.resta -= dt * (this.fila.length && d.visto > 1.1 ? 2.2 : 1);
    if (d.resta > 0) return;
    this.atual = null;
    const c = this.$.cartao;
    c.classList.add("sai");
    const proximo = this.fila.shift();
    setTimeout(() => {
      if (this.atual) return;
      c.hidden = true;
    }, 260);
    if (proximo) setTimeout(() => { if (!this.atual) this.mostrarCartao(proximo); else this.fila.unshift(proximo); }, 280);
  },

  limparCartoes() {
    this.festa = false;
    this.fila = [];
    this.atual = null;
    this.$.cartao.hidden = true;
  },

  /* ───────── fim da rodada ───────── */

  vitoria(time, cor, cor2, ajudante) {
    const v = this.$.vitoria;
    this.festa = true;
    if (this.atual) { this.atual.linhas = []; this.desenharLinhas(); }
    for (const d of this.fila) d.linhas = [];
    /* Time de camisa escura (preto) escreve o nome na 2ª cor: preto com
       contorno escuro some na noite do estádio. */
    const escuro = Texturas.clareza(cor) < 0.2;
    v.style.setProperty("--cor", escuro ? cor2 : cor);
    v.style.setProperty("--cor2", escuro ? cor : cor2);
    v.innerHTML = "";
    clearTimeout(this._faixa);
    this.$.faixa.hidden = true;
    const nome = el("div", "nome", time.toUpperCase());
    const dono = el("div", "dono", "É O DONO DO CAMPO");
    v.append(nome, dono);
    if (ajudante) v.append(el("div", "ajudante", `👑 @${encurtar(ajudante, 16)}`));
    v.hidden = false;
    caber(nome, 60, 0.92, v);
    caber(dono, 40, 0.92, v);
    v.classList.remove("entra");
    void v.offsetWidth;
    v.classList.add("entra");
  },

  esconderVitoria() { this.$.vitoria.hidden = true; },

  ranking(arena, vencedor) {
    const r = this.$.ranking;
    const lista = arena.ranking();
    const cores = id => {
      const t = this.cfg.times.find(x => x.id === id);
      const branco = Texturas.clareza(t.cor) > 0.7;
      return `--cor:${branco ? t.cor2 : t.cor};--cor2:${branco ? t.cor : t.cor2}`;
    };
    r.innerHTML = `
      <h2>Ranking da live</h2>
      <ol>${lista.slice(0, 6).map((t, i) => `
        <li class="${t.id === vencedor ? "agora" : ""}" style="${cores(t.id)}">
          <b class="n">${i + 1}</b><span class="chip">${escapar(this.cfg.times.find(x => x.id === t.id).sigla)}</span>
          <span class="nome">${escapar(t.nome)}</span><span class="v">🏆 ${t.vitorias}</span>
        </li>`).join("")}</ol>
      <div class="proxima"></div>`;
    r.hidden = false;
    r.querySelectorAll(".nome").forEach(n => caber(n, 30, 1));
  },

  proxima(seg) {
    const p = this.$.ranking.querySelector(".proxima");
    if (p) p.innerHTML = `Todo mundo de volta ao círculo em <b>${Math.ceil(seg)}</b>`;
  },

  esconderRanking() { this.$.ranking.hidden = true; },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "conectando" ? "Procurando o conector da live…" : "Sem conector da live: tentando de novo";
  },
};
