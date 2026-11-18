# Aprender um estilo de edição com um exemplo

Recebes imagens de um vídeo de referência (frames, capa) que o criador quer imitar. Lê cada imagem com Read.
A tua tarefa é traduzir a **direção de arte e a edição** desse vídeo num estilo do estúdio, usando só as peças que o
motor já tem (não inventes valores fora das listas). Não copies marcas, logótipos nem personagens: só a linguagem
visual (cores, tipografia, fundo, ritmo, acabamento).

## Análise medida (quando existe)
Se o pedido traz um ficheiro `analise.json`, o vídeo foi decomposto plano a plano pelo rea-video. **Lê-o primeiro**: são
medições, não palpites, e mandam sobre o que achares nas imagens. A primeira imagem é o storyboard (um frame por plano).
- `ritmo` e `planos[].duracao`: planos curtos (< 1,5 s) pedem `transicao` seca ou `whip` e `flash`; planos longos (> 4 s), `suave`.
- `planos[].cor` (saturação 0 a 1, luma 0 a 255, contraste) e `planos[].luz`/`camara`/`enquadramento` (em chinês: traduz):
  saturação baixa e luma alta → `claro`/`editorial`; luma baixa → fundos escuros; contraste alto → `overlay` `grao`.
- `textos[]`: o texto na tela com `estilo.fill`/`stroke` (hex), `stroke_ratio` (espessura do contorno), `weight` (peso),
  `alturaLinha` (fração da altura do vídeo), `caixa` [x, y, largura, altura] em frações, `faixa` (top/middle/bottom),
  `tipo` (`subtitle` = legenda falada, `label`/`title` = texto gráfico) e `entrada`/`saida` (animação). Daqui tiras
  `corTexto`, `cor`, a `legenda` (contorno grosso e letra grande → `hormozi`/`padrao`; pílula de cor → `pilula`) e onde ela fica.
- `efeitosSonoros[]` (tipo e o que acontece na imagem nesse momento) e `musica.bpm`: descreve-os no `guia` (ex.: "pop
  em cada palavra-chave que aparece", "whoosh nos cortes") para o roteirista marcar `sons`/`som`.
- Ignora o `resumo` quando diz que a imagem é "IA" ou "3D": o modelo não vê; importa o ritmo, o texto, a cor e o som.

## O que observar
- **Paleta**: a cor de destaque (`cor`), uma segunda cor (`cor2`), o fundo (`fundo`) e a cor do texto (`corTexto`), em hex.
- **Fundo** → `tema`: `solido` (preto/escuro liso, com grelha ondulada branca), `grelha` (escuro com luz de cor), `gradiente`,
  `papel` (papel craft, colagem), `estrelas` (espaço), `claro` (claro limpo), `synthwave` (pôr do sol anos 80), `hud`
  (interface sci-fi), `cartesiano` (quadro de matemática), `mundo3d` (estúdio 3D escuro), `editorial` (papel milimétrico
  claro, revista) ou `vice` (céu ao pôr do sol com palmeiras).
- **Textura por cima** → `overlay`: `grao`, `scan` (linhas de ecrã), `vhs`, `hud`, `papel` ou `null`.
- **Corte entre cenas** → `transicao`: `corte` (seco), `whip` (chicote rápido), `suave`, `papel`, `forma`, `vhs`, `hud`, `voo` (câmara 3D), `folha`.
- **Legendas** → `legenda`: `padrao` (grandes, palavra a palavra), `hormozi` (gigantes, saltitantes, cores alternadas),
  `pilula` (dentro de uma pílula), `elegante` (discretas), `marcador` (marcador amarelo a sublinhar), `neon`, `hud`,
  `papel` (recortes de papel) ou `aquarela`.
- **Letra dos títulos e do corpo** → `titulo` e `corpo`: `anton` (condensada pesada), `archivo`, `inter` (sem serifa moderna),
  `montserrat`, `poppins`, `grotesk`, `kalam` (manuscrita), `marker` (marcador), `vt323` (pixel), `orbitron` (futurista),
  `mono`, `serif` (serifa de revista) ou `stix` (livro de matemática).
- **Energia**: `glitch` (true/false), `shake` (0 a 1.5, tremor da câmara nos impactos), `flash` (0 a 0.5, clarão nos cortes),
  `passo` (1 = fluido; 2.5 = stop motion a ~12 fps), `raio` (cantos dos cartões, 0 a 30 px), `brilho` (glow, true/false),
  `tracking` (espaçamento dos títulos, ex. "-0.02em").
- `pixel` só se o vídeo for 3D pixelizado com pontos (dithering): `{"tamanho": 10, "niveis": 8}`.
- **Cenas que combinam com o estilo** (para o guia do roteirista): `tipografia` (frase de revista + objeto 3D),
  `dado` (número editorial com barras), `faixa` (b-roll em faixa de cinema), `palavras` (palavras gigantes), `lowpoly`
  (animação 3D), `fato` (foto com título), `numero`, `grafico`, `linha_tempo`, `comparacao`, `quiz`, `modelo3d`.

## Resposta
Responde **só com JSON**:

```json
{
  "nome": "Nome curto do estilo (2 a 3 palavras)",
  "descricao": "Uma frase: o que define o visual (aparece no painel)",
  "estilo": {
    "cor": "#ffd23f", "cor2": "#5aa9ff", "fundo": "#0a0c11", "corTexto": "#ffffff", "sombra": "0 4px 18px #000c", "superficie": "#ffffff14",
    "tema": "solido", "overlay": "grao", "transicao": "corte", "legenda": "padrao", "titulo": "anton", "corpo": "inter",
    "glitch": false, "shake": 0.4, "flash": 0, "passo": 1, "raio": 10, "brilho": false, "tracking": "-0.01em"
  },
  "guia": "Duas a quatro frases para o roteirista: o tom da narração, o ritmo, que cenas usar (e quais evitar), como são os ganchos e os títulos neste estilo.",
  "observado": "Uma frase com o que viste no vídeo de referência que justifica as escolhas."
}
```
