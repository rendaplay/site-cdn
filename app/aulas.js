'use strict';

// Curso de boas-vindas do cliente que já comprou. É o mesmo no launcher e no app
// do celular (celular/montar.py copia este arquivo). Cada tela desenha do seu
// jeito; aqui ficam só as aulas, o progresso e o vídeo.
//
// video: arquivo em ENDERECO_VIDEOS (a capa é o mesmo nome em .jpg) ou link do
//   YouTube, Vimeo ou Panda. Sem vídeo, a aula é só leitura.
// video e texto aceitam { pc, celular } quando cada plataforma tem o seu.
// so: 'pc' ou 'celular' quando a aula só faz sentido numa das duas.
// id: nunca trocar depois de publicado, é o que marca a aula como vista.

// Tag fixa no rendaplay/site-cdn: vídeo novo ou trocado vai numa tag nova (aulas-2...).
const ENDERECO_VIDEOS ='https://cdn.jsdelivr.net/gh/rendaplay/site-cdn@aulas-1/aulas/';

// Duração de cada arquivo e se ele é em pé (os do celular são 9:16).
const ARQUIVOS_DAS_AULAS = {
  'expectativa.mp4': { duracao: '1:32' },
  'expectativa-celular.mp4': { duracao: '1:32', emPe: true },
  'tour-launcher.mp4': { duracao: '2:38' },
  'liberar-live-pc.mp4': { duracao: '1:55' },
  'configurar-presentes-pc.mp4': { duracao: '1:46' },
  'abrir-live-pc.mp4': { duracao: '3:40' },
  'central.mp4': { duracao: '2:22' },
  'abrir-live.mp4': { duracao: '1:41', emPe: true },
  'configurar-alcance.mp4': { duracao: '3:35' },
  'configurar-alcance-celular.mp4': { duracao: '1:09', emPe: true },
  'evitar.mp4': { duracao: '1:30' },
  'evitar-celular.mp4': { duracao: '1:15', emPe: true },
  'restricao-caiu.mp4': { duracao: '0:59' },
  'restricao-caiu-celular.mp4': { duracao: '0:57', emPe: true },
};

const CURSO = [
  {
    id: 'boas-vindas',
    titulo: 'Boas-vindas',
    aulas: [
      {
        id: 'expectativa',
        titulo: 'Bem-vindo: o que esperar de verdade',
        video: { pc: 'expectativa.mp4', celular: 'expectativa-celular.mp4' },
        texto: `<ul>
<li>A Renda Play serve pra você <b>ganhar seguidores</b>, <b>engajamento</b> e <b>dinheiro</b> com live.</li>
<li>É fácil, mas <b>não é da noite pro dia</b>. Quem faz live com frequência é quem vê o resultado crescer.</li>
<li><b>Não deixe a live rodando sozinha</b> por horas (enquanto dorme, por exemplo). O TikTok percebe e corta.</li>
<li>Assista as próximas aulas em ordem: são curtas e mostram tudo na tela.</li>
</ul>`,
      },
      {
        id: 'tour-launcher',
        so: 'pc',
        titulo: 'Tour pelo launcher',
        video: 'tour-launcher.mp4',
        texto: `<ul>
<li><b>Central da Live</b>: controle dos jogos do Roblox.</li>
<li><b>Como transmitir</b>: o passo a passo, os problemas comuns e o guia de restrições.</li>
<li>Gerador de <b>título e bio</b> pra sua live.</li>
<li><b>Meu desempenho</b>: moedas e horas de live.</li>
<li><b>Afiliados</b>: divulgue seu link e ganhe por venda, pela Kiwify.</li>
<li><b>Ajustes</b>: voz, efeitos e música. Deixe <b>Manter a live ativa</b> sempre ligado.</li>
</ul>`,
      },
      {
        id: 'dinheiro',
        titulo: 'Como o dinheiro chega: presente vira diamante, diamante vira saque',
        texto: `<ol>
<li>O espectador compra <b>moedas</b> no TikTok e manda um <b>presente</b> na sua live.</li>
<li>O presente vira <b>diamantes</b> na sua conta.</li>
<li>Você saca os diamantes pelo TikTok, em <b>Recompensas da LIVE</b>.</li>
</ol>
<p>Quem paga é o TikTok, não a Renda Play. O valor que vale é o que aparece no seu painel do TikTok.</p>`,
      },
    ],
  },
  {
    id: 'primeira-live',
    titulo: 'Primeira live',
    aulas: [
      {
        id: 'liberar-live-pc',
        so: 'pc',
        titulo: 'Liberar a live no computador',
        video: 'liberar-live-pc.mp4',
        texto: `<ol>
<li>Sua conta precisa de pelo menos <b>50 seguidores</b>.</li>
<li>Faça <b>2 lives de 25 minutos</b> pelo celular. Pode ser tela preta.</li>
<li>Entre no <b>TikTok LIVE Studio</b> no computador e peça o <b>acesso de 14 dias</b>.</li>
<li>Nesses 14 dias, não tome <b>banimento</b>. Restrição é normal e não conta.</li>
<li>Passou os 14 dias, a live no computador fica liberada de vez.</li>
</ol>`,
      },
      {
        id: 'configurar-presentes-pc',
        so: 'pc',
        titulo: 'Escolher o jogo, configurar e testar',
        video: 'configurar-presentes-pc.mp4',
        texto: `<ol>
<li>Confira seu <b>@ do TikTok</b> no canto de cima.</li>
<li>Clique na capa do jogo. Pros jogos do Roblox, o <b>Roblox</b> precisa estar instalado.</li>
<li>Em <b>Configurar</b>, escolha o que cada presente faz e o <b>idioma</b>. Dica: nos jogos do Roblox, em inglês vem mais gente.</li>
<li>Clique em <b>Testar sem live</b> pra ver o jogo com espectadores de mentira.</li>
<li>Pra trocar de jogo, é só clicar em outra capa. Não precisa fechar nada.</li>
</ol>`,
      },
      {
        id: 'abrir-live-pc',
        so: 'pc',
        titulo: 'Abrir a live no TikTok LIVE Studio',
        video: 'abrir-live-pc.mp4',
        texto: `<ol>
<li>No LIVE Studio, clique em <b>Adicionar origem</b>.</li>
<li>Jogo do <b>Roblox</b>: escolha <b>Captura de jogo</b> e selecione o Roblox.<br>Jogo do launcher (Urna, Pipa, Racha...): escolha <b>Captura de janela</b> e selecione a janela do jogo.</li>
<li>Estique a imagem até encher a tela em pé.</li>
<li>Nas configurações da live: categoria <b>Roblox</b> (mesmo em outro jogo), um título chamando pra comentar e <b>tudo desativado</b>, principalmente a <b>Verificação de conformidade local</b>.</li>
<li>Entre ao vivo no LIVE Studio e depois clique em <b>Iniciar live</b> aqui no launcher.</li>
</ol>`,
      },
      {
        id: 'central',
        so: 'pc',
        titulo: 'Central da Live: trocar de jogo e testar presentes',
        video: 'central.mp4',
        texto: `<ul>
<li>Fica no menu da esquerda e serve pros jogos do <b>Roblox</b>.</li>
<li><b>Modo de jogo</b>: troca o jogo sem fechar o Roblox.</li>
<li>Teste qualquer presente e veja o efeito na hora.</li>
<li>Escolha quantas moedas valem cada efeito.</li>
<li>Cada jogo tem os próprios botões, como <b>Limpar praça</b> no jogo do carro.</li>
</ul>`,
      },
      {
        id: 'abrir-live',
        so: 'celular',
        titulo: 'Abrir a live pelo celular',
        video: 'abrir-live.mp4',
        texto: `<ol>
<li>Aqui no app, escolha o jogo.</li>
<li>No TikTok, toque em <b>+</b>, depois em <b>LIVE</b> e escolha <b>Jogos para celular</b> (não a câmera).</li>
<li>Escreva o título e, no jogo da live, escolha <b>Subway Surfers</b>: assim a live fica em pé.</li>
<li>Comece a live no TikTok e volte pra Renda Play.</li>
<li>Toque em <b>Iniciar live</b>, marque a caixinha, aceite e toque em <b>Abrir o jogo</b>. Pronto: o chat já mexe no jogo.</li>
</ol>`,
      },
      {
        id: 'escolher-jogo',
        so: 'celular',
        titulo: 'Escolher o jogo',
        texto: `<p>Cada jogo tem um jeito de o chat participar: comentário, curtida ou presente. Pra começar, escolha um em que basta comentar pra entrar, porque assim todo mundo participa, até quem não doa.</p>
<p>Você pode trocar de jogo quando quiser. Teste alguns e veja qual o seu público curte mais.</p>`,
      },
      {
        id: 'configurar-presentes',
        so: 'celular',
        titulo: 'Configurar os presentes (⚙)',
        texto: `<p>Com o jogo aberto, mexa na tela pra aparecer a <b>⚙</b> no canto. Ali você escolhe o que cada presente faz no jogo e testa na hora.</p>
<p>A engrenagem some sozinha em 4 segundos e não aparece pra quem assiste a live.</p>`,
      },
      {
        id: 'checklist',
        titulo: 'Checklist antes de entrar',
        texto: `<ul>
<li>Fez um <b>Testar sem live</b> pra ver jogo, som e conexão?</li>
<li>O @ do TikTok está certo?</li>
<li>Bateria carregada (ou na tomada) e internet boa?</li>
<li>Outros apps fechados?</li>
<li>Já sabe a primeira frase que vai falar pro chat?</li>
</ul>`,
      },
    ],
  },
  {
    id: 'espectadores',
    titulo: 'Como conseguir espectadores',
    aulas: [
      {
        id: 'configurar-alcance',
        titulo: 'Título, metas e textos que trazem gente',
        video: { pc: 'configurar-alcance.mp4', celular: 'configurar-alcance-celular.mp4' },
        texto: {
          pc: `<ol>
<li>Categoria <b>Roblox</b>, mesmo em outro jogo: é o jogo mais buscado.</li>
<li>Título chamativo, explicando o jogo. Na <b>bio</b>, diga como participar.</li>
<li>Deixe <b>tudo desativado</b> nas opções do LIVE Studio, principalmente a <b>Verificação de conformidade local</b>.</li>
<li>Ponha os presentes em <b>Desejos dos espectadores</b> em vez de escrever na tela.</li>
<li>Mande <b>"Go 10K Likes"</b> no chat e <b>fixe</b> o comentário: o pessoal curte pra bater a meta.</li>
<li>Escreva chamadas curtas na tela: siga, curta, mande presente pra jogar. Sem cobrir o jogo.</li>
</ol>`,
          celular: `<ol>
<li>Título chamativo, explicando o jogo: é por ele que te acham.</li>
<li>Curtida e comentário fazem a live crescer.</li>
<li>Mande <b>"Go 10K Likes"</b> no chat e <b>fixe</b> o comentário: o pessoal curte pra bater a meta.</li>
<li>Escreva chamadas curtas na tela: siga, curta, mande presente pra jogar. Sem cobrir o jogo.</li>
</ol>`,
        },
      },
      {
        id: 'horario',
        titulo: 'Horário e frequência',
        texto: `<p>Escolha um horário e repita. Quem volta todo dia no mesmo horário cria público que te espera. À noite e no fim de semana costuma ter mais gente on-line.</p>
<p>Live curta todo dia rende mais que uma live enorme de vez em quando.</p>`,
      },
      {
        id: 'aparecer-falar',
        titulo: 'Preciso aparecer ou falar?',
        texto: `<p><b>Não precisa mostrar o rosto.</b> Mas live parada, sem ninguém falando, parece automática: o TikTok mostra menos e pode até limitar.</p>
<p>Sua voz já resolve. Narre o jogo, comemore os presentes e chame quem entrou pelo nome.</p>`,
      },
      {
        id: 'o-que-falar',
        titulo: 'O que falar na live e como puxar comentário',
        texto: `<ul>
<li>Explique como entrar: "comenta aí pra entrar no jogo!"</li>
<li>Chame pelo nome quem acabou de entrar e quem mandou presente.</li>
<li>Crie disputa: "quem vai ser o campeão dessa rodada?"</li>
<li>Varie a frase. A mesma frase repetida o tempo todo parece robô.</li>
<li>Não peça presente toda hora. Chame pra brincadeira, o presente vem junto.</li>
</ul>`,
      },
      {
        id: 'videos-curtos',
        titulo: 'Vídeos curtos levando pra live',
        texto: `<p>Grave os melhores momentos da live (um presente grande, uma virada, um campeão) e poste como vídeo curto. É o vídeo que leva gente nova pra sua próxima live.</p>
<p>Avise no vídeo o horário em que você costuma entrar ao vivo.</p>`,
      },
    ],
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    aulas: [
      {
        id: 'evitar',
        titulo: 'Como evitar restrição',
        video: { pc: 'evitar.mp4', celular: 'evitar-celular.mp4' },
        guia: true,
        texto: `<ol>
<li>Leia o <b>Guia de restrições</b> inteiro (botão aqui embaixo).</li>
<li>Painel de presentes na tela: mostre por uns <b>10 a 15 minutos</b> e tire.</li>
<li><b>Não passe de 1 hora</b>. Com uns 50 minutos, feche e abra outra live.</li>
<li>Evite: live sem ninguém falando, pedir presente sem parar, app de curtida ou seguidor e música com direito autoral.</li>
</ol>`,
      },
      {
        id: 'restricao-caiu',
        titulo: 'Tomei restrição: e agora?',
        video: { pc: 'restricao-caiu.mp4', celular: 'restricao-caiu-celular.mp4' },
        texto: `<ol>
<li><b>Feche a live na hora.</b> Insistir só piora.</li>
<li>Espere <b>10 minutos</b>.</li>
<li>Abra uma live nova.</li>
<li>Ficou com dúvida? Chame o suporte no WhatsApp ou no Instagram <b>@rendaplaygg</b>.</li>
</ol>`,
      },
      {
        id: 'restricao',
        titulo: 'Guia de restrição completo',
        guia: true,
        texto: `<p>O TikTok limita ou encerra live que parece automática ou que força presente. Se levar restrição, leia o motivo que o TikTok mostra e corrija antes da próxima live.</p>
<p>O guia completo explica cada caso e como evitar.</p>`,
      },
    ],
  },
  {
    id: 'duvidas',
    titulo: 'Dúvidas e problemas comuns',
    extra: true,
    aulas: [
      {
        id: 'live-caiu',
        so: 'celular',
        titulo: 'Live caiu ou celular fraco (modo leve)',
        texto: `<p>Se o jogo ou a live do TikTok fecha quando você troca de app, é o celular sem memória. Ligue o <b>Modo leve</b> na tela inicial e feche os outros apps antes da live.</p>
<p>Fechou mesmo assim? Abra a Renda Play de novo: ela volta direto pro jogo.</p>`,
      },
      {
        id: 'nao-responde',
        titulo: 'O jogo não responde ao chat',
        texto: `<p>Confira se aparece <b>conectado</b>. A live precisa estar no ar no mesmo @ que está aqui. Espere até 1 minuto depois de entrar ao vivo, que a conexão tenta de novo sozinha.</p>
<p>Nos jogos do Roblox, só entra quem comenta o próprio nick do Roblox.</p>`,
      },
      {
        id: 'iphone',
        so: 'celular',
        titulo: 'iPhone',
        texto: `<p>Adicione a Renda Play à tela de início pelo Safari e abra pelo ícone. Trave a rotação na Central de Controle antes de entrar ao vivo, senão o jogo gira junto com o celular.</p>`,
      },
      {
        id: 'renovacao',
        titulo: 'Renovação depois de 30 dias',
        texto: `<p>O passe dura 30 dias e não renova sozinho. Quando estiver perto de vencer, a renovação aparece aqui mesmo. Ficou sem acesso? Fale com o suporte.</p>`,
      },
    ],
  },
];

function daPlataforma(valor, plataforma) {
  return valor && typeof valor === 'object' ? valor[plataforma] : valor;
}

/** A aula como a plataforma vê: o vídeo, a capa e o texto dela já resolvidos. */
function aulaNaPlataforma(aula, modulo, plataforma) {
  const arquivo = daPlataforma(aula.video, plataforma) || '';
  const interno = arquivo && !/^https?:/.test(arquivo);
  const info = ARQUIVOS_DAS_AULAS[arquivo] || {};
  return {
    ...aula,
    modulo,
    video: interno ? ENDERECO_VIDEOS + arquivo : arquivo,
    capa: interno ? ENDERECO_VIDEOS + arquivo.replace(/\.\w+$/, '.jpg') : '',
    duracao: info.duracao || '',
    emPe: !!info.emPe,
    texto: daPlataforma(aula.texto, plataforma),
  };
}

/** As aulas desta plataforma ('pc' ou 'celular'), na ordem, com o módulo de cada uma. */
function aulasDaPlataforma(plataforma) {
  return modulosDaPlataforma(plataforma).flatMap((modulo) => modulo.aulas);
}

/** A aula depois desta, ou null na última. O módulo extra tem sequência própria:
    terminar o curso principal não empurra a pessoa pras dúvidas. */
function aulaSeguinte(plataforma, id) {
  const aulas = aulasDaPlataforma(plataforma);
  const atual = aulas.find((aula) => aula.id === id);
  const fila = aulas.filter((aula) => !!aula.modulo.extra === !!atual?.modulo.extra);
  return fila[fila.indexOf(atual) + 1] || null;
}

/** "A seguir: ..." embaixo do botão de concluir. */
function textoDaSeguinte(seguinte) {
  if (seguinte) return `A seguir: ${seguinte.titulo}${seguinte.video ? ` · ${seguinte.duracao}` : ''}`;
  return 'Esta é a última aula do curso.';
}

function modulosDaPlataforma(plataforma) {
  return CURSO
    .map((modulo) => {
      const aulas = modulo.aulas.filter((aula) => !aula.so || aula.so === plataforma);
      const novo = { ...modulo };
      novo.aulas = aulas.map((aula) => aulaNaPlataforma(aula, novo, plataforma));
      return novo;
    })
    .filter((modulo) => modulo.aulas.length);
}

/** "▶ 1:32" pra aula com vídeo, "Leitura · 1 min" pra aula só de texto. */
function rotuloDaAula(aula) {
  return aula.video ? `▶ ${aula.duracao || 'Vídeo'}` : 'Leitura · 1 min';
}

/** Quantos vídeos e minutos o curso tem, pra mostrar o tamanho dele de cara. */
function resumoDoCurso(plataforma) {
  const videos = aulasDaPlataforma(plataforma).filter((aula) => aula.video);
  const segundos = videos.reduce((soma, aula) => {
    const [min, seg] = (aula.duracao || '0:00').split(':').map(Number);
    return soma + min * 60 + seg;
  }, 0);
  return { videos: videos.length, minutos: Math.max(1, Math.round(segundos / 60)) };
}

const aulasVistas = {
  CHAVE: 'rendaplay.aulas.vistas',
  ler() {
    try { return new Set(JSON.parse(localStorage.getItem(this.CHAVE)) || []); } catch { return new Set(); }
  },
  marcar(id) {
    const vistas = this.ler();
    vistas.add(id);
    try { localStorage.setItem(this.CHAVE, JSON.stringify([...vistas])); } catch { /* aba anônima */ }
  },
};

// Aula que o app sugere por causa de algo que aconteceu (terminou o 1º teste,
// a 1ª live...). Vale até ser vista.
const aulaSugerida = {
  CHAVE: 'rendaplay.aulas.sugerida',
  ler() {
    try { return localStorage.getItem(this.CHAVE); } catch { return null; }
  },
  gravar(id, motivo) {
    try { localStorage.setItem(this.CHAVE, JSON.stringify({ id, motivo })); } catch { /* aba anônima */ }
  },
  /** Só sugere uma vez por motivo, pra não insistir na mesma coisa. */
  sugerirUmaVez(id, motivo) {
    const chave = `rendaplay.aulas.motivo.${motivo}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch { return; }
    if (!aulasVistas.ler().has(id)) this.gravar(id, motivo);
  },
};

const MOTIVOS_SUGESTAO = {
  primeiro_teste: 'Testou o jogo? Agora veja como abrir a live de verdade.',
  primeira_live: 'Sua primeira live foi! O próximo passo é trazer mais gente.',
};

/** O que o cartão do curso mostra: a aula sugerida, a próxima não vista, ou nada (curso visto). */
function proximoPassoDoCurso(plataforma) {
  const aulas = aulasDaPlataforma(plataforma);
  const principais = aulas.filter((aula) => !aula.modulo.extra);
  const vistas = aulasVistas.ler();
  const vistasPrincipais = principais.filter((aula) => vistas.has(aula.id)).length;
  let sugerida = null;
  try { sugerida = JSON.parse(aulaSugerida.ler()); } catch { /* lixo antigo */ }
  const aulaDaSugestao = sugerida && aulas.find((aula) => aula.id === sugerida.id && !vistas.has(aula.id));
  const proxima = aulaDaSugestao || principais.find((aula) => !vistas.has(aula.id)) || null;
  return {
    aula: proxima,
    motivo: aulaDaSugestao ? MOTIVOS_SUGESTAO[sugerida.motivo] || '' : '',
    vistas: vistasPrincipais,
    total: principais.length,
    comecou: vistas.size > 0,
  };
}

/** Link colado pelo dono vira o endereço do player: { tipo: 'iframe' | 'video', src }. */
function videoDaAula(link) {
  link = (link || '').trim();
  if (!link) return null;
  const youtube = link.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (youtube) {
    return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0&modestbranding=1&playsinline=1` };
  }
  const vimeo = link.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (vimeo) {
    const hash = vimeo[2] ? `?h=${vimeo[2]}&` : '?';
    return { tipo: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}${hash}dnt=1&title=0&byline=0&portrait=0` };
  }
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(link)) return { tipo: 'video', src: link };
  // Panda Video e afins: o link de incorporar já é o do player.
  return { tipo: 'iframe', src: link };
}

// Segundo em que cada vídeo parou, pra quem sai no meio voltar dali.
const pontoDasAulas = {
  CHAVE: 'rendaplay.aulas.ponto',
  ler() {
    try { return JSON.parse(localStorage.getItem(this.CHAVE)) || {}; } catch { return {}; }
  },
  gravar(id, segundo) {
    const pontos = this.ler();
    if (segundo) pontos[id] = segundo; else delete pontos[id];
    try { localStorage.setItem(this.CHAVE, JSON.stringify(pontos)); } catch { /* aba anônima */ }
  },
};

/* O controle nativo é pequeno demais pra quem não está acostumado: o vídeo
   ganha um play grande por cima até começar a tocar. aoTerminar roda uma vez,
   quando falta pouco pro fim (muita gente fecha nos últimos segundos). */
function montarVideo(aula, src, aoTerminar) {
  const player = document.createElement('video');
  Object.assign(player, { src, controls: true, playsInline: true, preload: 'metadata' });
  if (aula.capa) player.poster = aula.capa;

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'aula-play';
  play.innerHTML = `<i aria-hidden="true"></i><span>Assistir${aula.duracao ? ` · ${aula.duracao}` : ''}</span>`;
  play.addEventListener('click', () => player.play());
  player.addEventListener('play', () => play.remove(), { once: true });

  let terminou = false;
  let gravado = 0;
  player.addEventListener('loadedmetadata', () => {
    const ponto = pontoDasAulas.ler()[aula.id];
    if (ponto > 5 && ponto < player.duration - 10) player.currentTime = ponto;
  }, { once: true });
  player.addEventListener('timeupdate', () => {
    const agora = Math.floor(player.currentTime);
    if (Math.abs(agora - gravado) >= 5) pontoDasAulas.gravar(aula.id, (gravado = agora));
    if (!terminou && player.duration && player.currentTime >= player.duration - 3) {
      terminou = true;
      pontoDasAulas.gravar(aula.id, 0);
      aoTerminar?.();
    }
  });
  return [player, play];
}

/** O que vai dentro do player (vazio na aula só de leitura). */
function montarPlayer(aula, aoTerminar) {
  const video = videoDaAula(aula.video);
  if (!video) return [];
  if (video.tipo === 'video') return montarVideo(aula, video.src, aoTerminar);
  const quadro = document.createElement('iframe');
  quadro.src = video.src;
  quadro.title = aula.titulo;
  quadro.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  quadro.allowFullscreen = true;
  // O YouTube recusa tocar (erro 153) sem saber de onde vem o pedido.
  quadro.referrerPolicy = 'strict-origin-when-cross-origin';
  return [quadro];
}
