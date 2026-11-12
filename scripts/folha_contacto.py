"""Folha de contacto de um vídeo renderizado: frames do início de cada cena (e do meio, nos Shorts) em grelha,
com o número da cena e o tempo. Serve para a revisão visual (o Claude não vê o vídeo, mas vê estas imagens).
Adaptado do review-loop do claude-motion (MIT).

Uso: python scripts/folha_contacto.py <id>   (lê out/<id>.mp4 e out/<id>.props.json)
Saída: out/revisao/<id>-1.jpg, -2.jpg… e, na última linha, um JSON com as folhas e o que cada quadro mostra.
"""
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30
PAD_MS = 250  # o mesmo respiro que o Remotion põe no fim de cada cena (types.ts)


def ffmpeg():
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    exe = Path("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe")
    return str(exe) if exe.exists() else "ffmpeg"


def relogio(s):
    return f"{int(s // 60)}:{int(s % 60):02d}"


def main(vid):
    mp4 = Path("out") / f"{vid}.mp4"
    props = Path("out") / f"{vid}.props.json"
    if not mp4.exists() or not props.exists():
        raise SystemExit(f"falta out/{vid}.mp4 ou out/{vid}.props.json (renderize o vídeo primeiro)")
    manifest = json.loads(props.read_text(encoding="utf-8"))["manifest"]
    longo = manifest.get("formato") == "longo"

    # quadros: o frame 0 (é a miniatura no feed), o início de cada cena depois de assentar (+0,6 s) e, nos Shorts, o meio
    quadros, inicio = [(0.0, 0, "frame 0")], 0
    for i, c in enumerate(manifest["cenas"]):
        dur = math.ceil(((c.get("duracaoMs") or 3000) + PAD_MS) / 1000 * FPS) / FPS
        quadros.append((inicio + min(0.6, dur / 3), i + 1, c.get("tipo", "")))
        if not longo and dur > 3:
            quadros.append((inicio + dur * 0.6, i + 1, c.get("tipo", "")))
        inicio += dur

    larg, alt, cols = (384, 216, 4) if longo else (240, 427, 6)
    linhas = 3 if longo else 2
    por_folha = cols * linhas
    pasta = Path("out/revisao")
    pasta.mkdir(parents=True, exist_ok=True)
    for antigo in pasta.glob(f"{vid}-*.jpg"):
        antigo.unlink()
    try:
        fonte = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        fonte = ImageFont.load_default()

    folhas, mapa = [], []
    with tempfile.TemporaryDirectory() as tmp:
        imagens = []
        for k, (t, cena, tipo) in enumerate(quadros):
            destino = Path(tmp) / f"q{k}.jpg"
            subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", str(mp4), "-frames:v", "1", "-vf", f"scale={larg}:{alt}", str(destino)], check=False)
            imagens.append(Image.open(destino).convert("RGB") if destino.exists() else Image.new("RGB", (larg, alt), "#300"))
        for f0 in range(0, len(quadros), por_folha):
            grupo = list(range(f0, min(f0 + por_folha, len(quadros))))
            n_linhas = math.ceil(len(grupo) / cols)
            folha = Image.new("RGB", (cols * (larg + 6) + 6, n_linhas * (alt + 32) + 6), "#111")
            d = ImageDraw.Draw(folha)
            for j, k in enumerate(grupo):
                x, y = 6 + (j % cols) * (larg + 6), 6 + (j // cols) * (alt + 32)
                folha.paste(imagens[k], (x, y + 26))
                t, cena, tipo = quadros[k]
                rotulo = f"#{k + 1}  {'cena ' + str(cena) if cena else 'frame 0'}  {tipo}  {relogio(t)}"
                d.text((x + 4, y + 4), rotulo, fill="#ffd400", font=fonte)
                mapa.append({"quadro": k + 1, "folha": len(folhas) + 1, "cena": cena, "tipo": tipo, "tempo": round(t, 2)})
            caminho = pasta / f"{vid}-{len(folhas) + 1}.jpg"
            folha.save(caminho, quality=85)
            folhas.append(caminho.as_posix())
    print(json.dumps({"folhas": folhas, "quadros": mapa}, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
