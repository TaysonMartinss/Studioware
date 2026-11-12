import { AbsoluteFill, random, useVideoConfig } from "remotion";
import { FONTES, pop, useFrame } from "../components/motion";
import { useOndular } from "../components/PapelMotion";
import { CenaPalavras } from "../types";

// Palavras gigantes (tipografia de cartaz): 1 a 4 palavras em letra condensada, vermelho e branco, que entram
// uma a uma em posições e ângulos diferentes, com os contornos a ondular. Para o conceito-chave da fala
// ("PROCRASTINAÇÃO", "MEDO", "475 MILHÕES"). Fundo de papel amarrotado ou escuro.
const VERMELHO = "#e3262f";
const LUGARES: Record<number, [number, number][]> = {
  1: [[0.5, 0.42]],
  2: [[0.42, 0.33], [0.58, 0.5]],
  3: [[0.4, 0.27], [0.62, 0.41], [0.45, 0.55]],
  4: [[0.38, 0.22], [0.64, 0.34], [0.4, 0.46], [0.6, 0.58]],
};

export const Palavras: React.FC<{ cena: CenaPalavras; cor: string }> = ({ cena }) => {
  const f = useFrame();
  const { fps, width: L, height: A } = useVideoConfig();
  const ondular = useOndular();
  const palavras = (cena.textos ?? []).slice(0, 4).map((p) => p.toUpperCase());
  const papel = cena.fundo === "papel";
  const lugares = LUGARES[Math.max(1, palavras.length)] ?? LUGARES[4];
  // cada palavra entra ~0,4 s depois da anterior (ou no segundo pedido em "quando")
  return (
    <AbsoluteFill style={{
      background: papel
        ? "radial-gradient(ellipse at 40% 30%, #f1eee8, #d9d4ca 70%, #c9c2b6)"
        : "radial-gradient(ellipse at 50% 40%, #1d1013, #09070a 70%)",
    }}>
      {/* textura: vincos do papel ou grão no escuro */}
      <AbsoluteFill style={{ opacity: papel ? 0.35 : 0.18, mixBlendMode: papel ? "multiply" : "screen", backgroundImage: `repeating-linear-gradient(${papel ? 37 : 0}deg, #0000 0 22px, #00000014 22px 23px), repeating-linear-gradient(${papel ? 121 : 90}deg, #0000 0 31px, #ffffff10 31px 32px)` }} />
      {palavras.map((p, i) => {
        const inicio = Math.round((cena.quando?.[i] ?? i * 0.4) * fps);
        if (f < inicio) return null;
        const s = pop(f, fps, inicio, 10);
        const [x, y] = lugares[i] ?? [0.5, 0.5];
        // letra condensada (Anton): ~0,46 da altura por letra; a palavra ocupa no máximo 92% da largura
        const tamanho = Math.min(palavras.length === 1 ? 300 : 210, (L * 0.86) / (Math.max(3, p.length) * 0.5));
        const vermelha = i % 2 === 0 || papel;
        return (
          <div key={i} style={{
            position: "absolute", left: x * L, top: y * A, transform: `translate(-50%, -50%) rotate(${(random(`pv${p}${i}`) - 0.5) * 9}deg) scale(${1.25 - 0.25 * s})`,
            opacity: Math.min(1, s * 1.6), whiteSpace: "nowrap",
            fontFamily: FONTES.anton, fontSize: tamanho, lineHeight: 1, letterSpacing: "-0.01em",
            color: vermelha ? VERMELHO : "#f4f1ea",
            textShadow: papel ? "3px 4px 0 #0000001f" : `0 0 30px ${VERMELHO}55, 0 8px 0 #000`,
            filter: ondular(`pv${i}`),
          }}>
            {p}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
