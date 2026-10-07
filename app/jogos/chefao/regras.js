/* Regras do Chefão Coletivo: vida, escudo, fúria, contra-ataque, cura,
   evento-surpresa, golpe final, dano guardado e placares.
   Sem DOM e sem relógio próprio (o `agora` vem de fora, em ms) e com o
   sorteio injetável, pra rodar igual no navegador e no `node --test`.

   Cada ação devolve uma lista de acontecimentos ({tipo, ...}) que a tela
   anima. A regra é instantânea; quem atrasa o número até o golpe chegar
   no chefão é a cena. */
"use strict";

const ROMANOS = ["", "", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

class Raid {
  constructor(config, aleatorio = Math.random) {
    this.cfg = config;
    this.aleatorio = aleatorio;
    this.zerar(0);
  }

  zerar(agora) {
    this.jogadores = new Map();
    this.moedas = 0;
    this.derrotados = 0;
    this.rodada = 0;
    this.evento = null;
    this.rodizio = 0;
    this.ultimoPresente = agora;
    this.fimUltimoEvento = agora;
    this.guardado = new Map();
    this.proximoEm = 0;
    this.chefe = null;
    this.novoChefe(agora);
  }

  /* ───────── consultas ───────── */

  jogador(quem) {
    let j = this.jogadores.get(quem.id);
    if (!j) {
      j = { id: quem.id, nome: quem.nome || quem.id, foto: quem.foto || null,
        dano: 0, moedas: 0, ultimoComentario: -Infinity, curtidas: 0, curtidasPagas: 0,
        ultimoSocoCurtida: -Infinity, seguiu: false };
      this.jogadores.set(quem.id, j);
    } else {
      if (quem.nome) j.nome = quem.nome;
      if (quem.foto) j.foto = quem.foto;
    }
    return j;
  }

  vidaDaRodada(rodada) {
    const lista = this.cfg.vida;
    if (rodada < lista.length) return lista[rodada];
    const extra = rodada - lista.length + 1;
    return Math.round(lista[lista.length - 1] * Math.pow(this.cfg.crescimento, extra) / 100) * 100;
  }

  /* Faixa do envio inteiro (combo somado); -1 pra presente sem valor. */
  faixa(moedas) {
    let f = -1;
    this.cfg.faixas.forEach((x, i) => { if (moedas >= x.moedas) f = i; });
    return f;
  }

  multiplicador(agora, origem) {
    let m = 1;
    const ev = this.evento;
    const vale = !(this.cfg.modoSeguro && origem === "presente");
    if (ev && vale && this.cfg.surpresa.multiplicador[ev.tipo]) m *= this.cfg.surpresa.multiplicador[ev.tipo];
    if (this.chefe && agora < this.chefe.tontoAte) m *= this.cfg.contra.tontoDano;
    return m;
  }

  fracao() {
    const c = this.chefe;
    return c.vida / c.vidaMax;
  }

  /* O que falta pra derrubar: o escudo primeiro, se estiver de pé. */
  faltam() {
    const c = this.chefe;
    if (c.estado !== "luta") return null;
    return c.escudo > 0 ? { alvo: "escudo", valor: Math.ceil(c.escudo) } : { alvo: "vida", valor: Math.ceil(c.vida) };
  }

  /* Menor presente comum que, sozinho, tira `valor` de dano. */
  sugestao(valor, agora) {
    const m = this.multiplicador(agora);
    return this.cfg.sugestoes.find(s => s.moedas * this.cfg.danoPorMoeda * m >= valor) || null;
  }

  ranking(n = 5, chefe = this.chefe) {
    return [...chefe.dano.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, dano]) => ({ ...this.jogadores.get(id), danoChefe: dano }));
  }

  rankingLive(n = 5) {
    return [...this.jogadores.values()].filter(j => j.dano > 0).sort((a, b) => b.dano - a.dano).slice(0, n);
  }

  doadores(n = 3) {
    return [...this.jogadores.values()].filter(j => j.moedas > 0).sort((a, b) => b.moedas - a.moedas).slice(0, n);
  }

  /* ───────── chefão ───────── */

  novoChefe(agora) {
    const lista = this.cfg.chefes;
    const def = lista[this.rodada % lista.length];
    const volta = Math.floor(this.rodada / lista.length) + 1;
    const vidaMax = this.vidaDaRodada(this.rodada);
    this.chefe = {
      def,
      numero: this.rodada + 1,
      nome: volta > 1 ? `${def.nome} ${ROMANOS[volta] || volta}` : def.nome,
      vidaMax,
      vida: vidaMax,
      escudo: 0,
      escudoMax: 0,
      furia: false,
      escudoUsado: false,
      inicio: agora,
      dano: new Map(),
      ultimoDano: agora,
      ultimaCura: agora,
      curaResto: 0,
      curando: false,
      contra: null,
      proximoContra: agora + this.cfg.contra.primeiro * 1000,
      tontoAte: 0,
      avisouFaltam: false,
      estado: "luta",
      golpeFinal: null,
    };
    const lista2 = [{ tipo: "novoChefe", chefe: this.chefe }];

    /* Presente da tela de vitória entra agora, até um teto: chefão que
       nasce morto não tem graça. */
    let teto = Math.floor(vidaMax * this.cfg.guardadoMax);
    for (const [id, dano] of this.guardado) {
      if (teto <= 0) break;
      const parte = Math.min(dano, teto);
      teto -= parte;
      lista2.push(...this.bater(this.jogadores.get(id), parte, { origem: "guardado", semMultiplicador: true }, agora));
    }
    this.guardado = new Map();
    return lista2;
  }

  /* ───────── entradas ───────── */

  comentario(quem, texto, agora) {
    const j = this.jogador(quem);
    const lista = [];
    const ev = this.evento;
    if (ev && ev.tipo === "mutirao" && !ev.feito) {
      ev.pessoas.add(j.id);
      lista.push({ tipo: "mutiraoEntrou", id: j.id, pessoas: ev.pessoas.size });
      if (ev.pessoas.size >= this.cfg.surpresa.mutirao.pessoas) lista.push(...this.mutirao(agora));
    }
    if (agora - j.ultimoComentario < this.cfg.comentario.espera * 1000) return lista;
    j.ultimoComentario = agora;
    lista.push(...this.bater(j, this.cfg.comentario.dano, { origem: "comentario" }, agora));
    return lista;
  }

  curtida(quem, curtidas, agora) {
    const j = this.jogador(quem);
    j.curtidas += Math.max(1, curtidas | 0);
    const { cada, dano, espera = 0, teto = Infinity } = this.cfg.curtida;
    const golpes = Math.floor((j.curtidas - j.curtidasPagas) / cada);
    if (golpes <= 0 || agora - j.ultimoSocoCurtida < espera * 1000) return [];
    /* Anti-farm: o que passa do teto se perde, não fica guardado pra depois. */
    j.curtidasPagas = j.curtidas - ((j.curtidas - j.curtidasPagas) % cada);
    j.ultimoSocoCurtida = agora;
    return this.bater(j, Math.min(golpes, teto) * dano, { origem: "curtida" }, agora);
  }

  seguiu(quem, agora) {
    const j = this.jogador(quem);
    if (j.seguiu) return [];
    j.seguiu = true;
    return [{ tipo: "seguiu", id: j.id }, ...this.bater(j, this.cfg.seguiu, { origem: "seguiu" }, agora)];
  }

  compartilhou(quem, agora) {
    const j = this.jogador(quem);
    return [{ tipo: "compartilhou", id: j.id }, ...this.bater(j, this.cfg.compartilhou, { origem: "compartilhou" }, agora)];
  }

  presente(quem, { nome, moedas, quantidade = 1 }, agora) {
    const j = this.jogador(quem);
    const valor = Math.max(0, Math.round(Number(moedas) || 0));
    const faixa = this.faixa(valor);
    j.moedas += valor;
    this.moedas += valor;
    if (valor > 0) this.ultimoPresente = agora;
    const lista = [{ tipo: "presente", id: j.id, nome, quantidade, moedas: valor, faixa }];
    if (faixa < 0) return lista;
    lista.push(...this.bater(j, valor * this.cfg.danoPorMoeda, { origem: "presente", faixa }, agora));
    return lista;
  }

  /* ───────── dano ───────── */

  bater(j, base, info, agora) {
    const c = this.chefe;
    if (c.estado !== "luta") {
      this.guardado.set(j.id, (this.guardado.get(j.id) || 0) + base);
      return [{ tipo: "guardado", id: j.id, dano: base, origem: info.origem, faixa: info.faixa ?? -1 }];
    }
    const lista = [];
    const mult = info.semMultiplicador ? 1 : this.multiplicador(agora, info.origem);
    const dano = Math.round(base * mult);
    if (dano <= 0) return lista;

    c.ultimoDano = agora;
    if (c.curando) {
      c.curando = false;
      lista.push({ tipo: "curaParou" });
    }

    let noEscudo = 0;
    let resto = dano;
    if (c.escudo > 0) {
      noEscudo = Math.min(c.escudo, dano);
      c.escudo -= noEscudo;
      resto -= noEscudo;
    }
    const naVida = Math.min(c.vida, resto);
    c.vida -= naVida;

    c.dano.set(j.id, (c.dano.get(j.id) || 0) + dano);
    j.dano += dano;
    lista.push({
      tipo: "dano", id: j.id, dano, noEscudo, naVida, mult,
      origem: info.origem, faixa: info.faixa ?? -1,
      critico: !!(this.evento && this.evento.tipo === "pontoFraco"),
    });
    if (noEscudo > 0 && c.escudo <= 0) lista.push({ tipo: "escudoQuebrado", id: j.id });

    if (c.contra) {
      c.contra.feito += dano;
      c.contra.por.set(j.id, (c.contra.por.get(j.id) || 0) + dano);
      if (c.contra.feito >= c.contra.meta && c.vida > 0) lista.push(this.interromper(agora));
    }

    if (c.vida <= 0) {
      lista.push(this.derrotar(j, agora));
      return lista;
    }

    const f = this.fracao();
    if (!c.furia && f <= this.cfg.fases.furia) {
      c.furia = true;
      lista.push({ tipo: "furia" });
    }
    if (!c.escudoUsado && f <= this.cfg.fases.escudo) {
      c.escudoUsado = true;
      c.escudo = c.escudoMax = Math.round(c.vidaMax * this.cfg.fases.escudoVida);
      lista.push({ tipo: "escudo", valor: c.escudo });
    }
    if (!this.cfg.modoSeguro && !c.avisouFaltam && f <= this.cfg.faltam) {
      c.avisouFaltam = true;
      lista.push({ tipo: "faltam", ...this.faltam() });
    }
    return lista;
  }

  interromper(agora) {
    const c = this.chefe;
    const quem = [...c.contra.por.entries()].sort((a, b) => b[1] - a[1])[0][0];
    c.contra = null;
    c.tontoAte = agora + this.cfg.contra.tonto * 1000;
    c.proximoContra = agora + this.intervaloContra() * 1000;
    return { tipo: "interrompido", id: quem, ate: c.tontoAte };
  }

  intervaloContra() {
    return this.chefe.furia ? this.cfg.contra.intervaloFuria : this.cfg.contra.intervalo;
  }

  derrotar(j, agora) {
    const c = this.chefe;
    c.estado = "derrotado";
    c.golpeFinal = j.id;
    c.fim = agora;
    c.contra = null;
    c.curando = false;
    c.escudo = 0;
    this.derrotados++;
    this.proximoEm = agora + this.cfg.vitoria * 1000;
    const ranking = this.ranking(3, c);
    return {
      tipo: "derrotado",
      chefe: c,
      golpeFinal: j.id,
      mvp: ranking[0].id,
      ranking,
      tempo: agora - c.inicio,
    };
  }

  mutirao(agora) {
    const ev = this.evento;
    ev.feito = true;
    const lista = [];
    if (this.chefe.estado === "luta") {
      const total = Math.round(this.chefe.vidaMax * this.cfg.surpresa.mutirao.dano);
      const ids = [...ev.pessoas];
      const parte = Math.ceil(total / ids.length);
      lista.push({ tipo: "mutirao", ids, dano: total });
      for (const id of ids) {
        if (this.chefe.estado !== "luta") break;
        lista.push(...this.bater(this.jogadores.get(id), parte, { origem: "mutirao", semMultiplicador: true }, agora));
      }
    }
    lista.push(this.encerrarEvento(agora));
    return lista;
  }

  /* ───────── relógio ───────── */

  tick(agora) {
    const lista = [];
    const c = this.chefe;
    const cfg = this.cfg;

    if (c.estado === "derrotado") {
      if (agora >= this.proximoEm) {
        this.rodada++;
        lista.push(...this.novoChefe(agora));
      }
    } else {
      if (c.contra && agora >= c.contra.fim) {
        const cura = Math.min(c.vidaMax - c.vida, Math.round(c.vidaMax * cfg.contra.cura));
        c.vida += cura;
        c.contra = null;
        c.proximoContra = agora + this.intervaloContra() * 1000;
        if (this.fracao() > cfg.faltam) c.avisouFaltam = false;
        lista.push({ tipo: "contraAcertou", cura });
      } else if (!c.contra && agora >= c.proximoContra) {
        const ativo = agora - c.ultimoDano <= cfg.contra.ativoNos * 1000;
        if (ativo && c.vida < c.vidaMax && agora >= c.tontoAte) {
          c.contra = {
            inicio: agora,
            fim: agora + cfg.contra.duracao * 1000,
            meta: Math.round(c.vidaMax * cfg.contra.meta),
            feito: 0,
            por: new Map(),
          };
          lista.push({ tipo: "contra", meta: c.contra.meta, fim: c.contra.fim });
        } else {
          c.proximoContra = agora + 10000;
        }
      }

      const parado = agora - c.ultimoDano >= cfg.curaParado.depois * 1000;
      if (parado && !c.contra && c.vida < c.vidaMax) {
        if (!c.curando) {
          c.curando = true;
          c.curaResto = 0;
          lista.push({ tipo: "curando" });
        } else {
          c.curaResto += c.vidaMax * cfg.curaParado.porSegundo * (agora - c.ultimaCura) / 1000;
          const inteiro = Math.floor(c.curaResto);
          c.curaResto -= inteiro;
          c.vida = Math.min(c.vidaMax, c.vida + inteiro);
          if (this.fracao() > cfg.faltam) c.avisouFaltam = false;
          if (c.vida >= c.vidaMax) {
            c.curando = false;
            lista.push({ tipo: "curaParou", cheia: true });
          }
        }
      }
      c.ultimaCura = agora;
    }

    if (this.evento && agora >= this.evento.fim) lista.push(this.encerrarEvento(agora));
    const s = cfg.surpresa;
    if (!this.evento && s.ligada && this.chefe.estado === "luta"
      && agora - this.ultimoPresente >= s.semPresente * 1000
      && agora - this.fimUltimoEvento >= s.intervalo * 1000) {
      const ordem = this.ordemSurpresa();
      lista.push(this.surpresa(ordem[this.rodizio++ % ordem.length], agora));
    }
    return lista;
  }

  /* No modo seguro some o evento que é só "presente vale mais". */
  ordemSurpresa() {
    const ordem = this.cfg.surpresa.ordem;
    return this.cfg.modoSeguro ? ordem.filter(t => t !== "dobro") : ordem;
  }

  surpresa(tipo, agora) {
    const dur = this.cfg.surpresa.duracao[tipo] || 30;
    this.evento = { tipo, inicio: agora, fim: agora + dur * 1000, pessoas: new Set(), feito: false };
    return { tipo: "evento", evento: tipo, fim: this.evento.fim };
  }

  encerrarEvento(agora) {
    const ev = this.evento;
    this.evento = null;
    this.fimUltimoEvento = agora;
    return { tipo: "fimEvento", evento: ev.tipo, pessoas: ev.pessoas.size, feito: ev.feito };
  }

  /* Tecla A do painel e teste: força o contra-ataque agora. */
  forcarContra(agora) {
    const c = this.chefe;
    if (c.estado !== "luta" || c.contra) return [];
    c.ultimoDano = Math.max(c.ultimoDano, agora - 1);
    c.proximoContra = agora;
    if (c.vida >= c.vidaMax) c.vida = c.vidaMax - 1;
    c.tontoAte = 0;
    return this.tick(agora).filter(a => a.tipo === "contra");
  }
}

if (typeof module !== "undefined") module.exports = { Raid };
