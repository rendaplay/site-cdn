/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio dela. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.chave = chave;
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, nome, valor, tipo = "text", cls = "") =>
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}" ${tipo === "number" ? 'step="any"' : ""}></label>`;
    const marca = (rotulo, nome, ligado) =>
      `<label class="linha"><input type="checkbox" name="${nome}" ${ligado ? "checked" : ""}>${rotulo}</label>`;
    const faixa = (f, i) => `
      <fieldset class="faixa"><legend>Faixa ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number")}
        ${campo("Efeito", `faixas.${i}.nome`, f.nome)}
      </fieldset>`;

    this.form.innerHTML = `
      <h2>Ajustes do ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Geral</legend>
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        ${marca("Som do jogo", "som", config.som)}
        ${marca("Narrador", "narrador", config.narrador)}
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração da rodada (s)", "duracao", config.duracao, "number")}
        ${campo("Pódio na tela (s)", "podio", config.podio, "number")}
        ${campo("Vitrine sem ninguém comentar (s)", "ociosidade", config.ociosidade, "number")}
        ${campo("Melhor bola mínima pra recorde", "recordeMinimo", config.recordeMinimo, "number")}
      </fieldset>
      <fieldset><legend>Mesa</legend>
        ${campo("Bolas de comentário na mesa", "maxBolas", config.maxBolas, "number")}
        ${campo("Bolas com as de presente", "maxPresente", config.maxPresente, "number")}
        ${campo("Fila de espera", "filaCurta", config.filaCurta, "number")}
        ${campo("Pulo da bola: espera por pessoa (s)", "intervaloTilt", config.intervaloTilt, "number")}
        ${campo("Inclinação (gravidade)", "gravidade", config.gravidade, "number")}
        ${campo("Força do lançador", "lancamento", config.lancamento, "number")}
        ${campo("Flipper: chance de errar (0 a 1)", "ia.erro", config.ia.erro, "number")}
        ${campo("Flipper: reação (s)", "ia.reacao", config.ia.reacao, "number")}
      </fieldset>
      <fieldset><legend>Jackpot e 2X</legend>
        ${campo("Meta do jackpot", "jackpot.meta", config.jackpot.meta, "number")}
        ${campo("Meta cresce (×)", "jackpot.cresce", config.jackpot.cresce, "number")}
        ${campo("Festa do jackpot (s)", "jackpot.festa", config.jackpot.festa, "number")}
        ${campo("2X dura (s)", "multiplicador.duracao", config.multiplicador.duracao, "number")}
        ${campo("2X: cada curtida enche", "multiplicador.curtida", config.multiplicador.curtida, "number")}
      </fieldset>
      <fieldset><legend>Efeitos</legend>
        ${campo("Ímã (s)", "ima", config.ima, "number")}
        ${campo("Bola de fogo (s)", "fogo", config.fogo, "number")}
        ${campo("Mesa é sua (s)", "mesa", config.mesa, "number")}
        ${campo("Efeitos na fila de cada pessoa", "filaMaxima", config.filaMaxima, "number")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes · <kbd>Enter</kbd> pausa · <kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa</div>
        <div><kbd>T</kbd> 10 comentários · <kbd>C</kbd> curtidas · <kbd>J</kbd> enche o jackpot</div>
        <div><kbd>F</kbd> novo seguidor (reforço) · <kbd>H</kbd> compartilhou · <kbd>E</kbd> encerra a rodada</div>
        <div><kbd>D</kbd> plateia de demonstração · <kbd>R</kbd> zera a live</div>
      </div>`;

    this.form.onsubmit = e => {
      e.preventDefault();
      Config.salvar(chave, this.ler());
      location.reload();
    };
    this.form.onclick = e => {
      const acao = e.target.dataset && e.target.dataset.acao;
      if (acao === "fechar") this.alternar(false);
      if (acao === "restaurar") { Config.restaurar(chave); location.reload(); }
      if (acao === "copiar" && navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(this.ler(), null, 2));
        e.target.textContent = "Copiado";
      }
    };
    this.form.addEventListener("pointerdown", e => e.stopPropagation());
  },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input, select")) {
      const caminho = input.name.split(".");
      const valor = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Number(input.value) || 0
        : input.value.trim();
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    c.duracao = Math.max(30, c.duracao);
    c.podio = Math.max(3, c.podio);
    c.ociosidade = Math.max(10, c.ociosidade);
    c.maxBolas = Math.min(20, Math.max(1, Math.round(c.maxBolas)));
    c.maxPresente = Math.max(c.maxBolas, Math.min(24, Math.round(c.maxPresente)));
    c.filaCurta = Math.max(0, Math.round(c.filaCurta));
    c.gravidade = Math.min(4000, Math.max(300, c.gravidade));
    c.lancamento = Math.min(3400, Math.max(1500, c.lancamento));
    c.ia.erro = Math.min(1, Math.max(0, c.ia.erro));
    c.ia.reacao = Math.min(0.5, Math.max(0, c.ia.reacao));
    c.jackpot.meta = Math.max(10000, c.jackpot.meta);
    c.jackpot.cresce = Math.max(1, c.jackpot.cresce);
    c.multiplicador.curtida = Math.max(0.0005, c.multiplicador.curtida);
    c.filaMaxima = Math.max(1, Math.round(c.filaMaxima));
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
