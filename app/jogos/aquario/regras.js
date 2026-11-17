/* Regras do Aquário da Live: quem tem peixe, onde cada um nada, a comida
   (petisco do comentário, flocos da curtida), crescer e passar fome, a toca
   de quem saiu, os efeitos de presente, a barra do aquário da live com as
   decorações e o ranking dos maiores. Sem DOM: o tempo anda pelo
   `passo(dt)` em passos fixos de 60 Hz, o sorteio é injetável e tudo que
   acontece volta numa lista de acontecimentos pro desenho, o HUD e o som.

   Coordenadas em pixels da arte (o palco de 1080 tem 270 deles; cada um
   vira 4 px na tela). y pra baixo. A superfície fica fixa embaixo do
   placar; o fundo acompanha a altura da tela (`formato`). */
"use strict";

const PASSO = 1 / 60;
const AQ = { largura: 270, superficie: 86, topoNado: 104, areia: 40 };
/* A tartaruga é desenhada em dobro; o casco fica a 30 px acima do centro. */
const CASCO = 30;

/* Espécie e paleta saem do nome, então a mesma pessoa tem sempre o mesmo
   peixe. `cor` é a do @ e do placar; o resto pinta o sprite. */
const ESPECIES = [
  { id: "palhaco", vel: 22, alto: 0.62, paletas: [
    { cor: "#ff8a2a", corpo: "#ff7a1c", claro: "#ffb35c", escuro: "#c2410c", detalhe: "#fff4e0" },
    { cor: "#ff5a3c", corpo: "#ef4a2c", claro: "#ff8f6a", escuro: "#a3241a", detalhe: "#fff4e0" },
    { cor: "#ffc53a", corpo: "#f5b21c", claro: "#ffe17a", escuro: "#b0700a", detalhe: "#3a1d0a" },
  ] },
  { id: "neon", vel: 30, alto: 0.42, paletas: [
    { cor: "#38d9ff", corpo: "#1fb6e8", claro: "#8af0ff", escuro: "#0a5e8a", detalhe: "#ff3a5c" },
    { cor: "#7cff6b", corpo: "#3fd94a", claro: "#b4ff9a", escuro: "#16803a", detalhe: "#ff5ad1" },
    { cor: "#c58bff", corpo: "#9b5cf0", claro: "#dcb8ff", escuro: "#4f2a9a", detalhe: "#ffe14a" },
  ] },
  { id: "anjo", vel: 16, alto: 0.95, paletas: [
    { cor: "#f2e7c4", corpo: "#e8dcb4", claro: "#fffaf0", escuro: "#7a6a48", detalhe: "#2a2420" },
    { cor: "#ffd84a", corpo: "#f2c230", claro: "#fff09a", escuro: "#a07208", detalhe: "#3a2a10" },
    { cor: "#9fd2ff", corpo: "#7ab8f0", claro: "#d0ecff", escuro: "#2c5a96", detalhe: "#132a4a" },
  ] },
  { id: "baiacu", vel: 14, alto: 0.78, paletas: [
    { cor: "#ffe066", corpo: "#e8c64a", claro: "#fff2a8", escuro: "#8a6a1a", detalhe: "#5a3a14" },
    { cor: "#9ae6b4", corpo: "#6cc994", claro: "#c8f7da", escuro: "#2a7a50", detalhe: "#1d3d2a" },
    { cor: "#ffb0c8", corpo: "#f08aa8", claro: "#ffd6e2", escuro: "#a83a5c", detalhe: "#5a1a30" },
  ] },
  { id: "betta", vel: 18, alto: 0.5, paletas: [
    { cor: "#ff4f8b", corpo: "#e8306e", claro: "#ff8ab2", escuro: "#8a0f3a", detalhe: "#ffd0e0" },
    { cor: "#5a8bff", corpo: "#3a6af0", claro: "#9ab8ff", escuro: "#1a2f8a", detalhe: "#c8e0ff" },
    { cor: "#b45cff", corpo: "#8f3ae8", claro: "#d39aff", escuro: "#4a1488", detalhe: "#ffc8f0" },
  ] },
  { id: "cirurgiao", vel: 24, alto: 0.6, paletas: [
    { cor: "#3aa8ff", corpo: "#1f86e8", claro: "#7cc6ff", escuro: "#0c2f6a", detalhe: "#ffd21a" },
    { cor: "#ffd21a", corpo: "#f2bf0a", claro: "#ffe98a", escuro: "#9a6a00", detalhe: "#ffffff" },
  ] },
  { id: "dourado", vel: 17, alto: 0.7, paletas: [
    { cor: "#ffa53a", corpo: "#f58a1c", claro: "#ffc87a", escuro: "#b0500a", detalhe: "#fff0d0" },
    { cor: "#ff6b5a", corpo: "#ef4a3a", claro: "#ff9a8a", escuro: "#a01f1a", detalhe: "#ffffff" },
    { cor: "#fff2d8", corpo: "#f2e2c0", claro: "#ffffff", escuro: "#b08a5a", detalhe: "#ff6a2a" },
  ] },
];

const FAIXAS_EFEITO = ["bolhas", "aguaviva", "tartaruga", "tubarao", "baleia"];
const FORMAS_BOLHA = ["estrela", "coracao", "raio"];
/* Os três grandes ocupam o aquário inteiro: um de cada vez. */
const EFEITO_PALCO = new Set(["tartaruga", "tubarao", "baleia"]);
/* Ganha uma por nível, a partir do 2. Depois do noturno o nível só dá festa. */
const DECORACOES = ["coral", "castelo", "navio", "bau", "noturno"];
/* Onde os peixes se escondem do tubarão: atrás das pedras e das plantas. */
const ESCONDERIJOS = [18, 42, 70, 104, 140, 176, 212, 240, 258];
const TRUQUES = [[/\bpul(a|o|e|ar|ei)\b/i, "pulo"], [/\bdan[cç](a|e|ar|ando|ou)\b/i, "danca"]];

/* FNV-1a: o mesmo nome dá sempre o mesmo número, em qualquer aparelho. */
function hashNome(s) {
  let h = 0x811c9dc5;
  for (const c of String(s).toLowerCase()) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function peixeDoNome(nome) {
  const h = hashNome(nome);
  const e = h % ESPECIES.length;
  const paletas = ESPECIES[e].paletas;
  return { especie: e, paleta: Math.floor(h / ESPECIES.length) % paletas.length, cor: paletas[Math.floor(h / ESPECIES.length) % paletas.length].cor };
}

/* Comprimento do peixe em pixels da arte: o da baleia é 3× o do filhote. */
function medida(tamanho) {
  return 18 + (Math.max(1, tamanho) - 1) * 4;
}

function comprimento(tamanho) {
  return Math.round(medida(tamanho));
}

/* O placar mostra com uma casa decimal pra o top 3 não empatar na tela. */
function centimetros(tamanho) {
  return (Math.round(medida(tamanho) * 10) / 10).toFixed(1).replace(".", ",");
}

class Aquario {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.alto = 480;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.acumulado = 0;
    this.ocioso = true;
    this.ultimoReal = -Infinity;
    this.pessoas = new Map();
    this.peixes = [];
    this.comida = [];
    this.nComida = 0;
    this.comEfeito = new Set();
    this.palco = null;
    this.festaAte = 0;
    this.aquario = { valor: 0, meta: this.cfg.aquario.meta, nivel: 1 };
    this.decoracoes = [];
    this.lider = null;
    this.proximoRanking = 0;
  }

  /* Tela mais comprida: o fundo desce, a superfície fica. */
  formato(alto) {
    this.alto = Math.max(480, Math.round(alto));
    const fundo = this.fundo();
    for (const p of this.peixes) p.y = Math.min(p.y, fundo - 4);
  }

  fundo() { return this.alto - AQ.areia; }

  pessoa(quem) {
    const id = String(quem.id || quem.nome);
    let p = this.pessoas.get(id);
    if (!p) {
      const nome = quem.nome || id;
      p = {
        id, nome, ...peixeDoNome(nome), tamanho: this.cfg.tamanho.inicial, pico: this.cfg.tamanho.inicial,
        naAgua: false, toca: false, visto: this.t, comeuEm: this.t, fome: false, encolheuEm: 0,
        coroa: false, cardumeAte: 0, maiorAte: 0, flocosAte: 0, truqueEm: -Infinity,
        fila: [], ativo: null,
        x: 0, y: 0, vx: 0, vy: 0, dir: 1, alvoX: 0, alvoY: 0, estado: "fora", estadoAte: 0, giro: 0, chegou: 0,
      };
      this.pessoas.set(id, p);
    } else if (quem.nome) p.nome = quem.nome;
    return p;
  }

  tamanhoDe(p) {
    if (this.t >= p.maiorAte) return p.tamanho;
    let maior = 0;
    for (const o of this.peixes) if (o !== p && o.tamanho > maior) maior = o.tamanho;
    return Math.min(this.cfg.tamanho.maximo, Math.max(p.tamanho, maior + 1));
  }

  /* ───────── live ───────── */

  marcarReal(lista) {
    this.ultimoReal = this.t;
    if (this.ocioso) {
      this.ocioso = false;
      lista.push({ tipo: "retomou" });
    }
  }

  comentario(quem, texto = "") {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    p.visto = this.t;
    this.encher(this.cfg.pontos.comentario, lista, p);
    if (!p.naAgua) {
      this.entrar(p, lista);
      return lista;
    }
    const truque = TRUQUES.find(([re]) => re.test(texto));
    if (truque && this.t >= p.truqueEm && p.estado === "nadando") {
      p.truqueEm = this.t + this.cfg.intervaloTruque;
      if (truque[1] === "pulo") this.mudar(p, "pulo", 6);
      else this.mudar(p, "danca", 1.4);
      lista.push({ tipo: truque[1], id: p.id, nome: p.nome, cor: p.cor, x: p.x, y: p.y });
      return lista;
    }
    if (this.comida.filter(c => c.dono === p.id).length < 3) {
      const x = Math.min(AQ.largura - 8, Math.max(8, p.x + p.dir * 14 + (this.sorte() - 0.5) * 16));
      const y = Math.max(AQ.superficie + 3, p.y - 8 - this.sorte() * 8);
      this.soltar("petisco", x, y, p.id);
      lista.push({ tipo: "petisco", id: p.id, nome: p.nome, cor: p.cor, x, y });
    }
    return lista;
  }

  curtida(quem, n = 1) {
    const p = this.pessoa(quem);
    const pts = this.cfg.pontos;
    const lista = [];
    this.encher(Math.min(pts.curtidaMaxima, n * pts.curtida), lista, p);
    const k = Math.max(1, Math.min(5, Math.round(n / 3)));
    const flocos = this.comida.filter(c => c.tipo === "floco").length;
    if (flocos + k > 60) return lista;
    const centro = p.naAgua ? p.x : 30 + this.sorte() * (AQ.largura - 60);
    /* Cai perto do peixe de quem curtiu: da superfície, todo mundo subiria
       e o fundo do aquário ficaria vazio. */
    const altura = p.naAgua ? Math.max(AQ.superficie + 1, p.y - 30) : AQ.superficie + 1;
    for (let i = 0; i < k; i++) {
      const x = Math.min(AQ.largura - 6, Math.max(6, centro + (this.sorte() - 0.5) * 60));
      this.soltar("floco", x, altura + this.sorte() * 10, null);
    }
    if (p.naAgua) p.flocosAte = this.t + 8;
    lista.push({ tipo: "flocos", id: p.id, nome: p.nome, x: centro, n: k });
    return lista;
  }

  /* Reforço: coroa e brilho dourado até o fim da live. */
  seguiu(quem) {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    p.visto = this.t;
    if (!p.naAgua) this.entrar(p, lista);
    p.coroa = true;
    this.encher(this.cfg.pontos.seguiu, lista, p);
    lista.push({ tipo: "reforco", id: p.id, nome: p.nome, cor: p.cor });
    return lista;
  }

  compartilhou(quem) {
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    p.visto = this.t;
    if (!p.naAgua) this.entrar(p, lista);
    p.cardumeAte = this.t + this.cfg.cardume;
    this.encher(this.cfg.pontos.compartilhou, lista, p);
    lista.push({ tipo: "compartilhou", id: p.id, nome: p.nome, cor: p.cor, ate: p.cardumeAte });
    return lista;
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(FAIXAS_EFEITO.length - 1, faixa);
    const lista = [];
    const p = this.pessoa(quem);
    this.marcarReal(lista);
    p.visto = this.t;
    if (!p.naAgua) this.entrar(p, lista);
    const efeito = FAIXAS_EFEITO[faixa];
    const forma = FORMAS_BOLHA[Math.floor(this.sorte() * FORMAS_BOLHA.length)];
    if (p.fila.length < this.cfg.filaMaxima) p.fila.push({ efeito, forma });
    this.comEfeito.add(p);
    lista.push({ tipo: "presente", id: p.id, nome: p.nome, cor: p.cor, presente: nome, quantidade, moedas, faixa, efeito, forma });
    this.encher(this.cfg.pontos.presente[faixa] || 0, lista, p);
    return lista;
  }

  /* ───────── peixes ───────── */

  /* Peixe novo ou de volta da toca. Aquário cheio: quem está há mais tempo
     sem interagir vai dormir na toca (nunca quem está no meio de um efeito). */
  entrar(p, lista) {
    if (this.peixes.length >= this.cfg.maxPeixes) {
      let velho = null;
      for (const o of this.peixes) {
        if (o.ativo || o.estado === "carona") continue;
        if (!velho || o.visto < velho.visto) velho = o;
      }
      if (velho) this.mandarPraToca(velho, lista);
    }
    const voltou = p.toca;
    p.toca = false;
    p.naAgua = true;
    p.x = 24 + this.sorte() * (AQ.largura - 48);
    p.y = AQ.superficie - 6;
    p.vx = (this.sorte() - 0.5) * 10;
    p.vy = 46;
    p.dir = this.sorte() < 0.5 ? -1 : 1;
    p.comeuEm = this.t;
    p.fome = false;
    p.chegou = this.t;
    p.giro = 0;
    this.mudar(p, "entrando", 0.9);
    this.sortearAlvo(p);
    this.peixes.push(p);
    if (!voltou) this.encher(this.cfg.pontos.peixeNovo, lista, p);
    lista.push({ tipo: voltou ? "voltou" : "chegou", id: p.id, nome: p.nome, cor: p.cor, x: p.x, y: AQ.superficie });
  }

  mandarPraToca(p, lista) {
    this.peixes.splice(this.peixes.indexOf(p), 1);
    p.naAgua = false;
    p.toca = true;
    p.estado = "fora";
    lista.push({ tipo: "toca", id: p.id, nome: p.nome, cor: p.cor, x: p.x, y: p.y });
  }

  naToca() {
    let n = 0;
    for (const p of this.pessoas.values()) if (p.toca) n++;
    return n;
  }

  mudar(p, estado, dur = 0) {
    p.estado = estado;
    p.estadoAte = this.t + dur;
    p.estadoIni = this.t;
  }

  sortearAlvo(p) {
    const fundo = this.fundo();
    const topo = this.ocioso ? fundo - 90 : AQ.topoNado;
    p.alvoX = 10 + this.sorte() * (AQ.largura - 20);
    /* Parte das voltas é entre as plantas e rente à areia. */
    if (!this.ocioso && this.sorte() < 0.4) p.alvoY = fundo - 8 - this.sorte() * 70;
    else p.alvoY = topo + this.sorte() * Math.max(10, fundo - 10 - topo);
  }

  /* ───────── comida ───────── */

  soltar(tipo, x, y, dono) {
    this.comida.push({ n: ++this.nComida, tipo, x, y, dono, nasceu: this.t, ate: this.t + (tipo === "floco" ? 16 : 12), fase: this.sorte() * 6 });
  }

  /* O que este peixe vai buscar: o petisco dele, ou o floco mais perto
     (longe só se a pessoa acabou de curtir). */
  comidaPara(p) {
    let melhor = null, dMelhor = Infinity;
    const raio = this.t < p.flocosAte ? 1e9 : 70 * 70;
    for (const c of this.comida) {
      if (c.dono && c.dono !== p.id) continue;
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (!c.dono && d > raio) continue;
      const peso = c.dono ? d * 0.1 : d;
      if (peso < dMelhor) { dMelhor = peso; melhor = c; }
    }
    return melhor;
  }

  moverComida(lista) {
    const fundo = this.fundo();
    for (let i = this.comida.length - 1; i >= 0; i--) {
      const c = this.comida[i];
      if (this.t >= c.ate) { this.comida.splice(i, 1); continue; }
      if (c.y < fundo - 2) {
        const vel = c.tipo === "floco" ? 9 : c.tipo === "grande" ? 12 : 15;
        c.y = Math.min(fundo - 2, c.y + vel * PASSO);
        if (c.tipo === "floco") c.x += Math.sin(this.t * 2.4 + c.fase) * 6 * PASSO;
      }
    }
  }

  comer(p, c, lista) {
    this.comida.splice(this.comida.indexOf(c), 1);
    const tam = this.cfg.tamanho;
    const valor = c.tipo === "floco" ? tam.floco : c.tipo === "grande" ? tam.petiscoGrande : tam.petisco;
    p.comeuEm = this.t;
    p.fome = false;
    const subiu = this.crescer(p, valor);
    lista.push({ tipo: "comeu", id: p.id, nome: p.nome, cor: p.cor, comida: c.tipo, n: c.n, x: c.x, y: c.y, tamanho: p.tamanho });
    if (subiu) lista.push({ tipo: "cresceu", id: p.id, nome: p.nome, cor: p.cor, x: p.x, y: p.y, tamanho: p.tamanho });
  }

  /* Comendo, o peixe para um degrau antes da baleia: o tamanho máximo é
     dela. */
  crescer(p, valor, teto = this.cfg.tamanho.maximo - 1) {
    if (p.tamanho >= teto && valor > 0) return false;
    const antes = Math.floor(p.tamanho);
    p.tamanho = Math.min(teto, p.tamanho + valor);
    p.pico = Math.max(p.pico, p.tamanho);
    return Math.floor(p.tamanho) > antes;
  }

  /* ───────── nado ───────── */

  nadar(p, lista) {
    const t = this.t, h = PASSO;
    const fundo = this.fundo();
    const esp = ESPECIES[p.especie];
    const len = comprimento(this.tamanhoDe(p));
    let alvoX = p.alvoX, alvoY = p.alvoY;
    let vel = esp.vel * (0.8 + 0.4 / Math.sqrt(len / 10));
    let resposta = 2.2;

    if (p.estado === "entrando") {
      p.vy += 90 * h;
      p.vx *= 0.98;
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (t >= p.estadoAte || p.y > AQ.topoNado + 30) this.mudar(p, "nadando");
      return;
    }
    if (p.estado === "carona") {
      const tt = this.palco && this.palco.tipo === "tartaruga" ? this.palco : null;
      if (!tt) { this.mudar(p, "nadando"); return; }
      p.x = tt.x + tt.dir * 2;
      p.y = tt.y - CASCO - len * 0.18;
      p.dir = tt.dir;
      p.vx = tt.dir * 30; p.vy = 0;
      return;
    }
    if (p.estado === "pulo") {
      const fase = p.fasePulo || "subir";
      if (fase === "subir") {
        alvoX = p.x + p.dir * 24;
        alvoY = AQ.superficie - 2;
        vel = 120;
        resposta = 6;
        if (p.y <= AQ.superficie + 3) {
          p.fasePulo = "ar";
          p.vy = -78;
          p.vx = p.dir * 34;
          lista.push({ tipo: "splash", id: p.id, x: p.x, y: AQ.superficie, sobe: true });
        }
      } else {
        p.vy += 170 * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.giro = Math.atan2(p.vy, Math.abs(p.vx)) * 0.8;
        if (p.vy > 0 && p.y >= AQ.superficie + 2) {
          lista.push({ tipo: "splash", id: p.id, x: p.x, y: AQ.superficie, sobe: false });
          p.fasePulo = null;
          p.giro = 0;
          p.vy = 30;
          this.mudar(p, "nadando");
          this.sortearAlvo(p);
        }
        this.limitar(p, fundo, true);
        return;
      }
      if (t >= p.estadoAte) { p.fasePulo = null; this.mudar(p, "nadando"); }
    } else if (p.estado === "danca") {
      p.giro = (t - p.estadoIni) / 1.4 * Math.PI * 2;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x += p.vx * h; p.y += p.vy * h;
      if (t >= p.estadoAte) { p.giro = 0; this.mudar(p, "nadando"); }
      return;
    } else if (p.estado === "escondido") {
      alvoX = p.alvoX;
      alvoY = p.alvoY;
      vel = 70;
      resposta = 4;
    } else if (this.palco && this.palco.tipo === "tartaruga" && this.palco.id === p.id && !this.palco.pegou) {
      /* Vai encontrar a tartaruga pra subir nas costas dela. */
      alvoX = this.palco.x;
      alvoY = this.palco.y - 15;
      vel = 60;
      resposta = 4;
    } else {
      if (this.ocioso) {
        vel *= 0.22;
        resposta = 0.8;
      } else {
        if (p.fome) vel *= 0.55;
        const c = this.comidaPara(p);
        if (c) {
          alvoX = c.x; alvoY = c.y;
          vel = Math.max(vel * 1.8, 40);
          resposta = 3.5;
          const bocaX = p.x + p.dir * len * 0.45;
          if ((bocaX - c.x) ** 2 + (p.y - c.y) ** 2 < (len * 0.3 + 3) ** 2) {
            this.comer(p, c, lista);
          }
        } else if ((p.alvoX - p.x) ** 2 + (p.alvoY - p.y) ** 2 < 64) this.sortearAlvo(p);
      }
      /* Nada pra frente e pra trás, não sobe em linha reta. */
      if (Math.abs(alvoX - p.x) < 6 && Math.abs(alvoY - p.y) > 30) alvoX = p.x + p.dir * 20;
    }

    const dx = alvoX - p.x, dy = alvoY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const freio = Math.min(1, d / 18);
    const dvx = dx / d * vel * freio, dvy = dy / d * vel * freio * 0.7;
    const k = Math.min(1, resposta * h);
    p.vx += (dvx - p.vx) * k;
    p.vy += (dvy - p.vy) * k;
    p.x += p.vx * h;
    p.y += p.vy * h;
    if (p.vx > 2.5) p.dir = 1;
    else if (p.vx < -2.5) p.dir = -1;
    this.limitar(p, fundo, false);
  }

  limitar(p, fundo, noAr) {
    const m = comprimento(this.tamanhoDe(p)) / 2;
    if (p.x < m) { p.x = m; p.vx = Math.abs(p.vx); }
    if (p.x > AQ.largura - m) { p.x = AQ.largura - m; p.vx = -Math.abs(p.vx); }
    if (!noAr && p.y < AQ.superficie + 4 && p.estado !== "pulo") p.y = AQ.superficie + 4;
    if (p.y > fundo - 4) { p.y = fundo - 4; p.vy = Math.min(0, p.vy); }
  }

  fome(lista) {
    const f = this.cfg.fome, t = this.t;
    for (const p of this.peixes) {
      if (this.ocioso) { p.comeuEm += PASSO; continue; }
      if (!p.fome && t - p.comeuEm > f.apos) {
        p.fome = true;
        p.encolheuEm = t;
        lista.push({ tipo: "fome", id: p.id, nome: p.nome });
      }
      if (p.fome && t - p.encolheuEm >= f.intervalo) {
        p.encolheuEm = t;
        const piso = Math.max(this.cfg.tamanho.inicial, p.pico - f.perda);
        p.tamanho = Math.max(piso, p.tamanho - f.encolhe);
      }
    }
  }

  /* ───────── barra do aquário ───────── */

  encher(v, lista, p) {
    const a = this.aquario, c = this.cfg.aquario;
    a.valor += v;
    while (a.valor >= a.meta) {
      a.valor -= a.meta;
      a.nivel++;
      a.meta = Math.round(a.meta * c.cresce);
      this.festaAte = this.t + c.festa;
      const decoracao = DECORACOES[a.nivel - 2] || null;
      if (decoracao) this.decoracoes.push(decoracao);
      lista.push({ tipo: "nivel", nivel: a.nivel, decoracao, id: p && p.id, nome: p && p.nome, cor: p && p.cor });
    }
  }

  /* ───────── efeitos de presente ───────── */

  efeitos(lista) {
    const t = this.t;
    for (const p of this.comEfeito) {
      if (p.ativo && t >= p.ativo.ate) this.acabar(p, lista);
      if (p.ativo) continue;
      if (!p.fila.length) { this.comEfeito.delete(p); continue; }
      if (EFEITO_PALCO.has(p.fila[0].efeito) && this.palco) continue;
      if (!p.naAgua) this.entrar(p, lista);
      this.iniciarEfeito(p, p.fila.shift(), lista);
    }
  }

  acabar(p, lista) {
    const e = p.ativo.efeito;
    lista.push({ tipo: "acabou", efeito: e, id: p.id, nome: p.nome });
    if (EFEITO_PALCO.has(e)) this.palco = null;
    if (e === "tartaruga" && p.estado === "carona") {
      this.mudar(p, "nadando");
      this.sortearAlvo(p);
    }
    if (e === "tubarao") {
      for (const o of this.peixes) if (o.estado === "escondido") { this.mudar(o, "nadando"); this.sortearAlvo(o); }
    }
    p.ativo = null;
  }

  iniciarEfeito(p, e, lista) {
    const t = this.t, cfg = this.cfg;
    const ev = { tipo: "efeito", efeito: e.efeito, id: p.id, nome: p.nome, cor: p.cor, forma: e.forma };
    const meio = (AQ.topoNado + this.fundo()) / 2;
    switch (e.efeito) {
      case "bolhas": {
        const x = Math.min(AQ.largura - 10, Math.max(10, p.x + p.dir * 18));
        const y = Math.max(AQ.superficie + 4, p.y - 20);
        this.soltar("grande", x, y, p.id);
        p.ativo = { efeito: "bolhas", ate: t + 2.5 };
        ev.x = x; ev.y = y;
        break;
      }
      case "aguaviva":
        this.crescer(p, 1);
        p.ativo = { efeito: "aguaviva", ate: t + 6 };
        break;
      case "tartaruga": {
        const dir = p.x < AQ.largura / 2 ? 1 : -1;
        this.palco = { tipo: "tartaruga", id: p.id, nome: p.nome, cor: p.cor, ini: t, ate: t + cfg.tartaruga, dir, x: dir > 0 ? -80 : AQ.largura + 80, y: meio, pegou: false };
        this.crescer(p, 0.5);
        p.ativo = { efeito: "tartaruga", ate: this.palco.ate };
        break;
      }
      case "tubarao": {
        const dir = this.sorte() < 0.5 ? 1 : -1;
        this.palco = { tipo: "tubarao", id: p.id, nome: p.nome, cor: p.cor, ini: t, ate: t + cfg.tubarao, dir, x: dir > 0 ? -90 : AQ.largura + 90, y: meio };
        p.maiorAte = t + cfg.maiorTubarao;
        for (const o of this.peixes) if (o !== p) this.esconder(o);
        p.ativo = { efeito: "tubarao", ate: this.palco.ate };
        break;
      }
      case "baleia": {
        const dir = this.sorte() < 0.5 ? 1 : -1;
        this.palco = { tipo: "baleia", id: p.id, nome: p.nome, cor: p.cor, ini: t, ate: t + cfg.baleia, dir, x: dir > 0 ? -160 : AQ.largura + 160, y: meio + 20 };
        this.festaAte = Math.max(this.festaAte, this.palco.ate);
        this.crescer(p, cfg.tamanho.maximo, cfg.tamanho.maximo);
        p.ativo = { efeito: "baleia", ate: this.palco.ate };
        break;
      }
    }
    ev.ate = p.ativo.ate;
    lista.push(ev);
  }

  esconder(p) {
    if (p.estado === "carona" || p.estado === "fora") return;
    const x = ESCONDERIJOS[Math.floor(this.sorte() * ESCONDERIJOS.length)] + (this.sorte() - 0.5) * 10;
    p.giro = 0;
    p.fasePulo = null;
    this.mudar(p, "escondido");
    p.alvoX = Math.min(AQ.largura - 8, Math.max(8, x));
    p.alvoY = this.fundo() - 6 - this.sorte() * 10;
  }

  /* Tartaruga, tubarão e baleia atravessam o aquário no tempo do efeito. */
  moverPalco() {
    const s = this.palco;
    if (!s) return;
    const u = Math.min(1, (this.t - s.ini) / (s.ate - s.ini));
    const margem = s.tipo === "baleia" ? 160 : s.tipo === "tubarao" ? 90 : 80;
    const de = s.dir > 0 ? -margem : AQ.largura + margem, para = s.dir > 0 ? AQ.largura + margem : -margem;
    s.x = de + (para - de) * u;
    const meio = (AQ.topoNado + this.fundo()) / 2;
    s.y = meio + (s.tipo === "baleia" ? 20 : 0) + Math.sin(u * Math.PI * 2) * (s.tipo === "tubarao" ? 14 : 8);
    const p = s.tipo === "tartaruga" && !s.pegou ? this.pessoas.get(s.id) : null;
    if (p && p.naAgua && p.estado !== "entrando") {
      const perto = (s.x - p.x) ** 2 + (s.y - CASCO - p.y) ** 2 < 24 * 24;
      /* Se a tartaruga passou dele sem encontrar, sobe assim mesmo. */
      if (perto || s.dir * (s.x - p.x) > 10) { s.pegou = true; p.giro = 0; p.fasePulo = null; this.mudar(p, "carona"); }
    }
  }

  /* ───────── tempo ───────── */

  passo(dt) {
    const lista = [];
    this.acumulado += dt;
    while (this.acumulado >= PASSO) {
      this.acumulado -= PASSO;
      this.tique(lista);
    }
    return lista;
  }

  tique(lista) {
    this.t += PASSO;
    if (!this.ocioso && this.t - this.ultimoReal > this.cfg.ociosidade) {
      this.ocioso = true;
      for (const p of this.peixes) if (p.estado === "nadando") this.sortearAlvo(p);
      lista.push({ tipo: "ocioso" });
    }
    this.efeitos(lista);
    this.moverPalco();
    this.moverComida(lista);
    for (const p of this.peixes) {
      if (this.palco && this.palco.tipo === "tubarao" && p.id !== this.palco.id && p.estado === "nadando") this.esconder(p);
      this.nadar(p, lista);
    }
    this.fome(lista);
    if (this.t >= this.proximoRanking) {
      this.proximoRanking = this.t + 0.5;
      const top = this.ranking(1)[0];
      if (top && top.id !== this.lider) {
        const antes = this.lider;
        this.lider = top.id;
        if (antes && this.peixes.length > 1) lista.push({ tipo: "maior", id: top.id, nome: top.nome, cor: top.cor, tamanho: top.tamanho });
      }
    }
  }

  /* Maiores peixes da live, de quem está na água ou na toca. */
  ranking(n = 3) {
    const lista = [];
    for (const p of this.pessoas.values()) if (p.naAgua || p.toca) lista.push(p);
    return lista.map(p => ({ id: p.id, nome: p.nome, cor: p.cor, tamanho: this.tamanhoDe(p) }))
      .sort((a, b) => b.tamanho - a.tamanho).slice(0, n);
  }
}

if (typeof module !== "undefined") {
  module.exports = { Aquario, PASSO, AQ, ESPECIES, FAIXAS_EFEITO, FORMAS_BOLHA, DECORACOES, ESCONDERIJOS, hashNome, peixeDoNome, comprimento, centimetros };
}
