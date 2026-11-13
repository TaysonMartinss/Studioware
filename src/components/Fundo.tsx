import { AbsoluteFill, random } from "remotion";
import { Estilo, useEstilo } from "../estilos";
import { useFrame } from "./motion";
import { PapelAquarela } from "./Aquarela";
import { GrelhaOndulada } from "./GrelhaOndulada";
import { FundoVice } from "./Vice";

// Luz difusa vinda de cima, em vez de manchas de cor a flutuar
const Luz: React.FC<{ cor: string; forte?: boolean }> = ({ cor, forte }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 60% at 50% -10%, ${cor}${forte ? "2e" : "1c"}, transparent 70%)` }} />
);

// Chão em perspetiva a andar (neon, cyber, synthwave)
const Grelha: React.FC<{ cor: string; f: number; topo?: number; angulo?: number; forte?: boolean }> = ({ cor, f, topo = 1050, angulo = 72, forte }) => (
  <div style={{ position: "absolute", inset: 0, perspective: 700, perspectiveOrigin: "50% 30%" }}>
    <div
      style={{
        position: "absolute", left: -1080, right: -1080, top: topo, height: 2400,
        transform: `rotateX(${angulo}deg)`, transformOrigin: "top",
        backgroundImage: `linear-gradient(${cor}${forte ? "cc" : "2a"} 2px, transparent 2px), linear-gradient(90deg, ${cor}${forte ? "cc" : "2a"} 2px, transparent 2px)`,
        backgroundSize: "120px 120px", backgroundPosition: `0 ${(f * 4) % 120}px`,
        maskImage: "linear-gradient(to bottom, black, transparent 70%)",
      }}
    />
  </div>
);

// Textura de papel craft: ruído SVG + fibras, com recortes coloridos a "saltar" em stop motion
const Papel: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => (
  <>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <filter id="papel-fibra">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4" />
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.55 0" />
      </filter>
      <filter id="papel-manchas">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="9" />
        <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.35 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#papel-manchas)" />
      <rect width="100%" height="100%" filter="url(#papel-fibra)" opacity={0.5} />
    </svg>
    {[e.cor, e.cor2, "#f2e8cf", e.cor].map((c, i) => (
      <div
        key={i}
        style={{
          position: "absolute", width: 260 + i * 60, height: 180 + i * 40, background: c, opacity: 0.85,
          left: [-90, 800, 760, 300][i], top: [1560, 1470, 1700, 1760][i], // só na faixa de baixo, longe do conteúdo
          clipPath: `polygon(${[0, 1, 2, 3, 4, 5].map((k) => `${[8, 92, 100, 88, 6, 0][k] + random(`p${i}${k}`) * 6}% ${[0, 4, 50, 100, 96, 45][k] + random(`q${i}${k}`) * 6}%`).join(",")})`,
          transform: `rotate(${(i % 2 ? 1 : -1) * (12 + Math.sin(f / 9 + i) * 3)}deg)`,
          boxShadow: "0 12px 20px #0004",
        }}
      />
    ))}
  </>
);

const Estrelas: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => (
  <>
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${e.fundoCentro ?? "#161b26"} 0%, ${e.fundo} 75%)` }} />
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 115%, ${e.cor2}1f, transparent 55%), radial-gradient(ellipse at 50% -10%, ${e.cor}18, transparent 50%)` }} />
    {Array.from({ length: 90 }).map((_, i) => {
      const brilho = 0.3 + 0.7 * Math.abs(Math.sin(f / (20 + random(`b${i}`) * 30) + i));
      return (
        <div
          key={i}
          style={{
            position: "absolute", left: `${random(`x${i}`) * 100}%`, top: `${random(`y${i}`) * 100}%`,
            width: 2 + random(`s${i}`) * 4, height: 2 + random(`s${i}`) * 4, borderRadius: "50%", background: "#fff", opacity: brilho * 0.8,
            transform: `translateY(${-f * (0.1 + random(`v${i}`) * 0.3)}px)`,
          }}
        />
      );
    })}
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute", borderRadius: "50%", width: 500 + i * 300, height: 500 + i * 300,
          left: [-200, 600, 100][i], top: [1300, -100, 600][i], border: `3px solid ${[e.cor, e.cor2, "#ffffff"][i]}22`,
          transform: `translate(${Math.sin(f / 70 + i) * 30}px, ${Math.cos(f / 80 + i) * 30}px)`,
        }}
      />
    ))}
  </>
);

// Fundo claro com formas geométricas flutuantes e grelha de pontos
// Editorial (vox-style-animation, MIT): "impresso, não iluminado". Papel creme com grão em 3 camadas, campos de
// pontos de meio-tom em dois tamanhos que se deslocam a 12 fps (o único sítio com esse solavanco) e nada a brilhar.
const Jornal: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => {
  const passo = Math.floor(f / 2.5); // 12 fps só nos pontos
  return (
    <>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #0000000a 0 1px, transparent 2px), radial-gradient(circle at 70% 80%, #00000008 0 1px, transparent 2px), radial-gradient(circle at 40% 60%, #ffffff40 0 1px, transparent 2px)", backgroundSize: "7px 7px, 11px 11px, 5px 5px" }} />
      <div style={{ position: "absolute", left: -200, top: 1180 - (passo % 40), width: 900, height: 900, backgroundImage: `radial-gradient(${e.corTexto}1f 32%, transparent 34%)`, backgroundSize: "26px 26px", transform: "rotate(-12deg)", maskImage: "radial-gradient(circle at 30% 50%, #000 20%, transparent 68%)", WebkitMaskImage: "radial-gradient(circle at 30% 50%, #000 20%, transparent 68%)" }} />
      <div style={{ position: "absolute", right: -260, top: 40 + (passo % 30), width: 760, height: 760, backgroundImage: `radial-gradient(${e.cor2}2e 30%, transparent 32%)`, backgroundSize: "14px 14px", transform: "rotate(8deg)", maskImage: "radial-gradient(circle at 60% 40%, #000 15%, transparent 65%)", WebkitMaskImage: "radial-gradient(circle at 60% 40%, #000 15%, transparent 65%)" }} />
    </>
  );
};

const Claro: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => (
  <>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(#0f172a1a 2px, transparent 2px)", backgroundSize: "44px 44px" }} />
    {[
      { l: -120, t: 140, w: 420, r: "50%", c: e.cor },
      { l: 780, t: 380, w: 320, r: "60px", c: e.cor2 },
      { l: 700, t: 1500, w: 460, r: "50%", c: e.cor2 },
      { l: -80, t: 1250, w: 260, r: "40px", c: e.cor },
    ].map((s, i) => (
      <div
        key={i}
        style={{
          position: "absolute", left: s.l, top: s.t, width: s.w, height: s.w, borderRadius: s.r, background: s.c, opacity: 0.12,
          transform: `translateY(${Math.sin(f / 40 + i) * 30}px) rotate(${f * (i % 2 ? 0.3 : -0.25)}deg)`,
        }}
      />
    ))}
  </>
);

// máscara do sol: a partir de 48%, cortes transparentes que vão engrossando (2% → 7%)
const FAIXAS_SOL = (() => {
  const paradas = ["black 0%", "black 48%"];
  let y = 48;
  for (let k = 0; k < 6; k++) {
    const corte = 2 + k;
    const cheio = 7 - k * 0.8;
    paradas.push(`transparent ${y}%`, `transparent ${y + corte}%`, `black ${y + corte}%`, `black ${y + corte + cheio}%`);
    y += corte + cheio;
  }
  return `linear-gradient(180deg, ${paradas.join(", ")})`;
})();

// Pôr do sol anos 80: gradiente, sol com faixas, estrelas e grelha magenta
const Synthwave: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => (
  <>
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #0a0020 0%, #2a0a4a 55%, ${e.cor}88 74%, #12002a 75%)` }} />
    {Array.from({ length: 50 }).map((_, i) => (
      <div key={i} style={{ position: "absolute", left: `${random(`sx${i}`) * 100}%`, top: `${random(`sy${i}`) * 60}%`, width: 3, height: 3, background: "#fff", opacity: 0.3 + 0.7 * Math.abs(Math.sin(f / 15 + i)) }} />
    ))}
    <div
      style={{
        position: "absolute", left: 330, top: 1150, width: 420, height: 420, borderRadius: "50%", opacity: 0.7, // no horizonte, abaixo do conteúdo (mais discreto para não competir com as legendas)
        background: "linear-gradient(180deg, #ffff00 0%, #ff9a00 45%, #ff0055 100%)", boxShadow: `0 0 120px ${e.cor}`,
        // metade de cima sólida; em baixo, 6 cortes horizontais cada vez mais grossos (o sol clássico dos anos 80)
        maskImage: FAIXAS_SOL, WebkitMaskImage: FAIXAS_SOL,
      }}
    />
    <Grelha cor={e.cor} f={f} topo={1440} angulo={80} forte />
  </>
);

const Hud: React.FC<{ e: Estilo; f: number }> = ({ e, f }) => (
  <>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${e.cor}22, transparent 65%)` }} />
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${e.cor}12 1px, transparent 1px), linear-gradient(90deg, ${e.cor}12 1px, transparent 1px)`,
        backgroundSize: "54px 54px", backgroundPosition: `0 ${(f * 0.6) % 54}px`,
      }}
    />
  </>
);

const Cartesiano: React.FC<{ e: Estilo }> = () => (
  <>
    <AbsoluteFill style={{ backgroundImage: "linear-gradient(#222b38 1px, transparent 1px), linear-gradient(90deg, #222b38 1px, transparent 1px)", backgroundSize: "60px 60px", backgroundPosition: "0 -1px", opacity: 0.6 }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 1500, height: 2, background: "#dddddd", opacity: 0.18 }} />
    <div style={{ position: "absolute", top: 0, bottom: 0, left: 120, width: 2, background: "#dddddd", opacity: 0.18 }} />
  </>
);

export const Fundo: React.FC<{ cor: string }> = ({ cor }) => {
  const f = useFrame();
  const e = useEstilo();
  return (
    <AbsoluteFill style={{ background: e.fundo, overflow: "hidden" }}>
      {/* fundos pretos: grelha de linhas brancas onduladas (o Neon mantém a luz da cor por cima) */}
      {e.tema === "grelha" && <><GrelhaOndulada opacidade={0.55} /><Luz cor={cor} /></>}
      {e.tema === "solido" && <GrelhaOndulada opacidade={0.55} />}
      {e.tema === "vice" && <FundoVice />}
      {/* editorial: papel milimétrico claro, com a luz a cair do centro */}
      {e.tema === "editorial" && (
        <>
          <AbsoluteFill style={{ backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px" }} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #ffffff99, transparent 65%)" }} />
        </>
      )}
      {e.tema === "gradiente" && <Luz cor={cor} forte />}
      {e.tema === "papel" && <Papel e={e} f={f} />}
      {e.tema === "estrelas" && <Estrelas e={e} f={f} />}
      {e.tema === "claro" && (e.textura === "jornal" ? <Jornal e={e} f={f} /> : e.textura === "aquarela" ? <PapelAquarela e={e} f={f} /> : <Claro e={e} f={f} />)}
      {e.tema === "synthwave" && <Synthwave e={e} f={f} />}
      {e.tema === "hud" && <Hud e={e} f={f} />}
      {e.tema === "cartesiano" && <Cartesiano e={e} />}
      {e.tema !== "claro" && e.tema !== "papel" && e.tema !== "editorial" && (
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)" }} />
      )}
    </AbsoluteFill>
  );
};
