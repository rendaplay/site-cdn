# Artes da Batalha (Gemini)

A Batalha já funciona sem nenhuma imagem: desenha o cenário e transforma a foto de cada lado
num adesivo. As artes abaixo trocam isso por caricaturas e por um cenário ilustrado. Gere uma
imagem por vez no Gemini, colando o prompt inteiro.

## 1. Caricatura de cada lado (1200×1600, uma por lado)

Anexe uma foto de rosto da pessoa e cole:

> Crie uma caricatura em estilo cartoon de livro ilustrado, traço limpo com contorno preto
> fino, cores chapadas e vivas com sombreado suave, da pessoa da foto anexada. Enquadramento de
> meio corpo (da cintura para cima), de frente, sorrindo, olhando para a câmera, braços
> relaxados. Cabeça levemente maior que o normal, rosto bem reconhecível e simpático, sem
> exagero ofensivo. Roupa: terno escuro com camisa branca e gravata [vermelha | verde]. Fundo
> totalmente transparente (PNG). Se não puder transparente, fundo branco liso, sem sombra no
> chão, sem texto, sem moldura e sem logotipo. Formato vertical 3:4, 1200×1600 pixels, a figura
> ocupando a imagem inteira de cima a baixo, com a cabeça no terço de cima.

Troque a cor da gravata pela cor do lado. Gere as duas na mesma conversa, pedindo "mesmo estilo
da anterior" na segunda, pra combinarem.

Se vier com fundo branco, tire o fundo antes de usar (remove.bg ou o "Remover fundo" do Canva):
a arte precisa de transparência pra ganhar o contorno de adesivo na cor do lado.

## 2. Cenário do Congresso (1080×1920)

> Ilustração em estilo cartoon de livro ilustrado, traço limpo e cores claras e alegres, da
> Esplanada dos Ministérios em Brasília vista de frente, com o Congresso Nacional no centro: as
> duas torres altas lado a lado, a cúpula côncava (virada para cima) à esquerda e a cúpula
> convexa (virada para baixo) à direita, sobre a plataforma branca, com o espelho d'água na
> frente. Céu azul com degradê e nuvens brancas fofas, mastros com bandeiras do Brasil dos dois
> lados, gramado verde em perspectiva na metade de baixo. Sem pessoas, sem texto, sem logotipo.
> Formato vertical 9:16, 1080×1920 pixels. Horizonte na metade da altura; a metade de cima
> mais limpa (vai ter placar por cima), a metade de baixo só gramado.

## Onde salvar e como ligar

Salve em `jogos_web/batalha/presets/arte/` (crie a pasta) com estes nomes:

| Arquivo | O que é |
|---|---|
| `presets/arte/lula.png` | caricatura do lado vermelho |
| `presets/arte/flavio.png` | caricatura do lado verde |
| `presets/arte/congresso.jpg` | cenário |

No `preset.js`, no preset `lula-flavio`, tire o `/* */` das três linhas que já estão lá:

```js
cenario: "presets/arte/congresso.jpg",
...
arte: "presets/arte/lula.png",
...
arte: "presets/arte/flavio.png",
```

Se algum arquivo faltar ou o nome estiver errado, o jogo volta sozinho pro desenho e pro
adesivo com a foto, sem quebrar. A placa pequena com a foto no topo da torre continua usando
`foto`.

Nos outros presets é igual: `cenario` no preset e `arte` em cada lado. Sem `cenario`, o fundo
desenhado é a arena (ou o Congresso com `desenho: "congresso"`).

Na tela não aparece nome de ninguém, só "Vermelho" e "Verde". Não ponha nome escrito na arte.
