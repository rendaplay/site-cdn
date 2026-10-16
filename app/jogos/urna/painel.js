/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio da rodada. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.chave = chave;
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, nome, valor, tipo = "text", cls = "") =>
      `<label class="${cls}">${rotulo}<input type="${tipo}" name="${nome}" value="${escapar(valor)}"></label>`;

    this.form.innerHTML = `
      <h2>Ajustes da Urna Eletrônica</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Rodada</legend>
        ${campo("Duração (segundos)", "rodada.segundos", config.rodada.segundos, "number")}
        ${campo("Voto em massa a partir de (votos)", "massa", config.massa, "number")}
      </fieldset>
      <fieldset><legend>Som</legend>
        <label class="linha cheia"><input type="checkbox" name="som" ${config.som !== false ? "checked" : ""}>Som do jogo ligado</label>
        ${campo("Volume (0 a 100)", "volume", config.volume, "number")}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Modo seguro TikTok</legend>
        <p class="dica">Sempre ligado neste jogo: a tela fala em votos, não mostra moedas e não pede presente. O TikTok restringe live por "solicitação artificial de presentes".</p>
        <label class="linha cheia"><input type="checkbox" checked disabled>Modo seguro ligado</label>
        <label class="linha cheia"><input type="checkbox" name="ultraSeguro" ${config.ultraSeguro !== false ? "checked" : ""}>Ultra seguro: sem nome dos candidatos na tela e sem a voz deles</label>
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes</div><div><kbd>Espaço</kbd> pausa</div>
        <div><kbd>N</kbd> encerra a rodada agora</div><div><kbd>R</kbd> zera a rodada</div>
        <div><kbd>F</kbd> vertical / horizontal</div><div><kbd>S</kbd> som liga / desliga</div>
        <div><kbd>1</kbd> <kbd>2</kbd> presente de teste</div><div><kbd>D</kbd> plateia de demonstração</div>
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
    };
  },

  /* Rodada de 0 s encerraria sem parar: número abaixo do mínimo vira o mínimo. */
  MINIMOS: { "rodada.segundos": 15, massa: 1 },
  MAXIMOS: { volume: 100, musica: 100 },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input[name]")) {
      const caminho = input.name.split(".");
      const valor = input.type === "checkbox" ? input.checked
        : Math.min(this.MAXIMOS[input.name] ?? Infinity, Math.max(this.MINIMOS[input.name] ?? 0, Math.round(Number(String(input.value).replace(",", ".")) || 0)));
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
