/* Tudo que é DOM por cima da cena: placar, barra de progresso com os
   rostos, bolhas de quem apoiou, faixas grandes, 3-2-1, foto finish e
   pódio. Nunca mostra valor de presente: só quem fez o quê. */
"use strict";

const BOLHAS_MAX = 7;
const TEXTO_EFEITO = { impulso: "IMPULSO!", nitro: "NITRO!", banana: "CASCA!", jato: "JATO!" };
const ICONE_EFEITO = { impulso: "⚡", nitro: "🔥", banana: "🍌", jato: "🚀" };
const NOME_EFEITO = { impulso: "impulso", nitro: "nitro", banana: "casca no rival", jato: "jato" };

const Hud = {
  montar(palco, candidatos, config) {
    this.palco = palco;
    this.candidatos = candidatos;
    this.config = config;
    this.$ = s => palco.querySelector(s);
    this.seguro = config.modoSeguro !== false;
    palco.classList.toggle("seguro", this.seguro);
    this.trilho = this.$(".trilho");
    this.raias = [this.$(".raia-a"), this.$(".raia-b")].map(r => ({ cheio: r.querySelector(".cheio"), rosto: r.querySelector(".rosto") }));
    this.falta = this.$(".falta");
    this.relogio = this.$(".relogio");
    this.rotulo = this.$(".meio .rotulo");
    this.bolhas = [];
    this.faixaLivre = 0;
    this.faixasPendentes = new Set();
    this.ultimoTexto = { falta: "", relogio: "" };

    const [a, b] = candidatos;
    this.$(".time-a .num").textContent = a.numero;
    this.$(".time-b .num").textContent = b.numero;
    this.$(".chaves").innerHTML = candidatos.map((c, i) => `
      <div class="chave chave-${"ab"[i]}">
        <i class="chave-icone">${iconeDoPresente(c.presente)}</i>
        <span class="chave-texto"><span>apoie o <b>${c.numero}</b></span></span>
      </div>`).join("")
      + `<div class="chave-comente">${this.seguro ? "comente" : "ou comente"} <b class="ca">${a.numero}</b> ou <b class="cb">${b.numero}</b> no chat para participar</div>`;
    this.medir();
  },

  medir() {
    this.largura = this.trilho.offsetWidth || 1;
    this.W = this.palco.offsetWidth || 1080;
    /* bolha não sobe por cima do placar nem do cardápio */
    const chaves = this.$(".chaves");
    this.topoBolhas = chaves.offsetTop + chaves.offsetHeight + 110;
  },

  cabecas() {
    for (let l = 0; l < 2; l++) {
      const cr = Cena.corredores[l];
      const cv = this.raias[l].rosto;
      const c = cv.getContext("2d");
      c.clearRect(0, 0, cv.width, cv.height);
      if (!cr || !cr.cabeca) continue;
      const img = cr.cabeca.canvas;
      const k = Math.min(cv.width / img.width, cv.height / img.height);
      c.drawImage(img, (cv.width - img.width * k) / 2, cv.height - img.height * k, img.width * k, img.height * k);
    }
  },

  placar(corrida) {
    this.$(".time-a .vitorias").textContent = corrida.serie[0];
    this.$(".time-b .vitorias").textContent = corrida.serie[1];
    this.rotulo.textContent = `Corrida ${corrida.numero}`;
  },

  /* Por quadro: só transform e texto que mudou, pra não recalcular layout. */
  quadro(dt, corrida, fase) {
    const pista = corrida.config.pista;
    for (let l = 0; l < 2; l++) {
      const f = Math.min(1, (Cena.vis[l] || 0) / pista);
      const r = this.raias[l];
      r.cheio.style.transform = `scaleX(${f})`;
      r.rosto.style.transform = `translate(${f * this.largura - 32}px, -50%)`;
    }
    const lider = Math.max(corrida.pos[0], corrida.pos[1]);
    const falta = fase === "largada" ? `<b>${pista}</b> m` : `faltam <b>${Math.max(0, Math.ceil(pista - lider))}</b> m`;
    if (falta !== this.ultimoTexto.falta) this.falta.innerHTML = this.ultimoTexto.falta = falta;
    const s = Math.floor(corrida.tempo);
    const rel = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (rel !== this.ultimoTexto.relogio) this.relogio.textContent = this.ultimoTexto.relogio = rel;

    for (let i = this.bolhas.length - 1; i >= 0; i--) {
      const b = this.bolhas[i];
      b.t += dt;
      if (b.t > b.dur) { b.el.remove(); this.bolhas.splice(i, 1); continue; }
      const p = Cena.telaDo(b.lado);
      /* acima da etiqueta "−N m" de quem ficou pra trás */
      const sobe = (p.longe ? 120 : 40) + b.t * 70 + b.fila * 74;
      const a = b.t < 0.18 ? b.t / 0.18 : b.t > b.dur - 0.4 ? (b.dur - b.t) / 0.4 : 1;
      const esc = b.t < 0.18 ? 0.6 + 0.4 * (b.t / 0.18) : 1;
      const x = Math.min(this.W - b.meia, Math.max(b.meia, p.x + b.dx));
      const y = Math.max(this.topoBolhas, p.y - sobe);
      b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${esc})`;
      b.el.style.opacity = a;
    }
  },

  contar(lista, corrida) {
    for (const a of lista) {
      if (a.tipo === "efeito") {
        if (a.fonte && a.fonte !== "presente") { if (a.fonte === "seguiu") this.bolha(a.lado, a.quem, "SEGUIU!"); continue; }
        this.bolha(a.lado, a.quem, TEXTO_EFEITO[a.efeito] || "!", a.efeito !== "impulso");
        if (a.efeito === "banana") this.emSeguida(() => this.faixa("🍌 Casca!", `${a.quem.nick} derrubou ${this.candidatos[a.alvo].nome}`, a.lado), 2200);
        if (a.efeito === "jato") this.emSeguida(() => this.faixa("🚀 Jato!", `${a.quem.nick} ligou o jato de ${this.candidatos[a.lado].nome}`, a.lado), 2200);
      } else if (a.tipo === "ultrapassagem") this.emSeguida(() => this.faixa("Passou!", `${this.candidatos[a.lado].nome} assumiu a ponta`, a.lado), 2200);
      else if (a.tipo === "retaFinal") this.emSeguida(() => this.faixa("Reta final", `faltam ${Math.ceil(corrida.config.pista * (1 - corrida.config.retaFinal))} m`, -1), 2200);
      else if (a.tipo === "encostou") this.aviso(`<b>${escapar(this.candidatos[a.lado].nome)}</b> encostou!`);
      else if (a.tipo === "pendente") this.aviso(`<b>${escapar(a.quem.nick)}</b>, comente <b class="ca">${this.candidatos[0].numero}</b> ou <b class="cb">${this.candidatos[1].numero}</b>`);
      else if (a.tipo === "comentouPresente") this.aviso(`<b>${escapar(a.quem.nick)}</b> corre com o <b>${this.candidatos[a.lado].numero}</b>`);
    }
  },

  bolha(lado, quem, oQue, grande = false) {
    if (this.bolhas.length >= BOLHAS_MAX) { const velha = this.bolhas.shift(); velha.el.remove(); }
    const el = document.createElement("div");
    el.className = `bolha ${"ab"[lado]}${grande ? " grande" : ""}`;
    el.innerHTML = `${avatar(quem)}<span class="nick">${escapar(quem.nick)}</span><span class="o-que">${oQue}</span>`;
    this.$(".bolhas").append(el);
    /* bolhas do mesmo lado empilham em vez de cobrir uma a outra */
    const fila = this.bolhas.filter(b => b.lado === lado && b.t < 0.9).length % 3;
    this.bolhas.push({ el, lado, t: 0, dur: 2.2, dx: (Math.random() - 0.5) * 90, fila, meia: el.offsetWidth / 2 + 16 });
  },

  aviso(html) {
    const caixa = this.$(".avisos");
    if (caixa.childElementCount >= 2) caixa.firstElementChild.remove();
    const el = document.createElement("div");
    el.className = "aviso";
    el.innerHTML = html;
    caixa.append(el);
    setTimeout(() => el.remove(), 3300);
  },

  /* Uma faixa grande por vez; fila longa demais é descartada. */
  emSeguida(mostrar, ms) {
    const agora = performance.now();
    const inicio = Math.max(agora, this.faixaLivre);
    if (inicio - agora > 4500) return;
    this.faixaLivre = inicio + ms;
    const id = setTimeout(() => { this.faixasPendentes.delete(id); mostrar(); }, inicio - agora);
    this.faixasPendentes.add(id);
  },

  /* Troca de fase: faixa atrasada da corrida não aparece por cima da foto ou do pódio. */
  cancelarFaixas() {
    for (const id of this.faixasPendentes) clearTimeout(id);
    this.faixasPendentes.clear();
    this.faixaLivre = 0;
    this.$(".faixa").classList.remove("on");
  },

  faixa(txt, sub, lado) {
    const el = this.$(".faixa");
    const cor = lado >= 0 ? this.candidatos[lado].cor : "#14121C";
    el.style.setProperty("--cor", cor);
    el.innerHTML = `<div class="txt">${escapar(txt)}</div>${sub ? `<div class="sub">${escapar(sub)}</div>` : ""}`;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  },

  contagem(txt) {
    const el = this.$(".contagem");
    el.textContent = txt;
    el.classList.toggle("ja", !/^\d$/.test(txt));
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  },

  /* Cada efeito com os presentes que o disparam: o que o streamer escolheu
     no ⚙ ou, sem escolha, o preço. As rosas das chaves ficam de fora. */
  legenda(faixas, faixaDe) {
    const ordem = [...faixas].sort((x, y) => x.de - y.de);
    const daChave = new Set(this.candidatos.flatMap(c => c.presente.aceitos));
    const icones = ordem.map(() => []);
    for (const p of PRESENTES_TIKTOK) {
      if (daChave.has(p.api)) continue;
      const escolhida = faixaDe(p.api, p.moedas);
      const i = escolhida ?? Math.max(0, ordem.findLastIndex(f => p.moedas >= f.de));
      if (icones[i] && icones[i].length < 2) icones[i].push(p.icone);
    }
    const html = ordem.map((f, i) => `<li><i>${ICONE_EFEITO[f.efeito]}</i><span>${NOME_EFEITO[f.efeito]}</span><em>${icones[i].join("")}</em></li>`).join("");
    const el = this.$(".legenda");
    if (el._html !== html) el.innerHTML = el._html = html;
  },

  fotoFinish(vencedor) {
    const el = this.$(".foto");
    el.hidden = false;
    this.palco.classList.add("na-foto");
    const res = el.querySelector(".resultado");
    res.classList.remove("on");
    res.style.setProperty("--cor", this.candidatos[vencedor].cor);
    res.textContent = `${this.candidatos[vencedor].nome} na frente!`;
    clearTimeout(this.fotoTimer);
    this.fotoTimer = setTimeout(() => res.classList.add("on"), 700);
  },

  fecharFoto() {
    this.$(".foto").hidden = true;
    this.palco.classList.remove("na-foto");
  },

  podio({ vencedor, corrida, tempo, segundos }) {
    const v = this.candidatos[vencedor], o = this.candidatos[1 - vencedor];
    const el = this.$(".podio");
    el.style.setProperty("--cor", v.cor);
    el.style.setProperty("--cor-escura", v.corEscura || "#000");
    el.querySelector(".rotulo").textContent = `Corrida ${corrida.numero}`;
    el.querySelector(".titulo").innerHTML = `${escapar(v.nome)} <b>venceu!</b>`;
    const arte = this.config.arte || [];
    const d1 = el.querySelector(".d1"), d2 = el.querySelector(".d2");
    d1.querySelector(".arte").src = arte[vencedor] || v.arte;
    d2.querySelector(".arte").src = arte[1 - vencedor] || o.arte;
    d1.querySelector(".quem").textContent = v.nome;
    d2.querySelector(".quem").textContent = o.nome;
    d1.querySelector(".bloco").style.background = `linear-gradient(180deg, ${v.cor}, ${v.corEscura || v.cor})`;
    d2.querySelector(".bloco").style.background = `linear-gradient(180deg, ${o.cor}, ${o.corEscura || o.cor})`;
    const s = Math.round(tempo);
    d1.querySelector(".marca").innerHTML = `<small>tempo</small>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    el.querySelector(".dados").innerHTML = `Série <b>${corrida.serie[0]} × ${corrida.serie[1]}</b>`;
    const mvp = corrida.mvp(vencedor);
    const mvpEl = el.querySelector(".mvp");
    mvpEl.hidden = !mvp;
    if (mvp) mvpEl.innerHTML = `${avatar(mvp)}<div><small>Maior torcedor de ${escapar(v.nome)}</small><strong>${escapar(mvp.nick)}</strong></div>`;
    this.proxima(segundos);
    el.hidden = false;
    this.confete.iniciar(el.querySelector(".confete"), v);
  },

  proxima(segundos) {
    const el = this.$(".podio .proxima");
    const txt = `Próxima largada em <b>${Math.max(0, Math.ceil(segundos))}</b>`;
    if (el._html !== txt) el.innerHTML = el._html = txt;
  },

  fecharPodio() {
    this.$(".podio").hidden = true;
    this.confete.parar();
  },

  sinal(estado) {
    const el = this.$(".sem-sinal");
    clearTimeout(this.timerSinal);
    if (estado === "conectado" || estado === "demo") { el.hidden = true; return; }
    el.textContent = "Sem conexão com a live. Inicie a live no Renda Play.";
    /* Recém-aberto o conector costuma demorar: só avisa se continuar sem. */
    this.timerSinal = setTimeout(() => { el.hidden = false; }, estado === "conectando" ? 3000 : 1500);
  },

  pausa(on) { this.$(".pausa").hidden = !on; },

  /* Confete do pódio: canvas próprio, pedaços pré-alocados. */
  confete: {
    pedacos: [],
    rodando: false,
    iniciar(cv, cand) {
      this.cv = cv;
      this.c = cv.getContext("2d");
      cv.width = cv.offsetWidth || 1080;
      cv.height = cv.offsetHeight || 1920;
      const cores = [cand.cor, "#FFD400", "#FFFFFF", cand.acento || "#FFD400"];
      if (!this.pedacos.length) for (let i = 0; i < 160; i++) this.pedacos.push({ x: 0, y: 0, vy: 0, vx: 0, r: 0, vr: 0, w: 0, cor: "" });
      for (const p of this.pedacos) {
        p.x = Math.random() * cv.width;
        p.y = -Math.random() * cv.height;
        p.vy = 220 + Math.random() * 260;
        p.vx = (Math.random() - 0.5) * 80;
        p.r = Math.random() * 6;
        p.vr = (Math.random() - 0.5) * 10;
        p.w = 14 + Math.random() * 14;
        p.cor = cores[Math.floor(Math.random() * cores.length)];
      }
      this.rodando = true;
    },
    parar() {
      this.rodando = false;
      if (this.c) this.c.clearRect(0, 0, this.cv.width, this.cv.height);
    },
    quadro(dt) {
      if (!this.rodando) return;
      const c = this.c, H = this.cv.height;
      c.clearRect(0, 0, this.cv.width, H);
      for (const p of this.pedacos) {
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.r) * 30 * dt;
        p.r += p.vr * dt;
        if (p.y > H + 30) { p.y = -30; p.x = Math.random() * this.cv.width; }
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.scale(1, Math.cos(p.r * 1.3));
        c.fillStyle = p.cor;
        c.fillRect(-p.w / 2, -p.w / 3, p.w, p.w * 0.6);
        c.restore();
      }
    },
  },
};

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function avatar(q) {
  const inicial = escapar((String(q.nick || "?").replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase());
  const img = q.avatar && /^https?:\/\//.test(q.avatar) ? `<img src="${escapar(q.avatar)}" alt="" onerror="this.remove()">` : "";
  return `<span class="avatar"><i>${inicial}</i>${img}</span>`;
}

window.Hud = Hud;
