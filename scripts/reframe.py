"""Enquadramento automático (auto-reframe) de um vídeo horizontal para vertical 9:16, a seguir o rosto de quem fala.

Analisa o vídeo e escreve a trajetória da "câmara" (o x do corte em cada frame) num JSON; o corte faz-se no
render (Remotion), sem reprocessar o vídeo. O detetor de rostos é o YuNet do OpenCV (modelos/, Apache 2.0).

A lógica da câmara (SmoothedCameraman: tripé pesado com zona segura, confirmação de saltos grandes e corte
seco em mudanças de plano) e a escolha do orador (SpeakerTracker: identidade por posição, pontuação por
tamanho com decaimento, histerese e tempo mínimo entre trocas) foram adaptadas do openshorts
(github.com/mutonby/openshorts, licença MIT, Copyright (c) 2024 OpenShorts; ver scripts/licencas/).

Uso: python scripts/reframe.py entrada.mp4 saida.json
Saída: {"modo": "seguir" | "geral" | "passa", "largura", "altura", "fps", "cropLargura", "xs": [x do corte por frame]}
  passa = já é vertical; geral = nenhum rosto (fica o fundo desfocado); seguir = segue o rosto.
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

    deteccoes = max(1, (frame + PASSO - 1) // PASSO)
    # quase sem rostos (gravação de ecrã, paisagem): fica o fundo desfocado
    if (com_rosto + com_movimento) / deteccoes < 0.15:
        Path(saida).write_text(json.dumps({"modo": "geral", **base}))
        return
    Path(saida).write_text(json.dumps({"modo": "seguir", **base, "cropLargura": camara.crop_w, "xs": xs}, separators=(",", ":")))
    print(f"enquadramento: {frame} frames, rosto em {100 * com_rosto // deteccoes}% e movimento em {100 * com_movimento // deteccoes}% das deteções")


if __name__ == "__main__":
    main()
