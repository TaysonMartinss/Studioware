// Registo de custos (menu Custos do painel): cada chamada a um serviço pago fica numa linha de out/custos.jsonl.
// - claude: o Claude Code devolve no fim o custo equivalente na API (total_cost_usd) e os tokens. Com uma assinatura
//   (Pro/Max) não é cobrado à parte: é a medida do que se gastou do limite.
// - elevenlabs: caracteres narrados (o plano da ElevenLabs cobra por caracteres).
// - ia-externa: pedidos respondidos por outra IA (sem custo para o estúdio; só se contam).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ficheiroCustos = (raiz = ".") => join(raiz, "out", "custos.jsonl");

export function registarCusto(raiz, dados) {
  try {
    mkdirSync(join(raiz, "out"), { recursive: true });
    appendFileSync(ficheiroCustos(raiz), JSON.stringify({ em: new Date().toISOString(), ...dados }) + "\n");
  } catch { /* o registo de custos nunca pode parar um vídeo */ }
}

// do evento "result" do Claude Code (stream-json ou json): custo, tokens, duração e modelo
export function custoDoClaude(ev) {
  if (!ev || typeof ev !== "object") return null;
  const u = ev.usage ?? {};
  const modelos = Object.keys(ev.modelUsage ?? {});
  return {
    servico: "claude",
    custoUSD: Number(ev.total_cost_usd) || 0,
    tokens: {
      entrada: Number(u.input_tokens) || 0, saida: Number(u.output_tokens) || 0,
      cacheLeitura: Number(u.cache_read_input_tokens) || 0, cacheEscrita: Number(u.cache_creation_input_tokens) || 0,
    },
    duracaoS: Math.round((Number(ev.duration_ms) || 0) / 1000),
    modelo: modelos.join(", ") || undefined,
  };
}

export function registarClaude(raiz, ev, { etapa, video } = {}) {
  const c = custoDoClaude(ev);
  if (c) registarCusto(raiz, { ...c, etapa, video });
}

export function lerCustos(raiz = ".") {
  const f = ficheiroCustos(raiz);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
