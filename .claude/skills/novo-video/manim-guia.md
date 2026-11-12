# Guia do Manim (cenas `manim`)

Adaptado do manim_skill (manimce-best-practices, MIT) para o estúdio. O estúdio corre **Manim Community 0.22** (não ManimGL). O `codigo` de uma cena `manim` é só a classe: o estúdio acrescenta `from manim import *` e a cor de fundo do estilo.

## O que o código tem de ser
```python
class Cena(Scene):
    def construct(self):
        titulo = Text("Juros compostos", font_size=40, weight=BOLD).to_edge(UP, buff=0.6)
        self.play(Write(titulo), run_time=0.8)
        ...
        self.wait(1.5)
```
- Uma única `class Cena(Scene)` (ou `MovingCameraScene` se mover a câmara). Sem `import`, sem ler ficheiros, sem `SVGMobject`/`ImageMobject` (não há ficheiros), sem 3D (`ThreeDScene` é lento).
- **Fórmulas com `MathTex`** (o LaTeX está instalado: MiKTeX): `MathTex(r"E = mc^2")`, `MathTex(r"\int_0^1 x^2\,dx = \frac{1}{3}")`, `MathTex(r"a^2 + b^2 = c^2")`. Use sempre strings `r"..."`. Para destacar uma parte, divida em pedaços: `MathTex("a^2", "+", "b^2", "=", "c^2")` e pinte com `eq[0].set_color(YELLOW)`; `TransformMatchingTex` anima a passagem de uma equação para outra. `Matrix([[1, 2], [3, 4]])` também funciona.
- **Texto normal com `Text`** (ou `MarkupText`): frases, títulos e tudo o que tem acentos portugueses (`ç`, `ã`, `é`). Não ponha palavras com acentos dentro de `MathTex` nem de `Tex`.
- Números que contam: `DecimalNumber(0, num_decimal_places=0)` com `ChangeDecimalToValue(n, 1000)`, ou `ValueTracker` + um `Text` redesenhado a cada frame (melhor quando o número leva pontos de milhar ou unidades):
  ```python
  v = ValueTracker(0)
  numero = always_redraw(lambda: Text(f"{v.get_value():,.0f}".replace(",", "."), font_size=72, color=YELLOW))
  self.add(numero)
  self.play(v.animate.set_value(1500000), run_time=2)
  ```
- Nada de nomes do ManimGL antigo: `ShowCreation` (é `Create`), `TextMobject`/`TexMobject` (é `Text`), `CONFIG = {}`, `from manimlib`.

## Tela e tamanhos
- Vertical (Shorts): **4,5 × 8 unidades**, centro em (0, 0). Mantenha tudo em x entre −2 e 2 e y entre −3,6 e 3,6 (deixe os últimos ~1,2 de baixo para as legendas: y > −2,8 no conteúdo).
- Horizontal (vídeo longo): 14,2 × 8, x entre −6,5 e 6,5.
- `font_size`: títulos 36 a 44, rótulos 24 a 30, números grandes 60 a 90. Teste a largura: um `Text` com mais de ~18 caracteres a 40 já passa de 4 unidades no vertical; use `.scale_to_fit_width(4)` quando houver dúvida.
- Posicione com `to_edge`, `next_to(obj, DOWN, buff=0.3)`, `arrange(DOWN, buff=0.4)` dentro de um `VGroup`, em vez de coordenadas soltas.

## Tempo
- A cena dura o mesmo que a fala: some os `run_time` e os `self.wait` até ≈ à duração da fala (≈ palavras ÷ 2,7 s). Se ficar curta, o último frame fica parado; acabe sempre com um `self.wait(1)` ou mais.
- Uma ideia por animação, na ordem em que a fala a diz. `LaggedStart(*anims, lag_ratio=0.2)` para listas; `rate_func=smooth` (padrão) para entradas, `linear` só para movimento contínuo.
- Entradas: `Write` para texto, `Create` para linhas e formas, `FadeIn(obj, shift=UP*0.3)` para blocos, `GrowFromCenter` para destaques, `Transform`/`ReplacementTransform` para mostrar uma coisa a virar outra.

## Gráficos
```python
eixos = Axes(x_range=[0, 10, 2], y_range=[0, 100, 20], x_length=3.8, y_length=4,
             axis_config={"include_numbers": False}).shift(DOWN * 0.3)
curva = eixos.plot(lambda x: x ** 2, color=YELLOW)
self.play(Create(eixos), run_time=1)
self.play(Create(curva), run_time=2)
```
- Eixos com números: `Axes(..., axis_config={"include_numbers": True})` funciona. Os rótulos dos eixos podem ser `eixos.get_axis_labels(MathTex("x"), MathTex("y"))`.
- Barras: `Rectangle(width=0.5, height=v).next_to(base, UP, buff=0)` dentro de um `VGroup().arrange(RIGHT, aligned_edge=DOWN)`.

## Cores
Use as constantes (`YELLOW`, `TEAL`, `ORANGE`, `RED`, `BLUE`, `WHITE`, `GREY_B`) ou hex (`"#ffd400"`). Uma cor de destaque por cena para o que importa; o resto em branco/cinzento.

## Antes de entregar, confira
- [ ] `class Cena(Scene)` e nada fora dela.
- [ ] Nenhum `import` nem ficheiro externo; `MathTex` só com matemática (sem acentos), em strings `r"..."`.
- [ ] Tudo dentro de x ±2 (vertical) e acima de y −2,8.
- [ ] `run_time` + `wait` ≈ duração da fala.
