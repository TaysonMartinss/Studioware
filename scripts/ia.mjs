// Pedidos à IA que devolvem JSON: pelo Claude Code (padrão) ou por uma IA externa à escolha do criador
// (ChatGPT, Gemini…), por copiar e colar, para não gastar só os tokens do Claude. IA_MODO=externa no .env liga o modo.
//
// No modo externo cada pedido vira um ficheiro em out/ia-externa/<id>.json com o texto completo (instruções + dados +
// formato da resposta). O painel mostra-o na Produção: o criador copia, cola na IA dele e cola a resposta de volta.
// O painel grava <id>.resposta.json (já validada) ou <id>.claude (usar o Claude neste pedido) e este módulo continua.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PASTA_PEDIDOS = "out/ia-externa";

export const lerEnvLocal = (raiz = ".") => {
  const p = join(raiz, ".env");
  if (!existsSync(p)) return {};
  return Object.fromEntries(readFileSync(p, "utf-8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
};
export const modoIA = (raiz = ".") => ((process.env.IA_MODO || lerEnvLocal(raiz).IA_MODO) === "externa" ? "externa" : "claude");

// o primeiro objeto JSON de uma resposta (as IAs às vezes põem texto ou ``` à volta)
export function tirarJSON(texto) {
  const t = String(texto ?? "");
  const ini = t.indexOf("{"), fim = t.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("Não encontrei um JSON na resposta. Cole a resposta inteira da IA.");
  try { return JSON.parse(t.slice(ini, fim + 1)); }
  catch (e) { throw new Error(`O JSON tem um erro (${e.message}). Peça à IA para corrigir e responder só com o JSON.`); }
}

// o texto que o criador cola na outra IA: autossuficiente (a outra IA não lê os ficheiros do projeto)
export function textoDoPedido({ sistema = "", pedido, ferramentas = [] }) {
  return [
    sistema && `# Instruções\n\n${sistema.trim()}`,
    `# Pedido\n\n${String(pedido).trim()}`,
    "# Como responder",
    [
      "- Responda **apenas com um objeto JSON válido**, no formato que as instruções pedem: sem texto antes nem depois e sem ```.",
      "- Os ficheiros do projeto citados nas instruções (guias, listas de modelos) não estão disponíveis aqui: siga as regras como estão escritas e, para nomes de modelos, use o nome mais provável (o estúdio procura o mais parecido).",
      ferramentas.some((f) => /web/i.test(f)) ? "- Pode e deve pesquisar na web para responder com informação atual." : "",
    ].filter(Boolean).join("\n"),
  ].filter(Boolean).join("\n\n");
}

const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

// pedidos à espera (os de processos que já morreram, ex. um vídeo parado, saem da lista e do disco)
export function pedidosPendentes(raiz = ".") {
  const pasta = join(raiz, PASTA_PEDIDOS);
  if (!existsSync(pasta)) return [];
  return readdirSyncSeguro(pasta).filter((f) => /^[a-z0-9]+\.json$/.test(f)).map((f) => {
    try {
      const p = JSON.parse(readFileSync(join(pasta, f), "utf-8"));
      if (!vivo(p.pid)) { rmSync(join(pasta, f), { force: true }); return null; }
      return p;
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => a.criado - b.criado);
}
const readdirSyncSeguro = (p) => { try { return readdirSync(p); } catch { return []; } };

// espera a resposta da IA externa. Devolve { json } com a resposta, ou { claude: true } se o criador pediu o Claude.
export function esperarExterno({ raiz = ".", rotulo, sistema, pedido, ferramentas = [], deveParar = () => false, intervalo = 1500 }) {
  const pasta = join(raiz, PASTA_PEDIDOS);
  mkdirSync(pasta, { recursive: true });
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = join(pasta, id);
  writeFileSync(`${base}.json`, JSON.stringify({ id, rotulo, texto: textoDoPedido({ sistema, pedido, ferramentas }), criado: Date.now(), pid: process.pid }, null, 2));
  const limpar = () => ["json", "resposta.json", "claude"].forEach((x) => rmSync(`${base}.${x}`, { force: true }));
  return new Promise((ok, falha) => {
    const ver = setInterval(() => {
      try {
        if (deveParar()) { clearInterval(ver); limpar(); return falha(new Error("Parado por si")); }
        if (existsSync(`${base}.resposta.json`)) {
          const json = JSON.parse(readFileSync(`${base}.resposta.json`, "utf-8"));
          clearInterval(ver); limpar(); return ok({ json });
        }
        if (existsSync(`${base}.claude`)) { clearInterval(ver); limpar(); return ok({ claude: true }); }
      } catch (e) { clearInterval(ver); limpar(); falha(e); }
    }, intervalo);
    // o processo a sair (vídeo parado) não deixa o pedido pendurado
    process.once("exit", limpar);
  });
}
