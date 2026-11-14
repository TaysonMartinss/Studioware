# Aprender um estilo de edição com um exemplo

Recebes imagens de um vídeo de referência (frames, capa) que o criador quer imitar. Lê cada imagem com Read.
A tua tarefa é traduzir a **direção de arte e a edição** desse vídeo num estilo do estúdio, usando só as peças que o
motor já tem (não inventes valores fora das listas). Não copies marcas, logótipos nem personagens: só a linguagem
visual (cores, tipografia, fundo, ritmo, acabamento).

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
