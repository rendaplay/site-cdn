/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio da corrida. */
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
      <h2>Ajustes da Corrida Presidencial</h2>
      <p class="sub">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Corrida</legend>
        ${campo("Tamanho da pista (metros)", "pista", config.pista, "number")}
        ${campo("Velocidade sem apoio (m/s)", "base", config.base, "number")}
        ${campo("Pódio (segundos)", "podio", config.podio, "number")}
      </fieldset>
      <fieldset><legend>Efeito por tamanho do apoio (votos)</legend>
        <p class="dica">Abaixo do nitro, cada apoio é impulso. Presente configurado no ⚙ segue a escolha de lá.</p>
        ${campo("🔥 Nitro a partir de", "faixas.1.de", config.faixas[1].de, "number")}
        ${campo("🍌 Casca no rival a partir de", "faixas.2.de", config.faixas[2].de, "number")}
        ${campo("🚀 Jato a partir de", "faixas.3.de", config.faixas[3].de, "number")}
      </fieldset>
      <fieldset><legend>Som</legend>
        <label class="linha cheia"><input type="checkbox" name="som" ${config.som !== false ? "checked" : ""}>Som do jogo ligado</label>
        ${campo("Volume (0 a 100)", "volume", config.volume, "number")}
        ${Vozes.campoLocutor(config.locutor)}
        ${campo("Volume da música (0 a 100)", "musica", config.musica, "number")}
      </fieldset>
      <fieldset><legend>Modo seguro TikTok</legend>
        <p class="dica">Sempre ligado neste jogo: a tela fala em votos, não mostra moedas e não pede presente. O TikTok restringe live por "solicitação artificial de presentes".</p>
        <label class="linha cheia"><input type="checkbox" checked disabled>Modo seguro ligado</label>
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes</div><div><kbd>Espaço</kbd> pausa</div>
        <div><kbd>N</kbd> nova largada</div><div><kbd>R</kbd> zera a série</div>
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

  /* Pista de 0 m acabaria na largada: número abaixo do mínimo vira o mínimo. */
  MINIMOS: { pista: 100, base: 0.5, podio: 4, "faixas.1.de": 2, "faixas.2.de": 3, "faixas.3.de": 4 },
  MAXIMOS: { volume: 100, musica: 100 },
  DECIMAIS: { base: true },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input[name]")) {
      const caminho = input.name.split(".");
      const valor = input.type === "checkbox" ? input.checked
        : this.numero(input.name, input.value);
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      alvo[caminho[caminho.length - 1]] = valor;
    }
    /* faixa fora de ordem trocaria o efeito de lugar */
    for (let i = 1; i < c.faixas.length; i++) c.faixas[i].de = Math.max(c.faixas[i].de, c.faixas[i - 1].de + 1);
    c.locutor = this.form.elements.locutor.value;
    return c;
  },

  numero(nome, texto) {
    const n = Number(String(texto).replace(",", ".")) || 0;
    const v = this.DECIMAIS[nome] ? Math.round(n * 10) / 10 : Math.round(n);
    return Math.min(this.MAXIMOS[nome] ?? Infinity, Math.max(this.MINIMOS[nome] ?? 0, v));
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
