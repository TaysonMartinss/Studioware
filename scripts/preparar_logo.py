"""Prepara a logo de um canal para a marca d'água: PNG com transparência, sem margens, 256 px de altura.

Uso: python scripts/preparar_logo.py entrada.(png|jpg|webp) saida.png [--remover-fundo]
--remover-fundo: tira o fundo liso (a cor dos cantos), só a parte ligada às bordas, com a borda suavizada.
Imprime um JSON: {"largura", "altura", "fundoRemovido"}.
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

ALTURA = 256
TOLERANCIA = 48  # distância de cor (0–441) que ainda conta como fundo


def remover_fundo(img):
    rgb = img.convert("RGB")
    w, h = rgb.size
    cantos = [rgb.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    # cantos de cores muito diferentes: não há um fundo liso para tirar
    ref = max(set(cantos), key=cantos.count)
    if sum(1 for c in cantos if sum((a - b) ** 2 for a, b in zip(c, ref)) ** 0.5 < TOLERANCIA) < 3:
        return img, False
    # o fundo é o que se liga às bordas com a cor de referência (não apaga o branco de dentro de um logo branco)
    marca = rgb.copy()
    for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if marca.getpixel(p) != (255, 0, 255):
            ImageDraw.floodfill(marca, p, (255, 0, 255), thresh=TOLERANCIA)
    mascara = Image.new("L", (w, h), 0)
    px, pm = marca.load(), mascara.load()
    for y in range(h):
        for x in range(w):
            pm[x, y] = 0 if px[x, y] == (255, 0, 255) else 255
    mascara = mascara.filter(ImageFilter.GaussianBlur(0.8))  # borda suave, sem serrilhado
    saida = img.convert("RGBA")
    alfa = Image.composite(saida.split()[3], Image.new("L", (w, h), 0), mascara)
    saida.putalpha(alfa)
    return saida, True


def main():
    entrada, saida = sys.argv[1], sys.argv[2]
    img = Image.open(entrada)
    img.load()
    img = img.convert("RGBA")
    img.thumbnail((1024, 1024), Image.LANCZOS)  # logos enormes: o resto do trabalho fica rápido
    removido = False
    if "--remover-fundo" in sys.argv:
        img, removido = remover_fundo(img)
    caixa = img.split()[3].point(lambda a: 255 if a > 12 else 0).getbbox()
    if caixa:
        img = img.crop(caixa)
    if img.height > ALTURA:
        img = img.resize((max(1, round(img.width * ALTURA / img.height)), ALTURA), Image.LANCZOS)
    img.save(saida, "PNG", optimize=True)
    # opaca: a logo é um bloco cheio (o fundo ficou, ou é um quadrado de cantos redondos): mais de 80% da área
    # preenchida. A marca d'água recorta-a em círculo para casar com a pílula.
    alfa = img.split()[3]
    cheio = sum(alfa.histogram()[201:]) / max(1, img.width * img.height)
    print(json.dumps({"largura": img.width, "altura": img.height, "fundoRemovido": removido, "opaca": cheio > 0.8}))


if __name__ == "__main__":
    main()
