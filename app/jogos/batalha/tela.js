/* Tudo que se vê fora do canvas: placar, instrução, faixas, vitória. A Tela
   não decide nada: recebe a Batalha pra ler o placar e os acontecimentos
   (regras.js) pra animar. As torres em si moram em torres.js. */
"use strict";

const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];
const fmt = new Intl.NumberFormat("pt-BR");
const FIM_DE_RODADA_MS = 1800;

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

/* Mistura de cor feita aqui, não em CSS: o navegador embutido de OBS e
   Live Studio antigos (CEF < 111) não entende color-mix. */
function misturar(hex, com, peso) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(hex), rgb(com)];
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * peso).toString(16).padStart(2, "0")).join("");
}

function comAlfa(hex, alfa) {
  return hex + Math.round(alfa * 255).toString(16).padStart(2, "0");
}

/* Fotos que já carregaram uma vez: o top 3 e o maior presente são
   redesenhados, e sem isso a inicial piscaria antes da foto toda vez. */
const avataresProntos = new Set();

/* Avatar do TikTok com as iniciais por baixo: se a foto não carregar
   (link expirado, demo, mock), fica a inicial numa cor fixa da pessoa. */
function criarAvatar(quem) {
  const a = el("span", "avatar");
  const nick = String(quem.nick || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  a.textContent = ([...nick][0] || "?").toUpperCase();
  a.style.setProperty("--avatar-cor", CORES_AVATAR[hashTexto(quem.id || quem.nick) % CORES_AVATAR.length]);
  if (quem.avatar && /^https?:\/\//.test(quem.avatar)) {
    const url = quem.avatar;
    const mostrar = () => { a.textContent = ""; a.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`; };
    if (avataresProntos.has(url)) mostrar();
    else {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => { avataresProntos.add(url); mostrar(); };
      img.src = url;
    }
  }
  return a;
}

/* Diminui a fonte até o texto caber numa linha (nome de lado comprido
   vindo do painel). */
function caber(e, minimo = 28) {
  e.style.fontSize = "";
  let tam = parseFloat(getComputedStyle(e).fontSize);
  while (e.scrollWidth > e.clientWidth + 1 && tam > minimo) {
    tam = Math.max(minimo, tam * 0.92);
    e.style.fontSize = tam + "px";
  }
}

const metros = n => `${numeroMetros(n)} m`;
const GOLPES = {
  vento: { icone: "💨", nome: "Ventania" },
  raio: { icone: "⚡", nome: "Raio" },
  bola: { icone: "💣", nome: "Bola de demolição" },
  terremoto: { icone: "💥", nome: "Terremoto" },
};
const BOLHAS_VISIVEIS = 3;
const BOLHAS_FILA = 6;
const BOLHA_PASSO = 54;

const Tela = {
  cfg: null,
  formato: "vertical",
  forcado: null,
  palco: null,
  filaDestaque: [],
  mostrandoDestaque: false,
  bloqueioVirada: 0,
  filaGrande: [],
  mostrandoGrande: false,
  emVitoria: false,
  fechando: false,
  alertaAte: 0,
  avisoPresenteEm: 0,
  ultimoPresente: 0,
  bolhasAtivas: [[], []],
  bolhasFila: [[], []],

  montar(cfg, formatoForcado) {
    this.cfg = cfg;
    this.forcado = formatoForcado;
    this.palco = document.getElementById("palco");
    const p = this.palco;

    cfg.lados.forEach((l, i) => {
      const s = i ? "b" : "a";
      p.style.setProperty(`--${s}`, l.cor);
      p.style.setProperty(`--${s}-escura`, l.corEscura);
      p.style.setProperty(`--${s}-acento`, l.acento);
      p.style.setProperty(`--${s}-claro`, misturar(l.cor, "#ffffff", 0.45));
      p.style.setProperty(`--${s}-sombra`, comAlfa(l.corEscura, 0.88));
      p.querySelector(`.lado-${s} .nome`).textContent = l.nome;
      const chave = p.querySelector(`.chave-${s}`);
      const icone = chave.querySelector(".presente-icone");
      /* `imagem` desenha o presente que não tem emoji (rosa branca). */
      if (l.presente.imagem) {
        const img = el("img");
        img.src = l.presente.imagem;
        img.alt = l.presente.nome;
        icone.replaceChildren(img);
      } else icone.textContent = l.presente.icone;
      if (l.presente.fundo) icone.style.background = l.presente.fundo;
      chave.querySelector(".chave-txt").innerHTML =
        `<small>Presente</small><b>${escapar(l.presente.nome)} = ${escapar(l.nome)}</b>`;
    });
    /* Modo seguro: sem chaves "Presente Rosa = Vermelho" e sem nada que peça
       presente; o vínculo fica pelo ícone na legenda do próprio lado. */
    this.seguro = cfg.modoSeguro !== false;
    p.classList.toggle("seguro", this.seguro);
    const [a, b] = cfg.lados;
    const curte = this.curtidaLigada(cfg);
    p.querySelector(".so-presente").innerHTML =
      `Comente <span class="n n-a">${escapar(a.comandos[0])}</span> ou ` +
      `<span class="n n-b">${escapar(b.comandos[0])}</span>` +
      (curte ? ` · curtidas também empilham` : ` pra empilhar`);
    p.querySelector(".creditos").textContent = cfg.creditos || "";
    Cenario.montar(p, cfg);
    this.montarLegenda(cfg);
    this.linhaPadrao();
    this.ultimoPresente = performance.now();

    Torres.montar(document.getElementById("torres"), cfg);
    Torres.aoPousar = (a, i) => this.bolhaPouso(a, i);
    this.aplicarFormato();
    addEventListener("resize", () => this.aplicarFormato());
    if (document.fonts) document.fonts.ready.then(() => this.caberNomes());
    let antes = performance.now();
    const quadro = agora => {
      this.quadro(Math.min(0.05, (agora - antes) / 1000));
      antes = agora;
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  },

  curtidaLigada(cfg) { return !!(cfg.curtida && cfg.curtida.cada > 0 && cfg.curtida.metros > 0); },

  /* Coluna fina em cada borda: ícone + efeito, sem verbo de pedido. */
  montarLegenda(cfg) {
    const faixas = (cfg.ataque && cfg.ataque.faixas) || ATAQUE_PADRAO.faixas;
    const golpe = { vento: "Ventania", raio: "Raio", bola: "Demolição", terremoto: "Terremoto" };
    cfg.lados.forEach((l, i) => {
      const s = i ? "b" : "a";
      const item = (icone, valor, sub) => {
        const e = el("div", "leg");
        const ico = el("span", "leg-ico");
        if (icone instanceof Node) ico.append(icone); else ico.textContent = icone;
        e.append(ico, el("b", "", valor), el("small", "", sub));
        return e;
      };
      const itens = [];
      if (cfg.comentario && cfg.comentario.metros > 0) {
        itens.push(item(el("i", "tijolo", l.comandos[0]), `+${metros(cfg.comentario.metros)}`, `💬 ${l.comandos[0]}`));
      }
      if (this.curtidaLigada(cfg)) itens.push(item("❤", `+${metros(cfg.curtida.metros)}`, `${fmt.format(cfg.curtida.cada)} curtidas`));
      if (cfg.seguiu && cfg.seguiu.metros > 0) itens.push(item("➕", `+${metros(cfg.seguiu.metros)}`, "seguiu"));
      let presente = l.presente.icone;
      if (l.presente.imagem) {
        presente = el("img");
        presente.src = l.presente.imagem;
        presente.alt = "";
      }
      itens.push(item(presente, "+1 m", l.presente.nome));
      if (cfg.ataque && cfg.ataque.maxPct > 0) {
        for (const f of faixas) itens.push(item(GOLPES[f.tipo].icone, fmt.format(f.de), golpe[f.tipo]));
      }
      this.palco.querySelector(`.legenda-${s}`).replaceChildren(...itens);
    });
  },

  aplicarFormato() {
    const f = this.forcado || (innerHeight >= innerWidth ? "vertical" : "horizontal");
    const { W, H } = CENAS[f];
    if (f !== this.formato || Torres.canvas.width !== W) {
      this.formato = f;
      this.palco.classList.toggle("vertical", f === "vertical");
      this.palco.classList.toggle("horizontal", f === "horizontal");
      Torres.formato(f);
      this.caberNomes();
    }
    const s = Math.min(innerWidth / W, innerHeight / H);
    this.palco.style.transform =
      `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  },

  caberNomes() {
    this.palco.querySelectorAll(".lado .nome").forEach(e => caber(e, 30));
    this.palco.querySelectorAll(".chave-txt b").forEach(e => caber(e, 34));
  },

  alternarFormato() {
    this.forcado = this.formato === "vertical" ? "horizontal" : "vertical";
    this.aplicarFormato();
  },

  /* ───────── placar ───────── */

  placar(b, agora = Date.now()) {
    /* Entre o fim da rodada e a tela de vitória a torre que ganhou ainda
       está de pé: o placar só zera junto com ela. */
    if (this.fechando) return;
    const p = this.palco;
    const total = b.total();
    const f = b.fracao(0);

    this.cfg.lados.forEach((l, i) => {
      const lado = p.querySelector(i ? ".lado-b" : ".lado-a");
      const torcida = lado.querySelector(".torcida");
      const nTorcida = b.torcida(i);
      if (torcida.dataset.n !== String(nTorcida)) {
        torcida.dataset.n = nTorcida;
        torcida.innerHTML = `<b>${fmt.format(nTorcida)}</b> na torcida`;
      }
      const s = b.sequencia;
      const seq = lado.querySelector(".seq");
      const viva = s.lado === i && s.n >= 3 && agora - s.em < 25000;
      seq.classList.toggle("on", viva);
      if (viva) seq.textContent = `🔥 ${s.n} seguidos`;
      p.querySelector(i ? ".serie-b" : ".serie-a").textContent = b.serie[i];
      this.pintarTop(p.querySelector(i ? ".top-b" : ".top-a"), b.top(i), l);
    });

    p.classList.toggle("cravado", total >= 20 && Math.abs(f - 0.5) <= 0.03);

    const maior = p.querySelector(".maior");
    const m = b.maior;
    const chaveMaior = m ? [m.lado, m.quem.id, m.quem.nick, m.quem.avatar, m.pontos].join("|") : "";
    if (maior.dataset.chave !== chaveMaior) {
      maior.dataset.chave = chaveMaior;
      if (m) {
        maior.style.setProperty("--cor-lado", misturar(this.cfg.lados[m.lado].cor, "#ffffff", 0.5));
        maior.replaceChildren(criarAvatar(m.quem));
        const t = el("span", "txt");
        t.innerHTML = `Maior peça: <b>${escapar(m.quem.nick)}</b>`;
        maior.append(t, el("span", "valor", `+${metros(m.pontos)}`));
      }
      maior.classList.toggle("on", !!m);
    }

    const meta = p.querySelector(".meta");
    const alvo = this.cfg.meta && this.cfg.meta.moedas;
    meta.hidden = !alvo;
    if (alvo) {
      meta.querySelector("i").style.width = Math.min(100, (total / alvo) * 100) + "%";
      meta.classList.toggle("batida", total >= alvo);
      meta.querySelector(".meta-txt").textContent = total >= alvo
        ? `Meta batida! ${metros(total)}`
        : `Meta ${fmt.format(Math.round(total))} / ${metros(alvo)}`;
    }
  },

  /* Placar e "faltam" leem a altura da torre desenhada (a da placa), a
     cada quadro: peça no ar e golpe que ainda não bateu não entram antes
     de aparecer, e os três números sobem e caem juntos. */
  alturasNaTela() {
    if (this.fechando) return;
    const p = this.palco;
    const alturas = Torres.alturas();
    const chave = alturas.map(metrosNaTela).join("|");
    if (chave === this.chaveAlturas) return;
    this.chaveAlturas = chave;
    const ft = faltaEntre(alturas);
    alturas.forEach((h, i) => {
      const lado = p.querySelector(i ? ".lado-b" : ".lado-a");
      const texto = numeroMetros(h);
      lado.querySelector(".altura-num").textContent = texto;
      /* Placar gigante não cabe com 5+ caracteres ao lado do relógio. */
      lado.classList.toggle("longa", texto.length > 4);
      lado.classList.toggle("atras", !!ft && ft.lado === i);
    });
    const falta = p.querySelector(".falta");
    const vazio = !alturas[0] && !alturas[1];
    if (vazio) falta.innerHTML = "O primeiro comentário começa a torre";
    else if (!ft) falta.innerHTML = this.seguro ? "Empate! A próxima peça desempata" : "Empate! O próximo presente desempata";
    else {
      falta.style.setProperty("--cor-lado", misturar(this.cfg.lados[ft.lado].cor, "#ffffff", 0.45));
      falta.innerHTML = `${ft.metros === 1 ? "Falta" : "Faltam"} <b>${fmtM1.format(ft.metros)} m</b> pro ${escapar(this.cfg.lados[ft.lado].nome)} virar`;
    }
    p.classList.toggle("igual", !vazio && !ft);
  },

  pintarTop(lista, top, lado) {
    const chave = top.map(d => [d.id, d.nick, d.avatar, d.pontos].join("|")).join("/");
    if (lista.dataset.chave === chave) return;
    lista.dataset.chave = chave;
    lista.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const d = top[i];
      const li = el("li", d ? (i === 0 ? "primeiro" : "") : "vazio");
      li.append(el("span", "pos", String(i + 1)));
      if (d) li.append(criarAvatar(d), el("span", "quem", d.nick), el("span", "valor", metros(d.pontos)));
      else if (this.seguro) li.append(el("span", "quem", "—"));
      else li.append(el("span", "quem", i === 0 ? `Seja o 1º do ${lado.nome}` : "Seu nome aqui"));
      lista.append(li);
    }
  },

  tempo(seg, { numero, prorrogacao, final }) {
    const p = this.palco;
    const s = Math.max(0, Math.ceil(seg));
    p.querySelector(".tempo").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    p.querySelector(".rodada").textContent = prorrogacao ? "Prorrogação" : `Rodada ${numero}`;
    p.classList.toggle("prorrogacao", !!prorrogacao);
    p.classList.toggle("final", !!final);
    p.querySelector(".falta").classList.toggle("pisca", !!final);
  },

  /* ───────── acontecimentos ───────── */

  contar(lista, b) {
    /* Virada antes do presente que a causou: a faixa do presente grande
       espera a virada sair, senão uma fica escondida atrás da outra. */
    const ordem = [...lista].sort((x, y) => (y.tipo === "virada") - (x.tipo === "virada"));
    /* Presente que ataca já ganha a faixa do ataque: duas faixas juntas
       cobririam a torre bem na hora do golpe. */
    const atacou = lista.some(a => a.tipo === "ataque");
    for (const a of ordem) {
      if (a.tipo === "pontos") this.pontos(atacou ? { ...a, destaque: false } : a);
      else if (a.tipo === "tijolinho") Torres.empilhar({ ...a, tijolinho: true });
      else if (a.tipo === "ataque") this.ataque(a);
      else if (a.tipo === "pendente") this.pendente(a);
      else if (a.tipo === "escolha") this.escolha(a);
      else if (a.tipo === "comentouPresente") this.comentouPresente(a);
      else if (a.tipo === "virada") this.virada(a);
      else if (a.tipo === "meta") this.metaBatida();
      else if (a.tipo === "dobro") this.dobro(a);
      else if (a.tipo === "dobroFim") this.fimDobro();
    }
    if (lista.length) this.placar(b);
  },

  pontos(a) {
    this.ultimoPresente = performance.now();
    if (a.dobrado) this.fimDobro();
    Torres.empilhar(a);
    if (a.destaque) this.destacar(a);
  },

  /* Nome de quem mandou, no topo da torre, quando a peça assenta: com a
     torre alta, peça de rosa fica fina demais pra ler o nome nela. No
     máximo 3 por lado; rajada espera na fila (e a fila descarta a mais
     velha), senão as bolhas cobrem a placa e a linha do "faltam". */
  bolhaPouso(a, i) {
    if (this.emVitoria) return;
    const fila = this.bolhasFila[i];
    /* O tijolinho já leva o nome; bolha dele só com a coluna livre, senão
       a chuva de comentário empurra o nome de quem mandou presente. */
    if (a.tipo === "tijolinho" && (fila.length || this.bolhasAtivas[i].length)) return;
    fila.push(a);
    if (fila.length > BOLHAS_FILA) fila.shift();
    this.proximaBolha(i);
    const lado0 = this.palco.querySelector(i ? ".lado-b" : ".lado-a");
    lado0.querySelector(".altura").animate([{ translate: "0 0" }, { translate: "0 -10px" }, { translate: "0 0" }], { duration: 300 });
  },

  proximaBolha(i) {
    const ativas = this.bolhasAtivas[i] = this.bolhasAtivas[i].filter(b => b.isConnected);
    const fila = this.bolhasFila[i];
    if (!fila.length || ativas.length >= BOLHAS_VISIVEIS) return;
    const a = fila.shift();
    const bolha = el("div", "bolha-pouso");
    bolha.style.setProperty("--cor-lado", this.cfg.lados[i].cor);
    bolha.append(criarAvatar(a.quem), el("span", "quem", a.quem.nick), el("b", null, `+${metros(a.pontos)}`));
    ativas.push(bolha);
    /* Posição antes de entrar no DOM, senão a transição a traz do canto. */
    if (!this.arrumarBolhas(i)) {
      ativas.pop();
      this.arrumarBolhas(i);
      return this.proximaBolha(i);
    }
    this.palco.querySelector(".bolhas").append(bolha);
    bolha.animate([
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1, offset: 0.12 },
      { opacity: 1, scale: 1, offset: 0.85 },
      { opacity: 0, scale: 1 },
    ], { duration: fila.length ? 1100 : 1700, easing: "ease-out", fill: "forwards" }).onfinish = () => {
      bolha.remove();
      this.proximaBolha(i);
    };
  },

  /* Coluna centrada na torre, a mais nova logo abaixo do topo, sempre
     sobre as peças: em cima ela encostava na placa da foto. Torre baixa
     demais pra coluna (devolve false): a bolha não aparece, o nome fica
     na peça, no top 3 e na faixa. */
  arrumarBolhas(i) {
    const L = Torres.L;
    const ativas = this.bolhasAtivas[i];
    if (!ativas.length) return true;
    const n = ativas.length;
    const topo = Torres.topoTela(i).y + 18;
    const ys = ativas.map((_, k) => topo + 44 + (n - 1 - k) * BOLHA_PASSO);
    if (ys[0] + 30 > L.chao - 10) return false;
    ativas.forEach((b, k) => { b.style.transform = `translate(${L.xs[i]}px, ${ys[k]}px) translate(-50%, -50%)`; });
    return true;
  },

  destacar(a) {
    this.filaDestaque.push(a);
    if (this.filaDestaque.length > 4) this.filaDestaque.splice(1, 1);
    if (!this.mostrandoDestaque) this.proximoDestaque();
  },

  proximoDestaque() {
    this.mostrandoDestaque = true;
    if (this.mostrandoGrande) { setTimeout(() => this.proximoDestaque(), 250); return; }
    const a = this.filaDestaque.shift();
    const caixa = this.palco.querySelector(".destaque");
    if (!a) { this.mostrandoDestaque = false; return; }
    const lado = this.cfg.lados[a.lado];
    const faixa = el("div", "faixa");
    faixa.style.setProperty("--cor-lado", lado.cor);
    const txt = el("div");
    txt.append(el("div", "quem", a.quem.nick));
    const oque = el("div", "oque");
    /* A live manda "Rose"; na tela vale o nome do preset ("Rosa"). */
    const simbolo = lado.presente.aceitos.some(x => normalizar(x) === normalizar(a.presente));
    oque.textContent = a.liberado
      ? `escolheu o ${lado.nome} e o presente entrou na torre`
      : `mandou ${a.quantidade > 1 ? a.quantidade + "× " : ""}${simbolo ? lado.presente.nome : a.presente} pra torre do ${lado.nome}`;
    txt.append(oque, el("div", "valor", `+${metros(a.pontos)}${a.dobrado ? " (2×)" : ""}`));
    faixa.append(criarAvatar(a.quem), txt);
    caixa.replaceChildren(faixa);
    faixa.animate([
      { transform: "scale(.5) rotate(-6deg)", opacity: 0 },
      { transform: "scale(1.08) rotate(1deg)", opacity: 1, offset: 0.1 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.16 },
      { transform: "scale(1) rotate(0)", opacity: 1, offset: 0.86 },
      { transform: "scale(.9) translateY(-60px)", opacity: 0 },
    ], { duration: 2800, easing: "ease-out" }).onfinish = () => { faixa.remove(); this.proximoDestaque(); };
  },

  linhaPadrao() {
    const linha = this.palco.querySelector(".linha-ajuda");
    linha.classList.remove("alerta");
    linha.innerHTML = this.seguro
      ? `🏆 Torre mais alta no fim do tempo <b class="forte">VENCE</b>`
      : `💥 Presente grande <b class="forte">DERRUBA</b> a torre do outro!`;
  },

  alerta(html, ms) {
    const linha = this.palco.querySelector(".linha-ajuda");
    linha.classList.add("alerta");
    linha.innerHTML = html;
    this.alertaAte = performance.now() + ms;
  },

  pendente(a) {
    const [la, lb] = this.cfg.lados;
    this.alerta(
      `<b>${escapar(a.quem.nick)}</b>, comente <span class="cmd">${escapar(la.comandos[0])}</span> ou ` +
      `<span class="cmd">${escapar(lb.comandos[0])}</span> pra empilhar +${metros(a.pontos)}`, 8000);
  },

  /* Quem escreve "gg" achou que era o presente: o tijolinho conta, e ele
     aprende na hora que o presente de verdade vale muito mais. */
  comentouPresente(a) {
    const agora = performance.now();
    if (agora < this.avisoPresenteEm) return;
    this.avisoPresenteEm = agora + 5000;
    const lado = this.cfg.lados[a.lado];
    if (this.seguro) {
      this.alerta(`<b>${escapar(a.quem.nick)}</b> entrou no time <b>${escapar(lado.nome)}</b>`, 4000);
      return;
    }
    this.alerta(
      `<b>${escapar(a.quem.nick)}</b>, mande o <b>PRESENTE ${escapar(lado.presente.icone)} ${escapar(lado.presente.nome.toUpperCase())}</b> pra empilhar <b>MUITO</b> mais`, 6000);
  },

  /* Golpe e virada nunca dividem a tela: entram um por vez, o golpe na
     frente. Virada nova na fila troca a antiga, que já ficou velha. */
  anunciar(tipo, mostrar) {
    if (this.emVitoria) return;
    const fila = this.filaGrande.filter(x => tipo !== "virada" || x.tipo !== "virada");
    fila.push({ tipo, mostrar });
    this.filaGrande = fila.filter(x => x.tipo === "ataque").concat(fila.filter(x => x.tipo !== "ataque"));
    if (!this.mostrandoGrande) this.proximoGrande();
  },

  proximoGrande() {
    const item = this.emVitoria ? null : this.filaGrande.shift();
    this.mostrandoGrande = !!item;
    if (!item) { this.filaGrande = []; return; }
    /* A faixa de presente que já estava na tela sai pro anúncio entrar. */
    for (const f of this.palco.querySelector(".destaque").children) f.getAnimations().forEach(an => an.finish());
    item.mostrar(() => this.proximoGrande());
  },

  /* Faixa "fulano DERRUBOU 12 m do Flávio!" no impacto, não no envio. */
  ataque(a) {
    if (this.emVitoria) return;
    Torres.atacar(a);
    const golpe = GOLPES[a.ataque] || GOLPES.vento;
    const espera = ((ATAQUES[a.ataque] || ATAQUES.vento).antes) * 1000;
    setTimeout(() => this.anunciar("ataque", (pronto) => {
      const caixa = this.palco.querySelector(".ataque");
      const faixa = el("div", "golpe");
      faixa.style.setProperty("--cor-lado", this.cfg.lados[a.lado].cor);
      faixa.innerHTML =
        `<span class="golpe-icone">${golpe.icone}</span><div><div class="golpe-tipo">${golpe.nome}!</div>` +
        `<div class="golpe-txt"><b>${escapar(a.quem.nick)}</b> DERRUBOU <em>${metros(a.metros)}</em> do ${escapar(this.cfg.lados[a.alvo].nome)}!</div></div>`;
      caixa.replaceChildren(faixa);
      faixa.animate([
        { transform: "scale(.4)", opacity: 0 },
        { transform: "scale(1.12)", opacity: 1, offset: 0.08 },
        { transform: "scale(1)", opacity: 1, offset: 0.14 },
        { transform: "scale(1)", opacity: 1, offset: 0.85 },
        { transform: "scale(.9)", opacity: 0 },
      ], { duration: 1900, easing: "ease-out" }).onfinish = () => { faixa.remove(); pronto(); };
    }), espera);
  },

  escolha(a) {
    const torcida = this.palco.querySelector(a.lado ? ".lado-b .torcida" : ".lado-a .torcida");
    const mais = el("span", "mais-torcida", "+1");
    mais.style.left = "40%";
    mais.style.top = "-6px";
    torcida.append(mais);
    mais.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-46px)", opacity: 0 }],
      { duration: 1100, easing: "ease-out" }).onfinish = () => mais.remove();
  },

  dobro(a) {
    if (this.emVitoria) return;
    const lado = this.cfg.lados[a.lado];
    const d = this.palco.querySelector(".dobro");
    d.style.setProperty("--cor-lado", lado.cor);
    d.innerHTML = `<span class="grande">Próximo presente vale 2×</span>` +
      `<span class="sub">pra torre do ${escapar(lado.nome)} · só nos próximos ${a.segundos} s</span><i></i>`;
    d.querySelector("i").animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration: Math.max(0, a.ate - Date.now()), fill: "forwards" });
    this.palco.classList.add("com-dobro");
    Torres.dobroLado = a.lado;
    Som.dobro();
  },

  fimDobro() {
    this.palco.classList.remove("com-dobro");
    Torres.dobroLado = -1;
  },

  metaBatida() {
    const meta = this.palco.querySelector(".meta");
    meta.animate([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: 500, iterations: 3 });
    Torres.chuva(["#fff", this.cfg.lados[0].cor, this.cfg.lados[1].cor], 120);
  },

  virada(a) {
    if (this.emVitoria) return;
    const agora = performance.now();
    if (agora < this.bloqueioVirada) return;
    this.bloqueioVirada = agora + 2600;
    this.anunciar("virada", (pronto) => this.mostrarVirada(a, pronto));
  },

  mostrarVirada(a, pronto) {
    const lado = this.cfg.lados[a.lado];
    const v = this.palco.querySelector(".virada");
    v.style.setProperty("--cor-lado", lado.cor);
    v.replaceChildren();
    const flash = el("div", "flash");
    const faixas = el("div", "faixas");
    for (let i = 0; i < 5; i++) faixas.append(el("i"));
    const palavra = el("div", "palavra", "Virada!");
    const sub = el("div", "sub", `A torre do ${lado.nome} passou`);
    v.append(flash, faixas, palavra, sub);
    v.classList.add("on");
    Som.virada();

    const dur = 1700;
    flash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 380, fill: "forwards" });
    [...faixas.children].forEach((f, i) => {
      const dir = i % 2 ? 1 : -1;
      f.animate([
        { transform: `translateX(${dir * 130}%)` },
        { transform: "translateX(0)" },
        { transform: `translateX(${-dir * 130}%)` },
      ], { duration: 900, delay: i * 30, easing: "cubic-bezier(.6,0,.4,1)", fill: "both" });
    });
    palavra.animate([
      { transform: "scale(3) rotate(-8deg)", opacity: 0 },
      { transform: "scale(.9) rotate(-4deg)", opacity: 1, offset: 0.1 },
      { transform: "scale(1) rotate(-4deg)", opacity: 1, offset: 0.16 },
      { transform: "scale(1.06) rotate(-4deg)", opacity: 1, offset: 0.8 },
      { transform: "scale(1.5) rotate(-4deg)", opacity: 0 },
    ], { duration: dur, easing: "ease-out", fill: "both" });
    sub.animate([
      { transform: "translate(-50%, 60px)", opacity: 0 },
      { transform: "translate(-50%, 60px)", opacity: 0, offset: 0.12 },
      { transform: "translate(-50%, 0)", opacity: 1, offset: 0.22 },
      { transform: "translate(-50%, 0)", opacity: 1, offset: 0.8 },
      { transform: "translate(-50%, 0)", opacity: 0 },
    ], { duration: dur, fill: "both" }).onfinish = () => { v.classList.remove("on"); pronto(); };
    Torres.tremor = Math.max(Torres.tremor, 16);
    const cores = [lado.cor, lado.acento, "#fff"];
    const { W, H } = Torres.L;
    Torres.explodir(W * 0.2, H * 0.4, cores, 120, 20);
    Torres.explodir(W * 0.8, H * 0.4, cores, 120, 20);
    Torres.chuva(cores, 160);
  },

  /* De 10 a 4 o relógio cresce no topo e bate; só 3, 2, 1 tomam a tela,
     pra não esconder o placar no momento em que mais se doa. */
  contagem(n) {
    const c = this.palco.querySelector(".contagem");
    if (n != null) Som.tique(n <= 3);
    if (n == null || n > 3) { c.replaceChildren(); return; }
    const num = el("div", "n", String(n));
    c.replaceChildren(num);
    num.animate([
      { transform: "scale(1.7)", opacity: 0 },
      { transform: "scale(1)", opacity: 1, offset: 0.18 },
      { transform: "scale(.94)", opacity: 0.95, offset: 0.8 },
      { transform: "scale(.8)", opacity: 0 },
    ], { duration: 1000, easing: "ease-out", fill: "forwards" });
  },

  /* Relógio zerou: a torre de quem perdeu desaba na frente de todo mundo
     e só depois entra a tela de vitória. */
  fimDeRodada(r, segundos, b) {
    this.fechando = true;
    this.emVitoria = true;
    this.contagem(null);
    this.fimDobro();
    this.palco.querySelector(".bolhas").replaceChildren();
    this.bolhasFila = [[], []];
    Torres.encerrar(r.vencedor);
    if (r.vencedor >= 0) {
      const l = this.cfg.lados[r.vencedor];
      Torres.chuva([l.cor, l.acento, "#fff"], 120);
    }
    setTimeout(() => {
      this.fechando = false;
      Torres.zerar();
      this.vitoria(r, segundos);
      this.placar(b);
    }, FIM_DE_RODADA_MS);
  },

  vitoria(r, segundos) {
    this.emVitoria = true;
    Torres.soEfeitos = true;
    this.palco.classList.add("em-vitoria");
    const empate = r.vencedor < 0;
    const lado = this.cfg.lados[empate ? 0 : r.vencedor];
    const outro = this.cfg.lados[empate ? 1 : 1 - r.vencedor];
    const v = this.palco.querySelector(".vitoria");
    v.classList.toggle("empatou", empate);
    v.style.setProperty("--cor-lado", empate ? "#2A3A66" : lado.cor);
    v.style.setProperty("--cor-lado-escura", empate ? "#0A1530" : lado.corEscura);
    v.replaceChildren(el("div", "fundo"), el("div", "raios"));
    const titulo = el("div", "titulo");
    titulo.append(el("div", "rodada-vit", `Rodada ${r.numero}`));
    const vence = el("div", "vence");
    vence.append(el("span", "vence-nome", empate ? "Empate" : lado.nome),
      el("small", null, empate ? "as torres ficaram iguais" : "fez a torre mais alta"));
    const placar = el("div", "placar-vit");
    const [pa, pb] = empate ? r.pontos : [r.pontos[r.vencedor], r.pontos[1 - r.vencedor]];
    placar.innerHTML = `${fmt.format(pa)} m <span>a</span> ${fmt.format(pb)} m${empate ? "" : ` <span>contra ${escapar(outro.nome)}</span>`}`;
    const serie = el("div", "serie-vit");
    serie.textContent = `Rodadas: ${lado.nome} ${r.serie[empate ? 0 : r.vencedor]} x ${r.serie[empate ? 1 : 1 - r.vencedor]} ${outro.nome}`;
    titulo.append(vence, placar, serie);
    const fotos = (empate ? [lado, outro] : [lado]).map((l, i) => {
      const foto = el("img", empate ? `foto-vit dupla dupla-${i}` : "foto-vit");
      foto.src = l.foto;
      foto.alt = l.nome;
      return foto;
    });
    v.append(...fotos, titulo);

    if (r.mvp) {
      const mvp = el("div", "mvp");
      const t = el("div");
      t.append(el("div", "rotulo", "MVP da rodada"), el("div", "quem", r.mvp.nick),
        el("div", "valor", `${metros(r.mvp.pontos)} pro ${lado.nome}`));
      mvp.append(criarAvatar(r.mvp), t);
      v.append(mvp);
      mvp.animate([{ transform: "translateY(120px)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 600, delay: 700, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "backwards" });
    }
    this.proxima = el("div", "proxima");
    v.append(this.proxima);
    this.contagemVitoria(segundos);
    v.classList.add("on");
    caber(vence.querySelector(".vence-nome"), 60);

    vence.animate([{ transform: "scale(2.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 500, easing: "cubic-bezier(.2,1.3,.4,1)" });
    fotos.forEach(foto => foto.animate([{ translate: "0 200px", opacity: 0 }, { translate: "0 0", opacity: 1 }],
      { duration: 700, easing: "cubic-bezier(.2,1,.3,1)" }));
    Som.vitoria();
    const cores = empate ? [this.cfg.lados[0].cor, this.cfg.lados[1].cor, "#fff"] : [lado.cor, lado.acento, "#fff"];
    Torres.chuva(cores, 260);
    this.festa = setInterval(() => Torres.chuva(cores, 40), 900);
  },

  contagemVitoria(seg) {
    if (!this.proxima) return;
    const conta = this.seguro ? "O que entrar agora já conta pra ela." : "Presentes de agora já contam pra ela.";
    this.proxima.textContent = seg == null
      ? `Aperte N pra começar a próxima rodada. ${conta}`
      : `Próxima rodada em ${Math.max(0, Math.ceil(seg))} s. ${conta}`;
  },

  fecharVitoria() {
    this.emVitoria = false;
    Torres.soEfeitos = false;
    this.palco.classList.remove("em-vitoria");
    clearInterval(this.festa);
    this.proxima = null;
    const v = this.palco.querySelector(".vitoria");
    v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => {
      v.classList.remove("on");
      v.replaceChildren();
    };
  },

  sinal(ok, demo) {
    const s = this.palco.querySelector(".sem-sinal");
    s.hidden = ok || demo;
    s.textContent = "Sem conexão com o conector da live. Inicie a live no Renda Play.";
  },

  pausa(on) { this.palco.querySelector(".pausa").hidden = !on; },

  quadro(dt) {
    const agora = performance.now();
    if (this.alertaAte && agora > this.alertaAte) {
      this.alertaAte = 0;
      this.linhaPadrao();
    }
    /* Sem presente faz tempo: a instrução respira pra tela não parecer travada. */
    const parado = !this.emVitoria && agora - this.ultimoPresente > 20000;
    if (parado !== this.palco.classList.contains("parado")) this.palco.classList.toggle("parado", parado);
    Torres.quadro(dt);
    this.alturasNaTela();
  },
};
