/* Tudo que aparece no palco fora do canvas da mesa: placar, relógio, bolhas,
   faixas de voto em massa e virada, apuração e eleito. O palco tem
   1080×1920 (ou 1920×1080) e escala pra caber na janela; na vertical, em
   celular mais comprido que 9:16, ele cresce em altura em vez de sobrar
   faixa preta. Modo seguro: a tela fala em votos, nunca em moedas, e não
   pede presente. */
"use strict";

const BOLHAS_MAX = 7;
const ULTIMOS_MAX = 12;
const APURACAO_MS = 4000;

const Tela = {
  palco: null,
  formatoAtual: "vertical",
  mostrado: [0, 0],
  alvo: [0, 0],
  apurando: null,
  ultimoTop: [null, null],
  confete: new Confete(),

  montar(config, formato, candidatos, artes) {
    this.config = config;
    this.candidatos = candidatos;
    this.artes = candidatos.map((c, i) => (artes && artes[i]) || c.arte);
    this.palco = document.getElementById("palco");
    const p = this.palco;
    candidatos.forEach((c, i) => {
      const l = "ab"[i];
      p.style.setProperty(`--${l}`, c.cor);
      p.style.setProperty(`--${l}-escura`, c.corEscura);
    });

    candidatos.forEach((c, i) => {
      const cartao = p.querySelector(`.cartao[data-lado="${i}"]`);
      cartao.innerHTML = `
        <div class="retrato"><img class="arte" alt=""></div>
        <div class="lider">NA FRENTE</div>
        <div class="identidade"><span class="numero"></span><span class="nome"></span></div>
        <div class="votos"><b class="votos-num">0</b><small class="votos-rot">votos</small></div>
        <div class="pct"><b>50</b><small>%</small></div>
        <ol class="top"></ol>`;
      cartao.querySelector(".arte").src = this.artes[i];
      cartao.querySelector(".numero").textContent = c.numero;
      cartao.querySelector(".nome").textContent = c.nome.toUpperCase();
    });
    p.querySelector(".cabo-a b").textContent = candidatos[0].numero;
    p.querySelector(".cabo-b b").textContent = candidatos[1].numero;

    /* Cada chave fica em cima da urna do seu lado: quem chega na live vê
       qual presente e qual comentário votam em quem sem procurar. */
    p.querySelector(".chaves").innerHTML = candidatos.map((c, i) => `
      <div class="chave chave-${"ab"[i]}">
        <i class="chave-icone">${iconeDoPresente(c.presente)}</i>
        <span class="chave-texto"><strong>${escapar(c.presente.nome)}</strong><span>vota no <b>${c.numero}</b></span></span>
      </div>`).join("")
      + `<div class="chave-comente">ou comente <b class="a">${candidatos[0].numero}</b> ou <b class="b">${candidatos[1].numero}</b> no chat</div>`;

    this.mesa = p.querySelector(".mesa");
    Urnas.montar(document.getElementById("urnas"), candidatos, this.artes);
    this.canvasConfete = p.querySelector(".eleito .confete");
    this.cConfete = this.canvasConfete.getContext("2d");

    this.aplicarFormato(formato || "vertical");
    addEventListener("resize", () => this.encaixar());
    requestAnimationFrame(t => this.quadro(t));
  },

  alternarFormato() {
    this.aplicarFormato(this.formatoAtual === "vertical" ? "horizontal" : "vertical");
  },

  aplicarFormato(nome) {
    this.formatoAtual = nome;
    this.palco.classList.toggle("vertical", nome !== "horizontal");
    this.palco.classList.toggle("horizontal", nome === "horizontal");
    Urnas.formato(nome);
    this.encaixar();
  },

  /* O iPhone às vezes faz o primeiro layout do iframe com 0×0: escalar
     por zero sumiria com o palco, então espera o próximo quadro. */
  encaixar() {
    const w = innerWidth, h = innerHeight;
    if (!w || !h) {
      if (!this.esperandoTamanho) {
        this.esperandoTamanho = true;
        requestAnimationFrame(() => { this.esperandoTamanho = false; this.encaixar(); });
      }
      return;
    }
    const vertical = this.formatoAtual !== "horizontal";
    const W = vertical ? 1080 : 1920;
    const H = vertical ? Math.min(2520, Math.max(1920, Math.round(1080 * h / w))) : 1080;
    this.palco.style.height = vertical ? `${H}px` : "";
    this.palco.style.setProperty("--sobra", `${vertical ? H - 1920 : 0}px`);
    const escala = Math.min(w / W, h / H);
    this.escala = escala;
    this.palco.style.transform = `translate(${(w - W * escala) / 2}px, ${(h - H * escala) / 2}px) scale(${escala})`;
    Urnas.dimensionar(escala);
    const k = escala * Math.min(2, window.devicePixelRatio || 1);
    this.canvasConfete.width = Math.round(W * k);
    this.canvasConfete.height = Math.round(H * k);
    this.kConfete = k;
    this.W = W;
    this.H = H;
  },

  /* ───────────── placar ───────────── */

  placar(urna) {
    const p = this.palco;
    this.alvo = [...urna.votos];
    const pct = urna.porcentagens();
    const lider = urna.liderAgora();
    const cand = this.candidatos;

    [0, 1].forEach(l => {
      const cartao = p.querySelector(`.cartao[data-lado="${l}"]`);
      cartao.querySelector(".pct b").textContent = pct[l];
      cartao.classList.toggle("na-frente", lider === l);
      const top = urna.top(l, 3);
      const chave = top.map(d => `${d.id}:${Math.round(d.votos)}`).join("|");
      if (chave !== this.ultimoTop[l]) {
        this.ultimoTop[l] = chave;
        cartao.querySelector(".top").innerHTML = top.length
          ? top.map((d, i) => `<li><span class="pos">${i + 1}º</span>${avatar(d)}<span class="nick">${escapar(d.nick)}</span><b>${fmt(d.votos)}</b></li>`).join("")
          : `<li class="vazio">Maiores apoiadores aqui</li>`;
      }
    });

    p.querySelector(".cabo-a").style.width = `${pct[0]}%`;
    p.querySelector(".cabo-b").style.width = `${pct[1]}%`;
    const total = urna.total();
    p.querySelector(".total").textContent = `${fmt(total)} ${Math.round(total) === 1 ? "voto" : "votos"}`;
    const frente = p.querySelector(".frente");
    const dif = Math.abs(urna.votos[0] - urna.votos[1]);
    if (lider >= 0) {
      frente.innerHTML = `<b class="${"ab"[lider]}">${cand[lider].numero}</b> NA FRENTE`;
      p.querySelector(".diferenca").textContent = `+${fmt(dif)} de vantagem`;
    } else {
      frente.innerHTML = total ? "EMPATE" : "VOTAÇÃO ABERTA";
      p.querySelector(".diferenca").textContent = "";
    }
    p.dataset.lider = lider;
    p.querySelector(".serie").innerHTML = `<small>VITÓRIAS</small><span><b class="a">${cand[0].numero}</b><em>${urna.serie[0]}</em><i>×</i><em>${urna.serie[1]}</em><b class="b">${cand[1].numero}</b></span>`;
  },

  /* ───────────── acontecimentos ───────────── */

  contar(lista, urna) {
    if (!lista.length) return;
    for (const a of lista) {
      if (a.tipo === "voto") this.voto(a);
      else if (a.tipo === "virada") this.emSeguida(() => this.virada(a), 2300);
      else if (a.tipo === "pendente") this.aviso(`<b>${escapar(a.quem.nick)}</b>, comente <b class="a">${this.candidatos[0].numero}</b> ou <b class="b">${this.candidatos[1].numero}</b>`);
      else if (a.tipo === "comentouPresente") this.aviso(`<b>${escapar(a.quem.nick)}</b> escolheu o <b class="${"ab"[a.lado]}">${this.candidatos[a.lado].numero}</b>`);
    }
    this.placar(urna);
  },

  voto(a) {
    const presente = a.fonte === "presente";
    Urnas.votar(a.lado, { massa: a.massa, votos: a.votos, presente });
    const cartao = this.palco.querySelector(`.cartao[data-lado="${a.lado}"]`);
    cartao.classList.remove("votou");
    void cartao.offsetWidth;
    cartao.classList.add("votou");
    if (presente || a.fonte === "seguiu") this.bolha(a);
    const v = Math.round(a.votos);
    const c = this.candidatos[a.lado];
    this.ultimo(`${avatar(a.quem)}<span class="nick">${escapar(a.quem.nick)}</span><span class="mais">+${fmt(v)} ${v === 1 ? "voto" : "votos"} no</span><b>${c.numero}</b>`,
      `lado-${"ab"[a.lado]}${a.massa ? " em-massa" : ""}`);
    if (a.massa) this.emSeguida(() => this.massa(a), 2300);
  },

  /* Voto em massa e virada no mesmo presente: uma faixa depois da outra,
     senão a virada cobre a massa. Fila longa demais é descartada. */
  emSeguida(mostrar, ms) {
    const agora = performance.now();
    const inicio = Math.max(agora, this.faixaLivre || 0);
    if (inicio - agora > 5000) return;
    this.faixaLivre = inicio + ms;
    setTimeout(() => { if (!this.resultadoNaTela()) mostrar(); }, inicio - agora);
  },

  /* Faixa de massa/virada nunca cobre apuração nem eleito. */
  resultadoNaTela() {
    return !this.palco.querySelector(".apuracao").hidden || !this.palco.querySelector(".eleito").hidden;
  },

  esconderFaixas() {
    clearTimeout(this.timerMassa);
    clearTimeout(this.timerVirada);
    this.palco.querySelector(".massa").classList.remove("ativa");
    this.palco.querySelector(".virada").classList.remove("ativa");
  },

  bolha(a) {
    const caixa = this.palco.querySelector(".bolhas");
    if (caixa.childElementCount >= BOLHAS_MAX) caixa.firstElementChild.remove();
    const de = Urnas.centro(a.lado);
    const cartao = this.palco.querySelector(`.cartao[data-lado="${a.lado}"]`);
    const alvo = cartao.querySelector(".votos");
    const x0 = this.mesa.offsetLeft + de.x + (Math.random() - 0.5) * 120;
    const y0 = this.mesa.offsetTop + de.y;
    const x1 = cartao.offsetLeft + cartao.offsetWidth / 2 + (Math.random() - 0.5) * 80;
    const y1 = cartao.offsetTop + alvo.offsetTop + alvo.offsetHeight / 2;
    const b = document.createElement("div");
    b.className = `bolha bolha-${"ab"[a.lado]}${a.votos >= 10 ? " grande" : ""}`;
    b.style.cssText = `--x0:${x0}px;--y0:${y0}px;--x1:${x1}px;--y1:${y1}px`;
    const v = Math.round(a.votos);
    b.innerHTML = `${avatar(a.quem)}<span class="nick">${escapar(a.quem.nick)}</span><b>+${fmt(v)} ${v === 1 ? "voto" : "votos"}</b>`;
    b.addEventListener("animationend", () => b.remove());
    caixa.append(b);
  },

  aviso(html) {
    this.ultimo(`<span class="texto">${html}</span>`, "aviso");
  },

  /* Lista "últimos votos" entre as urnas e as chaves: o mais novo entra no topo. */
  ultimo(html, cls) {
    const lista = this.palco.querySelector(".ultimos");
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = html;
    lista.prepend(li);
    while (lista.childElementCount > ULTIMOS_MAX) lista.lastElementChild.remove();
  },

  massa(a) {
    const el = this.palco.querySelector(".massa");
    const c = this.candidatos[a.lado];
    const v = Math.round(a.votos);
    el.className = `massa lado-${"ab"[a.lado]}`;
    el.innerHTML = `
      <div class="massa-fundo"></div>
      <img class="massa-arte" src="${this.artes[a.lado]}" alt="">
      <div class="massa-texto">
        <span class="massa-titulo">VOTO EM MASSA!</span>
        <span class="massa-quem">${avatar(a.quem)}<b>${escapar(a.quem.nick)}</b></span>
        <span class="massa-votos">+${fmt(v)} votos no <b>${c.numero}</b></span>
      </div>`;
    void el.offsetWidth;
    el.classList.add("ativa");
    clearTimeout(this.timerMassa);
    this.timerMassa = setTimeout(() => el.classList.remove("ativa"), 2600);
    Vozes.efeito("confete");
    Vozes.falar("massa", "narrador");
    if (Math.random() < 0.5) Vozes.falar("entrada", a.lado);
  },

  virada(a) {
    const el = this.palco.querySelector(".virada");
    const c = this.candidatos[a.lado];
    el.className = `virada lado-${"ab"[a.lado]}`;
    el.innerHTML = `<div class="virada-flash"></div><div class="virada-faixa"><span class="virada-titulo">VIROU!</span><span class="virada-sub"><b>${c.numero}</b> ${escapar(c.nome.toUpperCase())} PASSOU NA FRENTE</span></div>`;
    void el.offsetWidth;
    el.classList.add("ativa");
    clearTimeout(this.timerVirada);
    this.timerVirada = setTimeout(() => el.classList.remove("ativa"), 2400);
    if (!Vozes.falar("virada", a.lado)) Vozes.falar("virada", "narrador");
  },

  /* ───────────── relógio ───────────── */

  tempo(seg, { final = false, numero, prorrogacao = false } = {}) {
    const s = Math.max(0, Math.ceil(seg));
    const texto = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    const rel = this.palco.querySelector(".relogio");
    const t = rel.querySelector(".tempo");
    if (t.textContent !== texto) {
      t.textContent = texto;
      if (final) { rel.classList.remove("tic"); void rel.offsetWidth; rel.classList.add("tic"); }
    }
    rel.classList.toggle("final", final);
    this.palco.classList.toggle("final", final);
    rel.classList.toggle("prorrogacao", prorrogacao);
    const rot = prorrogacao ? "PRORROGAÇÃO" : numero ? `RODADA ${numero}` : "";
    const r = rel.querySelector(".rodada");
    if (r.textContent !== rot) r.textContent = rot;
  },

  /* ───────────── apuração e eleito ───────────── */

  apuracao(r) {
    this.esconderFaixas();
    this.palco.querySelector(".ultimos").innerHTML = "";
    const el = this.palco.querySelector(".apuracao");
    const cand = this.candidatos;
    el.innerHTML = `
      <div class="apu-cab">
        <span class="apu-rodada">RODADA ${r.numero}</span>
        <h1>APURAÇÃO</h1>
        <div class="apu-progresso"><i></i></div>
        <span class="apu-secoes"><b>0,00%</b> das urnas apuradas</span>
      </div>
      ${cand.map((c, i) => `
        <div class="apu-linha apu-${"ab"[i]}">
          <div class="apu-foto"><img src="${this.artes[i]}" alt=""></div>
          <div class="apu-corpo">
            <div class="apu-nome"><b>${c.numero}</b><span>${escapar(c.nome.toUpperCase())}</span><em class="apu-pct">0,00%</em></div>
            <div class="apu-barra"><i></i></div>
            <div class="apu-votos">0 votos</div>
          </div>
        </div>`).join("")}`;
    el.hidden = false;
    el.classList.remove("saindo");
    this.apurando = { r, inicio: performance.now(), el };
    this.palco.classList.add("em-apuracao");
    Vozes.efeito("rufar");
  },

  quadroApuracao(t) {
    const a = this.apurando;
    if (!a) return;
    const p = Math.min(1, Math.max(0, (t - a.inicio) / APURACAO_MS)) || 0;
    const { r } = a;
    /* Quem perde sai na frente e quem ganha vira no fim: a graça da
       apuração é a virada nas últimas urnas. */
    const curva = l => (r.vencedor < 0 ? 1 - Math.pow(1 - p, 1.3) : l === r.vencedor ? Math.pow(p, 1.7) : 1 - Math.pow(1 - p, 1.7));
    const atual = r.votos.map((v, l) => v * curva(l));
    const soma = atual[0] + atual[1];
    const total = r.votos[0] + r.votos[1] || 1;
    atual.forEach((v, l) => {
      const linha = a.el.querySelector(`.apu-${"ab"[l]}`);
      const pct = p >= 1 ? r.porcentagens[l] : soma ? (v / soma) * 100 : 0;
      linha.querySelector(".apu-pct").textContent = `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      linha.querySelector(".apu-barra i").style.width = `${(v / total) * 100}%`;
      linha.querySelector(".apu-votos").textContent = `${fmt(v)} votos`;
      linha.classList.toggle("frente", soma > 0 && v > atual[1 - l]);
    });
    const secoes = Math.min(100, p * 100);
    a.el.querySelector(".apu-progresso i").style.width = `${secoes}%`;
    a.el.querySelector(".apu-secoes b").textContent = `${secoes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    if (p >= 1 && !a.fim) {
      a.fim = true;
      a.el.classList.add("terminou");
    }
  },

  eleito(r, segundos) {
    const ap = this.palco.querySelector(".apuracao");
    ap.classList.add("saindo");
    setTimeout(() => { ap.hidden = true; ap.classList.remove("saindo", "terminou"); }, 450);
    this.apurando = null;
    const el = this.palco.querySelector(".eleito");
    const conteudo = el.querySelector(".eleito-conteudo");
    const cand = this.candidatos;
    if (r.vencedor >= 0) {
      const c = cand[r.vencedor];
      const l = "ab"[r.vencedor];
      el.className = `eleito lado-${l}`;
      conteudo.innerHTML = `
        <div class="raios"></div>
        <div class="eleito-palco"><img class="eleito-arte" src="${this.artes[r.vencedor]}" alt=""></div>
        <div class="eleito-texto">
          <div class="eleito-titulo">ELEITO!</div>
          <div class="eleito-nome"><b>${c.numero}</b><span>${escapar(c.nome.toUpperCase())}</span></div>
          <div class="eleito-dados"><b>${r.porcentagens[r.vencedor]}%</b> dos votos · ${fmt(r.votos[r.vencedor])} votos</div>
          ${r.mvp ? `<div class="eleito-mvp"><span class="mvp-selo">MVP</span>${avatar(r.mvp)}<b>${escapar(r.mvp.nick)}</b><em>${fmt(r.mvp.votos)} votos</em></div>` : ""}
          <div class="eleito-proxima"></div>
        </div>`;
      this.confete.soltar(this.W / 2, this.H * 0.55, 160, [c.cor, "#FFD400", "#FFFFFF", c.cor], { espalha: 900, forca: 1500, largura: this.W * 0.5 });
      setTimeout(() => {
        if (!el.hidden) this.confete.soltar(this.W / 2, this.H * 0.5, 120, ["#FFD400", c.cor, "#FFFFFF"], { espalha: 1100, forca: 1400, largura: this.W * 0.7 });
      }, 900);
      Vozes.efeito("fanfarra");
      Vozes.falar("vitoria", r.vencedor);
    } else {
      el.className = "eleito empate";
      conteudo.innerHTML = `
        <div class="empate-artes">${cand.map((c, i) => `<img class="empate-arte empate-${"ab"[i]}" src="${this.artes[i]}" alt="">`).join("")}</div>
        <div class="eleito-texto">
          <div class="eleito-titulo">EMPATE TÉCNICO</div>
          <div class="eleito-nome"><b class="a">${cand[0].numero}</b><span>${fmt(r.votos[0])} × ${fmt(r.votos[1])}</span><b class="b">${cand[1].numero}</b></div>
          <div class="eleito-dados">Ninguém foi eleito nesta rodada</div>
          <div class="eleito-proxima"></div>
        </div>`;
    }
    el.hidden = false;
    this.palco.classList.add("em-vitoria");
    this.contagemVitoria(segundos);
  },

  contagemVitoria(seg) {
    const el = this.palco.querySelector(".eleito-proxima");
    if (!el) return;
    if (seg == null) { el.textContent = "Aperte N pra nova eleição"; return; }
    const s = Math.max(0, Math.ceil(seg));
    el.textContent = `Nova eleição em ${s} s`;
  },

  fecharEleito() {
    const el = this.palco.querySelector(".eleito");
    const ap = this.palco.querySelector(".apuracao");
    this.apurando = null;
    ap.hidden = true;
    el.classList.add("saindo");
    this.palco.classList.remove("em-apuracao", "em-vitoria");
    setTimeout(() => { el.hidden = true; el.classList.remove("saindo"); this.confete.pedacos = []; }, 450);
  },

  /* ───────────── estado ───────────── */

  sinal(estado) {
    const s = this.palco.querySelector(".sem-sinal");
    clearTimeout(this.timerSinal);
    if (estado === "conectado" || estado === "demo") { s.hidden = true; return; }
    s.textContent = "Sem conexão com a live. Inicie a live no Renda Play.";
    /* Recém-aberto o conector costuma demorar: só avisa se continuar sem. */
    this.timerSinal = setTimeout(() => { s.hidden = false; }, estado === "conectando" ? 3000 : 1500);
  },

  pausa(on) { this.palco.querySelector(".pausa").hidden = !on; },

  quadro(t) {
    const dt = Math.min(0.05, (t - (this.ultimoQuadro || t)) / 1000);
    this.ultimoQuadro = t;
    [0, 1].forEach(l => {
      const alvo = this.alvo[l];
      let m = this.mostrado[l];
      if (m !== alvo) {
        m += (alvo - m) * Math.min(1, dt * 7);
        if (Math.abs(alvo - m) < 0.5 || alvo < m) m = alvo;
        this.mostrado[l] = m;
        const el = this.palco.querySelector(`.cartao[data-lado="${l}"] .votos-num`);
        const texto = fmt(m);
        if (el.textContent !== texto) el.textContent = texto;
      }
    });
    Urnas.quadro(t);
    this.quadroApuracao(t);
    if (this.confete.pedacos.length || this.confeteSujo) {
      const c = this.cConfete;
      c.setTransform(this.kConfete, 0, 0, this.kConfete, 0, 0);
      c.clearRect(0, 0, this.W, this.H);
      this.confete.quadro(c, dt);
      this.confeteSujo = this.confete.pedacos.length > 0;
    }
    requestAnimationFrame(x => this.quadro(x));
  },
};

function fmt(n) { return Math.round(n).toLocaleString("pt-BR"); }

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function avatar(q) {
  const inicial = escapar((String(q.nick || "?").replace(/[^\p{L}\p{N}]/gu, "")[0] || "?").toUpperCase());
  if (q.avatar && /^https?:\/\//.test(q.avatar)) {
    return `<span class="av"><img src="${escapar(q.avatar)}" alt="" onerror="this.remove()"><i>${inicial}</i></span>`;
  }
  return `<span class="av"><i>${inicial}</i></span>`;
}

window.Tela = Tela;
