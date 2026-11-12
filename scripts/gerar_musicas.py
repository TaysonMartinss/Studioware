"""Gera faixas de fundo originais (sintetizadas, sem direitos de autor) em public/musicas/<clima>/.

São bases simples para o canal não ficar sem trilha. Para faixas melhores, junte MP3 do Pixabay Music ou da
YouTube Audio Library nas mesmas pastas (ou envie pelo painel).
Uso: python scripts/gerar_musicas.py
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
DURACAO = 48.0
rng = np.random.default_rng(11)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n, ataque=0.005, queda=0.2, sustain=0.0, soltar=0.05):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(ataque, 1e-4))
    e *= sustain + (1 - sustain) * np.exp(-np.maximum(0, t - ataque) / max(queda, 1e-4))
    fim = int(soltar * SR)
    if fim and n > fim:
        e[-fim:] *= np.linspace(1, 0, fim)
    return e


def osc(freq, n, forma="saw", desafinar=0.0):
    t = np.arange(n) / SR
    saida = np.zeros(n)
    for d in ([0.0] if not desafinar else [-desafinar, 0.0, desafinar]):
        fase = (freq * (1 + d) * t) % 1.0
        if forma == "saw":
            saida += 2 * fase - 1
        elif forma == "square":
            saida += np.where(fase < 0.5, 1.0, -1.0)
        elif forma == "tri":
            saida += 4 * np.abs(fase - 0.5) - 1
        else:
            saida += np.sin(2 * np.pi * fase)
    return saida / (1 if not desafinar else 3)


def filtro(x, corte, tipo="low", ordem=2):
    b, a = butter(ordem, min(corte, SR / 2 - 100) / (SR / 2), btype=tipo)
    return lfilter(b, a, x)


class Faixa:
    def __init__(self, bpm):
        self.bpm = bpm
        self.batida = 60 / bpm
        self.n = int(DURACAO * SR)
        self.mix = np.zeros(self.n)

    def por(self, som, tempo, ganho=1.0):
        i = int(tempo * SR)
        if i >= self.n:
            return
        fim = min(self.n, i + len(som))
        self.mix[i:fim] += som[: fim - i] * ganho

    def batidas(self):
        return int(DURACAO / self.batida)


def bombo(dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def tarola(dur=0.22, tom=190):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ruido = filtro(rng.uniform(-1, 1, n), 1500, "high") * np.exp(-t * 18)
    return ruido * 0.8 + np.sin(2 * np.pi * tom * t) * np.exp(-t * 30) * 0.5


def prato(dur=0.05):
    n = int(dur * SR)
    return filtro(rng.uniform(-1, 1, n), 7000, "high") * np.exp(-np.arange(n) / SR * 70)


def nota(midi, dur, forma="saw", corte=2000, ataque=0.005, queda=0.2, sustain=0.0, desafinar=0.0):
    n = int(dur * SR)
    return filtro(osc(hz(midi), n, forma, desafinar), corte) * env(n, ataque, queda, sustain, min(0.05, dur / 3))


ACORDES = {"m": [0, 3, 7], "M": [0, 4, 7], "m7": [0, 3, 7, 10], "M7": [0, 4, 7, 11], "7": [0, 4, 7, 10]}


def energetica():
    f = Faixa(128)
    prog = [(57, "m"), (53, "M"), (48, "M"), (55, "M")]  # Am F C G
    for b in range(f.batidas()):
        t = b * f.batida
        raiz, tipo = prog[(b // 4) % 4]
        f.por(bombo(), t, 0.9)
        f.por(prato(), t + f.batida / 2, 0.35)
        if b % 2 == 1:
            f.por(tarola(), t, 0.45)
        for k in range(2):  # baixo em colcheias
            f.por(nota(raiz - 12, f.batida / 2 * 0.9, "saw", 500, queda=0.15, sustain=0.4), t + k * f.batida / 2, 0.35)
        for k in range(4):  # arpejo em semicolcheias
            grau = ACORDES[tipo][(b * 4 + k) % 3]
            f.por(nota(raiz + 12 + grau, f.batida / 4, "square", 2800, queda=0.08), t + k * f.batida / 4, 0.09)
    return f


def tensa():
    f = Faixa(100)
    for b in range(f.batidas()):
        t = b * f.batida
        abre = 400 + 2600 * ((b % 32) / 32)  # filtro a abrir de 32 em 32 tempos: tensão a subir
        for k in range(4):
            f.por(nota(38, f.batida / 4 * 0.8, "saw", abre, queda=0.06, sustain=0.2), t + k * f.batida / 4, 0.22)
        f.por(prato(0.03), t + f.batida / 2, 0.2)
        if b % 4 == 0:
            f.por(bombo(0.5), t, 0.8)
        if b % 8 == 0:  # drone grave
            f.por(nota(26, f.batida * 8, "saw", 300, ataque=1.0, queda=9, sustain=0.9, desafinar=0.004), t, 0.25)
        if b % 16 == 12:
            f.por(tarola(0.4, 120), t, 0.35)
    return f


def ambiente():
    f = Faixa(80)
    prog = [(48, "M7"), (45, "m7"), (41, "M7"), (43, "M")]  # Cmaj7 Am7 Fmaj7 G
    for b in range(f.batidas()):
        t = b * f.batida
        raiz, tipo = prog[(b // 4) % 4]
        if b % 4 == 0:
            for grau in ACORDES[tipo]:
                f.por(nota(raiz + 12 + grau, f.batida * 4.4, "saw", 900, ataque=0.8, queda=6, sustain=0.8, desafinar=0.003), t, 0.07)
            f.por(nota(raiz - 12, f.batida * 4, "sine", 400, ataque=0.3, queda=4, sustain=0.7), t, 0.3)
        for k in range(2):  # sinos suaves
            grau = ACORDES[tipo][(b * 2 + k) % len(ACORDES[tipo])]
            f.por(nota(raiz + 24 + grau, 0.9, "sine", 6000, queda=0.6), t + k * f.batida / 2, 0.08)
    return f


def synthwave():
    f = Faixa(105)
    prog = [(57, "m"), (53, "M"), (48, "M"), (55, "M")]
    for b in range(f.batidas()):
        t = b * f.batida
        raiz, tipo = prog[(b // 4) % 4]
        f.por(bombo(), t, 0.8)
        if b % 2 == 1:
            # tarola "gated" grande dos anos 80
            f.por(filtro(tarola(0.35, 170), 6000), t, 0.6)
        for k in range(4):
            f.por(prato(0.04), t + k * f.batida / 4, 0.12)
        for k in range(2):  # baixo em oitavas
            f.por(nota(raiz - 12 + 12 * k, f.batida / 2 * 0.85, "saw", 700, queda=0.12, sustain=0.5), t + k * f.batida / 2, 0.3)
        if b % 4 == 0:
            for grau in ACORDES[tipo]:
                f.por(nota(raiz + 12 + grau, f.batida * 4, "saw", 1600, ataque=0.15, queda=3, sustain=0.6, desafinar=0.006), t, 0.06)
        for k in range(4):
            grau = ACORDES[tipo][(b * 4 + k) % 3]
            f.por(nota(raiz + 24 + grau, f.batida / 4, "square", 3500, queda=0.1), t + k * f.batida / 4, 0.05)
    return f


def lofi():
    f = Faixa(82)
    prog = [(50, "m7"), (43, "7"), (48, "M7"), (45, "m7")]  # Dm7 G7 Cmaj7 Am7
    swing = f.batida * 0.08
    for b in range(f.batidas()):
        t = b * f.batida
        raiz, tipo = prog[(b // 4) % 4]
        if b % 2 == 0:
            f.por(filtro(bombo(0.4), 2500), t, 0.7)
        else:
            f.por(filtro(tarola(0.25, 210), 3500), t, 0.35)
        f.por(prato(0.03), t + f.batida / 2 + swing, 0.15)
        if b % 4 == 0:  # "piano elétrico": seno com trémulo
            for grau in ACORDES[tipo]:
                som = nota(raiz + 12 + grau, f.batida * 3.8, "sine", 3000, ataque=0.01, queda=2.5, sustain=0.3)
                som *= 1 + 0.15 * np.sin(2 * np.pi * 5 * np.arange(len(som)) / SR)
                f.por(som, t + grau * 0.008, 0.12)
            f.por(nota(raiz - 12, f.batida * 2, "sine", 300, queda=1.2, sustain=0.5), t, 0.35)
    # estalidos de vinil
    estalos = np.zeros(f.n)
    estalos[rng.integers(0, f.n, 900)] = rng.uniform(-1, 1, 900)
    f.mix += filtro(estalos, 3000, "high") * 0.15 + filtro(rng.uniform(-1, 1, f.n), 1200) * 0.004
    f.mix = filtro(f.mix, 5500)
    return f


FAIXAS = {
    "energetica": [("pulso-a", energetica)],
    "tensa": [("contagem", tensa)],
    "ambiente": [("orbita", ambiente)],
    "synthwave": [("neon-1985", synthwave)],
    "lofi": [("tarde-fria", lofi)],
}


def gravar(f, destino):
    x = f.mix - f.mix.mean()
    # mesma loudness em todas as faixas (RMS -16 dBFS), com limitador suave nos picos
    x *= 10 ** (-16 / 20) / (np.sqrt((x ** 2).mean()) + 1e-9)
    x = 0.95 * np.tanh(x / 0.95)
    caudas = int(0.02 * SR)  # sem cliques no loop
    x[:caudas] *= np.linspace(0, 1, caudas)
    x[-caudas:] *= np.linspace(1, 0, caudas)
    wav = destino.with_suffix(".wav")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    r = subprocess.run(f'npx remotion ffmpeg -y -loglevel error -i "{wav}" -b:a 160k "{destino}"', shell=True)
    if r.returncode == 0:
        wav.unlink()


if __name__ == "__main__":
    raiz = Path("public/musicas")
    for clima, faixas in FAIXAS.items():
        (raiz / clima).mkdir(parents=True, exist_ok=True)
        for nome, gerar in faixas:
            destino = raiz / clima / f"{nome}.mp3"
            if destino.exists() and "--forcar" not in sys.argv:
                continue
            gravar(gerar(), destino)
            print(f"  ♪ {destino}")
