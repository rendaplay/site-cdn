// Todo link do WhatsApp abre antes uma escolha de setor: o texto pronto já diz
// pra quem é a conversa. As opções também são links wa.me, então o código de
// origem (main.js), o GA4 e o Clarity seguem funcionando no clique final.
(() => {
  const SETORES = [
    { id: 'suporte', titulo: 'Suporte', detalhe: 'App, jogo, live ou acesso', texto: '[Suporte] Oi! Preciso de ajuda com a Renda Play.' },
    { id: 'atendimento', titulo: 'Atendimento', detalhe: 'Dúvidas, planos e como funciona', texto: '[Atendimento] Oi! Quero tirar uma dúvida sobre a Renda Play.' },
    { id: 'financeiro', titulo: 'Financeiro', detalhe: 'Pagamento, cobrança e renovação', texto: '[Financeiro] Oi! Tenho uma dúvida sobre pagamento.' },
    { id: 'parcerias', titulo: 'Afiliados e parcerias', detalhe: 'Comissão, divulgação e parcerias', texto: '[Parcerias] Oi! Quero falar sobre afiliados ou parceria.' },
  ];
  const EMAIL = 'contato.rendaplay@gmail.com';

  const CSS = `
.zap-escolha{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(6,10,20,.62);font-family:inherit;animation:zap-fundo .18s ease-out}
.zap-escolha[hidden]{display:none}
.zap-caixa{width:100%;max-width:420px;max-height:calc(100dvh - 24px);overflow:auto;background:#fff;color:#111827;border-radius:20px 20px 0 0;padding:20px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -8px 32px rgba(0,0,0,.25);animation:zap-sobe .22s ease-out}
.zap-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
.zap-titulo{margin:0;font-size:18px;font-weight:700;line-height:1.3}
.zap-fechar{flex:none;width:36px;height:36px;border:0;border-radius:50%;background:#f1f3f6;color:#374151;font-size:22px;line-height:1;cursor:pointer}
.zap-sub{margin:0 0 14px;font-size:14px;color:#4b5563}
.zap-opcao{display:flex;align-items:center;gap:12px;margin-top:8px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:14px;color:inherit;text-decoration:none;transition:border-color .15s,background .15s}
.zap-opcao:hover,.zap-opcao:focus-visible{border-color:#01AC50;background:#effdf4;outline:none}
.zap-opcao b{display:block;font-size:15px}
.zap-opcao span{display:block;font-size:13px;color:#6b7280}
.zap-opcao::after{content:"›";margin-left:auto;font-size:22px;color:#01AC50}
.zap-email{margin:14px 0 0;font-size:13px;color:#4b5563;text-align:center}
.zap-email a{color:#01AC50;font-weight:600}
@media (min-width:600px){.zap-escolha{align-items:center}.zap-caixa{border-radius:20px;padding:22px 20px 20px}}
@keyframes zap-fundo{from{opacity:0}}
@keyframes zap-sobe{from{transform:translateY(24px);opacity:0}}`;

  let janela;
  let voltarFoco;

  function linkDoSetor(numero, setor) {
    return `${numero}?text=${encodeURIComponent(setor.texto)}`;
  }

  function montar() {
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    janela = document.createElement('div');
    janela.className = 'zap-escolha';
    janela.hidden = true;
    janela.innerHTML = `
      <div class="zap-caixa" role="dialog" aria-modal="true" aria-labelledby="zap-titulo">
        <div class="zap-topo">
          <p class="zap-titulo" id="zap-titulo">Com quem você quer falar?</p>
          <button type="button" class="zap-fechar" aria-label="Fechar">×</button>
        </div>
        <p class="zap-sub">Escolha o assunto e a mensagem já vai pronta no WhatsApp.</p>
        <div class="zap-opcoes"></div>
        <p class="zap-email">Reembolso é só por e-mail: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
      </div>`;
    janela.querySelector('.zap-fechar').addEventListener('click', fechar);
    janela.addEventListener('click', (e) => {
      if (e.target === janela) fechar();
      const opcao = e.target.closest('.zap-opcao');
      if (!opcao) return;
      if (window.gtag) gtag('event', 'zap_setor', { setor: opcao.dataset.setor });
      setTimeout(fechar, 0);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !janela.hidden) fechar();
    });
    document.body.appendChild(janela);
  }

  function abrir(link) {
    if (!janela) montar();
    const url = new URL(link.href);
    const numero = url.origin + url.pathname;
    janela.querySelector('.zap-opcoes').innerHTML = SETORES.map((s) => `
      <a class="zap-opcao" data-zap-setor data-setor="${s.id}" data-cta="zap_${s.id}"
         href="${linkDoSetor(numero, s)}" target="_blank" rel="noopener">
        <div><b>${s.titulo}</b><span>${s.detalhe}</span></div>
      </a>`).join('');
    voltarFoco = document.activeElement;
    janela.hidden = false;
    janela.querySelector('.zap-opcao').focus({ focusVisible: false });
  }

  function fechar() {
    janela.hidden = true;
    if (voltarFoco && voltarFoco.focus) voltarFoco.focus();
  }

  // Na janela, em captura: roda antes dos ouvintes do documento, que olham o defaultPrevented.
  window.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!link || link.hasAttribute('data-zap-setor')) return;
    e.preventDefault();
    try {
      abrir(link);
    } catch (err) {
      window.open(link.href, '_blank', 'noopener');
    }
  }, true);
})();
