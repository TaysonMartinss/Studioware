// Ferramenta de manutenção: lista (ou troca) os textos que o utilizador vê no painel e nas mensagens do servidor,
// sem tocar em nomes de variáveis ou funções. Lê as strings e os pedaços fixos dos template literals com o acorn
// (JS) e os textos e atributos visíveis do HTML.
//   node scripts/textos_visiveis.mjs listar  <regex>        → mostra os textos que batem com a regex
//   node scripts/textos_visiveis.mjs trocar  regras.json    → aplica [{de, para}] (regex com \b) só nesses textos
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { readFileSync, writeFileSync } from "node:fs";

const JS = ["server/painel.js", "server/index.mjs", "server/cortes.mjs", "server/automatico.mjs", "server/youtube.mjs"];
const HTML = ["server/painel.html"];
const [modo, arg] = process.argv.slice(2);

// trechos [inicio, fim) de texto visível em cada ficheiro
function trechosJS(fonte) {
  const ast = acorn.parse(fonte, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  const out = [];
  walk.full(ast, (n) => {
    if (n.type === "Literal" && typeof n.value === "string") out.push([n.start + 1, n.end - 1]);
    if (n.type === "TemplateElement") out.push([n.start, n.end]);
  });
  // chaves de objetos, imports e comparações curtas sem espaços (ids, nomes de estados) ficam de fora mais abaixo
  return out;
}
function trechosHTML(fonte) {
  const out = [];
  // texto entre tags
  for (const m of fonte.matchAll(/>([^<]+)</g)) out.push([m.index + 1, m.index + 1 + m[1].length]);
  // atributos que se leem
  for (const m of fonte.matchAll(/\b(title|placeholder|aria-label|alt)="([^"]*)"/g)) {
    const ini = m.index + m[0].indexOf('"') + 1;
    out.push([ini, ini + m[2].length]);
  }
  return out;
}

// texto "de frase": tem um espaço ou acaba com pontuação; assim "guardar", "ligar" sozinhos (ids, nomes de rota) não mexem
const ehFrase = (t) => /\s/.test(t.trim()) || /[.!?…:]$/.test(t.trim()) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t.trim());

const ficheiros = [...JS.map((f) => [f, trechosJS]), ...HTML.map((f) => [f, trechosHTML])];
if (modo === "listar") {
  const re = new RegExp(arg, "i");
  for (const [f, fn] of ficheiros) {
    const fonte = readFileSync(f, "utf-8");
    for (const [a, b] of fn(fonte)) {
      const t = fonte.slice(a, b);
      if (ehFrase(t) && re.test(t)) console.log(`${f}:${fonte.slice(0, a).split("\n").length}: ${t.trim().slice(0, 140)}`);
    }
  }
} else if (modo === "trocar") {
  // ‹ e › são limites de palavra que entendem acentos e não partem nomes com - e / (classes CSS, ids, caminhos) (o \b do JavaScript não conta "ã" como letra)
  const limite = (de) => de.replaceAll("‹", String.raw`(?<![\p{L}\p{N}_/-])`).replaceAll("›", String.raw`(?![\p{L}\p{N}_/-])`);
  const regras = JSON.parse(readFileSync(arg, "utf-8")).map((r) => ({ re: new RegExp(limite(r.de), "gu"), para: r.para }));
  // valores de estado usados em comparações no código: nunca mudam
  const ESTADOS = new Set(["a correr", "aguardando revisao", "pronto", "erro"]);
  let total = 0;
  for (const [f, fn] of ficheiros) {
    const fonte = readFileSync(f, "utf-8");
    const trechos = fn(fonte).sort((x, y) => y[0] - x[0]); // do fim para o início: as posições não mudam
    let novo = fonte;
    for (const [a, b] of trechos) {
      const t = novo.slice(a, b);
      if (!ehFrase(t) || ESTADOS.has(t)) continue;
      let u = t;
      for (const { re, para } of regras) u = u.replace(re, para);
      if (u !== t) { novo = novo.slice(0, a) + u + novo.slice(b); total++; }
    }
    if (novo !== fonte) writeFileSync(f, novo);
  }
  console.log(`${total} textos alterados`);
}
