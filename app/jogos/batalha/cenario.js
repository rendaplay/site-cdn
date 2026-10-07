/* Cenário atrás das torres: fundo em tela cheia e a arte grande de cada lado.
   `preset.cenario` é uma imagem 1080×1920; sem ela (ou se não carregar) vale o
   desenho de `preset.desenho` ("congresso" ou "arena"). `lados[i].arte` é um
   PNG recortado; sem ela, a `foto` do lado vira um adesivo em duotone. */
"use strict";

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

function nuvem(x, y, s, sombra) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-150 40c-40 0-60-40-30-62 6-40 60-56 90-30 18-50 100-60 128-8 40-22 96 4 92 50 40 6 46 50 0 50z" fill="${sombra}" transform="translate(0 14)"/>
    <path d="M-150 40c-40 0-60-40-30-62 6-40 60-56 90-30 18-50 100-60 128-8 40-22 96 4 92 50 40 6 46 50 0 50z" fill="#fff"/>
  </g>`;
}

function ceu(topo, meio, horizonte) {
  return `<linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${topo}"/><stop offset=".62" stop-color="${meio}"/><stop offset="1" stop-color="${horizonte}"/>
    </linearGradient>`;
}

/* Gramado com as faixas de corte fugindo pro centro do horizonte. */
function gramado(claro, escuro) {
  let faixas = "";
  for (let i = -6; i < 6; i += 2) {
    faixas += `<path d="M540 900L${540 + i * 260} 1920H${540 + (i + 1) * 260}z" fill="${claro}" opacity=".5"/>`;
  }
  return `<rect y="900" width="1080" height="1020" fill="${escuro}"/>${faixas}
    <rect y="900" width="1080" height="1020" fill="url(#nevoa)"/>`;
}

function bandeira(x, y, h, lado) {
  const s = h / 300;
  const vira = lado ? -1 : 1;
  return `<g transform="translate(${x} ${y}) scale(${s * vira} ${s})">
    <rect x="-4" y="-300" width="8" height="300" rx="4" fill="#E9EEF5"/>
    <path d="M4-292c40-14 80 14 120 0v84c-40 14-80-14-120 0z" fill="#1E9E4A"/>
    <path d="M14-250l50-30 50 30-50 30z" fill="#FFD43B" transform="translate(0 4) skewY(-3)"/>
    <circle cx="64" cy="-246" r="17" fill="#1F4FB8"/>
  </g>`;
}

const DESENHOS = {
  congresso() {
    const pedra = "#F6F9FC", sombra = "#CAD7E6", sombraForte = "#AFC1D6";
    const janelas = [...Array(14)].map((_, i) => `<rect x="0" y="${484 + i * 26}" width="52" height="3" fill="${sombra}"/>`).join("");
    /* Blocos dos ministérios ao longo da Esplanada, maiores quanto mais perto. */
    const ministerios = [[30, 150, 62], [10, 100, 46], [0, 70, 34]].map(([dx, w, h], k) => {
      const x = 330 - (k + 1) * 105 - dx;
      return [x, 1080 - x - w].map(xi =>
        `<rect x="${xi}" y="${900 - h}" width="${w}" height="${h}" fill="${pedra}"/><rect x="${xi}" y="${900 - h}" width="${w}" height="6" fill="${sombra}"/>`).join("");
    }).join("");
    return `<svg ${SVG_NS} viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      <defs>${ceu("#2C8DEB", "#8CCBFA", "#E4F4FF")}
        <linearGradient id="nevoa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4F4FF" stop-opacity=".85"/><stop offset=".18" stop-color="#E4F4FF" stop-opacity="0"/></linearGradient>
        <linearGradient id="cupula" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pedra}"/><stop offset="1" stop-color="${sombra}"/></linearGradient>
        <linearGradient id="espelho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AD3F7"/><stop offset="1" stop-color="#5FB4EC"/></linearGradient>
      </defs>
      <rect width="1080" height="920" fill="url(#ceu)"/>
      ${nuvem(140, 590, 0.85, "#CFE6F8")}${nuvem(930, 560, 1, "#CFE6F8")}${nuvem(700, 640, 0.6, "#D8ECFA")}${nuvem(260, 700, 0.5, "#D8ECFA")}
      ${gramado("#B5E07A", "#7CC655")}
      ${ministerios}
      <g transform="translate(540 900) scale(1.45) translate(-540 -900)">
        <rect x="455" y="470" width="52" height="378" fill="${pedra}"/>
        <rect x="573" y="470" width="52" height="378" fill="${pedra}"/>
        <rect x="455" y="470" width="14" height="378" fill="${sombra}"/>
        <rect x="573" y="470" width="14" height="378" fill="${sombra}"/>
        <g transform="translate(455 0)">${janelas}</g><g transform="translate(573 0)">${janelas}</g>
        <rect x="507" y="600" width="66" height="30" fill="${pedra}"/>
        <rect x="507" y="624" width="66" height="6" fill="${sombra}"/>
        <rect x="120" y="840" width="840" height="20" fill="${pedra}"/>
        <rect x="120" y="856" width="840" height="12" fill="${sombraForte}"/>
        <path d="M206 806c30 34 168 34 198 0l-30 34h-138z" fill="url(#cupula)"/>
        <ellipse cx="305" cy="806" rx="99" ry="14" fill="${sombra}"/>
        <ellipse cx="305" cy="804" rx="92" ry="9" fill="${pedra}"/>
        <path d="M690 840c0-62 140-62 140 0z" fill="url(#cupula)"/>
        <path d="M700 840c4-38 30-50 60-52-22 8-36 22-40 52z" fill="#fff" opacity=".8"/>
        <path d="M120 868l-60 32h960l-60-32z" fill="${sombra}"/>
        <path d="M640 868l120-28h40l-130 28z" fill="${pedra}"/>
        <rect x="60" y="900" width="960" height="34" fill="url(#espelho)"/>
        <rect x="60" y="900" width="960" height="4" fill="#fff" opacity=".7"/>
      </g>
      ${bandeira(372, 905, 150, 0)}${bandeira(320, 935, 210, 0)}
      ${bandeira(708, 905, 150, 1)}${bandeira(760, 935, 210, 1)}
    </svg>`;
  },

  arena(cfg) {
    const [a, b] = cfg.lados;
    const torcida = (cor, x0) => {
      let pontos = "";
      for (let fila = 0; fila < 7; fila++) {
        for (let k = 0; k < 18; k++) {
          const x = x0 + k * 30 + (fila % 2) * 15;
          pontos += `<circle cx="${x}" cy="${770 + fila * 18}" r="6" fill="${(k + fila) % 3 ? cor : "#fff"}" opacity="${0.55 + ((k * 7 + fila) % 4) * 0.1}"/>`;
        }
      }
      return pontos;
    };
    const flamulas = [...Array(12)].map((_, i) => {
      const x = 60 + i * 86;
      return `<path d="M${x} 716h40l-20 34z" fill="${i < 6 ? a.cor : b.cor}" stroke="#fff" stroke-width="3"/>`;
    }).join("");
    const refletor = x => `<g transform="translate(${x} 0)">
      <path d="M0 470L-260 900H260z" fill="#fff" opacity=".07"/>
      <rect x="-6" y="470" width="12" height="270" fill="#CBD6E8"/>
      <rect x="-56" y="430" width="112" height="56" rx="8" fill="#E9EFF8"/>
      ${[0, 1, 2, 3].map(i => `<circle cx="${-38 + i * 25}" cy="446" r="8" fill="#FFF6C8"/><circle cx="${-38 + i * 25}" cy="470" r="8" fill="#FFF6C8"/>`).join("")}
      <circle cy="458" r="90" fill="#FFF6C8" opacity=".18"/>
    </g>`;
    return `<svg ${SVG_NS} viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
      <defs>${ceu("#3C6FD6", "#8DB5F2", "#E3EDFF")}
        <linearGradient id="nevoa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3EDFF" stop-opacity=".7"/><stop offset=".16" stop-color="#E3EDFF" stop-opacity="0"/></linearGradient>
        <linearGradient id="arquibancada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3A66"/><stop offset="1" stop-color="#1A2547"/></linearGradient>
      </defs>
      <rect width="1080" height="920" fill="url(#ceu)"/>
      ${nuvem(170, 480, 0.8, "#D3E1FA")}${nuvem(930, 420, 1, "#D3E1FA")}${nuvem(560, 620, 0.5, "#DDE8FC")}
      ${refletor(110)}${refletor(970)}
      <path d="M0 740q540-60 1080 0v170H0z" fill="url(#arquibancada)"/>
      ${torcida(a.cor, 10)}${torcida(b.cor, 550)}
      <path d="M0 716q540-56 1080 0v26q-540-56-1080 0z" fill="#E9EFF8"/>
      ${flamulas}
      <rect y="880" width="1080" height="24" fill="#E9EFF8"/>
      <rect y="880" width="540" height="8" fill="${a.cor}"/><rect x="540" y="880" width="540" height="8" fill="${b.cor}"/>
      ${gramado("#9ED86E", "#5DB347")}
      <path d="M540 904L-200 1920M540 904L1280 1920" stroke="#fff" stroke-width="6" opacity=".55"/>
    </svg>`;
  },
};

/* Duotone na cor do lado misturado à foto original, pra foto não parecer colada. */
function filtroDuo(id, escura, clara) {
  const canal = (k) => {
    const v = h => (parseInt(h.slice(k, k + 2), 16) / 255).toFixed(3);
    return `${v(escura)} ${v(clara)}`;
  };
  return `<filter id="${id}" color-interpolation-filters="sRGB">
    <feColorMatrix type="saturate" values="0" result="cinza"/>
    <feComponentTransfer in="cinza" result="duo">
      <feFuncR type="table" tableValues="${canal(1)}"/><feFuncG type="table" tableValues="${canal(3)}"/><feFuncB type="table" tableValues="${canal(5)}"/>
    </feComponentTransfer>
    <feComposite in="duo" in2="SourceGraphic" operator="arithmetic" k2=".32" k3=".68"/>
  </filter>`;
}

/* Contorno de adesivo pro PNG recortado: fio branco por dentro, cor do lado por fora. */
function filtroContorno(id, cor) {
  return `<filter id="${id}" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="fino"/>
    <feMorphology in="SourceAlpha" operator="dilate" radius="16" result="grosso"/>
    <feFlood flood-color="#fff"/><feComposite in2="fino" operator="in" result="branco"/>
    <feFlood flood-color="${cor}"/><feComposite in2="grosso" operator="in" result="cor"/>
    <feGaussianBlur in="grosso" stdDeviation="18" result="borrado"/>
    <feOffset in="borrado" dy="22" result="caida"/>
    <feFlood flood-color="#06102A" flood-opacity=".45"/><feComposite in2="caida" operator="in" result="sombra"/>
    <feMerge><feMergeNode in="sombra"/><feMergeNode in="cor"/><feMergeNode in="branco"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

const Cenario = {
  montar(palco, cfg) {
    const fundo = palco.querySelector(".cenario");
    fundo.innerHTML = (DESENHOS[cfg.desenho] || DESENHOS.arena)(cfg);
    if (cfg.cenario) {
      const img = new Image();
      img.className = "cenario-img";
      img.alt = "";
      img.onerror = () => img.remove();
      img.src = cfg.cenario;
      fundo.append(img);
    }

    const filtros = cfg.lados.map((l, i) => {
      const s = i ? "b" : "a";
      return filtroDuo(`duo-${s}`, l.corEscura, misturar(l.cor, "#ffffff", 0.92)) + filtroContorno(`contorno-${s}`, l.cor);
    }).join("");
    palco.querySelector(".filtros").innerHTML = `<defs>${filtros}</defs>`;

    cfg.lados.forEach((l, i) => {
      const caixa = palco.querySelector(`.arte-${i ? "b" : "a"}`);
      const adesivo = () => {
        const moldura = el("div", "adesivo");
        const foto = el("img");
        foto.alt = "";
        foto.src = l.foto;
        moldura.append(foto);
        caixa.replaceChildren(moldura);
      };
      if (!l.arte) return adesivo();
      const arte = el("img", "arte-img");
      arte.alt = "";
      arte.onerror = adesivo;
      arte.src = l.arte;
      caixa.replaceChildren(arte);
    });
  },
};
