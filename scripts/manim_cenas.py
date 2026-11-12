"""Renderiza as cenas "manim" de um roteiro (código Python com uma classe Cena(Scene)) para mp4 vertical 1080x1920
(ou 1920x1080 nos vídeos longos, formato "longo").

O vídeo vai para public/videos/<id>/manim-N.mp4 e o caminho fica em cena.midia no próprio roteiro.
Uso: python scripts/manim_cenas.py roteiros/x.json [--forcar]
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


GUIA = Path(".claude/skills/novo-video/manim-guia.md")


# LaTeX (MiKTeX) para MathTex, Tex, DecimalNumber e eixos com números: junta-o ao PATH se estiver instalado
MIKTEX = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/MiKTeX/miktex/bin/x64"
AMBIENTE = dict(os.environ)
if MIKTEX.exists() and str(MIKTEX) not in AMBIENTE.get("PATH", ""):
    AMBIENTE["PATH"] = str(MIKTEX) + os.pathsep + AMBIENTE.get("PATH", "")


def renderizar(fonte, trabalho, i, resolucao):
    return subprocess.run(
        [sys.executable, "-m", "manim", "render", str(fonte), "Cena", "-q", "h", "--fps", "30",
         "-r", resolucao, "--media_dir", str(trabalho / "media"), "-o", f"manim-{i}", "--disable_caching"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", env=AMBIENTE,
    )


def corrigir_com_claude(codigo, erro):
    """Pede ao Claude Code (modo headless) a classe corrigida; devolve o código novo ou None."""
    if not shutil.which("claude") or os.environ.get("MANIM_AUTOCORRIGIR") == "0":
        return None
    pedido = (
        "Esta cena Manim (Manim Community 0.22, com LaTeX via MiKTeX) falhou no render. Corrija-a seguindo o guia, mantendo a "
        "mesma ideia e a mesma duração. Responda só com o código da classe Cena num bloco ```python, sem imports.\n\n"
        f"Erro:\n{erro[-2500:]}\n\nCódigo:\n```python\n{codigo}\n```"
    )
    try:
        r = subprocess.run(["claude", "-p", "--append-system-prompt", GUIA.read_text(encoding="utf-8")], input=pedido,
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=240)
    except Exception:
        return None
    m = re.search(r"```(?:python)?\n(.*?)```", r.stdout or "", re.S)
    novo = (m.group(1) if m else "").strip()
    novo = "\n".join(l for l in novo.splitlines() if not re.match(r"\s*(from manim import|import |config\.background_color)", l))
    return novo if "class Cena" in novo else None


def main():
    caminho = Path(sys.argv[1])
    forcar = "--forcar" in sys.argv
    roteiro = json.loads(caminho.read_text(encoding="utf-8"))
    vid = roteiro["id"]
    pasta = Path("public/videos") / vid
    pasta.mkdir(parents=True, exist_ok=True)
    trabalho = Path("out/manim") / vid
    resolucao = "1920,1080" if roteiro.get("formato") == "longo" else "1080,1920"

    for i, cena in enumerate(roteiro["cenas"]):
        if cena.get("tipo") != "manim":
            continue
        # o Manim não tem opção de cor de fundo na linha de comando: vai no próprio código
        estilos = json.loads(Path("src/estilos.json").read_text(encoding="utf-8"))
        fundo = roteiro.get("fundo_manim") or estilos.get(roteiro.get("estilo", ""), {}).get("fundo", "#18181b")
        codigo = f'from manim import *\nconfig.background_color = "{fundo}"\n\n' + cena["codigo"]
        # só volta a renderizar se o código mudou
        # (nos verticais a assinatura é a de sempre, para não voltar a renderizar o que já existe)
        assinatura = hashlib.sha1((codigo + ("" if resolucao == "1080,1920" else resolucao)).encode()).hexdigest()[:10]
        destino = pasta / f"manim-{i}.mp4"
        m = cena.get("midia") or {}
        if not forcar and destino.exists() and m.get("assinatura") == assinatura:
            continue

        trabalho.mkdir(parents=True, exist_ok=True)
        fonte = trabalho / f"cena_{i}.py"
        fonte.write_text(codigo, encoding="utf-8")
        print(f"  🧮 cena {i + 1}: a renderizar Manim…")
        r = renderizar(fonte, trabalho, i, resolucao)
        if r.returncode != 0:
            print(f"  ⚠ cena {i + 1}: o Manim falhou; a pedir ao Claude para corrigir o código…")
            novo = corrigir_com_claude(cena["codigo"], r.stderr or r.stdout or "")
            if novo:
                cabeca = codigo[: codigo.index(cena["codigo"])] if cena["codigo"] in codigo else f'from manim import *\nconfig.background_color = "{fundo}"\n\n'
                fonte.write_text(cabeca + novo, encoding="utf-8")
                r = renderizar(fonte, trabalho, i, resolucao)
                if r.returncode == 0:
                    cena["codigo"] = novo
                    assinatura = hashlib.sha1((cabeca + novo + ("" if resolucao == "1080,1920" else resolucao)).encode()).hexdigest()[:10]
                    print(f"  🔧 cena {i + 1}: código corrigido pelo Claude")
        gerados = sorted((trabalho / "media").rglob(f"manim-{i}.mp4"), key=lambda p: p.stat().st_mtime)
        if r.returncode != 0 or not gerados:
            print(f"  ⚠ cena {i + 1}: o Manim falhou\n{(r.stderr or r.stdout)[-1500:]}")
            continue
        shutil.copyfile(gerados[-1], destino)
        cena["midia"] = {"fonte": "arquivo", "consulta": f"videos/{vid}/{destino.name}", "arquivo": f"videos/{vid}/{destino.name}", "formato": "video", "assinatura": assinatura}
        print(f"  🧮 cena {i + 1}: {destino}")

    caminho.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
