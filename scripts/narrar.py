"""Narra cada cena de um roteiro e grava o manifest com os tempos de cada palavra.

Motores (campo "narracao" do roteiro):
  edge        voz neural grátis do edge-tts (padrão)
  elevenlabs  ElevenLabs; precisa de ELEVENLABS_API_KEY no ambiente ou no ficheiro .env
  chatterbox  Chatterbox Multilingual (Resemble AI, MIT), local na placa gráfica, no ambiente .venv-voz;
              "voz" = "padrao" ou o caminho em public/ de uma amostra para clonar (ex.: "vozes/tayson.wav")

Marcas de pausa na "fala" (não aparecem nas legendas):
  [pausa]        respiração normal (~0,4 s)
  [pausa longa]  pausa dramática (~0,8 s), antes de uma revelação

Uso: python scripts/narrar.py roteiros/meu-video.json
Saída: public/videos/<id>/voz/<assinatura>.mp3|wav + public/videos/<id>/manifest.json

Reaproveitamento: cada cena tem uma assinatura (motor, voz, velocidade/modelo e a fala com as marcas). Se já existe
áudio com essa assinatura (voz/indice.json), não volta a narrar: trocar estilo, mídia, música ou marca d'água não
gasta créditos da ElevenLabs. --forcar narra tudo de novo.
"""
import asyncio
import base64
import difflib
import hashlib
import json
import shutil
import os
import re
import subprocess
import sys
import tempfile
import wave
import urllib.error
import urllib.request
from pathlib import Path

import edge_tts
import numpy as np

VOZ_PADRAO = "pt-BR-AntonioNeural"  # pt-PT: "pt-PT-DuarteNeural"
VELOCIDADE_PADRAO = "+6%"  # ritmo de short, sem soar acelerado
TICKS_POR_MS = 10_000  # edge-tts usa unidades de 100 ns
MODELO_ELEVEN = "eleven_multilingual_v2"


PAUSA = re.compile(r"\s*\[pausa( longa)?\]\s*", re.IGNORECASE)
PAUSA_MS = {"curta": 400, "longa": 800}
SR = 44100


TOM = re.compile(r"\[\s*tom\s*:\s*([^\]]+)\]", re.IGNORECASE)
ENFASE = re.compile(r"\[\s*[êe]nfase\s*\]\s*([\wÀ-ÿ-]+)", re.IGNORECASE)
OUTRA_MARCA = re.compile(r"\[[^\]]*\]")  # qualquer outra indicação de produção nunca é lida em voz alta

# interpretação da voz por cena: (velocidade e tom no edge-tts, estabilidade e estilo na ElevenLabs)
TONS = {
    "surpresa": {"rate": +10, "pitch": "+6Hz", "stability": 0.3, "style": 0.55},
    "animado": {"rate": +12, "pitch": "+4Hz", "stability": 0.35, "style": 0.5},
    "serio": {"rate": -4, "pitch": "-2Hz", "stability": 0.6, "style": 0.15},
    "tenso": {"rate": -2, "pitch": "-4Hz", "stability": 0.55, "style": 0.4},
}


def tom_da_fala(texto):
    m = TOM.search(texto)
    if not m:
        return None
    chave = m.group(1).strip().lower().replace("é", "e").replace("ê", "e")
    return next((k for k in TONS if chave.startswith(k[:4])), None)


def enfases(texto):
    """Palavras marcadas com [ênfase]: ganham destaque visual (zoom e cor) na legenda."""
    return [m.group(1) for m in ENFASE.finditer(texto)]


def limpar(texto):
    # tira [tom: …], [ênfase] (mantém a palavra) e qualquer outra marca entre colchetes
    texto = TOM.sub(" ", texto)
    texto = re.sub(r"\[\s*[êe]nfase\s*\]", " ", texto, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", OUTRA_MARCA.sub(" ", texto)).strip()


# a pausa só vale depois de pontuação (vírgula, ponto, ?, !, :, ;, reticências ou travessão): no meio de uma
# frase o trecho é narrado com entoação de fim e o silêncio parece que o vídeo travou
FIM_DE_FRASE = re.compile(r"[.,!?;:…—–-][\"'”’)»]*$")


def pausa_valida(antes):
    return bool(FIM_DE_FRASE.search(limpar(antes).rstrip()))


def segmentar(texto):
    """Divide a fala nas marcas [pausa]: [(trecho, silêncio_depois_ms), ...].
    As vozes ignoram quase sempre reticências, por isso a pausa é silêncio real entre trechos narrados à parte.
    Marcas no meio de uma frase (sem pontuação antes) são ignoradas: a frase é narrada seguida."""
    partes, ultimo = [], 0
    for m in PAUSA.finditer(texto):
        if not pausa_valida(texto[ultimo:m.start()]):
            continue
        partes.append((limpar(texto[ultimo:m.start()]), PAUSA_MS["longa" if m.group(1) else "curta"]))
        ultimo = m.end()
    partes.append((limpar(texto[ultimo:]), 0))
    return [(t, ms) for t, ms in partes if t]


def sem_marcas(texto):
    return limpar(PAUSA.sub(" ", texto))


def ffmpeg_exe():
    # o ffmpeg que vem com o Remotion (evita depender de um ffmpeg instalado no sistema)
    for p in Path("node_modules/@remotion").glob("compositor-*/ffmpeg*"):
        if p.is_file():
            return str(p)
    return "ffmpeg"


def decodificar(mp3):
    # o ffmpeg do Remotion só escreve WAV (não PCM cru): decodifica para WAV em memória e lê as amostras
    r = subprocess.run([ffmpeg_exe(), "-v", "error", "-i", str(mp3), "-f", "wav", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True)
    dados = r.stdout
    inicio = dados.find(b"data") + 8  # o cabeçalho de pipe não traz o tamanho certo: lê até ao fim
    return np.frombuffer(dados[inicio:inicio + (len(dados) - inicio) // 2 * 2], dtype="<i2")


def gravar_wav(amostras, destino):
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(amostras.astype("<i2").tobytes())


# ---------- Chatterbox: processo auxiliar no .venv-voz (o modelo carrega uma vez por vídeo) ----------
PYTHON_VOZ = Path(".venv-voz/Scripts/python.exe")
# tom da fala -> intensidade emocional do Chatterbox (exaggeration; 0.5 = neutro)
INTENSIDADE = {"surpresa": 0.75, "animado": 0.7, "tenso": 0.6, "serio": 0.4}


class Chatterbox:
    def __init__(self):
        if not PYTHON_VOZ.exists():
            sys.exit("O Chatterbox não está instalado (falta o ambiente .venv-voz).")
        self.p = subprocess.Popen([str(PYTHON_VOZ), "scripts/voz_chatterbox.py"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, encoding="utf-8", env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        info = self._resposta()
        if not info.get("pronto"):
            sys.exit(f"O Chatterbox não arrancou: {info}")
        print(f"  Chatterbox pronto ({info.get('dispositivo')})")

    def _resposta(self):
        for linha in self.p.stdout:
            if linha.startswith("@@"):
                return json.loads(linha[2:])
        sys.exit("O Chatterbox fechou sem responder (falta de memória na placa gráfica?)")

    def gerar(self, texto, destino, referencia=None, tom=None, semente=7):
        pedido = {"texto": texto, "destino": str(Path(destino).resolve()), "idioma": "pt", "intensidade": INTENSIDADE.get(tom, 0.5), "semente": semente}
        if referencia:
            pedido["referencia"] = str(Path(referencia).resolve())
        self.p.stdin.write(json.dumps(pedido, ensure_ascii=False) + "\n")
        self.p.stdin.flush()
        r = self._resposta()
        if r.get("erro"):
            sys.exit(f"O Chatterbox falhou nesta frase: {r['erro']}")

    def fechar(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=20)
        except Exception:
            self.p.kill()


_chatterbox = None


def chatterbox():
    global _chatterbox
    _chatterbox = _chatterbox or Chatterbox()
    return _chatterbox


def _norm(t):
    import unicodedata
    t = unicodedata.normalize("NFD", t.lower())
    return re.sub(r"[^a-z0-9%]", "", "".join(c for c in t if unicodedata.category(c) != "Mn"))


def alinhar_palavras(audio, texto, duracao_ms):
    """Tempos das palavras do texto do roteiro num áudio sem marcas de tempo: o Whisper transcreve e o texto alinha-se
    por semelhança; as palavras que ele ouviu de outra forma ("20%" por "vinte por cento") repartem o tempo do trecho."""
    tokens = texto.split()
    if not tokens:
        return []
    with tempfile.TemporaryDirectory() as tmp:
        wav16 = Path(tmp) / "a.wav"
        subprocess.run([ffmpeg_exe(), "-y", "-v", "error", "-i", str(audio), "-ar", "16000", "-ac", "1", str(wav16)], check=True)
        r = subprocess.run(["node", "scripts/alinhar_voz.mjs", str(wav16), "pt"], capture_output=True, text=True, encoding="utf-8")
    try:
        ouvidas = json.loads(r.stdout) if r.returncode == 0 else []
    except json.JSONDecodeError:
        ouvidas = []
    tempos = [None] * len(tokens)
    extras = []  # [(inicioMs, fimMs)] do que se ouviu a mais
    sm = difflib.SequenceMatcher(a=[_norm(t) for t in tokens], b=[_norm(w["texto"]) for w in ouvidas], autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "insert":
            extras.append((ouvidas[j1]["inicioMs"], ouvidas[j2 - 1]["fimMs"]))
        elif tag == "equal":
            for k in range(i2 - i1):
                tempos[i1 + k] = (ouvidas[j1 + k]["inicioMs"], ouvidas[j1 + k]["fimMs"])
        elif tag == "replace":
            # as palavras do texto dividem o tempo das ouvidas, pelo tamanho de cada uma
            t0, t1 = ouvidas[j1]["inicioMs"], ouvidas[j2 - 1]["fimMs"]
            pesos = [max(1, len(t)) for t in tokens[i1:i2]]
            acc = 0
            for k, w in enumerate(pesos):
                a = t0 + (t1 - t0) * acc / sum(pesos)
                acc += w
                tempos[i1 + k] = (round(a), round(t0 + (t1 - t0) * acc / sum(pesos)))
    # o que ficou sem tempo (o Whisper não ouviu) reparte o espaço entre as vizinhas
    k = 0
    while k < len(tokens):
        if tempos[k] is not None:
            k += 1
            continue
        j = k
        while j < len(tokens) and tempos[j] is None:
            j += 1
        ini = tempos[k - 1][1] if k > 0 else 0
        fim = tempos[j][0] if j < len(tokens) else max(ini + 200 * (j - k), duracao_ms - 100)
        passo = (fim - ini) / (j - k)
        for m in range(k, j):
            tempos[m] = (round(ini + passo * (m - k)), round(ini + passo * (m - k + 1)))
        k = j
    return [{"texto": t.strip("\"'()"), "inicioMs": a, "fimMs": max(a + 60, b)} for t, (a, b) in zip(tokens, tempos)], extras


def narrar_chatterbox(trechos, voz, destino, tom=None):
    """Narra a cena inteira numa só geração (em frases curtas o Chatterbox inventa fala a mais), tira o que o Whisper
    ouviu e que não está no texto, e mete as [pausa] como silêncio a seguir à palavra certa."""
    referencia = None if voz in (None, "", "padrao") else Path("public") / voz
    if referencia is not None and not referencia.is_file():
        sys.exit(f"Não encontrei a amostra de voz {referencia}")
    texto = " ".join(t for t, _ in trechos)
    with tempfile.TemporaryDirectory() as tmp:
        bruto = Path(tmp) / "bruto.wav"
        chatterbox().gerar(texto, bruto, referencia, tom)
        amostras = decodificar(bruto).astype(np.int32)
        palavras, extras = alinhar_palavras(bruto, texto, round(len(amostras) / SR * 1000))
    if not palavras:
        gravar_wav(amostras, destino)
        return [], round(len(amostras) / SR * 1000)
    ms = lambda t: int(t / 1000 * SR)
    # o que fica: do início da 1.ª palavra ao fim da última, sem os trechos inventados pelo meio
    ini, fim = max(0, palavras[0]["inicioMs"] - 60), palavras[-1]["fimMs"] + 160
    cortes = sorted((a, b) for a, b in extras if a > ini and b < fim)
    # pausas: depois da última palavra de cada trecho (menos o último)
    fronteiras, n = {}, 0
    for t, pausa_ms in trechos[:-1]:
        n += len(t.split())
        if 0 < n <= len(palavras) and pausa_ms:
            fronteiras[n - 1] = pausa_ms
    # constrói o áudio novo e o mapa de tempos velho -> novo
    pedacos, mapa, cursor, pos = [], [], 0, ini
    marcas = sorted([(b, "corte", a) for a, b in cortes] + [(palavras[k]["fimMs"] + 40, "pausa", v) for k, v in fronteiras.items()])
    for t, tipo, v in marcas:
        if tipo == "corte":
            a, b = v, t
            if a > pos:
                pedacos.append(amostras[ms(pos):ms(a)]); mapa.append((pos, a, cursor)); cursor += a - pos
            pos = max(pos, b)
        elif t > pos:
            pedacos.append(amostras[ms(pos):ms(t)]); mapa.append((pos, t, cursor)); cursor += t - pos
            pedacos.append(np.zeros(ms(v), dtype=np.int32)); cursor += v
            pos = t
    if fim > pos:
        pedacos.append(amostras[ms(pos):ms(fim)]); mapa.append((pos, fim, cursor)); cursor += fim - pos

    def novo(t):
        for a, b, c in mapa:
            if a <= t <= b:
                return c + (t - a)
        antes = [m for m in mapa if m[1] <= t]
        return antes[-1][2] + (antes[-1][1] - antes[-1][0]) if antes else 0

    for p in palavras:
        p["inicioMs"], p["fimMs"] = round(novo(p["inicioMs"])), round(novo(p["fimMs"]))
    gravar_wav(np.clip(np.concatenate(pedacos), -32768, 32767), destino)
    return palavras, round(cursor)


def chave_elevenlabs():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    env = Path(".env")
    if env.exists():
        for linha in env.read_text(encoding="utf-8").splitlines():
            if linha.startswith("ELEVENLABS_API_KEY="):
                return linha.split("=", 1)[1].strip()
    sys.exit("Falta ELEVENLABS_API_KEY (defina no painel ou no ficheiro .env)")


def narrar_elevenlabs(texto, voz, modelo, destino, anterior="", seguinte="", tom=None):
    pedido = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voz}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps({
            "text": texto,
            "model_id": modelo,
            # o texto das cenas vizinhas dá continuidade à entoação (soa como uma só narração, não frases soltas)
            "previous_text": anterior or None,
            "next_text": seguinte or None,
            "voice_settings": {"stability": TONS[tom]["stability"] if tom else 0.45, "similarity_boost": 0.8, "style": TONS[tom]["style"] if tom else 0.3, "speed": 1.05, "use_speaker_boost": True},
        }).encode(),
        headers={"xi-api-key": chave_elevenlabs(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=120) as r:
            resposta = json.load(r)
    except urllib.error.HTTPError as e:
        corpo = e.read().decode(errors="replace")
        if "paid_plan_required" in corpo:
            sys.exit("A ElevenLabs só deixa usar esta voz em planos pagos. Troque a voz no editor do roteiro (grupo 'Falam português') ou use a voz grátis.")
        if "quota_exceeded" in corpo:
            sys.exit("Acabaram os caracteres do mês na ElevenLabs. Use a voz grátis neste vídeo ou espere pela renovação.")
        sys.exit(f"ElevenLabs recusou o pedido ({e.code}): {corpo[:300]}")
    audio = base64.b64decode(resposta["audio_base64"])
    destino.write_bytes(audio)

    # o alinhamento vem por caractere: juntamos em palavras
    al = resposta["alignment"]
    palavras, atual, ini, fim = [], "", 0.0, 0.0
    for ch, s, e in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if atual:
                palavras.append({"texto": atual, "inicioMs": round(ini * 1000), "fimMs": round(fim * 1000)})
            atual = ""
            continue
        if not atual:
            ini = s
        atual += ch
        fim = e
    if atual:
        palavras.append({"texto": atual, "inicioMs": round(ini * 1000), "fimMs": round(fim * 1000)})
    # mp3 a 128 kbps: 16 bytes por ms
    duracao = max(len(audio) / 16, palavras[-1]["fimMs"] + 150 if palavras else 0)
    return palavras, round(duracao)


async def narrar_cena(texto, voz, velocidade, destino, tom=None):
    pitch = "+0Hz"
    if tom:
        # o tom soma-se à velocidade base do roteiro (ex.: "+6%" + 10 = "+16%")
        m = re.match(r"\s*([+-]?\d+)", velocidade)
        base = int(m.group(1)) if m else 0
        velocidade = f"{base + TONS[tom]['rate']:+d}%"
        pitch = TONS[tom]["pitch"]
    com = edge_tts.Communicate(texto, voz, rate=velocidade, pitch=pitch, boundary="WordBoundary")
    audio = bytearray()
    palavras = []
    async for parte in com.stream():
        if parte["type"] == "audio":
            audio.extend(parte["data"])
        elif parte["type"] == "WordBoundary":
            ini = parte["offset"] / TICKS_POR_MS
            palavras.append({"texto": parte["text"], "inicioMs": round(ini), "fimMs": round(ini + parte["duration"] / TICKS_POR_MS)})
    destino.write_bytes(audio)
    # o mp3 do edge-tts é CBR a 48 kbps: 6 bytes por ms
    duracao = max(len(audio) / 6, palavras[-1]["fimMs"] + 150 if palavras else 0)
    return palavras, round(duracao)


def recolocar_pontuacao(texto, palavras):
    # os WordBoundary vêm sem pontuação; as legendas usam-na para quebrar páginas
    tokens = texto.split()
    j = 0
    for p in palavras:
        while j < len(tokens) and p["texto"].lower() not in tokens[j].lower():
            j += 1
        if j < len(tokens):
            p["texto"] = tokens[j].strip("\"'()")
            j += 1
    return palavras


POR_EXTENSO = {1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez", 11: "onze", 12: "doze"}


async def main(caminho, forcar=False):
    roteiro = json.loads(Path(caminho).read_text(encoding="utf-8"))
    vid = roteiro["id"]
    pasta = Path("public/videos") / vid
    pasta.mkdir(parents=True, exist_ok=True)
    motor = roteiro.get("narracao", "edge")
    voz = roteiro.get("voz") or VOZ_PADRAO
    velocidade = roteiro.get("velocidade", VELOCIDADE_PADRAO)
    if motor == "elevenlabs" and voz.endswith("Neural"):
        sys.exit("Narração ElevenLabs precisa de um voice_id da ElevenLabs no campo 'voz'")
    if motor == "chatterbox" and voz.endswith("Neural"):
        voz = "padrao"  # voz do Edge num roteiro mudado para Chatterbox: usa a voz própria do Chatterbox
    print(f"Narração: {motor} / {voz}")

    # capítulo sem fala: anuncia-se sozinho ("Capítulo dois. O relógio no DNA."), senão fica um silêncio
    for cena in roteiro["cenas"]:
        if cena["tipo"] == "capitulo" and not cena.get("fala", "").strip():
            n = cena.get("numero")
            cena["fala"] = f"{'Capítulo ' + POR_EXTENSO.get(n, str(n)) + '. ' if n else ''}{cena.get('titulo', '')}."
    limpas = [sem_marcas(c.get("fala", "")) if c["tipo"] != "clipe" else "" for c in roteiro["cenas"]]

    # áudios já narrados, pela assinatura de cada cena
    pasta_voz = pasta / "voz"
    pasta_voz.mkdir(exist_ok=True)
    ficheiro_indice = pasta_voz / "indice.json"
    indice = {} if forcar or not ficheiro_indice.exists() else json.loads(ficheiro_indice.read_text(encoding="utf-8"))
    modelo = roteiro.get("modelo_voz", MODELO_ELEVEN)

    def assinatura_de(fala, mot=motor, vz=voz, vel=velocidade, mod=modelo):
        base = [mot, vz, mod if mot == "elevenlabs" else vel, fala]
        return hashlib.sha1(json.dumps(base, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]

    # vídeos narrados antes desta versão: adota os áudios do manifest anterior quando a fala e a voz são as mesmas
    anterior = pasta / "manifest.json"
    if not forcar and anterior.exists():
        try:
            velho = json.loads(anterior.read_text(encoding="utf-8"))
            for c in velho.get("cenas", []):
                orig = Path("public") / c.get("audio", "")
                if c.get("tipo") == "clipe" or not c.get("audio") or not orig.is_file() or "palavras" not in c:
                    continue
                a = assinatura_de(c.get("fala", ""), velho.get("narracao", "edge"), velho.get("voz") or VOZ_PADRAO,
                                  velho.get("velocidade", VELOCIDADE_PADRAO), velho.get("modelo_voz", MODELO_ELEVEN))
                if a in indice:
                    continue
                dest = pasta_voz / f"{a}{orig.suffix}"
                if orig.resolve() != dest.resolve():
                    shutil.copyfile(orig, dest)
                indice[a] = {"arquivo": dest.name, "duracaoMs": c["duracaoMs"], "palavras": c["palavras"]}
        except Exception as e:
            print(f"  (não consegui ler o manifest anterior: {e})")

    reaproveitadas = 0
    for i, cena in enumerate(roteiro["cenas"]):
        if cena["tipo"] == "clipe":
            continue  # usa o áudio do próprio vídeo (transcrito por scripts/transcrever.mjs)
        trechos = segmentar(cena.get("fala", ""))
        tom = tom_da_fala(cena.get("fala", ""))
        # palavras com [ênfase] entram nos destaques do vídeo (zoom punch e cor na legenda)
        for palavra in enfases(cena.get("fala", "")):
            if palavra.lower() not in [d.lower() for d in roteiro.setdefault("destaques", [])]:
                roteiro["destaques"].append(palavra)

        assinatura = assinatura_de(cena.get("fala", ""))
        guardado = indice.get(assinatura)
        if guardado and (pasta_voz / guardado["arquivo"]).is_file():
            cena["audio"] = f"videos/{vid}/voz/{guardado['arquivo']}"
            cena["duracaoMs"] = guardado["duracaoMs"]
            cena["palavras"] = guardado["palavras"]
            reaproveitadas += 1
            print(f"  cena {i + 1}/{len(roteiro['cenas'])} ({cena['tipo']}): {cena['duracaoMs'] / 1000:.1f}s (reaproveitada)")
            continue

        async def narrar_trecho(texto, destino, antes, depois):
            if motor == "elevenlabs":
                return narrar_elevenlabs(texto, voz, roteiro.get("modelo_voz", MODELO_ELEVEN), destino, antes, depois, tom)
            return await narrar_cena(texto, voz, velocidade, destino, tom)

        # contexto para a entoação: o que vem antes e depois (inclui as cenas vizinhas)
        anterior_cena = limpas[i - 1] if i > 0 else ""
        seguinte_cena = limpas[i + 1] if i + 1 < len(limpas) else ""
        if motor == "chatterbox":
            arquivo = pasta_voz / f"{assinatura}.wav"
            palavras, dur = narrar_chatterbox(trechos or [(limpas[i], 0)], voz, arquivo, tom)
        elif len(trechos) <= 1:
            arquivo = pasta_voz / f"{assinatura}.mp3"
            palavras, dur = await narrar_trecho(limpas[i], arquivo, anterior_cena, seguinte_cena)
        else:
            # várias partes com silêncio real entre elas, juntas num único WAV
            arquivo = pasta_voz / f"{assinatura}.wav"
            audio, palavras, cursor_ms = [], [], 0
            with tempfile.TemporaryDirectory() as tmp:
                for k, (texto, pausa_ms) in enumerate(trechos):
                    antes = " ".join([anterior_cena] + [t for t, _ in trechos[:k]]).strip()
                    depois = " ".join([t for t, _ in trechos[k + 1:]] + [seguinte_cena]).strip()
                    parte = Path(tmp) / f"{k}.mp3"
                    pw, _ = await narrar_trecho(texto, parte, antes, depois)
                    amostras = decodificar(parte)
                    # cada trecho vem com silêncio no início e no fim: apara (deixa 60 ms) para a pausa ter o tamanho pedido
                    som = np.flatnonzero(np.abs(amostras) > np.abs(amostras).max() * 0.02)
                    margem = int(SR * 0.06)
                    ini = max(0, som[0] - margem) if len(som) else 0
                    fim = min(len(amostras), som[-1] + margem) if len(som) else len(amostras)
                    amostras = amostras[ini:fim]
                    corte_ms = round(ini / SR * 1000)
                    palavras += [{**w, "inicioMs": max(0, w["inicioMs"] - corte_ms) + cursor_ms, "fimMs": w["fimMs"] - corte_ms + cursor_ms} for w in pw]
                    silencio = np.zeros(int(SR * pausa_ms / 1000), dtype="<i2")
                    audio += [amostras, silencio]
                    cursor_ms += round(len(amostras) / SR * 1000) + pausa_ms
            gravar_wav(np.concatenate(audio), arquivo)
            dur = cursor_ms
        cena["audio"] = f"videos/{vid}/voz/{arquivo.name}"
        cena["duracaoMs"] = dur
        cena["palavras"] = recolocar_pontuacao(limpas[i], palavras)
        indice[assinatura] = {"arquivo": arquivo.name, "duracaoMs": dur, "palavras": cena["palavras"]}
        ficheiro_indice.write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")  # a cada cena: um erro a meio não perde o que já se pagou
        print(f"  cena {i + 1}/{len(roteiro['cenas'])} ({cena['tipo']}): {dur / 1000:.1f}s")

    ficheiro_indice.write_text(json.dumps(indice, ensure_ascii=False), encoding="utf-8")
    if _chatterbox:
        _chatterbox.fechar()
    # quiz: depois da fala há a contagem em silêncio e o "TEMPO!" (QUIZ_SEGUNDOS e QUIZ_REVELA_MS em src/types.ts)
    for cena in roteiro["cenas"]:
        if cena["tipo"] == "quiz" and cena.get("duracaoMs") is not None:
            cena["falaMs"] = cena["duracaoMs"]
            cena["duracaoMs"] += int(cena.get("segundos") or 5) * 1000 + 1300
    # os áudios antigos (cena-N.*) já foram adotados no índice ou ficaram sem uso
    for antigo in pasta.glob("cena-*.*"):
        if antigo.suffix in (".mp3", ".wav"):
            antigo.unlink()
    if reaproveitadas:
        print(f"♻ {reaproveitadas} cena(s) com a narração reaproveitada (sem gastar créditos)")

    manifest = pasta / "manifest.json"
    manifest.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(c["duracaoMs"] for c in roteiro["cenas"]) / 1000
    print(f"Narração pronta: {total:.1f}s -> {manifest}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], forcar="--forcar" in sys.argv))
