import { createContext, useContext } from "react";
import dados from "./estilos.json";

// Estilos de edição (também lidos pelo painel em server/). Para criar um estilo novo basta acrescentá-lo ao JSON.
export type Estilo = {
  nome: string;
  descricao: string;
  cor: string; // destaque principal
  cor2: string; // destaque secundário
  fundo: string;
  corTexto: string;
  sombra: string; // text-shadow dos títulos
  superficie: string; // painéis translúcidos (tags, barras)
  tema: "grelha" | "gradiente" | "solido" | "papel" | "estrelas" | "claro" | "synthwave" | "hud" | "cartesiano" | "mundo3d" | "editorial";
  overlay: "scan" | "vhs" | "hud" | "papel" | "grao" | null;
  transicao: "whip" | "corte" | "suave" | "papel" | "forma" | "vhs" | "hud" | "voo" | "folha";
  legenda: "padrao" | "hormozi" | "papel" | "pilula" | "elegante" | "neon" | "hud" | "marcador" | "aquarela";
  titulo: string; // chave de FONTES em components/motion.ts
  corpo: string;
  glitch: boolean;
  shake: number; // multiplicador do camera shake
  flash: number; // opacidade do flash nas transições
  passo: number; // >1 = stop motion (2.5 a 30 fps ≈ 12 fps)
  raio: number; // raio dos cantos de cartões e painéis
  brilho: boolean; // glow só onde faz parte do género (neon, VHS, HUD)
  // opcionais (guia de produção por estilo)
  tracking?: string; // letter-spacing dos títulos (ex.: "-0.03em" no Hormozi)
  glowRaio?: number; // glow largo e suave (explicativo: 150px a 35%)
  glowForca?: number;
  easing?: [number, number, number, number]; // curva bezier das entradas
  margem?: number; // margem lateral (corporativo: 15% = conteúdo a 70% da largura)
  paleta?: string[]; // cores dos gráficos por categoria
  area?: string; // preenchimento de áreas em gráficos de linha (ciência)
  fundoCentro?: string; // centro do gradiente radial do fundo
  sombraInterna?: boolean; // volume de ilustração 2D nos painéis
  entrada?: "padrao" | "bounce" | "mascara" | "escrever";
  iconesPalavras?: boolean; // ícone surge com a palavra-chave (Hormozi)
  rgbSplit?: number; // aberração cromática no ecrã inteiro (px)
  pilula?: { fundo: string; texto: string };
  textura?: "jornal" | "aquarela"; // editorial (Vox): papel creme, pontos de meio-tom, fotos em meio-tom com sombra dura
  oculto?: boolean; // fora do painel (continua a renderizar os vídeos antigos que o usam)
  pixel?: { tamanho: number; niveis: number }; // Pixel 3D: blocos de `tamanho` px com dithering e `niveis` tons por canal
  sons?: Partial<Record<"whoosh" | "impacto" | "pop" | "clique" | "popup", string>>;
};

export const ESTILOS = dados as unknown as Record<string, Estilo>;

export const EstiloCtx = createContext<Estilo>(ESTILOS.neon);
export const useEstilo = () => useContext(EstiloCtx);
