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
        ${campo("Volume da batucada (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (s)", "rodada.duracao", config.rodada.duracao, "number")}
        ${campo("Festa do vencedor (s)", "rodada.fim", config.rodada.fim, "number")}
        ${campo("Ranking na tela (s)", "rodada.intervalo", config.rodada.intervalo, "number")}
      </fieldset>
      <fieldset><legend>Círculo</legend>
        ${campo("Raio (m)", "arena.raio", config.arena.raio, "number")}
        ${campo("Atrito do gramado", "arena.atrito", config.arena.atrito, "number")}
        ${campo("Cambaleia na beira (s)", "arena.beira", config.arena.beira, "number")}
        ${campo("Chance do comentário salvar (0 a 1)", "arena.salvar", config.arena.salvar, "number")}
      </fieldset>
      <fieldset><legend>Empurrão</legend>
        ${campo("1 por pessoa a cada (s)", "chat.intervalo", config.chat.intervalo, "number")}
        ${campo("Comentário (m/s)", "empurrao.chat", config.empurrao.chat, "number")}
        ${campo("Curtida (m/s)", "empurrao.curtida", config.empurrao.curtida, "number")}
        ${campo("Bônus por ponto de força", "empurrao.porForca", config.empurrao.porForca, "number")}
      </fieldset>
      <fieldset><legend>Juiz</legend>
        ${campo("Apita a cada (s)", "arbitro.intervalo", config.arbitro.intervalo, "number")}
        ${campo("Empurrão do juiz (m/s)", "arbitro.empurrao", config.arbitro.empurrao, "number")}
        ${campo("Tonto no amarelo (s)", "arbitro.tonto", config.arbitro.tonto, "number")}
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
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa (time sorteado)</div>
        <div><kbd>T</kbd> 10 comentários · <kbd>J</kbd> chama o juiz</div>
        <div><kbd>E</kbd> encerra a rodada · <kbd>D</kbd> plateia de demonstração · <kbd>R</kbd> zera a live</div>
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
    c.arena.raio = Math.min(8, Math.max(3, c.arena.raio));
    c.arena.atrito = Math.max(0.5, c.arena.atrito);
    c.arbitro.intervalo = Math.max(5, c.arbitro.intervalo);
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
