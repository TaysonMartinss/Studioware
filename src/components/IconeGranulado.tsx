import { useId } from "react";
import { resolverIcone } from "./Icone";

// Ícone "sombra interna com grão" (estilo Editorial): a silhueta sólida do ícone a vermelho com um jogo de luz e
// sombra de um só lado, como uma luz vinda de cima à esquerda: a borda iluminada clareia para rosa em grão de ruído
// (dissolve) e a borda oposta escurece um pouco. É o efeito de sombra interna + ruído do After Effects, subtil.
export const IconeGranulado: React.FC<{ nome: string; tamanho: number; cor?: string; claro?: string }> = ({ nome, tamanho, cor = "#ff1f2e", claro = "#ffb3bd" }) => {
  const Svg = resolverIcone(nome);
  const base = `ig${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!Svg) return null;
  const d = tamanho * 0.05; // quanto a luz entra pela borda
  return (
    <div style={{ width: tamanho, height: tamanho, position: "relative" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id={`${base}f`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            {/* ruído fino para o grão */}
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} result="ruido" />
            <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.2 -0.6" result="mascaraGrao" />
            {/* luz: a forma deslocada para baixo-direita e desfocada; o que sobra da forma é a borda de cima-esquerda */}
            <feOffset in="SourceAlpha" dx={d} dy={d} result="desl" />
            <feGaussianBlur in="desl" stdDeviation={d * 0.8} result="deslSuave" />
            <feComposite in="SourceAlpha" in2="deslSuave" operator="out" result="ladoLuz" />
            {/* a luz dissolve-se em grão: alfa da luz × ruído */}
            <feComposite in="ladoLuz" in2="mascaraGrao" operator="arithmetic" k1={1.3} k2={0.15} k3={0} k4={0} result="luzGrao" />
            <feFlood floodColor={claro} />
            <feComposite in2="luzGrao" operator="in" result="luz" />
            {/* sombra: borda oposta (baixo-direita), escura e suave */}
            <feOffset in="SourceAlpha" dx={-d} dy={-d} result="desl2" />
            <feGaussianBlur in="desl2" stdDeviation={d} result="desl2Suave" />
            <feComposite in="SourceAlpha" in2="desl2Suave" operator="out" result="ladoSombra" />
            <feFlood floodColor="#5a0008" floodOpacity={0.45} />
            <feComposite in2="ladoSombra" operator="in" result="sombra" />
            <feMerge result="junto">
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="sombra" />
              <feMergeNode in="luz" />
            </feMerge>
            <feComposite in="junto" in2="SourceAlpha" operator="in" />
          </filter>
        </defs>
      </svg>
      <div style={{ width: "100%", height: "100%", filter: `url(#${base}f) drop-shadow(0 0 ${tamanho * 0.06}px ${cor}44)` }}>
        <Svg size={tamanho} color={cor} fill={cor} strokeWidth={2.4} absoluteStrokeWidth={false} />
      </div>
    </div>
  );
};
