import { AbsoluteFill, Easing, Sequence, interpolate, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { MidiaFundo } from "../components/MidiaReal";
import { clamp, pop, shake, useCaber, useFontes, useFrame } from "../components/motion";
import { Kicker, Revelar, useBrilho, useMargem, useSombra } from "../components/ui";
import { Em, Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaNumero } from "../types";

const ALERTA = "#ff4a3d";
const CONTA = { ini: 6, fim: 30 };

const formatar = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

// Número gigante a contar até ao valor, com "batida" no fim; em modo alerta fica vermelho com uma faixa de aviso
export const Numero: React.FC<{ cena: CenaNumero; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const caber = useCaber();
  const brilho = useBrilho();
  const sombra = useSombra();
  const casas = Number.isInteger(cena.valor) ? 0 : 1;
  const final = `${cena.prefixo ?? ""}${formatar(cena.valor, casas)}${cena.sufixo ?? ""}`;
  const corNum = cena.alerta ? ALERTA : cor;
  const p = interpolate(f, [CONTA.ini, CONTA.fim], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sTexto = pop(f, fps, CONTA.fim - 4, 14);
  const batida = f >= CONTA.fim ? 1 + 0.06 * Math.exp(-(f - CONTA.fim) / 4) : 0.94 + 0.06 * p;
  const icone = cena.icone ?? cena.emoji;
  const faixa = interpolate(f, [CONTA.fim, CONTA.fim + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ transform: shake(f, [CONTA.fim], 18 * e.shake), fontFamily: corpo, color: e.corTexto }}>
      <MidiaFundo midia={cena.midia} opacidade={0.5} desfoque={12} />
      <Em de={CONTA.fim}><Sfx nome="impacto" volume={0.33} /></Em>

      <div style={{ position: "absolute", top: 380, left: MARGEM, right: MARGEM }}>
        <Kicker cor={corNum} style={{ opacity: pop(f, fps, 2, 14) }}>
          {icone && <Icone nome={icone} tamanho={40} cor={corNum} traco={2.25} />}
          {cena.alerta ? "Atenção" : "Em números"}
        </Kicker>
        <div
          style={{
            marginTop: 26, fontFamily: titulo, fontSize: caber(final, 1080 - MARGEM * 2, 250), lineHeight: 1, whiteSpace: "nowrap",
            color: corNum, transform: `scale(${batida})`, transformOrigin: "left center", fontVariantNumeric: "tabular-nums",
            textShadow: [sombra, e.brilho ? brilho(corNum, 60) : undefined].filter(Boolean).join(", ") || undefined,
          }}
        >
          {cena.prefixo}{formatar(cena.valor * p, casas)}{cena.sufixo}
        </div>
        {/* faixa que sublinha o número quando ele "assenta" */}
        <div style={{ marginTop: 18, height: 10, width: `${faixa * 100}%`, background: corNum, borderRadius: Math.min(5, e.raio) }} />
        <Revelar inicio={CONTA.fim - 4} style={{ marginTop: 34 }}>
        <div
          style={{
            fontSize: 56, fontWeight: 700, lineHeight: 1.18, maxWidth: 860,
            opacity: e.entrada ? 1 : sTexto, transform: e.entrada ? undefined : `translateY(${(1 - sTexto) * 24}px)`, textShadow: sombra ? "0 4px 18px #000a" : undefined,
          }}
        >
          {cena.texto}
        </div>
        </Revelar>
      </div>
    </AbsoluteFill>
  );
};
