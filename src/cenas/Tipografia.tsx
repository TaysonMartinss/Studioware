import { AbsoluteFill, Easing, Sequence, interpolate, random, useVideoConfig } from "remotion";
import { Sfx } from "../components/Sfx";
import { Conteudo } from "../components/MidiaReal";
import { FONTES, normalizar, pop, useFrame } from "../components/motion";
import { useEstilo } from "../estilos";
import { CenaTipografia, Palavra } from "../types";

// Tipografia editorial (reels "3D minimalistas"): a narração paginada frase a frase como numa revista.
// A parte antes da palavra-chave em serifa itálica pequena, a palavra-chave enorme em letra pesada e o resto
// pequeno por baixo; cada palavra aparece quando é dita. Um objeto (3D ou imagem recortada) flutua ao lado do texto.
// Esta cena É a legenda (o Video não desenha a legenda normal por cima dela).
// Tudo vive num espaço 3D (camadas 3D do After Effects): o papel milimétrico ao fundo, o texto a meio (cada linha
// à sua profundidade) e o objeto à frente. Uma câmara virtual (o "nulo" ligado à câmara) faz zoom e pan suaves e
// reenquadra a cada frase, com paralaxe entre as camadas. Sound design: woosh a cada frase e um toque na palavra-chave.

const MAX_PALAVRAS = 7;

// blocos de até 7 palavras, a fechar na pontuação
const blocos = (ws: Palavra[]) => {
  const out: Palavra[][] = [];
  let atual: Palavra[] = [];
  ws.forEach((p, i) => {
    atual.push(p);
    if (i === ws.length - 1 || /[.!?,;:]$/.test(p.texto) || atual.length >= MAX_PALAVRAS) { out.push(atual); atual = []; }
  });
  return out;
};

const limpar = (t: string) => t.replace(/[.,;:!?…"]+$/g, "");

export const Tipografia: React.FC<{ cena: CenaTipografia; cor: string; destaques?: Set<string> }> = ({ cena, cor, destaques }) => {
  const f = useFrame();
  const { fps, width: L, height: A } = useVideoConfig();
  const e = useEstilo();
  const ms = (f / fps) * 1000;
  const lista = blocos(cena.palavras ?? []);
  const indice = Math.max(0, lista.findLastIndex((b) => b[0].inicioMs <= ms));
  const bloco = lista[indice] ?? [];
  if (!bloco.length) return null;

  // a palavra-chave: um destaque do roteiro, senão a mais comprida do bloco
  const pedidas = new Set((cena.chaves ?? []).map(normalizar));
  const chaveDe = (b: Palavra[]) => {
    const i = b.findIndex((p) => pedidas.has(normalizar(limpar(p.texto))) || destaques?.has(normalizar(limpar(p.texto))));
    return i >= 0 ? i : b.reduce((m, p, j) => (limpar(p.texto).length > limpar(b[m].texto).length ? j : m), 0);
  };
  const k = chaveDe(bloco);
  const antes = bloco.slice(0, k), chave = bloco[k], depois = bloco.slice(k + 1);

  const temObjeto = Boolean(cena.objeto?.arquivo);
  const acima = indice % 2 === 1; // alterna: texto em cima e objeto em baixo, e ao contrário
  const topoTexto = !temObjeto ? A * 0.33 : acima ? A * 0.16 : A * 0.56;
  const topoObjeto = acima ? A * 0.44 : A * 0.1;
  const sBloco = pop(f, fps, Math.round((bloco[0].inicioMs / 1000) * fps), 8);
  const palavraChave = limpar(chave.texto).toLowerCase();
  const tamanhoChave = Math.min(220, (L * 0.9) / (Math.max(4, palavraChave.length) * 0.56));
  const visivel = (p: Palavra) => ms >= p.inicioMs - 40;
  const entra = (p: Palavra) => pop(f, fps, Math.round((p.inicioMs / 1000) * fps), 6);
  const etiqueta = String(indice + 1).padStart(3, "0");
  const flutua = Math.sin(f / 22) * 14;

  // câmara: cada frase tem o seu enquadramento (zoom, pan e uma leve rotação); a passagem é suave (0,7 s)
  // e dentro da frase a câmara continua a avançar devagar (dolly), para nunca parar
  const enquadramento = (i: number) => ({
    z: random(`cz${i}`) * 150, x: (random(`cx${i}`) - 0.5) * 80, y: (random(`cy${i}`) - 0.5) * 70,
    ry: (random(`cr${i}`) - 0.5) * 11, rx: (random(`cq${i}`) - 0.5) * 7,
  });
  const iniBloco = Math.round((bloco[0].inicioMs / 1000) * fps);
  const passagem = interpolate(f, [iniBloco, iniBloco + 0.7 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const de = enquadramento(Math.max(0, indice - 1)), para = enquadramento(indice);
  const mix = (a: number, b: number) => a + (b - a) * (indice === 0 ? 1 : passagem);
  const dolly = ((f - iniBloco) / fps) * 22;
  const camara = `translate3d(${-mix(de.x, para.x)}px, ${-mix(de.y, para.y)}px, ${mix(de.z, para.z) + dolly}px) rotateX(${mix(de.rx, para.rx)}deg) rotateY(${mix(de.ry, para.ry)}deg)`;
  const z = (v: number): React.CSSProperties => ({ transform: `translateZ(${v}px)`, transformStyle: "preserve-3d" });

  const Linha: React.FC<{ ws: Palavra[]; estilo: React.CSSProperties }> = ({ ws, estilo }) => (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 0.28em", transformStyle: "preserve-3d", ...estilo }}>
      {ws.map((p, i) => (
        <span key={i} style={{ opacity: visivel(p) ? 1 : 0, transform: `translateY(${(1 - entra(p)) * 14}px)`, display: "inline-block" }}>{limpar(p.texto).toLowerCase()}</span>
      ))}
    </div>
  );

  return (
    <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: "50% 45%", overflow: "hidden" }}>
      {/* sound design: woosh em cada frase nova (a primeira já tem o da cena) e um toque quando a palavra-chave entra */}
      {lista.map((b, i) => {
        const ini = Math.round((b[0].inicioMs / 1000) * fps);
        const kc = Math.round((b[chaveDe(b)].inicioMs / 1000) * fps);
        return (
          <span key={i}>
            {i > 0 && <Sequence from={ini} durationInFrames={Math.round(fps * 1.2)} layout="none"><Sfx nome="whoosh" volume={0.38} /></Sequence>}
            <Sequence from={kc} durationInFrames={Math.round(fps * 0.8)} layout="none"><Sfx nome="clique" volume={0.3} /></Sequence>
          </span>
        );
      })}
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: camara }}>
        {/* camada do fundo: papel milimétrico bem atrás (maior, para cobrir o ecrã com o zoom e o pan) */}
        <div style={{
          position: "absolute", left: -L * 0.7, right: -L * 0.7, top: -A * 0.7, bottom: -A * 0.7, transform: "translateZ(-520px)",
          backgroundColor: e.fundo, backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px",
        }} />
        {/* camada do objeto: à frente do texto */}
        {temObjeto && (
          <div style={{ position: "absolute", left: L * 0.14, width: L * 0.72, top: topoObjeto, height: A * 0.42, transform: `translateZ(180px) translateY(${flutua}px) rotate(${Math.sin(f / 40) * 3}deg)`, filter: "drop-shadow(0 40px 40px #0000004d)" }}>
            <Conteudo midia={cena.objeto!} estilo={{ width: "100%", height: "100%", objectFit: "contain", background: "none" }} />
          </div>
        )}
        {/* camadas do texto: cada linha à sua profundidade (paralaxe quando a câmara roda) */}
        <div style={{ position: "absolute", left: 60, right: 60, top: topoTexto, textAlign: "center", color: e.corTexto, transformStyle: "preserve-3d", transform: `scale(${0.96 + 0.04 * sBloco})` }}>
          <div style={{ fontFamily: FONTES.mono, fontSize: 26, letterSpacing: "0.2em", opacity: 0.55 * Math.min(1, sBloco * 1.5), marginBottom: 18, ...z(110) }}>{etiqueta} ——</div>
          {antes.length > 0 && <Linha ws={antes} estilo={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.01em", ...z(60) }} />}
          <div style={{ fontFamily: FONTES.inter, fontWeight: 900, fontSize: tamanhoChave, lineHeight: 1, letterSpacing: "-0.05em", margin: "6px 0", opacity: visivel(chave) ? 1 : 0, transform: `translateZ(0px) scale(${0.8 + 0.2 * entra(chave)})` }}>
            {palavraChave}
          </div>
          {/* sublinhado à mão na cor de destaque, logo por baixo da palavra-chave, quando ela já foi dita */}
          <svg width={L - 120} height={30} style={{ display: "block", marginTop: -14, opacity: visivel(chave) ? 0.9 : 0, transform: "translateZ(-20px)" }}>
            <path d={`M ${L * 0.32} 14 Q ${L * 0.42} ${6 + random(`t${indice}`) * 14} ${L * 0.62} 12`} stroke={cor} strokeWidth={6} fill="none" strokeLinecap="round"
              strokeDasharray={L * 0.32} strokeDashoffset={L * 0.32 * (1 - entra(chave))} />
          </svg>
          {depois.length > 0 && <Linha ws={depois} estilo={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 54, lineHeight: 1.1, opacity: 0.85, ...z(-60) }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
};
