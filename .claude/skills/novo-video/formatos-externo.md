# Guias por formato e por estilo (prompt para outra IA)

O painel monta o prompt para outra IA juntando o `roteirista.md`, só a secção do formato escolhido daqui, o tom do estilo escolhido e o `esquema-roteiro.md`. Cada secção começa por `## formato:` ou `## estilo:` seguido do id. Edite à vontade.

## formato: quiz
Quiz para o espectador jogar: {itens} perguntas sobre o tema, cada uma com contagem real.
- Gancho (`gancho`): o desafio em uma frase curta ("Cinco perguntas, cinco segundos cada. Você zera?"). Prometa só o que o vídeo cumpre.
- Para cada pergunta, duas cenas seguidas:
  1. `quiz`: `numero` e `total`, `pergunta` curta (até ~40 caracteres), 3 `opcoes` curtas e plausíveis (as erradas têm de tentar, não ser piada) e `resposta` (índice da certa). A `fala` diz "Pergunta um:", lê a pergunta e as opções com as mesmas palavras e pela mesma ordem, e acaba aí: **nunca faça a contagem na fala**, a cena conta sozinha 5 segundos em silêncio.
  2. A resposta: `fato` com mídia, `numero` ou `grafico`. Diga a resposta logo na primeira frase e depois o porquê ou um dado que surpreende (é aqui que o vídeo ensina).
- Varie o tipo da cena de resposta e o tema das perguntas. A dificuldade sobe, e a última é a pegadinha: a resposta que quase todos erram (um recorde que caiu, um facto que mudou).
- Cada pergunta e cada resposta vêm da `pesquisa`, com fonte. Nada de perguntas com resposta discutível.
- CTA (`cta`, `acao: "comentar"`): pedir para comentar quantas acertou (ex.: `palavra` "5 DE 5").

## formato: livre
Não há molde: o pedido do criador (tema e observações) é o guião do que ele imagina. Você é o realizador.
- Leia o pedido com atenção e respeite tudo o que ele disser sobre estrutura, tom, ritmo, número de partes ou tipos de cena. O que ele não disser, decida você, a pensar no que prende mais.
- Escolha os tipos de cena que servem cada momento e misture-os: `fato` com mídia real, `numero` para um dado que impressiona, `comparacao` (A x B), `grafico`, `linha_tempo`, `modelo3d`, `pincel` (ilustração 2D desenhada à mão sobre papel: ícones com aguarela, texto manuscrito, setas, círculos, X, vistos, gráficos de barras e de linha), `lowpoly` (animação 3D: personagens em estádio, cidade, quarto, natureza, laboratório, fundo do mar, pré-história com dinossauros, pista de corrida, sala de aula, sala de estar, hospital, nave espacial, planeta alienígena (com alienígenas, robôs, OVNIs e portais), abrigo nuclear, cidade em ruínas ou no espaço, e o pacote nuclear com cogumelo atómico, onda de choque, bomba, míssil e bombardeiro, e objetos de ciência e matemática como planetas, foguetões, átomos, moléculas, ADN e sólidos), `manim` e `quiz` (pergunta com opções e contagem real; num quiz, cada pergunta é uma cena `quiz` seguida da cena que dá a resposta). Não use dois iguais seguidos sem razão.
- Se o pedido falar em animação, desenho, 3D, low poly, bonecos ou "sem fotos", faça o vídeo em cenas `lowpoly` (quase todas), como no formato animado: personagens com nome e a mesma roupa do início ao fim, cenários e objetos animados a encenar cada momento, etiquetas 3D para os números.
- A primeira cena é o gancho. Pode ser `gancho` ou qualquer outra cena forte (uma `lowpoly`, um `numero`, um `fato` com uma imagem marcante), desde que prenda nos primeiros 2 segundos. Logo a seguir vem a apresentação do tema (ver a regra no fim deste guia).
- Mantenha sempre o arco de início, meio e fim, a pesquisa com fontes e as regras de fala natural. Formato livre não é desculpa para ficar raso.
- O fim fecha a ideia do gancho e termina num `cta` (comentar ou seguir) cuja fala pede a inscrição no canal.
- Só fale de preços se o pedido pedir, e nesse caso com loja e data na `pesquisa`.

## formato: ranking
Ranking de produtos com recomendação de compra.
- São {itens} produtos, contados do último para o primeiro. O número um é o clímax e fica para o fim.
- Cada produto é uma cena `produto` com `rank`, `nome`, `categoria`, `preco` real, 2 a 3 `tags` de benefício, até 3 `specs` e `midia` com a foto do produto.
- A `fala` de cada produto começa pela posição e pelo nome ("Número três: a RTX cinquenta e sessenta.") e diz **para quem** ele serve e **por que** está nessa posição, com um dado concreto (desempenho, consumo, preço por frame).
- Entre os produtos, pode entrar uma cena `comparacao` ou `numero` para explicar a diferença entre dois deles.
- Uma cena `modelo3d` do vencedor, logo depois do número um, dá destaque (`procedural` gpu, cpu, ram ou ssd quando não houver modelo).
- CTA: `link` (link na bio) ou `comentar` com uma palavra. Se houver links de afiliado, a `legenda_post` diz "link de afiliado" ou leva #publi.

## formato: storytelling
Um único produto. A pessoa tem de sentir o problema antes de ver a solução, e o produto só aparece depois da metade do vídeo. Estrutura base com 6 a 8 cenas (adapte ao tema):
1. **gancho**: dor, medo ou curiosidade ligada a algo que o público tem ("SEU PC PODE QUEIMAR HOJE"), com mídia de fundo. A fala abre a história ("Era uma noite de chuva. [pausa] A luz piscou uma vez…").
2. **história**: `fato` sem número, uma situação concreta e reconhecível, com mídia real, contada como uma cena de filme, com um personagem (você, um amigo, "um seguidor me mandou isto").
3. **agitação**: `numero` com `alerta: true`, com uma estatística ou um custo real com fonte. `[pausa longa]` antes do número.
4. **o erro comum**: `comparacao` entre o que as pessoas usam e o que resolve, com `vencedor`. É a virada: "o problema não era azar, era isto".
5. **solução**: `produto` sem rank, `etiqueta` "A SOLUÇÃO", preço real, `tags` com benefícios (não specs técnicas) e foto via `midia`.
6. **prova ou objeção**: `numero` sem alerta (ex.: "R$ 89 contra R$ 2.000 de prejuízo") ou um `fato`, e um *callback* ao gancho ("Na próxima tempestade, [pausa] o seu PC nem vai notar.").
7. **cta**: `acao` `link` ou `comentar`, com a `palavra` ligada ao produto.

Regras: benefícios antes de especificações; nada de estatísticas, depoimentos ou escassez inventados; sem promessas absolutas; se o link for de afiliado, a `legenda_post` diz "link de afiliado" ou leva #publi.

## formato: curiosidades
Curiosidades do mundo gamer e da tecnologia ({itens} curiosidades).
- Cada curiosidade é uma cena `fato` com `titulo` curto, `kicker` com a posição ("Curiosidade dois") e `midia` real (screenshots do jogo via `steam`, fotos via `wikimedia`).
- Ordene da menos para a mais surpreendente. A última é a mais forte, e a fala da anterior pode puxá-la ("Mas nenhuma chega perto da última.").
- Cada fala diz a curiosidade e **o porquê** ou a consequência (o teste do "e daí?"). Um facto solto não chega.
- Quando houver um número forte, use uma cena `numero` a seguir ao `fato`.
- CTA: `comentar` ("Qual destas você não sabia?") ou `seguir`.

## formato: explicativo
Vídeo explicativo no estilo Kurzgesagt/Vox: responde a uma pergunta ("Por que as placas de vídeo ficaram tão caras?").
- O gancho faz a pergunta de forma concreta. O meio explica o mecanismo passo a passo, cada cena com uma ideia.
- Varie o tipo de cena: `fato` com mídia, `grafico` para mostrar a evolução, `linha_tempo` para a história, `comparacao`, `numero`, `modelo3d` para mostrar o hardware por dentro e, se souber escrever Manim que roda, `manim`.
- Use analogias do dia a dia ("a memória cache é como a bancada da cozinha").
- O fim responde à pergunta do gancho numa frase clara, e o CTA convida a comentar ou seguir.

## formato: ese
Siga a secção 3.5 ("E se?") acima: escalada no tempo ou na escala, cada passo apoiado num dado real, uma virada no fim, e um CTA para comentar o próximo "E se?". Não venda nada.

## formato: animado
"E se?" em animação 3D low poly: a mesma escalada da secção 3.5, mas as cenas são do tipo `lowpoly` (não há fotos nem b-rolls).
- Gancho: uma cena `lowpoly` com `titulo` (a pergunta, até 6 palavras), plano `aberto` e um cenário que mostre logo o mundo da hipótese (a cidade à noite, o estádio cheio, a Terra vista do espaço), com uma personagem em `choque` ou a `apontar`. Use `tipo: "lowpoly"` também para a primeira cena (não `gancho`).
- Uma cena por frase da narração (falas de 12 a 22 palavras), e cada cena muda alguma coisa: outro `cenario`, outro `plano` (alterne aberto, medio e close), outra `acao`, outra `hora` ou outro movimento de `camera`. Nunca duas cenas seguidas iguais.
- Personagens: dê `nome` ao protagonista e mantenha o mesmo `visual` e a mesma `cor` em todo o vídeo, para se reconhecer. Os outros reagem. A ação e a expressão contam a emoção (choque na descoberta, pensar quando se explica, triste quando piora, celebrar no fim).
- Escalada: a `hora` passa de `dia` a `tarde` e a `noite` à medida que a história piora; o cenário pode crescer (do `quarto` para a `cidade`, da `cidade` para o `planeta`).
- Ciência: 1 ou 2 cenas sem personagens a mostrar o efeito em grande (o `planeta` a rodar, a `natureza` em `deserto` ou `neve`), com a `etiqueta` a dar o número real da pesquisa ("+40 °C", "-100%").
- Use `etiqueta` (até 12 caracteres, com `marca` certo ou errado) para concretizar cada passo.
- CTA: a última cena normal `cta` (comentar o próximo "E se?").
## formato: longo
Siga a secção 3.6 (vídeo longo para o YouTube) acima: 4 a 7 capítulos com cenas `capitulo`, falas de 25 a 55 palavras, pelo menos 12 factos com fonte, mídia em quase todas as cenas e 2 ou 3 `cortes` para Shorts.

## estilo: neon
Tom gamer e enérgico: frases curtas, impacto, gírias leves de gamer sem exagero.

## estilo: fogo
Tom gamer intenso e competitivo: urgência, frases curtas, números que impressionam.

## estilo: cyber
Tom gamer futurista: tecnologia, desempenho e o que vem a seguir.

## estilo: hormozi
Tipografia cinética: as palavras aparecem de duas em duas. Frases muito curtas e diretas, uma ideia por frase. Escolha `destaques` fortes (dinheiro, tempo, ganho, perda), porque são eles que ganham cor na tela.

## estilo: papel
Stop motion de papel recortado: tom artesanal e de história contada à mão, imagens concretas e palpáveis. Funciona bem com narrativa.

## estilo: explicativo
Estilo Kurzgesagt: tom calmo, curioso e didático, com analogias. Prefira cenas `grafico`, `linha_tempo` e `numero`.

## estilo: corporativo
Flat corporativo: tom sóbrio e claro, sem gírias, como um bom apresentador de notícias de tecnologia.

## estilo: vhs
Synthwave anos 80: tom nostálgico ("lembra quando…"), referências a jogos e consolas antigos.

## estilo: hud
Interface sci-fi: tom técnico e preciso, como um relatório de missão. Números e especificações em destaque.

## estilo: matematica
Estilo 3Blue1Brown: tom de professor curioso, passo a passo, uma ideia de cada vez. Use cenas `manim` e `grafico` sempre que fizer sentido.

## estilo: clean
Review séria: tom honesto e equilibrado, prós e contras, sem exageros.

## estilo: vox
Editorial (estilo Vox): tom de jornalismo explicativo, claro e com autoridade. Uma palavra-chave por frase (vai para `destaques`: o marcador amarelo risca-a na legenda) e palavras negativas ("perde", "caro", "erro") aparecem riscadas a vermelho. Prefira fotos reais de arquivo e números com fonte.

## estilo: aquarela
Livro ilustrado a tinta e aquarela: tom caloroso de contador de histórias, frases que pintam imagens. Combina muito bem com cenas `lowpoly` (ficam pintadas a aguada) e com histórias; prefira fotos com um assunto claro, porque ficam ilustradas.

## estilo: estudio3d
Mundo 3D contínuo (estúdio escuro com chão espelhado; a câmara voa de estação em estação). Inclua pelo menos uma cena `modelo3d` com o objeto central do tema e prefira `midia` de imagem nítida, porque vira um ecrã suspenso.

## Regra de todos os formatos: inscrição
A última cena é sempre um `cta` e a fala dele pede para se inscrever no canal ("se inscreve pra não perder o próximo"), mesmo quando a ação principal é comentar ou o link: ex. "Comenta aí qual foi a tua e se inscreve no canal." O ecrã mostra sempre o botão de inscrição.

## Regra de todos os formatos: pausas
`[pausa]` e `[pausa longa]` só logo a seguir a uma vírgula, ponto, `?`, `!`, dois pontos ou reticências ("A rede caiu. [pausa] E agora?"). Nunca no meio de uma frase sem pontuação ("pega o celular [pausa] e nenhum…"): soa a vídeo travado e a narração ignora essas marcas.

## Modelos 3D prontos (cena lowpoly)
Objeto `{"tipo": "modelo", "modelo": "pack/nome", "posicao": "direita", "rotacao": 0}` com 3278 modelos low poly. Packs: blaster-kit, blocky-characters, building-kit, car-kit, castle-kit, city-kit-commercial, city-kit-industrial, city-kit-roads, city-kit-suburban, cube-pets, factory-kit, fantasy-town-kit, food-kit, furniture-kit, graveyard-kit, hexagon-kit, holiday-kit, mini-arcade, mini-characters, mini-dungeon, mini-forest, mini-shop, modular-buildings, modular-dungeon-kit, modular-space-kit, nature-kit, pirate-kit, platformer-kit, racing-kit, retro-fantasy-kit, retro-urban-kit, space-kit, space-station-kit, survival-kit, tower-defense-kit, train-kit, watercraft-kit. Exemplos: `pirate-kit/ship-large`, `graveyard-kit/character-zombie`, `car-kit/sedan`, `food-kit/burger`, `castle-kit/tower-square`, `cube-pets/animal-elephant`, `nature-kit/tree_default`. Se não souber o nome exato, escreva palavras em inglês ("pirate ship"): o estúdio escolhe o mais parecido.

## Regra de todos os formatos: apresentação do tema
**Apresentação do tema** (logo a seguir ao gancho, nos primeiros 5 a 10 segundos; no vídeo longo, nos primeiros 30): uma ou duas frases que dizem com clareza **de que é o vídeo** e **o que a pessoa vai entender ou ver**, com o tema dito pelo nome. Ex.: gancho "Todo dia, bilhões de reais trocam de mão sem ninguém sair de casa." → apresentação "Isso é a bolsa de valores. [pausa] Em um minuto você vai entender o que é uma ação, quem compra e por que o preço sobe e desce." Pode ser o fim da fala do gancho ou a cena seguinte (com `texto_tela`/`titulo` que mostre o tema). Não substitui o gancho (nada de abrir com "Fala, galera" ou "Hoje vamos falar de…"): vem depois dele. Só então o vídeo desenvolve o assunto, pela ordem que a apresentação anunciou.

## Cena pincel (animação 2D desenhada à mão)
**pincel**: ilustração desenhada à mão (traço de caneta, lápis, marcador ou carvão e manchas de aguarela), que se desenha traço a traço sobre papel; o traço "treme" ligeiramente como numa animação desenhada. Para vídeos animados em 2D, sem fotos nem 3D. `papel` (`papel` = creme, padrão | `branco` | `caderno` = linhas azuis e margem | `quadro` = quadro de giz), `titulo` (em letra de marcador, sublinhado à mão), `tremer: false` para o traço parado, e `elementos` (até 10), que se desenham um a seguir ao outro (ou no `quando` de cada um): `{"tipo": "icone", "nome": "piggy-bank", "rotulo": "legenda por baixo", "cor": "#hex da mancha de aguarela" (ou "nenhuma")}` com qualquer ícone da Lucide (lucide.dev/icons, ~1.900: "rocket", "brain", "coins", "smartphone", "heart-pulse", "globe"…); `{"tipo": "texto", "texto": "frase curta"}` em letra manuscrita; `{"tipo": "seta", "de": 0, "para": 1}` (índices de outros elementos ou posições); `{"tipo": "circulo" | "sublinhado" | "x" | "visto", "alvo": índice}` (rodear, sublinhar, riscar a vermelho, visto verde); `{"tipo": "barras", "valores": [3, 5, 9], "rotulos": ["2022", "2023", "2024"], "formatos": ["3 mil", "5 mil", "9 mil"]}` (barras a aguarela que crescem) e `{"tipo": "linha", "valores": [...]}` (gráfico de linha desenhado). Campos comuns: `posicao` (`centro` | `esquerda` | `direita` | `topo` | `baixo` | `topo_esquerda` | `topo_direita` | `baixo_esquerda` | `baixo_direita` | `[x, y]` de 0 a 1; sem posição, o estúdio distribui), `tamanho` (1 = normal), `cor`, `traco` (`caneta` | `lapis` | `marcador` | `carvao` | `giz`), `quando` (segundo em que começa) e `duracao`. Cada cena tem 1 a 4 ideias visuais, não uma página cheia; os destaques (`circulo`, `x`, `visto`, `seta`) vêm depois do elemento, no momento em que a fala o diz.

