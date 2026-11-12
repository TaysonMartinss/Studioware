"""Importa uma faixa (ex.: descarregada da YouTube Audio Library) para a biblioteca de música de fundo.

- lê título e artista do nome do ficheiro ("Título - Artista.mp3", o formato da YouTube Audio Library)
- mede o andamento (BPM), a energia e o brilho e sugere um clima
- normaliza a loudness (RMS -16 dBFS, como as outras faixas) e grava em public/musicas/<clima>/
- regista título, artista, origem e crédito em public/musicas/catalogo.json

Uso: python scripts/importar_musica.py <ficheiro> [--clima tensa] [--credito "texto"] [--origem "YouTube Audio Library"]
Imprime um JSON com o resultado.
"""
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import wave
from pathlib import Path

import numpy as np

SR = 22050
CLIMAS = ["energetica", "tensa", "ambiente", "synthwave", "lofi"]
CATALOGO = Path("public/musicas/catalogo.json")


def ffmpeg(*args):
    r = subprocess.run("npx remotion ffmpeg -y -hide_banner -loglevel error " + " ".join(args), shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-400:] or "ffmpeg falhou")


def ler_audio(caminho, sr=SR, canais=1):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        ffmpeg(f'-i "{caminho}"', f"-ac {canais} -ar {sr}", f'"{wav}"')
        with wave.open(str(wav)) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return x.reshape(-1, canais) if canais > 1 else x


def normalizar_para(caminho, destino, rms_alvo_db=-16):
    # o ffmpeg do Remotion não tem limitador: ganho + limitador suave (tanh) feitos aqui
    x = ler_audio(caminho, 44100, 2)
    rms = np.sqrt((x ** 2).mean()) + 1e-9
    x = x * (10 ** (rms_alvo_db / 20) / rms)
    x = 0.95 * np.tanh(x / 0.95)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "n.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(44100)
            w.writeframes((x * 32767).astype("<i2").tobytes())
        ffmpeg(f'-i "{wav}"', "-b:a 192k", f'"{destino}"')


def analisar(x):
    """BPM (autocorrelação do envelope de onsets), energia (RMS) e brilho (centróide espectral)."""
    janela, salto = 1024, 512
    n = 1 + (len(x) - janela) // salto
    quadros = np.lib.stride_tricks.as_strided(x, (n, janela), (x.strides[0] * salto, x.strides[0]))
    espectro = np.abs(np.fft.rfft(quadros * np.hanning(janela), axis=1))
    freqs = np.fft.rfftfreq(janela, 1 / SR)
    brilho = float((espectro * freqs).sum() / (espectro.sum() + 1e-9))
    fluxo = np.maximum(0, np.diff(np.log1p(espectro), axis=0)).sum(axis=1)
    fluxo = (fluxo - fluxo.mean()) / (fluxo.std() + 1e-9)
    auto = np.correlate(fluxo, fluxo, "full")[len(fluxo) - 1:]
    auto /= auto[0] + 1e-9
    fps = SR / salto
    # filtro em pente: o período certo também tem picos no dobro, triplo e quádruplo,
    # o que evita confundir 128 BPM com 64; e uma preferência suave por andamentos à volta de 110 BPM
    melhor, lag = -1.0, 1
    for l in range(int(fps * 60 / 180), int(fps * 60 / 60) + 1):
        soma = sum(auto[k * l] / k for k in range(1, 5) if k * l < len(auto))
        prior = np.exp(-0.5 * (np.log2(60 * fps / l / 110) / 0.7) ** 2)
        if soma * prior > melhor:
            melhor, lag = soma * prior, l
    bpm = 60 * fps / lag
    rms = float(np.sqrt((x ** 2).mean()))
    # percussão: força dos ataques no grave (bombo) — separa faixas com bateria de faixas ambiente
    graves = espectro[:, freqs < 150].sum(axis=1)
    ataques = np.maximum(0, np.diff(graves))
    percussao = float(np.percentile(ataques, 98) / (np.median(graves) + 1e-9))
    return {"bpm": round(bpm), "brilho": round(brilho), "rms_db": round(20 * np.log10(rms + 1e-9), 1), "percussao": round(percussao, 2)}


def sugerir_clima(a):
    # só uma sugestão (synthwave, por exemplo, não dá para distinguir só pelo som): o utilizador confirma no painel
    if a["percussao"] < 0.4:
        return "ambiente"  # sem bateria
    if a["bpm"] >= 115:
        return "energetica"
    if a["bpm"] <= 92 and a["brilho"] < 1200:
        return "lofi"  # lenta e abafada
    if a["brilho"] < 1100:
        return "tensa"  # escura e com pulsação
    return "energetica"


def slug(t):
    t = unicodedata.normalize("NFD", t.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "faixa"


def titulo_artista(nome):
    base = re.sub(r"\.\w+$", "", nome).replace("_", " ").strip()
    if " - " in base:
        titulo, artista = base.split(" - ", 1)
        return titulo.strip(), artista.strip()
    return base, ""


def main():
    args = sys.argv[1:]
    origem_ficheiro = Path(args[0])
    opc = lambda nome: args[args.index(nome) + 1] if nome in args else None
    nome_original = opc("--nome") or origem_ficheiro.name
    titulo, artista = titulo_artista(nome_original)

    x = ler_audio(origem_ficheiro)
    analise = analisar(x)
    clima = opc("--clima") if opc("--clima") in CLIMAS else sugerir_clima(analise)

    destino = Path("public/musicas") / clima / f"{slug(titulo)}{'-' + slug(artista) if artista else ''}.mp3"
    destino.parent.mkdir(parents=True, exist_ok=True)
    normalizar_para(origem_ficheiro, destino)  # mesma loudness das outras faixas

    catalogo = json.loads(CATALOGO.read_text(encoding="utf-8")) if CATALOGO.exists() else {}
    arquivo = destino.relative_to("public").as_posix()
    catalogo[arquivo] = {
        "titulo": titulo, "artista": artista, "origem": opc("--origem") or "YouTube Audio Library",
        "credito": opc("--credito") or "", "bpm": analise["bpm"], "duracaoS": round(len(x) / SR, 1),
        "climaSugerido": sugerir_clima(analise),
    }
    CATALOGO.write_text(json.dumps(catalogo, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"arquivo": arquivo, "clima": clima, **catalogo[arquivo], "analise": analise}, ensure_ascii=False))


if __name__ == "__main__":
    main()
