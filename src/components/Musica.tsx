import { useMemo } from "react";
import { Html5Audio, staticFile, useVideoConfig } from "remotion";
import { FPS, Manifest, framesDaCena } from "../types";

const SOB_VOZ = 0.07; // música por baixo da narração
const NAS_PAUSAS = 0.2; // sobe nas pausas e transições
const SUAVIZAR = 6; // frames para subir/descer (sem "bombar")
const FADE_IN = 15;
const FADE_OUT = 45;

// Música de fundo com ducking: baixa enquanto há voz e sobe nas pausas, com fade-in e fade-out
export const Musica: React.FC<{ manifest: Manifest }> = ({ manifest }) => {
  const { durationInFrames } = useVideoConfig();
  const ganho = manifest.musicaVolume ?? 1;

  // curva de volume pré-calculada frame a frame a partir dos tempos de cada palavra
  const curva = useMemo(() => {
    const fala = new Uint8Array(durationInFrames);
    let inicio = 0;
    for (const cena of manifest.cenas) {
      for (const p of cena.palavras ?? []) {
        // margem de ~0,15 s antes e depois de cada palavra, para não subir entre palavras seguidas
        const a = Math.max(0, inicio + Math.floor((p.inicioMs / 1000) * FPS) - 4);
        const b = Math.min(durationInFrames - 1, inicio + Math.ceil((p.fimMs / 1000) * FPS) + 5);
        fala.fill(1, a, b + 1);
      }
      inicio += framesDaCena(cena);
    }
    const alvo = Array.from(fala, (v) => (v ? SOB_VOZ : NAS_PAUSAS));
    // média móvel para as transições ficarem suaves
    const suave = alvo.map((_, i) => {
      let soma = 0;
      let n = 0;
      for (let k = Math.max(0, i - SUAVIZAR); k <= Math.min(alvo.length - 1, i + SUAVIZAR); k++) {
        soma += alvo[k];
        n++;
      }
      return soma / n;
    });
    return suave.map((v, i) => v * Math.min(1, i / FADE_IN) * Math.min(1, (durationInFrames - 1 - i) / FADE_OUT));
  }, [manifest.cenas, durationInFrames]);

  if (!manifest.musica) return null;
  return <Html5Audio src={staticFile(manifest.musica)} loop volume={(f) => (curva[f] ?? 0) * ganho} />;
};
