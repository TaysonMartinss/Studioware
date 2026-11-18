import { AbsoluteFill, useVideoConfig } from "remotion";
import { Conteudo } from "../components/MidiaReal";
import { FONTES } from "../components/motion";
import { FundoNoir } from "../components/FundosNoir";
import { ObjetoEditorial } from "../cenas/ObjetoEditorial";
import { PAPEL, TINTA, VERMELHO } from "../cenas/DadoEditorial";
import { Midia } from "../types";
import type { CapaProps } from "./Capa";

// Capa do estilo Editorial: o vídeo não tem fotos, por isso a capa é desenhada com a própria linguagem do estilo
// (os fundos do vídeo, tipografia de revista e o objeto 3D ou ícone a flutuar). Três layouts:
// impacto = topografia escura, objeto grande e a palavra-chave enorme em branco;
// dividido = papel milimétrico com um bloco vermelho na diagonal onde está o objeto, texto a preto em baixo;
// objeto = grelha azul, o objeto ao centro e o texto por cima.
const SOMBRA_ESCURO = "0 14px 40px rgba(0,0,0,0.85), 0 3px 10px rgba(0,0,0,0.6)";
const SOMBRA_PAPEL = "0 12px 32px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.1)";
const limpa = (p: string) => p.replace(/[^\p{L}\d]/gu, "").toLowerCase();

const Texto: React.FC<{ texto: string; destaque?: string; largura: number; maxTam: number; tinta: string; sombra: string; alinhar: "left" | "center" }> = ({
  texto, destaque, largura, maxTam, tinta, sombra, alinhar,
}) => {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  // a palavra-chave (a pedida, senão a última) vai enorme; o resto é a frase em serifa itálica
  let k = destaque ? palavras.findIndex((p) => limpa(p) === limpa(destaque)) : -1;
  if (k < 0) k = palavras.length - 1;
  const antes = palavras.slice(0, k).join(" "), chave = palavras[k] ?? "", depois = palavras.slice(k + 1).join(" ");
  const tam = Math.min(maxTam, largura / (Math.max(4, chave.length) * 0.6));
  const serifa = Math.min(tam * 0.5, largura / (Math.max(8, Math.max(antes.length, depois.length)) * 0.42));
  const frase: React.CSSProperties = { fontFamily: FONTES.serif, fontStyle: "italic", fontSize: serifa, lineHeight: 1.05, textShadow: sombra };
  return (
    <div style={{ color: tinta, textAlign: alinhar, width: largura }}>
      {antes && <div style={frase}>{antes.toLowerCase()}</div>}
      <div style={{ fontFamily: FONTES.inter, fontWeight: 900, fontSize: tam, lineHeight: 1, letterSpacing: "-0.05em", textTransform: "uppercase", whiteSpace: "nowrap", textShadow: sombra, margin: `${tam * 0.1}px 0 4px` }}>{chave}</div>
      {/* o sublinhado vermelho à mão, como nas cenas */}
      <svg width={tam * 2.4} height={tam * 0.2} style={{ display: "block", margin: alinhar === "center" ? "0 auto" : 0 }} viewBox="0 0 240 20">
        <path d="M 6 12 Q 90 4 234 10" stroke={VERMELHO} strokeWidth={7} fill="none" strokeLinecap="round" />
      </svg>
      {depois && <div style={{ ...frase, fontSize: serifa * 0.85, opacity: 0.9, marginTop: 6 }}>{depois.toLowerCase()}</div>}
    </div>
  );
};

const Objeto: React.FC<{ objeto?: Midia; estilo: React.CSSProperties; tamanho: number; sombra?: string }> = ({ objeto, estilo, tamanho, sombra = "drop-shadow(0 40px 50px #0008)" }) =>
  objeto?.arquivo ? (
    <div style={{ position: "absolute", filter: sombra, transform: "scale(1.3)", ...estilo }}>
      <ObjetoEditorial midia={objeto} tamanho={tamanho} cor={VERMELHO} />
    </div>
  ) : null;

const Kicker: React.FC<{ tinta: string; estilo: React.CSSProperties }> = ({ tinta, estilo }) => (
  <div style={{ position: "absolute", fontFamily: FONTES.mono, fontSize: 30, letterSpacing: "0.3em", color: tinta, opacity: 0.6, ...estilo }}>EDIÇÃO {new Date().getFullYear()} ——</div>
);

// o frame de uma cena do vídeo (as cenas low poly num vídeo editorial misto): fica no lugar do fundo do estilo
const Foto: React.FC<{ midia: Midia; filtro?: string; style?: React.CSSProperties }> = ({ midia, filtro = "saturate(1.15) contrast(1.08)", style }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
    <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "cover", filter: filtro }} />
  </div>
);

const grelhaPapel: React.CSSProperties = { backgroundColor: PAPEL, backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px" };

export const CapaEditorial: React.FC<CapaProps> = ({ texto, destaque, layout, formato, objeto, fundo }) => {
  const { width: L, height: A } = useVideoConfig();
  const deitado = formato === "horizontal";
  const M = deitado ? 90 : 80;
  const foto = fundo?.arquivo ? fundo : undefined;
  // com o frame da cena, a cena já é o ponto de foco: o objeto só entra no layout "objeto"
  const tem = Boolean(objeto?.arquivo) && !foto;

  if (layout === "dividido") {
    const corte = deitado ? "polygon(18% 0, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 82%, 0 100%)";
    return (
      <AbsoluteFill style={grelhaPapel}>
        <div style={{ position: "absolute", ...(deitado ? { left: L * 0.46, top: 0, right: 0, bottom: 0 } : { left: 0, right: 0, top: 0, height: A * 0.56 }), clipPath: corte, background: VERMELHO }}>
          {foto && <Foto midia={foto} />}
        </div>
        {!foto && <Objeto objeto={objeto} tamanho={deitado ? A * 0.7 : L * 0.7} estilo={deitado ? { left: L * 0.52, right: M, top: M, bottom: M } : { left: M, right: M, top: A * 0.06, height: A * 0.44 }} />}
        <Kicker tinta={TINTA} estilo={deitado ? { left: M, top: M } : { left: M, top: A * 0.6 }} />
        <div style={{ position: "absolute", ...(deitado ? { left: M, top: M * 1.8, bottom: M, width: L * 0.42 } : { left: M, right: M, top: A * 0.64, bottom: M }), display: "flex", alignItems: "center" }}>
          <Texto texto={texto} destaque={destaque} largura={deitado ? L * 0.42 : L - M * 2} maxTam={deitado ? 230 : 280} tinta={TINTA} sombra={SOMBRA_PAPEL} alinhar="left" />
        </div>
      </AbsoluteFill>
    );
  }

  if (layout === "objeto") {
    return (
      <AbsoluteFill style={{ background: "#050505" }}>
        {foto ? (
          // o frame da cena desfocado e escuro atrás; sem objeto, a própria cena nítida num cartão
          <Foto midia={foto} filtro={objeto?.arquivo ? "blur(22px) saturate(1.3) brightness(0.5)" : "blur(26px) brightness(0.4)"} style={{ transform: "scale(1.15)" }} />
        ) : (
          <FundoNoir variante={1} />
        )}
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${deitado ? "72% 55%" : "50% 64%"}, ${VERMELHO}55, transparent 50%)` }} />
        {foto && !objeto?.arquivo && (
          <div style={{ position: "absolute", ...(deitado ? { left: L * 0.5, right: M, top: M * 1.2, bottom: M * 1.2 } : { left: M, right: M, top: A * 0.42, height: A * 0.48 }), borderRadius: 28, overflow: "hidden", border: `8px solid ${PAPEL}`, boxShadow: "0 40px 80px #000c", transform: "rotate(-2deg)" }}>
            <Foto midia={foto} />
          </div>
        )}
        <Objeto objeto={objeto} tamanho={deitado ? A * 0.75 : L * 0.78} estilo={deitado ? { left: L * 0.5, right: M, top: M, bottom: M } : { left: M * 0.6, right: M * 0.6, top: A * 0.42, height: A * 0.48 }} />
        <div style={{ position: "absolute", ...(deitado ? { left: M, top: M, bottom: M, width: L * 0.44 } : { left: M, right: M, top: M * 1.6, height: A * 0.36 }), display: "flex", alignItems: "center", justifyContent: deitado ? "flex-start" : "center" }}>
          <Texto texto={texto} destaque={destaque} largura={deitado ? L * 0.44 : L - M * 2} maxTam={deitado ? 220 : 260} tinta="#fff" sombra={SOMBRA_ESCURO} alinhar={deitado ? "left" : "center"} />
        </div>
      </AbsoluteFill>
    );
  }

  // impacto: topografia escura (ou o frame da cena em ecrã inteiro), o objeto grande em cima (ou à direita) e o texto enorme
  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      {foto ? (
        <>
          <Foto midia={foto} />
          {/* escurece onde vai o texto, para ler em cima da cena */}
          <AbsoluteFill style={{ background: deitado ? "linear-gradient(90deg, #050505f2 0%, #050505b0 42%, transparent 70%)" : "linear-gradient(180deg, transparent 30%, #050505c0 55%, #050505f5 78%)" }} />
        </>
      ) : (
        <FundoNoir variante={0} />
      )}
      {!foto && <Objeto objeto={objeto} tamanho={deitado ? A * 0.8 : L * 0.85} estilo={deitado ? { left: L * 0.52, right: M * 0.5, top: M * 0.5, bottom: M * 0.5 } : { left: M * 0.4, right: M * 0.4, top: A * 0.06, height: A * 0.46 }} />}
      <Kicker tinta="#fff" estilo={deitado ? { left: M, top: M } : { left: M, top: tem || foto ? A * 0.55 : A * 0.3 }} />
      <div style={{ position: "absolute", ...(deitado ? { left: M, top: M * 1.6, bottom: M, width: L * 0.48 } : { left: M, right: M, top: tem || foto ? A * 0.58 : A * 0.34, bottom: M * 1.5 }), display: "flex", alignItems: deitado ? "center" : "flex-start" }}>
        <Texto texto={texto} destaque={destaque} largura={deitado ? L * 0.48 : L - M * 2} maxTam={deitado ? 250 : 300} tinta="#fff" sombra={SOMBRA_ESCURO} alinhar="left" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: deitado ? 14 : 18, background: VERMELHO }} />
    </AbsoluteFill>
  );
};
