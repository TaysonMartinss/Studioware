import { Sequence } from "remotion";
import { Cena, FPS } from "../types";
import { Sfx } from "./Sfx";

// Picos do vídeo: as revelações que o roteiro prepara com uma [pausa longa]. A narração deixa aí um silêncio
// (≥ 0,6 s entre duas palavras); a palavra a seguir é o golpe. Só os 2–3 maiores ganham som de clímax,
// senão nenhum se destaca (guias de som do claude-motion: um riser que acaba exatamente no golpe, camadas
// riser → impacto e um chime só na revelação principal).
export type Pico = { cena: number; frame: number; principal: boolean };

const SILENCIO_MS = 600;
export const RISER = 36; // 1,2 s: o riser.wav acaba no golpe

export const calcularPicos = (cenas: Cena[], maximo: number): Pico[] => {
  const porCena = new Map<number, { cena: number; frame: number; silencio: number }>();
  cenas.forEach((cena, i) => {
    if (cena.tipo === "cta" || cena.tipo === "clipe") return;
    const p = cena.palavras ?? [];
    for (let k = 1; k < p.length; k++) {
      const silencio = p[k].inicioMs - p[k - 1].fimMs;
      const frame = Math.round((p[k].inicioMs / 1000) * FPS);
      // o riser precisa de espaço antes do golpe dentro da cena
      if (silencio < SILENCIO_MS || frame < RISER * 0.6) continue;
      const atual = porCena.get(i);
      if (!atual || atual.silencio < silencio) porCena.set(i, { cena: i, frame, silencio });
    }
  });
  // o maior silêncio é a revelação principal (empate: a mais perto do fim, onde costuma estar o clímax)
  return [...porCena.values()]
    .sort((a, b) => b.silencio - a.silencio || b.cena - a.cena)
    .slice(0, maximo)
    .map((x, i) => ({ cena: x.cena, frame: x.frame, principal: i === 0 }));
};

// sons de um pico, em frames relativos ao início da cena
export const SonsPico: React.FC<{ frame: number; principal: boolean }> = ({ frame, principal }) => (
  <>
    <Sequence from={frame - RISER} durationInFrames={RISER + 4} layout="none"><Sfx nome="riser" volume={principal ? 0.34 : 0.26} /></Sequence>
    <Sequence from={frame} durationInFrames={20} layout="none"><Sfx nome="impacto" volume={principal ? 0.5 : 0.4} /></Sequence>
    {principal && <Sequence from={frame} durationInFrames={48} layout="none"><Sfx nome="chime" volume={0.28} /></Sequence>}
  </>
);
