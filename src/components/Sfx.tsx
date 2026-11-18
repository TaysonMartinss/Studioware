import { createContext, useContext } from "react";
import catalogoMemes from "../../public/sfx/catalogo.json";
import { RitmoCtx } from "./motion";
import { Html5Audio, Sequence, staticFile } from "remotion";
import { useEstilo } from "../estilos";

// Volume geral dos efeitos sonoros (whoosh, impacto, pop, clique). Cada efeito tem o seu peso relativo
// e é multiplicado por este valor; o roteiro pode ajustar com "sfxVolume".
export const SFX_PADRAO = 0.5;
export const SfxCtx = createContext(SFX_PADRAO);

export type SomSfx = "whoosh" | "impacto" | "pop" | "clique" | "popup-1" | "popup-2" | "popup-3" | "popup-4" | "rasgo" | "amassado" | "fita" | "cartao" | "caneta" | "obturador" | "riser" | "chime";
// os efeitos do estúdio (public/sfx/*.wav): também se podem pôr à mão na timeline do editor
export const SONS_ESTUDIO: SomSfx[] = ["whoosh", "impacto", "pop", "clique", "popup-1", "popup-2", "popup-3", "popup-4", "rasgo", "amassado", "fita", "cartao", "caneta", "obturador", "riser", "chime"];
const MEMES = catalogoMemes as Record<string, { arquivo: string; volume: number }>;
// trocas dos sons automáticos de uma cena (feitas no editor): { whoosh: "rasgo" } ou { clique: "nenhum" }
export const TrocaSonsCtx = createContext<Record<string, string> | undefined>(undefined);
// o ficheiro e o volume de base de um som pelo nome (efeito do estúdio ou meme do catálogo)
export const ficheiroSom = (nome: string): { src: string; volume: number } | null =>
  (SONS_ESTUDIO as string[]).includes(nome) ? { src: staticFile(`sfx/${nome}.wav`), volume: 1 } : MEMES[nome] ? { src: staticFile(`sfx/memes/${MEMES[nome].arquivo}`), volume: MEMES[nome].volume } : null;

export const Sfx: React.FC<{ nome: SomSfx; volume: number }> = ({ nome, volume }) => {
  const geral = useContext(SfxCtx);
  const { sons } = useEstilo();
  const trocas = useContext(TrocaSonsCtx);
  if (geral <= 0) return null;
  // o estilo pode trocar o som (ex.: no papel o whoosh vira um rasgo)
  const base = nome.startsWith("popup") ? "popup" : nome;
  // a cena pode trocar ou calar os seus sons automáticos (editor: Sons da cena)
  const troca = trocas?.[base];
  if (troca === "nenhum") return null;
  const outro = troca ? ficheiroSom(troca) : null;
  if (outro) return <Html5Audio src={outro.src} volume={volume * geral * outro.volume} />;
  const som = sons?.[base as keyof NonNullable<typeof sons>] ?? nome;
  return <Html5Audio src={staticFile(`sfx/${som}.wav`)} volume={volume * geral * (som === nome ? 1 : 0.8)} />;
};

// Um som marcado num frame da animação da cena: acompanha o ritmo da emoção (RitmoCtx), para não sair da imagem
export const Em: React.FC<{ de: number; dur?: number; children: React.ReactNode }> = ({ de, dur, children }) => {
  const ritmo = useContext(RitmoCtx);
  return <Sequence from={Math.round(de / ritmo)} durationInFrames={dur} layout="none">{children}</Sequence>;
};

// O som da passagem para uma cena: o whoosh, ou o que a cena escolheu no editor (somEntrada), ou nenhum
export const SomEntrada: React.FC<{ escolha?: string; volume: number }> = ({ escolha, volume }) => {
  const geral = useContext(SfxCtx);
  if (escolha === "nenhum") return null;
  if (!escolha) return <Sfx nome="whoosh" volume={volume} />;
  const s = ficheiroSom(escolha);
  if (!s || geral <= 0) return null;
  return <Sequence durationInFrames={120} layout="none"><Html5Audio src={s.src} volume={volume * geral * s.volume} /></Sequence>;
};
