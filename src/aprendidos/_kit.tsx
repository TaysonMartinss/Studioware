// Kit para os módulos de efeitos dos estilos aprendidos ("Aprendo com seu exemplo").
// Cada estilo aprendido tem um ficheiro src/aprendidos/<id>.tsx que exporta `efeitos: EfeitosEstilo`.
// Tudo o que um módulo precisa vem daqui (ou do remotion/react): não importa outras partes do estúdio.
import { useId } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Estilo } from "../estilos";

export { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig };
export type { Estilo };

// estado de cada palavra da legenda (igual ao das legendas do estúdio)
export type EstadoPalavra = {
  s: number; // 0→1 a entrada da palavra (mola)
  local: number; // frames desde que a palavra começou
  ativa: boolean; // a palavra está a ser dita agora
  destaque: boolean; // palavra-chave do roteiro
  negativa: boolean; // palavra de carga negativa (perigo, perda)
  ordem: number; // posição entre os destaques
  i: number; // posição na página
  semente: string; // para random() estável
  etapa: number; // frame (ou passo do stop motion)
};
export type VarianteLegenda = {
  porPagina: number; // palavras por página (1 a 5)
  top: number; // posição vertical da legenda (px, ecrã 1080x1920)
  bloco: (e: Estilo) => React.CSSProperties; // tipografia do bloco (fontFamily, fontSize, gap…)
  palavra: (e: Estilo, cor: string, x: EstadoPalavra) => React.CSSProperties; // estilo animado de cada palavra
  maiusculas?: boolean;
};

export type EfeitosEstilo = {
  // fundo de ecrã inteiro (por trás das cenas); substitui o fundo do tema
  Fundo?: React.FC<{ cor: string }>;
  // envolve o conteúdo de cada cena: câmara 3D, entrada/saída (transição), motion blur, composição
  Cena?: React.FC<{ children: React.ReactNode; indice: number; duracao: number; cor: string }>;
  // camada por cima de tudo (luzes, grão, vinheta, molduras), sem tapar a leitura
  Overlay?: React.FC<{ cor: string }>;
  // animação própria das legendas
  legenda?: VarianteLegenda;
};

// ---------- peças prontas ----------

// progresso 0→1 entre dois frames, com curva
export const progresso = (f: number, de: number, ate: number, curva: (t: number) => number = Easing.bezier(0.65, 0, 0.35, 1)) =>
  interpolate(f, [de, ate], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: curva });

// câmara 3D (como uma câmara do After Effects com um nulo): perspetiva + posição + rotação aplicadas aos filhos.
// Os filhos podem usar transform: translateZ(...) com transformStyle "preserve-3d" para ficarem a profundidades diferentes.
export const Camara3D: React.FC<{
  children: React.ReactNode; perspetiva?: number; x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; escala?: number;
}> = ({ children, perspetiva = 1400, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, escala = 1 }) => (
  <AbsoluteFill style={{ perspective: perspetiva, perspectiveOrigin: "50% 45%", overflow: "hidden" }}>
    <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `translate3d(${-x}px, ${-y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${escala})` }}>
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

// motion blur direcional: desfoca na direção do movimento, proporcional à velocidade (px por frame).
// Ex.: numa transição que desliza 120 px/frame na horizontal, <DesfoqueMovimento vx={120}>.
export const DesfoqueMovimento: React.FC<{ children: React.ReactNode; vx?: number; vy?: number; forca?: number }> = ({ children, vx = 0, vy = 0, forca = 0.35 }) => {
  const id = `mb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const sx = Math.min(60, Math.abs(vx) * forca), sy = Math.min(60, Math.abs(vy) * forca);
  if (sx < 0.3 && sy < 0.3) return <>{children}</>;
  return (
    <AbsoluteFill style={{ filter: `url(#${id})` }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${sx} ${sy}`} /></filter>
      </svg>
      {children}
    </AbsoluteFill>
  );
};

// velocidade de um valor animado (para o motion blur): diferença entre este frame e o anterior
export const velocidade = (valor: (f: number) => number, f: number) => valor(f) - valor(f - 1);

// frame atual e duração da composição dentro de um componente
export const useTempo = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  return { f, fps, duracao: durationInFrames, L: width, A: height };
};
