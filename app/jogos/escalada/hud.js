/* Tudo que é texto na tela: placar de moedas, altura, as colunas dos times
   (comando, cardápio, top 3), anúncios e os avatares voando até o Zé.
   Animação guiada pelo relógio do jogo (Hud.quadro), não por CSS: pausa
   junto e grava quadro a quadro igual. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");
const fmtM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];
const NOMES_SURPRESA = { dobro: "60 s em dobro", chuva: "Chuva de coco", ventania: "Ventania chegando" };

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

/* Foto do TikTok com a inicial por baixo: se não carregar (link vencido,
   demo, mock), fica a inicial numa cor fixa da pessoa. */
function criarAvatar(quem) {
  const a = el("span", "avatar");
  const nome = String(quem.nome || "?").replace(/^[^a-z0-9]+/i, "");
  a.textContent = (nome[0] || "?").toUpperCase();
  a.style.background = CORES_AVATAR[hashTexto(quem.id || quem.nome) % CORES_AVATAR.length];
  if (quem.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = quem.foto;
  }
  return a;
}

function metros(m) { return `${fmtM.format(Math.abs(m) < 10 ? Math.round(m * 10) / 10 : Math.round(m))} m`; }

const Hud = {
  anims: [],
  fila: [],
  anuncioAtual: null,
  tempo: 0,
  lembrados: new Set(),
  ultimaEscolha: -Infinity,
  ultimaLembranca: -Infinity,

  montar(palco, config) {
    this.palco = palco;
    this.config = config;
    const $ = s => palco.querySelector(s);
    this.$ = $;
    const [ajuda, derruba] = config.times;
    this.seguro = !!config.modoSeguro;
    palco.classList.toggle("seguro", this.seguro);

    $(".placar").innerHTML = `
      <div class="lado l0"><span class="nome">${escapar(ajuda.nome)}</span><span class="moedas">0</span></div>
      <div class="barra"><i class="b0"></i><i class="b1"></i><span class="divisa"></span></div>
      <div class="lado l1"><span class="nome">${escapar(derruba.nome)}</span><span class="moedas">0</span></div>`;

    config.times.forEach((time, i) => {
      const col = $(`.coluna.c${i}`);
      col.style.setProperty("--time", time.cor);
      col.innerHTML = `
        <div class="cab">
          <h2>${escapar(time.nome)}</h2>
          <p class="comando">comente <b>${escapar(time.comandos[0])}</b><span>${this.seguro ? "" : "ou mande "}${escapar(time.presente.nome)}</span></p>
          <p class="torcida">0 na torcida</p>
        </div>
        <ol class="cardapio"></ol>
        <h3>${i === 0 ? "Quem mais ajudou" : "Quem mais derrubou"}</h3>
        <ol class="top"></ol>
        ${i === 1 ? '<p class="maior-queda" hidden></p>' : ""}`;
      const lista = col.querySelector(".cardapio");
      config.faixas.forEach((min, f) => {
        const li = el("li");
        const cv = document.createElement("canvas");
        cv.width = cv.height = 64;
        Desenho.icone(cv.getContext("2d"), i * 5 + f, time.cor);
        li.append(cv, el("span", "efeito", time.efeitos[f]), el("span", "preco", `${fmt.format(min)}+`));
        lista.append(li);
      });
    });
    this.tops = ["", ""];
    this.ultimos = [];

    /* Horizontal: as laterais embaixo das colunas viram recordes e últimos presentes. */
    $(".recordes").innerHTML = `
      <h3>Recordes</h3>
      <div class="rec r-live"><span class="rotulo">Mais alto da live</span><b>0 m</b></div>
      <div class="rec r-queda"><span class="rotulo">Maior queda</span><b>—</b><span class="quem"></span></div>
      <div class="rec r-sempre"><span class="rotulo">Mais alto de sempre</span><b>0 m</b></div>`;
    $(".ultimos").innerHTML = `<h3>${this.seguro ? "Últimos apoios" : "Últimos presentes"}</h3><ol></ol>`;
  },

  /* ───────────── placar e colunas ───────────── */

  /* Mesmo número, sem a palavra moeda no modo seguro. */
  valor(moedas) { return this.seguro ? `${fmt.format(moedas)} pts` : fmt.format(moedas); },

  placar(escalada, altVisivel, recordeDeSempre) {
    const $ = this.$;
    const [a, d] = escalada.moedas;
    $(".placar .l0 .moedas").textContent = fmt.format(a);
    $(".placar .l1 .moedas").textContent = fmt.format(d);
    const fa = a + d ? a / (a + d) : 0.5;
    $(".placar .b0").style.width = `${fa * 100}%`;
    $(".placar .b1").style.width = `${(1 - fa) * 100}%`;
    $(".placar .divisa").style.left = `${fa * 100}%`;

    $(".altura .num").textContent = fmt.format(Math.max(0, Math.floor(altVisivel)));
    const recorde = Math.max(escalada.recorde, 0);
    let sub = escalada.atolado > 0
      ? `<span class="atolado">Atolado na areia · ${this.config.times[0].nome} cava ${metros(escalada.atolado)}</span> · Tentativa ${escalada.tentativa}`
      : `Recorde da live <b>${fmt.format(Math.floor(recorde))} m</b> · Tentativa ${escalada.tentativa}`;
    if (recordeDeSempre > recorde + 1) sub += ` · de sempre ${fmt.format(Math.floor(recordeDeSempre))} m`;
    if ($(".sub").innerHTML !== sub) $(".sub").innerHTML = sub;

    const mq = escalada.maiorQueda;
    const chaveQueda = mq ? `${Math.floor(mq.metros)}|${mq.quem.id}` : "";
    if (chaveQueda !== this.chaveQueda) {
      this.chaveQueda = chaveQueda;
      const p = $(".maior-queda");
      p.hidden = !mq;
      if (mq) p.innerHTML = `Maior queda <b>${fmt.format(Math.floor(mq.metros))} m</b> · ${escapar(mq.quem.nome)}`;
      $(".r-queda b").textContent = mq ? `${fmt.format(Math.floor(mq.metros))} m` : "—";
      $(".r-queda .quem").textContent = mq ? mq.quem.nome : "";
    }
    $(".r-live b").textContent = `${fmt.format(Math.floor(recorde))} m`;
    $(".r-sempre b").textContent = `${fmt.format(Math.floor(Math.max(recorde, recordeDeSempre)))} m`;

    [0, 1].forEach(i => {
      const col = $(`.coluna.c${i}`);
      const n = escalada.torcida(i);
      col.querySelector(".torcida").textContent = `${fmt.format(n)} na torcida`;
      const top = escalada.top(i);
      const chave = top.map(t => `${t.id}:${t.moedas}`).join("|");
      if (chave === this.tops[i]) return;
      this.tops[i] = chave;
      const ol = col.querySelector(".top");
      ol.textContent = "";
      if (!top.length) {
        ol.append(el("li", "vazio", i === 0 ? "Ninguém ajudou ainda" : "Ninguém derrubou ainda"));
        return;
      }
      top.forEach((t, k) => {
        const li = el("li");
        li.append(el("span", "pos", String(k + 1)), criarAvatar(t), el("span", "nome", t.nome), el("span", "moedas", this.valor(t.moedas)));
        ol.append(li);
      });
    });
  },

  surpresa(evento, agora) {
    const s = this.$(".surpresa");
    if (!evento) { if (!s.hidden) s.hidden = true; return; }
    s.hidden = false;
    s.dataset.tipo = evento.tipo;
    const resta = Math.max(0, Math.ceil((evento.ate - agora) / 1000));
    const frac = Math.max(0, (evento.ate - agora) / (evento.segundos * 1000));
    let linha = "";
    if (evento.tipo === "dobro") linha = "todo presente vale o dobro";
    else if (evento.tipo === "chuva") linha = `comente <b>${escapar(this.config.times[0].comandos[0])}</b> ou <b>${escapar(this.config.times[1].comandos[0])}</b>: vale 5×`;
    else linha = `seguram com <b>${fmt.format(evento.meta)}</b> moedas de ajuda · ${fmt.format(Math.min(evento.segurado, evento.meta))}/${fmt.format(evento.meta)}`;
    const html = `<span class="titulo">${NOMES_SURPRESA[evento.tipo]}</span><span class="linha">${linha}</span><span class="resta">${resta}s</span><i style="width:${(evento.tipo === "ventania" ? Math.min(1, evento.segurado / evento.meta) : frac) * 100}%"></i>`;
    if (s.innerHTML !== html) s.innerHTML = html;
  },

  /* Presente de quem ainda não escolheu time: o nome e o comando ficam na
     tela até a pessoa comentar ou acabar a espera. */
  pendentes(escalada, agora) {
    const caixa = this.$(".pendentes");
    const lista = [...escalada.pendentes.values()].sort((a, b) => b.ate - a.ate).slice(0, 2);
    const chave = lista.map(p => `${p.quem.id}:${p.lote.length}`).join("|");
    if (chave !== this.chavePendentes) {
      this.chavePendentes = chave;
      caixa.textContent = "";
      const [ajuda, derruba] = this.config.times;
      for (const p of lista) {
        const total = p.lote.reduce((s, x) => s + x.total, 0);
        const card = el("div", `pendente${total >= (this.config.destaqueMoedas || Infinity) ? " grande" : ""}`);
        const linha = el("span", "linha");
        linha.innerHTML = `comente <i class="c0">${escapar(ajuda.comandos[0])}</i> ou <i class="c1">${escapar(derruba.comandos[0])}</i>`;
        card.append(criarAvatar(p.quem), el("span", "nome", p.quem.nome), el("span", "moedas", this.valor(total)), linha, el("span", "resta"), el("i", "barra"));
        card.dataset.id = p.quem.id;
        caixa.append(card);
      }
    }
    this.palco.classList.toggle("com-pendente", lista.length > 0);
    const espera = (this.config.regras.pendente || 1) * 1000;
    for (const card of caixa.children) {
      const p = escalada.pendentes.get(card.dataset.id);
      if (!p) continue;
      const resta = Math.max(0, p.ate - agora);
      const s = `${Math.ceil(resta / 1000)}s`;
      const r = card.querySelector(".resta");
      if (r.textContent !== s) r.textContent = s;
      card.querySelector(".barra").style.width = `${Math.min(1, resta / espera) * 100}%`;
    }
  },

  /* O aviso de conector só aparece depois de uns segundos sem sinal (o
     conector costuma subir depois do jogo e reconectar rápido), pequeno no
     canto de baixo, onde o TikTok põe os botões. */
  sinal(estado) {
    const s = this.$(".sem-sinal");
    const sem = estado === "desconectado" || estado === "conectando";
    clearTimeout(this.timerSinal);
    if (!sem) { s.hidden = true; return; }
    s.textContent = estado === "conectando" ? "procurando o conector" : "sem sinal do conector";
    this.timerSinal = setTimeout(() => { s.hidden = false; }, 5000);
  },

  /* ───────────── acontecimentos ───────────── */

  contar(lista) {
    const times = this.config.times;
    /* Recorde de queda que terminou na areia ou numa derrubada vira parte
       desse anúncio, em vez de um segundo anúncio logo depois. */
    const recordeQueda = lista.find(a => a.tipo === "recordeQueda");
    const fimDaQueda = lista.find(a => a.tipo === "areia" || a.tipo === "derrubada");
    for (const a of lista) {
      if (a === recordeQueda && fimDaQueda) continue;
      const time = times[a.time] || times[0];
      if (a.tipo === "presente") {
        const linha = `${a.time ? "−" : "+"}${metros(a.metros)}${this.seguro ? "" : ` · ${fmt.format(a.total)} moedas`}`;
        if (a.lendario) this.anunciar(6, "gigante lendario", a.time, a.quem, `${time.efeitos[a.faixa]} lendário!`, linha);
        else if (a.faixa >= 4) this.anunciar(4, "gigante", a.time, a.quem, `${time.efeitos[a.faixa]}!`, linha);
        else if (a.destaque) this.anunciar(2, "destaque", a.time, a.quem, time.efeitos[a.faixa], linha);
        else this.voar(a.quem, a.time, `${a.time ? "−" : "+"}${metros(a.metros)}`);
        this.registrarPresente(a);
        if (a.semTime && this.tempo - this.ultimaLembranca > 4) {
          this.ultimaLembranca = this.tempo;
          this.aviso(`${a.quem.nome}: sem time, foi pra ${times[0].nome}`);
        }
      } else if (a.tipo === "comando") {
        this.voar(a.quem, a.time, `${a.time ? "−" : "+"}${metros(a.metros)}`, true);
      } else if (a.tipo === "escolha") {
        /* Live cheia tem gente entrando em time o tempo todo: um aviso a
           cada 3 s basta pra mostrar que o comando funciona. */
        if (this.tempo - this.ultimaEscolha < 3) continue;
        this.ultimaEscolha = this.tempo;
        this.aviso(`${a.quem.nome} ${a.trocou ? "trocou pro" : "entrou no"} time ${times[a.time].nome.toUpperCase()}`, a.time);
      } else if (a.tipo === "seguiu" || a.tipo === "compartilhou") {
        this.aviso(`${a.quem.nome} ${a.tipo === "seguiu" ? "seguiu" : "compartilhou"} · +${metros(a.metros)}`, 0);
      } else if (a.tipo === "atolou") {
        if (!fimDaQueda) this.aviso(`${a.quem ? a.quem.nome + " atolou o Zé" : "Atolou"}: +${metros(a.metros)} de areia`, 1);
      } else if (a.tipo === "desatolou") {
        this.anunciar(3, "salvou", 0, a.quem, "Desatolou!", a.quem ? a.quem.nome : "subindo de novo");
      } else if (a.tipo === "salvou") {
        this.anunciar(3, "salvou", 0, a.quem, "Salvo por", a.quem.nome);
      } else if (a.tipo === "derrubada") {
        /* corda arrebentou (uma ou várias) sem chegar na areia: um anúncio só, com o tamanho da queda */
        const queda = fmt.format(Math.round(a.de - a.ate));
        if (a.quem && a.quem.vento) this.anunciar(3, "queda", 1, null, "A ventania derrubou", `caiu ${queda} m`);
        else if (recordeQueda) this.anunciar(5, "gloria", 1, a.quem, `Derrubou ${queda} m!`, `${a.quem.nome} · maior queda da live`);
        else this.anunciar(3, "queda", 1, a.quem, `Derrubou ${queda} m!`, a.quem ? a.quem.nome : "");
      } else if (a.tipo === "recordeQueda") {
        this.anunciar(5, "gloria", 1, a.quem, "Maior queda da live!", `${a.quem.nome} · ${fmt.format(Math.round(a.metros))} m`);
      } else if (a.tipo === "areia") {
        /* a glória do sabotador: o nome dele em tela cheia, com a altura de onde derrubou */
        const vento = a.quem && a.quem.vento;
        const de = Math.floor(a.de);
        if (!vento && de >= 20) this.anunciar(5, "areia", 1, a.quem, `Derrubou de ${fmt.format(de)} m!`, recordeQueda ? "maior queda da live!" : "mandou o Zé pra areia");
        else this.anunciar(5, "areia", 1, vento ? null : a.quem, "Caiu na areia!", `${vento ? "culpa do vento" : "último golpe de " + a.quem.nome} · chegou a ${fmt.format(Math.floor(a.maxima))} m`);
      } else if (a.tipo === "checkpoint") {
        const quem = a.quem ? `garantido por ${a.quem.nome}` : "subiu no embalo";
        this.anunciar(a.quem ? 2 : 1, "checkpoint", 0, a.quem, `Checkpoint ${fmt.format(a.altura)} m`, quem);
      } else if (a.tipo === "recorde") {
        this.anunciar(4, "recorde", 0, a.quem, "Novo recorde da live!", `passou de ${fmt.format(Math.floor(a.anterior))} m`);
      } else if (a.tipo === "surpresa") {
        const e = a.evento;
        const linha = e.tipo === "dobro" ? "todo presente vale o dobro" : e.tipo === "chuva" ? `comentar ${times[0].comandos[0]} ou ${times[1].comandos[0]} vale 5×` : `${fmt.format(this.config.surpresa.ventania.metros)} m de queda em ${e.segundos} s. Ajuda segura com ${fmt.format(e.meta)} moedas`;
        this.anunciar(4, "surpresa", e.tipo === "ventania" ? 1 : 0, null, NOMES_SURPRESA[e.tipo], linha);
      } else if (a.tipo === "segurou") {
        this.anunciar(3, "salvou", 0, a.quem, "Seguraram a ventania!", a.quem ? `a última foi de ${a.quem.nome}` : "");
      } else if (a.tipo === "ventou") {
        this.anunciar(3, "queda", 1, null, "Ventou!", `ninguém segurou: −${fmt.format(this.config.surpresa.ventania.metros)} m`);
      }
    }
  },

  /* Um anúncio por vez no meio da tela. Prioridade maior passa na frente
     e corta o atual; a fila guarda poucos pra não anunciar coisa velha. */
  anunciar(prioridade, tipo, time, quem, titulo, linha) {
    const item = { prioridade, tipo, time, quem, titulo, linha, chegou: this.tempo };
    const atual = this.anuncioAtual;
    if (atual && this.tempo - atual.inicio > (prioridade > atual.prioridade ? 0.5 : 1.4)) this.fecharAnuncio();
    this.fila.push(item);
    this.fila.sort((a, b) => b.prioridade - a.prioridade || a.chegou - b.chegou);
    if (this.fila.length > 3) this.fila.length = 3;
  },

  fecharAnuncio() {
    if (!this.anuncioAtual) return;
    this.anuncioAtual.el.remove();
    this.anuncioAtual = null;
  },

  mostrarProximo() {
    /* Notícia velha não serve: o que esperou mais de 4 s cai (menos queda
       na areia e recorde, que são o assunto da live). */
    this.fila = this.fila.filter(i => i.prioridade >= 4 || this.tempo - i.chegou < 4);
    const item = this.fila.shift();
    if (!item) return;
    const caixa = el("div", `anuncio ${item.tipo} t${item.time}`);
    caixa.style.setProperty("--time", this.config.times[item.time].cor);
    if (item.quem && !item.quem.vento) caixa.append(criarAvatar(item.quem));
    const txt = el("div", "txt");
    txt.append(el("span", "titulo", item.titulo));
    if (item.tipo === "destaque" || item.tipo.startsWith("gigante") || (item.tipo === "areia" && item.titulo.startsWith("Derrubou"))) {
      if (item.quem && !item.quem.vento) txt.prepend(el("span", "quem", item.quem.nome));
    }
    if (item.linha) txt.append(el("span", "linha", item.linha));
    caixa.append(txt);
    this.$(".anuncios").append(caixa);
    item.el = caixa;
    item.inicio = this.tempo;
    item.dur = item.prioridade >= 6 ? 5 : item.prioridade >= 4 ? 3.2 : 2.2;
    this.anuncioAtual = item;
  },

  /* Lista dos últimos presentes (painel lateral do horizontal). */
  registrarPresente(a) {
    const ol = this.$(".ultimos ol");
    const li = el("li", `t${a.time}`);
    li.style.setProperty("--time", this.config.times[a.time].cor);
    li.append(criarAvatar(a.quem), el("span", "nome", a.quem.nome), el("span", "efeito", this.config.times[a.time].efeitos[Math.max(0, a.faixa)]), el("span", "moedas", this.valor(a.total)));
    ol.prepend(li);
    while (ol.childElementCount > 5) ol.lastElementChild.remove();
  },

  voar(quem, time, texto, pequeno = false) {
    const voos = this.$(".voos");
    if (voos.childElementCount > 14) voos.firstElementChild.remove();
    const v = el("div", `voo t${time}${pequeno ? " pequeno" : ""}`);
    v.style.setProperty("--time", this.config.times[time].cor);
    v.append(criarAvatar(quem), el("span", "valor", texto));
    voos.append(v);
    const col = this.$(`.coluna.c${time}`);
    const origem = { x: col.offsetLeft + col.offsetWidth / 2, y: col.offsetTop + 120 + Math.random() * 160 };
    this.anims.push({ el: v, inicio: this.tempo, dur: pequeno ? 1.3 : 1.6, origem, deslize: (Math.random() - 0.5) * 60 });
  },

  aviso(texto, time = 0) {
    const caixa = this.$(".avisos");
    while (caixa.childElementCount >= 3) caixa.firstElementChild.remove();
    const a = el("div", `aviso t${time}`, texto);
    a.style.setProperty("--time", this.config.times[time].cor);
    caixa.append(a);
    this.anims.push({ el: a, inicio: this.tempo, dur: 4, aviso: true });
  },

  /* ───────────── quadro ───────────── */

  quadro(dt, alvo) {
    this.tempo += dt;
    const t = this.tempo;

    if (this.anuncioAtual) {
      const a = this.anuncioAtual;
      const p = (t - a.inicio) / a.dur;
      if (p >= 1) this.fecharAnuncio();
      else {
        const entra = Math.min(1, (t - a.inicio) / 0.28);
        const sai = Math.max(0, (p - 0.88) / 0.12);
        const escala = 0.6 + 0.4 * (1 - Math.pow(1 - entra, 3)) + (entra < 1 ? Math.sin(entra * Math.PI) * 0.08 : 0);
        a.el.style.opacity = String(Math.min(entra * 1.5, 1 - sai));
        a.el.style.transform = `translate(-50%, ${-sai * 40}px) scale(${escala.toFixed(3)})`;
      }
    }
    if (!this.anuncioAtual) this.mostrarProximo();

    this.anims = this.anims.filter(a => {
      const p = (t - a.inicio) / a.dur;
      if (p >= 1) { a.el.remove(); return false; }
      if (a.aviso) {
        const op = Math.min(1, p * 8, (1 - p) * 6);
        a.el.style.opacity = op.toFixed(3);
        a.el.style.transform = `translateY(${((1 - Math.min(1, p * 8)) * 20).toFixed(1)}px)`;
        return true;
      }
      const k = 1 - Math.pow(1 - Math.min(1, p / 0.75), 3);
      const x = a.origem.x + (alvo.x - a.origem.x) * k + Math.sin(k * Math.PI) * a.deslize;
      const y = a.origem.y + (alvo.y - 40 - a.origem.y) * k - Math.sin(k * Math.PI) * 120;
      const s = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25 * 0.6;
      a.el.style.opacity = String(p < 0.1 ? p * 10 : p > 0.8 ? (1 - p) * 5 : 1);
      a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      return true;
    });
  },
};
