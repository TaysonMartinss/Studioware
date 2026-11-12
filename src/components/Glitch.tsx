import { random } from "remotion";
import { useFrame } from "./motion";
import { useEstilo } from "../estilos";

// Separação RGB + fatias deslocadas. Ativo nos primeiros frames e em "rajadas" aleatórias.
export const Glitch: React.FC<{ children: React.ReactNode; inicio?: number; semente?: string }> = ({
  children, inicio = 0, semente = "g",
}) => {
  const f = useFrame();
  const estilo = useEstilo();
  const local = f - inicio;
  const rajada = random(`${semente}-${Math.floor(f / 3)}`) > 0.86;
  const ativo = (local >= 0 && local < 9) || rajada;
  const d = ativo ? 6 + random(`${semente}d${f}`) * 14 : 0;
  const corte = random(`${semente}c${f}`) * 80;

  if (!ativo || !estilo.glitch) return <div style={{ position: "relative" }}>{children}</div>;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${-d}px)`, color: "#ff004c", mixBlendMode: "screen", opacity: 0.85 }}>
        {children}
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${d}px)`, color: "#00e5ff", mixBlendMode: "screen", opacity: 0.85 }}>
        {children}
      </div>
      <div style={{ position: "relative", clipPath: `inset(${corte}% 0 ${Math.max(0, 70 - corte)}% 0)`, transform: `translateX(${d * 1.5}px)` }}>
        {children}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(0 0, 100% 0, 100% ${corte}%, 0 ${corte}%)` }}>{children}</div>
    </div>
  );
};
