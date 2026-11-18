import { useContext } from "react";
import { Html5Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { SfxCtx, SONS_ESTUDIO } from "./Sfx";
import catalogo from "../../public/sfx/catalogo.json";

// Sons de efeito populares (memes de edição) marcados num momento da fala. O catálogo (public/sfx/catalogo.json) diz,
// para cada som, o ficheiro (public/sfx/memes/, fora do git: são áudios de terceiros), quando usar, onde marcar e
// quantos segundos tocar. O guia que a IA segue sai do mesmo catálogo: node scripts/guia_sfx.mjs
type ItemSom = { arquivo: string; nome: string; categoria: string; quando: string; onde: string; maxS: number; volume: number; auto: boolean };
export const SONS_MEME = catalogo as Record<string, ItemSom>;
export type MarcaSom = { nome: string; emMs: number; volume?: number }; // emMs: desde o início da cena; volume: 1 = normal

// toca o som no momento marcado e baixa suavemente no fim (os longos ficam só nos primeiros segundos)
export const SomMeme: React.FC<{ som: MarcaSom }> = ({ som }) => {
  const { fps } = useVideoConfig();
  const geral = useContext(SfxCtx);
  const s = SONS_MEME[som.nome];
  const mult = som.volume ?? 1;
  if (geral <= 0) return null;
  // um efeito do estúdio (whoosh, impacto…) posto à mão: toca inteiro, com o peso de um efeito normal
  if (!s && (SONS_ESTUDIO as string[]).includes(som.nome)) return (
    <Sequence from={Math.max(0, Math.round((som.emMs / 1000) * fps))} durationInFrames={Math.round(fps * 4)} layout="none">
      <Html5Audio src={staticFile(`sfx/${som.nome}.wav`)} volume={0.6 * geral * mult} />
    </Sequence>
  );
  if (!s) return null;
  const dur = Math.max(1, Math.round(s.maxS * fps));
  const descida = Math.min(fps * 0.6, dur / 3);
  return (
    <Sequence from={Math.max(0, Math.round((som.emMs / 1000) * fps))} durationInFrames={dur} layout="none">
      <Html5Audio src={staticFile(`sfx/memes/${s.arquivo}`)} volume={(f) => mult * s.volume * Math.min(1, geral * 1.6) * interpolate(f, [dur - descida, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </Sequence>
  );
};
