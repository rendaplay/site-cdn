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
      <fieldset class="nivel"><legend>Faixa ${i + 1}</legend>
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
        ${campo("Volume da batucada (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (s)", "rodada.duracao", config.rodada.duracao, "number")}
        ${campo("Festa do vencedor (s)", "rodada.fim", config.rodada.fim, "number")}
        ${campo("Ranking na tela (s)", "rodada.intervalo", config.rodada.intervalo, "number")}
        ${campo("Comentário: barulho a cada (s)", "chat.intervalo", config.chat.intervalo, "number")}
      </fieldset>
      <fieldset><legend>Barulho</legend>
        ${campo("Por comentário", "barulho.comentario", config.barulho.comentario, "number")}
        ${campo("Por curtida", "barulho.curtida", config.barulho.curtida, "number")}
        ${campo("Curtidas: máximo por vez", "barulho.curtidaMax", config.barulho.curtidaMax, "number")}
        ${campo("Cai pela metade em (s)", "barulho.meiaVida", config.barulho.meiaVida, "number")}
      </fieldset>
      <fieldset><legend>Caravana</legend>
        ${campo("Torcedores por moeda", "caravana.porMoeda", config.caravana.porMoeda, "number")}
        ${campo("Mínimo", "caravana.minimo", config.caravana.minimo, "number")}
        ${campo("Máximo", "caravana.maximo", config.caravana.maximo, "number")}
      </fieldset>
      <fieldset><legend>Torcedor sem @</legend>
        ${marca("Chegam com o chat parado (não contam)", "genericos.ligado", config.genericos.ligado)}
        ${campo("Um a cada (s)", "genericos.intervalo", config.genericos.intervalo, "number")}
        ${campo("Máximo por setor", "genericos.porSetor", config.genericos.porSetor, "number")}
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
        <div><kbd>T</kbd> 10 torcedores chegando</div><div><kbd>E</kbd> encerra a rodada</div>
        <div><kbd>D</kbd> plateia de demonstração</div><div><kbd>R</kbd> zera a live</div>
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
    c.rodada.duracao = Math.max(10, c.rodada.duracao);
    c.rodada.fim = Math.max(2, c.rodada.fim);
    c.rodada.intervalo = Math.max(2, c.rodada.intervalo);
    c.barulho.meiaVida = Math.max(1, c.barulho.meiaVida);
    c.caravana.maximo = Math.max(c.caravana.minimo, c.caravana.maximo);
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
