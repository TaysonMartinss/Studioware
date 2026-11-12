import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadDMSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMono } from "@remotion/google-fonts/ShareTechMono";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadVT323 } from "@remotion/google-fonts/VT323";
import { loadFont as loadStix } from "@remotion/google-fonts/STIXTwoText";
import { createContext, useContext } from "react";
import { interpolate, random, spring, useCurrentFrame } from "remotion";
import { useEstilo } from "../estilos";

const LATIM = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };

// Fontes disponíveis para os estilos (chaves usadas em src/estilos.json)
export const FONTES: Record<string, string> = {
  anton: loadAnton("normal", LATIM).fontFamily,
  archivo: loadArchivo("normal", LATIM).fontFamily,
  kalam: loadKalam("normal", { ...LATIM, weights: ["400", "700"] }).fontFamily,
  inter: loadInter("normal", { ...LATIM, weights: ["600", "800", "900"] }).fontFamily,
  montserrat: loadMontserrat("normal", { ...LATIM, weights: ["800", "900"] }).fontFamily,
  marker: loadMarker("normal", { subsets: ["latin"] }).fontFamily,
  poppins: loadPoppins("normal", { ...LATIM, weights: ["500", "600", "700"] }).fontFamily,
  grotesk: loadGrotesk("normal", { ...LATIM, weights: ["500", "700"] }).fontFamily,
  vt323: loadVT323("normal", LATIM).fontFamily,
  orbitron: loadOrbitron("normal", { subsets: ["latin"], weights: ["700", "900"] }).fontFamily,
  mono: loadMono("normal", { subsets: ["latin"] }).fontFamily,
  serif: loadDMSerif("normal", { subsets: ["latin"] }).fontFamily,
  // serifa de livro de matemática (o mais próximo de Computer Modern no Google Fonts)
  stix: loadStix("normal", { subsets: ["latin", "latin-ext"], weights: ["500", "600"] }).fontFamily,
};

export const TITULO = FONTES.anton;
export const CORPO = FONTES.inter;

export const useFontes = () => {
  const e = useEstilo();
  return { titulo: FONTES[e.titulo] ?? TITULO, corpo: FONTES[e.corpo] ?? CORPO };
};

// Largura média de um caractere em maiúsculas, em "em", para cada fonte de título
const LARGURA_LETRA: Record<string, number> = {
  anton: 0.46, archivo: 0.72, kalam: 0.56, vt323: 0.45, serif: 0.58, stix: 0.56, inter: 0.66, mono: 0.6, grotesk: 0.64, poppins: 0.68, marker: 0.66, montserrat: 0.74, orbitron: 0.82,
};

// Tamanho de letra para o texto caber numa linha com a fonte de título do estilo (até ao máximo pedido)
export const useCaber = () => {
  const e = useEstilo();
  return (texto: string, largura: number, maximo: number) =>
    Math.min(maximo, Math.floor(largura / (Math.max(1, texto.length) * (LARGURA_LETRA[e.titulo] ?? 0.6))));
};

// Ritmo das entradas pela emoção da cena (tabela emoção → movimento do motion-design-skill da LottieFiles, MIT):
// surpresa = repentino e a expandir (150–300 ms), animado = saltitante (200–400 ms), tenso = seco e direto,
// sério = calmo e com peso (600–1200 ms). Vem da marca [tom: …] da fala; sem marca, ritmo normal.
export const RITMO_TOM: Record<string, number> = { surpresa: 1.3, animado: 1.18, tenso: 1.1, serio: 0.82, "sério": 0.82 };
export const RitmoCtx = createContext(1);
export const ritmoDaFala = (fala?: string) => RITMO_TOM[(fala ?? "").match(/\[tom:\s*([^\]]+)\]/i)?.[1]?.trim().toLowerCase() ?? ""] ?? 1;

// Frame atual da cena, no ritmo da emoção e "quantizado" no stop motion (estilo.passo > 1: anda aos solavancos)
export const useFrame = () => {
  const f = useCurrentFrame() * useContext(RitmoCtx);
  const { passo } = useEstilo();
  return passo > 1 ? Math.floor(f / passo) * passo : Math.round(f * 100) / 100;
};

export const AMARELO = "#ffd400";
export const ROXO = "#8b5cf6";

// Entrada "elástica" padrão de todos os elementos
export const pop = (frame: number, fps: number, delay = 0, damping = 11) =>
  spring({ frame: frame - delay, fps, config: { damping, stiffness: 180, mass: 0.6 } });

// Zoom punch: pico rápido que decai, disparado em cada frame de ênfase
export const zoomPunch = (frame: number, gatilhos: number[], forca = 0.07) =>
  gatilhos.reduce((s, g) => (frame >= g ? s + forca * Math.exp(-(frame - g) / 5) : s), 1);

// Camera shake que decai após o gatilho
export const shake = (frame: number, gatilhos: number[], forca = 22) => {
  let x = 0;
  let y = 0;
  for (const g of gatilhos) {
    if (frame < g || frame > g + 12) continue;
    const k = forca * Math.exp(-(frame - g) / 3.5);
    x += (random(`sx${frame}-${g}`) - 0.5) * 2 * k;
    y += (random(`sy${frame}-${g}`) - 0.5) * 2 * k;
  }
  return `translate(${x}px, ${y}px)`;
};

// clip-path com bordas irregulares de papel rasgado (determinístico pela semente)
export const bordaRasgada = (semente: string, dente = 2.2, pontos = 26) => {
  const lado = (eixo: (t: number, d: number) => string, s: string) =>
    Array.from({ length: pontos + 1 }, (_, i) => eixo((i / pontos) * 100, random(`${semente}${s}${i}`) * dente));
  return `polygon(${[
    ...lado((t, d) => `${t}% ${d}%`, "t"),
    ...lado((t, d) => `${100 - d}% ${t}%`, "r"),
    ...lado((t, d) => `${100 - t}% ${100 - d}%`, "b"),
    ...lado((t, d) => `${d}% ${100 - t}%`, "l"),
  ].join(", ")})`;
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const fade = (frame: number, ini: number, fim: number) => interpolate(frame, [ini, fim], [0, 1], clamp);

export const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]/g, "");
