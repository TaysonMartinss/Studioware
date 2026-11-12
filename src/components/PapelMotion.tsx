import { random, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { useEstilo } from "../estilos";
import { Palavra } from "../types";
import { Icone } from "./Icone";
import { bordaRasgada, normalizar } from "./motion";
import { Sfx } from "./Sfx";

// Paper motion: tudo o que é papel anda a 7,5 fps (estilo.passo = 4), treme aos saltos e "ferve"
// (as bordas e as letras mudam ligeiramente de forma a cada frame, como recortes fotografados um a um).

const VARIANTES = 4;

// número da "fotografia" atual do stop motion (muda passo a passo, não a cada frame do vídeo)
export const useEtapa = () => {
  const f = useCurrentFrame();
  const { passo } = useEstilo();
  return passo > 1 ? Math.floor(f / passo) : f;
};

// Filtros SVG que deformam um pouco os contornos (letras e recortes), com uma semente diferente em cada variante.
// Rodando as 4 variantes a cada passo, o texto "pulsa" como 4 versões recortadas à mão da mesma palavra.
export const FiltrosFerver: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    {Array.from({ length: VARIANTES }, (_, k) => (
      <filter key={k} id={`ferver-${k}`} x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={k * 7 + 3} result="ruido" />
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale={5} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    ))}
  </svg>
);

// Ondulação das letras das legendas (como o "Turbulent Displace" do Premiere): os contornos ondulam e mudam de forma
// ~10 vezes por segundo, sem a palavra sair do sítio. Mais forte que o "ferver" do papel, porque a letra é grossa e tem contorno.
export const FiltrosOndular: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    {Array.from({ length: VARIANTES }, (_, k) => (
      <filter key={k} id={`ondular-${k}`} x="-8%" y="-15%" width="116%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves={2} seed={k * 11 + 5} result="ruido" />
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale={9} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    ))}
  </svg>
);
export const useOndular = () => {
  const f = useCurrentFrame();
  const { passo } = useEstilo();
  const foto = Math.floor(f / (passo > 1 ? passo : 3));
  return (semente = "") => `url(#ondular-${(foto + Math.floor(random(`on${semente}`) * VARIANTES)) % VARIANTES})`;
};

// filtro da variante atual (só no estilo papel); "extra" junta outro filtro (ex.: a sombra)
export const useFerver = () => {
  const e = useEstilo();
  const etapa = useEtapa();
  return (semente = "", extra?: string) => {
    if (e.tema !== "papel") return extra;
    const k = (etapa + Math.floor(random(`fv${semente}`) * VARIANTES)) % VARIANTES;
    return [`url(#ferver-${k})`, extra].filter(Boolean).join(" ");
  };
};

// borda rasgada que muda de forma a cada passo (3 cortes diferentes do mesmo recorte)
export const useBordaViva = () => {
  const e = useEstilo();
  const etapa = useEtapa();
  return (semente: string, dente?: number, pontos?: number) =>
    bordaRasgada(e.tema === "papel" ? `${semente}~${etapa % 3}` : semente, dente, pontos);
};

// Abertura explosiva do gancho: uma folha de papel amassado desdobra-se em menos de 1 s (dobra a dobra, aos saltos)
export const AberturaPapel: React.FC = () => {
  const e = useEstilo();
  const etapa = useEtapa();
  const { width: L } = useVideoConfig();
  // 0: bola amassada, 1-2: abre na vertical, 3-4: abre na horizontal, 5: aberta com os vincos a desaparecer
  const QUADROS: [number, number, number][] = [[0.16, 0.12, -14], [0.3, 0.42, 8], [0.42, 0.85, -5], [0.78, 1, 3], [0.95, 1, -1], [1, 1, 0]];
  const [sx, sy, r] = QUADROS[Math.min(etapa, QUADROS.length - 1)];
  const vincos = Math.max(0, 1 - Math.max(0, etapa - 4) * 0.35);
  if (vincos <= 0 && etapa > 8) return null;
  return (
    <>
      <Sequence from={0} durationInFrames={20} layout="none"><Sfx nome="amassado" volume={0.55} /></Sequence>
      <div
        style={{
          position: "absolute", left: L * 0.05, right: L * 0.05, top: 200, height: 760,
          transform: `scale(${sx}, ${sy}) rotate(${r}deg)`, transformOrigin: "50% 45%",
          filter: "drop-shadow(10px 12px 2px rgba(0,0,0,0.4))", opacity: etapa > 8 ? 0.85 : 1,
        }}
      >
        {/* a sombra fica no contentor: o clip-path cortá-la-ia */}
        <div style={{ position: "absolute", inset: 0, background: "#f6efe0", clipPath: bordaRasgada(`abertura~${Math.min(etapa, 5)}`, 3, 30) }}>
        {/* vincos da folha amassada: linhas de luz e sombra cruzadas que vão desaparecendo */}
        <div style={{
          position: "absolute", inset: 0, opacity: vincos,
          background: [
            "linear-gradient(115deg, transparent 30%, #0000001c 31%, transparent 33%)",
            "linear-gradient(62deg, transparent 55%, #ffffff66 56%, #0000001a 57.5%, transparent 59%)",
            "linear-gradient(170deg, transparent 40%, #00000018 41%, transparent 43%)",
            "linear-gradient(20deg, transparent 70%, #ffffff55 71%, #00000016 72%, transparent 74%)",
            "linear-gradient(90deg, transparent 49%, #0000001f 50%, #ffffff44 51%, transparent 52%)",
          ].join(", "),
        }} />
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: e.cor, opacity: etapa === 0 ? 0.25 : 0 }} />
    </>
  );
};

// Troca constante de elementos: a cada 3 palavras faladas entra um recorte novo (ícone da palavra ou forma decorativa)
// numa das bordas, com o clique de um obturador; nunca há mais de um, para não tapar a cena.
const FORMAS = ["star", "zap", "sparkles", "arrow-big-down", "circle-alert", "flame", "heart", "eye", "lightbulb", "move-right"];
const ICONES: Record<string, string> = {
  dinheiro: "banknote", reais: "banknote", dolares: "banknote", preco: "tag", jogo: "gamepad-2", jogos: "gamepad-2", pc: "monitor",
  computador: "monitor", placa: "cpu", tempo: "clock", anos: "calendar", dias: "calendar", fogo: "flame", perigo: "triangle-alert",
  internet: "wifi", mundo: "globe", terra: "globe", cidade: "building-2", carro: "car", telefone: "smartphone", celular: "smartphone",
  sol: "sun", agua: "droplet", energia: "zap", luz: "lightbulb", morte: "skull", cerebro: "brain", segredo: "lock", video: "video",
};
const VAGAS: React.CSSProperties[] = [
  // abaixo da legenda (1230–1370) e longe do cartão da mídia (até ~1170), nas laterais
  { left: 40, top: 1400 }, { right: 40, top: 1420 }, { left: 250, top: 1450 }, { right: 250, top: 1440 }, // até ~1600: os últimos 15% ficam livres
];
export const ColagemPapel: React.FC<{ palavras: Palavra[] }> = ({ palavras }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const etapa = useEtapa();
  const ferver = useFerver();
  const borda = useBordaViva();
  const e = useEstilo();
  if (palavras.length < 4) return null;
  // grupos de 3 palavras (o primeiro só depois da 3.ª palavra, para não chocar com a entrada da cena)
  const grupos = [];
  for (let i = 3; i < palavras.length; i += 3) grupos.push({ i, inicio: Math.round((palavras[i].inicioMs / 1000) * fps) });
  const atual = [...grupos].reverse().find((g) => f >= g.inicio);
  return (
    <>
      {grupos.map((g) => (
        <Sequence key={g.i} from={g.inicio} durationInFrames={10} layout="none"><Sfx nome="obturador" volume={0.18} /></Sequence>
      ))}
      {atual && (() => {
        const p = palavras.slice(atual.i - 2, atual.i + 1).map((w) => ICONES[normalizar(w.texto)]).find(Boolean);
        const icone = p ?? FORMAS[Math.floor(random(`forma${atual.i}`) * FORMAS.length)];
        const vaga = VAGAS[Math.floor(random(`vaga${atual.i}`) * VAGAS.length)];
        const fundos = ["#fffdf6", "#f1e3c6", e.cor, e.cor2];
        const fundo = fundos[Math.floor(random(`fundo${atual.i}`) * fundos.length)];
        const escuro = fundo === e.cor || fundo === e.cor2;
        const j = (eixo: string) => (random(`col${atual.i}${eixo}${etapa}`) - 0.5);
        // entra "colado" em 2 passos: maior e torto, depois assenta
        const entrou = f - atual.inicio >= 4;
        return (
          <div style={{
            position: "absolute", ...vaga, width: 150, height: 150,
            transform: `translate(${j("x") * 6}px, ${j("y") * 6}px) rotate(${(random(`rot${atual.i}`) - 0.5) * 30 + j("r") * 3}deg) scale(${entrou ? 1 : 1.25})`,
            filter: ferver(`col${atual.i}`, "drop-shadow(6px 6px 1px rgba(0,0,0,0.4))"),
          }}>
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: fundo, clipPath: borda(`col${atual.i}`, 4, 22) }}>
              <Icone nome={icone} tamanho={92} cor={escuro ? "#fffdf6" : "#1d1a16"} traco={2.2} />
            </div>
          </div>
        );
      })()}
    </>
  );
};
