import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { clamp, pop, shake, useCaber, useFontes, useFrame } from "../components/motion";
import { ESCALA, Revelar, useBrilho, useMargem, useSombra } from "../components/ui";
import { Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaCta } from "../types";

const CLIQUE = 26;

const Titulo: React.FC<{ texto: string }> = ({ texto }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const caber = useCaber();
  const sombra = useSombra();
  const s = pop(f, fps, 2, 14);
  const maior = texto.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <Revelar inicio={2} style={{ alignSelf: "stretch" }}>
    <div
      style={{
        fontFamily: titulo, fontSize: caber(maior, 1080 - MARGEM * 2, 140), lineHeight: 0.98,
        textAlign: "center", color: e.corTexto, textTransform: "uppercase", textShadow: sombra, letterSpacing: e.tracking,
        opacity: e.entrada ? 1 : Math.min(1, s * 1.4), transform: e.entrada ? undefined : `translateY(${(1 - s) * 30}px)`,
      }}
    >
      {texto}
    </div>
    </Revelar>
  );
};

// Botão principal da marca (cor sólida, cantos do estilo)
const Botao: React.FC<{ children: React.ReactNode; cor: string; style?: React.CSSProperties }> = ({ children, cor, style }) => {
  const e = useEstilo();
  const { corpo } = useFontes();
  const brilho = useBrilho();
  return (
    <div
      style={{
        fontFamily: corpo, fontWeight: 800, fontSize: 54, padding: "30px 56px", borderRadius: Math.max(e.raio, 8),
        background: cor, color: "#0b0b0f", display: "flex", alignItems: "center", gap: 20, boxShadow: e.brilho ? brilho(cor, 50) : "0 18px 40px #0006",
        border: e.tema === "papel" ? "4px solid #1d1a16" : "none", ...style,
      }}
    >
      {children}
    </div>
  );
};

// Botão de inscrição: aparece em `inicio`, o cursor carrega nele, passa a "Inscrito" e o sino balança.
// Nos CTA de comentar e de link aparece mais pequeno, depois da ação principal (todo o vídeo pede a inscrição).
const BotaoInscrever: React.FC<{ inicio: number; cor: string; texto?: string; pequeno?: boolean }> = ({ inicio, cor, texto, pequeno }) => {
  const f = useFrame() - inicio;
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const k = pequeno ? 0.72 : 1;
  const clique = CLIQUE - 10;
  const sBotao = pop(f, fps, 0, 13);
  const clicado = f >= clique;
  const aperto = clicado ? 1 - 0.06 * Math.exp(-(f - clique) / 3) : 1;
  const cx = interpolate(f, [2, clique], [380, 120], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) }) * k;
  const cy = interpolate(f, [2, clique], [260, 40], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) }) * k;
  const sino = clicado ? Math.sin((f - clique) / 1.6) * 22 * Math.exp(-(f - clique) / 14) : 0;
  if (f < 0) return null;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 28 * k, opacity: Math.min(1, sBotao * 1.4), transform: `translateY(${(1 - sBotao) * 30}px) scale(${aperto * k})` }}>
      <Sequence from={inicio + clique} layout="none"><Sfx nome="clique" volume={0.6} /></Sequence>
      <Botao cor={clicado ? e.superficie : cor} style={clicado ? { color: e.corTexto, boxShadow: "none" } : undefined}>
        <Icone nome={clicado ? "check" : "square-play"} tamanho={52} cor={clicado ? e.corTexto : "#0b0b0f"} traco={clicado ? 3 : 2.25} />
        {clicado ? "Inscrito" : texto ?? "Inscreva-se"}
      </Botao>
      <div style={{ transform: `rotate(${sino}deg)`, transformOrigin: "50% 10%" }}>
        <Icone nome={clicado ? "bell-ring" : "bell"} tamanho={84} cor={cor} traco={2} />
      </div>
      <div style={{ position: "absolute", left: cx, top: 30 + cy, opacity: f >= 2 ? 1 : 0, transform: `scale(${clicado ? 0.9 : 1})`, filter: "drop-shadow(0 6px 10px #0008)" }}>
        <Icone nome="mouse-pointer-2" tamanho={96} cor="#ffffff" traco={1.5} style={{ fill: "#111" }} />
      </div>
    </div>
  );
};

// Seguir: o pedido de inscrição em destaque
const Seguir: React.FC<{ cena: CenaCta; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const e = useEstilo();
  return (
    <AbsoluteFill style={{ transform: shake(f, [CLIQUE], 8 * e.shake), alignItems: "center" }}>
      <div style={{ position: "absolute", top: 340, left: MARGEM, right: MARGEM, display: "flex", flexDirection: "column", alignItems: "center", gap: 90 }}>
        <Titulo texto={cena.texto_tela} />
        <BotaoInscrever inicio={10} cor={cor} texto={cena.botao} />
      </div>
    </AbsoluteFill>
  );
};

// Link na bio: foto do produto, botão de compra e seta para o perfil
const Link: React.FC<{ cena: CenaCta; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const sBotao = pop(f, fps, 12, 13);
  const respira = 1 + 0.025 * Math.sin(f / 5);
  const foto = cena.midia?.formato === "imagem" ? cena.midia.arquivo : undefined;
  const sFoto = pop(f, fps, 6, 15);

  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <Sequence from={12} layout="none"><Sfx nome="pop" volume={0.5} /></Sequence>
      <div style={{ position: "absolute", top: foto ? 200 : 340, left: MARGEM, right: MARGEM, display: "flex", flexDirection: "column", alignItems: "center", gap: 70 }}>
      <Titulo texto={cena.texto_tela} />
      {foto && (
        <div style={{ width: 560, height: 360, background: "#fff", borderRadius: e.raio, padding: 24, opacity: Math.min(1, sFoto * 1.4), transform: `translateY(${(1 - sFoto) * 40}px)`, boxShadow: "0 30px 60px #0007" }}>
          <Img src={staticFile(foto)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      )}
      <div style={{ opacity: Math.min(1, sBotao * 1.4), transform: `translateY(${(1 - sBotao) * 30}px) scale(${respira})` }}>
        <Botao cor={cor}>
          <Icone nome="shopping-cart" tamanho={56} cor="#0b0b0f" traco={2.25} />
          {cena.botao ?? "Link na bio"}
        </Botao>
      </div>
      <div style={{ marginTop: -30, transform: `translateY(${Math.abs(Math.sin(f / 6)) * 26}px)`, opacity: interpolate(f, [16, 22], [0, 1], clamp) }}>
        <Icone nome="arrow-down" tamanho={90} cor={cor} traco={2.5} />
      </div>
      <div style={{ marginTop: -20 }}><BotaoInscrever inicio={40} cor={cor} pequeno /></div>
      </div>
    </AbsoluteFill>
  );
};

// Comentar: a palavra-chave é escrita num comentário e chega uma resposta com o link
const Comentar: React.FC<{ cena: CenaCta; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { corpo, titulo } = useFontes();
  const palavra = (cena.palavra ?? "LINK").toUpperCase();
  const letras = Math.floor(interpolate(f, [14, 14 + palavra.length * 3], [0, palavra.length], clamp));
  const enviado = 18 + palavra.length * 3;
  const sBalao = pop(f, fps, 8, 15);
  const sResposta = pop(f, fps, enviado + 10, 14);
  const claro = e.tema === "claro";
  const cartao = claro ? "#ffffff" : "#18181c";
  const suave = claro ? "#64748b" : "#8b8b98";

  return (
    <AbsoluteFill style={{ alignItems: "center", fontFamily: corpo }}>
      <Sequence from={enviado} layout="none"><Sfx nome="clique" volume={0.5} /></Sequence>
      <Sequence from={enviado + 10} layout="none"><Sfx nome="pop" volume={0.5} /></Sequence>
      <div style={{ position: "absolute", top: 260, left: MARGEM, right: MARGEM, display: "flex", flexDirection: "column", gap: 60 }}>
      <Titulo texto={cena.texto_tela} />
      <div
        style={{
          background: cartao, borderRadius: Math.max(e.raio, 18), padding: "26px 30px",
          display: "flex", gap: 22, alignItems: "center", opacity: Math.min(1, sBalao * 1.4), transform: `translateY(${(1 - sBalao) * 30}px)`, boxShadow: "0 24px 50px #0006",
        }}
      >
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: e.superficie, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icone nome="user-round" tamanho={46} cor={suave} traco={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 28, color: suave, fontWeight: 600 }}>você · agora</div>
          <div style={{ fontFamily: titulo, fontSize: ESCALA.h2 - 8, color: claro ? "#0f172a" : "#fff", letterSpacing: "0.04em" }}>
            {palavra.slice(0, letras)}<span style={{ opacity: f < enviado && f % 16 < 8 ? 1 : 0, color: cor }}>|</span>
          </div>
        </div>
      </div>
      <div
        style={{
          marginLeft: 90, marginTop: -30, background: cor, color: "#0b0b0f", borderRadius: Math.max(e.raio, 18),
          padding: "22px 28px", fontSize: 40, fontWeight: 700, display: "flex", gap: 16, alignItems: "center",
          opacity: Math.min(1, sResposta * 1.4), transform: `translateY(${(1 - sResposta) * 24}px)`,
        }}
      >
        <Icone nome="send" tamanho={42} cor="#0b0b0f" traco={2.25} />
        {cena.botao ?? "Te mandei o link na DM"}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}><BotaoInscrever inicio={enviado + 28} cor={cor} pequeno /></div>
      </div>
    </AbsoluteFill>
  );
};

export const Cta: React.FC<{ cena: CenaCta; cor: string }> = ({ cena, cor }) => {
  if (cena.acao === "link") return <Link cena={cena} cor={cor} />;
  if (cena.acao === "comentar") return <Comentar cena={cena} cor={cor} />;
  return <Seguir cena={cena} cor={cor} />;
};
