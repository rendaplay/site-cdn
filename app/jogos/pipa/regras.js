/* Regras do Pipa Combate: quem está no céu, relos, cortes, ataques de
   presente, escudo, rei do céu, cobrança, eventos-surpresa e placar.
   Sem DOM e sem relógio próprio (o `agora` vem de fora, em ms) e com o
   sorteio injetável, pra rodar igual no navegador e no `node --test`.

   Cada ação devolve uma lista de acontecimentos ({tipo, ...}) que a tela
   anima. Um relo dura alguns segundos: a regra marca o começo e decide o
   corte no `tick` em que ele termina, e a tela usa esse intervalo pra
   aproximar as pipas e cruzar as linhas. */
"use strict";

/* "aparei" vale em qualquer lugar da frase e com letra esticada
   ("eu apareiii"); "minha" só no começo, senão "a minha caiu" levava. */
const COMANDOS_APARAR = /(^|\s)(apare+i+|apara+r?|pegue+i+)(\s|$)|^(e |eh )?minha\b/;

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

class Combate {
  constructor(config, aleatorio = Math.random) {
    this.cfg = config;
    this.aleatorio = aleatorio;
    /* A tela informa a distância entre duas pipas (px do palco), pro relo
       natural juntar vizinhas. Sem tela, todo mundo está "perto". */
    this.distancia = () => 0;
    this.zerar(0);
  }

  zerar(agora) {
    this.pipas = new Map();
    this.jogadores = new Map();
    this.duelos = [];
    this.ataques = [];
    this.moedas = 0;
    this.evento = null;
    this.rodizio = 0;
    this.proximoRelo = agora + this.cfg.relo.primeiro * 1000;
    this.ultimoPresente = agora;
    this.fimUltimoEvento = agora;
    this.reiAtual = null;
    this.reiDesde = agora;
    this.recordeCeu = null;
    this._duelo = 0;
  }

  /* ───────── consultas ───────── */

  jogador(quem) {
    let j = this.jogadores.get(quem.id);
    if (!j) {
      j = { id: quem.id, nome: quem.nome || quem.id, foto: quem.foto || null,
        cortes: 0, moedas: 0, cortadoPor: null, cortadoEm: -Infinity, curtidas: 0, ultimoGas: -Infinity };
      this.jogadores.set(quem.id, j);
    } else {
      if (quem.nome) j.nome = quem.nome;
      if (quem.foto) j.foto = quem.foto;
    }
    return j;
  }

  faixaDe(moedas) {
    let f = -1;
    this.cfg.faixas.forEach((x, i) => { if (moedas >= x.moedas) f = i; });
    return f;
  }

  forca(p, agora) {
    return 1 + p.gas * this.cfg.gas.forca + (p.faixa + 1) * 0.25 + (p.dourada ? 0.5 : 0);
  }

  protegida(p, agora) { return p.escudoAte > agora; }
  ocupada(p) { return this.duelos.some(d => d.a === p.id || d.b === p.id); }
  atacando(id) { return this.ataques.some(a => a.autor === id); }

  rei(agora) {
    let melhor = null;
    for (const p of this.pipas.values()) {
      if (agora - p.entrouEm < this.cfg.rei.minimo * 1000) continue;
      if (!melhor || p.entrouEm < melhor.entrouEm) melhor = p;
    }
    return melhor;
  }

  ranking(n = 5) {
    return [...this.jogadores.values()]
      .filter(j => j.cortes > 0)
      .sort((a, b) => b.cortes - a.cortes || a.ultimoCorte - b.ultimoCorte)
      .slice(0, n);
  }

  doadores(n = 3) {
    return [...this.jogadores.values()]
      .filter(j => j.moedas > 0)
      .sort((a, b) => b.moedas - a.moedas)
      .slice(0, n);
  }

  /* ───────── entrada no céu ───────── */

  soltar(j, agora, motivo, forcar = false) {
    const lista = [];
    if (this.pipas.has(j.id)) return lista;
    if (this.pipas.size >= this.cfg.maxPipas) {
      const sai = this.recolhivel(agora);
      if (sai) {
        this.pipas.delete(sai.id);
        lista.push({ tipo: "saiu", id: sai.id, motivo: "lotado" });
      } else if (!forcar || this.pipas.size >= this.cfg.tetoPipas) {
        lista.push({ tipo: "lotado", id: j.id });
        return lista;
      }
    }
    const p = { id: j.id, entrouEm: agora, ultimaAtividade: agora, gas: 0, gasEm: agora,
      faixa: -1, escudoAte: 0, giganteAte: 0, fogoAte: 0, dourada: false };
    this.pipas.set(j.id, p);
    lista.push({ tipo: "entrou", id: j.id, motivo });
    return lista;
  }

  /* Céu cheio: sai quem está parado há mais tempo e não tem nada em jogo
     (presente, escudo, relo, coroa). */
  recolhivel(agora) {
    const rei = this.rei(agora);
    let alvo = null;
    for (const p of this.pipas.values()) {
      if (p.faixa >= 0 || p.dourada || this.protegida(p, agora) || this.ocupada(p) || this.atacando(p.id)) continue;
      if (rei && rei.id === p.id) continue;
      if (!alvo || p.ultimaAtividade < alvo.ultimaAtividade) alvo = p;
    }
    return alvo;
  }

  /* ───────── eventos da live ───────── */

  comentario(quem, texto, agora) {
    const j = this.jogador(quem);
    const t = normalizar(texto);
    const lista = [];
    const ev = this.evento;

    if (ev && ev.tipo === "avoada" && !ev.dono && COMANDOS_APARAR.test(t)) {
      return lista.concat(this.aparar(j, agora));
    }
    if (ev && ev.tipo === "avoada" && !ev.dono) {
      /* Reinsere pra a ordem do Map ficar a do último comentário (desempate). */
      const n = (ev.comentaram.get(j.id) || 0) + 1;
      ev.comentaram.delete(j.id);
      ev.comentaram.set(j.id, n);
    }
    if (ev && ev.tipo === "ventania" && this.pipas.has(j.id) && !ev.seguraram.has(j.id)) {
      ev.seguraram.add(j.id);
      lista.push({ tipo: "segurou", id: j.id });
    }

    const p = this.pipas.get(j.id);
    if (!p) {
      if (agora - j.cortadoEm < this.cfg.reentrada * 1000) return lista;
      return lista.concat(this.soltar(j, agora, "comentou"));
    }
    p.ultimaAtividade = agora;
    if (agora - j.ultimoGas < this.cfg.gas.espera * 1000) return lista;
    j.ultimoGas = agora;
    if (p.gas < this.cfg.gas.max) p.gas++;
    p.gasEm = agora;
    lista.push({ tipo: "gas", id: j.id, gas: p.gas });
    return lista;
  }

  presente(quem, { nome, moedas, quantidade = 1 }, agora) {
    const j = this.jogador(quem);
    moedas = Math.max(0, Number(moedas) || 0);
    j.moedas += moedas;
    this.moedas += moedas;
    this.ultimoPresente = agora;
    let faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    const dourado = !!(this.evento && this.evento.tipo === "dourado");
    if (dourado) faixa = Math.min(this.cfg.faixas.length - 1, faixa + 1);
    const f = this.cfg.faixas[faixa];

    const lista = this.soltar(j, agora, "presente", true);
    const p = this.pipas.get(j.id);
    lista.push({ tipo: "presente", id: j.id, faixa, moedas, nome, quantidade, dourado });
    if (!p) return lista;

    p.ultimaAtividade = agora;
    p.faixa = Math.max(p.faixa, faixa);
    if (f.escudo) p.escudoAte = Math.max(p.escudoAte, agora + f.escudo * 1000);
    if (f.gigante) p.giganteAte = Math.max(p.giganteAte, agora + f.gigante * 1000);
    if (f.fogo) p.fogoAte = Math.max(p.fogoAte, agora + this.cfg.ataque.fogoSegundos * 1000);

    /* Pagou e estava no meio de um relo natural: esse relo é dele. */
    for (const d of this.duelos) {
      if (d.tipo === "natural" && (d.a === j.id || d.b === j.id)) d.garantido = j.id;
    }
    const fila = this.ataques.find(a => a.autor === j.id);
    if (fila) {
      fila.restantes += f.cortes;
      fila.fogo = fila.fogo || !!f.fogo;
    } else {
      this.ataques.push({ autor: j.id, restantes: f.cortes, fogo: !!f.fogo, desde: agora });
    }
    return lista.concat(this.iniciarAtaques(agora));
  }

  curtida(quem, n, agora) {
    const j = this.jogador(quem);
    const p = this.pipas.get(j.id);
    /* Quem já voou e foi cortado volta com curtida também: é o que o chat
       mais faz, e sem isso o céu não se refaz depois de uma varrida. */
    if (!p) {
      if (j.cortadoEm === -Infinity || agora - j.cortadoEm < this.cfg.reentrada * 1000) return [];
      return this.soltar(j, agora, "voltou");
    }
    j.curtidas += Math.max(1, Number(n) || 1);
    p.ultimaAtividade = agora;
    const lista = [{ tipo: "curtiu", id: j.id }];
    while (j.curtidas >= this.cfg.gas.curtidas) {
      j.curtidas -= this.cfg.gas.curtidas;
      if (p.gas < this.cfg.gas.max) p.gas++;
      p.gasEm = agora;
      lista.push({ tipo: "gas", id: j.id, gas: p.gas });
    }
    return lista;
  }

  seguiu(quem, agora) {
    const j = this.jogador(quem);
    const lista = this.soltar(j, agora, "seguiu");
    lista.push({ tipo: "seguiu", id: j.id });
    return lista;
  }

  compartilhou(quem, agora) {
    const j = this.jogador(quem);
    const p = this.pipas.get(j.id);
    const lista = [{ tipo: "compartilhou", id: j.id }];
    if (p) {
      p.escudoAte = Math.max(p.escudoAte, agora + this.cfg.escudoCompartilhar * 1000);
      lista.push({ tipo: "escudo", id: j.id, ate: p.escudoAte });
    }
    return lista;
  }

  /* ───────── relos ───────── */

  livre(p, agora) {
    return !this.ocupada(p) && !this.protegida(p, agora);
  }

  /* Ataque de presente: cada autor corta um de cada vez, em fila. A
     cobrança (quem te cortou por último) tem prioridade sobre o resto. */
  iniciarAtaques(agora) {
    const lista = [];
    const emAtaque = () => this.duelos.filter(d => d.tipo === "ataque").length;
    const fogoAtivo = () => this.duelos.some(d => d.fogo);
    for (const at of [...this.ataques]) {
      const autor = this.pipas.get(at.autor);
      if (!autor) { this.ataques.splice(this.ataques.indexOf(at), 1); continue; }
      if (this.ocupada(autor)) continue;
      if (fogoAtivo() && !at.fogo) continue;
      if (!at.fogo && emAtaque() >= this.cfg.ataque.simultaneos) continue;
      const alvo = this.escolherAlvo(autor, agora);
      if (!alvo) {
        if (agora - at.desde > this.cfg.ataque.esperaMaxima * 1000) this.ataques.splice(this.ataques.indexOf(at), 1);
        continue;
      }
      const j = this.jogadores.get(autor.id);
      const dur = at.fogo ? this.cfg.ataque.fogo : this.cfg.ataque.duracao;
      const d = this.novoDuelo("ataque", autor.id, alvo.id, agora, dur);
      d.garantido = autor.id;
      d.fogo = at.fogo;
      d.cobranca = j.cortadoPor === alvo.id;
      at.restantes--;
      if (at.restantes <= 0) this.ataques.splice(this.ataques.indexOf(at), 1);
      lista.push({ tipo: "relo", duelo: d });
    }
    return lista;
  }

  escolherAlvo(autor, agora) {
    const j = this.jogadores.get(autor.id);
    const rival = j.cortadoPor && this.pipas.get(j.cortadoPor);
    if (rival && this.livre(rival, agora)) return rival;
    const candidatos = [...this.pipas.values()].filter(p => p.id !== autor.id && this.livre(p, agora));
    if (!candidatos.length) return null;
    candidatos.sort((a, b) => this.distancia(autor.id, a.id) - this.distancia(autor.id, b.id));
    const n = Math.min(3, candidatos.length);
    return candidatos[Math.floor(this.aleatorio() * n)];
  }

  reloNatural(agora) {
    /* Céu quase vazio não perde pipa de graça: quem chegou fica voando. */
    if (this.pipas.size < this.cfg.relo.minimoNoCeu) return null;
    /* Rei só cai por presente (ou vento): no relo natural a coroa trocava a
       toda hora. Quem acabou de subir também fica de fora um pouco. */
    const carencia = this.cfg.relo.carencia * 1000;
    const livres = [...this.pipas.values()].filter(p => this.livre(p, agora) && !this.atacando(p.id)
      && p.id !== this.reiAtual && agora - p.entrouEm >= carencia);
    if (livres.length < 2) return null;
    let a, b;
    /* Metade das vezes, se dá, o céu junta vítima e algoz. */
    const pendentes = livres.filter(p => {
      const rival = this.jogadores.get(p.id).cortadoPor;
      return rival && livres.some(q => q.id === rival);
    });
    if (pendentes.length && this.aleatorio() < 0.5) {
      a = pendentes[Math.floor(this.aleatorio() * pendentes.length)];
      b = this.pipas.get(this.jogadores.get(a.id).cortadoPor);
    } else {
      a = livres[Math.floor(this.aleatorio() * livres.length)];
      const outros = livres.filter(p => p !== a)
        .sort((x, y) => this.distancia(a.id, x.id) - this.distancia(a.id, y.id));
      b = outros[Math.floor(this.aleatorio() * Math.min(3, outros.length))];
    }
    const d = this.novoDuelo("natural", a.id, b.id, agora, this.cfg.relo.duracao);
    d.cobranca = this.jogadores.get(a.id).cortadoPor === b.id || this.jogadores.get(b.id).cortadoPor === a.id;
    return d;
  }

  novoDuelo(tipo, a, b, agora, segundos) {
    const d = { id: ++this._duelo, tipo, a, b, inicio: agora, fim: agora + segundos * 1000,
      garantido: null, cobranca: false, fogo: false };
    this.duelos.push(d);
    return d;
  }

  resolver(d, agora) {
    const pa = this.pipas.get(d.a);
    const pb = this.pipas.get(d.b);
    if (!pa || !pb) return [];
    let vence;
    if (d.garantido) vence = d.garantido;
    else {
      const fa = this.forca(pa, agora);
      const fb = this.forca(pb, agora);
      vence = this.aleatorio() * (fa + fb) < fa ? d.a : d.b;
    }
    const perde = vence === d.a ? d.b : d.a;
    const vitima = this.pipas.get(perde);
    if (this.protegida(vitima, agora)) return [{ tipo: "bloqueou", autor: vence, vitima: perde, duelo: d }];
    return this.cortar(vence, perde, agora, d);
  }

  cortar(autorId, vitimaId, agora, d = null) {
    const autor = this.jogadores.get(autorId);
    const vitima = this.jogadores.get(vitimaId);
    /* Só vale "derrubou o rei" com coroa de verdade: quem já estava com
       ela há alguns segundos, não o próximo da fila no meio de uma varrida. */
    const eraRei = this.reiAtual === vitimaId && agora - this.reiDesde >= this.cfg.rei.firme * 1000;
    const cobrou = autor.cortadoPor === vitimaId;
    const tempoNoAr = agora - this.pipas.get(vitimaId).entrouEm;

    this.pipas.delete(vitimaId);
    this.ataques = this.ataques.filter(a => a.autor !== vitimaId);
    this.duelos = this.duelos.filter(x => x === d || (x.a !== vitimaId && x.b !== vitimaId));
    autor.cortes++;
    autor.ultimoCorte = agora;
    if (cobrou) autor.cortadoPor = null;
    vitima.cortadoPor = autorId;
    vitima.cortadoEm = agora;
    const pa = this.pipas.get(autorId);
    if (pa) pa.ultimaAtividade = agora;
    const reiPor = eraRei ? agora - this.reiDesde : 0;
    return [{ tipo: "corte", autor: autorId, vitima: vitimaId, duelo: d, cobrou, eraRei, reiPor, tempoNoAr,
      fogo: !!(d && d.fogo), cortes: autor.cortes }];
  }

  /* ───────── eventos-surpresa ───────── */

  surpresa(tipo, agora) {
    const s = this.cfg.surpresa;
    if (this.cfg.modoSeguro && tipo === "dourado") return [];
    const dur = s.duracao[tipo];
    if (!dur) return [];
    this.evento = { tipo, inicio: agora, fim: agora + dur * 1000, seguraram: new Set(), comentaram: new Map(), dono: null };
    return [{ tipo: "evento", evento: tipo, fim: this.evento.fim }];
  }

  aparar(j, agora) {
    const lista = this.premiarAparar(j, agora, this.evento);
    lista.push({ tipo: "aparou", id: j.id });
    return lista.concat(this.encerrarEvento(agora), this.iniciarAtaques(agora));
  }

  premiarAparar(j, agora, ev) {
    const lista = this.soltar(j, agora, "aparou", true);
    const p = this.pipas.get(j.id);
    ev.dono = j.id;
    if (p) {
      p.dourada = true;
      p.ultimaAtividade = agora;
      p.escudoAte = Math.max(p.escudoAte, agora + this.cfg.surpresa.aparar.escudo * 1000);
      const fila = this.ataques.find(a => a.autor === j.id);
      if (fila) fila.restantes += this.cfg.surpresa.aparar.cortes;
      else this.ataques.push({ autor: j.id, restantes: this.cfg.surpresa.aparar.cortes, fogo: false, desde: agora });
    }
    return lista;
  }

  encerrarEvento(agora) {
    const ev = this.evento;
    if (!ev) return [];
    this.evento = null;
    this.fimUltimoEvento = agora;
    const lista = [];
    const fim = { tipo: "fimEvento", evento: ev.tipo, levou: [], dono: ev.dono };
    /* Ninguém escreveu "aparei" (chat que não lê a tela, conector --mock):
       a dourada enrosca na linha de quem mais comentou durante a descida. */
    if (ev.tipo === "avoada" && !ev.dono) {
      let melhor = null;
      for (const [id, n] of ev.comentaram) if (!melhor || n >= melhor.n) melhor = { id, n };
      if (melhor) {
        lista.push(...this.premiarAparar(this.jogadores.get(melhor.id), agora, ev));
        lista.push({ tipo: "aparou", id: melhor.id, naLinha: true });
        fim.dono = melhor.id;
        fim.naLinha = true;
      }
    }
    if (ev.tipo === "ventania") {
      const soltas = [...this.pipas.values()].filter(p =>
        !ev.seguraram.has(p.id) && this.livre(p, agora) && !this.atacando(p.id) && agora - p.entrouEm > 3000);
      for (let i = soltas.length - 1; i > 0; i--) {
        const k = Math.floor(this.aleatorio() * (i + 1));
        [soltas[i], soltas[k]] = [soltas[k], soltas[i]];
      }
      for (const p of soltas.slice(0, this.cfg.surpresa.ventaniaLeva)) {
        this.pipas.delete(p.id);
        const j = this.jogadores.get(p.id);
        j.cortadoEm = agora;
        fim.levou.push(p.id);
        lista.push({ tipo: "saiu", id: p.id, motivo: "vento" });
      }
    }
    return [fim, ...lista];
  }

  /* ───────── relógio ───────── */

  tick(agora) {
    const lista = [];
    for (const p of this.pipas.values()) {
      if (p.gas > 0 && agora - p.gasEm > this.cfg.gas.decai * 1000) { p.gas--; p.gasEm = agora; }
    }

    for (const d of this.duelos.filter(x => x.fim <= agora)) {
      if (!this.duelos.includes(d)) continue;
      this.duelos.splice(this.duelos.indexOf(d), 1);
      lista.push(...this.resolver(d, agora));
    }
    lista.push(...this.iniciarAtaques(agora));

    const naturais = this.duelos.filter(d => d.tipo === "natural").length;
    const fogo = this.duelos.some(d => d.fogo);
    if (agora >= this.proximoRelo) {
      const r = this.cfg.relo;
      const n = this.pipas.size;
      const lotacao = Math.min(1, n / 30);
      /* Céu cheio pede mais relo (o intervalo encurta até a metade); céu ralo
         pede menos, pra quem entra dar conta de repor quem cai. */
      const escassez = n < r.confortavel ? 1 + (r.confortavel - n) / 3 : 1;
      const espera = (r.intervaloMin + this.aleatorio() * (r.intervaloMax - r.intervaloMin)) * (1 - 0.5 * lotacao) * escassez;
      this.proximoRelo = agora + espera * 1000;
      if (!fogo && naturais < r.simultaneos) {
        const d = this.reloNatural(agora);
        if (d) lista.push({ tipo: "relo", duelo: d });
      }
    }

    const ev = this.evento;
    if (ev && ev.fim <= agora) lista.push(...this.encerrarEvento(agora));
    else if (!ev && this.cfg.surpresa.ligada) {
      const s = this.cfg.surpresa;
      const calmo = agora - Math.max(this.ultimoPresente, this.fimUltimoEvento) >= s.semPresente * 1000;
      if (calmo && agora - this.fimUltimoEvento >= s.intervalo * 1000 && this.pipas.size >= 2) {
        const ordem = this.cfg.modoSeguro ? s.ordem.filter(t => t !== "dourado") : s.ordem;
        const tipo = ordem[this.rodizio++ % ordem.length];
        lista.push(...this.surpresa(tipo, agora));
      }
    }

    const rei = this.rei(agora);
    const reiId = rei ? rei.id : null;
    if (reiId !== this.reiAtual) {
      lista.push({ tipo: "rei", id: reiId, antes: this.reiAtual });
      this.reiAtual = reiId;
      this.reiDesde = agora;
    }
    if (rei) {
      const t = agora - rei.entrouEm;
      if (!this.recordeCeu || t > this.recordeCeu.ms) this.recordeCeu = { id: rei.id, ms: t };
    }
    return lista;
  }
}

if (typeof module !== "undefined") module.exports = { Combate, normalizar };
