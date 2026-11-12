// Exemplos visuais nos cortes de pessoa a falar (podcast, entrevista, aula): o Claude lê a transcrição do corte já
// cortado e escolhe onde mostrar um vídeo/foto real, uma cena low poly ou uma ilustração a pincel por cima da fala.
// A voz continua; durante o exemplo a pessoa fica num canto (src/cenas/Clipe.tsx). Gameplay com webcam e vídeos que
// já mostram o que se diz ficam sem exemplos.
// Uso: node scripts/exemplos_clipe.mjs roteiros/x.json   (só as cenas clipe com "exemplos": true e ainda sem eles)
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const caminho = process.argv[2];
if (!caminho) { console.error("uso: node scripts/exemplos_clipe.mjs roteiros/x.json"); process.exit(1); }
const roteiro = JSON.parse(readFileSync(caminho, "utf-8"));

// o guia + os campos das cenas lowpoly e pincel tirados do esquema dos roteiros (para não haver duas versões)
function guia() {
  const base = readFileSync(".claude/skills/novo-video/exemplos-clipe.md", "utf-8");
  const esquema = readFileSync(".claude/skills/novo-video/esquema-roteiro.md", "utf-8").split(/\r?\n/);
  const ini = esquema.findIndex((l) => l.startsWith("- **lowpoly**"));
  let fim = esquema.findIndex((l) => l.startsWith("- **pincel**"));
  if (ini < 0 || fim < 0) return base;
  while (fim + 1 < esquema.length && /^\s+\S/.test(esquema[fim + 1])) fim++;
  return `${base}\n\n## Campos das cenas\n\n${esquema.slice(ini, fim + 1).join("\n")}`;
}

// os cenários low poly válidos, lidos do tipo (um cenário inventado partia o render)
const tipos = readFileSync("src/types.ts", "utf-8");
const CENARIOS = new Set([...(tipos.match(/tipo: "lowpoly";\s*cenario: ([^;]+);/)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]));
const ELEMENTOS = new Set(["icone", "texto", "seta", "circulo", "sublinhado", "x", "visto", "barras", "linha"]);
const FONTES = new Set(["pexels", "pixabay", "wikimedia", "steam"]);
const temChave = (nome) => !!process.env[nome] || readFileSync(".env", "utf-8").split(/\r?\n/).some((l) => l.startsWith(`${nome}=`) && l.length > nome.length + 1);

const claude = (sistema, pedido) => new Promise((ok, falha) => {
  const p = spawn("claude", ["-p", "--append-system-prompt", sistema, "--output-format", "json", "--allowedTools", "Read"], { stdio: ["pipe", "pipe", "pipe"], env: process.env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (err += d));
  p.on("error", (e) => falha(new Error(`não consegui iniciar o Claude: ${e.message}`)));
  p.on("close", (code) => {
    try {
      const texto = String(JSON.parse(out).result ?? "");
      const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
      if (code !== 0 || a < 0) throw new Error((texto || err).slice(0, 200) || `código ${code}`);
      ok(JSON.parse(texto.slice(a, b + 1)));
    } catch (e) { falha(new Error(`o Claude não devolveu exemplos: ${e.message}`)); }
  });
  p.stdin.end(pedido);
});

// transcrição em linhas curtas com o tempo de início (s), a partir das palavras do corte já cortado
function linhas(palavras) {
  const out = [];
  let atual = [];
  palavras.forEach((p, i) => {
    atual.push(p);
    if (i === palavras.length - 1 || /[.!?,]$/.test(p.texto) || atual.length >= 9) {
      out.push(`[${(atual[0].inicioMs / 1000).toFixed(1)}] ${atual.map((x) => x.texto).join(" ")}`);
      atual = [];
    }
  });
  return out.join("\n");
}

// tempos dentro do corte, sem sobreposições, com pessoa entre exemplos; tipos e campos conhecidos
function limpar(exemplos, duracaoS) {
  const bons = [];
  for (const x of [...(exemplos ?? [])].sort((a, b) => a.inicio - b.inicio)) {
    let ini = Math.max(1.5, Number(x.inicio)), fim = Math.min(duracaoS - 1.5, Number(x.fim));
    if (!Number.isFinite(ini) || !Number.isFinite(fim)) continue;
    fim = Math.min(fim, ini + 5); // nada fica mais de 5 s no ecrã
    if (fim - ini < (["palavras", "numero"].includes(x.tipo) ? 1.2 : 1.8)) continue;
    if (bons.length && ini < bons.at(-1).fimMs / 1000 + 1) continue;
    const item = { inicioMs: Math.round(ini * 1000), fimMs: Math.round(fim * 1000), cheio: true };
    if (x.tipo === "midia" && FONTES.has(x.midia?.fonte) && typeof x.midia?.consulta === "string") {
      const fonte = x.midia.fonte === "pexels" && !temChave("PEXELS_API_KEY") ? "pixabay" : x.midia.fonte;
      item.midia = { fonte, consulta: x.midia.consulta.slice(0, 120), tipo: x.midia.tipo === "imagem" ? "imagem" : "video" };
    } else if (x.tipo === "faixa" && FONTES.has(x.midia?.fonte) && typeof x.midia?.consulta === "string") {
      const fonte = x.midia.fonte === "pexels" && !temChave("PEXELS_API_KEY") ? "pixabay" : x.midia.fonte;
      item.midia = { fonte, consulta: x.midia.consulta.slice(0, 120), tipo: x.midia.tipo === "imagem" ? "imagem" : "video" };
      item.layout = "faixa";
      if (typeof x.titulo === "string" && x.titulo.trim()) item.titulo = x.titulo.trim().slice(0, 24);
    } else if (x.tipo === "numero" && Number.isFinite(Number(x.valor)) && typeof x.texto === "string") {
      const curto = (v, n) => (typeof v === "string" ? v.slice(0, n) : undefined);
      item.cena = { tipo: "numero", fala: "", valor: Number(x.valor), prefixo: curto(x.prefixo, 8), sufixo: curto(x.sufixo, 10), texto: x.texto.slice(0, 40), alerta: x.alerta === true };
    } else if (x.tipo === "palavras" && Array.isArray(x.palavras)) {
      const palavras = x.palavras.filter((w) => typeof w === "string" && w.trim()).map((w) => w.trim().slice(0, 18)).slice(0, 4);
      if (!palavras.length) continue;
      item.cena = { tipo: "palavras", fala: "", textos: palavras, fundo: x.fundo === "papel" ? "papel" : "escuro" };
    } else if (x.tipo === "lowpoly" && CENARIOS.has(x.cena?.cenario)) {
      const { titulo, fala, tipo, ...resto } = x.cena;
      item.cena = { ...resto, tipo: "lowpoly", fala: "" };
    } else if (x.tipo === "pincel" && Array.isArray(x.cena?.elementos)) {
      const elementos = x.cena.elementos.filter((e) => ELEMENTOS.has(e?.tipo)).slice(0, 6);
      if (!elementos.length) continue;
      const { titulo, fala, tipo, ...resto } = x.cena;
      item.cena = { ...resto, elementos, tipo: "pincel", fala: "" };
    } else continue;
    bons.push(item);
  }
  // a pessoa tem de aparecer em pelo menos 40% do corte: corta os últimos exemplos se passar
  while (bons.length && bons.reduce((t, b) => t + (b.fimMs - b.inicioMs), 0) > duracaoS * 600) bons.pop();
  return bons.slice(0, 12);
}

let mudou = false;
for (const [i, cena] of roteiro.cenas.entries()) {
  if (cena.tipo !== "clipe" || !cena.exemplos || cena.exemplosFeitos || !cena.palavras?.length) continue;
  if (cena.enquadramento?.modo === "webcam") {
    console.log(`  🎮 cena ${i + 1}: gameplay com webcam, sem exemplos (a imagem já mostra o jogo)`);
    Object.assign(cena, { exemplosFeitos: true });
    mudou = true;
    continue;
  }
  const duracaoS = (cena.duracaoMs ?? cena.palavras.at(-1).fimMs) / 1000;
  console.log(`  💡 cena ${i + 1}: o Claude está a escolher exemplos visuais (${duracaoS.toFixed(0)} s)…`);
  try {
    const r = await claude(guia(), [
      `DURAÇÃO DO CORTE: ${duracaoS.toFixed(1)} s.`,
      roteiro.titulo ? `TÍTULO: ${roteiro.titulo}` : "",
      `TRANSCRIÇÃO:\n${linhas(cena.palavras)}`,
    ].filter(Boolean).join("\n\n"));
    const novos = r.autoexplicativo ? [] : limpar(r.exemplos, duracaoS);
    cena.broll = [...(cena.broll ?? []).filter((b) => !b.cheio), ...novos];
    cena.exemplosFeitos = true;
    mudou = true;
    console.log(r.autoexplicativo || !novos.length
      ? `  ✔ cena ${i + 1}: sem exemplos (${r.motivo ?? "o vídeo já se explica"})`
      : `  ✔ cena ${i + 1}: ${novos.length} exemplos (${novos.map((n) => n.midia ? n.midia.consulta : n.cena.tipo).join("; ")})`);
  } catch (e) {
    // sem exemplos o corte sai na mesma; na próxima produção tenta outra vez
    console.log(`  ⚠ cena ${i + 1}: sem exemplos visuais: ${e.message}`);
  }
}
if (mudou) writeFileSync(caminho, JSON.stringify(roteiro, null, 2));
