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
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}"></label>`;
    const faixa = (f, i) => `
      <fieldset class="faixa"><legend>Faixa ${i + 1}</legend>
        ${campo("A partir de (moedas)", `faixas.${i}.moedas`, f.moedas, "number")}
        ${campo("Bolinhas", `faixas.${i}.bolinhas`, f.bolinhas, "number")}
        ${campo("Nome", `faixas.${i}.nome`, f.nome)}
        ${campo("Na legenda", `faixas.${i}.texto`, f.texto)}
      </fieldset>`;
    const s = config.surpresa;

    this.form.innerHTML = `
      <h2>Ajustes da ${escapar(config.titulo)}</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Geral</legend>
        ${campo("Título", "titulo", config.titulo, "text", "cheia")}
        <label class="linha"><input type="checkbox" name="som" ${config.som ? "checked" : ""}>Som do jogo</label>
        ${campo("Volume do som (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
        ${campo("Pontos dos potes (esquerda → direita)", "potes", config.potes.join(", "), "text", "cheia")}
      </fieldset>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (s)", "rodada.duracao", config.rodada.duracao, "number")}
        ${campo("Pódio na tela (s)", "rodada.podio", config.rodada.podio, "number")}
        ${campo("Comentário: 1 bolinha a cada (s)", "chat.intervalo", config.chat.intervalo, "number")}
        ${campo("Curtidas pro choque", "chat.curtidas", config.chat.curtidas, "number")}
        ${campo("Bolinhas por compartilhar", "chat.compartilhar", config.chat.compartilhar, "number")}
        ${campo("Máximo de bolinhas na mesa", "mesa.limite", config.mesa.limite, "number")}
      </fieldset>
      <fieldset><legend>Pino de ouro (chat esfriou)</legend>
        <label class="linha"><input type="checkbox" name="surpresa.ligada" ${s.ligada ? "checked" : ""}>Ligado</label>
        ${campo("Depois de quantos s sem presente", "surpresa.semPresente", s.semPresente, "number")}
        ${campo("Intervalo mínimo (s)", "surpresa.intervalo", s.intervalo, "number")}
        ${campo("Dura (s)", "surpresa.duracao", s.duracao, "number")}
        ${campo("Multiplica por", "surpresa.multiplica", s.multiplica, "number")}
      </fieldset>
      <fieldset><legend>Lendário</legend>
        ${campo("A partir de (moedas)", "lendario.moedas", config.lendario.moedas, "number")}
        ${campo("Bolinhas", "lendario.bolinhas", config.lendario.bolinhas, "number")}
        ${campo("Bolona: potes do meio no máximo por (s)", "bolonaDuracao", config.bolonaDuracao, "number", "cheia")}
      </fieldset>
      ${config.faixas.map(faixa).join("")}
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes · <kbd>Enter</kbd> pausa</div><div><kbd>F</kbd> vertical / horizontal · <kbd>S</kbd> som</div>
        <div><kbd>1</kbd>…<kbd>5</kbd> presente de teste por faixa</div><div><kbd>L</kbd> presente lendário</div>
        <div><kbd>T</kbd> 10 comentários · <kbd>G</kbd> seguiu · <kbd>H</kbd> compartilhou</div><div><kbd>C</kbd> choque (curtidas) · <kbd>O</kbd> pino de ouro</div>
        <div><kbd>E</kbd> encerra a rodada</div><div><kbd>D</kbd> plateia de demonstração · <kbd>R</kbd> zera a live</div>
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
    const potes = String(c.potes).split(",").map(x => Number(x.trim())).filter(n => Number.isFinite(n) && n >= 0);
    c.potes = potes.length >= 3 ? potes : this.config.potes;
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
