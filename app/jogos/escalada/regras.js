/* Regras da Escalada: altura, checkpoints, corda, times, ranking, recorde e
   evento-surpresa. Sem DOM e sem relógio próprio (o `agora`, em ms, vem de
   fora), pra rodar igual no navegador e no `node --test`.

   Cada ação devolve a lista de acontecimentos ({tipo, ...}) que a tela
   anima. A regra decide; a tela só conta o que aconteceu.

   Tudo é medido em metros de força. Ajuda soma altura. Derruba tira altura
   até a corda do último checkpoint; o que sobra desgasta a corda, e corda
   arrebentada solta ele até a de baixo com a força que restou.

   Presente de quem nunca escolheu time espera alguns segundos (pendente) a
   pessoa comentar 1 ou 2; sem resposta, vai pra Ajuda. */
"use strict";

const AJUDA = 0;
const DERRUBA = 1;
const EPS = 1e-9;
/* Abaixo disso, chegar na areia não é "queda": ele mal tinha saído do chão. */
const QUEDA_MINIMA = 20;
/* Perto da corda o bastante pra uma ajuda contar como resgate. */
const PERTO_DA_CORDA = 5;
const SURPRESAS = ["dobro", "chuva", "ventania"];
/* Dobro e ventania giram em torno de moeda; no modo seguro só fica a chuva (comentário). */
const SURPRESAS_SEGURAS = ["chuva"];

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hashTexto(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

class Escalada {
  constructor(config, agora = 0) {
    this.config = config;
    this.zerar(agora);
  }

  zerar(agora = 0) {
    this.altura = 0;
    this.piso = 0;
    this.dano = 0;
    this.tentativa = 1;
    this.maximaTentativa = 0;
    this.recorde = 0;
    this.recordeFestejado = false;
    /* Time de cada espectador. Vale a live inteira. */
    this.times = new Map();
    this.moedas = [0, 0];
    this.doadores = [new Map(), new Map()];
    this.ultimoComando = new Map();
    this.ultimoPresenteEm = agora;
    this.evento = null;
    this.fimUltimoEvento = -Infinity;
    this.rodizio = 0;
    /* Presentes de quem ainda não tem time, esperando o comentário 1/2. */
    this.pendentes = new Map();
    /* Glória do sabotador: a maior queda causada por alguém num golpe só. */
    this.maiorQueda = null;
    /* Sabotagem que sobra com o Zé já no chão atola ele na areia: a próxima
       ajuda cava antes de subir. Assim moeda de sabotador nunca some, e o
       mesmo valor dos dois lados continua se cancelando. */
    this.atolado = 0;
  }

  get regras() { return this.config.regras; }

  /* 0 a 1: quanto a corda de baixo já desgastou. */
  get desgaste() { return this.piso > 0 ? this.dano / this.regras.corda : 0; }

  get emDobro() { return !!this.evento && this.evento.tipo === "dobro"; }

  faixa(moedas) {
    let i = -1;
    this.config.faixas.forEach((min, k) => { if (moedas >= min) i = k; });
    return i;
  }

  timeDoPresente(nome) {
    const n = normalizar(nome);
    if (!n) return -1;
    return this.config.times.findIndex(t => t.presente.aceitos.some(a => normalizar(a) === n));
  }

  timeDoComando(texto) {
    const n = normalizar(texto);
    if (!n) return -1;
    return this.config.times.findIndex(t => t.comandos.some(c => normalizar(c) === n));
  }

  torcida(time) {
    let n = 0;
    for (const t of this.times.values()) if (t === time) n++;
    return n;
  }

  top(time, n = 3) {
    return [...this.doadores[time].values()]
      .sort((a, b) => b.moedas - a.moedas || a.desde - b.desde)
      .slice(0, n);
  }

  /* Metros de força de um presente. Linear até `retorno.acima` moedas (mesmo
     valor se cancela); acima disso cresce com a potência `retorno.expoente`
     do excesso relativo, pra um Leão não decidir a live sozinho. Placar e
     ranking contam as moedas inteiras. */
  forca(total) {
    const r = this.regras;
    const ret = r.retorno;
    if (!ret || !(ret.acima > 0) || total <= ret.acima) return total * r.metrosPorMoeda;
    return ret.acima * Math.pow(total / ret.acima, ret.expoente) * r.metrosPorMoeda;
  }

  quemDe(usuario) {
    const u = usuario || {};
    return { id: String(u.id || u.nome || "anon"), nome: u.nome || "anônimo", foto: u.foto || null };
  }

  /* ───────────── ações da live ───────────── */

  presente(ev, agora) {
    const total = Math.max(0, Math.round(ev.presente && ev.presente.total || 0));
    if (!total) return [];
    const quem = this.quemDe(ev.usuario);
    const nome = ev.presente.nome;
    const quantidade = ev.presente.quantidade || 1;
    const lote = [{ total, dobro: this.emDobro }];
    this.ultimoPresenteEm = agora;

    let time = this.timeDoPresente(nome);
    if (ev.mock) {
      /* `conector --mock` não tem quem comente 1/2 e quase só manda Rosa:
         cada espectador falso torce por um time fixo, senão a simulação
         seria só Ajuda. */
      time = hashTexto(quem.id) % 2;
      this.times.set(quem.id, time);
    } else if (time >= 0) this.times.set(quem.id, time);
    else if (this.times.has(quem.id)) time = this.times.get(quem.id);
    else if (this.regras.pendente > 0) return this.guardar(quem, lote[0], nome, quantidade, agora);
    else return this.aplicar(AJUDA, quem, lote, nome, quantidade, agora, { semTime: true });
    return this.aplicar(time, quem, lote, nome, quantidade, agora);
  }

  guardar(quem, item, nome, quantidade, agora) {
    const p = this.pendentes.get(quem.id) || { quem, lote: [], nomes: [], quantidade: 0, ate: 0 };
    p.quem = quem;
    p.lote.push(item);
    if (!p.nomes.includes(nome)) p.nomes.push(nome);
    p.quantidade += quantidade;
    /* Combo seguido estica a espera: quem ainda está mandando não decidiu. */
    p.ate = Math.max(p.ate, agora + this.regras.pendente * 1000);
    this.pendentes.set(quem.id, p);
    const total = p.lote.reduce((s, x) => s + x.total, 0);
    return [{ tipo: "pendente", quem, total, nomePresente: p.nomes.join(", "), ate: p.ate }];
  }

  liberar(id, time, agora, semTime = false) {
    const p = this.pendentes.get(id);
    if (!p) return [];
    this.pendentes.delete(id);
    return this.aplicar(time, p.quem, p.lote, p.nomes.join(", "), p.quantidade, agora, { semTime, liberado: true });
  }

  /* `lote`: [{total, dobro}], um presente ou os que esperaram juntos. Cada
     um rende a própria força, então juntar não muda o que valeria. */
  aplicar(time, quem, lote, nomePresente, quantidade, agora, extra = {}) {
    const total = lote.reduce((s, x) => s + x.total, 0);
    const metros = lote.reduce((s, x) => s + this.forca(x.total) * (x.dobro ? 2 : 1), 0);
    const dobro = lote.some(x => x.dobro);
    const linear = lote.reduce((s, x) => s + x.total * this.regras.metrosPorMoeda * (x.dobro ? 2 : 1), 0);

    this.moedas[time] += total;
    const d = this.doadores[time].get(quem.id) || { ...quem, moedas: 0, desde: agora };
    d.nome = quem.nome;
    d.foto = quem.foto || d.foto;
    d.moedas += total;
    this.doadores[time].set(quem.id, d);

    const faixa = this.faixa(total);
    const saida = [{
      tipo: "presente", time, quem, total, metros, faixa, semTime: false, liberado: false,
      efeito: this.config.times[time].efeitos[faixa],
      nomePresente, quantidade, dobro,
      destaque: total >= (this.config.destaqueMoedas || Infinity),
      lendario: total >= (this.config.lendarioMoedas || Infinity),
      amortecido: metros < linear - EPS,
      ...extra,
    }];

    const e = this.evento;
    if (e && e.tipo === "ventania" && time === AJUDA) {
      e.segurado += total;
      if (e.segurado >= e.meta) saida.push(...this.encerrarEvento(agora, quem));
    }
    saida.push(...(time === AJUDA ? this.subir(metros, quem) : this.descer(metros, quem)));
    return saida;
  }

  comentario(ev, agora) {
    const time = this.timeDoComando(ev.texto);
    if (time < 0) return [];
    const quem = this.quemDe(ev.usuario);
    const antes = this.times.get(quem.id);
    this.times.set(quem.id, time);
    const saida = antes === time ? [] : [{ tipo: "escolha", time, quem, trocou: antes !== undefined }];
    saida.push(...this.liberar(quem.id, time, agora));

    const chuva = this.evento && this.evento.tipo === "chuva" ? this.config.surpresa.chuva : null;
    const intervalo = (chuva ? chuva.intervalo : this.regras.comentario.intervalo) * 1000;
    const ultimo = this.ultimoComando.get(quem.id);
    if (ultimo != null && agora - ultimo < intervalo) return saida;
    this.ultimoComando.set(quem.id, agora);

    const metros = this.regras.comentario.metros * (chuva ? chuva.multiplicador : 1);
    saida.push({ tipo: "comando", time, quem, metros, chuva: !!chuva });
    saida.push(...(time === AJUDA ? this.subir(metros, quem) : this.descer(metros, quem)));
    return saida;
  }

  curtida(ev) {
    const curtidas = Math.max(1, Math.min(50, Math.round(ev.curtidas || 1)));
    const metros = curtidas * this.regras.curtida;
    return [{ tipo: "curtida", quem: this.quemDe(ev.usuario), curtidas, metros }, ...this.subir(metros, null)];
  }

  /* Seguiu e compartilhou: ajuda de graça, sempre pra cima. */
  apoio(ev) {
    const quem = this.quemDe(ev.usuario);
    const metros = ev.tipo === "seguiu" ? this.regras.seguiu : this.regras.compartilhou;
    return [{ tipo: ev.tipo, quem, metros }, ...this.subir(metros, quem)];
  }

  receber(ev, agora) {
    if (!ev) return [];
    if (ev.tipo === "presente") return this.presente(ev, agora);
    if (ev.tipo === "comentario") return this.comentario(ev, agora);
    if (ev.tipo === "curtida") return this.curtida(ev);
    if (ev.tipo === "seguiu" || ev.tipo === "compartilhou") return this.apoio(ev);
    return [];
  }

  /* ───────────── tempo ───────────── */

  passo(dt, agora) {
    const r = this.regras;
    const ritmo = this.altura < r.checkpoint ? r.arrancada || 1 : 1;
    const saida = this.subir(r.subidaSozinho * ritmo * dt, null);
    for (const [id, p] of this.pendentes) {
      if (agora >= p.ate) saida.push(...this.liberar(id, AJUDA, agora, true));
    }

    const s = this.config.surpresa;
    if (this.evento) {
      if (agora >= this.evento.ate) saida.push(...this.encerrarEvento(agora));
    } else if (s && s.ligada
      && agora - this.ultimoPresenteEm >= s.frio * 1000
      && agora - this.fimUltimoEvento >= s.intervalo * 1000) {
      saida.push(this.iniciarEvento(agora));
    }
    return saida;
  }

  get surpresas() { return this.config.modoSeguro ? SURPRESAS_SEGURAS : SURPRESAS; }

  iniciarEvento(agora, tipo = this.surpresas[this.rodizio++ % this.surpresas.length]) {
    const s = this.config.surpresa;
    const segundos = tipo === "dobro" ? s.dobro : s[tipo].segundos;
    this.evento = {
      tipo, inicio: agora, ate: agora + segundos * 1000, segundos,
      segurado: 0, meta: tipo === "ventania" ? s.ventania.segurar : 0,
    };
    return { tipo: "surpresa", evento: { ...this.evento } };
  }

  encerrarEvento(agora, quemSegurou = null) {
    const e = this.evento;
    if (!e) return [];
    this.evento = null;
    this.fimUltimoEvento = agora;
    if (e.tipo !== "ventania") return [{ tipo: "fimSurpresa", evento: e }];
    if (e.segurado >= e.meta) return [{ tipo: "segurou", evento: e, quem: quemSegurou }];
    const vento = { id: "vento", nome: "Ventania", foto: null, vento: true };
    return [{ tipo: "ventou", evento: e }, ...this.descer(this.config.surpresa.ventania.metros, vento)];
  }

  /* ───────────── física ───────────── */

  subir(metros, quem) {
    if (!(metros > 0)) return [];
    const r = this.regras;
    const saida = [];
    if (this.atolado > 0) {
      const cava = Math.min(metros, this.atolado);
      this.atolado -= cava;
      metros -= cava;
      if (this.atolado <= EPS) {
        this.atolado = 0;
        saida.push({ tipo: "desatolou", quem });
      }
      if (metros <= EPS) return saida;
    }
    if (quem && this.desgaste >= r.salvarCorda && this.altura - this.piso < PERTO_DA_CORDA) {
      saida.push({ tipo: "salvou", quem, desgaste: this.desgaste, altura: this.piso });
    }
    this.altura += metros;
    this.maximaTentativa = Math.max(this.maximaTentativa, this.altura);

    const cruzados = [];
    while (this.altura >= this.piso + r.checkpoint - EPS) {
      this.piso += r.checkpoint;
      this.dano = 0;
      cruzados.push(this.piso);
    }
    if (cruzados.length) saida.push({ tipo: "checkpoint", alturas: cruzados, altura: this.piso, quem });

    if (this.altura > this.recorde) {
      if (!this.recordeFestejado && this.recorde >= r.recordeMinimo) {
        saida.push({ tipo: "recorde", anterior: this.recorde, quem });
      }
      this.recordeFestejado = true;
      this.recorde = this.altura;
    }
    return saida;
  }

  descer(metros, quem) {
    if (!(metros > 0)) return [];
    const r = this.regras;
    const saida = [];
    const inicio = this.altura;
    let forca = metros;
    let desgastou = false;

    while (forca > EPS) {
      const livre = this.altura - this.piso;
      if (forca <= livre) { this.altura -= forca; forca = 0; break; }
      this.altura = this.piso;
      forca -= livre;
      if (this.piso <= 0) break;
      const golpe = Math.min(forca, r.corda - this.dano);
      this.dano += golpe;
      forca -= golpe;
      desgastou = true;
      if (this.dano >= r.corda - EPS) {
        saida.push({ tipo: "queda", de: this.piso, quem });
        this.piso -= r.checkpoint;
        this.dano = 0;
        desgastou = false;
      }
    }
    if (desgastou) saida.push({ tipo: "corda", desgaste: this.desgaste, altura: this.piso, quem });
    /* Com teto: atolado sem limite deixava a live parada no chão por minutos. */
    const vaga = (r.atoladoMax ?? Infinity) - this.atolado;
    if (forca > EPS && this.altura <= EPS && r.atolar !== false && vaga > EPS) {
      const atola = Math.min(forca, vaga);
      this.atolado += atola;
      saida.push({ tipo: "atolou", metros: atola, total: this.atolado, quem });
    }

    const queda = inicio - this.altura;
    const cordas = saida.filter(a => a.tipo === "queda").length;
    const areia = this.altura <= EPS && inicio > 0 && this.maximaTentativa >= QUEDA_MINIMA;
    if (cordas && !areia) saida.push({ tipo: "derrubada", quem, de: inicio, ate: this.altura, cordas });
    if (quem && !quem.vento && queda >= (r.recordeQueda || Infinity)
      && (!this.maiorQueda || queda > this.maiorQueda.metros + EPS)) {
      saida.push({ tipo: "recordeQueda", quem, metros: queda, anterior: this.maiorQueda ? this.maiorQueda.metros : 0 });
      this.maiorQueda = { metros: queda, quem };
    }

    if (areia) {
      saida.push({ tipo: "areia", quem, de: inicio, maxima: this.maximaTentativa, tentativa: this.tentativa });
      this.altura = 0;
      this.tentativa++;
      this.maximaTentativa = 0;
      this.recordeFestejado = false;
    }
    return saida;
  }
}

if (typeof module !== "undefined") module.exports = { Escalada, normalizar, hashTexto, AJUDA, DERRUBA };
