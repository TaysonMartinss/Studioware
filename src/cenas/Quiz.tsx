import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Icone } from "../components/Icone";
import { clamp, normalizar, pop, useCaber, useFontes } from "../components/motion";
import { Sfx } from "../components/Sfx";
import { ESCALA, Kicker, TOPO, useMargem, useSombra } from "../components/ui";
import { useEstilo } from "../estilos";
import { CenaQuiz, QUIZ_REVELA_MS, QUIZ_SEGUNDOS } from "../types";

const VERDE = "#22c55e";
const VERMELHO = "#ef4444";
const LETRAS = ["A", "B", "C", "D"];

// Quiz: pergunta + opções (cada uma entra quando o narrador a diz) e, depois da fala, uma contagem REAL em silêncio
// (o narrar.py junta `segundos` à duração da cena). No fim "TEMPO!" e, se houver `resposta`, a certa acende a verde.
// O tempo da contagem usa o frame real (sem o ritmo da emoção), para os segundos serem segundos.
export const Quiz: React.FC<{ cena: CenaQuiz; cor: string }> = ({ cena, cor }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const horizontal = width > height;
  const e = useEstilo();
  const { titulo, corpo } = useFontes();
  const sombra = useSombra();
  const caber = useCaber();
  const MARGEM = useMargem();

  const segundos = cena.segundos ?? QUIZ_SEGUNDOS;
  const falaMs = cena.falaMs ?? Math.max(0, (cena.duracaoMs ?? 0) - segundos * 1000 - QUIZ_REVELA_MS);
  const inicioConta = Math.round((falaMs / 1000) * fps) + 4;
  const fimConta = inicioConta + segundos * fps;
  const contando = f >= inicioConta && f < fimConta;
  const acabou = f >= fimConta;
  const restante = Math.max(0, fimConta - f) / fps;
  const temResposta = typeof cena.resposta === "number";

  // cada opção entra quando a fala chega à primeira palavra dela (sem palavras, entram em escada)
  const palavras = cena.palavras ?? [];
  let cursor = 0;
  const entradas = cena.opcoes.map((op, k) => {
    const alvo = normalizar(op.split(/\s+/)[0] ?? "");
    for (let j = cursor; j < palavras.length; j++) {
      if (alvo && normalizar(palavras[j].texto) === alvo) {
        cursor = j + 1;
        return Math.round((palavras[j].inicioMs / 1000) * fps) - 2;
      }
    }
    return 14 + k * 10;
  });

  const sTopo = pop(f, fps, 0, 14);
  const sPergunta = pop(f, fps, 3, 14);
  const larguraTexto = horizontal ? width * 0.5 - MARGEM : width - 2 * MARGEM;
  const tamPergunta = Math.max(56, Math.min(horizontal ? 96 : ESCALA.h2, caber(cena.pergunta.length > 22 ? cena.pergunta.slice(0, Math.ceil(cena.pergunta.length / 2)) : cena.pergunta, larguraTexto, ESCALA.h2)));

  // anel da contagem
  const R = horizontal ? 120 : 130;
  const fracao = contando ? restante / segundos : acabou ? 0 : 1;
  const corAnel = restante <= 2 && contando ? VERMELHO : cor;
  const numero = Math.max(1, Math.ceil(restante - 1e-6));
  const pulso = contando ? 1 + 0.08 * Math.max(0, 1 - ((f - inicioConta) % fps) / 8) : 1;
  const sAnel = pop(f, fps, inicioConta - 6, 13);
  const sTempo = pop(f, fps, fimConta, 10);

  // no vertical a lista tem de acabar antes de ~1150 (a marca d'água passa pelo meio e o anel vem a seguir):
  // a letra encolhe com o texto mais comprido e com 4 opções
  const quatro = cena.opcoes.length >= 4;
  const maisLonga = Math.max(...cena.opcoes.map((o) => o.length), 1);
  const tamOpcao = horizontal ? 46 : Math.max(44, Math.min(quatro ? 54 : 62, Math.floor((width - 2 * MARGEM - 190) / (maisLonga * 0.58))));
  const bola = horizontal ? 70 : quatro ? 74 : 86;
  const opcoes = (
    <div style={{ display: "flex", flexDirection: "column", gap: horizontal ? 22 : quatro ? 22 : 30 }}>
      {cena.opcoes.map((op, k) => {
        const s = pop(f, fps, entradas[k], 13);
        const certa = temResposta && acabou && k === cena.resposta;
        const errada = temResposta && acabou && k !== cena.resposta;
        const corBorda = certa ? VERDE : errada ? `${e.corTexto}22` : `${cor}aa`;
        return (
          <div key={k} style={{
            display: "flex", alignItems: "center", gap: 28, padding: horizontal ? "24px 30px" : quatro ? "26px 30px" : "36px 34px", borderRadius: Math.max(14, e.raio),
            background: certa ? `${VERDE}26` : e.superficie, border: `4px solid ${corBorda}`,
            opacity: Math.min(1, s * 1.4) * (errada ? 0.38 : 1), transform: `translateX(${(1 - s) * 90}px) scale(${certa ? 1 + 0.05 * sTempo : 1})`,
            boxShadow: certa ? `0 0 40px ${VERDE}66` : undefined,
          }}>
            <div style={{ width: bola, height: bola, flexShrink: 0, borderRadius: 999, display: "grid", placeItems: "center", background: certa ? VERDE : cor, color: e.fundo, fontFamily: titulo, fontSize: 40 }}>
              {certa ? <Icone nome="check" tamanho={42} cor={e.fundo} traco={3.5} /> : LETRAS[k]}
            </div>
            <div style={{ fontFamily: corpo, fontWeight: 800, fontSize: tamOpcao, lineHeight: 1.08, color: e.corTexto }}>{op}</div>
          </div>
        );
      })}
    </div>
  );

  const anel = (
    <div style={{ position: "relative", width: R * 2 + 40, height: R * 2 + 40, opacity: Math.min(1, sAnel * 1.3), transform: `scale(${(0.6 + 0.4 * sAnel) * pulso})` }}>
      <svg width={R * 2 + 40} height={R * 2 + 40} style={{ position: "absolute", inset: 0 }}>
        <circle cx={R + 20} cy={R + 20} r={R} fill={e.fundo} fillOpacity={0.85} stroke={`${e.corTexto}22`} strokeWidth={18} />
        <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={acabou ? VERMELHO : corAnel} strokeWidth={18} strokeLinecap="round"
          strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - fracao)} transform={`rotate(-90 ${R + 20} ${R + 20})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: titulo, color: acabou ? VERMELHO : corAnel, textShadow: sombra }}>
        {acabou
          ? <span style={{ fontSize: 64, transform: `scale(${0.5 + 0.5 * sTempo})` }}>TEMPO!</span>
          : <span style={{ fontSize: 150, lineHeight: 1 }}>{contando ? numero : segundos}</span>}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ color: e.corTexto }}>
      {/* um tique por segundo, o último mais forte, e o golpe no "TEMPO!" */}
      {Array.from({ length: segundos }, (_, k) => (
        <Sequence key={k} from={inicioConta + k * fps} durationInFrames={fps} layout="none">
          <Sfx nome="clique" volume={k >= segundos - 2 ? 0.9 : 0.6} />
        </Sequence>
      ))}
      <Sequence from={fimConta} layout="none"><Sfx nome="impacto" volume={0.5} /></Sequence>
      {temResposta && <Sequence from={fimConta + 6} layout="none"><Sfx nome="chime" volume={0.45} /></Sequence>}

      {cena.midia?.arquivo && cena.midia.formato !== "video" && (
        <AbsoluteFill style={{ opacity: 0.16 }}>
          <Img src={staticFile(cena.midia.arquivo)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(18px)" }} />
        </AbsoluteFill>
      )}

      {horizontal ? (
        <div style={{ position: "absolute", top: 120, left: MARGEM, right: MARGEM, bottom: 200, display: "flex", gap: 70 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 30 }}>
            <div style={{ opacity: sTopo }}><Kicker cor={cor}>{cena.numero ? `Pergunta ${cena.numero}${cena.total ? ` de ${cena.total}` : ""}` : "Quiz"}</Kicker></div>
            <div style={{ fontFamily: titulo, fontSize: tamPergunta, lineHeight: 1.04, textTransform: "uppercase", textShadow: sombra, opacity: sPergunta, transform: `translateY(${(1 - sPergunta) * 24}px)` }}>{cena.pergunta}</div>
            <div style={{ marginTop: "auto" }}>{anel}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{opcoes}</div>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", top: TOPO, left: MARGEM, right: MARGEM, display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ opacity: sTopo }}><Kicker cor={cor}>{cena.numero ? `Pergunta ${cena.numero}${cena.total ? ` de ${cena.total}` : ""}` : "Quiz"}</Kicker></div>
            <div style={{ fontFamily: titulo, fontSize: tamPergunta, lineHeight: 1.04, textTransform: "uppercase", textShadow: sombra, opacity: sPergunta, transform: `translateY(${(1 - sPergunta) * 24}px)` }}>{cena.pergunta}</div>
            <div style={{ marginTop: 40 }}>{opcoes}</div>
          </div>
          {/* a contagem fica onde estava a legenda: quando ela começa, o narrador já se calou */}
          <div style={{ position: "absolute", top: quatro ? 1290 : 1240, left: 0, right: 0, display: "flex", justifyContent: "center" }}>{anel}</div>
        </>
      )}
      {/* o ecrã aquece nos últimos 2 segundos */}
      {contando && restante <= 2 && <AbsoluteFill style={{ boxShadow: `inset 0 0 ${interpolate(restante, [0, 2], [160, 40], clamp)}px ${VERMELHO}55`, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};
