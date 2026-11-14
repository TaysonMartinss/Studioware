# Aprender os efeitos de um estilo (animação, câmara, transições, motion blur)

Estás a criar o **módulo de efeitos** de um estilo novo do estúdio a partir de um vídeo de referência. A direção de
arte (cores, letra, fundo base) já foi escolhida; agora recrias o **movimento**: como a câmara se mexe, como as cenas
entram e saem, o motion blur, como as palavras animam, as texturas por cima e a composição.

## O que tens
- **Frames** do vídeo (`frame-01.jpg`…) e **rajadas** (`rajada-1.jpg`…): cada rajada é uma tira com 6 frames seguidos
  a 0,1 s de intervalo. Compara-os da esquerda para a direita: é aí que se vê a transição (chicote, zoom, deslize,
  rotação 3D, máscara, corte seco), o motion blur (rasto na direção do movimento), a entrada das letras (escala, deslize,
  escrita, ondulação) e os movimentos de câmara (push-in, pan, órbita, tremor).
- O estilo já escolhido (JSON) e o guia que o roteirista vai seguir.
- `src/aprendidos/_kit.tsx`: as peças que podes usar (`Camara3D`, `DesfoqueMovimento`, `progresso`, `useTempo`, `random`,
  `interpolate`, `Easing`, `spring`, e os tipos). **Lê-o primeiro.**
- `src/aprendidos/_exemplo.tsx`: um módulo completo de exemplo. **Lê-o** e segue a mesma forma.

## O que escreves
Um único ficheiro, **`src/aprendidos/<id>.tsx`** (o id vem no pedido), que exporta `efeitos: EfeitosEstilo` com as peças
que o vídeo de referência justifica (todas são opcionais):

- `Fundo({ cor })`: fundo de ecrã inteiro por trás das cenas (degradês animados, grelhas, luzes, formas, partículas).
- `Cena({ children, indice, duracao, cor })`: envolve cada cena. **Tem de desenhar `children`.** Aqui ficam a câmara 3D
  (`Camara3D` com x/y/z/rotações a mudar no tempo), a transição de entrada (primeiros ~6–12 frames) e de saída (últimos
  ~6 frames), o motion blur (`DesfoqueMovimento` com a velocidade do movimento, calculada como valor(f) − valor(f−1)) e
  composições (molduras, divisões, cartões). Varia com `indice` (ex.: lado da transição) para não repetir.
- `Overlay({ cor })`: por cima de tudo (grão, fugas de luz, vinheta, moldura, scanlines). Discreto: nunca tapa o centro
  nem a zona das legendas (y entre 1150 e 1500).
- `legenda`: a animação das legendas (`porPagina`, `top` entre 1150 e 1400, `bloco(e)`, `palavra(e, cor, estado)`),
  como nas legendas do vídeo de referência (cor da palavra ativa, escala, rotação, entrada, contorno, sombra).

## Regras (o ficheiro é validado e testado num render; se falhar, o estilo fica sem efeitos)
- Imports só de `"./_kit"`, `"react"` e `"remotion"`. Nada de bibliotecas novas, ficheiros externos ou `fetch`.
- Tudo determinístico: em vez de `Math.random()` usa `random("semente")` do kit.
- Leve: nada de ciclos com centenas de elementos por frame, no máximo 2 filtros de desfoque ao mesmo tempo.
- TypeScript válido, com tipos explícitos nas props como no exemplo. Ecrã de 1080×1920, 30 fps.
- Não copies marcas, logótipos nem personagens: só a linguagem visual.
- Escreve o ficheiro com Write. No fim responde numa linha com o que recriaste (ex.: "push-in 3D com chicote e motion
  blur, fundo com fugas de luz, legendas a cair com rotação").
