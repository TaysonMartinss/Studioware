"""Voz Chatterbox Multilingual (Resemble AI, MIT) como processo auxiliar do narrar.py.

Corre no ambiente .venv-voz (PyTorch + chatterbox-tts). Carrega o modelo uma vez e depois lê pedidos, um JSON por
linha no stdin: {"texto", "destino" (.wav), "idioma", "referencia" (wav da voz a clonar, opcional),
"intensidade" (0.25–2, emoção), "cfg" (0–1, ritmo/aderência), "semente"}. Responde uma linha "@@{json}" por pedido.
As outras linhas do stdout são da biblioteca e o narrar.py ignora-as.

Uso direto (teste): .venv-voz/Scripts/python scripts/voz_chatterbox.py --frase "Olá" saida.wav
"""
import json
import sys

import soundfile as sf
import torch


def responder(d):
    print("@@" + json.dumps(d, ensure_ascii=False), flush=True)


def carregar():
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    if torch.cuda.is_available():
        try:
            return ChatterboxMultilingualTTS.from_pretrained(device="cuda"), "cuda"
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()  # placa com pouca memória livre: usa o processador
    return ChatterboxMultilingualTTS.from_pretrained(device="cpu"), "cpu"


def gerar(modelo, p):
    torch.manual_seed(int(p.get("semente", 7)))  # a mesma fala dá o mesmo áudio
    kw = dict(language_id=p.get("idioma", "pt"), exaggeration=float(p.get("intensidade", 0.5)), cfg_weight=float(p.get("cfg", 0.5)))
    if p.get("referencia"):
        kw["audio_prompt_path"] = p["referencia"]
    wav = modelo.generate(p["texto"], **kw)
    # o torchaudio novo só grava com o torchcodec; o soundfile (vem com o librosa) chega para um WAV
    sf.write(p["destino"], wav.detach().cpu().squeeze().numpy(), modelo.sr, subtype="PCM_16")


def main():
    modelo, dispositivo = carregar()
    if "--frase" in sys.argv:
        i = sys.argv.index("--frase")
        gerar(modelo, {"texto": sys.argv[i + 1], "destino": sys.argv[i + 2]})
        print(f"ok ({dispositivo})")
        return
    responder({"pronto": True, "dispositivo": dispositivo, "sr": modelo.sr})
    for linha in sys.stdin:
        if not linha.strip():
            continue
        p = json.loads(linha)
        try:
            gerar(modelo, p)
            responder({"ok": True})
        except Exception as e:  # um erro numa frase não mata o processo
            responder({"erro": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
