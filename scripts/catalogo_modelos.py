"""Catálogo dos modelos low poly em public/modelos/<fonte>/<pack>/*.glb.

Lê o JSON de cada GLB (sem dependências), calcula a caixa do modelo com as transformações dos nós e escreve:
  - src/lowpoly/modelos.json: { "pack/nome": [largura, altura, profundidade] } em unidades do ficheiro
    (o motor usa-o para enquadrar a câmara antes de o modelo carregar)
  - .claude/skills/novo-video/modelos-lowpoly.md: a lista de nomes por pack, para o roteirista escolher

Correr de novo depois de juntar packs:  python scripts/catalogo_modelos.py
"""
import json
import math
import struct
from pathlib import Path

RAIZ = Path("public/modelos")


def mat_mult(a, b):
    return [sum(a[r * 4 + k] * b[k * 4 + c] for k in range(4)) for r in range(4) for c in range(4)]


def mat_no(no):
    # glTF guarda as matrizes em coluna; aqui trabalho em linhas (transposta)
    if "matrix" in no:
        m = no["matrix"]
        return [m[c * 4 + r] for r in range(4) for c in range(4)]
    tx, ty, tz = no.get("translation", [0, 0, 0])
    qx, qy, qz, qw = no.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = no.get("scale", [1, 1, 1])
    r = [
        1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw),
        2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw),
        2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy),
    ]
    return [r[0] * sx, r[1] * sy, r[2] * sz, tx, r[3] * sx, r[4] * sy, r[5] * sz, ty, r[6] * sx, r[7] * sy, r[8] * sz, tz, 0, 0, 0, 1]


def caixa(glb: Path):
    dados = glb.read_bytes()
    if dados[:4] != b"glTF":
        return None
    tam = struct.unpack_from("<I", dados, 12)[0]
    g = json.loads(dados[20:20 + tam])
    acc = g.get("accessors", [])
    mn = [math.inf] * 3
    mx = [-math.inf] * 3

    def visitar(i, pai):
        no = g["nodes"][i]
        m = mat_mult(pai, mat_no(no))
        if "mesh" in no:
            for prim in g["meshes"][no["mesh"]]["primitives"]:
                a = acc[prim["attributes"]["POSITION"]]
                lo, hi = a.get("min"), a.get("max")
                if not lo:
                    continue
                for cx in (lo[0], hi[0]):
                    for cy in (lo[1], hi[1]):
                        for cz in (lo[2], hi[2]):
                            p = [m[r * 4] * cx + m[r * 4 + 1] * cy + m[r * 4 + 2] * cz + m[r * 4 + 3] for r in range(3)]
                            for k in range(3):
                                mn[k] = min(mn[k], p[k]); mx[k] = max(mx[k], p[k])
        for f in no.get("children", []):
            visitar(f, m)

    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    cena = g.get("scenes", [{}])[g.get("scene", 0)]
    for i in cena.get("nodes", []):
        visitar(i, ident)
    if mn[0] == math.inf:
        return None
    return [round(mx[k] - mn[k], 3) for k in range(3)]


def main():
    catalogo, por_pack = {}, {}
    for glb in sorted(RAIZ.glob("*/*/*.glb")):
        pack = glb.parent.name
        dims = caixa(glb)
        if not dims or max(dims) <= 0:
            continue
        catalogo[f"{pack}/{glb.stem}"] = dims
        por_pack.setdefault(f"{glb.parent.parent.name}/{pack}", []).append(glb.stem)
    Path("src/lowpoly/modelos.json").write_text(json.dumps(catalogo, separators=(",", ":")), encoding="utf-8")
    linhas = [
        "# Modelos low poly (objeto `modelo` da cena lowpoly)",
        "",
        "Todos CC0 (uso comercial livre, sem crédito obrigatório). Use `\"modelo\": \"pack/nome\"` (ou só o nome, ou palavras",
        "parecidas: o motor procura o mais próximo). Lista gerada por `scripts/catalogo_modelos.py`.",
        "",
    ]
    for chave, nomes in sorted(por_pack.items()):
        pack = chave.split("/")[1]
        linhas.append(f"## {pack} ({len(nomes)})")
        linhas.append(", ".join(nomes))
        linhas.append("")
    Path(".claude/skills/novo-video/modelos-lowpoly.md").write_text("\n".join(linhas), encoding="utf-8")
    print(len(catalogo), "modelos em", len(por_pack), "packs")


if __name__ == "__main__":
    main()
