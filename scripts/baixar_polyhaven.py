"""Descarrega os modelos 3D do Poly Haven (polyhaven.com, todos CC0: uso comercial livre, sem atribuição obrigatória)
para public/modelos/polyhaven/<id>/ em glTF com texturas 1k, e gera o catálogo src/lowpoly/polyhaven.json
(id, nome, categorias, etiquetas) e o guia .claude/skills/novo-video/modelos-polyhaven.md para o Claude escolher.

Uso: python scripts/baixar_polyhaven.py [--res 1k] [--so-catalogo]
Volta a correr sem problema: só descarrega o que falta.
"""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

API = "https://api.polyhaven.com"
CABECALHO = {"User-Agent": "studioware-catalogo/1.0"}
DESTINO = Path("public/modelos/polyhaven")
RES = sys.argv[sys.argv.index("--res") + 1] if "--res" in sys.argv else "1k"


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHO), timeout=60) as r:
        return json.load(r)


def baixar(url, caminho):
    if caminho.exists() and caminho.stat().st_size > 0:
        return 0
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".parcial")
    with urllib.request.urlopen(urllib.request.Request(url, headers=CABECALHO), timeout=120) as r, open(tmp, "wb") as f:
        while bloco := r.read(1 << 16):
            f.write(bloco)
    tmp.replace(caminho)
    return caminho.stat().st_size


def modelo(id_):
    """glTF + .bin + texturas de um modelo; devolve (id, bytes descarregados, ficheiro principal)."""
    ficheiros = get_json(f"{API}/files/{id_}")
    g = (ficheiros.get("gltf") or {}).get(RES) or next(iter((ficheiros.get("gltf") or {}).values()), None)
    if not g or "gltf" not in g:
        raise LookupError("sem glTF")
    principal = g["gltf"]
    pasta = DESTINO / id_
    total = baixar(principal["url"], pasta / Path(principal["url"]).name)
    for rel, info in (principal.get("include") or {}).items():
        total += baixar(info["url"], pasta / rel)
    return id_, total, f"modelos/polyhaven/{id_}/{Path(principal['url']).name}"


def main():
    assets = get_json(f"{API}/assets?t=models")
    catalogo = {}
    if "--so-catalogo" not in sys.argv:
        feitos, total, falhas = 0, 0, []
        with ThreadPoolExecutor(max_workers=6) as ex:
            futuros = {ex.submit(modelo, i): i for i in assets}
            for fut in as_completed(futuros):
                i = futuros[fut]
                try:
                    _, b, arquivo = fut.result()
                    total += b
                    catalogo[i] = arquivo
                except Exception as e:  # um modelo que falha não para os outros
                    falhas.append(f"{i}: {e}")
                feitos += 1
                if feitos % 20 == 0 or feitos == len(assets):
                    print(f"{feitos}/{len(assets)} modelos ({total / 1e6:.0f} MB novos)", flush=True)
        if falhas:
            print("falharam:", *falhas, sep="\n  ")
    else:
        for i in assets:
            g = next(DESTINO.joinpath(i).glob("*.gltf"), None) if DESTINO.joinpath(i).exists() else None
            if g:
                catalogo[i] = f"modelos/polyhaven/{i}/{g.name}"

    # catálogo para o motor e guia para o Claude (só os que estão no disco)
    lista = {
        i: {"arquivo": catalogo[i], "nome": a.get("name", i), "categorias": [c for c in a.get("categories", []) if not c.startswith("collection")], "tags": a.get("tags", [])[:8]}
        for i, a in sorted(assets.items()) if i in catalogo
    }
    Path("src/lowpoly/polyhaven.json").write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding="utf-8")
    por_cat = {}
    for i, a in lista.items():
        por_cat.setdefault((a["categorias"] or ["outros"])[0], []).append(f"`{i}` ({a['nome']}; {', '.join(a['tags'][:5])})")
    linhas = ["# Modelos 3D realistas (Poly Haven, CC0)", "",
              f"{len(lista)} modelos realistas com textura, já no projeto. Use o id em `{{\"fonte\": \"polyhaven\", \"modelo\": \"<id>\"}}`.", ""]
    for cat in sorted(por_cat):
        linhas += [f"## {cat}", "", "; ".join(por_cat[cat]), ""]
    Path(".claude/skills/novo-video/modelos-polyhaven.md").write_text("\n".join(linhas), encoding="utf-8")
    print(f"✔ catálogo: {len(lista)} modelos -> src/lowpoly/polyhaven.json e modelos-polyhaven.md")


if __name__ == "__main__":
    main()
