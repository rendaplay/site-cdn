/* Service worker mínimo: sem ele o Android não oferece "Instalar app".
   Rede primeiro em tudo: o jogo precisa da versão nova e dos eventos ao vivo. */
"use strict";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", evento => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
