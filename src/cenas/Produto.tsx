import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { Conteudo } from "../components/MidiaReal";
import { bordaRasgada, clamp, pop, shake, useCaber, useFontes, useFrame } from "../components/motion";
import { ESCALA, Kicker, RecortePapel, Revelar, TOPO, useBrilho, useMargem, useSombra, useTracking } from "../components/ui";
import { Em, Sfx } from "../components/Sfx";
import { useEstilo } from "../estilos";
import { CenaProduto } from "../types";

// Ordem de entrada dos elementos (frames dentro da cena)
const T = { kicker: 2, nome: 6, tags: 14, produto: 10, preco: 24, specs: 32 };
const sair = (t: number) => 1 - Math.pow(1 - t, 3);

// Ficha de produto editorial: etiqueta, nome grande, benefícios numa linha, foto, preço e specs
export const Produto: React.FC<{ cena: CenaProduto; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const caber = useCaber();
  const brilho = useBrilho();
  const sombra = useSombra();

  const sKicker = pop(f, fps, T.kicker, 14);
  const revelar = interpolate(f, [T.nome, T.nome + 10], [100, 0], { ...clamp, easing: sair });
  const sProd = pop(f, fps, T.produto, 15);
  const sPreco = pop(f, fps, T.preco, 12);
  const foto = cena.midia?.formato === "imagem" ? cena.midia.arquivo : cena.imagem;
  const papel = e.tema === "papel";
  const rotulo = cena.rank != null ? `Nº ${cena.rank}` : cena.etiqueta ?? "A solução";

  return (
    <AbsoluteFill style={{ transform: shake(f, [T.preco], 10 * e.shake), fontFamily: corpo, color: e.corTexto }}>
      <Em de={T.nome}><Sfx nome="impacto" volume={0.24} /></Em>
      <Em de={T.preco}><Sfx nome="pop" volume={0.5} /></Em>

      <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM }}>
        <Kicker cor={cor} style={{ opacity: sKicker, transform: `translateY(${(1 - sKicker) * 20}px)` }}>
          {rotulo} <span style={{ opacity: 0.55, color: e.corTexto }}>— {cena.categoria}</span>
        </Kicker>
        <div
          style={{
            marginTop: 22, fontFamily: titulo, fontSize: caber(cena.nome, 1080 - MARGEM * 2, ESCALA.h1), lineHeight: 1, whiteSpace: "nowrap",
            textTransform: "uppercase", clipPath: `inset(-10% ${revelar}% -10% 0)`, textShadow: sombra,
          }}
        >
          {cena.nome}
        </div>
        {/* benefícios numa linha de texto, separados por pontos (sem pílulas) */}
        <div style={{ marginTop: 20, fontSize: 36, fontWeight: 600, lineHeight: 1.3, display: "flex", flexWrap: "wrap", gap: "0 18px" }}>
          {(cena.tags ?? []).map((t, i) => {
            const s = interpolate(f, [T.tags + i * 4, T.tags + i * 4 + 8], [0, 1], clamp);
            return (
              <span key={i} style={{ opacity: s * 0.85, transform: `translateY(${(1 - s) * 12}px)`, display: "inline-flex", gap: 18 }}>
                {i > 0 && <span style={{ color: cor }}>·</span>}{t}
              </span>
            );
          })}
        </div>
      </div>

      {/* produto: foto num cartão claro, ou ícone grande num painel */}
      <div
        style={{
          position: "absolute", top: 560, left: MARGEM, right: MARGEM, height: 420,
          transform: `translateY(${(1 - sProd) * 120}px)`, opacity: Math.min(1, sProd * 1.4),
        }}
      >
        {cena.midia?.formato === "modelo3d" && cena.midia.arquivo ? (
          <Conteudo midia={cena.midia} estilo={{ width: "100%", height: "100%", borderRadius: e.raio }} />
        ) : foto && papel ? (
          <RecortePapel semente={`foto${cena.nome}`} padding={28} style={{ width: "100%", height: "100%" }}>
            <Img src={staticFile(foto)} style={{ width: "100%", height: 364, objectFit: "contain" }} />
          </RecortePapel>
        ) : foto ? (
          <div
            style={{
              width: "100%", height: "100%", background: "#fff", borderRadius: e.raio, padding: 28,
              boxShadow: papel ? "12px 14px 0 #0004" : `0 30px 60px #0007${e.brilho ? `, ${brilho(cor, 40)}` : ""}`,
              clipPath: papel ? bordaRasgada(`foto${cena.nome}`) : undefined,
            }}
          >
            <Img src={staticFile(foto)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", borderRadius: e.raio, background: e.superficie, display: "flex", alignItems: "center", justifyContent: "center", border: e.brilho && !e.glowRaio ? `2px solid ${cor}55` : "none", boxShadow: e.sombraInterna ? "inset 0 -16px 36px #0006, inset 0 2px 0 #ffffff14" : undefined }}>
            <Icone nome={cena.icone ?? "gpu"} tamanho={260} cor={cor} traco={1.25} style={{ transform: `rotate(${Math.sin(f / 30) * 3}deg)` }} />
          </div>
        )}
      </div>

      {/* preço e specs lado a lado, por baixo da imagem */}
      <div style={{ position: "absolute", top: 1010, left: MARGEM, right: MARGEM, display: "flex", gap: 48, alignItems: "flex-start" }}>
        <div style={{ opacity: sPreco, transform: `translateY(${(1 - sPreco) * 30}px)`, flexShrink: 0 }}>
          {cena.selo && <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.65 }}>{cena.selo}</div>}
          <div style={{ fontFamily: titulo, fontSize: 92, lineHeight: 1, color: cor, textShadow: e.brilho ? brilho(cor, 30) : undefined }}>{cena.preco}</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
          {(cena.specs ?? []).slice(0, 3).map((sp, i) => {
            const ini = T.specs + i * 5;
            const p = interpolate(f, [ini, ini + 20], [0, sp.valor], { ...clamp, easing: sair });
            return (
              <div key={i} style={{ opacity: interpolate(f, [ini, ini + 4], [0, 1], clamp) }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 26, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                  <span style={{ opacity: 0.75 }}>{sp.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(p)}</span>
                </div>
                <div style={{ height: 8, background: e.superficie, borderRadius: Math.min(4, e.raio) }}>
                  <div style={{ width: `${p}%`, height: "100%", background: cor, borderRadius: Math.min(4, e.raio) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
