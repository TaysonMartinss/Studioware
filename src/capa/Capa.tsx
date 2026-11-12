import { AbsoluteFill, random, useVideoConfig } from "remotion";
import { Conteudo } from "../components/MidiaReal";
import { FONTES } from "../components/motion";
import { RecortePapel } from "../components/ui";
import { ESTILOS, EstiloCtx, useEstilo } from "../estilos";
import { Midia } from "../types";

// Capa (thumbnail) de um vídeo, gerada como imagem parada: 9:16 para Shorts/Reels/TikTok, 16:9 para o YouTube.
// Três layouts para comparar (teste A/B): impacto (foto em ecrã inteiro), dividido (foto + bloco de texto) e objeto (o
// assunto em destaque, em 3D quando o vídeo tem um modelo). Regras do guia de CTR: 2 a 5 palavras, letras enormes e
// legíveis no telemóvel, uma palavra na cor do estilo, contraste alto e um só ponto de foco.
export type Layout = "impacto" | "dividido" | "objeto";
export type CapaProps = {
  estilo?: string;
  texto: string;
  destaque?: string; // palavra pintada na cor do estilo (por defeito, a última)
  layout: Layout;
  formato: "vertical" | "horizontal";
  fundo?: Midia; // foto ou vídeo do próprio vídeo (o vídeo usa o frame em inicioS)
  objeto?: Midia; // modelo 3D (layout objeto); sem ele usa a foto num cartão
  cor?: string;
};

export const tamanhoCapa = (formato: CapaProps["formato"]) => (formato === "horizontal" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 });

const LARGURA_LETRA: Record<string, number> = { anton: 0.53, marker: 0.7, vt323: 0.48, orbitron: 0.86 };
// capa pede letras enormes: condensada pesada (Anton) em todos os estilos, menos os de fonte com identidade própria
const fonteDaCapa = (titulo: string) => (["marker", "vt323", "orbitron"].includes(titulo) ? titulo : "anton");

// parte o texto em linhas curtas (cada linha ganha o seu tamanho: quanto mais curta, maior a letra)
const linhas = (palavras: string[], max: number) => {
  if (palavras.length <= 2) return palavras.map((p) => [p]);
  const total = palavras.join(" ").length;
  const n = Math.min(max, palavras.length >= 4 ? 3 : 2);
  const alvo = Math.max(...palavras.map((p) => p.length), Math.ceil(total / n));
  const out: string[][] = [[]];
  for (const p of palavras) {
    const atual = out[out.length - 1];
    if (atual.length && [...atual, p].join(" ").length > alvo && out.length < max) out.push([p]);
    else atual.push(p);
  }
  return out;
};

const Titulo: React.FC<{ texto: string; destaque?: string; largura: number; maxTam: number; cor: string; alinhar?: "left" | "center"; maxLinhas?: number }> = ({
  texto, destaque, largura, maxTam, cor, alinhar = "left", maxLinhas = 3,
}) => {
  const e = useEstilo();
  const chave = fonteDaCapa(e.titulo);
  const fonte = FONTES[chave] ?? FONTES.anton;
  const palavras = texto.toUpperCase().split(/\s+/).filter(Boolean);
  const alvo = (destaque ?? palavras[palavras.length - 1] ?? "").toUpperCase();
  const grupos = linhas(palavras, maxLinhas);
  const papel = e.tema === "papel";
  const larguraLetra = LARGURA_LETRA[chave] ?? 0.6;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: alinhar === "center" ? "center" : "flex-start", gap: papel ? 18 : 0 }}>
      {grupos.map((g, i) => {
        const linha = g.join(" ");
        const tam = Math.min(maxTam, Math.floor(largura / (Math.max(3, linha.length) * larguraLetra)));
        const conteudo = g.map((p, k) => {
          const marcada = p.replace(/[^\p{L}\d]/gu, "") === alvo.replace(/[^\p{L}\d]/gu, "");
          return (
            <span key={k} style={marcada && !papel
              ? { background: cor, color: "#0b0b0f", padding: "0 0.12em", margin: "0 0.08em", WebkitTextStroke: "0px transparent", textShadow: "none", display: "inline-block", boxShadow: "0 0.07em 0 #000", transform: `rotate(${-2 + random(p) * 4}deg)` }
              : { margin: "0 0.08em", color: marcada ? cor : undefined }}>{p}</span>
          );
        });
        if (papel)
          return (
            <RecortePapel key={i} semente={`capa${i}${linha}`} padding="6px 28px" fundo={i % 2 ? "#f1e3c6" : "#fffdf6"} style={{ transform: `rotate(${(random(`r${i}`) - 0.5) * 6}deg)` }}>
              <div style={{ fontFamily: FONTES.marker, fontSize: tam * 0.92, lineHeight: 1.1, color: "#1d1a16" }}>{conteudo}</div>
            </RecortePapel>
          );
        return (
          <div key={i} style={{
            fontFamily: fonte, fontWeight: 900, fontSize: tam, lineHeight: 0.98, color: "#fff", whiteSpace: "nowrap",
            WebkitTextStroke: `${Math.round(tam * 0.06)}px #000`, paintOrder: "stroke fill", textShadow: `0 ${Math.round(tam * 0.07)}px 0 #000, 0 0 ${Math.round(tam * 0.4)}px #000a`,
          }}>{conteudo}</div>
        );
      })}
    </div>
  );
};

const Foto: React.FC<{ midia?: Midia; filtro?: string; style?: React.CSSProperties }> = ({ midia, filtro = "saturate(1.3) contrast(1.12)", style }) =>
  midia?.arquivo ? (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", filter: filtro }} />
    </div>
  ) : null;

const Capa: React.FC<CapaProps> = ({ texto, destaque, layout, formato, fundo, objeto, cor: corPedida }) => {
  const e = useEstilo();
  const { width: L, height: A } = useVideoConfig();
  const cor = corPedida ?? e.cor;
  const deitado = formato === "horizontal";
  const M = deitado ? 80 : 70;
  const claro = e.tema === "claro" || e.tema === "papel";
  // fundo do estilo por baixo de tudo (o craft no papel, o escuro nos outros)
  const base = e.tema === "papel" ? "#d8c3a0" : e.fundo;

  if (layout === "dividido") {
    // foto num lado com corte em diagonal e filete na cor; texto no bloco sólido do outro
    const corte = deitado ? "polygon(14% 0, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 88%, 0 100%)";
    return (
      <AbsoluteFill style={{ background: base }}>
        <div style={{ position: "absolute", ...(deitado ? { left: L * 0.42, top: 0, right: 0, bottom: 0 } : { left: 0, right: 0, top: 0, height: A * 0.6 }), clipPath: corte, background: cor }}>
          <Foto midia={fundo} style={deitado ? { left: 14, clipPath: corte } : { bottom: 14, clipPath: corte }} />
        </div>
        <div style={{ position: "absolute", ...(deitado ? { left: M, top: M, bottom: M, width: L * 0.5 } : { left: M, right: M, top: A * 0.62, bottom: M * 2 }), display: "flex", alignItems: "center" }}>
          <Titulo texto={texto} destaque={destaque} largura={deitado ? L * 0.5 : L - M * 2} maxTam={deitado ? 230 : 300} cor={cor} />
        </div>
      </AbsoluteFill>
    );
  }

  if (layout === "objeto") {
    // o assunto ao centro com brilho na cor; o texto em cima (vertical) ou à esquerda (16:9)
    const area: React.CSSProperties = deitado ? { left: L * 0.5, right: M, top: M, bottom: M } : { left: M, right: M, top: A * 0.4, height: A * 0.48 };
    return (
      <AbsoluteFill style={{ background: base }}>
        <Foto midia={fundo} filtro="blur(26px) saturate(1.4) brightness(0.55)" style={{ transform: "scale(1.15)" }} />
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${deitado ? "72% 50%" : "50% 62%"}, ${cor}66, transparent 55%)` }} />
        {objeto?.arquivo ? (
          <div style={{ position: "absolute", ...area }}><Conteudo midia={objeto} estilo={{ width: "100%", height: "100%" }} /></div>
        ) : fundo?.arquivo ? (
          // sem modelo 3D: a foto num cartão grosso e torto, como um autocolante
          <div style={{ position: "absolute", ...area, transform: "rotate(3deg)", border: "14px solid #fff", boxShadow: `0 0 0 6px ${cor}, 0 40px 80px #000b`, borderRadius: 18, overflow: "hidden" }}>
            <Conteudo midia={fundo} estilo={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.3) contrast(1.1)" }} />
          </div>
        ) : null}
        <div style={{ position: "absolute", ...(deitado ? { left: M, top: M, bottom: M, width: L * 0.44 } : { left: M, right: M, top: M * 2.4, height: A * 0.34 }), display: "flex", alignItems: "center", justifyContent: deitado ? "flex-start" : "center" }}>
          <Titulo texto={texto} destaque={destaque} largura={deitado ? L * 0.44 : L - M * 2} maxTam={deitado ? 220 : 280} cor={cor} alinhar={deitado ? "left" : "center"} />
        </div>
      </AbsoluteFill>
    );
  }

  // impacto: foto em ecrã inteiro, gradiente escuro do lado do texto, letras enormes
  return (
    <AbsoluteFill style={{ background: base }}>
      <Foto midia={fundo} />
      <AbsoluteFill style={{ background: deitado ? "linear-gradient(90deg, #000d 0%, #0008 45%, #0000 70%)" : "linear-gradient(180deg, #0000 35%, #0009 60%, #000e 100%)" }} />
      {claro && e.tema === "papel" && <AbsoluteFill style={{ background: "#d8c3a022", mixBlendMode: "multiply" }} />}
      <div style={{ position: "absolute", ...(deitado ? { left: M, top: M, bottom: M, width: L * 0.56 } : { left: M, right: M, bottom: A * 0.12 }), display: "flex", alignItems: deitado ? "center" : "flex-end" }}>
        <Titulo texto={texto} destaque={destaque} largura={deitado ? L * 0.56 : L - M * 2} maxTam={deitado ? 250 : 320} cor={cor} />
      </div>
      {/* filete na cor do estilo: assinatura visual do canal em todas as capas */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: deitado ? 14 : 18, background: cor }} />
    </AbsoluteFill>
  );
};

export const CapaComposicao: React.FC<CapaProps> = (props) => {
  const estilo = ESTILOS[props.estilo ?? "neon"] ?? ESTILOS.neon;
  return (
    <EstiloCtx.Provider value={estilo}>
      <Capa {...props} />
    </EstiloCtx.Provider>
  );
};
