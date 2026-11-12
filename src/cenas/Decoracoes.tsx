import { random } from "remotion";
import { FONTES, pop } from "../components/motion";

// Elementos decorativos do estilo Editorial 3D (como no After Effects: formas, setas, códigos de barras e textos
// pequenos, recoloridos só com as cores da cena). Ficam nas margens, a profundidades diferentes; os que estão
// muito à frente ou muito atrás ficam desfocados (profundidade de campo). Mudam a cada frase e entram um a um.

const TEXTOS = ["FIG. 0#", "VOL. 01", "N° 00#", "[ 00:0# ]", "EDIÇÃO 2026", "↘ LEIA", "PT—BR", "/ 0# /", "ÍNDICE", "§ 0#"];
const TIPOS = ["seta", "barras", "circulo", "quadrado", "cruzes", "texto", "ponto", "texto", "seta", "barras"] as const;
type Tipo = (typeof TIPOS)[number];

// planos: atrás (desfoque leve), meio (nítido) e à frente (maior e bem desfocado)
const PLANOS = [
  { z: -320, blur: 2.5, escala: 1 },
  { z: 120, blur: 0, escala: 1 },
  { z: 340, blur: 7, escala: 1.5 },
];

const Elemento: React.FC<{ tipo: Tipo; tinta: string; cor: string; semente: string }> = ({ tipo, tinta, cor, semente }) => {
  const r = (k: string) => random(`${semente}${k}`);
  const destaque = r("c") > 0.6 ? cor : tinta;
  if (tipo === "seta") {
    const w = 140 + r("w") * 120;
    return (
      <svg width={w + 20} height={30} style={{ transform: `rotate(${(r("a") - 0.5) * 90}deg)` }}>
        <path d={`M 4 15 L ${w} 15 M ${w - 16} 5 L ${w} 15 L ${w - 16} 25`} stroke={destaque} strokeWidth={3} fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (tipo === "barras") {
    let x = 0;
    const barras: React.ReactNode[] = [];
    for (let i = 0; x < 150; i++) {
      const w = 2 + Math.floor(r(`b${i}`) * 4) * 2;
      if (r(`v${i}`) > 0.35) barras.push(<rect key={i} x={x} y={0} width={w} height={70} fill={tinta} />);
      x += w + 2;
    }
    return (
      <div style={{ textAlign: "center" }}>
        <svg width={152} height={70}>{barras}</svg>
        <div style={{ fontFamily: FONTES.mono, fontSize: 18, color: tinta, letterSpacing: "0.15em" }}>{String(Math.floor(r("n") * 1e8)).padStart(8, "0")}</div>
      </div>
    );
  }
  if (tipo === "circulo") {
    const d = 80 + r("d") * 120;
    return <div style={{ width: d, height: d, borderRadius: "50%", border: `3px solid ${destaque}` }} />;
  }
  if (tipo === "quadrado") {
    const d = 60 + r("d") * 90;
    return <div style={{ width: d, height: d, border: `3px solid ${tinta}`, transform: `rotate(${(r("a") - 0.5) * 50}deg)` }} />;
  }
  if (tipo === "cruzes") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gap: 14, color: destaque, fontFamily: FONTES.mono, fontSize: 34, lineHeight: 1 }}>
        {Array.from({ length: 9 }, (_, i) => <span key={i}>+</span>)}
      </div>
    );
  }
  if (tipo === "ponto") {
    const d = 26 + r("d") * 30;
    return <div style={{ width: d, height: d, borderRadius: "50%", background: cor }} />;
  }
  const texto = TEXTOS[Math.floor(r("t") * TEXTOS.length)].replace("#", String(1 + Math.floor(r("n") * 9)));
  return <div style={{ fontFamily: FONTES.mono, fontSize: 30, letterSpacing: "0.22em", color: destaque, whiteSpace: "nowrap" }}>{texto}</div>;
};

export const Decoracoes: React.FC<{ bloco: number; inicio: number; f: number; fps: number; L: number; A: number; tinta: string; cor: string; quantos?: number; evitar?: [number, number] }> = ({
  bloco, inicio, f, fps, L, A, tinta, cor, quantos = 6, evitar,
}) => (
  <>
    {Array.from({ length: quantos }, (_, i) => {
      const semente = `dec${bloco}-${i}`;
      const r = (k: string) => random(`${semente}${k}`);
      const tipo = TIPOS[Math.floor(r("tipo") * TIPOS.length)];
      const plano = PLANOS[i % 3];
      // nas margens: alterna entre a faixa esquerda e a direita, a alturas espalhadas
      const esquerda = i % 2 === 0;
      const x = (esquerda ? 0.05 + r("x") * 0.12 : 0.83 + r("x") * 0.12) * L;
      let y = (0.06 + ((i + r("y")) / quantos) * 0.86) * A;
      // fora da faixa do texto (para não competir com as palavras): sobe para cima ou desce para baixo dela
      if (evitar && y > evitar[0] - 60 && y < evitar[1] + 60) y = i % 4 < 2 ? Math.max(0.05 * A, evitar[0] - 90 - r("s") * 120) : Math.min(0.94 * A, evitar[1] + 90 + r("s") * 160);
      // textos e setas presos à margem (crescem para dentro do ecrã); o resto centrado no ponto
      const ancora = tipo === "texto" || tipo === "seta" || tipo === "barras" ? (esquerda ? "0%" : "-100%") : "-50%";
      const s = pop(f, fps, inicio + Math.round(i * 0.12 * fps), 9);
      const deriva = Math.sin((f + i * 30) / 50) * 10;
      return (
        <div key={i} style={{
          position: "absolute", left: x, top: y + deriva,
          transform: `translate(${ancora}, -50%) translateZ(${plano.z}px) scale(${plano.escala * (0.7 + 0.3 * s)})`,
          opacity: Math.min(1, s * 1.4) * (plano.z < 0 ? 0.75 : 1),
          filter: plano.blur ? `blur(${plano.blur}px)` : undefined,
        }}>
          <Elemento tipo={tipo} tinta={tinta} cor={cor} semente={semente} />
        </div>
      );
    })}
  </>
);
