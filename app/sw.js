/* Sem ele o Android não oferece "Instalar app". Também guarda os arquivos dos
   jogos no aparelho: na primeira busca depois de publicar, o jsDelivr leva
   segundos por arquivo e às vezes responde 404, e o jogo ficava minutos com a
   tela preta em internet fraca. A cópia na VPS (mesmo caminho em /app/) é a
   reserva quando a CDN falha ou demora. */
"use strict";

const CDN = "https://cdn.jsdelivr.net/gh/rendaplay/site-cdn@";
const PREFIXO_CACHE = "rp-jogos-";
// Sem resposta da CDN nesse tempo, pede também pra VPS e fica com a primeira.
const PACIENCIA_CDN_MS = 2500;
// Áudio vai com Range e o Safari não toca resposta inteira guardada: segue direto.
const AUDIO = /\.(mp3|ogg|wav|m4a|mp4|webm)$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", evento => evento.waitUntil(self.clients.claim()));

/* "https://cdn…/site-cdn@<hash>/app/jogos/x.js" → { versao: "<hash>", caminho: "jogos/x.js" } */
function lerEndereco(url) {
  if (!url.startsWith(CDN)) return null;
  const resto = url.slice(CDN.length).split("?")[0];
  const barra = resto.indexOf("/app/");
  if (barra < 0) return null;
  return { versao: resto.slice(0, barra), caminho: resto.slice(barra + "/app/".length) };
}

async function buscarOk(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (!resposta.ok) throw new Error(`${url}: ${resposta.status}`);
  return resposta;
}

function baixar(url, caminho) {
  const daCdn = buscarOk(url, { mode: "cors" });
  const daVps = new Promise((resolve, reject) => {
    const reserva = () => buscarOk(new URL(caminho, self.registration.scope)).then(resolve, reject);
    const espera = setTimeout(reserva, PACIENCIA_CDN_MS);
    daCdn.then(() => clearTimeout(espera), () => { clearTimeout(espera); reserva(); });
  });
  return Promise.any([daCdn, daVps]);
}

async function servir(pedido, endereco) {
  const cache = await caches.open(PREFIXO_CACHE + endereco.versao);
  const guardada = await cache.match(pedido.url);
  if (guardada) return guardada;
  const resposta = await baixar(pedido.url, endereco.caminho);
  cache.put(pedido.url, resposta.clone()).catch(() => {});
  return resposta;
}

self.addEventListener("fetch", evento => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const endereco = lerEndereco(pedido.url);
  if (!endereco) return;
  if (pedido.headers.has("range") || AUDIO.test(endereco.caminho)) {
    evento.respondWith(fetch(pedido).catch(() => fetch(new URL(endereco.caminho, self.registration.scope))));
    return;
  }
  evento.respondWith(servir(pedido, endereco));
});

/* O app pede pra deixar o jogo pronto antes de abrir e acompanha o progresso. */
self.addEventListener("message", evento => {
  const { tipo, base, jogo } = evento.data || {};
  if (tipo !== "preparar") return;
  evento.waitUntil(preparar(base, jogo, evento.source));
});

async function preparar(base, jogo, cliente) {
  const avisar = dados => cliente && cliente.postMessage({ tipo: "preparo", jogo, ...dados });
  try {
    const versao = lerEndereco(base + "x").versao;
    const lista = await (await fetch(new URL(`jogos/${jogo}/arquivos.json`, self.registration.scope), { cache: "no-cache" })).json();
    const cache = await caches.open(PREFIXO_CACHE + versao);
    for (const nome of await caches.keys()) {
      if (nome.startsWith(PREFIXO_CACHE) && nome !== PREFIXO_CACHE + versao) await caches.delete(nome);
    }
    // O progresso é só do que segura a abertura; as imagens seguem caladas.
    const total = lista.essenciais.length;
    let prontos = 0;
    let falhas = 0;
    const baixarTodos = async (caminhos, contar) => {
      const fila = [...caminhos];
      const trabalhador = async () => {
        while (fila.length) {
          const caminho = fila.shift();
          const url = base + caminho;
          try {
            if (!(await cache.match(url))) await cache.put(url, await baixar(url, caminho));
          } catch (e) {
            falhas++;
          }
          if (contar) avisar({ prontos: ++prontos, total });
        }
      };
      await Promise.all([1, 2, 3, 4, 5, 6].map(trabalhador));
    };
    await baixarTodos(lista.essenciais, true);
    avisar({ essenciais: true, falhas });
    await baixarTodos(lista.resto, false);
    avisar({ fim: true, falhas });
  } catch (e) {
    avisar({ essenciais: true, fim: true, falhas: -1, erro: String(e) });
  }
}
