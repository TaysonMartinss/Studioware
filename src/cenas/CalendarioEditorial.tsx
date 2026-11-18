import { AbsoluteFill, Easing, Sequence, interpolate, useVideoConfig } from "remotion";
import { Sfx } from "../components/Sfx";
import { FONTES, pop, useFrame } from "../components/motion";
import { CenaCalendario } from "../types";
import { Decoracoes } from "./Decoracoes";
import { FundoVice } from "../components/Vice";
import { FundoNoir } from "../components/FundosNoir";
import { TINTA, VERMELHO, usePaleta } from "./DadoEditorial";

// Passagem do tempo em formato editorial: um calendário de arrancar preso por duas argolas; as folhas rasgam-se e
// caem (a rodar, em perspetiva) de uma data até outra, devagar no início, rápidas no meio e a travar no fim. Na última
// folha a data leva um círculo de caneta vermelha e, por baixo, conta o tempo que passou ("+13 anos").
// Datas: "2010" (anos), "03/2015" (meses) ou "12/05/2020" (dias); a unidade é a mais fina das duas.

type Unidade = "ano" | "mes" | "dia";
type Data = { a: number; m: number; d: number };
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MAX_FOLHAS = 32; // intervalos maiores saltam folhas (a última é sempre a data final)

const ler = (s: string | number | undefined): { data: Data; unidade: Unidade } | null => {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{3,4})$/);
  if (m) return { data: { a: +m[3], m: Math.min(12, Math.max(1, +m[2])), d: Math.min(31, Math.max(1, +m[1])) }, unidade: "dia" };
  m = t.match(/^(\d{3,4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { data: { a: +m[1], m: Math.min(12, Math.max(1, +m[2])), d: Math.min(31, Math.max(1, +m[3])) }, unidade: "dia" };
  m = t.match(/^(\d{1,2})[/.-](\d{3,4})$/);
  if (m) return { data: { a: +m[2], m: Math.min(12, Math.max(1, +m[1])), d: 1 }, unidade: "mes" };
  m = t.match(/^-?\d{1,4}$/);
  if (m) return { data: { a: +t, m: 1, d: 1 }, unidade: "ano" };
  return null;
};
const ORDEM: Unidade[] = ["ano", "mes", "dia"];
const DIA_MS = 86400000;
const emDias = (x: Data) => Date.UTC(x.a, x.m - 1, x.d) / DIA_MS;
const deDias = (n: number): Data => { const t = new Date(n * DIA_MS); return { a: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };

// as folhas a mostrar (no máximo MAX_FOLHAS, sempre com a primeira e a última) e o tempo de cada uma desde o início
export const folhasDoCalendario = (de?: string, ate?: string) => {
  const a = ler(de), b = ler(ate);
  if (!a || !b) return null;
  const unidade = ORDEM[Math.max(ORDEM.indexOf(a.unidade), ORDEM.indexOf(b.unidade))];
  const total = unidade === "ano" ? b.data.a - a.data.a
    : unidade === "mes" ? (b.data.a - a.data.a) * 12 + (b.data.m - a.data.m)
    : Math.round(emDias(b.data) - emDias(a.data));
  const passos = Math.min(Math.abs(total), MAX_FOLHAS - 1);
  const folhas = Array.from({ length: passos + 1 }, (_, j) => {
    const off = passos ? Math.round((j / passos) * total) : 0;
    const data = unidade === "ano" ? { a: a.data.a + off, m: 1, d: 1 }
      : unidade === "mes" ? (() => { const n = a.data.a * 12 + (a.data.m - 1) + off; return { a: Math.floor(n / 12), m: (n % 12) + 1, d: 1 }; })()
      : deDias(emDias(a.data) + off);
    return { data, passou: Math.abs(off) };
  });
  return { unidade, folhas, total: Math.abs(total) };
};

const PLURAL: Record<Unidade, [string, string]> = { ano: ["ano", "anos"], mes: ["mês", "meses"], dia: ["dia", "dias"] };
const PAPEL_FOLHA = "#fbfaf6";

// uma folha: argolas no topo, cabeçalho de cor e a data enorme
const Folha: React.FC<{ data: Data; unidade: Unidade; cor: string; L: number; H: number; escuro?: number }> = ({ data, unidade, cor, L, H, escuro = 0 }) => {
  const topo = unidade === "ano" ? "ANO" : unidade === "mes" ? String(data.a) : `${MESES[data.m - 1].toUpperCase()} · ${data.a}`;
  const grande = unidade === "ano" ? String(data.a) : unidade === "mes" ? MESES[data.m - 1].slice(0, 3).toUpperCase() : String(data.d);
  const baixo = unidade === "ano" ? "" : unidade === "mes" ? MESES[data.m - 1] : SEMANA[new Date(Date.UTC(data.a, data.m - 1, data.d)).getUTCDay()];
  const tamanho = Math.min(H * 0.5, (L * 0.84) / Math.max(1.6, grande.length * 0.62));
  return (
    <div style={{ position: "absolute", inset: 0, background: PAPEL_FOLHA, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 0 rgba(0,0,0,0.08)" }}>
      <div style={{ height: H * 0.2, background: cor, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: H * 0.03 }}>
        <span style={{ fontFamily: FONTES.mono, fontSize: H * 0.05, letterSpacing: "0.24em", color: "#fff", fontWeight: 700 }}>{topo}</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.2, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: TINTA }}>
        <div style={{ fontFamily: FONTES.inter, fontWeight: 900, fontSize: tamanho, lineHeight: 0.9, letterSpacing: "-0.05em" }}>{grande}</div>
        {baixo && <div style={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: H * 0.075, marginTop: H * 0.02, opacity: 0.75 }}>{baixo}</div>}
      </div>
      {/* linhas finas do papel e sombra do vinco: dá matéria à folha */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.025) 0 2px, transparent 2px 7px)" }} />
      {escuro > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${escuro})` }} />}
    </div>
  );
};

export const CalendarioEditorial: React.FC<{ cena: CenaCalendario }> = ({ cena }) => {
  const f = useFrame();
  const { fps, width: L, height: A, durationInFrames: d } = useVideoConfig();
  const P = usePaleta(cena.rotulo ?? `${cena.de}-${cena.ate}`, cena.fundo);
  const cal = folhasDoCalendario(cena.de, cena.ate) ?? folhasDoCalendario("2000", "2025")!;
  const { unidade, folhas } = cal;
  const N = folhas.length;
  const cor = P.vice ? "#ff4fa3" : P.noir ? P.destaque : VERMELHO;

  // as folhas caem entre ~0,5 s e ~1,1 s antes do fim, devagar → rápido → devagar
  const ini = Math.round(fps * 0.5), fim = Math.max(ini + Math.round(fps * 0.6), d - Math.round(fps * 1.1));
  const indiceEm = (fr: number) => N < 2 ? 0 : Math.min(N - 1, Math.floor(interpolate(fr, [ini, fim], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) * (N - 1) + 1e-6));
  const rasgos: number[] = []; // frame em que cada folha j sai
  for (let fr = 0, k = 0; fr <= d && k < N - 1; fr++) while (k < indiceEm(fr) && k < N - 1) { rasgos.push(fr); k++; }
  const atual = indiceEm(f);
  const chegou = rasgos.length ? rasgos[rasgos.length - 1] : ini;

  // tamanho do bloco do calendário e entrada (sobe com mola)
  const W = Math.min(L * 0.66, 700), H = W * 1.08;
  const entrada = pop(f, fps, 0, 13);
  const impacto = N > 1 ? pop(f, fps, chegou, 8) : 1;
  const escala = (0.86 + 0.14 * entrada) * (1 + 0.05 * Math.sin(Math.min(1, impacto) * Math.PI));
  const cx = L / 2, cy = A * 0.5;
  const camara = `scale(${interpolate(f, [0, d], [1.02, 1.09])}) translateX(${interpolate(f, [0, d], [-12, 12])}px)`;
  const sRotulo = pop(f, fps, 2, 10);
  const passou = folhas[atual].passou;
  const fimOk = f >= chegou + 2;
  const circulo = interpolate(f, [chegou + 4, chegou + 4 + fps * 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // som de papel rasgado em até 7 folhas (com muitas, não vira ruído) e impacto na última
  const comSom = rasgos.filter((_, j) => rasgos.length <= 7 || j % Math.ceil(rasgos.length / 7) === 0 || j === rasgos.length - 1);
  const de = folhas[0].data, ate = folhas[N - 1].data;
  const fmt = (x: Data) => (unidade === "ano" ? String(x.a) : unidade === "mes" ? `${MESES[x.m - 1].slice(0, 3)} ${x.a}` : `${String(x.d).padStart(2, "0")}/${String(x.m).padStart(2, "0")}/${x.a}`);

  return (
    <AbsoluteFill style={{ background: P.fundo, overflow: "hidden" }}>
      <Sequence from={0} durationInFrames={Math.round(fps)} layout="none"><Sfx nome="whoosh" volume={0.34} /></Sequence>
      {comSom.map((fr, j) => <Sequence key={j} from={fr} durationInFrames={Math.round(fps * 0.8)} layout="none"><Sfx nome="rasgo" volume={0.22} /></Sequence>)}
      {N > 1 && <Sequence from={chegou + 3} durationInFrames={Math.round(fps)} layout="none"><Sfx nome="impacto" volume={0.25} /></Sequence>}
      <AbsoluteFill style={{ transform: camara }}>
        {P.vice && <FundoVice />}
        {P.noir && <FundoNoir variante={P.fundoNoir} />}
        {P.grelha && <AbsoluteFill style={{ backgroundImage: "linear-gradient(#0000002e 2px, transparent 2px), linear-gradient(90deg, #0000002e 2px, transparent 2px)", backgroundSize: "60px 60px", filter: "blur(1px)" }} />}
        <Decoracoes bloco={11} inicio={0} f={f} fps={fps} L={L} A={A} tinta={P.tinta} cor={P.destaque} quantos={5} evitar={[A * 0.08, A * 0.9]} />

        {/* título: o que este tempo significa */}
        <div style={{ position: "absolute", left: 70, right: 70, top: A * 0.1, color: P.tinta, textShadow: P.sombraTexto }}>
          <div style={{ fontFamily: FONTES.mono, fontSize: 26, letterSpacing: "0.22em", opacity: 0.55 * sRotulo }}>TEMPO —— {fmt(de)} → {fmt(ate)}</div>
          {cena.rotulo && <div style={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 70, lineHeight: 1.08, marginTop: 14, opacity: sRotulo, transform: `translateY(${(1 - sRotulo) * 16}px)` }}>{cena.rotulo}</div>}
        </div>

        <div style={{ position: "absolute", left: cx - W / 2, top: cy - H / 2 + (1 - entrada) * 120, width: W, height: H, transform: `scale(${escala}) rotate(-2.5deg)`, perspective: 1600 }}>
          {/* a espessura do bloco: folhas por baixo, cada vez menos à medida que caem */}
          {Array.from({ length: Math.min(6, Math.max(1, N - 1 - atual)) }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: 4 + k * 1.5, right: 4 - k * 1.5, top: 10 + (k + 1) * 7, height: H, background: k % 2 ? "#e9e6dd" : "#f3f1ea", borderRadius: 10, boxShadow: "0 1px 0 rgba(0,0,0,0.12)" }} />
          ))}
          <div style={{ position: "absolute", left: -10, right: -10, top: H * 0.08, height: H * 1.02, borderRadius: 14, boxShadow: P.noir ? "0 40px 90px rgba(0,0,0,0.7)" : "0 40px 80px rgba(0,0,0,0.22)" }} />
          {/* a folha de baixo (a próxima) e a de cima */}
          {atual + 1 < N && <div style={{ position: "absolute", inset: 0 }}><Folha data={folhas[atual + 1].data} unidade={unidade} cor={cor} L={W} H={H} escuro={0.06} /></div>}
          <div style={{ position: "absolute", inset: 0 }}><Folha data={folhas[atual].data} unidade={unidade} cor={cor} L={W} H={H} /></div>
          {/* círculo de caneta à volta da data final */}
          {fimOk && N > 1 && (
            <svg style={{ position: "absolute", left: W * 0.04, top: H * 0.3, width: W * 0.92, height: W * 0.92 * 0.66, overflow: "visible" }} viewBox="0 0 100 66">
              <path d="M 14 36 C 10 10, 86 2, 92 30 C 97 56, 24 66, 9 42 C 5 32, 16 18, 34 13" fill="none" stroke={cor} strokeWidth={1.6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - circulo} opacity={0.92} />
            </svg>
          )}
          {/* as folhas que já saíram: rasgam pelo topo e caem a rodar, em perspetiva */}
          {rasgos.map((fr, j) => {
            const idade = f - fr;
            if (idade < 0 || idade > fps * 1.05) return null;
            const lado = j % 2 ? 1 : -1, t = idade;
            const queda = t * t * 2.6 + t * 7;
            return (
              <div key={j} style={{ position: "absolute", inset: 0, transformOrigin: "50% 0%", opacity: interpolate(t, [fps * 0.65, fps * 1.05], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `translate(${lado * (t * 5 + t * t * 0.08)}px, ${queda}px) rotateX(${Math.min(38, t * 3)}deg) rotate(${lado * (t * 2.6 + t * t * 0.06)}deg)` }}>
                <Folha data={folhas[j].data} unidade={unidade} cor={cor} L={W} H={H} />
              </div>
            );
          })}
          {/* argolas por cima de tudo */}
          {[0.28, 0.72].map((x) => (
            <div key={x} style={{ position: "absolute", left: W * x - 16, top: -34, width: 32, height: 64, borderRadius: 16, border: `7px solid ${P.noir ? "#d8d8d8" : "#2a2a2a"}`, borderBottomColor: "transparent", boxShadow: "0 3px 4px rgba(0,0,0,0.25)" }} />
          ))}
        </div>

        {/* o tempo que passou, a contar */}
        {N > 1 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: cy + H / 2 + 80, display: "flex", justifyContent: "center", zIndex: 5, opacity: interpolate(f, [ini, ini + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "10px 34px 16px", background: fimOk ? cor : TINTA, color: "#fff", transform: `rotate(1.5deg) scale(${fimOk ? 1 + 0.08 * Math.max(0, 1 - (f - chegou - 2) / 8) : 1})`, boxShadow: "0 18px 40px rgba(0,0,0,0.25)" }}>
              <span style={{ fontFamily: FONTES.inter, fontWeight: 900, fontSize: 92, letterSpacing: "-0.04em" }}>+{passou.toLocaleString("pt-BR")}</span>
              <span style={{ fontFamily: FONTES.serif, fontStyle: "italic", fontSize: 64 }}>{PLURAL[unidade][passou === 1 ? 0 : 1]}</span>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
