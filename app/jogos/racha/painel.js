/* Painel de ajustes (tecla P). Salva por cima do preset neste PC e
   recarrega: é feito pra usar antes da live, não no meio dela. */
"use strict";

const Painel = {
  form: null,

  montar(chave, config) {
    this.config = config;
    this.form = document.querySelector(".painel");
    const campo = (rotulo, caminho, tipo = "number") => {
      const v = caminho.split(".").reduce((o, k) => o[k], config);
      if (tipo === "checkbox") return `<label class="linha"><input type="checkbox" name="${caminho}" ${v ? "checked" : ""}>${rotulo}</label>`;
      return `<label>${rotulo}<input type="${tipo}" name="${caminho}" value="${escapar(v)}" ${tipo === "number" ? 'step="any"' : ""}></label>`;
    };
    const faixa = (f, i) => {
      const opcoes = Object.keys(EFEITOS).map(k => `<option value="${k}" ${k === f.efeito ? "selected" : ""}>${EFEITOS[k].nome}</option>`).join("");
      return `<label>Faixa ${i + 1}: a partir de (moedas)<input type="number" name="faixas.${i}.moedas" value="${f.moedas}" step="1"></label>` +
        `<label>Faixa ${i + 1}: efeito<select name="faixas.${i}.efeito">${opcoes}</select></label>`;
    };

    this.form.innerHTML = `
      <h2>Ajustes do racha</h2>
      <p class="sub-painel">Preset <b>${escapar(chave)}</b>. Fica salvo neste PC; o arquivo preset.js não muda.</p>
      <fieldset><legend>Corrida</legend>
        ${campo("Modo seguro TikTok (sem pedir presente)", "modoSeguro", "checkbox")}
        ${campo("Tamanho da pista (m)", "pista")}
        ${campo("Velocidade base (m/s)", "velocidade")}
        ${campo("Espera entre rodadas (s)", "fases.espera")}
        ${campo("Pódio (s)", "fases.podio")}
        ${campo("Mínimo de pilotos pra largar", "minimoPilotos")}
        ${campo("Máximo de pilotos na rodada", "maxPilotos")}
        ${campo("Sai da grade depois de quantos s parado", "inatividade")}
        ${campo("Carros na pista (vertical)", "teto.vertical")}
        ${campo("Carros na pista (horizontal)", "teto.horizontal")}
      </fieldset>
      <fieldset><legend>Presentes por faixa</legend>
        ${config.faixas.map(faixa).join("")}
        ${campo("Reta final: começa em (fração da pista)", "retaFinal.inicio")}
        ${campo("Reta final: multiplicador", "retaFinal.multiplicador")}
      </fieldset>
      <fieldset><legend>Comentário, curtida, seguir</legend>
        ${campo("Buzina: intervalo por pessoa (s)", "buzina.intervalo")}
        ${campo("Buzina: máximo por rodada", "buzina.maximo")}
        ${campo("Curtida: metros cada", "curtida.metros")}
        ${campo("Curtida: teto de curtidas por vez", "curtida.maximo")}
        ${campo("Curtida: intervalo por pessoa (s)", "curtida.intervalo")}
        ${campo("Seguiu: segundos de turbo", "seguiu")}
        ${campo("Compartilhou: segundos de nitro", "compartilhou")}
      </fieldset>
      <fieldset><legend>Evento-surpresa</legend>
        ${campo("Ligado", "surpresa.ligada", "checkbox")}
        ${campo("Dispara com quantos s sem presente", "surpresa.frio")}
        ${campo("Intervalo mínimo entre eventos (s)", "surpresa.intervalo")}
        ${campo("Nitro em dobro dura (s, fora do modo seguro)", "surpresa.dobro")}
        ${campo("Temporada de míssil: a partir de (moedas, fora do modo seguro)", "surpresa.missil.moedas")}
      </fieldset>
      <fieldset><legend>Som</legend>
        ${campo("Som do jogo", "som", "checkbox")}
        ${campo("Volume do som (0 a 100)", "volume")}
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
        <div><kbd>1</kbd>–<kbd>6</kbd> presente de teste por faixa</div><div><kbd>E</kbd> evento-surpresa agora</div>
        <div><kbd>N</kbd> próxima fase</div><div><kbd>D</kbd> plateia de demonstração</div>
        <div><kbd>R</kbd> <kbd>R</kbd> zera a live</div>
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
    for (const input of this.form.querySelectorAll("input, select")) {
      const caminho = input.name.split(".");
      let alvo = c;
      caminho.slice(0, -1).forEach(k => { alvo = alvo[k]; });
      const chave = caminho[caminho.length - 1];
      alvo[chave] = input.type === "checkbox" ? input.checked
        : input.type === "number" ? Number(input.value) || 0
        : input.value.trim();
    }
    return c;
  },

  aberto() { return !this.form.hidden; },

  alternar(on = this.form.hidden) {
    this.form.hidden = !on;
    if (on) this.form.querySelector("input").focus();
  },
};
