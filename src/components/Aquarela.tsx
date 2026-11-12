import { AbsoluteFill } from "remotion";
import { Estilo } from "../estilos";

// Tinta e aquarela (receita "brush ink + watercolour" do claude-animation-skill, MIT, feita aqui com filtros SVG):
// papel de fibra creme, traço de tinta escura nos contornos que "ferve" a 10 fps (3 variantes da mesma linha),
// cores lavadas que escurecem nas bordas (a aguada a acumular) e granulação do pigmento.

const VARIANTES = 3;
export const etapaTinta = (f: number) => Math.floor(f / 3) % VARIANTES; // 10 fps

// Filtro para desenhos (SVG) e imagens: contorno de tinta + aguada + granulação. Um por variante, para a linha ferver.
export const FiltrosAquarela: React.FC<{ tinta?: string }> = ({ tinta = "#2A2420" }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    {Array.from({ length: VARIANTES }, (_, k) => (
      <filter key={k} id={`aquarela-${k}`} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
        {/* o traço treme: as bordas deslocam-se um pouco, de forma diferente em cada variante */}
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={k * 11 + 4} result="ondas" />
        <feDisplacementMap in="SourceGraphic" in2="ondas" scale={7} xChannelSelector="R" yChannelSelector="G" result="tremido" />
        {/* aguada: cores mais claras e menos saturadas, como pigmento diluído em água */}
        <feColorMatrix in="tremido" type="saturate" values="1.2" result="lavado0" />
        <feComponentTransfer in="lavado0" result="lavado">
          <feFuncR type="linear" slope="0.64" intercept="0.36" />
          <feFuncG type="linear" slope="0.64" intercept="0.33" />
          <feFuncB type="linear" slope="0.62" intercept="0.28" />
        </feComponentTransfer>
        {/* a aguada acumula-se junto às bordas: a versão desfocada, um pouco mais escura, por baixo da lavada */}
        <feGaussianBlur in="lavado" stdDeviation={2.5} result="borrado" />
        <feComposite in="lavado" in2="borrado" operator="arithmetic" k1={0} k2={1.35} k3={-0.35} k4={0} result="aguada" />
        {/* contorno de tinta: deteção de arestas, só as fortes, em tinta escura */}
        <feConvolveMatrix in="tremido" order={3} kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" result="arestas" />
        <feColorMatrix in="arestas" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 2.6 2.6 0 -0.28" result="mascaraTinta" />
        <feFlood floodColor={tinta} result="cor" />
        <feComposite in="cor" in2="mascaraTinta" operator="in" result="tinta" />
        {/* granulação do pigmento */}
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={k + 2} result="grao" />
        <feColorMatrix in="grao" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.22 0" result="grao2" />
        <feComposite in="grao2" in2="SourceAlpha" operator="in" result="graoNaForma" />
        <feMerge>
          <feMergeNode in="aguada" />
          <feMergeNode in="graoNaForma" />
          <feMergeNode in="tinta" />
        </feMerge>
      </filter>
    ))}
  </svg>
);

// Papel de aquarela: fibra, leve vinheta quente e duas manchas de aguada que respiram
export const PapelAquarela: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => {
  const r = Math.sin(f / 70) * 1.5;
  return (
    <>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 30% 20%, #0000000a 0 1px, transparent 2px), radial-gradient(circle at 70% 70%, #00000008 0 1.5px, transparent 2.5px)", backgroundSize: "9px 9px, 13px 13px" }} />
      <div style={{ position: "absolute", left: -260, top: 1100, width: 860, height: 760, borderRadius: "46% 54% 38% 62% / 52% 40% 60% 48%", background: `radial-gradient(ellipse at 45% 45%, ${e.cor2}30, ${e.cor2}14 55%, ${e.cor2}2a 70%, transparent 72%)`, transform: `rotate(${-8 + r}deg)`, filter: "blur(2px)" }} />
      <div style={{ position: "absolute", right: -220, top: -120, width: 700, height: 640, borderRadius: "58% 42% 55% 45% / 45% 58% 42% 55%", background: `radial-gradient(ellipse at 50% 55%, ${e.cor}24, ${e.cor}10 55%, ${e.cor}22 70%, transparent 72%)`, transform: `rotate(${12 - r}deg)`, filter: "blur(2px)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, #8a6a4a22 100%)" }} />
    </>
  );
};
