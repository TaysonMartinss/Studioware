"""Gera os efeitos sonoros (whoosh, impacto, pop, clique, pop-ups e sons de papel) em public/sfx/ sintetizados, sem downloads nem direitos de autor."""
import math
import random
import struct
import sys
import wave
from pathlib import Path

SR = 44100
random.seed(7)


def gravar(nome, amostras, pasta):
    pico = max(1e-9, max(abs(a) for a in amostras))
    with wave.open(str(pasta / nome), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(a / pico * 0.9 * 32767)) for a in amostras))


def whoosh(dur=0.5):
    # ruído com filtro passa-baixo cujo corte sobe e desce, envelope em sino
    n = int(SR * dur)
    out, y = [], 0.0
    for i in range(n):
        t = i / n
        corte = 250 + 2800 * math.sin(math.pi * t) ** 2  # mais grave e suave (menos chiado)
        a = 1 - math.exp(-2 * math.pi * corte / SR)
        y += a * (random.uniform(-1, 1) - y)
        out.append(y * math.sin(math.pi * t) ** 1.5)
    return out


def impacto(dur=0.35):
    # "tum" curto e contido: menos sub-grave, cauda curta e sem saturação (a versão antiga retumbava demasiado)
    out, fase = [], 0.0
    for i in range(int(SR * dur)):
        t = i / SR
        freq = 70 + 80 * math.exp(-t * 25)
        fase += 2 * math.pi * freq / SR
        corpo = math.sin(fase) * math.exp(-t * 12)
        estalo = random.uniform(-1, 1) * math.exp(-t * 120) * 0.25
        out.append(corpo + estalo)
    return out


def pop(dur=0.09):
    out, fase = [], 0.0
    for i in range(int(SR * dur)):
        t = i / SR
        fase += 2 * math.pi * (300 + 900 * math.exp(-t * 60)) / SR
        out.append(math.sin(fase) * math.exp(-t * 45))
    return out


def popup(tom=1.0, dur=0.12):
    # "bloop" discreto a subir (tipo bolha): seno puro, ataque macio e cauda curta
    out, fase = [], 0.0
    for i in range(int(SR * dur)):
        t = i / SR
        freq = tom * (420 + 260 * (1 - math.exp(-t * 50)))
        fase += 2 * math.pi * freq / SR
        envelope = min(1, t / 0.008) * math.exp(-t * 38)
        out.append(math.sin(fase) * envelope)
    return out


# ---------- sons de papel (estilo Papel / Stop Motion): secos e curtos ----------
def _banda(x, baixo, alto):
    # passa-banda simples: passa-alto de 1.ª ordem seguido de passa-baixo de 1.ª ordem
    ah = math.exp(-2 * math.pi * baixo / SR)
    al = 1 - math.exp(-2 * math.pi * alto / SR)
    out, ph, px, pl = [], 0.0, 0.0, 0.0
    for v in x:
        ph = ah * (ph + v - px)
        px = v
        pl += al * (ph - pl)
        out.append(pl)
    return out


def rasgo(dur=0.32):
    # papel a rasgar: rajadas de "estalidos" de fibra cada vez mais rápidas
    n = int(SR * dur)
    env, nivel = [], 0.0
    for i in range(n):
        t = i / n
        if random.random() < 0.004 + 0.02 * t:
            nivel = random.uniform(0.4, 1.0)
        nivel *= 0.9985
        env.append(nivel * math.sin(math.pi * min(1, t * 1.2)) ** 0.5)
    ruido = [random.uniform(-1, 1) for _ in range(n)]
    return [a * b for a, b in zip(_banda(ruido, 1200, 6500), env)]


def amassado(dur=0.28):
    # papel amassado: estalidos esparsos e agudos
    n = int(SR * dur)
    out = [0.0] * n
    for _ in range(46):
        ini = random.randint(0, n - 600)
        amp = random.uniform(0.3, 1.0) * (1 - ini / n) ** 0.5
        for k in range(random.randint(80, 500)):
            out[ini + k] += random.uniform(-1, 1) * amp * math.exp(-k / 90)
    return _banda(out, 2000, 9000)


def fita(dur=0.38):
    # fita-cola a descolar: ruído com "chiar" a subir
    n = int(SR * dur)
    out, fase = [], 0.0
    for i in range(n):
        t = i / n
        fase += 2 * math.pi * (900 + 1600 * t) / SR
        chiar = math.sin(fase) * 0.25 * (0.5 + 0.5 * math.sin(2 * math.pi * 38 * t))
        out.append((random.uniform(-1, 1) * 0.8 + chiar) * math.sin(math.pi * t) ** 0.8)
    return _banda(out, 1500, 7000)


def cartao(dur=0.26):
    # cartão a deslizar e assentar: atrito grave + "toc" seco no fim
    n = int(SR * dur)
    atrito = _banda([random.uniform(-1, 1) for _ in range(n)], 150, 1200)
    out = []
    for i in range(n):
        t = i / n
        toc = math.sin(2 * math.pi * 140 * max(0, t - 0.7) * dur) * math.exp(-max(0, t - 0.7) * dur * 40) if t > 0.7 else 0
        out.append(atrito[i] * math.sin(math.pi * min(1, t / 0.8)) * 0.7 + toc)
    return out


def clique(dur=0.05):
    out = []
    for i in range(int(SR * dur)):
        t = i / SR
        out.append((math.sin(2 * math.pi * 2200 * t) * 0.6 + random.uniform(-1, 1) * 0.4) * math.exp(-t * 120))
    return out


def caneta(dur=0.42):
    # canetão a escrever depressa: traços de atrito (ruído em banda média) com pausas entre letras
    n = int(SR * dur)
    traco = _banda([random.uniform(-1, 1) for _ in range(n)], 700, 4200)
    out, nivel, alvo = [], 0.0, 0.0
    for i in range(n):
        if i % int(SR * 0.045) == 0:
            alvo = random.choice([0.0, 0.6, 1.0, 0.85])
        nivel += (alvo - nivel) * 0.004
        t = i / n
        out.append(traco[i] * nivel * math.sin(math.pi * min(1, t * 1.15)) ** 0.4)
    return out


def obturador(dur=0.16):
    # obturador de câmara antiga: dois estalos mecânicos (abrir e fechar) com ressonância curta
    out = []
    for i in range(int(SR * dur)):
        t = i / SR
        v = 0.0
        for ini, forca in ((0.0, 1.0), (0.075, 0.75)):
            if t >= ini:
                u = t - ini
                v += forca * (random.uniform(-1, 1) * math.exp(-u * 160) + math.sin(2 * math.pi * 1700 * u) * math.exp(-u * 90) * 0.5)
        out.append(v)
    return _banda(out, 400, 8000)


def riser(dur=1.25):
    # subida de tensão que acaba no golpe: ruído com filtro a abrir + tom a subir, crescendo até ao fim
    n = int(SR * dur)
    out, y, fase = [], 0.0, 0.0
    for i in range(n):
        t = i / n
        corte = 300 + 6500 * t ** 2
        a = 1 - math.exp(-2 * math.pi * corte / SR)
        y += a * (random.uniform(-1, 1) - y)
        fase += 2 * math.pi * (110 * 2 ** (2.5 * t)) / SR
        tom = math.sin(fase) * 0.35 + math.sin(fase * 1.5) * 0.15
        env = t ** 2.2 * (1 - max(0, t - 0.97) / 0.03)
        out.append((y * 0.9 + tom) * env)
    return out


def chime(dur=1.4):
    # acorde de sino (dó maior com a quinta em cima): para a revelação principal do vídeo
    out = []
    notas = [(523.25, 1.0), (659.25, 0.7), (783.99, 0.6), (1046.5, 0.35)]
    for i in range(int(SR * dur)):
        t = i / SR
        v = sum(a * math.sin(2 * math.pi * f * t) * math.exp(-t * (2.2 + k)) + a * 0.25 * math.sin(2 * math.pi * f * 2.76 * t) * math.exp(-t * 7)
                for k, (f, a) in enumerate(notas))
        out.append(v * min(1, t / 0.004))
    return out


if __name__ == "__main__":
    pasta = Path(sys.argv[1] if len(sys.argv) > 1 else "public/sfx")
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, fn in [("whoosh.wav", whoosh), ("impacto.wav", impacto), ("pop.wav", pop), ("clique.wav", clique),
                     ("rasgo.wav", rasgo), ("amassado.wav", amassado), ("fita.wav", fita), ("cartao.wav", cartao)]:
        gravar(nome, fn(), pasta)
    # 4 alturas a subir (tónica, terceira menor, quarta, quinta) para as palavras do título irem "subindo"
    for n, tom in enumerate([1.0, 1.189, 1.335, 1.498], start=1):
        gravar(f"popup-{n}.wav", popup(tom), pasta)
    # depois dos outros, para não mudar a sequência aleatória (e o som) dos já existentes
    for nome, fn in [("caneta.wav", caneta), ("obturador.wav", obturador), ("riser.wav", riser), ("chime.wav", chime)]:
        gravar(nome, fn(), pasta)
    print(f"SFX gerados em {pasta}")
