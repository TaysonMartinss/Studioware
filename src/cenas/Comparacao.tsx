import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { Conteudo } from "../components/MidiaReal";
import { clamp, pop, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, Revelar, TOPO, useBrilho, useMargem, useSombra } from "../components/ui";
import { Em, Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaComparacao, LadoComparacao } from "../types";

const VERMELHO = "#ff4a3d";
const T = { titulo: 2, esq: 6, dir: 12, itens: 20, veredito: 44 };

const Lado: React.FC<{ lado: LadoComparacao; inicio: number; cor: string; perde: boolean; ganha: boolean; direcao: 1 | -1 }> = ({
  lado, inicio, cor, perde, ganha, direcao,
}) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const brilho = useBrilho();
  const s = pop(f, fps, inicio, 15);
  const apagar = perde ? interpolate(f, [T.veredito, T.veredito + 8], [1, 0.4], clamp) : 1;
  const m = lado.midia;
  const icone = lado.icone ?? lado.emoji;
  const corLado = ganha ? cor : perde ? VERMELHO : e.corTexto;

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18, opacity: Math.min(1, s * 1.4) * apagar, transform: `translateX(${(1 - s) * 120 * direcao}px)` }}>
      <div
        style={{
          height: 400, borderRadius: e.raio, overflow: "hidden", background: e.superficie, display: "flex", alignItems: "center", justifyContent: "center",
          ...(e.sombraInterna && !ganha && { boxShadow: "inset 0 -14px 30px #0006, inset 0 2px 0 #ffffff14" }),
          outline: ganha ? `4px solid ${cor}` : "none", outlineOffset: 6, boxShadow: ganha && e.brilho ? brilho(cor, 40) : undefined,
          filter: perde ? "grayscale(1)" : undefined,
        }}
      >
        {m?.arquivo ? (
          m.formato === "modelo3d" ? <Conteudo midia={m} estilo={{ width: "100%", height: "100%" }} /> : m.formato === "video"
            ? <OffthreadVideo src={staticFile(m.arquivo)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Img src={staticFile(m.arquivo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icone nome={icone ?? "circle-help"} tamanho={170} cor={perde ? e.corTexto : cor} traco={1.25} />
        )}
      </div>
      <div style={{ fontFamily: titulo, fontSize: 56, lineHeight: 1.02, textTransform: "uppercase", color: corLado }}>{lado.rotulo}</div>
      {lado.itens.slice(0, 3).map((it, i) => {
        const si = interpolate(f, [T.itens + i * 5 + (direcao === 1 ? 3 : 0), T.itens + i * 5 + 11], [0, 1], clamp);
        return (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 32, fontWeight: 600, lineHeight: 1.2, opacity: si, transform: `translateY(${(1 - si) * 14}px)` }}>
            <Icone nome={perde ? "x" : "check"} tamanho={34} cor={perde ? VERMELHO : cor} traco={3} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{it}</span>
          </div>
        );
      })}
    </div>
  );
};

// Lado a lado (sem x com, antes x depois): quem perde fica a cinzento com ✕, quem ganha fica contornado na cor
export const Comparacao: React.FC<{ cena: CenaComparacao; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const sombra = useSombra();
  const sTitulo = pop(f, fps, T.titulo, 14);
  const decidido = f >= T.veredito;
  const linha = interpolate(f, [T.esq, T.dir + 10], [0, 1], clamp);
  const sVeredito = pop(f, fps, T.veredito, 14);
  const vencedor = cena.vencedor ? cena[cena.vencedor] : undefined;

  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: useFontes().corpo }}>
      <Em de={T.esq}><Sfx nome="whoosh" volume={0.3} /></Em>
      <Em de={T.dir}><Sfx nome="whoosh" volume={0.3} /></Em>
      {cena.vencedor && <Em de={T.veredito}><Sfx nome="impacto" volume={0.27} /></Em>}

      <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM, opacity: sTitulo, transform: `translateY(${(1 - sTitulo) * 20}px)` }}>
        <Kicker cor={cor}>Comparação</Kicker>
        {cena.titulo && <Revelar inicio={4} style={{ marginTop: 18 }}><div style={{ fontFamily: titulo, fontSize: ESCALA.h2, lineHeight: 1.02, textTransform: "uppercase", textShadow: sombra }}>{cena.titulo}</div></Revelar>}
      </div>

      <div style={{ position: "absolute", top: cena.titulo ? 420 : 300, left: MARGEM, right: MARGEM, display: "flex", gap: 56 }}>
        <Lado lado={cena.esquerda} inicio={T.esq} cor={cor} direcao={-1} perde={cena.vencedor === "direita" && decidido} ganha={cena.vencedor === "esquerda" && decidido} />
        <Lado lado={cena.direita} inicio={T.dir} cor={cor} direcao={1} perde={cena.vencedor === "esquerda" && decidido} ganha={cena.vencedor === "direita" && decidido} />
      </div>
      {/* divisória vertical fina entre os lados */}
      <div style={{ position: "absolute", left: 539, top: cena.titulo ? 420 : 300, width: 2, height: 400 * linha, background: e.corTexto, opacity: 0.2 }} />

      {vencedor && (
        <div style={{ position: "absolute", top: 1150, left: MARGEM, right: MARGEM, display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, opacity: sVeredito, transform: `translateY(${(1 - sVeredito) * 16}px)` }}>
          <Icone nome="trophy" tamanho={38} cor={cor} traco={2} />
          <span>Melhor escolha: <span style={{ color: cor }}>{vencedor.rotulo}</span></span>
        </div>
      )}
    </AbsoluteFill>
  );
};
