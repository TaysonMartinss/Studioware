---
name: novo-video
description: Cria um vídeo vertical (Shorts/Reels/TikTok) de games e hardware (rankings de compra, curiosidades, vídeos explicativos ou edição de clipes gravados) do roteiro ao MP4 final. Usar quando o utilizador pedir "faz um vídeo sobre X", "novo vídeo", "/novo-video <tema>", um lote de vídeos, ou um estilo de edição (papel/stop motion, kinetic Hormozi, explicativo Kurzgesagt, flat corporativo, retro VHS, HUD sci-fi, 3Blue1Brown/Manim).
---

# Novo vídeo vertical

Pipeline: tema → pesquisa → roteiro JSON → `npm run video` (mídia real + Manim + cortes/legendas de clipes + narração + render Remotion) → `out/<id>.mp4`.
Tipos em `src/types.ts`, estilos em `src/estilos.json`. Só renderizar quando o utilizador pedir.

## 1. Escolher formato e estilo
- `formato`: `quiz` (perguntas para o espectador jogar: cada pergunta é uma cena `quiz` com contagem real seguida da cena da resposta; ver `## formato: quiz` em `formatos-externo.md`), `livre` (sem molde: o pedido do criador descreve o vídeo e você escolhe a estrutura e os tipos de cena; ver `## formato: livre` em `formatos-externo.md`), `ese` (viral "E se?": hipótese levada ao extremo com ciência, sem venda; ver secção 3.5 do roteirista), `storytelling` (história que leva à compra de UM produto), `ranking` (produtos com preço), `curiosidades` (factos com mídia real), `explicativo` (gráficos, linha do tempo, Manim), `clipe` (vídeos gravados pelo utilizador), `longo` (vídeo de 5 a 10 minutos para o YouTube em 16:9, com cenas `capitulo` e `cortes` para Shorts; ver secção 3.6 do roteirista).
- `estilo` (chave de `src/estilos.json`):
  - `neon`, `fogo`, `cyber`: gamer com glitch, shake e grelha neon
  - `hormozi`: kinetic typography (Montserrat Black, tracking negativo, fundo #0B0B0B), 2 palavras de cada vez com pop de 6 frames (0→118→96→100%). Só os `destaques` ganham cor (amarelo/verde a alternar; vermelho se a palavra for negativa) e algumas palavras fazem saltar um ícone ao lado (dinheiro, meta, crescer, tempo, jogo, PC, proteção, fogo…). Nos clipes, zoom de corte de 8% a cada frase.
  - `papel` (paper motion): tudo anda a 7,5 fps com tremor aos saltos (posição e rotação novas a cada foto) e "ferve": as letras e as bordas rasgadas mudam ligeiramente de forma a cada foto. Abre com uma folha amassada a desdobrar-se em menos de 1 s e o gancho em letras de "carta de resgate"; a legenda vai palavra a palavra, cada uma num pedaço de fita-crepe ou de papel rasgado; a cada 3 palavras entra um recorte novo nas laterais (o ícone da palavra dita, ou uma forma). Papel craft com textura, fotos em polaroid com borda rasgada. Sons: papel amassado nas transições, rasgo quando entra uma foto, canetão quando surgem as palavras do título, obturador a cada recorte novo. Para tirar partido, use falas com palavras concretas (dinheiro, tempo, internet, cidade…) e `midia` em quase todas as cenas.
  - `explicativo`: estilo Kurzgesagt, gradiente radial #161B26→#080A0F, paleta teal/laranja/amarelo/roxo nos gráficos, glow largo e suave, easing cubic-bezier(0.25, 1, 0.5, 1), painéis com sombra interna.
  - `corporativo`: SaaS flat em #F4F6F9, conteúdo a 70% da largura, textos que sobem de trás de uma máscara, transição em círculo e legendas em pílula azul que abrem no eixo X.
  - `vhs`: synthwave anos 80, grelha magenta a 80°, sol amarelo→magenta com faixas a engrossar, aberração RGB no ecrã inteiro, scanlines, faixa de tracking a subir e interface de gravador (PLAY, SP, REC).
  - `hud`: interface sci-fi ciano/laranja, anéis segmentados a velocidades diferentes (o externo aos impulsos), réguas de precisão, números a correr e periferia desfocada.
  - `matematica`: 3Blue1Brown, fundo #0C1017 com plano cartesiano subtil, serifa matemática, títulos escritos como a giz (write-on), curvas a ouro/menta e áreas em ciano translúcido; combina com cenas `manim` (o fundo do Manim segue o do estilo).
  - `estudio3d`: mundo 3D contínuo. O vídeo inteiro passa num corredor de estúdio escuro com chão espelhado; em cada troca de cena a câmara voa para a estação seguinte e atravessa um portal de luz, e as cenas 2D vêm do fundo e passam pela câmara ao sair. Cada estação tem um objeto metálico num pedestal (o hardware procedural quando a cena é um `produto` com `icone` gpu/cpu/ram/ssd) e a `midia` vira um ecrã suspenso com reflexo, em vez de fundo de ecrã inteiro. Com este estilo, inclui pelo menos uma cena `modelo3d` com o objeto central do tema e prefere `midia` de imagem nítida.
  - `clean`: review séria
  - `vox`: editorial "impresso, não iluminado" (vox-style-animation, MIT): papel creme com pontos de meio-tom, letra de tinta (Archivo Black), marcador amarelo que varre a palavra dita na legenda e a palavra-chave do gancho, risco vermelho nas palavras negativas, fotos em meio-tom com sombra dura e ligeiramente tortas, e uma folha de papel que varre o ecrã como único corte. Ponha a palavra-chave de cada frase em `destaques`.
  - `aquarela`: livro ilustrado a tinta e aquarela (receita do claude-animation-skill, MIT): papel de fibra, letra à mão (Kalam), manchas de aguada atrás das palavras, e as cenas `lowpoly` e as fotos pintadas com contorno de tinta que treme a 10 fps, cores lavadas e granulação.
- Não uses `cor`: sobrepõe a cor do estilo.

## 2. Pesquisar
Usa WebSearch para confirmar factos, datas, números e, em rankings, modelos e preços atuais no país do canal (por omissão Brasil, R$). Nunca inventes preços nem números. Em curiosidades, só factos com fonte.

## 3. Escrever o roteiro em `roteiros/<id>.json`

### 3a. Arco narrativo: início, meio e fim (obrigatório em todos os formatos)
O vídeo é uma história, não uma lista de cenas soltas. Antes de escrever as falas, define numa frase cada parte:
- **Início (gancho + apresentação do tema + promessa, ~15%)**: abre uma pergunta, uma tensão ou um conflito que o espectador quer ver resolvido; logo a seguir, a apresentação do tema. A promessa tem de ser cumprida no fim.
  - **Apresentação do tema** (logo a seguir ao gancho, nos primeiros 5 a 10 segundos; no vídeo longo, nos primeiros 30): uma ou duas frases que dizem com clareza **de que é o vídeo** e **o que a pessoa vai entender ou ver**, com o tema dito pelo nome. Ex.: gancho "Todo dia, bilhões de reais trocam de mão sem ninguém sair de casa." → apresentação "Isso é a bolsa de valores. [pausa] Em um minuto você vai entender o que é uma ação, quem compra e por que o preço sobe e desce." Pode ser o fim da fala do gancho ou a cena seguinte (com `texto_tela`/`titulo` que mostre o tema). Não substitui o gancho (nada de abrir com "Fala, galera" ou "Hoje vamos falar de…"): vem depois dele. Só então o vídeo desenvolve o assunto, pela ordem que a apresentação anunciou.
- **Meio (desenvolvimento, ~65%)**: cada cena faz a história avançar e a tensão subir. Cada fala termina a puxar a seguinte ("Mas tem um problema.", "E é aqui que fica interessante.", "Só que ninguém te conta isto."). Guarda o melhor para o fim do meio.
- **Fim (clímax + resolução + CTA, ~20%)**: a revelação ou o momento mais forte, depois a resposta à pergunta do início (de preferência com um *callback* a uma frase ou imagem do gancho) e só então o CTA, ligado à história.

Como o arco se aplica a cada formato:
- **storytelling**: personagem ou situação → problema que cresce → descoberta da solução → transformação → CTA (estrutura detalhada mais abaixo).
- **ranking**: o gancho promete "qual vale mesmo a pena"; o meio é uma contagem decrescente com tensão a subir (o #3 é bom *mas*…, o #2 resolve isso *mas*…); o #1 é o clímax e responde à promessa.
- **curiosidades**: um fio condutor liga os factos (o mesmo jogo, a mesma empresa, "coisas que ninguém reparou em…"); ordena do bom para o mais surpreendente; o último facto é o clímax e o fecho volta ao gancho.
- **explicativo**: pergunta no início → hipóteses e contexto no meio (gráficos, linha do tempo) → resposta clara no fim, numa frase que se lembra.
- **ese** ("E se?"): pergunta impossível no gancho → escalada no tempo ou na escala, cada passo mais surpreendente e apoiado num facto → clímax ou virada → volta à realidade e pergunta para comentar. Sem produtos, sem preços, sem link de compra.

### 3b. Escrita da narração: segue o `roteirista.md`
Antes de escrever qualquer `fala`, lê [roteirista.md](roteirista.md) (o system prompt do roteirista: PT-BR natural, técnicas de retenção, estrutura para 30–55 s, marcas de narração e revisão). Quando o pedido vem do painel, esse texto já vai como system prompt.
Resumo das marcas que podem ir na `fala` (não são lidas em voz alta): `[pausa]`, `[pausa longa]`, `[ênfase] palavra` e `[tom: surpresa|sério|animado|tenso]` no início da fala. `[pausa]` e `[pausa longa]` só logo a seguir a uma vírgula, ponto, `?`, `!`, dois pontos ou reticências, onde a frase já respira ("A rede caiu. [pausa] E agora?", "Na próxima tempestade, [pausa] o seu PC nem vai notar."). Nunca no meio de uma frase sem pontuação ("pega o celular [pausa] e nenhum…"): o trecho é narrado com entoação de fim e o silêncio parece que o vídeo travou; a narração ignora essas marcas. Qualquer outra indicação de produção vai nos campos do roteiro (`midia`, `modelo`, `musica`), nunca na fala.
Campos de publicação: `thumbnail` (texto de capa, 3 a 5 palavras) e `legenda_post` (legenda pronta com hashtags e créditos).

### 3c. Revisão antes de gravar o arquivo
Faz a revisão da secção 6 do `roteirista.md` e confirma também que cada cena tem a mídia certa e que os números da tela batem com a pesquisa.

### 3d. Campos do roteiro
- **Campos de qualidade (obrigatórios):** `pesquisa` [{fato, fonte, url}]; `duracao_alvo` (`curto`|`medio`|`longo`); `mercado` (`Brasil` ou `Portugal`); em cada `produto` com preço, `produto_ref` (chave de `dados/precos.json`); `precos_usados` com as outras chaves de preço citadas na fala.
- **Antes de terminar, valida:** `python scripts/validar_roteiro.py roteiros/<id>.json --corrigir` (preenche os preços da tela a partir do catálogo e lista erros e avisos). Corrige até não haver erros.
- `id` em kebab-case. Estrutura: 1 `gancho`, depois 3 a 6 cenas de conteúdo, depois 1 `cta`. Duração total 30–55 s: cada `fala` com 12–25 palavras, o gancho com 10–15.
- `destaques`: 4–8 palavras faladas que levam zoom punch e cor de destaque na legenda.
- **gancho**: `texto_tela` com 3–5 palavras em maiúsculas; `icone` e `midia` opcionais (a mídia vira o fundo).
- **produto**: `rank`, `categoria`, `nome` (até ~16 caracteres), `preco`, `selo`, `tags` (2–3, até ~14 caracteres), `specs` (até 3, valores 0–100), `icone` (gpu|cpu|ram|ssd|monitor|mouse|teclado|headset|fonte|gabinete|console|notebook|cadeira). Se tiver `midia` de imagem, ela substitui o ícone.
- **fato**: `numero`, `titulo` (até ~28 caracteres), `kicker` opcional (etiqueta acima do título; no "E se?" usa o passo do tempo, ex. "Depois de uma hora") e `midia` (quase sempre).
- **grafico**: `titulo`, `grafico` (`barras` ou `linha`), `dados` [{rotulo, valor}] com 3–6 itens, `unidade` e `destaque` (índice) opcionais.
- **linha_tempo**: `titulo`, `eventos` [{ano, texto (até ~26 caracteres), icone}] com 3–4 itens.
- **manim**: `titulo` opcional e `codigo` com uma classe `class Cena(Scene)` (o import e a cor de fundo são acrescentados automaticamente). O frame é vertical: 4.5 unidades de largura por 8 de altura, por isso mantém tudo dentro de x ±2 e usa a área toda. Usa `Text`/`MarkupText` (por exemplo `Text("y = x²")`), não `MathTex`/`Tex`, porque não há LaTeX instalado. A animação deve durar mais ou menos o mesmo que a `fala` (cerca de 2,7 palavras por segundo).
- **clipe**: `bruto` (caminho em public/, ex. `uploads/x.mp4`), `cortar` (padrão true), `titulo` opcional, `broll` opcional [{inicioMs, fimMs, midia}]. A `fala` fica vazia porque vem do Whisper.
- **cta**: `texto_tela` e `botao`.

- **numero**: `valor` (conta até ele), `prefixo`/`sufixo` (ex. "R$ ", "%", " mil"), `texto` curto, `icone`, `alerta: true` para tom de perigo. `midia` opcional (fundo).
- **comparacao**: `titulo` opcional, `esquerda`/`direita` {rotulo, itens (até 3, curtos), icone ou midia}, `vencedor` ("esquerda"|"direita"). Quem perde fica cinzento com ✕.
- **modelo3d**: objeto 3D em cena (React Three Fiber). `kicker` e `titulo` opcionais; `animacao`: `girar` (padrão), `explodir` (as peças afastam-se e mostram o interior; ótimo para "o que tem dentro de…"), `aproximar` (câmara a entrar devagar) ou `revelar` (entra a rodar). `modelo` {fonte: `sketchfab` (consulta = termo de pesquisa em inglês, ex. "RTX 4090", ou `uid:<id>`; `indice` para outro resultado), `url` (link direto para .glb) ou `arquivo` (caminho em public/), consulta, credito}. No Sketchfab só entram modelos com licença comercial (CC0, CC BY, CC BY-SA, Standard), até 40 MB, e o crédito é preenchido sozinho: lembra o utilizador de o pôr na descrição. Precisa de `SKETCHFAB_API_TOKEN`; sem token a cena usa o modelo procedural. Sem modelo, usa o `procedural` (`gpu`, `cpu`, `ram`, `ssd`). `etiquetas` [{texto curto, ancora: `topo`|`frente`|`lado`|`base`|`centro`, inicioS}] ficam presas ao modelo enquanto ele roda; no máximo 2–3. Usa-a para mostrar hardware em detalhe; combina bem a seguir a um `produto` ou num explicativo. Fontes de modelos: poly.pizza, kenney.nl e quaternius.com (CC0) ou Sketchfab (confirma a licença e põe o crédito).
- **produto** sem `rank` vira a revelação da solução: mostra `etiqueta` (padrão "A SOLUÇÃO").
- **cta** (sempre a última cena; a `fala` pede sempre a inscrição no canal, e o ecrã mostra sempre o botão "Inscreva-se" com o sino) `acao`: `seguir` (padrão), `link` (botão "🛒 LINK NA BIO" a pulsar; `midia` de imagem mostra o produto) ou `comentar` (`palavra` que a pessoa comenta para receber o link por DM; `botao` = texto da resposta).

### Ícones e linguagem visual (evitar o "cheiro de IA")
- **Nunca uses emojis.** Usa `icone` com um nome do Lucide em kebab-case (lucide.dev/icons): `zap`, `shield-check`, `plug-zap`, `gpu`, `cpu`, `memory-stick`, `hard-drive`, `monitor`, `mouse`, `keyboard`, `headphones`, `gamepad-2`, `trophy`, `flame`, `banknote`, `triangle-alert`, `clock`, `trending-up`, `lightbulb`… Em produtos, `icone` também aceita os atalhos gpu|cpu|ram|ssd|monitor|mouse|teclado|headset|fonte|gabinete|console|notebook|cadeira.
- Prefere sempre mídia real (foto do produto, screenshot do jogo) a ícones. Um ícone serve de apoio, não é a peça principal.
- Títulos curtos e concretos, sem clichês ("Você não vai acreditar…", "Isso mudou tudo"). Tags são benefícios em poucas palavras.
- Em `destaques` põe só 4–6 palavras que importam de verdade. Destacar tudo é destacar nada.
- Para criar ou mudar componentes visuais, segue `src/components/ui.tsx` (margem 72, etiqueta + título, escala tipográfica) e usa `useBrilho` para glow, que só existe nos estilos com `brilho: true`. Depois de mudar estilos, corre `node scripts/miniaturas.mjs` para atualizar as miniaturas do painel.

### Storytelling de venda (formato `storytelling`)
Um único produto. A pessoa tem de sentir o problema antes de ver a solução, e o produto só aparece depois da metade do vídeo. Estrutura base com 6 a 8 cenas (adapta ao tema):

**Início**
1. **gancho**: dor, medo ou curiosidade do público, ligada a algo que ele tem ("SEU PC PODE QUEIMAR HOJE"). Usa mídia de fundo. A fala abre a história ("Era uma noite de chuva. [pausa] A luz piscou uma vez…").

**Meio**
2. **história**: `fato` sem número, uma situação concreta e reconhecível (tempestade, queda de luz, a fonte que estourou), com mídia real. Conta como uma cena de filme, no presente ou no passado, com um personagem (você, um amigo, "um seguidor me mandou isto").
3. **agitação**: `numero` com `alerta: true`, com uma estatística ou custo real e com fonte (ex.: quanto custa trocar placa e fonte). `[pausa longa]` antes do número.
4. **o erro comum**: `comparacao` entre o que as pessoas usam e o que resolve (ex.: "régua comum" x "filtro de linha de verdade"), com `vencedor`. É a virada: "o problema não era azar, era isto".

**Fim**
5. **solução**: `produto` sem rank, `etiqueta` "A SOLUÇÃO", preço real, `tags` com benefícios (não specs técnicas), `specs` simples e foto via `midia` url ou steam.
6. **prova ou objeção**: `numero` sem alerta (ex.: "R$ 89 contra R$ 2.000 de prejuízo") ou um `fato`. Fecha a história com um *callback* ao gancho ("Na próxima tempestade, [pausa] o seu PC nem vai notar.").
7. **cta**: `acao` `link` ou `comentar`, com a `palavra` relacionada ao produto (ex.: "FILTRO").

Regras do storytelling:
- Benefícios antes de especificações. Fala com o espectador ("o seu PC") e usa frases curtas.
- Nada de estatísticas, depoimentos ou escassez inventados. Cada número tem de vir da pesquisa (indica a fonte no fim).
- Sem promessas absolutas ("nunca mais vai queimar"). Diz o que o produto realmente protege.
- Se o link for de afiliado ou publicidade, lembra o utilizador de sinalizar na legenda do post (#publi ou "link de afiliado").

### Mídia real (`midia`)
`{"fonte": ..., "consulta": ..., "tipo": "imagem"|"video", "indice": 0}`
- `steam`: screenshots e trailers oficiais. A consulta é o nome exato do jogo. Com `tipo: "video"` usa o trailer (só vídeo, sem logos iniciais); muda `indice` para variar o screenshot.
- `wikimedia`: fotos livres de consolas antigas, hardware, eventos e pessoas.
- `pixabay`: stock genérico com uso comercial (setup gamer, mãos no comando, cidades…), termo em inglês; precisa de `PIXABAY_API_KEY`. Escolhe sozinho a orientação do vídeo (vertical ou 16:9). Substitui o Pexels: os roteiros antigos com `pexels` passam a usar o Pixabay.
- `sketchfab`: **modelo 3D como mídia de qualquer cena** (gancho, fato, número, produto, lados da comparação…). A consulta é um termo em inglês ("rtx 4090", "ps5 controller", "retro arcade machine") ou `uid:XXXX`; só entram licenças comerciais e o crédito é preenchido sozinho. O modelo gira devagar no lugar da foto: em ecrã inteiro no gancho, no cartão do fato, no painel do produto. Precisa de `SKETCHFAB_API_TOKEN`.
- `procedural`: modelo 3D desenhado pelo estúdio, sem ficheiro (consulta `gpu`, `cpu`, `ram` ou `ssd`).
- `url`: link direto para uma imagem, um vídeo ou um modelo `.glb`, por exemplo a foto oficial de um produto no site do fabricante.
- `arquivo`: ficheiro que já está em `public/` (um `.glb` vira modelo 3D).
- Cena `modelo3d` ou mídia 3D? A cena `modelo3d` é o momento de destaque (explodir em peças, etiquetas presas ao objeto). A mídia 3D é para pôr um objeto a girar dentro de uma cena normal, com o título e a fala dela.
Se a mídia não for encontrada, a cena usa o visual gráfico, por isso nunca bloqueia.

## Cenas Manim
Antes de escrever o `codigo` de uma cena `manim`, leia `manim-guia.md` (Manim Community 0.22 com LaTeX via MiKTeX: `MathTex` para fórmulas, `Text` para texto com acentos). O validador recusa o que vai falhar e, se o render ainda falhar, o estúdio pede ao Claude uma correção do código e tenta de novo uma vez.

## Animação 3D low poly (cena `lowpoly` e formato `animado`)
Cenários também de `fundo_mar`, `pre_historia` (dinossauros animados), `corrida`, `sala_aula`, `sala_estar`, `hospital` e `nave`; visuais `mergulhador` e `medico`; ficção científica com `planeta_alien`, visuais `alienigena` e `robo`, e objetos `ovni` (abdução de vaca), `cristal` e `portal`. Pacote nuclear: `cogumelo` (clarão, onda de choque que derruba a cidade), `bomba`, `missil`, `bombardeiro`, `radiacao`, cidade `ruinas`, cenário `abrigo` e `segura: "geiger"`. Pacote F1: `corrida` com `variante` `chuva` | `boxes` | `podio` | `vazia` (homenagem), visuais `piloto`, `piloto_capacete` e `mecanico`, objeto `carro_f1` (`cor`/`cor2`, `variante: "andar"`) e `segura` `bandeira_xadrez` | `bandeira_brasil` | `champanhe`. Pacote bolsa de valores: cenário `bolsa` (`alta` | `queda`), objetos `velas`, `seta`, `touro`, `urso`, `empresa` (divide-se em ações), `moedas`, `dinheiro` (`chuva`) e `segura: "dinheiro"`. Cena `pincel` (2D desenhado à mão com p5.brush: ícones da Lucide com aguarela, texto manuscrito, setas, círculos, X, vistos, barras e linhas, em papel, caderno ou quadro de giz; para animação sem 3D). Pacote videogame: hardware `placa_mae`, `processador`, `placa_de_video`, `memoria_ram`, `ssd`, `cooler`, `fonte`, `console` (`montar` | `explodir`), `controle`, `tv`; software no cenário `estudio_jogos` com `codigo`, `motor_jogo`, `arte_3d`, `som`, `nivel`, `bug`. Pacote relojoaria: `relogio` (`explodir` | `traseira` | `quartzo`), `mecanismo`, `engrenagens`, `escape`, `mola_real`, `rubi`, `lingotes`, `fundicao`, `maquina_cnc`, `tanque_agua`, cenários `oficina_relojoaria` (visual `relojoeiro`) e `boutique_luxo`, `segura` `pinca` | `relogio`. Biblioteca de 3278 modelos prontos (CC0, Kenney): objeto `{"tipo": "modelo", "modelo": "pack/nome"}`, lista em `modelos-lowpoly.md`. Para ciência, espaço e matemática: cenários `espaco` (sistema solar, buraco negro, comparação de escala real), `planeta` (os 8 planetas, o Sol e a Lua), `laboratorio` e `estudio`; `objetos` animados (foguetão que descola, asteroide que cai e explode, vulcão em erupção, átomo, moléculas, ADN, célula, sólidos geométricos que se constroem, superfícies 3D com eixos, explosão/fogo/fumo) com `rotulo` (etiqueta 3D presa ao objeto). Campos em `esquema-roteiro.md`.

Motor próprio em `src/lowpoly` (Three.js): personagens de blocos facetados com 22 ações e 7 expressões, 5 cenários (estádio com público e VAR, cidade com trânsito, quarto gamer, natureza com 3 biomas, planeta Terra/Marte/Lua), 3 horas do dia, câmara que se enquadra sozinha (vertical ou 16:9) e se move. Serve para encenar qualquer situação: um lance de futebol, alguém a atravessar a rua, um gamer ao PC, um cientista na floresta, a Terra vista do espaço. Campos em `esquema-roteiro.md`. Para estádios e futebol (canal O VAR Analisa) use `arbitro` com `cartao`, `apitar` ou `var`, `jogador` com `chutar`, `cair`, `celebrar`.

## Depois do render (automático)
- **Volume**: o áudio final é masterizado para **-14 LUFS** e pico até -1 dBTP (o padrão de YouTube, TikTok e Reels), com o ffmpeg do Remotion: `node scripts/masterizar.mjs out/<id>.mp4`.
- **Sons de clímax**: cada `[pausa longa]` que prepara uma revelação deixa um silêncio na narração; os 3 maiores (6 no vídeo longo) ganham um riser que acaba exatamente na palavra seguinte, um impacto e um zoom; o maior ganha também um chime. Por isso, guarde a `[pausa longa]` para as 2 ou 3 revelações que importam.
- **Revisão visual**: `python scripts/folha_contacto.py <id>` tira frames de cada cena para `out/revisao/<id>-N.jpg` e o Claude revê-os com a lista de `revisao-visual.md` (texto cortado ou ilegível, sobreposições, foco, frame 0, margens). O resultado aparece no editor, no bloco **Revisão visual**, com link para cada cena com problema.

## Capa (thumbnail)
No editor do roteiro, bloco **Capa**: gera 3 variantes a partir da mídia do próprio vídeo (impacto = foto em ecrã inteiro; dividido = foto com corte em diagonal e bloco de texto; objeto = o modelo 3D ou a foto em destaque) com o texto do campo `thumbnail` (2 a 5 palavras, uma em destaque na cor do estilo). 9:16 para Shorts/Reels/TikTok, 16:9 em 1280×720 para o YouTube. Pela linha de comandos: `node scripts/capa.mjs <id> [--texto ...] [--destaque ...] [--fundo N] [--formato vertical|horizontal]` → `out/capas/<id>-<layout>.jpg`; a escolhida fica em `out/<id>.capa.jpg`. Escreva o `thumbnail` a pensar na capa: curto, concreto, sem repetir o título.

## Música de fundo
`musica` no roteiro: `auto` (padrão, escolhe pelo estilo e formato), `nenhuma`, um clima (`energetica`, `tensa`, `ambiente`, `synthwave`, `lofi`) ou o caminho de uma faixa (`musicas/tensa/contagem.mp3`). `musicaVolume` (0,3–1,8) ajusta o nível. A faixa baixa sozinha enquanto há voz, sobe nas pausas e tem fade-in e fade-out.
As faixas ficam em `public/musicas/<clima>/`, com título, artista, origem e crédito em `public/musicas/catalogo.json`. As que vêm por defeito são sintetizadas por `scripts/gerar_musicas.py`; as importadas (YouTube Audio Library, Pixabay) entram pelo painel ou por `python scripts/importar_musica.py <ficheiro> [--clima x] [--credito "…"]`, que analisa o BPM, sugere o clima e normaliza o volume. Na escolha automática, as faixas importadas têm prioridade sobre as geradas. Se a faixa usada tiver crédito, lembra o utilizador de o pôr na descrição do post. Nunca uses música comercial (dá bloqueio de direitos de autor) e nunca descarregues áudio de vídeos do YouTube.
Escolhe o clima pelo tom: storytelling de venda → `tensa`; ranking e curiosidades → `energetica`; explicativo → `ambiente`; estilo VHS → `synthwave`.

## 4. Narração
`narracao`: `edge` (grátis; `voz` pt-BR-AntonioNeural, pt-BR-FranciscaNeural, pt-PT-DuarteNeural) ou `elevenlabs` (voice_id em `voz`, precisa de `ELEVENLABS_API_KEY` no `.env`). Quando o pedido vem do painel, o servidor preenche formato, estilo, narração e voz.
`scripts/narrar.py` divide cada fala nas marcas `[pausa]` e junta os trechos com silêncio real (as vozes ignoram reticências). Na ElevenLabs, envia também o texto das cenas vizinhas para a entoação ter continuidade entre cenas.

## 5. Produzir (só quando o utilizador pedir)
```
npm run video -- roteiros/<id>.json
```
Para pré-visualizar sem renderizar: `python scripts/buscar_midia.py roteiros/<id>.json`, `python scripts/manim_cenas.py roteiros/<id>.json` e depois `npx remotion still src/index.ts Video out/f.png --props=<json {"manifest": roteiro com duracaoMs}> --frame=<n>`.

## 6. Verificar
Vê 2–3 frames (gancho e meio de duas cenas): texto cortado, sobreposições com as legendas (zona y 1250–1500), mídia errada. No fim indica o caminho do MP4, a duração e as fontes (e os preços).

## Outras ferramentas instaladas
- **Skills oficiais do Remotion** (`.agents/skills/remotion-*`): para criar componentes ou efeitos novos, consulta `remotion-best-practices`.
- **Manim** (`python -m manim`): animações matemáticas ou científicas avulsas.
- **Auto-Editor** (`python -m auto_editor`): cortar silêncios de qualquer vídeo (`--margin 0.15sec --no-open -o saida.mp4`).
- **FFmpeg/FFprobe** do Remotion: `npx remotion ffmpeg …` e `npx remotion ffprobe …`, para juntar, cortar ou converter.
