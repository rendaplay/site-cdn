/* Regras do Racha: inscrição, rodada, velocidade, presentes, ataques,
   ultrapassagem, pódio, rei da pista e evento-surpresa. Sem DOM e sem
   relógio próprio (o `agora`, em ms, vem de fora), pra rodar igual no
   navegador e no `node --test`.

   Cada ação devolve a lista de acontecimentos ({tipo, ...}) que a tela
   anima. A regra decide; a tela só conta o que aconteceu. */
"use strict";

const MODELOS = ["quadradinho", "besouro", "perua", "picape", "kombi", "moto", "sedan"];
const PESO_MODELO = [20, 16, 14, 14, 12, 12, 12];
const CORES_CARRO = 12;
const SURPRESAS = ["dobro", "chuva", "missil"];
/* No modo seguro fica só o evento que depende de comentário. */
const SURPRESAS_SEGURAS = ["chuva"];
/* Quanto tempo uma ação (presente, ataque, buzina) segura o carro na pista 3D. */
const DESTAQUE_MS = 6000;
/* Diferença mínima pra anunciar "faltam X m": colado não é chamada, é briga. */
const FALTA_MINIMA = 1;
/* Palavras que podem acompanhar a menção sem ela virar conversa:
   "turbo pro @fulano" muda o apoio, "@fulano kkkk que carro feio" não. */
const PALAVRAS_APOIO = new Set(["turbo", "nitro", "pro", "pra", "para", "vai", "forca", "apoio", "acelera",
  "bora", "o", "a", "no", "na", "do", "da", "manda", "tudo", "pelo", "pela", "time", "eh", "e"]);

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9@._]+/g, " ").trim();
}

function chaveNome(texto) {
  return normalizar(texto).replace(/[^a-z0-9]/g, "");
}

function hashTexto(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function escolherPorPeso(n, pesos) {
  let r = n % pesos.reduce((s, p) => s + p, 0);
  for (let i = 0; i < pesos.length; i++) if ((r -= pesos[i]) < 0) return i;
  return 0;
}

class Racha {
  constructor(config, agora = 0) {
    this.config = config;
    this.zerar(agora);
  }

  /* Zera a live inteira: pilotos, números, vitórias, moedas. */
  zerar(agora = 0) {
    this.pilotos = new Map();
    this.numero = 0;
    this.rodada = 1;
    this.fase = "espera";
    this.faseAte = agora + this.config.fases.espera * 1000;
    this.relogio = 0;
    this.ordem = [];
    this.posicoes = new Map();
    this.chegados = 0;
    this.retaFinal = false;
    this.vitorias = new Map();
    this.rei = null;
    this.podio = null;
    this.mvp = null;
    this.moedasLive = 0;
    this.doadores = new Map();
    this.ultimoPresenteEm = agora;
    this.evento = null;
    this.fimUltimoEvento = -Infinity;
    this.rodizio = 0;
    this.ultimaUltrapassagem = -Infinity;
    this.ultimaFalta = agora;
  }

  get pista() { return this.config.pista; }
  get correndo() { return this.fase === "corrida" || this.fase === "chegada"; }
  get chovendo() { return !!this.evento && this.evento.tipo === "chuva"; }
  get lider() { return this.ordem[0] || null; }

  /* Reta final e "nitro em dobro" não somam: vale o maior. */
  get multiplicador() {
    let m = 1;
    if (this.config.modoSeguro) return m;
    if (this.evento && this.evento.tipo === "dobro") m = 2;
    if (this.retaFinal) m = Math.max(m, this.config.retaFinal.multiplicador);
    return m;
  }

  posicao(p) { return this.posicoes.get(p.id) || 0; }

  emPista(p) { return !!p && p.correndo && p.chegada == null; }

  quemDe(usuario) {
    const u = usuario || {};
    return { id: String(u.id || u.nome || "anon"), nome: String(u.nome || u.id || "anônimo"), foto: u.foto || null };
  }

  ref(p) { return p ? { id: p.id, nome: p.nome, foto: p.foto, numero: p.numero, modelo: p.modelo, cor: p.cor } : null; }

  totalCorrendo() {
    let n = 0;
    for (const p of this.pilotos.values()) if (p.correndo) n++;
    return n;
  }

  /* ───────────── inscrição ───────────── */

  inscrever(quem, agora) {
    const h = hashTexto(quem.id);
    const p = {
      ...quem,
      numero: ++this.numero,
      modelo: escolherPorPeso(h, PESO_MODELO),
      cor: hashTexto(quem.id + "#") % CORES_CARRO,
      desde: agora,
      ultimaAcao: agora,
      acaoEm: -Infinity,
      apoio: null,
      moedasLive: 0,
      guardado: 0,
    };
    this.prepararRodada(p);

    const vagas = this.totalCorrendo() < this.config.maxPilotos;
    const atrasado = this.fase === "corrida";
    p.correndo = vagas && (this.fase === "espera" || this.fase === "largada" || atrasado);
    if (p.correndo && atrasado) p.d = this.rabeira();
    else if (p.correndo) p.d = -this.totalCorrendo() * 0.05;
    this.pilotos.set(p.id, p);
    if (p.correndo) this.ordenar();
    return [{ tipo: "entrou", piloto: this.ref(p), atrasado: p.correndo && atrasado, fila: !p.correndo }];
  }

  rabeira() {
    let d = Infinity;
    for (const p of this.pilotos.values()) if (this.emPista(p)) d = Math.min(d, p.d);
    return Number.isFinite(d) ? Math.max(0, d) : 0;
  }

  prepararRodada(p) {
    const h = hashTexto(p.id + ":" + this.rodada);
    p.d = 0;
    p.chegada = null;
    p.tempo = 0;
    p.impulso = { ate: 0, mult: 1 };
    p.lento = { ate: 0, mult: 1, tipo: null };
    p.escudoAte = 0;
    p.buzinas = 0;
    p.ultimaBuzina = -Infinity;
    p.moedasRodada = 0;
    p.acaoEm = -Infinity;
    p.perfil = ((h % 1000) / 1000 * 2 - 1) * this.config.variacao;
    p.f1 = (h % 628) / 100;
    p.f2 = ((h >> 4) % 628) / 100;
  }

  /* ───────────── ações da live ───────────── */

  receber(ev, agora) {
    if (!ev) return [];
    if (ev.tipo === "presente") return this.presente(ev, agora);
    if (ev.tipo === "comentario") return this.comentario(ev, agora);
    if (ev.tipo === "curtida") return this.curtida(ev, agora);
    if (ev.tipo === "seguiu" || ev.tipo === "compartilhou") return this.apoioGratis(ev, agora);
    return [];
  }

  comentario(ev, agora) {
    const quem = this.quemDe(ev.usuario);
    let p = this.pilotos.get(quem.id);
    const saida = [];
    const novo = !p;
    if (novo) {
      saida.push(...this.inscrever(quem, agora));
      p = this.pilotos.get(quem.id);
    } else {
      this.tocar(p, quem, agora);
    }

    const mencao = this.mencaoDe(ev.texto, p);
    if (mencao !== undefined && (mencao ? mencao.id : null) !== p.apoio) {
      p.apoio = mencao ? mencao.id : null;
      saida.push({ tipo: "apoio", quem: this.ref(p), alvo: this.ref(mencao) });
    }
    if (!novo) saida.push(...this.buzinar(p, agora));
    return saida;
  }

  /* Quem volta a interagir: atualiza nome/foto e, se a largada ainda não
     saiu, volta pra grade. */
  tocar(p, quem, agora) {
    p.nome = quem.nome || p.nome;
    p.foto = quem.foto || p.foto;
    p.ultimaAcao = agora;
    if (!p.correndo && (this.fase === "espera" || this.fase === "largada")
      && this.totalCorrendo() < this.config.maxPilotos) {
      this.prepararRodada(p);
      p.d = -this.totalCorrendo() * 0.05;
      p.correndo = true;
      this.ordenar();
    }
  }

  buzinar(p, agora) {
    if (!this.correndo || !this.emPista(p)) return [];
    const b = this.config.buzina;
    const chuva = this.chovendo ? this.config.surpresa.chuva : null;
    const intervalo = (chuva ? chuva.buzina : b.intervalo) * 1000;
    if (agora - p.ultimaBuzina < intervalo) return [];
    if (!chuva && p.buzinas >= b.maximo) return [];
    p.buzinas++;
    p.ultimaBuzina = agora;
    p.acaoEm = agora;
    const mult = chuva ? this.config.efeitos.turbo.multiplicador : b.multiplicador;
    this.impulsionar(p, mult, b.segundos, agora);
    return [{ tipo: "buzina", piloto: this.ref(p), chuva: !!chuva }];
  }

  /* undefined = o comentário não fala de apoio; null = "eu" (volta pra
     si); piloto = passa a empurrar ele. */
  mencaoDe(texto, autor) {
    const n = normalizar(texto);
    if (n === "eu") return null;
    const palavras = n.split(" ").filter(Boolean);
    const mencoes = palavras.filter(w => w.startsWith("@") && w.length > 1);
    if (!mencoes.length || palavras.some(w => !w.startsWith("@") && !PALAVRAS_APOIO.has(w))) return undefined;

    const alvoChave = chaveNome(mencoes[0]);
    if (alvoChave.length < 2) return undefined;
    let achado;
    for (const p of this.pilotos.values()) {
      if (chaveNome(p.id) === alvoChave || chaveNome(p.nome) === alvoChave) { achado = p; break; }
    }
    if (!achado && alvoChave.length >= 4) {
      for (const p of this.pilotos.values()) {
        if (chaveNome(p.id).startsWith(alvoChave) || chaveNome(p.nome).startsWith(alvoChave)) { achado = p; break; }
      }
    }
    if (!achado) return undefined;
    return achado.id === autor.id ? null : achado;
  }

  curtida(ev, agora) {
    const p = this.pilotos.get(this.quemDe(ev.usuario).id);
    if (!p) return [];
    p.ultimaAcao = agora;
    if (!this.correndo || !this.emPista(p)) return [];
    const c = this.config.curtida;
    if (agora - (p.ultimaCurtida ?? -Infinity) < (c.intervalo || 0) * 1000) return [];
    p.ultimaCurtida = agora;
    const curtidas = Math.max(1, Math.min(c.maximo, Math.round(ev.curtidas || 1)));
    p.d = Math.min(this.pista - 0.01, p.d + curtidas * c.metros);
    return [{ tipo: "curtida", piloto: this.ref(p), curtidas }];
  }

  apoioGratis(ev, agora) {
    const p = this.pilotos.get(this.quemDe(ev.usuario).id);
    if (!p) return [];
    p.ultimaAcao = agora;
    const segundos = ev.tipo === "seguiu" ? this.config.seguiu : this.config.compartilhou;
    const efeito = ev.tipo === "seguiu" ? "turbo" : "nitro";
    if (this.correndo && this.emPista(p)) {
      this.impulsionar(p, this.config.efeitos[efeito].multiplicador, segundos, agora);
      p.acaoEm = agora;
    }
    return [{ tipo: ev.tipo, piloto: this.ref(p), efeito }];
  }

  faixaDe(total) {
    let i = -1;
    this.config.faixas.forEach((f, k) => { if (total >= f.moedas) i = k; });
    return i;
  }

  efeitoDe(total) {
    const faixa = this.faixaDe(total);
    if (faixa < 0) return { faixa, efeito: null };
    let efeito = this.config.faixas[faixa].efeito;
    const s = this.config.surpresa;
    if (this.evento && this.evento.tipo === "missil" && efeito === "oleo" && total >= s.missil.moedas) efeito = "missil";
    return { faixa, efeito };
  }

  presente(ev, agora) {
    const total = Math.max(0, Math.round(ev.presente && ev.presente.total || 0));
    if (!total) return [];
    const quem = this.quemDe(ev.usuario);
    const saida = [];

    let doador = this.pilotos.get(quem.id);
    if (!doador) {
      saida.push(...this.inscrever(quem, agora));
      doador = this.pilotos.get(quem.id);
    } else this.tocar(doador, quem, agora);

    this.moedasLive += total;
    this.ultimoPresenteEm = agora;
    doador.moedasLive += total;
    doador.moedasRodada += total;
    const d = this.doadores.get(quem.id) || { ...quem, moedas: 0, desde: agora };
    d.nome = quem.nome;
    d.foto = quem.foto || d.foto;
    d.moedas += total;
    this.doadores.set(quem.id, d);

    const apoiado = doador.apoio && this.pilotos.get(doador.apoio);
    const alvo = apoiado && apoiado.correndo ? apoiado : doador;
    const { faixa, efeito } = this.efeitoDe(total);
    const mult = this.multiplicador;
    const anuncio = {
      tipo: "presente", quem: this.ref(doador), alvo: this.ref(alvo), para: alvo !== doador,
      efeito, faixa, total, nomePresente: ev.presente.nome || "", quantidade: ev.presente.quantidade || 1,
      dobro: mult > 1, largada: false,
    };
    saida.push(anuncio);
    if (!efeito) return saida;

    if (!this.correndo || !this.emPista(alvo)) {
      /* Fora da corrida o presente vira nitro guardado pra largada. */
      if (alvo.chegada == null) {
        anuncio.largada = true;
        alvo.guardado = Math.min(30, alvo.guardado + this.segundosDeNitro(efeito, total));
        alvo.acaoEm = agora;
      }
      return saida;
    }

    alvo.acaoEm = agora;
    const e = this.config.efeitos;
    const nitro = s => this.impulsionar(alvo, e.nitro.multiplicador, s * mult, agora);
    if (efeito === "turbo") {
      this.impulsionar(alvo, e.turbo.multiplicador, this.segundosTurbo(total) * mult, agora);
    } else if (efeito === "nitro") {
      nitro(this.segundosNitro(total));
    } else if (efeito === "oleo") {
      const pos = this.ordem.indexOf(alvo);
      const frente = this.ordem.slice(0, pos).reverse().find(p => this.emPista(p))
        || this.ordem.slice(pos + 1).find(p => this.emPista(p));
      if (frente) saida.push(this.atingir(frente, "oleo", e.oleo, agora, alvo));
      nitro(e.oleo.nitro);
    } else if (efeito === "missil") {
      const vivos = this.ordem.filter(p => this.emPista(p));
      const vitima = vivos[0] === alvo ? vivos[1] : vivos[0];
      if (vitima) saida.push(this.atingir(vitima, "missil", e.missil, agora, alvo));
      nitro(e.missil.nitro);
    } else if (efeito === "escudo") {
      alvo.escudoAte = Math.max(alvo.escudoAte, agora) + e.escudo.segundos * 1000 * mult;
      nitro(e.escudo.nitro);
    } else if (efeito === "bomba") {
      const vitimas = this.ordem.filter(p => this.emPista(p)).slice(0, e.bomba.alcance + 1)
        .filter(p => p !== alvo).slice(0, e.bomba.alcance);
      for (const v of vitimas) saida.push(this.atingir(v, "bomba", e.bomba, agora, alvo));
      this.impulsionar(alvo, e.bomba.multiplicador, e.bomba.nitro * mult, agora);
    }
    return saida;
  }

  segundosTurbo(total) {
    const t = this.config.efeitos.turbo;
    return Math.min(t.maximo, t.segundos + t.porMoeda * total);
  }

  segundosNitro(total) {
    const n = this.config.efeitos.nitro;
    return Math.min(n.maximo, n.minimo + Math.max(0, total - this.config.faixas[1].moedas) / 15);
  }

  /* Converte qualquer efeito em segundos de nitro de mesmo ganho, pra
     guardar pra largada. */
  segundosDeNitro(efeito, total) {
    const e = this.config.efeitos;
    const extra = m => m - 1;
    const nitro = extra(e.nitro.multiplicador);
    if (efeito === "turbo") return this.segundosTurbo(total) * extra(e.turbo.multiplicador) / nitro;
    if (efeito === "nitro") return this.segundosNitro(total);
    if (efeito === "bomba") return e.bomba.nitro * extra(e.bomba.multiplicador) / nitro;
    return e[efeito].nitro;
  }

  atingir(vitima, tipo, cfg, agora, por) {
    vitima.acaoEm = agora;
    if (vitima.escudoAte > agora) return { tipo: "bloqueou", alvo: this.ref(vitima), por: this.ref(por), efeito: tipo };
    const ate = agora + cfg.segundos * 1000;
    vitima.lento = { ate: Math.max(vitima.lento.ate, ate), mult: Math.min(vitima.lento.ate > agora ? vitima.lento.mult : 1, cfg.lento), tipo };
    return {
      tipo: "atingido", alvo: this.ref(vitima), por: this.ref(por), efeito: tipo,
      rei: vitima.id === this.rei, posicao: this.posicao(vitima),
    };
  }

  /* Impulsos não empilham multiplicador: vale o maior, e o tempo do outro
     vira tempo equivalente (mesmo ganho em metros). */
  impulsionar(p, mult, segundos, agora) {
    const i = p.impulso;
    if (i.ate <= agora || i.mult <= 1) { p.impulso = { mult, ate: agora + segundos * 1000 }; return; }
    const resto = (i.ate - agora) / 1000;
    if (mult >= i.mult) p.impulso = { mult, ate: agora + (resto * (i.mult - 1) / (mult - 1) + segundos) * 1000 };
    else p.impulso.ate += segundos * (mult - 1) / (i.mult - 1) * 1000;
  }

  velocidade(p, agora) {
    const c = this.config;
    const onda = 0.6 * Math.sin(this.relogio * 0.9 + p.f1) + 0.4 * Math.sin(this.relogio * 0.47 + p.f2);
    let v = c.velocidade * (1 + p.perfil) * (1 + c.oscilacao * onda);
    if (this.chovendo) v *= c.surpresa.chuva.lento;
    if (p.impulso.ate > agora) v *= p.impulso.mult;
    if (p.lento.ate > agora) v *= p.lento.mult;
    return v;
  }

  /* ───────────── tempo ───────────── */

  passo(dt, agora) {
    const saida = [];
    const fases = this.config.fases;

    if (this.fase === "espera" && agora >= this.faseAte) {
      if (this.totalCorrendo() >= this.config.minimoPilotos) {
        this.fase = "largada";
        this.faseAte = agora + fases.largada * 1000;
        saida.push({ tipo: "largada", rodada: this.rodada, segundos: fases.largada });
      } else this.faseAte = agora + 3000;
    } else if (this.fase === "largada" && agora >= this.faseAte) {
      this.fase = "corrida";
      this.relogio = 0;
      this.ultimoPresenteEm = agora;
      this.ultimaFalta = agora;
      for (const p of this.pilotos.values()) {
        if (p.correndo && p.guardado > 0) {
          this.impulsionar(p, this.config.efeitos.nitro.multiplicador, p.guardado, agora);
          p.guardado = 0;
        }
      }
      saida.push({ tipo: "vai", rodada: this.rodada });
    }

    if (this.correndo) {
      this.relogio += dt;
      for (const p of this.pilotos.values()) {
        if (!this.emPista(p)) continue;
        p.v = this.velocidade(p, agora);
        p.d += p.v * dt;
        if (p.d >= this.pista) {
          p.d = this.pista;
          p.chegada = ++this.chegados;
          p.tempo = this.relogio;
          saida.push({ tipo: "chegou", piloto: this.ref(p), posicao: p.chegada, tempo: p.tempo });
          if (p.chegada === 1) {
            this.fase = "chegada";
            this.faseAte = agora + fases.chegada * 1000;
          }
        }
      }
    }
    saida.push(...this.ordenar(agora));

    if (this.fase === "chegada" && (agora >= this.faseAte || this.chegados >= Math.min(3, this.totalCorrendo()))) {
      saida.push(this.encerrar(agora));
    } else if (this.fase === "podio" && agora >= this.faseAte) {
      saida.push(this.novaRodada(agora));
    }

    if (this.fase === "corrida") {
      const lider = this.lider;
      const rf = this.config.retaFinal;
      if (!this.retaFinal && lider && lider.d >= this.pista * rf.inicio) {
        this.retaFinal = true;
        saida.push({ tipo: "retaFinal", lider: this.ref(lider), multiplicador: rf.multiplicador });
      }
      if (agora - this.ultimaFalta >= this.config.falta * 1000 && this.ordem.length >= 2) {
        this.ultimaFalta = agora;
        const metros = this.ordem[0].d - this.ordem[1].d;
        if (metros >= FALTA_MINIMA) saida.push({ tipo: "falta", piloto: this.ref(this.ordem[1]), lider: this.ref(this.ordem[0]), metros });
      }
    }

    const s = this.config.surpresa;
    if (this.evento) {
      if (agora >= this.evento.ate) {
        saida.push({ tipo: "fimSurpresa", evento: this.evento });
        this.evento = null;
        this.fimUltimoEvento = agora;
      }
    } else if (s.ligada && this.fase === "corrida"
      && agora - this.ultimoPresenteEm >= s.frio * 1000
      && agora - this.fimUltimoEvento >= s.intervalo * 1000) {
      saida.push(this.iniciarEvento(agora));
    }
    return saida;
  }

  /* Ordem da corrida: quem chegou, pela ordem de chegada; o resto pela
     distância. Na corrida, anuncia líder novo e ultrapassagem no topo. */
  ordenar(agora = null) {
    const lista = [...this.pilotos.values()].filter(p => p.correndo);
    lista.sort((a, b) => {
      if (a.chegada != null || b.chegada != null) return (a.chegada ?? Infinity) - (b.chegada ?? Infinity);
      return b.d - a.d || a.numero - b.numero;
    });
    const antes = this.posicoes;
    const liderAntes = this.ordem[0];
    this.ordem = lista;
    this.posicoes = new Map(lista.map((p, i) => [p.id, i + 1]));
    if (agora == null || !this.correndo) return [];

    const u = this.config.ultrapassagem;
    if (agora - this.ultimaUltrapassagem < u.intervalo * 1000) return [];
    const lider = lista[0];
    if (lider && liderAntes && lider !== liderAntes && liderAntes.correndo) {
      this.ultimaUltrapassagem = agora;
      return [{ tipo: "lider", piloto: this.ref(lider), anterior: this.ref(liderAntes) }];
    }
    for (let i = 1; i < Math.min(u.top, lista.length - 1); i++) {
      const p = lista[i];
      const atras = lista[i + 1];
      const eraPos = antes.get(p.id);
      if (eraPos && eraPos > i + 1 && antes.get(atras.id) < eraPos && p.chegada == null) {
        this.ultimaUltrapassagem = agora;
        return [{ tipo: "ultrapassagem", piloto: this.ref(p), passou: this.ref(atras), posicao: i + 1 }];
      }
    }
    return [];
  }

  encerrar(agora) {
    this.fase = "podio";
    this.faseAte = agora + this.config.fases.podio * 1000;
    const podio = this.ordem.slice(0, 3).map((p, i) => ({ ...this.ref(p), posicao: i + 1, tempo: p.tempo, d: p.d }));
    let mvp = null;
    for (const p of this.pilotos.values()) {
      if (p.moedasRodada > 0 && (!mvp || p.moedasRodada > mvp.moedasRodada)) mvp = p;
    }
    const vencedor = this.ordem[0];
    if (vencedor) {
      this.vitorias.set(vencedor.id, (this.vitorias.get(vencedor.id) || 0) + 1);
      this.rei = vencedor.id;
    }
    this.podio = podio;
    this.mvp = mvp ? { ...this.ref(mvp), moedas: mvp.moedasRodada } : null;
    return { tipo: "podio", rodada: this.rodada, podio, mvp: this.mvp, vitorias: vencedor ? this.vitorias.get(vencedor.id) : 0 };
  }

  novaRodada(agora) {
    this.rodada++;
    this.fase = "espera";
    this.faseAte = agora + this.config.fases.espera * 1000;
    this.chegados = 0;
    this.retaFinal = false;
    this.relogio = 0;
    const limite = this.config.inatividade * 1000;
    const ativos = [...this.pilotos.values()].filter(p => agora - p.ultimaAcao <= limite);
    for (const p of this.pilotos.values()) {
      this.prepararRodada(p);
      p.correndo = false;
    }
    /* Grade: rei da pista na pole, depois quem mais doou na live, depois
       quem chegou primeiro na live. */
    ativos.sort((a, b) => (b.id === this.rei) - (a.id === this.rei) || b.moedasLive - a.moedasLive || a.numero - b.numero);
    ativos.slice(0, this.config.maxPilotos).forEach((p, i) => { p.correndo = true; p.d = -i * 0.05; });
    this.ordenar();
    return { tipo: "espera", rodada: this.rodada, pilotos: Math.min(ativos.length, this.config.maxPilotos) };
  }

  iniciarEvento(agora, tipo = this.proximaSurpresa()) {
    const s = this.config.surpresa;
    const segundos = tipo === "dobro" ? s.dobro : s[tipo].segundos;
    this.evento = { tipo, inicio: agora, ate: agora + segundos * 1000, segundos };
    return { tipo: "surpresa", evento: { ...this.evento } };
  }

  proximaSurpresa() {
    const lista = this.config.modoSeguro ? SURPRESAS_SEGURAS : SURPRESAS;
    return lista[this.rodizio++ % lista.length];
  }

  /* Pula pra próxima fase (tecla N, testes). */
  avancar(agora) {
    if (this.fase === "espera" || this.fase === "largada") { this.faseAte = agora; return this.passo(0, agora); }
    if (this.correndo) {
      for (const p of this.pilotos.values()) if (this.emPista(p)) p.d = Math.max(p.d, this.pista - 1 - (this.ordem.length - this.posicao(p)) * 0.01);
      const lider = this.ordem.find(p => this.emPista(p));
      if (lider) lider.d = this.pista;
      return this.passo(0, agora);
    }
    this.faseAte = agora;
    return this.passo(0, agora);
  }

  /* ───────────── leitura pra tela ───────────── */

  /* Quem aparece na pista 3D: top N, quem acabou de agir ou apanhar (mais
     recente primeiro), o rei, e o resto por posição, até o teto. */
  visiveis(teto, agora) {
    const saida = [];
    const usados = new Set();
    const por = p => {
      if (saida.length < teto && p && p.correndo && !usados.has(p.id)) { usados.add(p.id); saida.push(p); }
    };
    this.ordem.slice(0, this.config.destaque).forEach(por);
    this.ordem.filter(p => agora - p.acaoEm < DESTAQUE_MS).sort((a, b) => b.acaoEm - a.acaoEm).forEach(por);
    if (this.rei) por(this.pilotos.get(this.rei));
    this.ordem.forEach(por);
    return saida;
  }

  topDoadores(n = 3) {
    return [...this.doadores.values()].sort((a, b) => b.moedas - a.moedas || a.desde - b.desde).slice(0, n);
  }

  topVitorias(n = 5) {
    return [...this.vitorias.entries()]
      .map(([id, v]) => ({ ...this.ref(this.pilotos.get(id)), vitorias: v }))
      .filter(x => x.id)
      .sort((a, b) => b.vitorias - a.vitorias || a.numero - b.numero)
      .slice(0, n);
  }
}

if (typeof module !== "undefined") module.exports = { Racha, normalizar, chaveNome, hashTexto, MODELOS, CORES_CARRO };
