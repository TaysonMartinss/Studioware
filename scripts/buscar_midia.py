"""Descarrega as imagens/b-rolls reais pedidos no roteiro (campo "midia" de cada cena) e grava o caminho no próprio roteiro.

Fontes:
  steam      screenshots e trailers oficiais da página do jogo na Steam (consulta = nome do jogo)
  wikimedia  fotos livres do Wikimedia Commons (consoles antigos, hardware, eventos, pessoas)
  pixabay    fotos e vídeos de stock (precisa de PIXABAY_API_KEY no .env; grátis em pixabay.com/api/docs)
  pexels     nome antigo do stock: os roteiros antigos passam a usar o Pixabay (o Pexels só se ainda houver chave)
  url        link direto para uma imagem, um vídeo ou um modelo 3D .glb, ou link de YouTube/Instagram/TikTok/X
             (baixado pelo yt-dlp: 40 s a partir do ?t= do link)
  sketchfab  modelo 3D a girar como mídia de qualquer cena (consulta = termo em inglês ou uid:XXXX; só licenças comerciais)
  anatomia   modelo 3D de saúde já no projeto: coração, cérebro, órgãos, esqueleto, corpo, DNA... (modelo = id do catálogo)
  emoji      material 2D: emoji 3D da Microsoft com fundo transparente (consulta = "brain", "light bulb", "lâmpada"...)
  cs2        skin ou faca do Counter-Strike 2 com fundo transparente (consulta = "AK-47 | Redline", "Karambit Doppler")
  procedural modelo 3D desenhado pelo estúdio, sem ficheiro (consulta = gpu | cpu | ram | ssd)
  arquivo    ficheiro que já está em public/ (consulta = caminho; .glb vira modelo 3D)

Uso: python scripts/buscar_midia.py roteiros/x.json [--cena N] [--forcar]
"""
import json
import os
import re
import shutil
import subprocess
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


# Emojis 3D da Microsoft (Fluent Emoji, licença MIT): imagens isoladas com fundo transparente, boas como material 2D
# (cérebro, lâmpada acesa, faca, coração, comprimido...). consulta = nome em inglês do emoji ("brain", "light bulb")
# ou um dos nomes em português abaixo.
EMOJI_PT = {
    "cérebro": "brain", "cerebro": "brain", "lâmpada": "light bulb", "lampada": "light bulb", "ideia": "light bulb", "faca": "kitchen knife",
    "punhal": "dagger", "coração": "anatomical heart", "coracao": "anatomical heart", "pulmões": "lungs", "pulmoes": "lungs", "osso": "bone",
    "dente": "tooth", "comprimido": "pill", "remédio": "pill", "seringa": "syringe", "vacina": "syringe", "dna": "dna", "vírus": "microbe",
    "virus": "microbe", "bactéria": "microbe", "sangue": "drop of blood", "estetoscópio": "stethoscope", "raio x": "x-ray", "olho": "eye",
    "músculo": "flexed biceps", "musculo": "flexed biceps", "hospital": "hospital", "termómetro": "thermometer", "termometro": "thermometer",
    "fogo": "fire", "dinheiro": "money bag", "troféu": "trophy", "trofeu": "trophy", "foguete": "rocket", "alerta": "warning", "relógio": "alarm clock",
    "gin": "cocktail glass", "drink": "cocktail glass", "dose": "tumbler glass", "copo": "tumbler glass", "brinde": "clinking glasses",
    "bêbado": "woozy face", "bebado": "woozy face", "ressaca": "face with spiral eyes", "tontura": "face with spiral eyes", "enjoo": "nauseated face",
    "vómito": "face vomiting", "vomito": "face vomiting", "gelo": "ice", "limão": "lemon", "limao": "lemon", "vinho": "wine glass",
    "calendário": "calendar", "calendario": "calendar", "ambulância": "ambulance", "ambulancia": "ambulance", "proibido": "prohibited",
    "maçã": "red apple", "maca": "red apple", "água": "droplet", "agua": "droplet", "sono": "zzz", "cama": "bed", "caveira": "skull",
}


def de_emoji(m):
    nome = (m.get("consulta") or "").strip().lower()
    nome = EMOJI_PT.get(nome, nome)
    pasta = urllib.parse.quote(nome[:1].upper() + nome[1:])
    base = "_".join(nome.replace("-", " ").split())
    raiz = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
    # os emojis com tom de pele têm uma pasta "Default" pelo meio
    for url in (f"{raiz}/{pasta}/3D/{base}_3d.png", f"{raiz}/{pasta}/Default/3D/{base}_3d_default.png"):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA}), timeout=20):
                return url, None, {}
        except Exception:
            continue
    raise LookupError(f"emoji não encontrado: {m.get('consulta')} (use o nome em inglês do Fluent Emoji, ex. 'brain', 'light bulb')")


# Skins e facas do Counter-Strike 2: catálogo aberto do CSGO-API (github.com/ByMykel/CSGO-API, MIT) com as imagens
# oficiais da Steam (PNG transparente). consulta = nome da skin ("AK-47 | Redline", "Karambit Doppler"). As imagens
# são da Valve: servem para os vídeos do canal (política de vídeo da Valve), não entram no git.
CS2_CACHE = Path("out/cache/cs2-skins.json")


def cs2_catalogo():
    import time
    if not CS2_CACHE.exists() or time.time() - CS2_CACHE.stat().st_mtime > 7 * 86400:
        CS2_CACHE.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            CS2_CACHE.write_bytes(r.read())
    return json.loads(CS2_CACHE.read_text(encoding="utf-8"))


def de_cs2(m):
    pedido = (m.get("consulta") or "").lower().replace("★", "").replace("|", " ")
    termos = pedido.split()
    if not termos:
        raise LookupError("diga o nome da skin (ex.: 'AK-47 | Redline')")
    def pontos(s):
        nome = s["name"].lower().replace("★", "").replace("|", " ")
        exato = " ".join(nome.split()) == " ".join(termos)
        return (exato, sum(t in nome.split() or t in nome for t in termos), -len(nome))
    melhor = max(cs2_catalogo(), key=pontos)
    if pontos(melhor)[1] < max(1, len(termos) - 1):
        raise LookupError(f"skin não encontrada: {m.get('consulta')}")
    m["nome"] = melhor["name"]
    return melhor["image"], None, {"raridade": (melhor.get("rarity") or {}).get("name"), "corRaridade": (melhor.get("rarity") or {}).get("color")}


# Anatomia e saúde em 3D (python scripts/baixar_anatomia.py): modelo = id do catálogo ou uma palavra ("coração", "ossos")
def de_anatomia(m):
    caminho = Path("src/lowpoly/anatomia.json")
    catalogo = json.loads(caminho.read_text(encoding="utf-8")) if caminho.exists() else {}
    import unicodedata
    sem = lambda s: "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    pedido = sem((m.get("modelo") or m.get("consulta") or "").strip())
    # o id exato, ou o modelo com mais palavras em comum (nome e etiquetas, sem acentos); sem nenhuma em comum é erro
    # (antes caía no primeiro do catálogo, o coração, para qualquer palavra desconhecida)
    pontos = lambda k: sum(t in sem(" ".join([k, catalogo[k]["nome"], *catalogo[k]["tags"]])) for t in pedido.split())
    chave = pedido if pedido in catalogo else max(catalogo, key=pontos, default=None)
    if chave and chave != pedido and pontos(chave) == 0:
        chave = None
    if not chave or not pedido or not (Path("public") / catalogo[chave]["arquivo"]).exists():
        raise LookupError(f"modelo de anatomia não encontrado: {pedido} (há: {', '.join(catalogo)})")
    m["arquivo"], m["formato"], m["credito"] = catalogo[chave]["arquivo"], "modelo3d", catalogo[chave]["credito"]


# Link de uma rede (YouTube, Instagram, TikTok, X, Facebook): o vídeo é baixado pelo yt-dlp, o mesmo dos cortes.
# Só a imagem (o b-roll é mudo) e só um trecho: a partir do tempo do link (?t=90, ?t=1m30s) ou do início.
REDES = re.compile(r"^https?://(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|facebook\.com|fb\.watch)/", re.I)
TRECHO_S = 40


def inicio_do_link(url):
    t = (urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("t") or urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("start") or ["0"])[0]
    if t.isdigit():
        return int(t)
    p = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", t)
    return (int(p[1] or 0) * 3600 + int(p[2] or 0) * 60 + int(p[3] or 0)) if p else 0


def de_rede(url, destino_sem_ext):
    inicio = inicio_do_link(url)
    ffmpeg = Path("node_modules/@remotion/compositor-win32-x64-msvc")
    node = shutil.which("node")
    cmd = [sys.executable, "-m", "yt_dlp", url,
           "-f", "bv*[height<=1080][ext=mp4]/b[height<=1080][ext=mp4]/bv*[height<=1080]/b",
           "--no-playlist", "--force-overwrites", "--quiet", "--no-warnings",
           "--download-sections", f"*{inicio}-{inicio + TRECHO_S}", "--remux-video", "mp4",
           "--print", "after_move:DURACAO %(duration)s", "-o", str(destino_sem_ext) + ".%(ext)s"]
    if node:
        cmd += ["--js-runtimes", f"node:{node}"]
    if (ffmpeg / "ffmpeg.exe").exists():
        cmd += ["--ffmpeg-location", str(ffmpeg)]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    except FileNotFoundError:
        raise RuntimeError("yt-dlp não instalado (python -m pip install --user yt-dlp)")
    destino = destino_sem_ext.with_suffix(".mp4")
    if r.returncode != 0 or not destino.exists():
        msg = next((l for l in reversed(r.stderr.splitlines()) if l.startswith("ERROR")), r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "")
        if "instagram" in url and re.search(r"login|log in|rate-limit|private", msg, re.I):
            raise RuntimeError("o Instagram pediu sessão iniciada para este vídeo (privado ou limite de pedidos); baixe-o e envie o ficheiro")
        raise RuntimeError(msg.replace("ERROR: ", "")[:200] or "o site não deixou baixar")
    total = next((float(l.split()[1]) for l in r.stdout.splitlines() if l.startswith("DURACAO ") and l.split()[1].replace(".", "").isdigit()), None)
    return destino, max(1.0, min(TRECHO_S, total - inicio)) if total else TRECHO_S


def credito_rede(url):
    host = urllib.parse.urlparse(url).hostname or ""
    nome = next((n for d, n in (("youtu", "YouTube"), ("instagram", "Instagram"), ("tiktok", "TikTok"), ("x.com", "X"), ("twitter", "X"), ("fb.", "Facebook"), ("facebook", "Facebook")) if d in host), host)
    return f"Vídeo: {nome}"


FONTES = {"steam": de_steam, "wikimedia": de_wikimedia, "pixabay": de_pixabay, "pexels": de_stock, "emoji": de_emoji, "cs2": de_cs2, "url": lambda m: (m["consulta"], None, {})}
FORMATOS_3D = ("sketchfab", "procedural")
PROCEDURAIS = ("gpu", "cpu", "ram", "ssd")


def e_modelo(m):
    consulta = (m.get("consulta") or "").lower().split("?")[0]
    return m["fonte"] in FORMATOS_3D or m.get("tipo") == "modelo3d" or (m["fonte"] in ("url", "arquivo") and consulta.endswith(".glb"))


def de_polyhaven(m):
    """Modelo realista do Poly Haven (CC0) já descarregado: o id do catálogo (ou o mais parecido)."""
    catalogo = json.loads(Path("src/lowpoly/polyhaven.json").read_text(encoding="utf-8")) if Path("src/lowpoly/polyhaven.json").exists() else {}
    pedido = (m.get("modelo") or m.get("consulta") or "").strip()
    chave = pedido if pedido in catalogo else next((k for k in catalogo if k.lower() == pedido.lower()), None)
    if not chave:
        termos = pedido.lower().replace("_", " ").split()
        chave = max(catalogo, key=lambda k: sum(t in (k.lower() + " " + " ".join(catalogo[k]["tags"])) for t in termos), default=None) if termos else None
    if not chave or not (Path("public") / catalogo[chave]["arquivo"]).exists():
        raise LookupError(f"modelo Poly Haven não encontrado: {pedido} (corra python scripts/baixar_polyhaven.py)")
    m["arquivo"], m["formato"], m["credito"] = catalogo[chave]["arquivo"], "modelo3d", f"{catalogo[chave]['nome']} (Poly Haven, CC0)"


def resolver(m, pasta, i, vid):
    for campo in ("arquivo", "formato", "duracaoS", "inicioS", "credito", "sketchfab"):
        m.pop(campo, None)
    if m["fonte"] == "polyhaven":
        return de_polyhaven(m)
    if m["fonte"] == "anatomia":
        return de_anatomia(m)
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
    for antigo in pasta.glob(f"midia-{i}.*"):
        antigo.unlink()
    url, credito, extra = FONTES[m["fonte"]](m)
    if m["fonte"] == "url" and REDES.match(url.strip()):
        destino, extra["duracaoS"] = de_rede(url.strip(), pasta / f"midia-{i}")
        formato, credito = "video", credito_rede(url)
    elif url.startswith("hls:"):
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
        imagens = sorted((info.get("thumbnails") or {}).get("images", []), key=lambda im: abs(im.get("width", 0) - 360))
        escolhido = {"uid": uid, "nome": info["name"], "autor": info["user"]["displayName"], "licenca": (info.get("license") or {}).get("label", ""), "url": info.get("viewerUrl"),
                     "thumb": imagens[0]["url"] if imagens else None}
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
    if m["fonte"] == "anatomia":
        return de_anatomia(m)
    if m["fonte"] == "polyhaven":
        return de_polyhaven(m)
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
        midias += [(f"{i}-b{k}o", (b.get("cena") or {}).get("objeto")) for k, b in enumerate(cena.get("broll") or [])]  # e nas frases de efeito dos cortes
        modelo = cena.get("modelo")
        if modelo and modelo.get("consulta") and (forcar or not modelo.get("arquivo") or not (Path("public") / modelo["arquivo"]).exists()):
            try:
                resolver_modelo(modelo, pasta, i, vid)
                print(f"  🧊 cena {i + 1}: modelo 3D -> {modelo['arquivo']}")
            except Exception as e:  # sem ficheiro, a cena usa o modelo procedural
                print(f"  ⚠ cena {i + 1}: sem modelo 3D ({modelo.get('consulta')}): {e}")
        for nome, m in midias:
            # ícone (estilo Editorial): desenhado pelo estúdio, não há nada para descarregar
            if m and m.get("fonte") == "icone":
                m["arquivo"], m["formato"] = f"icone:{m.get('consulta') or m.get('nome') or 'circle'}", "icone"
                continue
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
