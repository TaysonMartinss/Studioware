import { random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Estilo, useEstilo } from "../estilos";
import { Palavra } from "../types";
import { Icone } from "./Icone";
import { AMARELO, FONTES, normalizar, pop } from "./motion";
import { useEtapa, useFerver, useOndular } from "./PapelMotion";
import { FAMILIA_LEGENDA } from "./FonteLegenda";
import { bounce6 } from "./ui";

// local = frames desde que a palavra começou; ordem = posição entre os destaques (para alternar cores)
type Estado = { s: number; local: number; ativa: boolean; destaque: boolean; negativa: boolean; ordem: number; i: number; semente: string; etapa: number; ferver?: string };

// palavras com carga negativa ficam a vermelho no kinetic (perigo, perda, erro)
const NEGATIVAS = new Set(["perder", "perde", "perdeu", "perda", "erro", "errado", "errada", "queimar", "queimou", "queimado", "queima", "nunca", "pior",
  "cuidado", "risco", "perigo", "caro", "cara", "prejuizo", "problema", "falha", "quebrar", "quebrou", "lento", "travando", "trava", "golpe", "nao"]);

// palavra-chave → ícone que salta junto com ela (Hormozi)
const ICONE_DA_PALAVRA: Record<string, string> = {
  dinheiro: "banknote", reais: "banknote", grana: "banknote", preco: "tag", barato: "tag", economia: "piggy-bank", economizar: "piggy-bank",
  meta: "target", objetivo: "target", crescer: "trending-up", crescimento: "trending-up", subir: "trending-up", cair: "trending-down",
  tempo: "clock", rapido: "zap", energia: "zap", luz: "zap", raio: "zap", raios: "zap", fps: "gauge", desempenho: "gauge",
  jogo: "gamepad-2", jogos: "gamepad-2", jogar: "gamepad-2", pc: "monitor", computador: "monitor", placa: "gpu", gpu: "gpu", processador: "cpu",
  memoria: "memory-stick", protecao: "shield-check", proteger: "shield-check", seguro: "shield-check", segredo: "lock", gratis: "gift",
  queimar: "flame", queimou: "flame", fogo: "flame", erro: "circle-x", errado: "circle-x", cuidado: "triangle-alert", perigo: "triangle-alert",
  melhor: "trophy", campeao: "trophy", comprar: "shopping-cart", link: "link",
};

// Cada variante de legenda define paginação, posição, tipografia e como desenhar cada palavra
type Variante = {
  porPagina: number;
  top: number;
  bloco: (e: Estilo) => React.CSSProperties;
  palavra: (e: Estilo, cor: string, x: Estado) => React.CSSProperties;
  caixa?: (e: Estilo, abrir: number) => React.CSSProperties; // contentor da página (ex.: pílula); abrir = 0→1 no início da página
  maiusculas?: boolean;
};

const VARIANTES: Record<Estilo["legenda"], Variante> = {
  padrao: {
    porPagina: 3, top: 1250, maiusculas: true,
    bloco: (e) => ({ fontFamily: FONTES[e.titulo], fontSize: 100, lineHeight: 1.15, gap: "0 40px" }),
    // destaque só pela cor da letra (sem caixa por trás): a palavra ativa na cor do estilo, os destaques a amarelo; sem glow
    palavra: (e, cor, { s, ativa, destaque }) => ({
      color: destaque ? AMARELO : ativa ? cor : "#fff",
      padding: "0 6px",
      transform: `scale(${(0.7 + 0.3 * s) * (ativa ? 1.04 : 1)}) translateY(${(1 - s) * 24}px)`,
      WebkitTextStroke: "12px #000", paintOrder: "stroke fill",
      textShadow: "0 6px 0 #000",
    }),
  },
  hormozi: {
    porPagina: 2, top: 1210, maiusculas: true,
    // bloco compacto: Montserrat Black com tracking negativo
    bloco: (e) => ({ fontFamily: FONTES.montserrat, fontWeight: 900, fontSize: 132, lineHeight: 1.02, gap: "0 28px", letterSpacing: e.tracking ?? "-0.03em" }),
    // branco por defeito; só a palavra de maior peso ganha cor (amarelo/verde a alternar, vermelho se for negativa)
    palavra: (e, cor, { local, destaque, negativa, ordem }) => ({
      color: negativa && destaque ? "#ff3333" : destaque ? (ordem % 2 ? e.cor2 : cor) : "#fff",
      transform: `scale(${bounce6(local) * (destaque ? 1.12 : 1)})`,
      WebkitTextStroke: "16px #000", paintOrder: "stroke fill",
      textShadow: "0 10px 0 #000",
    }),
  },
  papel: {
    // palavra a palavra no centro, cada uma num pedaço de fita-crepe ou de papel rasgado, a tremer aos saltos
    porPagina: 1, top: 1230,
    bloco: () => ({ fontFamily: FONTES.marker, fontSize: 112, lineHeight: 1.2, gap: "0" }),
    palavra: (e, cor, { local, destaque, semente, etapa, ferver }) => {
      const fita = !destaque && random(`${semente}t`) > 0.45;
      const j = (eixo: string) => random(`${semente}${eixo}${etapa}`) - 0.5;
      // fita-crepe: bege translúcido com as pontas cortadas em zigue-zague; papel: recorte de 4 cantos irregulares
      const zigue = "polygon(0 8%, 3% 0, 6% 9%, 94% 0, 97% 10%, 100% 2%, 100% 92%, 97% 100%, 94% 91%, 6% 100%, 3% 90%, 0 98%)";
      const rasgo = `polygon(${[0, 1, 2, 3].map((k) => `${[0, 100, 100, 0][k] + (random(`${semente}p${k}${etapa % 3}`) - 0.5) * 4}% ${[0, 0, 100, 100][k] + (random(`${semente}q${k}${etapa % 3}`) - 0.5) * 10}%`).join(", ")})`;
      return {
        background: destaque ? cor : fita ? "#e9dcb4f0" : random(`${semente}c`) > 0.5 ? "#fffdf6" : "#f1e3c6",
        color: destaque ? "#fff" : "#1d1a16", padding: fita ? "6px 34px" : "4px 26px",
        // entra "colada" em 2 fotos (maior e mais torta), depois assenta e só treme
        transform: `translate(${j("x") * 8}px, ${j("y") * 6}px) scale(${local < 4 ? 1.2 : 1}) rotate(${(random(semente) - 0.5) * 10 + j("r") * 2.5}deg)`,
        filter: [ferver, "drop-shadow(5px 5px 1px rgba(0,0,0,0.35))"].filter(Boolean).join(" "),
        clipPath: fita ? zigue : rasgo,
      };
    },
  },
  aquarela: {
    porPagina: 3, top: 1250,
    bloco: (e) => ({ fontFamily: FONTES.kalam, fontWeight: 700, fontSize: 96, lineHeight: 1.15, gap: "4px 22px", color: e.corTexto }),
    palavra: (e, cor, { s, ativa, destaque, semente }) => {
      const mancha = ativa || destaque ? Math.min(1, s * 1.2) : 0;
      const tom = destaque ? cor : e.cor2;
      const forma = ["54% 46% 58% 42% / 48% 60% 40% 52%", "42% 58% 45% 55% / 58% 44% 56% 42%", "60% 40% 50% 50% / 45% 55% 45% 55%"][semente.length % 3];
      return {
        opacity: s > 0.15 ? 1 : 0, transform: `translateY(${(1 - Math.min(1, s)) * 18}px) rotate(${(semente.charCodeAt(semente.length - 1) % 5) - 2}deg)`,
        padding: "0 16px", borderRadius: forma,
        background: mancha ? `radial-gradient(ellipse at 50% 55%, ${tom}${Math.round(0x55 * mancha).toString(16).padStart(2, "0")} 40%, ${tom}${Math.round(0x80 * mancha).toString(16).padStart(2, "0")} 66%, transparent 72%)` : "transparent",
      };
    },
  },
  marcador: {
    porPagina: 3, top: 1250, maiusculas: true,
    bloco: (e) => ({ fontFamily: FONTES.archivo, fontSize: 92, lineHeight: 1.12, gap: "6px 20px", color: e.corTexto }),
    palavra: (e, cor, { local, ativa, destaque, negativa, s }) => {
      // o marcador varre da esquerda para a direita em ~0,45 s; nos destaques fica
      const p = Math.min(1, Math.max(0, local / 13));
      const marca = ativa || destaque ? p : 0;
      return {
        opacity: s > 0.2 ? 1 : 0, transform: `translateY(${(1 - Math.min(1, s)) * 24}px)`, padding: "0 10px",
        background: marca ? `linear-gradient(${cor}, ${cor}) left 62% / ${marca * 100}% 62% no-repeat` : "transparent",
        ...(negativa && { textDecoration: "line-through", textDecorationColor: "#e5483f", textDecorationThickness: 10 }),
      };
    },
  },
  pilula: {
    porPagina: 4, top: 1300,
    // pílula sólida em azul claro: expande primeiro no eixo X, depois o texto aparece
    caixa: (e, abrir) => ({
      background: e.pilula?.fundo ?? "#e1f5fe", borderRadius: 999, padding: "18px 34px",
      transform: `scaleX(${abrir})`, transformOrigin: "center",
    }),
    bloco: () => ({ fontFamily: FONTES.inter, fontWeight: 600, fontSize: 66, lineHeight: 1.2, gap: "0 14px" }),
    palavra: (e, cor, { local, ativa, destaque }) => {
      const p = Math.min(1, Math.max(0, (local - 4) / 6)); // texto só depois de a pílula abrir
      const texto = e.pilula?.texto ?? "#0288d1";
      return {
        color: ativa || destaque ? "#fff" : texto, background: ativa || destaque ? texto : "transparent",
        borderRadius: 999, padding: "0 14px", opacity: p, transform: `translateY(${(1 - p) * 14}px)`,
      };
    },
  },
  elegante: {
    porPagina: 5, top: 1330,
    bloco: (e) => ({ fontFamily: FONTES[e.corpo], fontWeight: 600, fontSize: 64, lineHeight: 1.25, gap: "0 16px" }),
    palavra: (e, cor, { s, ativa, destaque }) => ({
      color: destaque ? e.cor2 : ativa ? cor : "#fff", opacity: 0.35 + 0.65 * s,
      transform: `translateY(${(1 - s) * 18}px)`, textShadow: "0 4px 18px #000c",
    }),
  },
  neon: {
    porPagina: 3, top: 1250, maiusculas: true,
    bloco: () => ({ fontFamily: FONTES.vt323, fontSize: 124, lineHeight: 1, gap: "0 28px" }),
    palavra: (e, cor, { s, ativa, destaque, i }) => {
      const c = destaque ? AMARELO : ativa ? e.cor2 : cor;
      return {
        color: "#fff", transform: `scale(${0.6 + 0.4 * s})`, opacity: (i + Math.floor(s * 10)) % 7 === 0 && s < 1 ? 0.4 : 1,
        textShadow: `0 0 8px ${c}, 0 0 24px ${c}, 0 0 48px ${c}, 4px 0 #ff004c88, -4px 0 #00e5ff88`,
      };
    },
  },
  hud: {
    porPagina: 4, top: 1300, maiusculas: true,
    caixa: (e, abrir) => ({ border: `3px solid ${e.cor}`, background: "#02141bcc", padding: "14px 26px", boxShadow: `0 0 30px ${e.cor}55`, clipPath: `inset(0 ${(1 - abrir) * 50}% 0 ${(1 - abrir) * 50}%)` }),
    bloco: () => ({ fontFamily: FONTES.mono, fontSize: 68, lineHeight: 1.2, gap: "0 20px" }),
    palavra: (e, cor, { s, ativa, destaque }) => ({
      color: destaque ? AMARELO : ativa ? "#fff" : cor, opacity: s > 0.3 ? 1 : 0,
      textShadow: `0 0 16px ${cor}`,
    }),
  },
};

const paginar = (palavras: Palavra[], max: number) => {
  const paginas: Palavra[][] = [];
  let atual: Palavra[] = [];
  palavras.forEach((p, i) => {
    atual.push(p);
    // também parte quando a fala para mais de 0,7 s (uma página nunca atravessa um silêncio ou um apoio editorial)
    const prox = palavras[i + 1];
    if (atual.length >= max || /[.,!?;:]$/.test(p.texto) || (prox && prox.inicioMs - p.fimMs > 700)) {
      paginas.push(atual);
      atual = [];
    }
  });
  if (atual.length) paginas.push(atual);
  return paginas;
};

export const Legendas: React.FC<{ palavras: Palavra[]; destaques: Set<string>; cor: string; emojis?: Record<string, string> }> = ({
  palavras, destaques, cor, emojis,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const etapa = useEtapa();
  const ferver = useFerver();
  const ondular = useOndular();
  const v = VARIANTES[e.legenda] ?? VARIANTES.padrao;
  // todas as legendas menos a do papel: fonte Keep Calm (com a do estilo por trás) e letras a ondular
  const papel = e.legenda === "papel";
  const ms = (f / fps) * 1000;

  const paginas = paginar(palavras, v.porPagina);
  const indice = paginas.findLastIndex((pg) => pg[0].inicioMs <= ms);
  const pagina = paginas[indice];
  if (!pagina) return null;
  // a página sai 0,8 s depois da última palavra (no fim do vídeo e quando a fala para, ex. num apoio editorial)
  if (ms > pagina[pagina.length - 1].fimMs + 800) return null;

  const inicioPagina = Math.round((pagina[0].inicioMs / 1000) * fps);
  const abrir = spring({ frame: f - inicioPagina + 2, fps, config: { damping: 20, stiffness: 220 } });
  // ordem de cada destaque no vídeo inteiro (para alternar amarelo/verde de forma estável)
  const ordemDe = (p: Palavra) => palavras.filter((w) => w.inicioMs <= p.inicioMs && destaques.has(normalizar(w.texto))).length;
  // ícone da palavra-chave mais recente desta página
  const comIcone = e.iconesPalavras ? [...pagina].reverse().find((p) => p.inicioMs <= ms && ICONE_DA_PALAVRA[normalizar(p.texto)]) : undefined;
  const localIcone = comIcone ? f - Math.round((comIcone.inicioMs / 1000) * fps) : 0;
  // emoji da palavra-chave mais recente desta página (escolhido na análise dos cortes); tem prioridade sobre o ícone
  const comEmoji = emojis ? [...pagina].reverse().find((p) => p.inicioMs <= ms && emojis[normalizar(p.texto)]) : undefined;
  const localEmoji = comEmoji ? f - Math.round((comEmoji.inicioMs / 1000) * fps) : 0;

  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: v.top, display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
      {/* o ícone entra ao lado das palavras (por cima taparia o conteúdo da cena) */}
      {comEmoji && (
        <div style={{ flexShrink: 0, fontSize: 120, lineHeight: 1, transform: `scale(${bounce6(localEmoji)}) rotate(${Math.sin(localEmoji / 5) * 8}deg)`, filter: "drop-shadow(0 8px 0 #0008)" }}>
          {emojis![normalizar(comEmoji.texto)]}
        </div>
      )}
      {!comEmoji && comIcone && (
        <div style={{ flexShrink: 0, transform: `scale(${bounce6(localIcone)})`, filter: "drop-shadow(0 8px 0 #000)" }}>
          <Icone nome={ICONE_DA_PALAVRA[normalizar(comIcone.texto)]} tamanho={120} cor={NEGATIVAS.has(normalizar(comIcone.texto)) ? "#ff3333" : e.cor} traco={2.5} />
        </div>
      )}
      <div
        style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", textAlign: "center",
          // na Keep Calm (todas menos papel) sem caixa alta
          textTransform: papel && v.maiusculas ? "uppercase" : "none", ...v.bloco(e), ...v.caixa?.(e, abrir),
          ...(papel ? {} : { fontFamily: `"${FAMILIA_LEGENDA}", ${v.bloco(e).fontFamily ?? "sans-serif"}` }),
        }}
      >
        {pagina.map((p, i) => {
          const inicio = Math.round((p.inicioMs / 1000) * fps);
          const texto = p.texto.replace(/[.,;:]$/, "");
          if (f < inicio) return <span key={i} style={{ opacity: 0 }}>{texto}</span>;
          const n = normalizar(p.texto);
          const estado: Estado = {
            s: pop(f, fps, inicio, 9), local: f - inicio, i,
            ativa: ms >= p.inicioMs && ms <= p.fimMs + 120,
            destaque: destaques.has(n), negativa: NEGATIVAS.has(n), ordem: ordemDe(p),
            semente: `${indice}-${i}`, etapa, ferver: ferver(`${indice}-${i}`),
          };
          const estilo = v.palavra(e, cor, estado);
          if (!papel) estilo.filter = [ondular(`${indice}-${i}`), estilo.filter].filter(Boolean).join(" ");
          return <span key={i} style={{ display: "inline-block", ...estilo }}>{texto}</span>;
        })}
      </div>
    </div>
  );
};
