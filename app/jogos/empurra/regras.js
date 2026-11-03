/* Regras do Empurra-Empurra: quem torce pra quem, a força de cada time, os
   empurrões e a física do círculo (atrito, trombada, beira e queda), o
   juiz, os presentes, a coroa de quem mais empurrou, o fim da rodada e o
   ranking da live. Sem DOM: o tempo anda pelo `passo(dt)`, o sorteio é
   injetável e tudo que acontece volta numa lista de acontecimentos pra
   cena, o HUD e o som.

   Medidas em metros, com o centro do círculo no zero. Velocidade de
   empurrão é a que o rival leva: com atrito `k` ele anda v/k metros.

   Fases: rodada → fim (festa do vencedor) → intervalo (ranking) → rodada. */
"use strict";

const FOLGA = 1e-9;
const RAIO_JUIZ = 0.5;
const MASSA_JUIZ = 5;
/* Quem caiu até tantos s depois de um golpe conta como derrubado por ele. */
const CREDITO = 5;
/* A coroa só aparece (`vale`) quando o dono já tem esse tanto de pontos:
   um presente ou uma boa sequência de comentários. */
const COROA_MINIMA = 10;

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/* Primeiro time citado no texto, por palavra inteira. No mesmo ponto do
   texto ganha o apelido mais comprido ("sao paulo" antes de um "sao"). */
function reconhecerTime(times, texto) {
  const alvo = ` ${normalizar(texto)} `;
  if (alvo.length <= 2) return null;
  let melhor = null;
  for (const t of times) {
    for (const apelido of t.apelidos || []) {
      const a = normalizar(apelido);
      if (!a) continue;
      const i = alvo.indexOf(` ${a} `);
      if (i < 0) continue;
      if (!melhor || i < melhor.i || (i === melhor.i && a.length > melhor.tam)) melhor = { i, tam: a.length, time: t };
    }
  }
  return melhor ? melhor.time : null;
}

class Arena {
  constructor(cfg, aleatorio = Math.random) {
    this.cfg = cfg;
    this.sorte = aleatorio;
    this.zerar();
  }

  zerar() {
    this.t = 0;
    this.rodada = 1;
    this.seq = 0;
    this.torcedores = new Map();
    this.times = this.cfg.times.map(t => ({ id: t.id, nome: t.nome, vitorias: 0, quedas: 0 }));
    this.porId = new Map(this.times.map(t => [t.id, t]));
    this.comecarRodada();
  }

  /* Todo mundo de volta numa roda em volta do centro, em ordem sorteada. */
  comecarRodada() {
    const a = this.cfg.arena;
    this.fase = "rodada";
    this.fimFase = this.t + this.cfg.rodada.duracao;
    this.vencedor = null;
    this.ultimoCaido = null;
    const n = this.times.length, giro = this.sorte() * Math.PI * 2;
    const ordem = this.times.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(this.sorte() * (i + 1));
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
    this.times.forEach((t, k) => {
      const ang = giro + (ordem[k] / n) * Math.PI * 2;
      Object.assign(t, {
        x: Math.sin(ang) * a.raio * 0.7, z: Math.cos(ang) * a.raio * 0.7, vx: 0, vz: 0,
        vivo: true, beira: null, tonto: 0, gigante: 0, forca: 0, empurroes: 0, desdeApito: 0,
        ajuda: new Map(), coroa: null, ataque: null, golpe: null, passeio: null, trocaPasseio: 0,
      });
    });
    this.juiz = { x: 0, z: 0, vx: 0, vz: 0, modo: "passeia", alvo: null, acao: null, ate: 0, destino: null, trocaDestino: 0 };
    this.fila = [];
    this.proximoApito = this.t + this.cfg.arbitro.intervalo;
  }

  time(id) { return this.porId.get(id) || null; }

  vivos() { return this.times.filter(t => t.vivo); }

  resta() { return Math.max(0, this.fimFase - this.t); }

  raio(t) { return this.cfg.arena.corpo * (t.gigante > 0 ? this.cfg.presentes.cresce : 1); }

  massa(t) { return t.gigante > 0 ? 3 : t.tonto > 0 ? 0.8 : 1; }

  /* Força do time: comentários recentes deixam o empurrão mais forte. */
  potencia(t) {
    const e = this.cfg.empurrao;
    return (1 + Math.min(t.forca, e.forcaMax) * e.porForca) * (t.gigante > 0 ? 1.5 : 1);
  }

  torcedor(quem) {
    const id = String(quem.id || quem.nome);
    let j = this.torcedores.get(id);
    if (!j) {
      j = { id, nome: quem.nome || id, time: null, ultimo: -Infinity };
      this.torcedores.set(id, j);
    } else if (quem.nome) j.nome = quem.nome;
    return j;
  }

  maisPerto(t) {
    let melhor = null, dMelhor = Infinity;
    for (const r of this.times) {
      if (r === t || !r.vivo) continue;
      const d = Math.hypot(r.x - t.x, r.z - t.z);
      if (d < dMelhor) { dMelhor = d; melhor = r; }
    }
    return melhor;
  }

  /* O vivo mais longe do centro: quem recebe presente de quem nunca
     comentou time (e mais precisa de ajuda). */
  emApuro() {
    let pior = null;
    for (const t of this.vivos()) if (!pior || Math.hypot(t.x, t.z) > Math.hypot(pior.x, pior.z)) pior = t;
    return pior || this.times[0];
  }

  /* ───────── live ───────── */

  comentario(quem, texto) {
    const cfgTime = reconhecerTime(this.cfg.times, texto);
    if (!cfgTime) return [];
    const j = this.torcedor(quem);
    const trocou = j.time !== cfgTime.id;
    j.time = cfgTime.id;
    const t = this.time(cfgTime.id);
    const ev = { tipo: "comentou", time: t.id, id: j.id, nome: j.nome, empurrou: false, trocou, tonto: t.tonto > 0 };
    const lista = [ev];
    if (this.fase !== "rodada" || !t.vivo || this.t - j.ultimo < this.cfg.chat.intervalo - FOLGA) return lista;
    j.ultimo = this.t;
    ev.empurrou = true;
    t.forca += 1;
    this.ajudar(t, j, 1, lista);
    if (t.beira) {
      if (this.sorte() < this.cfg.arena.salvar) this.salvar(t, lista);
    } else if (t.tonto <= 0) this.investir(t, "chat", this.cfg.empurrao.chat, { pessoa: j }, lista);
    return lista;
  }

  curtida(quem, n = 1) {
    const j = this.torcedores.get(String(quem.id || quem.nome));
    if (!j || !j.time || this.fase !== "rodada") return [];
    const t = this.time(j.time);
    if (!t.vivo || t.beira || t.tonto > 0) return [];
    if (this.t - (j.ultimaCurtida ?? -Infinity) < this.cfg.chat.intervalo - FOLGA) return [];
    j.ultimaCurtida = this.t;
    const lista = [{ tipo: "curtiu", time: t.id, id: j.id, nome: j.nome, curtidas: n }];
    this.ajudar(t, j, 0.5, lista);
    this.investir(t, "curtida", this.cfg.empurrao.curtida, { pessoa: j }, lista);
    return lista;
  }

  faixaDe(moedas) {
    let i = -1;
    this.cfg.faixas.forEach((f, k) => { if (moedas >= f.moedas) i = k; });
    return i;
  }

  /* `moedas` é o envio inteiro (com o combo). `faixa` vem do ⚙ (o streamer
     escolheu o efeito desse presente); sem ela vale pelo valor. Vai pro
     último time que a pessoa comentou; quem nunca comentou time ajuda o
     mascote mais perto da borda, sem contar pra coroa. */
  presente(quem, { nome, moedas, quantidade = 1, faixa = null }) {
    if (faixa === null || faixa === undefined) faixa = this.faixaDe(moedas);
    if (faixa < 0) return [];
    faixa = Math.min(faixa, this.cfg.faixas.length - 1);
    const j = this.torcedor(quem);
    const semTime = !j.time;
    const t = semTime ? this.emApuro() : this.time(j.time);
    const seq = ++this.seq;
    const ev = { tipo: "presente", time: t.id, id: j.id, nome: j.nome, presente: nome, quantidade, moedas, faixa, seq, semTime };
    const lista = [ev];
    if (this.fase !== "rodada") {
      ev.guardado = true;
      return lista;
    }
    if (!semTime) this.ajudar(t, j, Math.max(1, moedas), lista);
    if (!t.vivo) {
      if (faixa < this.cfg.presentes.revive) {
        ev.fora = true;
        return lista;
      }
      this.reviver(t, lista);
    }
    if (t.beira) this.salvar(t, lista);
    t.tonto = 0;
    const golpe = { pessoa: j, presente: seq };
    const p = this.cfg.presentes;
    if (faixa === 0) this.investir(t, "ombrada", p.ombrada, golpe, lista);
    else if (faixa === 1) this.investir(t, "carrinho", p.carrinho, { ...golpe, varre: true }, lista);
    else if (faixa === 2) this.investir(t, "voadora", p.voadora, golpe, lista);
    else if (faixa === 3) this.fila.push({ por: t.id, ...golpe });
    else this.terremoto(t, golpe, lista);
    return lista;
  }

  /* Coroa: quem mais empurrou na rodada (comentário 1, curtida meio,
     presente o valor em moedas). Cada time guarda o seu maior ajudante, mas
     só o maior de todos usa a coroa, e só a partir de COROA_MINIMA. Empate
     não tira a coroa de quem já tem. */
  ajudar(t, j, pontos, lista) {
    const total = (t.ajuda.get(j.id) || 0) + pontos;
    t.ajuda.set(j.id, total);
    if (t.coroa && t.coroa.id === j.id) {
      t.coroa.pontos = total;
      t.coroa.nome = j.nome;
    } else if (!t.coroa || total > t.coroa.pontos) {
      t.coroa = { id: j.id, nome: j.nome, pontos: total, vale: false };
    }
    const antes = this.times.find(x => x.coroa && x.coroa.vale);
    let rei = antes;
    for (const x of this.times) {
      if (x.coroa && (!rei || x.coroa.pontos > rei.coroa.pontos)) rei = x;
    }
    if (rei.coroa.pontos < COROA_MINIMA) return;
    if (antes && antes.coroa === rei.coroa) return;
    if (antes) antes.coroa.vale = false;
    rei.coroa.vale = true;
    lista.push({ tipo: "coroa", time: rei.id, id: rei.coroa.id, nome: rei.coroa.nome, tomou: !!antes });
  }

  /* ───────── golpes ───────── */

  /* Quanto dá pra andar de `p` na direção `u` sem passar da borda. */
  ateBorda(p, ux, uz) {
    const R = this.cfg.arena.raio;
    const pu = p.x * ux + p.z * uz;
    const c = p.x * p.x + p.z * p.z - R * R;
    return -pu + Math.sqrt(Math.max(0, pu * pu - c));
  }

  /* Arrancada até o rival mais perto. A velocidade sai pra ele chegar no
     rival com o atrito e parar logo depois; nunca passa da borda sozinho.
     O empurrão sai no contato (ver `golpear`). */
  investir(t, tipo, impulso, { pessoa = null, presente = null, varre = false }, lista) {
    const alvo = this.maisPerto(t);
    if (!alvo) return null;
    const dx = alvo.x - t.x, dz = alvo.z - t.z, d = Math.hypot(dx, dz) || 1e-6;
    const ux = dx / d, uz = dz / d;
    const contato = this.raio(t) + this.raio(alvo);
    const alcance = this.cfg.empurrao.alcance * (varre ? 1.6 : 1);
    const corrida = Math.max(0.3, Math.min(d - contato + (varre ? 2.4 : 0.4), alcance, this.ateBorda(t, ux, uz) - 0.5));
    const v = this.cfg.arena.atrito * corrida;
    t.vx = ux * v;
    t.vz = uz * v;
    t.ataque = {
      tipo, alvo: alvo.id, ux, uz, impulso: impulso * this.potencia(t), ate: this.t + (varre ? 1.3 : 1),
      varre, atingidos: new Set(), pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome } : null, presente,
    };
    if (tipo !== "curtida") {
      t.empurroes++;
      t.desdeApito++;
    }
    lista.push({ tipo: "empurrao", time: t.id, alvo: alvo.id, golpe: tipo, presente });
    return alvo;
  }

  golpear(de, alvo, a, lista) {
    let nx = alvo.x - de.x, nz = alvo.z - de.z;
    /* O carrinho passa por baixo: joga cada um pro lado e segue deslizando. */
    if (a.varre) {
      const lado = nx * -a.uz + nz * a.ux;
      const s = Math.abs(lado) > 0.05 ? Math.sign(lado) : (this.sorte() < 0.5 ? -1 : 1);
      nx = -a.uz * s * 0.8 + a.ux * 0.45;
      nz = a.ux * s * 0.8 + a.uz * 0.45;
    }
    const d = Math.hypot(nx, nz) || 1;
    nx /= d; nz /= d;
    const v = a.impulso / this.massa(alvo);
    alvo.golpe = { time: de.id, pessoa: a.pessoa, presente: a.presente, t: this.t };
    lista.push({ tipo: "bateu", time: de.id, alvo: alvo.id, forca: v, golpe: a.tipo, presente: a.presente });
    if (alvo.beira) {
      this.derrubar(alvo, "empurrao", lista);
      return;
    }
    alvo.vx += nx * v;
    alvo.vz += nz * v;
    /* A voadora espalha: quem está colado no alvo leva o tranco também. */
    if (a.tipo === "voadora") {
      for (const r of this.times) {
        if (r === de || r === alvo || !r.vivo || r.beira) continue;
        const rx = r.x - alvo.x, rz = r.z - alvo.z, rd = Math.hypot(rx, rz);
        if (rd > this.raio(r) + this.raio(alvo) + 0.9) continue;
        r.vx += (rx / (rd || 1)) * v * 0.4;
        r.vz += (rz / (rd || 1)) * v * 0.4;
        r.golpe = { ...alvo.golpe };
      }
    }
  }

  /* Terremoto lendário: cada rival quica pra borda (uns passam dela) e o
     time cresce, pesa e volta pro meio. */
  terremoto(t, { pessoa, presente }, lista) {
    const R = this.cfg.arena.raio, k = this.cfg.arena.atrito;
    t.gigante = this.cfg.presentes.gigante;
    t.vx = -t.x * k * 0.8;
    t.vz = -t.z * k * 0.8;
    t.ataque = null;
    const alvos = [];
    for (const r of this.times) {
      if (r === t || !r.vivo || r.beira) continue;
      let d = Math.hypot(r.x, r.z), ux = r.x / d, uz = r.z / d;
      if (d < 0.05) {
        const a = this.sorte() * Math.PI * 2;
        ux = Math.sin(a); uz = Math.cos(a); d = 0;
      }
      const anda = R - d + (this.sorte() * 1.6 - 0.6);
      if (anda > 0.1) {
        r.vx = ux * anda * k;
        r.vz = uz * anda * k;
      }
      r.golpe = { time: t.id, pessoa: { id: pessoa.id, nome: pessoa.nome }, presente, t: this.t };
      alvos.push(r.id);
    }
    lista.push({ tipo: "terremoto", time: t.id, alvos, presente });
  }

  /* ───────── beira e queda ───────── */

  salvar(t, lista, revive = false) {
    const R = this.cfg.arena.raio, k = this.cfg.arena.atrito;
    const d = Math.hypot(t.x, t.z) || 1;
    const fica = Math.min(d, R - 0.05);
    t.x = (t.x / d) * fica;
    t.z = (t.z / d) * fica;
    t.vx = (-t.x / d) * k * 1.6;
    t.vz = (-t.z / d) * k * 1.6;
    t.beira = null;
    lista.push({ tipo: "voltou", time: t.id, revive });
  }

  reviver(t, lista) {
    const R = this.cfg.arena.raio;
    const d = Math.hypot(t.x, t.z) || 1;
    t.x = (t.x / d) * R * 0.98;
    t.z = (t.z / d) * R * 0.98;
    Object.assign(t, { vivo: true, beira: null, tonto: 0, ataque: null, golpe: null, vx: 0, vz: 0 });
    this.salvar(t, lista, true);
  }

  derrubar(t, motivo, lista, golpe = null) {
    const g = golpe || (t.golpe && this.t - t.golpe.t <= CREDITO ? t.golpe : null);
    t.vivo = false;
    t.beira = null;
    t.ataque = null;
    t.quedas++;
    this.ultimoCaido = t;
    const vivos = this.vivos().length;
    lista.push({
      tipo: "caiu", time: t.id, motivo, vivos, x: t.x, z: t.z,
      por: g ? g.time || null : null, quem: g && g.pessoa ? g.pessoa.nome : null,
      presente: g ? g.presente || null : null, juiz: !!(g && g.juiz),
    });
    if (this.fase === "rodada" && vivos <= 1) this.terminar("ultimo", lista);
  }

  /* ───────── juiz ───────── */

  arbitrar(lista) {
    const j = this.juiz, cfg = this.cfg.arbitro;
    if (j.modo === "passeia") {
      if (this.fila.length) {
        const pedido = this.fila.shift();
        const por = this.time(pedido.por);
        const alvo = this.maisPerto(por);
        if (!alvo || !por.vivo) return;
        Object.assign(j, { modo: "corre", alvo: alvo.id, acao: "vermelho", ate: this.t + 3, pedido });
        lista.push({ tipo: "apito", alvo: alvo.id, acao: "vermelho", por: por.id });
      } else if (this.t >= this.proximoApito - FOLGA) {
        this.proximoApito = this.t + cfg.intervalo;
        const vivos = this.vivos().filter(t => !t.beira);
        if (vivos.length < 2) return;
        const maior = Math.max(...vivos.map(t => t.desdeApito));
        const candidatos = vivos.filter(t => t.desdeApito === maior);
        const alvo = candidatos[Math.floor(this.sorte() * candidatos.length)];
        const acao = this.sorte() < 0.5 ? "empurrao" : "amarelo";
        for (const t of this.times) t.desdeApito = 0;
        Object.assign(j, { modo: "corre", alvo: alvo.id, acao, ate: this.t + 3.5, pedido: null });
        lista.push({ tipo: "apito", alvo: alvo.id, acao });
      }
      return;
    }
    let alvo = this.time(j.alvo);
    if (!alvo.vivo && j.acao === "vermelho") {
      alvo = this.maisPerto(this.time(j.pedido.por));
      if (!alvo) { j.modo = "passeia"; return; }
      j.alvo = alvo.id;
    }
    if (!alvo.vivo) { j.modo = "passeia"; return; }
    const d = Math.hypot(alvo.x - j.x, alvo.z - j.z);
    const chegou = d <= RAIO_JUIZ + this.raio(alvo) + 0.35;
    if (!chegou && this.t < j.ate) return;
    j.modo = "passeia";
    j.trocaDestino = this.t + 1.5;
    if (j.acao === "empurrao") {
      if (!chegou) return;
      const v = cfg.empurrao / this.massa(alvo);
      alvo.vx += ((alvo.x - j.x) / (d || 1)) * v;
      alvo.vz += ((alvo.z - j.z) / (d || 1)) * v;
      alvo.golpe = { juiz: true, t: this.t };
      alvo.ataque = null;
      lista.push({ tipo: "juiz", acao: "empurrao", time: alvo.id });
    } else if (j.acao === "amarelo") {
      alvo.tonto = cfg.tonto;
      alvo.ataque = null;
      lista.push({ tipo: "juiz", acao: "amarelo", time: alvo.id });
    } else {
      const p = j.pedido;
      lista.push({ tipo: "juiz", acao: "vermelho", time: alvo.id, por: p.por, presente: p.presente });
      this.derrubar(alvo, "vermelho", lista, { time: p.por, pessoa: { id: p.pessoa.id, nome: p.pessoa.nome }, presente: p.presente });
    }
  }

  /* ───────── física ───────── */

  /* Passeio de cada um: um ponto sorteado dentro do círculo, longe da
     borda. Só anda devagar e só quando não está voando de um tranco. */
  andar(corpo, alvoX, alvoZ, velocidade, dt) {
    const dx = alvoX - corpo.x, dz = alvoZ - corpo.z, d = Math.hypot(dx, dz);
    if (Math.hypot(corpo.vx, corpo.vz) > velocidade * 1.4) return d;
    const v = Math.min(velocidade, d * 1.5);
    const k = 1 - Math.exp(-4 * dt);
    corpo.vx += ((dx / (d || 1)) * v - corpo.vx) * k;
    corpo.vz += ((dz / (d || 1)) * v - corpo.vz) * k;
    return d;
  }

  sortearPonto(raio) {
    const a = this.sorte() * Math.PI * 2, r = Math.sqrt(this.sorte()) * raio;
    return { x: Math.sin(a) * r, z: Math.cos(a) * r };
  }

  fisica(dt, lista) {
    const passos = Math.max(1, Math.ceil(dt / (1 / 90)));
    for (let i = 0; i < passos; i++) this.subpasso(dt / passos, lista);
  }

  subpasso(dt, lista) {
    const cfg = this.cfg, R = cfg.arena.raio, atrito = Math.exp(-cfg.arena.atrito * dt);
    const jogando = this.fase === "rodada";
    const meia = Math.pow(0.5, dt / cfg.empurrao.meiaVida);
    const vivos = this.vivos();

    for (const t of vivos) {
      t.forca *= meia;
      t.tonto = Math.max(0, t.tonto - dt);
      t.gigante = Math.max(0, t.gigante - dt);
      if (t.beira) continue;
      const a = t.ataque;
      if (a) {
        if (!jogando || this.t > a.ate) t.ataque = null;
        else if (!a.varre) {
          const alvo = this.time(a.alvo);
          if (!alvo.vivo) t.ataque = null;
          else {
            const dx = alvo.x - t.x, dz = alvo.z - t.z, d = Math.hypot(dx, dz);
            const vel = Math.hypot(t.vx, t.vz);
            t.vx = (dx / (d || 1)) * vel;
            t.vz = (dz / (d || 1)) * vel;
            if (d <= this.raio(t) + this.raio(alvo) + 0.12) {
              t.ataque = null;
              t.vx *= 0.25;
              t.vz *= 0.25;
              this.golpear(t, alvo, a, lista);
            }
          }
        } else {
          for (const r of vivos) {
            if (r === t || !r.vivo || a.atingidos.has(r.id)) continue;
            if (Math.hypot(r.x - t.x, r.z - t.z) > this.raio(t) + this.raio(r) + 0.25) continue;
            a.atingidos.add(r.id);
            this.golpear(t, r, a, lista);
          }
        }
      } else if (t.tonto <= 0 && !(t.golpe && this.t - t.golpe.t < 1.2)) {
        const fora = Math.hypot(t.x, t.z) > R * 0.78;
        if (!t.passeio || this.t >= t.trocaPasseio || fora) {
          t.passeio = fora ? { x: 0, z: 0 } : this.sortearPonto(R * 0.7);
          t.trocaPasseio = this.t + 1.5 + this.sorte() * 2.5;
        }
        if (this.andar(t, t.passeio.x, t.passeio.z, 0.8, dt) < 0.2) t.trocaPasseio = this.t;
      }
      t.vx *= atrito;
      t.vz *= atrito;
      t.x += t.vx * dt;
      t.z += t.vz * dt;
    }

    const j = this.juiz;
    if (j.modo === "corre") {
      const alvo = this.time(j.alvo);
      if (alvo) this.andar(j, alvo.x, alvo.z, cfg.arbitro.corre * (j.acao === "vermelho" ? 1.3 : 1), dt);
    } else {
      if (!j.destino || this.t >= j.trocaDestino) {
        j.destino = this.sortearPonto(R * 0.45);
        j.trocaDestino = this.t + 2 + this.sorte() * 3;
      }
      this.andar(j, j.destino.x, j.destino.z, cfg.arbitro.anda, dt);
    }
    j.vx *= atrito;
    j.vz *= atrito;
    j.x += j.vx * dt;
    j.z += j.vz * dt;

    this.trombadas(lista);

    if (!jogando) return;
    for (const t of this.vivos()) {
      if (t.beira) {
        if (this.t < t.beira.ate - FOLGA) continue;
        if (this.sorte() < cfg.arena.voltar) this.salvar(t, lista);
        else this.derrubar(t, "empurrao", lista);
        if (this.fase !== "rodada") return;
        continue;
      }
      const d = Math.hypot(t.x, t.z);
      if (d <= R) continue;
      t.x *= R / d;
      t.z *= R / d;
      t.vx = t.vz = 0;
      t.ataque = null;
      t.beira = { ate: this.t + cfg.arena.beira };
      lista.push({ tipo: "beira", time: t.id });
    }
  }

  /* Trombada entre dois corpos: separa e troca velocidade (choque meio
     elástico). Quem vem de um golpe passa o crédito pra quem acertou, e
     quem está na beira cai se levar um tranco. */
  trombadas(lista) {
    const corpos = this.vivos();
    const juiz = { ...this.juiz, ref: this.juiz, juiz: true };
    corpos.push(juiz);
    for (let a = 0; a < corpos.length; a++) {
      for (let b = a + 1; b < corpos.length; b++) {
        const A = corpos[a], B = corpos[b];
        if (!A.juiz && !A.vivo) continue;
        if (!B.juiz && !B.vivo) continue;
        if (A.ataque && A.ataque.varre && A.ataque.atingidos.has(B.id)) continue;
        if (B.ataque && B.ataque.varre && B.ataque.atingidos.has(A.id)) continue;
        const ra = A.juiz ? RAIO_JUIZ : this.raio(A), rb = B.juiz ? RAIO_JUIZ : this.raio(B);
        let nx = B.x - A.x, nz = B.z - A.z;
        const d = Math.hypot(nx, nz);
        if (d >= ra + rb || d < 1e-6) continue;
        nx /= d; nz /= d;
        const ma = A.juiz ? MASSA_JUIZ : A.beira ? 50 : this.massa(A);
        const mb = B.juiz ? MASSA_JUIZ : B.beira ? 50 : this.massa(B);
        const vn = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
        if (vn < -0.8 && (A.beira || B.beira) && this.fase === "rodada") {
          const caido = A.beira ? A : B, outro = caido === A ? B : A;
          if (!outro.juiz && outro.golpe && this.t - outro.golpe.t <= CREDITO) caido.golpe = { ...outro.golpe };
          else if (!outro.juiz) caido.golpe = { time: outro.id, pessoa: null, presente: null, t: this.t };
          this.derrubar(caido, "empurrao", lista);
          if (this.fase !== "rodada") return;
          continue;
        }
        const sobra = ra + rb - d, inv = 1 / ma + 1 / mb;
        const pa = A.juiz ? A.ref : A, pb = B.juiz ? B.ref : B;
        pa.x -= nx * sobra * (1 / ma) / inv;
        pa.z -= nz * sobra * (1 / ma) / inv;
        pb.x += nx * sobra * (1 / mb) / inv;
        pb.z += nz * sobra * (1 / mb) / inv;
        if (vn >= 0) continue;
        const e = A.juiz || B.juiz ? 0.2 : 0.55;
        const imp = (-(1 + e) * vn) / inv;
        pa.vx -= (imp / ma) * nx;
        pa.vz -= (imp / ma) * nz;
        pb.vx += (imp / mb) * nx;
        pb.vz += (imp / mb) * nz;
        if (imp > 1.2 && !A.juiz && !B.juiz) {
          const [rapido, lento] = Math.hypot(A.vx, A.vz) > Math.hypot(B.vx, B.vz) ? [A, B] : [B, A];
          if (rapido.golpe && this.t - rapido.golpe.t <= 2) lento.golpe = { ...rapido.golpe };
        }
      }
    }
  }

  /* ───────── relógio ───────── */

  passo(dt) {
    this.t += dt;
    const lista = [];
    if (this.fase !== "intervalo") this.fisica(dt, lista);
    if (this.fase === "rodada") this.arbitrar(lista);
    if (this.t < this.fimFase - FOLGA) return lista;
    if (this.fase === "rodada") this.terminar("tempo", lista);
    else if (this.fase === "fim") {
      this.fase = "intervalo";
      this.fimFase = this.t + this.cfg.rodada.intervalo;
      lista.push({ tipo: "intervalo", vencedor: this.vencedor, ranking: this.ranking() });
    } else this.novaRodada(lista);
    return lista;
  }

  encerrar() {
    if (this.fase === "rodada") this.fimFase = this.t;
  }

  /* Último em pé vence; no fim do tempo, o vivo mais perto do centro. Se o
     último par cair junto, fica com quem caiu por último. */
  terminar(motivo, lista) {
    const vivos = this.vivos();
    let v = null;
    for (const t of vivos) if (!v || Math.hypot(t.x, t.z) < Math.hypot(v.x, v.z)) v = t;
    v = v || this.ultimoCaido || this.times[0];
    v.vitorias++;
    this.vencedor = v.id;
    this.fase = "fim";
    this.fimFase = this.t + this.cfg.rodada.fim;
    for (const t of this.times) { t.ataque = null; t.beira = null; }
    this.fila = [];
    this.juiz.modo = "passeia";
    const aj = v.coroa;
    lista.push({ tipo: "fim", vencedor: v.id, motivo, rodada: this.rodada, ajudante: aj ? { id: aj.id, nome: aj.nome } : null });
  }

  novaRodada(lista) {
    for (const j of this.torcedores.values()) { j.ultimo = -Infinity; j.ultimaCurtida = -Infinity; }
    this.rodada++;
    this.comecarRodada();
    lista.push({ tipo: "rodada", rodada: this.rodada });
  }

  ranking() {
    return this.times.filter(t => t.vitorias)
      .sort((a, b) => b.vitorias - a.vitorias || a.quedas - b.quedas)
      .map(t => ({ id: t.id, nome: t.nome, vitorias: t.vitorias }));
  }
}

if (typeof module !== "undefined") module.exports = { Arena, normalizar, reconhecerTime };
