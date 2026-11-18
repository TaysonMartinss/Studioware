"""Biblioteca de anatomia e saúde em 3D (para vídeos de saúde): coração, cérebro, órgãos, esqueleto, corpo, DNA...

Modelos leves (até ~25 mil faces) do Sketchfab, todos com licença que permite uso comercial (CC BY ou Standard),
escolhidos à mão. Ficam em public/modelos3d/ (fora do git) e o catálogo com os créditos em src/lowpoly/anatomia.json.
Os CC BY pedem crédito: o estúdio põe o "credito" de cada modelo na descrição do vídeo.

    python scripts/baixar_anatomia.py          (precisa do token do Sketchfab em Chaves de API)
    python scripts/baixar_anatomia.py --miniaturas   (só as miniaturas da galeria do painel)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from buscar_midia import sketchfab_descarregar  # noqa: E402

# id: (uid do Sketchfab, nome em PT, etiquetas para a pesquisa)
MODELOS = {
    "coracao": ("adb2c91ec8194b24b7ba431aa573a906", "Coração humano", ["coração", "heart", "cardíaco", "coração anatómico", "sangue", "cardio"]),
    "cerebro": ("735ca31a3b22433281e6fa9606792faa", "Cérebro", ["cérebro", "brain", "mente", "neurónios", "memória", "cabeça"]),
    "torso_orgaos": ("558d4428da7c4aea9373f62be6f9a98f", "Torso com órgãos", ["órgãos", "pulmões", "lungs", "torso", "anatomia", "estômago", "coração", "corpo por dentro"]),
    "esqueleto": ("9210377c7a514cf6b48a31b9d3991ff3", "Esqueleto", ["esqueleto", "skeleton", "ossos", "bones", "osso", "coluna"]),
    "corpo": ("15a422001834483c9750ce6117d59cc1", "Corpo humano", ["corpo", "body", "humano", "homem", "postura", "silhueta"]),
    "estomago": ("29b78b9373c943a8bb6c5c2cf4592967", "Estômago", ["estômago", "stomach", "digestão", "intestino", "barriga", "gastrite"]),
    "rim": ("2417146cf20a49b5960c79d554d20650", "Rim", ["rim", "rins", "kidney", "urina", "renal"]),
    "dna": ("e3f82ab0c50a490bbace8d5ccc4698b8", "DNA", ["dna", "genética", "gene", "hélice", "hereditário"]),
    "olho": ("281784b8e6ff4713991cdee224f07b09", "Olho", ["olho", "eye", "visão", "globo ocular", "vista"]),
    "musculos": ("244061a0323b4d2e9c60d9aba374c937", "Corpo com músculos", ["músculo", "músculos", "muscle", "academia", "treino", "hipertrofia"]),
    "globulos": ("657f7b34ab2e43878c4f366e3e940ebd", "Glóbulos vermelhos", ["glóbulos", "sangue", "hemácias", "blood", "anemia", "ferro"]),
    "comprimido": ("4892b8f61b0c4b27a65b0dfd489d6af5", "Comprimido", ["comprimido", "remédio", "pill", "cápsula", "medicamento", "suplemento"]),
    "seringa": ("1de7893db91c4cf8822ff10ee999cd67", "Seringa", ["seringa", "vacina", "injeção", "syringe", "agulha"]),
    # álcool: o que acontece no corpo de quem bebe todos os dias
    "figado": ("ffa6a425ecb04b229542a66d8df21e90", "Fígado", ["fígado", "liver", "hepático", "álcool", "metabolismo", "desintoxicar"]),
    "figado_cirrose": ("365058448acc40cbb235301c7d723d09", "Fígado com cirrose", ["cirrose", "fígado doente", "fígado gordo", "cirrhosis", "álcool", "hepatite"]),
    "pancreas": ("f7b30e11b5df445fbdfe0e262e777c85", "Pâncreas", ["pâncreas", "pancreas", "pancreatite", "insulina", "diabetes", "álcool"]),
    "garrafa_gin": ("a4bc1a56710346bc856fdf7d73e9be4b", "Garrafa de gin", ["gin", "garrafa", "bottle", "bebida", "álcool", "destilado"]),
    "garrafa_gin_rosa": ("c7ace0b0d679475f912df43fc6f7158f", "Garrafa de gin rosa", ["gin rosa", "garrafa", "bebida", "álcool", "barato"]),
    "copo_drink": ("7669b27d4e634e7b9cd114d50c33af97", "Copo de drink com gelo", ["copo", "drink", "gin tônica", "gelo", "palhinha", "bebida"]),
    # (o "copo baixo com gelo" cfc874cf… saía como um bloco branco: o vidro e o gelo não renderizam)
    "copo_alto": ("f978e6f36d5040a89053029bbad94b62", "Copo alto", ["copo", "copo alto", "dose", "gelo", "bebida", "glass"]),
    "garrafas_lowpoly": ("99999f032f624e8cb05651f041dbf8eb", "Garrafas low poly", ["garrafas", "bebida", "álcool", "low poly", "bar", "destilado"]),
}


def miniaturas():
    """Miniatura de cada modelo (a do Sketchfab, 256 px) para a galeria do campo Objeto no painel.
    Ficam em public/modelos3d/miniaturas/, fora do git como os próprios modelos."""
    import urllib.request
    pasta = Path("public/modelos3d/miniaturas")
    pasta.mkdir(parents=True, exist_ok=True)
    for chave, (uid, _, _) in MODELOS.items():
        destino = pasta / f"anatomia-{chave}.jpg"
        if destino.exists():
            continue
        try:
            req = urllib.request.Request(f"https://api.sketchfab.com/v3/models/{uid}", headers={"User-Agent": "Studioware"})
            with urllib.request.urlopen(req, timeout=30) as r:
                imagens = json.loads(r.read())["thumbnails"]["images"]
            img = min((i for i in imagens if i["width"] >= 256), key=lambda i: i["width"], default=imagens[0])
            with urllib.request.urlopen(urllib.request.Request(img["url"], headers={"User-Agent": "Studioware"}), timeout=30) as r:
                destino.write_bytes(r.read())
            print(f"  ✔ miniatura {chave}")
        except Exception as e:
            print(f"  ✘ miniatura {chave}: {e}")


def main():
    if "--miniaturas" in sys.argv:
        return miniaturas()
    catalogo = {}
    for chave, (uid, nome, tags) in MODELOS.items():
        m = {"fonte": "sketchfab", "consulta": f"uid:{uid}"}
        try:
            sketchfab_descarregar(m, None, 0, None)
        except Exception as e:  # um modelo que falhe não impede os outros
            print(f"  ✘ {chave}: {e}")
            continue
        catalogo[chave] = {"arquivo": m["arquivo"], "nome": nome, "tags": tags, "credito": m["credito"], "fonte": m["sketchfab"]["url"]}
        print(f"  ✔ {chave}: {m['arquivo']}")
    Path("src/lowpoly/anatomia.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(catalogo)} de {len(MODELOS)} modelos em src/lowpoly/anatomia.json")
    miniaturas()


if __name__ == "__main__":
    main()
