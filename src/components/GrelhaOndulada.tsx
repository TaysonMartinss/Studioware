import { AbsoluteFill, useVideoConfig } from "remotion";

// Fundo preto com uma grelha de linhas brancas finas, ligeiramente onduladas (como desenhada à mão):
// o padrão de linhas passa por um deslocamento de turbulência de baixa frequência. Usado em todos os fundos pretos.
export const GrelhaOndulada: React.FC<{ passo?: number; opacidade?: number; preto?: boolean }> = ({ passo = 72, opacidade = 0.5, preto = true }) => {
  const { width: L, height: A } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: preto ? "#000" : undefined }}>
      <svg width={L} height={A} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="grelha-celula" width={passo} height={passo} patternUnits="userSpaceOnUse">
            <path d={`M ${passo} 0 L 0 0 0 ${passo}`} fill="none" stroke="#fff" strokeWidth={2.5} />
          </pattern>
          <filter id="grelha-ondas" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves={2} seed={7} result="ruido" />
            <feDisplacementMap in="SourceGraphic" in2="ruido" scale={34} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect x={-passo} y={-passo} width={L + 2 * passo} height={A + 2 * passo} fill="url(#grelha-celula)" filter="url(#grelha-ondas)" opacity={opacidade} />
      </svg>
    </AbsoluteFill>
  );
};
