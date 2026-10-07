/* Regras do Voa, Tuca!: times, presentes por faixa, efeitos com teto de
   tempo, bolha/vida/asa de ouro, quem derrubou, recorde, ranking, barra
   do chat e eventos-surpresa. Sem DOM; o relógio (`t`, em segundos) anda
   pelo `passo(dt)`, e o sorteio é injetável.

   Cada ação devolve uma lista de acontecimentos ({tipo, ...}) que a tela
   anima. A física é do `Mundo`; aqui se decide o que uma batida significa. */
"use strict";

const MundoClasse = typeof module !== "undefined" && module.exports ? require("./mundo.js").Mundo : Mundo;

const EFEITOS_CAOS = ["vento", "neblina", "inverte", "meteoros"];
const COM_TEMPO = ["vento", "neblina", "inverte", "meteoros", "escudo", "lento", "turbo"];
const FILA_MAX = 40;

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hashTexto(s) {
  let h = 0;
  for (const c of String(s)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

class Partida {
  constructor(cfg, dims, aleatorio = Math.random, recordeSalvo = 0) {
    this.cfg = cfg;
    this.aleatorio = aleatorio;
    this.mundo = new MundoClasse(cfg.voo, dims, aleatorio);
    this.recordeSalvo = recordeSalvo;
    this.t = 0;
    this.zerar();
  }

  /* Zera a live inteira (tecla R). */
  zerar() {
    this.jogadores = new Map();
    this.moedas = 0;
    this.maiorPresente = null;
    this.recordeLive = 0;
    this.voos = 0;
    this.ultimoPresente = this.t;
    this.fimUltimoEvento = this.t;
    this.evento = null;
    this.rodizio = 0;
    this.barra = { ajuda: 0, caos: 0 };
    this.pendentes = [];
    this.ultimoChinelo = -Infinity;
    this.novoVoo();
  }

  novoVoo() {
    this.voos++;
    this.fase = "preparo";
    this.fimFase = this.t + this.cfg.preparo;
    this.pontos = 0;
    this.recordeAntes = this.recordeLive;
    this.bateuRecorde = false;
    this.vidas = 0;
    this.efeitos = {};
    this.recentes = [];
    this.invencivelAte = 0;
    this.susto = 0;
    this.proximoMeteoro = 0;
    this.morte = null;
    this.mundo.reiniciar();
    this.mundo.queijo = !!(this.evento && this.evento.nome === "queijo");
  }

  /* ───────── consultas ───────── */

  jogador(quem) {
    let j = this.jogadores.get(quem.id);
    if (!j) {
      j = { id: quem.id, nome: quem.nome || quem.id, foto: quem.foto || null, time: null,
        moedas: 0, caos: 0, ajuda: 0, abates: 0, curtidas: 0, curtidasUsadas: 0, seguiu: false, ultimaCarga: -Infinity, ultimoChinelo: -Infinity };
      this.jogadores.set(quem.id, j);
    } else {
      if (quem.nome) j.nome = quem.nome;
      if (quem.foto) j.foto = quem.foto;
    }
    if (quem.simulado) j.simulado = true;
    return j;
  }

  /* Time de quem nunca escolheu: o padrão do preset. No `--mock` ninguém
     comenta 1/2, então cada espectador falso ganha um time fixo pelo id. */
  timeDe(j) {
    if (j.time) return j.time;
    if (j.simulado) return hashTexto(j.id) % 3 === 0 ? "ajuda" : "caos";
    return this.cfg.times.padrao;
  }

  faixaDe(moedas) {
    let f = -1;
    this.cfg.faixas.forEach((x, i) => { if (moedas >= x.moedas) f = i; });
    return f;
  }

  ativo(nome) {
    const e = this.efeitos[nome];
    return !!e && e.ate > this.t;
  }

  restante(nome) {
    return this.ativo(nome) ? this.efeitos[nome].ate - this.t : 0;
  }

  invencivel() { return this.t < this.invencivelAte || this.ativo("turbo"); }

  /* Quanto falta pra passar o recorde que valia quando o voo começou. */
  faltam() {
    if (this.recordeAntes <= 0 || this.pontos > this.recordeAntes) return 0;
    return this.recordeAntes - this.pontos + 1;
  }

  ranking(campo = "abates", n = 3) {
    return [...this.jogadores.values()]
      .filter(j => j[campo] > 0)
      .sort((a, b) => b[campo] - a[campo] || b.moedas - a.moedas)
      .slice(0, n);
  }

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const j = this.jogador(quem);
    const saida = [];
    const n = normalizar(texto);
    for (const time of ["ajuda", "caos"]) {
      if (this.cfg.times[time].comandos.some(c => normalizar(c) === n)) this.escolherTime(j, time, saida);
    }
    const time = this.timeDe(j);
    if (this.t - j.ultimaCarga >= this.cfg.chat.porPessoa) {
      j.ultimaCarga = this.t;
      this.carregar(time, 1, saida);
    }
    if (this.evento && this.evento.nome === "chinelo" && time === "caos" && this.fase === "voo"
      && this.t - j.ultimoChinelo >= 3 && this.t - this.ultimoChinelo >= 0.6) {
      j.ultimoChinelo = this.ultimoChinelo = this.t;
      const proj = this.mundo.lancar("chinelo", { id: j.id, nome: j.nome });
      saida.push({ tipo: "chinelo", id: j.id, proj });
    }
    return saida;
  }

  escolherTime(j, time, saida) {
    if (j.time === time) return;
    j.time = time;
    saida.push({ tipo: "time", id: j.id, time });
  }

  curtida(quem, n = 1) {
    const j = this.jogador(quem);
    const saida = [];
    j.curtidas += n;
    const unidades = Math.floor(j.curtidas / this.cfg.chat.curtidas) - j.curtidasUsadas;
    if (unidades > 0) {
      j.curtidasUsadas += unidades;
      this.carregar(this.timeDe(j), unidades, saida);
    }
    return saida;
  }

  seguiu(quem) {
    const j = this.jogador(quem);
    const saida = [{ tipo: "seguiu", id: j.id }];
    if (j.seguiu) return saida;
    j.seguiu = true;
    this.carregar(this.timeDe(j), 1, saida);
    return saida;
  }

  compartilhou(quem) {
    const j = this.jogador(quem);
    const saida = [{ tipo: "compartilhou", id: j.id }];
    this.carregar(this.timeDe(j), 3, saida);
    return saida;
  }

  /* Barra do chat: cheia, sai uma chinelada (caos) ou uma bolha (ajuda)
     assinada por "o chat". Fora do voo a carga fica pro próximo. */
  carregar(time, n, saida) {
    this.barra[time] += n;
    if (this.barra[time] < this.cfg.chat.carga || this.fase !== "voo") {
      this.barra[time] = Math.min(this.barra[time], this.cfg.chat.carga);
      return;
    }
    this.barra[time] = 0;
    const chat = { id: "@chat", nome: "o chat" };
    if (time === "caos") {
      const proj = this.mundo.lancar("chinelo", chat);
      saida.push({ tipo: "barra", time, proj });
    } else {
      this.estender("escudo", this.cfg.chat.bolha, this.cfg.faixas[1].ajuda.teto || 20, chat);
      saida.push({ tipo: "barra", time });
    }
  }

  presente(quem, { nome = "", moedas = 0, quantidade = 1 } = {}) {
    const j = this.jogador(quem);
    const saida = [];
    moedas = Math.max(0, Math.round(Number(moedas) || 0));
    if (!moedas) return saida;
    this.moedas += moedas;
    j.moedas += moedas;
    this.ultimoPresente = this.t;
    if (!this.maiorPresente || moedas > this.maiorPresente.moedas) this.maiorPresente = { id: j.id, nome: j.nome, moedas, presente: nome };

    const n = normalizar(nome);
    for (const time of ["ajuda", "caos"]) {
      if (this.cfg.times[time].presentes.some(p => normalizar(p) === n)) this.escolherTime(j, time, saida);
    }
    const time = this.timeDe(j);
    j[time] += moedas;
    const faixa = this.faixaDe(moedas);
    const lendario = moedas >= this.cfg.lendario;
    const ev = { tipo: "presente", id: j.id, time, faixa, nome, moedas, quantidade, lendario,
      efeito: faixa >= 0 ? this.cfg.faixas[faixa][time].efeito : null };
    saida.push(ev);
    if (faixa < 0) return saida;

    if (this.fase !== "voo") {
      ev.guardado = true;
      this.pendentes.push({ time, faixa, j, moedas, lendario });
      if (this.pendentes.length > FILA_MAX) this.pendentes.shift();
      return saida;
    }
    saida.push(...this.aplicar(time, faixa, j, lendario));
    return saida;
  }

  aplicar(time, faixa, j, lendario) {
    const f = this.cfg.faixas[faixa][time];
    const dono = { id: j.id, nome: j.nome };
    const saida = [];
    const dur = lendario ? f.teto || f.dur : f.dur;

    switch (f.efeito) {
      case "vento": {
        const novo = this.estender("vento", dur, f.teto, dono);
        const e = this.efeitos.vento;
        e.forca = novo ? 1 : Math.min(1.6, e.forca + 0.15);
        if (novo) e.fase = this.aleatorio() * 6.28;
        break;
      }
      case "inverte": {
        if (this.estender("inverte", dur, f.teto, dono)) {
          this.mundo.mods.gravidade = -1;
          this.susto = this.t + (this.cfg.piloto.sustoInversao || 0);
          saida.push({ tipo: "inverteu", ligado: true });
        }
        break;
      }
      case "neblina":
      case "meteoros":
      case "turbo":
        this.estender(f.efeito, dur, f.teto, dono);
        break;
      case "escudo":
        this.estender("escudo", dur, f.teto, dono);
        break;
      case "lento":
        this.estender("lento", dur, f.teto, dono);
        this.estender("escudo", dur, this.cfg.faixas[1].ajuda.teto || 20, dono);
        break;
      case "gigante": {
        const n = lendario ? f.teto : f.pilares;
        for (let i = 0; i < n && this.mundo.gigantes.length < f.teto; i++) this.mundo.gigantes.push(dono);
        break;
      }
      case "pontos":
        this.somarPontos(f.pontos * (lendario ? 10 : 1), saida);
        break;
      case "vida": {
        const max = this.cfg.vidasMax;
        if (this.vidas < max) this.vidas = lendario ? max : Math.min(max, this.vidas + f.vidas);
        else this.estender("escudo", 10, this.cfg.faixas[1].ajuda.teto || 20, dono);
        break;
      }
    }
    if (lendario && time === "ajuda") this.vidas = this.cfg.vidasMax;
    if (EFEITOS_CAOS.includes(f.efeito) || f.efeito === "gigante") {
      this.recentes.push({ dono, efeito: f.efeito, t: this.t });
      if (this.recentes.length > 20) this.recentes.shift();
    }
    return saida;
  }

  /* Soma tempo até o teto. Devolve true se o efeito começou agora. */
  estender(nome, dur, teto, dono) {
    const e = this.efeitos[nome];
    if (e && e.ate > this.t) {
      e.ate = Math.min(this.t + (teto || dur), e.ate + dur);
      e.total = e.ate - e.inicio;
      e.dono = dono;
      return false;
    }
    this.efeitos[nome] = { inicio: this.t, ate: this.t + dur, total: dur, dono, forca: 1, fase: 0 };
    return true;
  }

  pular() {
    if (this.fase === "preparo") this.fimFase = Math.min(this.fimFase, this.t);
    if (this.fase !== "voo") return false;
    this.mundo.pular();
    return true;
  }

  somarPontos(n, saida) {
    this.pontos += n;
    if (this.pontos > this.recordeLive) this.recordeLive = this.pontos;
    if (this.pontos > this.recordeSalvo) this.recordeSalvo = this.pontos;
    if (!this.bateuRecorde && this.recordeAntes > 0 && this.pontos > this.recordeAntes) {
      this.bateuRecorde = true;
      if (this.recordeAntes >= this.cfg.recordeFesta) saida.push({ tipo: "recorde", pontos: this.pontos, antes: this.recordeAntes });
    }
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const saida = [];
    const m = this.mundo;

    for (const nome of COM_TEMPO) {
      const e = this.efeitos[nome];
      if (e && e.ate <= this.t) {
        delete this.efeitos[nome];
        if (nome === "inverte") {
          m.mods.gravidade = 1;
          this.susto = this.t + (this.cfg.piloto.sustoInversao || 0) * 0.5;
          saida.push({ tipo: "inverteu", ligado: false });
        }
        saida.push({ tipo: "fim", efeito: nome });
      }
    }
    this.surpresa(saida);

    if (this.fase === "preparo") {
      m.pairar(dt);
      if (this.t >= this.fimFase) {
        this.fase = "voo";
        m.gerar = true;
        saida.push({ tipo: "voo", numero: this.voos });
        for (const p of this.pendentes.splice(0)) {
          saida.push({ tipo: "aplicado", id: p.j.id, time: p.time, faixa: p.faixa });
          saida.push(...this.aplicar(p.time, p.faixa, p.j, p.lendario));
        }
      }
      return saida;
    }

    if (this.fase === "morte") {
      m.passo(dt);
      if (this.t >= this.fimFase) {
        this.novoVoo();
        saida.push({ tipo: "novoVoo", numero: this.voos });
      }
      return saida;
    }

    const vento = this.efeitos.vento;
    m.mods.vento = this.ativo("vento")
      ? 2100 * vento.forca * (Math.sin(this.t * 3.1 + vento.fase) * 0.8 + Math.sin(this.t * 7.7) * 0.35)
      : 0;
    m.mods.turbo = this.ativo("turbo");
    m.queijo = !!(this.evento && this.evento.nome === "queijo");
    if (this.ativo("meteoros") && this.t >= this.proximoMeteoro) {
      m.lancar("meteoro", this.efeitos.meteoros.dono);
      this.proximoMeteoro = this.t + 0.5 + this.aleatorio() * 0.35;
    }

    const escala = this.ativo("lento") ? 0.6 : 1;
    for (const ev of m.passo(dt * escala)) {
      if (ev.tipo === "ponto") {
        this.somarPontos(this.ativo("turbo") || (this.evento && this.evento.nome === "dobro") ? 2 : 1, saida);
        saida.push({ tipo: "ponto", pontos: this.pontos, pilar: ev.pilar });
      } else if (ev.tipo === "queijo") {
        this.somarPontos(1, saida);
        saida.push(ev);
      } else if (ev.tipo === "colisao") {
        this.colisao(ev, saida);
        if (this.fase !== "voo") break;
      } else saida.push(ev);
    }
    return saida;
  }

  colisao(ev, saida) {
    const m = this.mundo;
    const borda = ev.com === "chao" || ev.com === "teto";
    const projetil = ev.com === "chinelo" || ev.com === "meteoro";

    if (this.ativo("turbo")) {
      if (ev.com === "pilar") { m.quebrar(ev.obj); saida.push({ tipo: "quebrou", pilar: ev.obj }); }
      if (projetil) { m.remover(ev.obj); saida.push({ tipo: "rebateu", proj: ev.obj }); }
      if (borda) m.quicar();
      return;
    }
    if (this.t < this.invencivelAte) {
      if (borda) m.quicar();
      if (projetil) m.remover(ev.obj);
      return;
    }
    const salvar = (por, dono, segundos) => {
      this.invencivelAte = this.t + segundos;
      if (borda) m.quicar();
      if (projetil) m.remover(ev.obj);
      if (ev.com === "pilar") ev.obj.atravessado = true;
      saida.push({ tipo: "salvou", por, dono, com: ev.com, obj: ev.obj });
    };
    if (this.ativo("escudo")) {
      const dono = this.efeitos.escudo.dono;
      delete this.efeitos.escudo;
      return salvar("escudo", dono, 1.1);
    }
    if (this.vidas > 0) {
      this.vidas--;
      return salvar("vida", null, 2);
    }
    this.morrer(ev, saida);
  }

  /* Quem derrubou: o dono do que bateu (chinelo, meteoro, pilar gigante);
     senão quem mandou a sabotagem mais recente ainda valendo (ou que
     acabou há menos de 1,5 s). Sem nada disso, caiu sozinho. */
  culpado(ev) {
    if (ev.obj && ev.obj.dono) {
      const causa = ev.com === "pilar" ? "gigante" : ev.com;
      return { dono: ev.obj.dono, causa };
    }
    let melhor = null;
    for (const r of this.recentes) {
      if (r.efeito === "gigante") continue;
      const e = this.efeitos[r.efeito];
      const valendo = e && e.ate > this.t - 1.5;
      const acabouAgora = !e && this.t - r.t < this.cfg.faixas.find(f => f.caos.efeito === r.efeito).caos.dur + 1.5;
      if ((valendo || acabouAgora) && (!melhor || r.t >= melhor.t)) melhor = r;
    }
    return melhor ? { dono: melhor.dono, causa: melhor.efeito } : { dono: null, causa: ev.com };
  }

  morrer(ev, saida) {
    const { dono, causa } = this.culpado(ev);
    this.fase = "morte";
    this.fimFase = this.t + this.cfg.telaMorte;
    this.mundo.matar();
    let matador = null;
    if (dono) {
      matador = this.jogadores.get(dono.id) || null;
      if (matador) matador.abates++;
    }
    this.morte = { dono, causa, com: ev.com, pontos: this.pontos, recorde: this.recordeLive, bateuRecorde: this.bateuRecorde };
    saida.push({ tipo: "morreu", ...this.morte, matador });
  }

  /* ───────── evento-surpresa ───────── */

  surpresa(saida) {
    const s = this.cfg.surpresa;
    if (this.evento) {
      if (this.t >= this.evento.ate) {
        saida.push({ tipo: "fimEvento", evento: this.evento.nome });
        this.evento = null;
        this.mundo.queijo = false;
        this.fimUltimoEvento = this.t;
      }
      return;
    }
    if (!s.ligada || this.fase !== "voo") return;
    if (this.t - this.ultimoPresente < s.semPresente || this.t - this.fimUltimoEvento < s.intervalo) return;
    saida.push(this.iniciarEvento(s.ordem[this.rodizio++ % s.ordem.length]));
  }

  iniciarEvento(nome) {
    const dur = this.cfg.surpresa.duracao[nome];
    this.evento = { nome, inicio: this.t, ate: this.t + dur };
    if (nome === "queijo") this.mundo.queijo = true;
    return { tipo: "evento", evento: nome, dur };
  }

  encerrarEvento() {
    if (!this.evento) return [];
    this.evento.ate = this.t;
    const saida = [];
    this.surpresa(saida);
    return saida;
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { Partida, normalizar, hashTexto };
