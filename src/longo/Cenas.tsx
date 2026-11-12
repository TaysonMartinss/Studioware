// Cenas dos vídeos longos (YouTube 16:9, 1920x1080). Mesma linguagem visual dos verticais
// (estilo, fontes, Kicker, Revelar), mas com layout na largura: texto à esquerda, mídia a ocupar o quadro
// e a zona de baixo livre para as legendas.
import { evolvePath } from "@remotion/paths";
import { AbsoluteFill, Easing, Sequence, interpolate, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { Conteudo, MidiaFundo } from "../components/MidiaReal";
import { clamp, pop, useCaber, useFontes, useFrame } from "../components/motion";
import { Kicker, Revelar, useBrilho, useEase, useSombra, useTracking } from "../components/ui";
import { Em, Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaCapitulo, CenaComparacao, CenaCta, CenaFato, CenaGancho, CenaGrafico, CenaLinhaTempo, CenaNumero, CenaProduto } from "../types";

export const M = 120; // margem lateral
export const TOPO_L = 110;
export const LEGENDA_L = 860; // a partir daqui ficam as legendas
const ESC = { display: 150, h1: 104, h2: 76, corpo: 40, etiqueta: 26 } as const;
const ALERTA = "#ff4a3d";
const suave = Easing.bezier(0.65, 0, 0.35, 1);
const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const Titulo: React.FC<{ texto: string; tamanho: number; inicio?: number; cor?: string; largura?: number }> = ({ texto, tamanho, inicio = 4, cor, largura }) => {
  const e = useEstilo();
  const { titulo } = useFontes();
  const sombra = useSombra();
  const tracking = useTracking();
  return (
    <Revelar inicio={inicio} style={{ marginTop: 18, maxWidth: largura }}>
      <div style={{ fontFamily: titulo, fontSize: tamanho, lineHeight: 1.02, textTransform: "uppercase", letterSpacing: tracking, color: cor ?? e.corTexto, textShadow: sombra }}>{texto}</div>
    </Revelar>
  );
};

// mídia a ocupar o quadro inteiro, com Ken Burns lento (o "b-roll" de documentário)
const MidiaTela: React.FC<{ cena: { midia?: CenaFato["midia"] }; lado: number }> = ({ cena, lado }) => {
  const f = useFrame();
  const { durationInFrames } = useVideoConfig();
  if (!cena.midia?.arquivo) return null;
  const z = interpolate(f, [0, durationInFrames], [1.04, 1.14], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z}) translateX(${lado * (z - 1) * 160}px)` }}>
        <Conteudo midia={cena.midia} estilo={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {cena.midia.credito && (
        <div style={{ position: "absolute", left: 56, bottom: 24, fontSize: 18, color: "#fffc", background: "#0008", padding: "3px 10px", borderRadius: 4, fontFamily: "sans-serif" }}>{cena.midia.credito}</div>
      )}
    </AbsoluteFill>
  );
};

// cartão de mídia nítido numa das metades do quadro
const MidiaLado: React.FC<{ midia?: CenaFato["midia"]; cor: string; x: number; largura: number; atraso?: number }> = ({ midia, cor, x, largura, atraso = 6 }) => {
  const f = useFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const e = useEstilo();
  if (!midia?.arquivo) return null;
  const s = pop(f, fps, atraso, 13);
  const z = interpolate(f, [0, durationInFrames], [1.03, 1.12], clamp);
  return (
    <div
      style={{
        position: "absolute", left: x, top: TOPO_L + 10, width: largura, height: LEGENDA_L - TOPO_L - 60, borderRadius: e.raio, overflow: "hidden",
        boxShadow: e.brilho ? `0 0 50px ${cor}44, 0 30px 70px #000a` : "0 30px 70px #000b", border: e.brilho ? `2px solid ${cor}88` : undefined,
        opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 60}px) scale(${0.94 + 0.06 * s})`,
      }}
    >
      <div style={{ width: "100%", height: "100%", transform: `scale(${z})` }}>
        <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {midia.credito && <div style={{ position: "absolute", right: 12, bottom: 10, fontSize: 18, color: "#fffc", background: "#0008", padding: "3px 10px", borderRadius: 4, fontFamily: "sans-serif" }}>{midia.credito}</div>}
    </div>
  );
};

export const GanchoL: React.FC<{ cena: CenaGancho; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const caber = useCaber();
  const s = pop(f, fps, 3, 14);
  return (
    <AbsoluteFill>
      <MidiaFundo midia={cena.midia} opacidade={0.7} desfoque={3} />
      <Em de={3}><Sfx nome="popup-2" volume={0.3} /></Em>
      <div style={{ position: "absolute", left: M, right: M, top: 240, opacity: Math.min(1, s * 1.4) }}>
        {cena.icone && <div style={{ transform: `scale(${s})`, transformOrigin: "left center" }}><Icone nome={cena.icone} tamanho={96} cor={cor} traco={1.75} /></div>}
        <Titulo texto={cena.texto_tela} tamanho={caber(cena.texto_tela, (1920 - M * 2) * 1.6, ESC.display)} cor={e.corTexto} largura={1500} />
        <div style={{ marginTop: 26, height: 10, width: 220 * interpolate(f, [10, 24], [0, 1], { ...clamp, easing: suave }), background: cor, borderRadius: Math.min(5, e.raio) }} />
      </div>
    </AbsoluteFill>
  );
};

export const CapituloL: React.FC<{ cena: CenaCapitulo; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const brilho = useBrilho();
  const sNum = pop(f, fps, 2, 13);
  const linha = interpolate(f, [6, 22], [0, 1], { ...clamp, easing: suave });
  const num = String(cena.numero ?? 1).padStart(2, "0");
  return (
    <AbsoluteFill>
      <MidiaFundo midia={cena.midia} opacidade={0.35} desfoque={18} />
      <Em de={2}><Sfx nome="impacto" volume={0.2} /></Em>
      <div style={{ position: "absolute", left: M, top: 230, display: "flex", alignItems: "flex-end", gap: 60 }}>
        <div style={{ fontFamily: titulo, fontSize: 340, lineHeight: 0.8, color: "transparent", WebkitTextStroke: `4px ${cor}`, opacity: sNum, transform: `translateY(${(1 - sNum) * 40}px)`, textShadow: e.brilho ? brilho(cor, 50) : undefined }}>{num}</div>
        <div style={{ paddingBottom: 14 }}>
          <Kicker cor={cor}>{cena.kicker ?? `Capítulo ${cena.numero ?? 1}`}</Kicker>
          <Titulo texto={cena.titulo} tamanho={ESC.h1} inicio={6} largura={1100} />
        </div>
      </div>
      <div style={{ position: "absolute", left: M, top: 620, height: 3, width: (1920 - M * 2) * linha, background: `${e.corTexto}33` }} />
    </AbsoluteFill>
  );
};

export const FatoL: React.FC<{ cena: CenaFato; cor: string; indice: number }> = ({ cena, cor, indice }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const temMidia = Boolean(cena.midia?.arquivo);
  const sK = pop(f, fps, 2, 14);
  const lado = indice % 2 ? -1 : 1;
  const kicker = cena.kicker ?? (cena.numero != null ? `Curiosidade nº ${cena.numero}` : "Você sabia?");
  // com mídia, alterna entre "documentário" (mídia no quadro todo) e mídia ao lado do texto
  if (temMidia && indice % 3 !== 2)
    return (
      <AbsoluteFill>
        <MidiaTela cena={cena} lado={lado} />
        <AbsoluteFill style={{ background: e.tema === "claro" ? "linear-gradient(90deg, #ffffffee 0%, #ffffff99 38%, #fff0 65%)" : "linear-gradient(90deg, #000d 0%, #0008 38%, #0000 65%), linear-gradient(0deg, #000c 0%, #0000 35%)" }} />
        <div style={{ position: "absolute", left: M, top: 300, width: 900, opacity: sK }}>
          <Kicker cor={cor}>{kicker}</Kicker>
          <Titulo texto={cena.titulo} tamanho={ESC.h1} largura={900} />
        </div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill>
      <MidiaFundo midia={cena.midia} opacidade={0.3} desfoque={40} />
      <div style={{ position: "absolute", left: M, top: 260, width: temMidia ? 720 : 1300, opacity: sK }}>
        <Kicker cor={cor}>{kicker}</Kicker>
        <Titulo texto={cena.titulo} tamanho={temMidia ? ESC.h2 : ESC.h1} largura={temMidia ? 720 : 1300} />
      </div>
      {temMidia ? (
        <MidiaLado midia={cena.midia} cor={cor} x={900} largura={1920 - 900 - M} />
      ) : (
        cena.icone && <div style={{ position: "absolute", right: M + 40, top: 230, opacity: pop(f, fps, 8, 14) }}><Icone nome={cena.icone} tamanho={380} cor={cor} traco={1.2} /></div>
      )}
    </AbsoluteFill>
  );
};

export const NumeroL: React.FC<{ cena: CenaNumero; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const caber = useCaber();
  const brilho = useBrilho();
  const casas = Number.isInteger(cena.valor) ? 0 : 1;
  const final = `${cena.prefixo ?? ""}${fmt(cena.valor, casas)}${cena.sufixo ?? ""}`;
  const c = cena.alerta ? ALERTA : cor;
  const p = interpolate(f, [6, 32], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const batida = f >= 32 ? 1 + 0.05 * Math.exp(-(f - 32) / 4) : 0.95 + 0.05 * p;
  return (
    <AbsoluteFill style={{ fontFamily: corpo, color: e.corTexto }}>
      <MidiaFundo midia={cena.midia} opacidade={0.45} desfoque={14} />
      <Em de={32}><Sfx nome="impacto" volume={0.3} /></Em>
      <div style={{ position: "absolute", left: M, right: M, top: 190 }}>
        <Kicker cor={c}>{cena.icone && <Icone nome={cena.icone} tamanho={34} cor={c} traco={2.25} />}{cena.alerta ? "Atenção" : "Em números"}</Kicker>
        <div style={{ marginTop: 20, fontFamily: titulo, fontSize: caber(final, 1920 - M * 2, 300), lineHeight: 1, whiteSpace: "nowrap", color: c, transform: `scale(${batida})`, transformOrigin: "left center", fontVariantNumeric: "tabular-nums", textShadow: e.brilho ? brilho(c, 60) : undefined }}>
          {cena.prefixo}{fmt(cena.valor * p, casas)}{cena.sufixo}
        </div>
        <div style={{ marginTop: 16, height: 10, width: `${interpolate(f, [32, 42], [0, 100], clamp)}%`, maxWidth: 900, background: c, borderRadius: Math.min(5, e.raio) }} />
        <Revelar inicio={28} style={{ marginTop: 30 }}><div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.18, maxWidth: 1300 }}>{cena.texto}</div></Revelar>
      </div>
    </AbsoluteFill>
  );
};

export const GraficoL: React.FC<{ cena: CenaGrafico; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const e = useEstilo();
  const { corpo } = useFontes();
  const curva = useEase();
  const A = { x: M + 40, y: 330, w: 1920 - M * 2 - 80, h: 430 };
  const max = Math.max(...cena.dados.map((d) => d.valor)) * 1.12 || 1;
  const n = cena.dados.length;
  const corDe = (i: number) => (cena.destaque != null ? (i === cena.destaque ? cor : `${e.corTexto}40`) : e.paleta ? e.paleta[i % e.paleta.length] : cor);
  const eixo = interpolate(f, [4, 18], [0, 1], { ...clamp, easing: suave });
  const pontos = cena.dados.map((d, i) => ({ x: A.x + (n === 1 ? A.w / 2 : (i / (n - 1)) * A.w), y: A.y + A.h - (d.valor / max) * A.h }));
  const caminho = pontos.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const pl = interpolate(f, [14, 14 + 12 * n], [0, 1], { ...clamp, easing: suave });
  const linha = evolvePath(pl, caminho);
  const unidade = cena.unidade ? ` ${cena.unidade}` : "";
  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: corpo }}>
      <div style={{ position: "absolute", left: M, top: TOPO_L }}>
        <Kicker cor={cor}>{cena.unidade ? `Em ${cena.unidade}` : "Os números"}</Kicker>
        <Titulo texto={cena.titulo} tamanho={ESC.h2} largura={1600} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[0, 0.5, 1].map((t) => <line key={t} x1={A.x} x2={A.x + A.w * eixo} y1={A.y + A.h * (1 - t)} y2={A.y + A.h * (1 - t)} stroke={e.corTexto} strokeOpacity={t === 0 ? 0.6 : 0.12} strokeWidth={t === 0 ? 3 : 2} />)}
        {cena.grafico === "barras" && cena.dados.map((d, i) => {
          const w = (A.w / n) * 0.56;
          const x = A.x + (A.w / n) * i + (A.w / n - w) / 2;
          const p = interpolate(f, [12 + i * 5, 30 + i * 5], [0, 1], { ...clamp, easing: curva });
          const h = (d.valor / max) * A.h * p;
          return <rect key={i} x={x} y={A.y + A.h - h} width={w} height={h} rx={Math.min(e.raio, 8)} fill={corDe(i)} />;
        })}
        {cena.grafico === "linha" && (
          <>
            {e.area && <path d={`${caminho} L ${pontos[n - 1].x} ${A.y + A.h} L ${pontos[0].x} ${A.y + A.h} Z`} fill={e.area} style={{ clipPath: `inset(0 ${100 - pl * 100}% 0 0)` }} />}
            <path d={caminho} fill="none" stroke={cor} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={linha.strokeDasharray} strokeDashoffset={linha.strokeDashoffset} />
            {pontos.map((p, i) => {
              const s = interpolate(pl, [i / Math.max(1, n - 1) - 0.02, i / Math.max(1, n - 1) + 0.04], [0, 1], clamp);
              return <circle key={i} cx={p.x} cy={p.y} r={12 * s} fill={e.fundo} stroke={corDe(i)} strokeWidth={5} />;
            })}
          </>
        )}
      </svg>
      {cena.dados.map((d, i) => {
        const cx = cena.grafico === "barras" ? A.x + (A.w / n) * (i + 0.5) : pontos[i].x;
        const topo = cena.grafico === "barras" ? A.y + A.h - (d.valor / max) * A.h : pontos[i].y;
        const s = pop(f, 30, cena.grafico === "barras" ? 24 + i * 5 : 14 + Math.round((12 * n * i) / Math.max(1, n - 1)), 14);
        return (
          <div key={i}>
            <div style={{ position: "absolute", left: cx - 150, width: 300, top: topo - 62, textAlign: "center", fontSize: 40, fontWeight: 800, opacity: s, color: i === cena.destaque ? cor : e.corTexto }}>{fmt(d.valor, Number.isInteger(d.valor) ? 0 : 1)}<span style={{ fontSize: 24, opacity: 0.7 }}>{unidade}</span></div>
            <div style={{ position: "absolute", left: cx - 150, width: 300, top: A.y + A.h + 16, textAlign: "center", fontSize: 28, fontWeight: 600, opacity: 0.8 * eixo }}>{d.rotulo}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const LinhaTempoL: React.FC<{ cena: CenaLinhaTempo; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const n = cena.eventos.length;
  const passo = Math.max(10, Math.min(30, (durationInFrames - 30) / n));
  const Y = 520;
  const W = 1920 - M * 2;
  const linha = interpolate(f, [4, 10 + passo * n], [0, 1], { ...clamp, easing: suave });
  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: corpo }}>
      <div style={{ position: "absolute", left: M, top: TOPO_L }}>
        <Kicker cor={cor}>Linha do tempo</Kicker>
        <Titulo texto={cena.titulo} tamanho={ESC.h2} largura={1600} />
      </div>
      <div style={{ position: "absolute", left: M, top: Y, width: W, height: 4, background: `${e.corTexto}22` }} />
      <div style={{ position: "absolute", left: M, top: Y, width: W * linha, height: 4, background: cor }} />
      {cena.eventos.map((ev, i) => {
        const x = M + (W / n) * (i + 0.5);
        const s = pop(f, fps, 8 + Math.round(passo * i), 13);
        return (
          <div key={i} style={{ position: "absolute", left: x - 170, width: 340, top: Y - 120, textAlign: "center", opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 30}px)` }}>
            <div style={{ fontFamily: titulo, fontSize: 64, color: cor, lineHeight: 1 }}>{ev.ano}</div>
            <div style={{ margin: "26px auto 0", width: 30, height: 30, borderRadius: "50%", background: e.fundo, border: `6px solid ${cor}` }} />
            {ev.icone && <div style={{ marginTop: 22 }}><Icone nome={ev.icone} tamanho={52} cor={e.corTexto} traco={1.75} /></div>}
            <div style={{ marginTop: ev.icone ? 10 : 26, fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>{ev.texto}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const ComparacaoL: React.FC<{ cena: CenaComparacao; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const W = (1920 - M * 2 - 60) / 2;
  const lado = (l: CenaComparacao["esquerda"], k: "esquerda" | "direita", i: number) => {
    const s = pop(f, fps, 6 + i * 8, 13);
    const venceu = cena.vencedor === k;
    const perdeu = cena.vencedor && !venceu;
    const veredito = interpolate(f, [40, 52], [0, 1], clamp);
    return (
      <div key={k} style={{
        position: "absolute", top: cena.titulo ? 290 : 150, left: M + i * (W + 60), width: W, height: 520, borderRadius: e.raio, padding: 44,
        background: e.superficie, border: `3px solid ${venceu && veredito > 0 ? cor : `${e.corTexto}22`}`, opacity: Math.min(1, s * 1.4) * (perdeu ? 1 - 0.45 * veredito : 1),
        transform: `translateY(${(1 - s) * 40}px)`, filter: perdeu ? `grayscale(${veredito})` : undefined,
      }}>
        {l.midia?.arquivo && <div style={{ position: "absolute", inset: 0, borderRadius: e.raio, overflow: "hidden", opacity: 0.25 }}><Conteudo midia={l.midia} estilo={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20 }}>
          {l.icone && <Icone nome={l.icone} tamanho={60} cor={venceu ? cor : e.corTexto} traco={1.75} />}
          <div style={{ fontFamily: titulo, fontSize: 64, textTransform: "uppercase", color: venceu ? cor : e.corTexto }}>{l.rotulo}</div>
        </div>
        <div style={{ position: "relative", marginTop: 34, display: "flex", flexDirection: "column", gap: 22 }}>
          {l.itens.map((t, j) => (
            <div key={j} style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: corpo, fontSize: 38, fontWeight: 600, opacity: pop(f, fps, 14 + i * 8 + j * 5, 14) }}>
              <Icone nome={perdeu ? "x" : "check"} tamanho={36} cor={perdeu ? ALERTA : cor} traco={3} />{t}
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ color: e.corTexto }}>
      {cena.titulo && <div style={{ position: "absolute", left: M, top: TOPO_L }}><Kicker cor={cor}>Comparação</Kicker><Titulo texto={cena.titulo} tamanho={ESC.h2} /></div>}
      {lado(cena.esquerda, "esquerda", 0)}
      {lado(cena.direita, "direita", 1)}
      <div style={{ position: "absolute", left: 960 - 46, top: (cena.titulo ? 290 : 150) + 214, width: 92, height: 92, borderRadius: "50%", background: e.fundo, border: `3px solid ${e.corTexto}33`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: titulo, fontSize: 36 }}>VS</div>
    </AbsoluteFill>
  );
};

export const ProdutoL: React.FC<{ cena: CenaProduto; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const s = pop(f, fps, 4, 13);
  const temMidia = Boolean(cena.midia?.arquivo);
  const X = 960;
  return (
    <AbsoluteFill style={{ color: e.corTexto, fontFamily: corpo }}>
      {temMidia ? <MidiaLado midia={cena.midia} cor={cor} x={M} largura={X - M - 60} atraso={2} /> : (
        <div style={{ position: "absolute", left: M, top: 200, width: X - M - 60, display: "flex", justifyContent: "center", opacity: s, transform: `scale(${0.8 + 0.2 * s})` }}>
          <Icone nome={cena.icone ?? "package"} tamanho={460} cor={cor} traco={1.1} />
        </div>
      )}
      <div style={{ position: "absolute", left: X, right: M, top: 170 }}>
        <Kicker cor={cor}>{cena.rank != null ? `Nº ${cena.rank} — ${cena.categoria}` : `${cena.etiqueta ?? "A solução"} — ${cena.categoria}`}</Kicker>
        <Titulo texto={cena.nome} tamanho={ESC.h1} />
        <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", gap: 18, opacity: pop(f, fps, 12, 14) }}>
          {cena.selo && <span style={{ fontSize: 28, fontWeight: 700, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>{cena.selo}</span>}
          <span style={{ fontFamily: titulo, fontSize: 88, color: cor, lineHeight: 1 }}>{cena.preco}</span>
        </div>
        {!!cena.tags?.length && (
          <div style={{ marginTop: 30, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {cena.tags.map((t, i) => <span key={i} style={{ fontSize: 30, fontWeight: 700, padding: "8px 20px", borderRadius: Math.min(e.raio, 999), background: e.superficie, border: `2px solid ${cor}55`, opacity: pop(f, fps, 16 + i * 4, 14) }}>{t}</span>)}
          </div>
        )}
        {(cena.specs ?? []).slice(0, 3).map((sp, i) => {
          const p = interpolate(f, [22 + i * 5, 40 + i * 5], [0, sp.valor / 100], { ...clamp, easing: suave });
          return (
            <div key={i} style={{ marginTop: i ? 16 : 34 }}>
              <div style={{ fontSize: 26, fontWeight: 700, opacity: 0.8 }}>{sp.label}</div>
              <div style={{ marginTop: 8, height: 14, borderRadius: 7, background: `${e.corTexto}1f` }}><div style={{ width: `${p * 100}%`, height: "100%", borderRadius: 7, background: cor }} /></div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const CtaL: React.FC<{ cena: CenaCta; cor: string }> = ({ cena, cor }) => {
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const s = pop(f, fps, 10, 12);
  const pulso = 1 + 0.03 * Math.sin(f / 5);
  const botao = cena.botao ?? (cena.acao === "link" ? "LINK NA DESCRIÇÃO" : cena.acao === "comentar" ? `COMENTA “${cena.palavra ?? ""}”` : "INSCREVA-SE");
  const icone = cena.acao === "link" ? "link" : cena.acao === "comentar" ? "message-circle" : "bell";
  return (
    <AbsoluteFill style={{ alignItems: "center", color: e.corTexto }}>
      <div style={{ position: "absolute", top: 230, left: M, right: M, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Revelar inicio={2}><div style={{ fontFamily: titulo, fontSize: ESC.h1, lineHeight: 1.02, textTransform: "uppercase" }}>{cena.texto_tela}</div></Revelar>
        <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 18, padding: "26px 56px", borderRadius: Math.min(e.raio, 999), background: cor, color: e.tema === "claro" ? "#fff" : "#0b0b0f", fontFamily: corpo, fontWeight: 900, fontSize: 48, opacity: s, transform: `scale(${(0.8 + 0.2 * s) * pulso})` }}>
          <Icone nome={icone} tamanho={48} cor={e.tema === "claro" ? "#fff" : "#0b0b0f"} traco={2.5} />{botao}
        </div>
      </div>
      <Em de={10}><Sfx nome="pop" volume={0.3} /></Em>
    </AbsoluteFill>
  );
};
