/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio dela. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, caminho, tipo = "text", cls = "") => {
      const v = caminho.split(".").reduce((o, k) => o[k], config);
      if (tipo === "checkbox") return `<label class="linha ${cls}"><input type="checkbox" name="${caminho}" ${v ? "checked" : ""}>${rotulo}</label>`;
      const valor = Array.isArray(v) ? v.join(", ") : v;
      return `<label class="${cls}">${rotulo}<input type="${tipo}" name="${caminho}" value="${escapar(valor)}" ${tipo === "number" ? 'step="any"' : ""}></label>`;
    };
    const time = (t, i) => `
      <fieldset><legend>Time ${i + 1}</legend>
        ${campo("Nome", `times.${i}.nome`)}
        ${campo("Cor", `times.${i}.cor`, "color")}
        ${campo("Comentários que entram no time (vírgula)", `times.${i}.comandos`)}
        ${campo("Presente-símbolo: nome na tela", `times.${i}.presente.nome`)}
        ${campo("Presente-símbolo: nomes que a live manda (vírgula)", `times.${i}.presente.aceitos`)}
        ${campo("Efeitos por faixa, do mais barato ao mais caro (vírgula)", `times.${i}.efeitos`, "text", "cheia")}
      </fieldset>`;

    this.form.innerHTML = `
      <h2>Ajustes da escalada</h2>
      <p class="sub-painel">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      ${config.times.map(time).join("")}
      <fieldset><legend>TikTok</legend>
        ${campo("Modo seguro TikTok (sem pedir presente)", "modoSeguro", "checkbox", "cheia")}
      </fieldset>
      <fieldset><legend>Subida</legend>
        ${campo("Metros por moeda", "regras.metrosPorMoeda", "number")}
        ${campo("Sobe sozinho (m/s)", "regras.subidaSozinho", "number")}
        ${campo("Até o 1º checkpoint sobe quantas vezes mais rápido", "regras.arrancada", "number")}
        ${campo("Checkpoint a cada (m)", "regras.checkpoint", "number")}
        ${campo("Resistência da corda (m de força)", "regras.corda", "number")}
        ${campo("Comentário 1/2 move (m)", "regras.comentario.metros", "number")}
        ${campo("Comentário: intervalo por pessoa (s)", "regras.comentario.intervalo", "number")}
        ${campo("Cada curtida sobe (m)", "regras.curtida", "number")}
        ${campo("Seguiu sobe (m)", "regras.seguiu", "number")}
        ${campo("Compartilhou sobe (m)", "regras.compartilhou", "number")}
        ${campo("Faixas de preço (vírgula)", "faixas")}
        ${campo("Anúncio grande a partir de (moedas)", "destaqueMoedas", "number")}
        ${campo("Presente lendário a partir de (moedas)", "lendarioMoedas", "number")}
        ${campo("Força cai acima de (moedas)", "regras.retorno.acima", "number")}
        ${campo("Expoente acima disso (1 = linear)", "regras.retorno.expoente", "number")}
        ${campo("Presente sem time espera (s, 0 = vai pra Ajuda)", "regras.pendente", "number")}
        ${campo("Maior queda vale a partir de (m)", "regras.recordeQueda", "number")}
        ${campo("Sabotagem no chão atola o Zé", "regras.atolar", "checkbox")}
        ${campo("Atolado no máximo (m)", "regras.atoladoMax", "number")}
      </fieldset>
      <fieldset><legend>Evento-surpresa</legend>
        ${campo("Ligado", "surpresa.ligada", "checkbox")}
        ${campo("Dispara com quantos segundos sem presente", "surpresa.frio", "number")}
        ${campo("Intervalo mínimo entre eventos (s)", "surpresa.intervalo", "number")}
        ${campo("Em dobro dura (s)", "surpresa.dobro", "number")}
        ${campo("Ventania: queda (m)", "surpresa.ventania.metros", "number")}
        ${campo("Ventania: moedas pra segurar", "surpresa.ventania.segurar", "number")}
      </fieldset>
      <fieldset><legend>Personagem e som</legend>
        ${campo("Cor da regata", "personagem.regata", "color")}
        ${campo("Cor da bermuda", "personagem.bermuda", "color")}
        ${campo("Som do jogo", "som", "checkbox")}
        ${campo("Volume do som (0 a 100)", "volume", "number")}
      </fieldset>
      <div class="botoes">
        <button type="submit" class="principal">Salvar e recarregar</button>
        <button type="button" data-acao="copiar">Copiar JSON</button>
        <button type="button" data-acao="restaurar">Voltar ao preset</button>
        <button type="button" data-acao="fechar">Fechar</button>
      </div>
      <div class="atalhos">
        <div><kbd>P</kbd> ajustes</div><div><kbd>Espaço</kbd> pausa</div>
        <div><kbd>F</kbd> vertical / horizontal</div><div><kbd>S</kbd> som</div>
        <div><kbd>1</kbd> <kbd>2</kbd> presente de teste</div><div><kbd>E</kbd> evento-surpresa agora</div>
        <div><kbd>D</kbd> plateia de demonstração</div><div><kbd>R</kbd> <kbd>R</kbd> zera a live</div>
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
  },

  ler() {
    const c = clonar(this.config);
    for (const input of this.form.querySelectorAll("input")) {
      const caminho = input.name.split(".");
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      const chave = caminho[caminho.length - 1];
      const antes = alvo[chave];
      let valor = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Number(input.value) || 0
        : input.value.trim();
      if (Array.isArray(antes)) {
        valor = valor.split(",").map(x => x.trim()).filter(Boolean);
        if (antes.every(x => typeof x === "number")) valor = valor.map(Number).filter(Number.isFinite);
      }
      alvo[chave] = valor;
    }
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
