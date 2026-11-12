"""Enquadramento automático (auto-reframe) de um vídeo horizontal para vertical 9:16, a seguir o rosto de quem fala.

Analisa o vídeo e escreve a trajetória da "câmara" (o x do corte em cada frame) num JSON; o corte faz-se no
render (Remotion), sem reprocessar o vídeo. O detetor de rostos é o YuNet do OpenCV (modelos/, Apache 2.0).

A lógica da câmara (SmoothedCameraman: tripé pesado com zona segura, confirmação de saltos grandes e corte
seco em mudanças de plano) e a escolha do orador (SpeakerTracker: identidade por posição, pontuação por
tamanho com decaimento, histerese e tempo mínimo entre trocas) foram adaptadas do openshorts
(github.com/mutonby/openshorts, licença MIT, Copyright (c) 2024 OpenShorts; ver scripts/licencas/).

Uso: python scripts/reframe.py entrada.mp4 saida.json
Saída: {"modo": "seguir" | "geral" | "passa" | "webcam", "largura", "altura", "fps", "cropLargura", "xs": [x do corte por frame]}
  passa = já é vertical; geral = nenhum rosto (fica o fundo desfocado); seguir = segue o rosto;
  webcam = gameplay com a webcam por cima (o vídeo fica dividido: webcam no topo, jogo ao centro em baixo);
    traz "segmentos": [{"de": frame, "cam": [x, y, w, h]}], o retângulo da webcam em cada trecho (muda com zooms da edição).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ASPETO = 9 / 16
DETECAO_LARGURA = 640  # o detetor corre numa cópia pequena (é o que pesa em CPU)
PASSO = 3  # deteta de 3 em 3 frames; a câmara interpola entre deteções
CONFIRMAR_SALTO = 3
LIMIAR_CORTE = 0.45  # diferença de histograma que conta como mudança de plano
MODELO = Path(__file__).resolve().parent.parent / "modelos" / "face_detection_yunet_2023mar.onnx"


GRAY_L = 256  # cópia cinzenta pequena guardada para achar as bordas da webcam


def detetar_webcam(registos, w, h):
    """Gameplay com webcam: um rosto pequeno, quase sempre no mesmo sítio, e o resto da imagem a mexer (o jogo).
    O retângulo da webcam sai das bordas paradas: com a média das arestas ao longo do trecho o jogo esbate-se
    e a moldura da webcam fica. Devolve [{de, cam}] ou None."""
    if len(registos) < 10:
        return None
    # cada deteção: rosto pequeno (webcam sobre o jogo), rosto grande (a edição cortou para a webcam em ecrã cheio) ou nada
    rostos, tipos = [], []
    for r in registos:
        grandes = [c for c in r["caixas"] if c[3] >= h * 0.26]
        caixas = grandes or [c for c in r["caixas"] if c[3] < h * 0.26]
        rostos.append(max(caixas, key=lambda c: c[2] * c[3]) if caixas else None)
        tipos.append(("g" if grandes else "p") if caixas else None)
    if tipos.count("p") < len(registos) * 0.35 or tipos.count("p") < tipos.count("g"):
        return None

    # trechos: corta quando há mudança de plano, o rosto muda muito de tamanho/sítio (zoom na edição)
    # ou passa de webcam pequena para ecrã cheio
    trechos, atual, ref = [], None, None
    for r, c, tp in zip(registos, rostos, tipos):
        mudou = False
        if c is not None and ref is not None:
            cx, cy = c[0] + c[2] / 2, c[1] + c[3] / 2
            mudou = tp != atual["tipo"] or abs(cx - ref[0]) > 1.6 * ref[2] or abs(cy - ref[1]) > 1.6 * ref[3] or not (0.75 < c[3] / ref[3] < 1.33)
        if atual is None or r["corte"] or mudou:
            atual = {"de": r["frame"], "regs": [], "rostos": [], "tipo": tp}
            trechos.append(atual)
            ref = None
        atual["regs"].append(r)
        if c is not None:
            atual["tipo"] = atual["tipo"] or tp
            if tp == atual["tipo"]:
                atual["rostos"].append(c)
            if ref is None:
                ref = (c[0] + c[2] / 2, c[1] + c[3] / 2, c[2], c[3])
    # trechos muito curtos ou sem rosto juntam-se ao anterior; sem rosto por 2 s ou mais (título, replay) fica à parte
    limpos = []
    for t in trechos:
        sem_rosto_longo = not t["rostos"] and len(t["regs"]) >= 20
        if limpos and not sem_rosto_longo and (len(t["regs"]) < 6 or not t["rostos"]):
            limpos[-1]["regs"] += t["regs"]
            if t["tipo"] == limpos[-1]["tipo"]:
                limpos[-1]["rostos"] += t["rostos"]
        else:
            limpos.append(t)
    if len(limpos) > 1 and not limpos[0]["rostos"] and len(limpos[0]["regs"]) < 20:
        limpos[1]["de"] = limpos[0]["de"]
        limpos[1]["regs"] = limpos[0]["regs"] + limpos[1]["regs"]
        limpos.pop(0)

    g = GRAY_L / w
    segmentos, mov_fora, mov_dentro = [], [], []
    for t in limpos:
        if not t["rostos"]:
            segmentos.append({"de": int(t["de"]), "geral": True})  # sem rosto: o frame inteiro com fundo desfocado
            continue
        fx, fy, fw, fh = [float(v) for v in np.median(np.array(t["rostos"], dtype=np.float32), axis=0)]
        if t["tipo"] == "g":
            # webcam em ecrã cheio: este trecho fica todo no rosto (corte vertical centrado nele)
            segmentos.append({"de": int(t["de"]), "rosto": [int(fx), int(fy), int(fw), int(fh)]})
            continue
        grays = [r["gray"] for r in t["regs"] if r.get("gray") is not None]
        cam = [fx - 1.6 * fw, fy - 0.9 * fh, 4.2 * fw, 2.9 * fh]  # proporção típica, se as bordas não aparecerem
        if len(grays) >= 4:
            pilha = [im.astype(np.float32) for im in grays]
            gx = np.mean([np.abs(cv2.Sobel(im, cv2.CV_32F, 1, 0, ksize=3)) for im in pilha], axis=0)
            gy = np.mean([np.abs(cv2.Sobel(im, cv2.CV_32F, 0, 1, ksize=3)) for im in pilha], axis=0)
            gh, gw = gx.shape
            X, Y, W, H = fx * g, fy * g, fw * g, fh * g

            def borda(mapa, eixo, de, ate, faixa_de, faixa_ate):
                lim = gw if eixo == "x" else gh
                de, ate = int(max(1, de)), int(min(lim - 2, ate))
                a, b = int(max(0, faixa_de)), int(min(gh if eixo == "x" else gw, faixa_ate))
                if ate - de < 2 or b - a < 2:
                    return None
                perfil = mapa[a:b, de:ate].mean(axis=0) if eixo == "x" else mapa[de:ate, a:b].mean(axis=1)
                fundo = float(np.median(mapa[a:b, :].mean(axis=0) if eixo == "x" else mapa[:, a:b].mean(axis=1))) + 1e-3
                k = int(np.argmax(perfil))
                return de + k if perfil[k] > fundo * 2.5 else None

            esq = borda(gx, "x", X - 3.0 * W, X - 0.15 * W, Y - 0.5 * H, Y + 1.8 * H)
            dir_ = borda(gx, "x", X + 1.15 * W, X + 5.0 * W, Y - 0.5 * H, Y + 1.8 * H)
            topo = borda(gy, "y", Y - 2.2 * H, Y - 0.1 * H, X - 0.5 * W, X + 1.5 * W)
            base = borda(gy, "y", Y + 1.2 * H, Y + 3.5 * H, X - 0.5 * W, X + 1.5 * W)
            x0 = esq / g if esq is not None else cam[0]
            x1 = dir_ / g if dir_ is not None else cam[0] + cam[2]
            y0 = topo / g if topo is not None else cam[1]
            y1 = base / g if base is not None else cam[1] + cam[3]
            cam = [x0, y0, x1 - x0, y1 - y0]
            print(f"  trecho {t['de']}: bordas esq={esq} dir={dir_} topo={topo} base={base}")
            # movimento dentro e fora da webcam (a gameplay mexe muito mais que o fundo de um podcast)
            dif = np.mean([cv2.absdiff(a, b) for a, b in zip(grays[1:], grays[:-1])], axis=0)
            m = np.zeros(dif.shape, dtype=bool)
            m[int(max(0, y0 * g)):int(y1 * g), int(max(0, x0 * g)):int(x1 * g)] = True
            if m.any() and (~m).any():
                mov_dentro.append(float(dif[m].mean()))
                mov_fora.append(float(dif[~m].mean()))
        x, y = max(0.0, cam[0]), max(0.0, cam[1])
        cw, ch = min(w - x, cam[0] + cam[2] - x), min(h - y, cam[1] + cam[3] - y)
        # tem de ser menor que meio ecrã e ter forma de webcam
        if cw * ch > w * h * 0.45 or not (0.8 < cw / max(ch, 1) < 2.6):
            print(f"  trecho {t['de']}: retângulo sem forma de webcam ({int(cw)}x{int(ch)})")
            return None
        segmentos.append({"de": int(t["de"]), "cam": [int(x), int(y), int(cw), int(ch)]})
    if not any("cam" in sg for sg in segmentos) or not mov_fora or np.mean(mov_fora) < 2.5:
        return None
    segmentos[0]["de"] = 0
    # a webcam tem sempre a mesma proporção: trechos fora dela (zoom a meio, borda falsa) são acertados à mediana
    asp = float(np.median([c["cam"][2] / c["cam"][3] for c in segmentos if "cam" in c]))
    for sg in (c for c in segmentos if "cam" in c):
        x, y, cw, ch = sg["cam"]
        if cw / ch > asp * 1.2:
            nh = min(h, cw / asp)
            y = y + ch / 2 - nh / 2
            ch = nh
        elif cw / ch < asp / 1.2:
            nw = min(w, ch * asp)
            x = x if x < w * 0.03 else (x + cw - nw if x + cw > w * 0.97 else x + cw / 2 - nw / 2)
            cw = nw
        x, y = min(max(0, x), w - cw), min(max(0, y), h - ch)
        sg["cam"] = [int(x), int(y), int(cw), int(ch)]
    print(f"webcam: {len(segmentos)} trecho(s), movimento fora {np.mean(mov_fora):.1f} / dentro {np.mean(mov_dentro):.1f}")
    return segmentos


class Camara:
    """Tripé pesado: só se mexe quando o alvo sai da zona segura; anda devagar e em linha reta."""

    def __init__(self, w, h):
        self.w = w
        self.crop_w = min(w, int(h * ASPETO))
        self.atual = w / 2
        self.alvo = w / 2
        self.zona = self.crop_w * 0.25
        self.pendente = None
        self.contagem = 0
        self.cortar = False
        # velocidades originais pensadas para 1080p; escalo pela resolução
        self.k = w / 1920

    def novo_plano(self):
        self.pendente = None
        self.contagem = 0
        self.cortar = True

    def atualizar(self, caixa):
        x, _y, cw, _ch = caixa
        centro = x + cw / 2
        if self.cortar:
            self.cortar = False
            self.pendente = None
            self.contagem = 0
            self.alvo = self.atual = centro
            return
        if abs(centro - self.alvo) > self.zona:
            # um salto grande tem de se repetir antes de a câmara o seguir (deteção errada some na seguinte)
            if self.pendente is not None and abs(centro - self.pendente) <= self.zona:
                self.contagem += 1
            else:
                self.pendente, self.contagem = centro, 1
            if self.contagem < CONFIRMAR_SALTO:
                return
        self.pendente = None
        self.contagem = 0
        self.alvo = centro

    def x_do_corte(self, forcar=False):
        if forcar:
            self.atual = self.alvo
        else:
            dif = self.alvo - self.atual
            if abs(dif) > self.zona:
                direcao = 1 if dif > 0 else -1
                vel = (15.0 if abs(dif) > self.crop_w * 0.5 else 3.0) * self.k
                self.atual += direcao * vel
                novo = self.alvo - self.atual
                if (direcao == 1 and novo < 0) or (direcao == -1 and novo > 0):
                    self.atual = self.alvo
        meio = self.crop_w / 2
        self.atual = min(max(self.atual, meio), self.w - meio)
        return int(self.atual - meio)


class Orador:
    """Decide para que rosto olhar: identidade por posição, pontuação por tamanho, histerese e tempo mínimo entre trocas."""

    def __init__(self, estabilizar=15, intervalo=30):
        self.intervalo = intervalo
        self.limpar()

    def limpar(self):
        self.ativo = None
        self.pontos = {}
        self.ultima_troca = -1000
        self.proximo = 0
        self.conhecidos = []

    def escolher(self, rostos, frame, w):
        candidatos = []
        for caixa in rostos:
            x, _y, cw, ch = caixa
            cx = x + cw / 2
            melhor, dmin = -1, w * 0.15
            for k in self.conhecidos:
                if frame - k["ultimo"] > 30:
                    continue
                d = abs(cx - k["centro"])
                if d < dmin:
                    dmin, melhor = d, k["id"]
            if melhor == -1:
                melhor = self.proximo
                self.proximo += 1
            self.conhecidos = [k for k in self.conhecidos if k["id"] != melhor] + [{"id": melhor, "centro": cx, "ultimo": frame}]
            candidatos.append({"id": melhor, "caixa": caixa, "area": cw * ch})
        for pid in list(self.pontos):
            self.pontos[pid] *= 0.85
            if self.pontos[pid] < 0.1:
                del self.pontos[pid]
        for c in candidatos:
            self.pontos[c["id"]] = self.pontos.get(c["id"], 0) + c["area"] / (w * w * 0.05)
        if not candidatos:
            return None
        melhor = max(candidatos, key=lambda c: self.pontos.get(c["id"], 0) * (3.0 if c["id"] == self.ativo else 1.0))
        if melhor["id"] == self.ativo:
            return melhor["caixa"]
        if frame - self.ultima_troca < self.intervalo:
            antigo = next((c for c in candidatos if c["id"] == self.ativo), None)
            return antigo["caixa"] if antigo else None
        self.ativo = melhor["id"]
        self.ultima_troca = frame
        return melhor["caixa"]


def main():
    entrada, saida = sys.argv[1], sys.argv[2]
    cap = cv2.VideoCapture(entrada)
    if not cap.isOpened():
        raise SystemExit(f"não consegui abrir {entrada}")
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    base = {"largura": w, "altura": h, "fps": fps}
    if w / h <= ASPETO * 1.01:
        Path(saida).write_text(json.dumps({"modo": "passa", **base}))
        return

    escala = w / DETECAO_LARGURA if w > DETECAO_LARGURA else 1.0
    pw, ph = int(w / escala), int(h / escala)
    detetor = cv2.FaceDetectorYN.create(str(MODELO), "", (pw, ph), 0.75, 0.3, 50)
    camara, orador = Camara(w, h), Orador()
    xs, hist_ant, cinza_ant, frame, com_rosto, com_movimento = [], None, None, 0, 0, 0
    registos, ndet = [], 0  # rostos de cada deteção (e de 2 em 2 uma cópia cinzenta) para a deteção de webcam

    while True:
        ok = cap.grab()
        if not ok:
            break
        inicio_plano = False
        if frame % PASSO == 0 or frame == 0:
            ok, img = cap.retrieve()
            if ok:
                pequeno = cv2.resize(img, (pw, ph), interpolation=cv2.INTER_AREA)
                # mudança de plano: o histograma de cor muda muito de uma deteção para a outra
                hsv = cv2.cvtColor(cv2.resize(pequeno, (64, 36)), cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256])
                cv2.normalize(hist, hist)
                if hist_ant is not None and cv2.compareHist(hist_ant, hist, cv2.HISTCMP_BHATTACHARYYA) > LIMIAR_CORTE:
                    inicio_plano = True
                    orador.limpar()
                    camara.novo_plano()
                hist_ant = hist
                _, rostos = detetor.detect(pequeno)
                caixas = [[int(v * escala) for v in r[:4]] for r in (rostos if rostos is not None else [])]
                gray = cv2.cvtColor(cv2.resize(pequeno, (GRAY_L, int(GRAY_L * h / w))), cv2.COLOR_BGR2GRAY) if ndet % 2 == 0 else None
                registos.append({"frame": frame, "corte": inicio_plano, "caixas": caixas, "gray": gray})
                ndet += 1
                alvo = orador.escolher(caixas, frame, w)
                # sem rosto (desporto, planos abertos): segue o centro do movimento na imagem
                cinza = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(pequeno, (160, 90)), cv2.COLOR_BGR2GRAY), (5, 5), 0)
                if alvo:
                    camara.atualizar(alvo)
                    com_rosto += 1
                elif cinza_ant is not None and not inicio_plano:
                    mov = cv2.absdiff(cinza, cinza_ant).astype(np.float32)
                    mov[mov < 18] = 0
                    massa = mov.sum()
                    if massa > 160 * 90 * 1.5:
                        cx = float((mov.sum(axis=0) * np.arange(160)).sum() / massa) * w / 160
                        camara.atualizar([int(cx - 10), 0, 20, 20])
                        com_movimento += 1
                cinza_ant = cinza
        xs.append(camara.x_do_corte(forcar=frame == 0 or inicio_plano))
        frame += 1
    cap.release()

    segmentos = detetar_webcam(registos, w, h)
    if segmentos:
        Path(saida).write_text(json.dumps({"modo": "webcam", **base, "segmentos": segmentos}, separators=(",", ":")))
        return
    deteccoes = max(1, (frame + PASSO - 1) // PASSO)
    # quase sem rostos (gravação de ecrã, paisagem): fica o fundo desfocado
    if (com_rosto + com_movimento) / deteccoes < 0.15:
        Path(saida).write_text(json.dumps({"modo": "geral", **base}))
        return
    Path(saida).write_text(json.dumps({"modo": "seguir", **base, "cropLargura": camara.crop_w, "xs": xs}, separators=(",", ":")))
    print(f"enquadramento: {frame} frames, rosto em {100 * com_rosto // deteccoes}% e movimento em {100 * com_movimento // deteccoes}% das deteções")


if __name__ == "__main__":
    main()
