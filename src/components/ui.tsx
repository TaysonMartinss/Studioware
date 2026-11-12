import { useId } from "react";
import { Easing, interpolate, random } from "remotion";
import { useEstilo } from "../estilos";
import { clamp, useFontes, useFrame } from "./motion";
import { useBordaViva, useFerver } from "./PapelMotion";

// Linguagem visual partilhada pelas cenas: margens, escala tipográfica, glow e entradas definidas pelo estilo

export const MARGEM = 72;
// margem lateral do estilo (o corporativo deixa o conteúdo a 70% da largura)
export const useMargem = () => useEstilo().margem ?? MARGEM;
export const TOPO = 168; // abaixo da interface do TikTok/Reels
export const ESCALA = { display: 150, h1: 112, h2: 84, corpo: 40, etiqueta: 30 } as const;

// glow só onde o estilo o pede; no explicativo é largo e suave (raio 150px a ~35%)
export const useBrilho = () => {
  const e = useEstilo();
  return (cor: string, raio = 40) => {
    if (!e.brilho) return "none";
    const r = e.glowRaio ?? raio;
    const alfa = Math.round((e.glowForca ?? 0.4) * 255).toString(16).padStart(2, "0");
    return `0 0 ${r}px ${cor}${alfa}`;
  };
};

// curva de easing do estilo (Kurzgesagt: cubic-bezier(0.25, 1, 0.5, 1))
export const useEase = () => {
  const e = useEstilo();
  return e.easing ? Easing.bezier(...e.easing) : Easing.out(Easing.cubic);
};

// "Pop" de 6 frames do kinetic Hormozi: 0% → 118% (f3, arranque o mais rápido possível) → 96% (f5) → 100% (f6)
export const bounce6 = (local: number) => {
  if (local <= 0) return 0;
  if (local < 3) return 1.18 * Easing.out(Easing.exp)(local / 3);
  if (local < 5) return interpolate(local, [3, 5], [1.18, 0.96], { easing: Easing.inOut(Easing.quad) });
  if (local < 6) return interpolate(local, [5, 6], [0.96, 1]);
  return 1;
};

// Tremor de stop motion (jitter): posição e rotação novas e aleatórias em cada "fotografia" (estilo.passo; 7,5 fps no papel),
// sem interpolação entre elas: o recorte salta de sítio como se fosse recolocado à mão a cada foto
export const useWiggle = (semente: string, amp = 12) => {
  const f = useFrame();
  const e = useEstilo();
  if (e.passo <= 1) return { x: 0, y: 0, r: 0 };
  const k = Math.floor(f / e.passo);
  const ruido = (eixo: string) => random(`${semente}${eixo}${k}`) * 2 - 1;
  return { x: ruido("x") * amp * 0.5, y: ruido("y") * amp * 0.5, r: ruido("r") * amp * 0.12 };
};

// Entrada de títulos e textos conforme o estilo:
//  mascara  → sobe 30px a partir de trás de um retângulo invisível (corporativo)
//  escrever → é "escrito" da esquerda para a direita, como giz (ciência)
//  bounce   → pop de 6 frames (Hormozi)
export const Revelar: React.FC<{ inicio?: number; children: React.ReactNode; style?: React.CSSProperties; duracao?: number }> = ({
  inicio = 0, children, style, duracao,
}) => {
  const f = useFrame();
  const e = useEstilo();
  const ease = useEase();
  const id = useId();
  const w = useWiggle(`rv${id}`, 7);
  const ferver = useFerver();
  const local = f - inicio;
  // papel: o texto treme aos saltos e as letras "fervem" (contornos ligeiramente diferentes a cada foto)
  if (e.tema === "papel") {
    return <div style={{ transform: `translate(${w.x}px, ${w.y}px) rotate(${w.r}deg)`, filter: ferver(id), ...style }}>{children}</div>;
  }
  if (e.entrada === "mascara") {
    const p = interpolate(local, [0, duracao ?? 14], [0, 1], { ...clamp, easing: ease });
    return (
      <div style={{ overflow: "hidden", ...style }}>
        <div style={{ transform: `translateY(${(1 - p) * 30}px)`, opacity: p }}>{children}</div>
      </div>
    );
  }
  if (e.entrada === "escrever") {
    // traço quase constante, com leve desaceleração no fim
    const p = interpolate(local, [0, duracao ?? 22], [0, 100], { ...clamp, easing: Easing.out(Easing.quad) });
    return <div style={{ clipPath: `inset(-20% ${100 - p}% -20% 0)`, ...style }}>{children}</div>;
  }
  if (e.entrada === "bounce") {
    const s = bounce6(local);
    return <div style={{ transform: `scale(${s})`, transformOrigin: "left center", ...style }}>{children}</div>;
  }
  return <div style={style}>{children}</div>;
};

// Recorte de papel: borda rasgada com o "miolo" branco de fibra à vista e sombra curta e dura (4–8px, 0–2px, 40%)
export const RecortePapel: React.FC<{ semente: string; children: React.ReactNode; style?: React.CSSProperties; fundo?: string; padding?: string | number }> = ({
  semente, children, style, fundo = "#fffdf6", padding,
}) => {
  const w = useWiggle(semente, 10);
  const borda = useBordaViva();
  return (
    <div style={{ position: "relative", transform: `translate(${w.x}px, ${w.y}px) rotate(${w.r}deg)`, filter: "drop-shadow(6px 6px 1px rgba(0,0,0,0.4))", ...style }}>
      {/* camada de fibra branca, ligeiramente maior e com outro rasgo; o corte muda um pouco a cada foto */}
      <div style={{ position: "absolute", inset: -7, background: "#fbf8ef", clipPath: borda(`${semente}fibra`, 2.6, 34) }} />
      <div style={{ position: "relative", background: fundo, padding, clipPath: borda(semente, 1.6, 30) }}>{children}</div>
    </div>
  );
};

// Etiqueta editorial pequena acima dos títulos ("Nº 3 — PLACA DE VÍDEO")
export const Kicker: React.FC<{ children: React.ReactNode; cor: string; style?: React.CSSProperties }> = ({ children, cor, style }) => {
  const { corpo } = useFontes();
  return (
    <div style={{ fontFamily: corpo, fontSize: ESCALA.etiqueta, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: cor, display: "flex", alignItems: "center", gap: 18, ...style }}>
      <span style={{ width: 44, height: 4, background: cor, display: "inline-block" }} />
      {children}
    </div>
  );
};

// Sombra de texto do estilo, ou nada
export const useSombra = () => {
  const e = useEstilo();
  return e.sombra === "none" ? undefined : e.sombra;
};

// Letter-spacing dos títulos (bloco compacto no Hormozi)
export const useTracking = () => useEstilo().tracking;
