"""Descarrega as imagens/b-rolls reais pedidos no roteiro (campo "midia" de cada cena) e grava o caminho no próprio roteiro.

Fontes:
  steam      screenshots e trailers oficiais da página do jogo na Steam (consulta = nome do jogo)
  wikimedia  fotos livres do Wikimedia Commons (consoles antigos, hardware, eventos, pessoas)
  pixabay    fotos e vídeos de stock (precisa de PIXABAY_API_KEY no .env; grátis em pixabay.com/api/docs)
  pexels     nome antigo do stock: os roteiros antigos passam a usar o Pixabay (o Pexels só se ainda houver chave)
  url        link direto para uma imagem, um vídeo ou um modelo 3D .glb (ex.: foto oficial do fabricante)
  sketchfab  modelo 3D a girar como mídia de qualquer cena (consulta = termo em inglês ou uid:XXXX; só licenças comerciais)
  procedural modelo 3D desenhado pelo estúdio, sem ficheiro (consulta = gpu | cpu | ram | ssd)
  arquivo    ficheiro que já está em public/ (consulta = caminho; .glb vira modelo 3D)

Uso: python scripts/buscar_midia.py roteiros/x.json [--cena N] [--forcar]
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

UA = "FabricaDeShorts/1.0 (uso pessoal; gerador local de videos)"
LIMITE = {"imagem": 15 * 2**20, "video": 90 * 2**20}
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm"}


def chave(nome):
    if os.environ.get(nome):
        return os.environ[nome]
    env = Path(".env")
    if env.exists():
        for linha in env.read_text(encoding="utf-8").splitlines():
            if linha.startswith(f"{nome}="):
                return linha.split("=", 1)[1].strip()
    return None


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def descarregar(url, destino_sem_ext):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        tipo = r.headers.get("Content-Type", "").split(";")[0].strip().lower()
        if tipo not in EXT:
            raise ValueError(f"tipo de ficheiro não suportado: {tipo or 'desconhecido'}")
        formato = "video" if tipo.startswith("video/") else "imagem"
        dados = r.read(LIMITE[formato] + 1)
        if len(dados) > LIMITE[formato]:
            raise ValueError("ficheiro demasiado grande")
    destino = destino_sem_ext.with_suffix(EXT[tipo])
    destino.write_bytes(dados)
    return destino, formato


def descarregar_hls(master, destino_sem_ext, segundos=36):
    # Trailers da Steam vêm em HLS com segmentos fMP4: init + segmentos concatenados formam um MP4 fragmentado válido.
    # Só o vídeo (b-roll é mudo), na variante 720p, e só os primeiros ~36 s.
    ler = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read()
    base = master.rsplit("/", 1)[0] + "/"
    linhas = ler(master).decode().splitlines()
    variantes = [(linhas[i], linhas[i + 1]) for i in range(len(linhas) - 1) if linhas[i].startswith("#EXT-X-STREAM-INF")]
    escolhida = next((v for info, v in variantes if "x720" in info), variantes[0][1])
    playlist = ler(base + escolhida).decode().splitlines()
    init = next(l.split('URI="')[1].rstrip('"') for l in playlist if l.startswith("#EXT-X-MAP"))
    partes, total, dur = [ler(base + init)], 0.0, 0.0
    for l in playlist:
        if l.startswith("#EXTINF:"):
            dur = float(l[8:].split(",")[0])
        elif l and not l.startswith("#"):
            if total >= segundos:
                break
            partes.append(ler(base + l))
            total += dur
    destino = destino_sem_ext.with_suffix(".mp4")
    destino.write_bytes(b"".join(partes))
    return destino, total


def de_steam(m):
    busca = get_json("https://store.steampowered.com/api/storesearch/?" + urllib.parse.urlencode({"term": m["consulta"], "l": "english", "cc": "BR"}))
    if not busca.get("items"):
        raise LookupError(f"jogo não encontrado na Steam: {m['consulta']}")
    app = busca["items"][0]
    dados = get_json(f"https://store.steampowered.com/api/appdetails?appids={app['id']}")[str(app["id"])]["data"]
    credito = f"{app['name']} / Steam"
    if m.get("tipo") == "video":
        trailers = [t for t in dados.get("movies", []) if t.get("hls_h264") or t.get("mp4", {}).get("max")]
        if trailers:
            t = trailers[min(m.get("indice", 0), len(trailers) - 1)]
            url = "hls:" + t["hls_h264"] if t.get("hls_h264") else t["mp4"]["max"]
            return url, credito, {"inicioS": 6}  # salta os logos do início
    fotos = dados.get("screenshots", [])
    if not fotos:
        raise LookupError("o jogo não tem screenshots")
    return fotos[min(m.get("indice", 0), len(fotos) - 1)]["path_full"], credito, {}


def de_wikimedia(m):
    r = get_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 10,
        "gsrsearch": f"{m['consulta']} filetype:bitmap", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 1400,
    }))
    paginas = sorted(r.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    if not paginas:
        raise LookupError(f"nada no Wikimedia Commons para: {m['consulta']}")
    info = paginas[min(m.get("indice", 0), len(paginas) - 1)]["imageinfo"][0]
    return info.get("thumburl") or info["url"], "Wikimedia Commons", {}


# vídeos longos (16:9) pedem stock na horizontal; o resto é vertical
HORIZONTAL = False


def de_pexels(m):
    k = chave("PEXELS_API_KEY")
    if not k:
        raise LookupError("falta PEXELS_API_KEY (defina no painel)")
    q = urllib.parse.urlencode({"query": m["consulta"], "orientation": "landscape" if HORIZONTAL else "portrait", "per_page": 10})
    if m.get("tipo") == "video":
        vids = get_json(f"https://api.pexels.com/videos/search?{q}", {"Authorization": k}).get("videos", [])
        if not vids:
            raise LookupError(f"nenhum vídeo no Pexels para: {m['consulta']}")
        v = vids[min(m.get("indice", 0), len(vids) - 1)]
        mp4s = [f for f in v["video_files"] if f.get("file_type") == "video/mp4" and f.get("height") and f.get("width")]
        # o lado maior mais próximo de 1920, sem passar muito (ficheiros 4K são enormes)
        lado = (lambda f: f["width"]) if HORIZONTAL else (lambda f: f["height"])
        melhor = min(mp4s, key=lambda f: abs(lado(f) - 1920) + (5000 if lado(f) > 2200 else 0))
        return melhor["link"], f"Pexels / {v['user']['name']}", {"duracaoS": v.get("duration")}
    fotos = get_json(f"https://api.pexels.com/v1/search?{q}", {"Authorization": k}).get("photos", [])
    if not fotos:
        raise LookupError(f"nenhuma foto no Pexels para: {m['consulta']}")
    p = fotos[min(m.get("indice", 0), len(fotos) - 1)]
    return p["src"]["large2x"], f"Pexels / {p['photographer']}", {}


def de_pixabay(m):
    k = chave("PIXABAY_API_KEY")
    if not k:
        raise LookupError("falta PIXABAY_API_KEY (defina em Chaves de API no painel)")
    consulta = m["consulta"][:100]
    if m.get("tipo") == "video":
        q = urllib.parse.urlencode({"key": k, "q": consulta, "per_page": 30, "safesearch": "true"})
        vids = get_json(f"https://pixabay.com/api/videos/?{q}").get("hits", [])
        if not vids:
            raise LookupError(f"nenhum vídeo no Pixabay para: {consulta}")
        # a API de vídeos não filtra a orientação: as que já têm a orientação certa vêm primeiro
        certos = [v for v in vids if (v["videos"]["medium"]["width"] > v["videos"]["medium"]["height"]) == HORIZONTAL]
        v = (certos or vids)[min(m.get("indice", 0), len(certos or vids) - 1)]
        variantes = [f for f in v["videos"].values() if f.get("url") and f.get("width")]
        lado = (lambda f: f["width"]) if HORIZONTAL else (lambda f: max(f["width"], f["height"]))
        melhor = min(variantes, key=lambda f: abs(lado(f) - 1920) + (5000 if lado(f) > 2200 else 0))
        return melhor["url"], f"Pixabay / {v.get('user', '')}", {"duracaoS": v.get("duration")}
    q = urllib.parse.urlencode({"key": k, "q": consulta, "image_type": "photo", "orientation": "horizontal" if HORIZONTAL else "vertical", "per_page": 30, "safesearch": "true"})
    fotos = get_json(f"https://pixabay.com/api/?{q}").get("hits", [])
    if not fotos:  # poucas fotos verticais para termos raros: aceita qualquer orientação (o corte em cover resolve)
        fotos = get_json("https://pixabay.com/api/?" + urllib.parse.urlencode({"key": k, "q": consulta, "image_type": "photo", "per_page": 30, "safesearch": "true"})).get("hits", [])
    if not fotos:
        raise LookupError(f"nenhuma foto no Pixabay para: {consulta}")
    p = fotos[min(m.get("indice", 0), len(fotos) - 1)]
    return p["largeImageURL"], f"Pixabay / {p.get('user', '')}", {}


def de_stock(m):
    # "pexels" nos roteiros antigos: o Pixabay substitui-o; o Pexels só entra se ainda houver chave
    if chave("PIXABAY_API_KEY") or not chave("PEXELS_API_KEY"):
        return de_pixabay(m)
    return de_pexels(m)


FONTES = {"steam": de_steam, "wikimedia": de_wikimedia, "pixabay": de_pixabay, "pexels": de_stock, "url": lambda m: (m["consulta"], None, {})}
FORMATOS_3D = ("sketchfab", "procedural")
PROCEDURAIS = ("gpu", "cpu", "ram", "ssd")


def e_modelo(m):
    consulta = (m.get("consulta") or "").lower().split("?")[0]
    return m["fonte"] in FORMATOS_3D or m.get("tipo") == "modelo3d" or (m["fonte"] in ("url", "arquivo") and consulta.endswith(".glb"))


def resolver(m, pasta, i, vid):
    for campo in ("arquivo", "formato", "duracaoS", "inicioS", "credito", "sketchfab"):
        m.pop(campo, None)
    if e_modelo(m):
        # modelo 3D como mídia: o Remotion desenha-o a girar no lugar da foto ou do vídeo
        if m["fonte"] == "procedural":
            if m.get("consulta") not in PROCEDURAIS:
                raise LookupError(f"modelo procedural desconhecido: {m.get('consulta')} (use {', '.join(PROCEDURAIS)})")
            m["arquivo"] = f"procedural:{m['consulta']}"
        else:
            resolver_modelo(m, pasta, f"midia-{i}", vid)
        m["formato"] = "modelo3d"
        return
    if m["fonte"] == "arquivo":
        caminho = Path("public") / m["consulta"]
        if not caminho.exists():
            raise LookupError(f"não existe public/{m['consulta']}")
        m["arquivo"] = m["consulta"]
        m["formato"] = "video" if caminho.suffix.lower() in (".mp4", ".webm", ".mov") else "imagem"
        return
    url, credito, extra = FONTES[m["fonte"]](m)
    for antigo in pasta.glob(f"midia-{i}.*"):
        antigo.unlink()
    if url.startswith("hls:"):
        destino, extra["duracaoS"] = descarregar_hls(url[4:], pasta / f"midia-{i}")
        formato = "video"
    else:
        destino, formato = descarregar(url, pasta / f"midia-{i}")
    m.update({"arquivo": f"videos/{vid}/{destino.name}", "formato": formato, **{k: v for k, v in extra.items() if v}})
    if credito:
        m["credito"] = credito


# Sketchfab: só licenças que permitem uso comercial (o canal é monetizado) e sem "no derivatives"
LICENCAS_NAO = ("NonCommercial", "NoDerivs", "Editorial")
GLB_MAX = 40 * 2**20  # modelos maiores pesam demais no render
FACES_MAX = 600_000


def sketchfab_pesquisar(termo, quantos=24):
    q = urllib.parse.urlencode({"type": "models", "q": termo, "downloadable": "true", "count": quantos, "sort_by": "-likeCount"})
    resultados = get_json(f"https://api.sketchfab.com/v3/search?{q}").get("results", [])
    validos = []
    for r in resultados:
        licenca = (r.get("license") or {}).get("label", "")
        glb = ((r.get("archives") or {}).get("glb") or {}).get("size") or 0
        if any(x in licenca for x in LICENCAS_NAO) or not glb or glb > GLB_MAX or (r.get("faceCount") or 0) > FACES_MAX:
            continue
        imagens = sorted((r.get("thumbnails") or {}).get("images", []), key=lambda im: abs(im.get("width", 0) - 360))
        validos.append({
            "uid": r["uid"], "nome": r["name"], "autor": (r.get("user") or {}).get("displayName", ""), "licenca": licenca,
            "url": r.get("viewerUrl"), "tamanhoMB": round(glb / 2**20, 1), "faces": r.get("faceCount"),
            "thumb": imagens[0]["url"] if imagens else None,
        })
    return validos


def sketchfab_descarregar(m, pasta, i, vid):
    token = chave("SKETCHFAB_API_TOKEN")
    if not token:
        raise LookupError("falta o token do Sketchfab (defina em Chaves de API no painel)")
    consulta = m["consulta"]
    if consulta.startswith("uid:"):
        uid = consulta[4:]
        info = get_json(f"https://api.sketchfab.com/v3/models/{uid}")
        escolhido = {"uid": uid, "nome": info["name"], "autor": info["user"]["displayName"], "licenca": (info.get("license") or {}).get("label", ""), "url": info.get("viewerUrl")}
        if any(x in escolhido["licenca"] for x in LICENCAS_NAO):
            raise ValueError(f"licença '{escolhido['licenca']}' não permite uso comercial")
    else:
        opcoes = sketchfab_pesquisar(consulta)
        if not opcoes:
            raise LookupError(f"nenhum modelo com licença comercial para '{consulta}'")
        escolhido = opcoes[min(m.get("indice", 0), len(opcoes) - 1)]
    # cada modelo é descarregado uma vez e partilhado por todas as cenas e vídeos
    destino = Path("public/modelos3d") / f"sketchfab-{escolhido['uid']}.glb"
    if not destino.exists():
        links = get_json(f"https://api.sketchfab.com/v3/models/{escolhido['uid']}/download", {"Authorization": f"Token {token}"})
        if not links.get("glb"):
            raise LookupError("este modelo não tem versão GLB para descarregar")
        req = urllib.request.Request(links["glb"]["url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=300) as r:
            dados = r.read(GLB_MAX + 1)
        if dados[:4] != b"glTF":
            raise ValueError("o ficheiro descarregado não é um GLB")
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(dados)
    m["arquivo"] = destino.relative_to("public").as_posix()
    m["sketchfab"] = escolhido
    # crédito pronto a usar (CC BY exige atribuição)
    m["credito"] = f"Modelo 3D: {escolhido['nome']} por {escolhido['autor']} (Sketchfab, {escolhido['licenca']})"


def resolver_modelo(m, pasta, i, vid):
    """Modelo 3D: ficheiro em public/, link direto para um .glb ou pesquisa no Sketchfab."""
    for campo in ("arquivo",):
        m.pop(campo, None)
    if m.get("fonte", "arquivo") == "arquivo":
        if not (Path("public") / m["consulta"]).exists():
            raise LookupError(f"não existe public/{m['consulta']}")
        m["arquivo"] = m["consulta"]
        return
    if m["fonte"] == "sketchfab":
        return sketchfab_descarregar(m, pasta, i, vid)
    req = urllib.request.Request(m["consulta"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        dados = r.read(80 * 2**20 + 1)
    if len(dados) > 80 * 2**20:
        raise ValueError("modelo demasiado grande (máx. 80 MB)")
    if dados[:4] != b"glTF":
        raise ValueError("o link não é um ficheiro .glb (glTF binário)")
    destino = pasta / f"modelo-{i}.glb"
    destino.write_bytes(dados)
    m["arquivo"] = f"videos/{vid}/{destino.name}"


def main():
    args = sys.argv[1:]
    if args and args[0] == "--sketchfab":
        # usado pelo painel para a pesquisa visual: imprime os resultados em JSON
        print(json.dumps(sketchfab_pesquisar(" ".join(args[1:])), ensure_ascii=False))
        return
    caminho = Path(args[0])
    so_cena = int(args[args.index("--cena") + 1]) if "--cena" in args else None
    forcar = "--forcar" in args or so_cena is not None

    roteiro = json.loads(caminho.read_text(encoding="utf-8"))
    global HORIZONTAL
    HORIZONTAL = roteiro.get("formato") == "longo"
    vid = roteiro["id"]
    pasta = Path("public/videos") / vid
    pasta.mkdir(parents=True, exist_ok=True)

    for i, cena in enumerate(roteiro["cenas"]):
        if so_cena is not None and i != so_cena:
            continue
        # além de cena.midia: os dois lados de uma comparação e os b-rolls de um clipe
        midias = [(str(i), cena.get("midia"))]
        midias += [(f"{i}-{lado}", (cena.get(lado) or {}).get("midia")) for lado in ("esquerda", "direita")]
        midias += [(f"{i}-b{k}", b.get("midia")) for k, b in enumerate(cena.get("broll") or [])]
        midias += [(f"{i}-o", cena.get("objeto"))]  # objeto da tipografia editorial
        modelo = cena.get("modelo")
        if modelo and modelo.get("consulta") and (forcar or not modelo.get("arquivo") or not (Path("public") / modelo["arquivo"]).exists()):
            try:
                resolver_modelo(modelo, pasta, i, vid)
                print(f"  🧊 cena {i + 1}: modelo 3D -> {modelo['arquivo']}")
            except Exception as e:  # sem ficheiro, a cena usa o modelo procedural
                print(f"  ⚠ cena {i + 1}: sem modelo 3D ({modelo.get('consulta')}): {e}")
        for nome, m in midias:
            if not m or (not forcar and m.get("arquivo") and (Path("public") / m["arquivo"]).exists()):
                continue
            try:
                resolver(m, pasta, nome, vid)
                print(f"  🖼 cena {i + 1}: {m['fonte']} '{m.get('consulta')}' -> {m['arquivo']}")
            except Exception as e:  # sem mídia a cena usa o visual gráfico; não para o vídeo
                print(f"  ⚠ cena {i + 1}: sem mídia ({m['fonte']} '{m.get('consulta')}'): {e}")

    caminho.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
