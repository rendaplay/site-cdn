/* O que fica por cima do céu, em DOM: rei do céu, moedas da live, ranking
   e eventos-surpresa. */
"use strict";

const fmt = new Intl.NumberFormat("pt-BR");
const CORES_AVATAR = ["#3B4C7A", "#6B3F7A", "#2F6E73", "#7A5A2F", "#4F6B2F", "#7A2F4A", "#2F4F7A", "#5E5E6E"];

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto;
  return e;
}

function escapar(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

/* Avatar do TikTok com a inicial por baixo: se a foto não carrega (mock,
   demo, link vencido), fica a inicial numa cor fixa da pessoa. */
function criarAvatar(j) {
  const a = el("span", "avatar");
  /* Primeira letra de verdade: pula emoji e enfeite, mas aceita letra de
     qualquer alfabeto (nick com "𝓛𝓮𝓸" ou "ʚïɞ" é comum). */
  const nome = String(j.nome || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  a.textContent = (Array.from(nome)[0] || "?").toUpperCase();
  a.style.setProperty("--avatar-cor", CORES_AVATAR[hashTexto(j.id || j.nome) % CORES_AVATAR.length]);
  if (j.foto) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { a.textContent = ""; a.style.backgroundImage = `url("${img.src.replace(/"/g, "%22")}")`; };
    img.src = j.foto;
  }
  return a;
}

function tempoNoAr(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const EVENTOS = {
  ventania: "Ventania!",
  dourado: "Cerol dourado",
  avoada: "Pipa avoada!",
};

const Hud = {
  palco: null,

  montar(palco, cfg) {
    this.palco = palco;
    this.cfg = cfg;
    const q = s => palco.querySelector(s);
    this.$ = {
      rei: q(".rei"), moedas: q(".moedas"), ranking: q(".ranking ol"),
      evento: q(".evento"), sinal: q(".sem-sinal"),
    };
    q(".titulo-jogo").textContent = cfg.titulo;
    this.ranking([]);
  },

  /* ───────── placares ───────── */

  placar(combate, agora) {
    const rei = combate.rei(agora);
    const r = this.$.rei;
    if (rei) {
      const j = combate.jogadores.get(rei.id);
      if (r.dataset.id !== rei.id) {
        r.dataset.id = rei.id;
        r.querySelector(".quem").replaceChildren(criarAvatar(j), el("span", "nome", j.nome));
        r.classList.add("ocupado");
      }
      r.querySelector(".tempo").textContent = `${tempoNoAr(agora - rei.entrouEm)} no ar`;
    } else if (r.dataset.id !== "") {
      r.dataset.id = "";
      r.classList.remove("ocupado");
      r.querySelector(".quem").replaceChildren(el("span", "nome vazio", "Ninguém ainda"));
      r.querySelector(".tempo").textContent = "";
    }

    const m = this.$.moedas;
    const num = m.querySelector(".num");
    const txt = fmt.format(combate.moedas);
    if (num.textContent !== txt) {
      num.textContent = txt;
      num.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
    }
    const top = combate.doadores(1)[0];
    m.querySelector(".maior").innerHTML = top
      ? `maior: <b>${escapar(top.nome)}</b> ${fmt.format(top.moedas)}`
      : "nenhum presente ainda";
  },

  ranking(lista) {
    const ol = this.$.ranking;
    const chave = lista.map(j => j.id + ":" + j.cortes).join("|");
    if (ol.dataset.chave === chave) return;
    ol.dataset.chave = chave;
    ol.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const j = lista[i];
      const li = el("li", j ? (i === 0 ? "primeiro" : "") : "vazio");
      li.append(el("span", "pos", String(i + 1)));
      if (j) li.append(criarAvatar(j), el("span", "quem", j.nome), el("span", "valor", String(j.cortes)));
      else li.append(el("span", "quem", "—"));
      ol.append(li);
    }
  },

  /* ───────── evento-surpresa ───────── */

  evento(ev, agora) {
    const caixa = this.$.evento;
    if (!ev) {
      caixa.classList.remove("on");
      return;
    }
    if (caixa.dataset.tipo !== ev.tipo || !caixa.classList.contains("on")) {
      caixa.dataset.tipo = ev.tipo;
      caixa.innerHTML = `<b>${escapar(EVENTOS[ev.tipo])}</b><i><u></u></i>`;
      caixa.classList.add("on");
    }
    const resta = Math.max(0, (ev.fim - agora) / (ev.fim - ev.inicio));
    caixa.querySelector("u").style.width = (resta * 100).toFixed(1) + "%";
  },

  /* Onde os painéis estão (px do palco), pro céu não pôr pipa atrás deles. */
  areas() {
    const caixa = sec => [sec.offsetLeft, sec.offsetTop, sec.offsetLeft + sec.offsetWidth, sec.offsetTop + sec.offsetHeight];
    return [caixa(this.$.ranking.parentElement)];
  },

  sinal(estado) {
    const s = this.$.sinal;
    s.hidden = estado === "conectado" || estado === "demo";
    s.textContent = estado === "desconectado" ? "Sem conector: abra o Renda Play e inicie a live" : "Procurando o conector…";
  },
};
