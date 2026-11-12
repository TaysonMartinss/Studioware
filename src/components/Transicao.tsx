import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useEstilo } from "../estilos";
import { VOO } from "./Mundo3D";
import { bordaRasgada, clamp } from "./motion";

const sair = Easing.out(Easing.cubic);

// Envolve cada cena com a transição do estilo (entrada e saída) e aplica o zoom punch
export const Transicao: React.FC<{ children: React.ReactNode; indice: number; zoom: number; filtro?: string }> = ({
  children, indice, zoom, filtro,
}) => {
  const f = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const e = useEstilo();
  const lado = indice % 2 === 0 ? 1 : -1;
  const primeira = indice === 0;
  const flash = interpolate(f, [0, 5], [primeira ? 0 : e.flash, 0], clamp);

  let transform = `scale(${zoom})`;
  let filter = "none";
  let clipPath: string | undefined;
  let opacity = 1;
  let extra: React.ReactNode = null;

  if (e.transicao === "whip") {
    // whip pan + zoom-through com motion blur
    const en = interpolate(f, [0, 9], [1, 0], { ...clamp, easing: sair });
    const sa = interpolate(f, [dur - 7, dur], [0, 1], { ...clamp, easing: (t) => t * t });
    transform = `translateX(${en * 260 * lado - sa * 220 * lado}px) scale(${(1 + en * 0.35 + sa * 0.25) * zoom}) rotate(${en * 4 * lado}deg)`;
    filter = `blur(${en * 22 + sa * 18}px)`;
  } else if (e.transicao === "corte") {
    // corte seco com um "soco" de zoom
    transform = `scale(${(1 + interpolate(f, [0, 5], [0.14, 0], clamp)) * zoom})`;
  } else if (e.transicao === "suave") {
    const en = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: e.easing ? Easing.bezier(...e.easing) : sair });
    opacity = en * interpolate(f, [dur - 9, dur], [1, 0], clamp);
    transform = `translateY(${(1 - en) * 40}px) scale(${(1.05 - 0.05 * en) * zoom})`;
  } else if (e.transicao === "papel") {
    // uma folha de papel rasgada sobe e revela a cena; tremura de stop motion
    const passo = Math.floor(f / e.passo);
    const folha = interpolate(f, [0, 12], [0, -125], { ...clamp, easing: Easing.in(Easing.quad) });
    transform = `translate(${(random(`px${passo}`) - 0.5) * 6}px, ${(random(`py${passo}`) - 0.5) * 6}px) rotate(${(random(`pr${passo}`) - 0.5) * 0.8}deg) scale(${zoom})`;
    if (!primeira)
      extra = (
        <AbsoluteFill style={{ transform: `translateY(${folha}%) rotate(${-3 * lado}deg) scale(1.15)`, background: e.fundo, clipPath: bordaRasgada(`folha${indice}`, 4), boxShadow: "0 30px 40px #0006" }}>
          <AbsoluteFill style={{ background: "linear-gradient(180deg, #ffffff22, #00000022)" }} />
        </AbsoluteFill>
      );
  } else if (e.transicao === "folha") {
    // a folha cobre o ecrã e sai para a esquerda (~0,4 s, a acelerar); a cena assenta ligeiramente torta (imperfeição editorial)
    const sai = interpolate(f, [0, 12], [0, -112], { ...clamp, easing: Easing.in(Easing.cubic) });
    const assenta = interpolate(f, [0, 14], [1.04, 1], { ...clamp, easing: Easing.out(Easing.back(1.15)) });
    transform = `rotate(${0.35 * lado}deg) scale(${assenta * zoom})`;
    if (!primeira && f < 13)
      extra = (
        <AbsoluteFill style={{ transform: `translateX(${sai}%)`, background: e.fundo, boxShadow: "18px 0 0 #16151324", borderRight: `10px solid ${e.cor}` }}>
          <AbsoluteFill style={{ backgroundImage: "radial-gradient(#16151314 30%, transparent 32%)", backgroundSize: "18px 18px", opacity: 0.6 }} />
        </AbsoluteFill>
      );
  } else if (e.transicao === "forma") {
    // círculo que cresce na cor do estilo e revela a cena
    const raio = interpolate(f, [0, 13], [0, 150], { ...clamp, easing: sair });
    clipPath = primeira ? undefined : `circle(${raio}% at 50% 50%)`;
    const anel = interpolate(f, [0, 10], [0, 160], { ...clamp, easing: sair });
    transform = `scale(${(1.08 - 0.08 * Math.min(1, f / 13)) * zoom})`;
    opacity = interpolate(f, [dur - 8, dur], [1, 0], clamp);
    if (!primeira && f < 14)
      extra = <AbsoluteFill style={{ background: e.cor, clipPath: `circle(${anel}% at 50% 50%)`, opacity: 1 - f / 14 }} />;
  } else if (e.transicao === "vhs") {
    // rebobinar: faixas deslocadas, saturação e brilho a piscar
    const forca = Math.max(interpolate(f, [0, 8], [1, 0], clamp), interpolate(f, [dur - 6, dur], [0, 1], clamp));
    transform = `translateX(${(random(`vh${f}`) - 0.5) * 80 * forca}px) skewX(${forca * 8 * lado}deg) scale(${zoom})`;
    filter = `saturate(${1 + forca * 2}) brightness(${1 + forca * 0.8}) hue-rotate(${forca * 40}deg)`;
  } else if (e.transicao === "voo") {
    // a cena vem do fundo do corredor e passa pela câmara ao sair, ao mesmo tempo que a câmara 3D voa;
    // enquanto está parada, inclina-se devagar (paralaxe) para parecer pendurada no espaço
    const en = interpolate(f, [0, VOO], [1, 0], { ...clamp, easing: sair });
    const sa = interpolate(f, [dur - VOO, dur], [0, 1], { ...clamp, easing: (t) => t * t });
    const ry = Math.sin((f + indice * 40) / 50) * 2.5 + en * 10 * lado;
    transform = `perspective(1800px) translateZ(${-en * 1100 + sa * 650}px) rotateY(${ry}deg) rotateX(${1.5 - en * 6}deg) scale(${zoom})`;
    opacity = (1 - en) * (1 - sa);
    filter = `blur(${en * 8 + sa * 16}px)`;
  } else if (e.transicao === "hud") {
    // varrimento de cima para baixo com linha de scan
    const linha = interpolate(f, [0, 12], [0, 100], { ...clamp, easing: sair });
    clipPath = primeira ? undefined : `inset(0 0 ${100 - linha}% 0)`;
    transform = `scale(${zoom})`;
    opacity = interpolate(f, [dur - 6, dur], [1, 0], clamp);
    if (!primeira && linha < 100)
      extra = <div style={{ position: "absolute", left: 0, right: 0, top: `${linha}%`, height: 6, background: e.cor, boxShadow: `0 0 30px ${e.cor}, 0 0 80px ${e.cor}` }} />;
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform, filter: [filter !== "none" ? filter : "", filtro ?? ""].join(" ").trim() || undefined, clipPath, opacity }}>{children}</AbsoluteFill>
      {extra}
      {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};
