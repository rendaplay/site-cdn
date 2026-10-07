/* Regras da Batalha de Torres: de que lado vai cada presente, quanto a
   torre sobe (1 moeda = 1 metro), ranking e resultado da rodada. Sem DOM e sem relógio próprio (o `agora` vem de
   fora), pra rodar igual no navegador e no `node regras.test.js`.

   Cada ação devolve uma lista de acontecimentos ({tipo, ...}) que a tela
   anima. A regra decide; a tela só conta o que aconteceu. */
"use strict";

const SEQUENCIA_JANELA_MS = 25000;

/* Comentário vale pouco (1 rosa = 1 m) e não é farmável: intervalo por
   pessoa e teto de metros por pessoa na rodada. */
const COMENTARIO_PADRAO = { metros: 0.2, intervalo: 5, teto: 6 };

/* Curtida também empilha: a cada `cada` curtidas da pessoa, um tijolinho,
   com o mesmo intervalo e teto por pessoa do comentário. Seguir vale uma
   vez por pessoa na live (o TikTok reenvia o follow). */
const CURTIDA_PADRAO = { cada: 25, metros: 0.5, intervalo: 5, teto: 6 };
const SEGUIU_PADRAO = { metros: 1 };

/* Presente a partir de `de` moedas também ataca a torre rival: derruba
   `fator` metros por moeda, até `pct`% dela e nunca mais que `maxPct`%.
   Vale a faixa mais alta que o presente alcança. */
const ATAQUE_PADRAO = {
  maxPct: 40,
  faixas: [
    { de: 10, tipo: "vento", fator: 0.5, pct: 8 },
    { de: 100, tipo: "raio", fator: 0.6, pct: 18 },
    { de: 500, tipo: "bola", fator: 0.7, pct: 28 },
    { de: 3000, tipo: "terremoto", fator: 0.8, pct: 40 },
  ],
};

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

class Batalha {
  /* config.comentario e config.ataque: ver COMENTARIO_PADRAO e ATAQUE_PADRAO. */
  constructor(config) {
    this.config = config;
    this.numero = 0;
    this.serie = config.lados.map(() => 0);
    /* Lado de cada espectador. Vale a live inteira, não só a rodada:
       quem já escolheu não precisa escolher de novo. */
    this.escolhas = new Map();
    /* Presente de quem ainda não tem lado. Fica guardado até a pessoa
       comentar 1 ou 2: moeda paga não some. */
    this.pendentes = new Map();
    /* Em `conector.py --mock` ninguém comenta 1/2 nem manda o presente B:
       cada espectador falso ganha um lado fixo (ver Jogo.aoStatus). */
    this.ladoSimulado = null;
    this.ultimoComentario = new Map();
    this.ultimaCurtida = new Map();
    this.curtidasGuardadas = new Map();
    this.seguiram = new Set();
    this.novaRodada();
  }

  novaRodada() {
    this.numero++;
    this.lados = this.config.lados.map(() => ({ pontos: 0, doadores: new Map() }));
    this.maior = null;
    this.lider = -1;
    this.sequencia = { lado: -1, n: 0, em: 0 };
    this.metaBatida = false;
    this.dobro = null;
    this.dobroLivreEm = 0;
    this.metrosComentados = new Map();
    this.metrosCurtidos = new Map();
  }

  /* Modo seguro TikTok (padrão): nada que pareça pedir presente, então
     sem o "próximo presente vale 2×". */
  seguro() { return this.config.modoSeguro !== false; }

  regraComentario() { return { ...COMENTARIO_PADRAO, ...this.config.comentario }; }

  regraCurtida() { return { ...CURTIDA_PADRAO, ...this.config.curtida }; }

  regraSeguiu() { return { ...SEGUIU_PADRAO, ...this.config.seguiu }; }

  regraAtaque() { return { ...ATAQUE_PADRAO, ...this.config.ataque }; }

  ladoDoPresente(nome) {
    const n = normalizar(nome);
    if (!n) return -1;
    return this.config.lados.findIndex(l => l.presente.aceitos.some(a => normalizar(a) === n));
  }

  ladoDoComando(texto) {
    return this.ladoPorPalavras(texto, l => l.comandos);
  }

  /* "rosa", "gg", "branca": o nome do presente escrito no chat. */
  ladoDoNomeDoPresente(texto) {
    return this.ladoPorPalavras(texto, l => [l.presente.nome, ...l.presente.aceitos, ...(l.presente.palavras || [])]);
  }

  /* Vale o texto exato ou ele repetido ("gg gg gg", "1 1 1"), nunca no
     meio de uma frase: "fora 1 kkk" não é voto. */
  ladoPorPalavras(texto, palavras) {
    const n = normalizar(texto);
    if (!n) return -1;
    const partes = n.split(" ");
    const repetido = partes.every(x => x === partes[0]) ? partes[0] : null;
    return this.config.lados.findIndex(l => palavras(l).some(c => {
      const alvo = normalizar(c);
      return alvo === n || alvo === repetido;
    }));
  }

  total() { return this.lados.reduce((s, l) => s + l.pontos, 0); }

  fracao(lado) {
    const t = this.total();
    return t ? this.lados[lado].pontos / t : 0.5;
  }

  /* Porcentagem inteira que soma 100 e nunca mostra 100 x 0 com os dois
     pontuando: "100%" pra quem está perdendo por 1 moeda seria mentira. */
  porcentagens() {
    const [a, b] = this.lados.map(l => l.pontos);
    if (!a && !b) return [50, 50];
    let pa = Math.round((a / (a + b)) * 100);
    if (a && b) pa = Math.min(99, Math.max(1, pa));
    return [pa, 100 - pa];
  }

  liderAgora() {
    const [a, b] = this.lados.map(l => l.pontos);
    return a > b ? 0 : b > a ? 1 : -1;
  }

  /* Distância do lado de trás pro líder (empate: null). */
  falta() { return faltaEntre(this.lados.map(l => l.pontos)); }

  top(lado, n = 3) {
    return [...this.lados[lado].doadores.values()]
      .sort((x, y) => y.pontos - x.pontos || x.desde - y.desde)
      .slice(0, n);
  }

  presente({ id, nick, avatar, presente, quantidade = 1, moedas = 0, agora = Date.now() }) {
    const pontos = Math.max(0, Math.round(moedas));
    if (!pontos) return [];
    const quem = { id: String(id || nick), nick: nick || "anônimo", avatar: avatar || null };

    let lado = this.ladoSimulado ? this.ladoSimulado(quem.id) : this.ladoDoPresente(presente);
    if (lado >= 0) this.escolhas.set(quem.id, lado);
    else lado = this.escolhas.has(quem.id) ? this.escolhas.get(quem.id) : -1;
    /* Quem estava pendente e mandou o presente-símbolo já disse o lado:
       o presente guardado entra junto, sem esperar o comentário. */
    const guardado = lado >= 0 ? this.liberar(lado, quem, agora) : [];

    if (lado < 0) {
      const p = this.pendentes.get(quem.id) || { quem, pontos: 0, presentes: [] };
      p.quem = quem;
      p.pontos += pontos;
      p.presentes.push({ presente, quantidade });
      this.pendentes.set(quem.id, p);
      return [{ tipo: "pendente", quem, pontos: p.pontos, presente, quantidade }];
    }
    return [...guardado, ...this.pontuar(lado, quem, pontos, presente, quantidade, agora)];
  }

  liberar(lado, quem, agora) {
    const p = this.pendentes.get(quem.id);
    if (!p) return [];
    this.pendentes.delete(quem.id);
    const nomes = [...new Set(p.presentes.map(x => x.presente))].join(", ");
    const qtd = p.presentes.reduce((s, x) => s + x.quantidade, 0);
    return this.pontuar(lado, quem, p.pontos, nomes, qtd, agora, true);
  }

  /* O comando (1/2, nome do lado) ou o nome do presente ("gg") escolhe o
     lado e empilha um tijolinho. Quem escreveu o nome do presente é
     lembrado de que o presente de verdade empilha muito mais. */
  comentario({ id, nick, avatar, texto, agora = Date.now() }) {
    const quem = { id: String(id || nick), nick: nick || "anônimo", avatar: avatar || null };
    let lado = this.ladoDoComando(texto);
    const aviso = [];
    if (lado < 0) {
      lado = this.ladoDoNomeDoPresente(texto);
      if (lado >= 0) aviso.push({ tipo: "comentouPresente", lado, quem });
      /* Na simulação ninguém comenta 1/2: o chat falso vale pelo lado fixo. */
      else if (this.ladoSimulado) lado = this.ladoSimulado(quem.id);
      else return [];
    }
    const antes = this.escolhas.get(quem.id);
    this.escolhas.set(quem.id, lado);
    const saida = antes === lado ? [] : [{ tipo: "escolha", lado, quem, trocou: antes !== undefined }];
    return [...aviso, ...saida, ...this.liberar(lado, quem, agora), ...this.tijolinho(lado, quem, agora)];
  }

  /* Curtidas se acumulam por pessoa; cada pacote de `cada` vira um
     tijolinho. O que sobra do pacote espera a próxima curtida, mas nunca
     guarda mais que um pacote: rajada de 500 curtidas não vira 20 peças. */
  curtida({ id, nick, avatar, curtidas = 1, agora = Date.now() }) {
    const r = this.regraCurtida();
    if (!(r.metros > 0) || !(r.cada > 0)) return [];
    const quem = { id: String(id || nick), nick: nick || "anônimo", avatar: avatar || null };
    const n = Math.min(r.cada, (this.curtidasGuardadas.get(quem.id) || 0) + Math.max(1, Math.round(curtidas)));
    this.curtidasGuardadas.set(quem.id, n);
    if (n < r.cada) return [];
    const saida = this.tijolinho(this.ladoDoFa(quem), quem, agora, "curtida");
    if (saida.length) this.curtidasGuardadas.set(quem.id, 0);
    return saida;
  }

  seguiu({ id, nick, avatar, agora = Date.now() }) {
    const r = this.regraSeguiu();
    const quem = { id: String(id || nick), nick: nick || "anônimo", avatar: avatar || null };
    if (!(r.metros > 0) || this.seguiram.has(quem.id)) return [];
    this.seguiram.add(quem.id);
    const lado = this.ladoDoFa(quem);
    this.lados[lado].pontos = arredondar(this.lados[lado].pontos + r.metros);
    return [{ tipo: "tijolinho", fonte: "seguiu", lado, quem, pontos: r.metros }, ...this.depoisDeMudar(quem, agora)];
  }

  /* Quem curte ou segue sem ter escolhido entra no lado com menos torcida
     (empate: o mais baixo) e fica nele até comentar o outro. */
  ladoDoFa(quem) {
    if (this.escolhas.has(quem.id)) return this.escolhas.get(quem.id);
    let lado = this.ladoSimulado ? this.ladoSimulado(quem.id) : -1;
    if (lado < 0) {
      const [ta, tb] = [this.torcida(0), this.torcida(1)];
      lado = ta !== tb ? (ta < tb ? 0 : 1) : this.lados[0].pontos <= this.lados[1].pontos ? 0 : 1;
    }
    this.escolhas.set(quem.id, lado);
    return lado;
  }

  /* Não entra no top 3 nem no MVP: lá só conta moeda de verdade. */
  tijolinho(lado, quem, agora, fonte = "comentario") {
    const curtida = fonte === "curtida";
    const r = curtida ? this.regraCurtida() : this.regraComentario();
    const ultimos = curtida ? this.ultimaCurtida : this.ultimoComentario;
    const somados = curtida ? this.metrosCurtidos : this.metrosComentados;
    if (!(r.metros > 0)) return [];
    const ultimo = ultimos.get(quem.id);
    if (ultimo !== undefined && agora - ultimo < r.intervalo * 1000) return [];
    const ja = somados.get(quem.id) || 0;
    const metros = arredondar(Math.min(r.metros, r.teto - ja));
    if (metros <= 0) return [];
    ultimos.set(quem.id, agora);
    somados.set(quem.id, ja + metros);
    this.lados[lado].pontos = arredondar(this.lados[lado].pontos + metros);
    return [{ tipo: "tijolinho", fonte, lado, quem, pontos: metros }, ...this.depoisDeMudar(quem, agora)];
  }

  /* Quantos metros o presente derruba da torre rival (null: não ataca). */
  ataque(lado, quem, moedas) {
    const r = this.regraAtaque();
    const faixa = [...r.faixas].sort((x, y) => y.de - x.de).find(f => moedas >= f.de);
    const alvo = 1 - lado;
    const altura = this.lados[alvo].pontos;
    if (!faixa || !(r.maxPct > 0) || altura <= 0) return null;
    const limite = (altura * Math.min(faixa.pct, r.maxPct)) / 100;
    const metros = arredondar(Math.min(moedas * faixa.fator, limite));
    if (metros < 0.5) return null;
    this.lados[alvo].pontos = arredondar(altura - metros);
    return { tipo: "ataque", ataque: faixa.tipo, lado, alvo, quem, metros, moedas };
  }

  torcida(lado) {
    let n = 0;
    for (const l of this.escolhas.values()) if (l === lado) n++;
    return n;
  }

  pontuar(lado, quem, pontos, presente, quantidade, agora, liberado = false) {
    /* O 2× só sobe a torre: ranking e MVP contam o que a pessoa mandou. */
    const moedas = pontos;
    const dobrado = !!this.dobro && this.dobro.lado === lado && agora < this.dobro.ate;
    if (dobrado) {
      pontos *= 2;
      this.dobro = null;
      this.dobroLivreEm = agora + this.regraDobro().intervalo * 1000;
    }
    const l = this.lados[lado];
    l.pontos += pontos;

    const d = l.doadores.get(quem.id) || { ...quem, pontos: 0, desde: agora };
    d.nick = quem.nick;
    d.avatar = quem.avatar || d.avatar;
    d.pontos += moedas;
    l.doadores.set(quem.id, d);

    const s = this.sequencia;
    if (s.lado === lado && agora - s.em < SEQUENCIA_JANELA_MS) s.n++;
    else { s.lado = lado; s.n = 1; }
    s.em = agora;

    const maior = !this.maior || pontos > this.maior.pontos;
    if (maior) this.maior = { lado, quem, pontos, presente, quantidade };

    const saida = [{
      tipo: "pontos", lado, quem, pontos, presente, quantidade, liberado, dobrado,
      sequencia: s.n, maior, destaque: pontos >= (this.config.destaqueMoedas || Infinity),
    }];
    const ataque = this.ataque(lado, quem, moedas);
    if (ataque) saida.push(ataque);
    return [...saida, ...this.depoisDeMudar(quem, agora)];
  }

  /* Virada, meta e 2× depois de qualquer coisa que mexa na altura. */
  depoisDeMudar(quem, agora) {
    const saida = [];
    const agoraLider = this.liderAgora();
    if (agoraLider >= 0 && agoraLider !== this.lider) {
      /* Com 6 moedas em jogo toda rosa "vira": abaixo do mínimo a
         liderança troca calada, senão a tela grita virada sem parar. */
      const valendo = this.total() >= (this.config.viradaMinima || 0);
      if (this.lider >= 0 && valendo) saida.push({ tipo: "virada", lado: agoraLider, quem });
      this.lider = agoraLider;
    }

    const meta = this.config.meta && this.config.meta.moedas;
    if (meta && !this.metaBatida && this.total() >= meta) {
      this.metaBatida = true;
      saida.push({ tipo: "meta", moedas: meta });
    }
    return [...saida, ...this.tique(agora)];
  }

  regraDobro() {
    const r = { atras: 50, minimo: 150, segundos: 10, intervalo: 45, ...this.config.dobro };
    if (this.seguro()) r.segundos = 0;
    return r;
  }

  /* Gatilho do 2×: quando um lado tem até `atras`% da altura do outro (e a
     rodada já tem `minimo` metros), o próximo presente dele vale dobrado
     por `segundos`. Depois de usado ou vencido, espera `intervalo`.
     Chamado a cada presente e pelo relógio do jogo, que é quem vê vencer. */
  tique(agora = Date.now()) {
    const r = this.regraDobro();
    if (this.dobro) {
      if (agora < this.dobro.ate) return [];
      const lado = this.dobro.lado;
      this.dobro = null;
      this.dobroLivreEm = agora + r.intervalo * 1000;
      return [{ tipo: "dobroFim", lado }];
    }
    const ft = this.falta();
    if (!r.segundos || !ft || agora < this.dobroLivreEm || this.total() < r.minimo) return [];
    const lider = this.lados[1 - ft.lado].pontos;
    if (this.lados[ft.lado].pontos > (lider * r.atras) / 100) return [];
    this.dobro = { lado: ft.lado, ate: agora + r.segundos * 1000 };
    return [{ tipo: "dobro", lado: ft.lado, ate: this.dobro.ate, segundos: r.segundos }];
  }

  /* O que fazer quando o relógio zera: rodada sem presente recomeça,
     empate prorroga, e empate que sobrevive a `prorrogacoesMax`
     prorrogações acaba empatado (senão a rodada nunca termina). */
  fimDoTempo(prorrogacoes = 0) {
    if (!this.total()) return "recomecar";
    if (this.liderAgora() >= 0) return "encerrar";
    const max = this.config.rodada && this.config.rodada.prorrogacoesMax;
    return prorrogacoes >= (max ?? 3) ? "encerrar" : "prorrogar";
  }

  /* Fim do tempo. Empate não tem vencedor: quem chama decide se prorroga. */
  resultado() {
    const vencedor = this.liderAgora();
    return {
      vencedor,
      pontos: this.lados.map(l => l.pontos),
      porcentagens: this.porcentagens(),
      mvp: vencedor >= 0 ? this.top(vencedor, 1)[0] || null : null,
      numero: this.numero,
    };
  }

  encerrar() {
    const r = this.resultado();
    if (r.vencedor >= 0) this.serie[r.vencedor]++;
    r.serie = [...this.serie];
    return r;
  }
}

/* Comentário vale fração de metro: corta o resto de ponto flutuante. */
function arredondar(n) { return Math.round(n * 100) / 100; }

/* A altura como a tela escreve: uma casa abaixo de 10 m, inteiro acima. */
function metrosNaTela(n) { return Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n); }

/* "Faltam X m" a partir das alturas que estão na tela, pra conta bater com
   os dois números do placar (41 − 4,2 = 36,8). */
function faltaEntre(alturas) {
  const [a, b] = alturas.map(metrosNaTela);
  if (a === b) return null;
  const lider = a > b ? 0 : 1;
  return { lado: 1 - lider, metros: Math.round(Math.abs(a - b) * 10) / 10 };
}

function hashTexto(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

if (typeof module !== "undefined") module.exports = { Batalha, normalizar, hashTexto, faltaEntre, metrosNaTela };
