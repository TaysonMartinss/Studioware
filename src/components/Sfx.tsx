import { createContext, useContext } from "react";
import { RitmoCtx } from "./motion";
import { Html5Audio, Sequence, staticFile } from "remotion";
import { useEstilo } from "../estilos";

// Volume geral dos efeitos sonoros (whoosh, impacto, pop, clique). Cada efeito tem o seu peso relativo
// e é multiplicado por este valor; o roteiro pode ajustar com "sfxVolume".
export const SFX_PADRAO = 0.5;
export const SfxCtx = createContext(SFX_PADRAO);

export type SomSfx = "whoosh" | "impacto" | "pop" | "clique" | "popup-1" | "popup-2" | "popup-3" | "popup-4" | "rasgo" | "amassado" | "fita" | "cartao" | "caneta" | "obturador" | "riser" | "chime";

export const Sfx: React.FC<{ nome: SomSfx; volume: number }> = ({ nome, volume }) => {
  const geral = useContext(SfxCtx);
  const { sons } = useEstilo();
  if (geral <= 0) return null;
  // o estilo pode trocar o som (ex.: no papel o whoosh vira um rasgo)
  const base = nome.startsWith("popup") ? "popup" : nome;
  const som = sons?.[base as keyof NonNullable<typeof sons>] ?? nome;
  return <Html5Audio src={staticFile(`sfx/${som}.wav`)} volume={volume * geral * (som === nome ? 1 : 0.8)} />;
};

// Um som marcado num frame da animação da cena: acompanha o ritmo da emoção (RitmoCtx), para não sair da imagem
export const Em: React.FC<{ de: number; dur?: number; children: React.ReactNode }> = ({ de, dur, children }) => {
  const ritmo = useContext(RitmoCtx);
  return <Sequence from={Math.round(de / ritmo)} durationInFrames={dur} layout="none">{children}</Sequence>;
};
