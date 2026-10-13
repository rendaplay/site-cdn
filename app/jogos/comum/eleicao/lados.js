/* De que lado está cada espectador nos jogos das eleições. Mesmas regras da
   Batalha: presente-símbolo escolhe e memoriza o lado, outro presente vai pro
   lado lembrado, e o de quem nunca escolheu fica guardado até a pessoa
   comentar 13/22 (moeda paga não some). Comentário, curtida e seguir valem
   um ponto pequeno, com intervalo e teto por pessoa na rodada. Sem DOM. */
"use strict";

(function (raiz) {
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

  function quemDe({ id, nick, avatar }) {
    return { id: String(id || nick), nick: nick || "anônimo", avatar: avatar || null };
  }

  class Lados {
    constructor(candidatos, regras) {
      this.candidatos = candidatos;
      this.regras = regras;
      this.escolhas = new Map();
      this.pendentes = new Map();
      this.ladoSimulado = null;
      this.ultimo = { comentario: new Map(), curtida: new Map() };
      this.curtidasGuardadas = new Map();
      this.seguiram = new Set();
      this.novaRodada();
    }

    novaRodada() {
      this.somados = { comentario: new Map(), curtida: new Map() };
    }

    ladoDoPresente(nome) {
      const n = normalizar(nome);
      if (!n) return -1;
      return this.candidatos.findIndex(c => c.presente.aceitos.some(a => normalizar(a) === n));
    }

    /* Vale o texto exato ou ele repetido ("13 13 13"), nunca no meio de uma
       frase: "fora 13 kkk" não é voto. */
    ladoPorPalavras(texto, palavras) {
      const n = normalizar(texto);
      if (!n) return -1;
      const partes = n.split(" ");
      const repetido = partes.every(x => x === partes[0]) ? partes[0] : null;
      return this.candidatos.findIndex(c => palavras(c).some(p => {
        const alvo = normalizar(p);
        return alvo === n || alvo === repetido;
      }));
    }

    presente({ id, nick, avatar, presente, quantidade = 1, moedas = 0, faixa = null }) {
      const pontos = Math.max(0, Math.round(moedas));
      if (!pontos) return [];
      const quem = quemDe({ id, nick, avatar });
      let lado = this.ladoSimulado ? this.ladoSimulado(quem.id) : this.ladoDoPresente(presente);
      if (lado >= 0) this.escolhas.set(quem.id, lado);
      else lado = this.escolhas.has(quem.id) ? this.escolhas.get(quem.id) : -1;

      if (lado < 0) {
        const p = this.pendentes.get(quem.id) || { quem, pontos: 0, presentes: [], faixa: null };
        p.quem = quem;
        p.pontos += pontos;
        p.presentes.push({ presente, quantidade });
        if (faixa !== null) p.faixa = Math.max(p.faixa ?? -1, faixa);
        this.pendentes.set(quem.id, p);
        return [{ tipo: "pendente", quem, pontos: p.pontos, presente, quantidade }];
      }
      return [...this.liberar(lado, quem), { tipo: "entrada", fonte: "presente", lado, quem, pontos, presente, quantidade, liberado: false, faixa }];
    }

    liberar(lado, quem) {
      const p = this.pendentes.get(quem.id);
      if (!p) return [];
      this.pendentes.delete(quem.id);
      const presente = [...new Set(p.presentes.map(x => x.presente))].join(", ");
      const quantidade = p.presentes.reduce((s, x) => s + x.quantidade, 0);
      return [{ tipo: "entrada", fonte: "presente", lado, quem, pontos: p.pontos, presente, quantidade, liberado: true, faixa: p.faixa }];
    }

    comentario({ id, nick, avatar, texto, agora = Date.now() }) {
      const quem = quemDe({ id, nick, avatar });
      let lado = this.ladoPorPalavras(texto, c => c.comandos);
      const aviso = [];
      if (lado < 0) {
        lado = this.ladoPorPalavras(texto, c => [c.presente.nome, ...c.presente.aceitos, ...(c.presente.palavras || [])]);
        if (lado >= 0) aviso.push({ tipo: "comentouPresente", lado, quem });
        else if (this.ladoSimulado) lado = this.ladoSimulado(quem.id);
        else return [];
      }
      const antes = this.escolhas.get(quem.id);
      this.escolhas.set(quem.id, lado);
      const escolha = antes === lado ? [] : [{ tipo: "escolha", lado, quem, trocou: antes !== undefined }];
      return [...aviso, ...escolha, ...this.liberar(lado, quem), ...this.micro("comentario", lado, quem, agora)];
    }

    /* Rajada de 500 curtidas não vira 20 pontos: guarda no máximo um pacote. */
    curtida({ id, nick, avatar, curtidas = 1, agora = Date.now() }, pontosDoLado) {
      const r = this.regras.curtida;
      if (!r || !(r.pontos > 0) || !(r.cada > 0)) return [];
      const quem = quemDe({ id, nick, avatar });
      const n = Math.min(r.cada, (this.curtidasGuardadas.get(quem.id) || 0) + Math.max(1, Math.round(curtidas)));
      this.curtidasGuardadas.set(quem.id, n);
      if (n < r.cada) return [];
      const saida = this.micro("curtida", this.ladoDoFa(quem, pontosDoLado), quem, agora);
      if (saida.length) this.curtidasGuardadas.set(quem.id, 0);
      return saida;
    }

    /* O TikTok reenvia o follow: vale uma vez por pessoa na live. */
    seguiu({ id, nick, avatar }, pontosDoLado) {
      const r = this.regras.seguiu;
      const quem = quemDe({ id, nick, avatar });
      if (!r || !(r.pontos > 0) || this.seguiram.has(quem.id)) return [];
      this.seguiram.add(quem.id);
      return [{ tipo: "entrada", fonte: "seguiu", lado: this.ladoDoFa(quem, pontosDoLado), quem, pontos: r.pontos, presente: null, quantidade: 0, liberado: false, faixa: null }];
    }

    ladoDoFa(quem, pontosDoLado) {
      if (this.escolhas.has(quem.id)) return this.escolhas.get(quem.id);
      let lado = this.ladoSimulado ? this.ladoSimulado(quem.id) : -1;
      if (lado < 0) {
        const [ta, tb] = [this.torcida(0), this.torcida(1)];
        lado = ta !== tb ? (ta < tb ? 0 : 1) : pontosDoLado(0) <= pontosDoLado(1) ? 0 : 1;
      }
      this.escolhas.set(quem.id, lado);
      return lado;
    }

    torcida(lado) {
      let n = 0;
      for (const l of this.escolhas.values()) if (l === lado) n++;
      return n;
    }

    micro(fonte, lado, quem, agora) {
      const r = this.regras[fonte];
      if (!r || !(r.pontos > 0)) return [];
      const ultimo = this.ultimo[fonte].get(quem.id);
      if (ultimo !== undefined && agora - ultimo < r.intervalo * 1000) return [];
      const ja = this.somados[fonte].get(quem.id) || 0;
      const pontos = Math.round(Math.min(r.pontos, r.teto - ja) * 100) / 100;
      if (pontos <= 0) return [];
      this.ultimo[fonte].set(quem.id, agora);
      this.somados[fonte].set(quem.id, ja + pontos);
      return [{ tipo: "entrada", fonte, lado, quem, pontos, presente: null, quantidade: 0, liberado: false, faixa: null }];
    }
  }

  raiz.Lados = Lados;
  raiz.normalizarTexto = normalizar;
  raiz.hashTexto = hashTexto;
  raiz.quemDe = quemDe;
  if (typeof module !== "undefined") module.exports = { Lados, normalizar, hashTexto, quemDe };
})(typeof window !== "undefined" ? window : globalThis);
