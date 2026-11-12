// Vídeo longo para o YouTube (16:9). Mesmo manifest e mesmo pipeline dos verticais;
// muda o layout das cenas, as legendas (rodapé) e entra o indicador do capítulo atual.
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Fundo } from "../components/Fundo";
import { MarcaDagua } from "../components/MarcaDagua";
import { Mundo3D } from "../components/Mundo3D";
import { Musica } from "../components/Musica";
import { Overlay } from "../components/Overlay";
import { FiltrosFerver } from "../components/PapelMotion";
import { FiltrosAquarela } from "../components/Aquarela";
import { Pico, SonsPico, calcularPicos } from "../components/Picos";
import { Sfx, SfxCtx, SFX_PADRAO } from "../components/Sfx";
import { Transicao } from "../components/Transicao";
import { FONTES, RitmoCtx, normalizar, pop, ritmoDaFala, zoomPunch } from "../components/motion";
import { ManimCena } from "../cenas/ManimCena";
import { Quiz } from "../cenas/Quiz";
import { LowPolyCena } from "../lowpoly/LowPolyCena";
import { PincelCena } from "../pincel/PincelCena";
import { Modelo3DCena } from "../cenas/Modelo3DCena";
import { ESTILOS, EstiloCtx, useEstilo } from "../estilos";
import { Cena, CenaCapitulo, FPS, Manifest, Palavra, framesDaCena } from "../types";
import { CapituloL, ComparacaoL, CtaL, FatoL, GanchoL, GraficoL, LinhaTempoL, M, NumeroL, ProdutoL } from "./Cenas";

const ConteudoL: React.FC<{ cena: Cena; cor: string; indice: number }> = ({ cena, cor, indice }) => {
  switch (cena.tipo) {
    case "gancho": return <GanchoL cena={cena} cor={cor} />;
    case "capitulo": return <CapituloL cena={cena} cor={cor} />;
    case "fato": return <FatoL cena={cena} cor={cor} indice={indice} />;
    case "numero": return <NumeroL cena={cena} cor={cor} />;
    case "grafico": return <GraficoL cena={cena} cor={cor} />;
    case "linha_tempo": return <LinhaTempoL cena={cena} cor={cor} />;
    case "comparacao": return <ComparacaoL cena={cena} cor={cor} />;
    case "produto": return <ProdutoL cena={cena} cor={cor} />;
    case "manim": return <ManimCena cena={cena} cor={cor} />;
    case "quiz": return <Quiz cena={cena} cor={cor} />;
    case "lowpoly": return <LowPolyCena cena={cena} cor={cor} />;
    case "pincel": return <PincelCena cena={cena} cor={cor} />;
    case "modelo3d": return <Modelo3DCena cena={cena} cor={cor} />;
    case "cta": return <CtaL cena={cena} cor={cor} />;
    default: return null;
  }
};

// Legendas de rodapé: uma frase curta de cada vez, a palavra dita em destaque (legível sem som)
const POR_LINHA = 8;
const paginar = (palavras: Palavra[]) => {
  const out: Palavra[][] = [];
  let atual: Palavra[] = [];
  for (const p of palavras) {
    atual.push(p);
    if (atual.length >= POR_LINHA || (atual.length >= 3 && /[.!?;:]$/.test(p.texto))) { out.push(atual); atual = []; }
  }
  if (atual.length) out.push(atual);
  return out;
};
const LegendaRodape: React.FC<{ palavras: Palavra[]; destaques: Set<string>; cor: string }> = ({ palavras, destaques, cor }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const ms = (f / fps) * 1000;
  const paginas = paginar(palavras);
  const i = paginas.findLastIndex((pg) => pg[0].inicioMs <= ms);
  const pg = paginas[i];
  if (!pg || ms > pg[pg.length - 1].fimMs + 700) return null;
  return (
    <div style={{ position: "absolute", left: M, right: M, bottom: 64, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 14px", padding: "10px 26px", borderRadius: 12, background: "#000000a8", fontFamily: FONTES[e.corpo] ?? FONTES.inter, fontWeight: 700, fontSize: 46, lineHeight: 1.3, maxWidth: 1500 }}>
        {pg.map((p, k) => {
          const dita = ms >= p.inicioMs;
          const agora = dita && ms <= p.fimMs + 100;
          const destaque = destaques.has(normalizar(p.texto));
          return <span key={k} style={{ color: agora ? cor : destaque && dita ? e.cor2 : "#fff", opacity: dita ? 1 : 0.55 }}>{p.texto.replace(/[,;:]$/, "")}</span>;
        })}
      </div>
    </div>
  );
};

// etiqueta discreta com o capítulo atual (no canto de cima, como num documentário)
const CapituloAtual: React.FC<{ capitulos: { inicio: number; cena: CenaCapitulo }[]; cor: string }> = ({ capitulos, cor }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const atual = capitulos.findLast((c) => c.inicio <= f);
  if (!atual) return null;
  const local = f - atual.inicio;
  // aparece depois da abertura do capítulo (que já mostra o título em grande)
  const s = pop(local, fps, framesDaCena(atual.cena), 16);
  return (
    <div style={{ position: "absolute", left: 56, top: 44, display: "flex", alignItems: "center", gap: 12, opacity: 0.85 * s, fontFamily: FONTES[e.corpo] ?? FONTES.inter, fontWeight: 700, fontSize: 24, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em", textShadow: "0 2px 8px #000a" }}>
      <span style={{ color: cor }}>{String(atual.cena.numero ?? capitulos.indexOf(atual) + 1).padStart(2, "0")}</span>
      <span style={{ width: 24, height: 2, background: "#fff8" }} />
      {atual.cena.titulo}
    </div>
  );
};

const CenaL: React.FC<{ cena: Cena; indice: number; cor: string; destaques: Set<string>; pico?: Pico }> = ({ cena, indice, cor, destaques, pico }) => {
  const f = useCurrentFrame();
  const { shake, rgbSplit } = useEstilo();
  const palavras = cena.palavras ?? [];
  // zoom punch mais leve que nos verticais: num ecrã grande cansa
  const gatilhos = shake === 0 ? [] : [0, ...palavras.filter((p) => destaques.has(normalizar(p.texto))).map((p) => Math.round((p.inicioMs / 1000) * FPS))];
  return (
    <AbsoluteFill>
      {indice > 0 && <Sfx nome="whoosh" volume={0.35} />}
      {cena.audio && <Html5Audio src={staticFile(cena.audio)} />}
      {pico && <SonsPico frame={pico.frame} principal={pico.principal} />}
      <Transicao indice={indice} zoom={zoomPunch(f, gatilhos, 0.03)} filtro={rgbSplit ? "url(#rgb-split)" : undefined}>
        <RitmoCtx.Provider value={["gancho", "cta", "clipe"].includes(cena.tipo) ? 1 : ritmoDaFala(cena.fala)}>
          <ConteudoL cena={cena} cor={cor} indice={indice} />
        </RitmoCtx.Provider>
      </Transicao>
      <LegendaRodape palavras={palavras} destaques={destaques} cor={cor} />
    </AbsoluteFill>
  );
};

export const VideoLongo: React.FC<{ manifest: Manifest }> = ({ manifest }) => {
  const estilo = ESTILOS[manifest.estilo ?? "neon"] ?? ESTILOS.neon;
  const cor = manifest.cor ?? estilo.cor;
  const destaques = new Set((manifest.destaques ?? []).map(normalizar));
  const inicios = manifest.cenas.reduce<number[]>((a, c, i) => [...a, i ? a[i - 1] + framesDaCena(manifest.cenas[i - 1]) : 0], []);
  // num vídeo de 5 a 10 minutos cabem mais picos (um por capítulo, mais ou menos)
  const picos = calcularPicos(manifest.cenas, 6);
  const capitulos = manifest.cenas.flatMap((c, i) => (c.tipo === "capitulo" ? [{ inicio: inicios[i], cena: c }] : []));
  return (
    <EstiloCtx.Provider value={estilo}>
    <SfxCtx.Provider value={SFX_PADRAO * (manifest.sfxVolume ?? 1)}>
    <AbsoluteFill>
      <Fundo cor={cor} />
      {estilo.tema === "mundo3d" && <Mundo3D cenas={manifest.cenas} inicios={inicios} cor={cor} />}
      <Musica manifest={manifest} />
      {manifest.cenas.map((cena, i) => (
        <Sequence key={i} from={inicios[i]} durationInFrames={framesDaCena(cena)} name={`${i + 1}. ${cena.tipo}`}>
          <CenaL cena={cena} indice={i} cor={cor} destaques={destaques} pico={picos.find((p) => p.cena === i)} />
        </Sequence>
      ))}
      <CapituloAtual capitulos={capitulos} cor={cor} />
      <Overlay />
      {estilo.tema === "papel" && <FiltrosFerver />}
      {estilo.textura === "aquarela" && <FiltrosAquarela tinta={estilo.corTexto} />}
      {manifest.marcaDagua !== false && <MarcaDagua canal={manifest.canal} />}
    </AbsoluteFill>
    </SfxCtx.Provider>
    </EstiloCtx.Provider>
  );
};
