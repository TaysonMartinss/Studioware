// Cortes automáticos: transcreve um vídeo longo, o Claude pontua janelas de ~90 s e detalha os melhores cortes
// (nota de viralidade, gancho, título, legenda, palavras-chave com emoji). Depois cada corte escolhido vira um
// roteiro "clipe" com início e fim, que o pipeline normal recorta, tira silêncios, legenda e enquadra no rosto.
// Seleção em duas fases adaptada do openshorts (github.com/mutonby/openshorts, MIT).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const JANELA = 90, SOBREPOR = 30;

export function criarCortes({ raiz, claudeJSON }) {
  const guia = join(raiz, ".claude/skills/novo-video/cortes.md");
  const pasta = (arquivo) => join(raiz, "out/cortes", basename(arquivo).replace(/\.[^.]+$/, ""));

  const transcrever = (t, arquivo) => new Promise((ok, falha) => {
    const saida = join(pasta(arquivo), "transcricao.json");
    const p = spawn(process.execPath, ["scripts/transcrever_longo.mjs", join("public", arquivo), saida], { cwd: raiz, stdio: ["ignore", "pipe", "pipe"] });
    let erro = "";
    p.stdout.on("data", (d) => { const l = String(d).trim().split(/\r?\n/).pop(); if (l) t.passo = `🎧 ${l}`; });
    p.stderr.on("data", (d) => { erro += d; });
    p.on("close", (code) => (code === 0 ? ok(JSON.parse(readFileSync(saida, "utf-8"))) : falha(new Error(`A transcrição falhou: ${erro.slice(-300)}`))));
  });

  // janelas de ~90 s alinhadas ao início das frases, com 30 s de sobreposição
  const janelas = (tr) => {
    const out = [];
    let i = 0;
    while (i < tr.frases.length) {
      const ini = tr.frases[i].inicio;
      let j = i;
      while (j < tr.frases.length && tr.frases[j].fim - ini < JANELA) j++;
      const fs = tr.frases.slice(i, Math.max(j, i + 1));
      out.push({ id: `j${out.length}`, inicio: ini, fim: fs.at(-1).fim, texto: fs.map((f) => `[${f.inicio.toFixed(1)}] ${f.texto}`).join("\n") });
      if (j >= tr.frases.length) break;
      // a próxima começa ~30 s antes do fim desta, numa frase
      const volta = fs.at(-1).fim - SOBREPOR;
      let k = i + 1;
      while (k < j && tr.frases[k].inicio < volta) k++;
      i = Math.max(i + 1, k);
    }
    return out;
  };

  // encaixa os tempos nas frases (nunca a meio de uma palavra)
  // (o limite de frase mais próximo se estiver a menos de 3 s; senão a palavra mais próxima, para transcrições sem pontuação)
  const perto = (lista, t) => lista.reduce((m, v) => (Math.abs(v - t) < Math.abs(m - t) ? v : m), lista[0]);
  const encaixar = (tr, c, min, max) => {
    const noLimite = (frases, palavras, t) => { const f = perto(frases, t); return Math.abs(f - t) <= 3 || !palavras.length ? f : perto(palavras, t); };
    const ini = noLimite(tr.frases.map((f) => f.inicio), (tr.palavras ?? []).map((p) => p.s), c.inicio);
    let fim = noLimite(tr.frases.map((f) => f.fim), (tr.palavras ?? []).map((p) => p.e), c.fim);
    if (fim - ini < min) fim = Math.min(tr.duracao, ini + min);
    if (fim - ini > max + 5) fim = ini + max;
    return { inicio: Math.max(0, ini - 0.15), fim: Math.min(tr.duracao, fim + 0.3) };
  };

  async function analisar(t, d) {
    const arquivo = d.arquivo;
    if (!/^uploads\/[\w.-]+$/.test(arquivo ?? "") || !existsSync(join(raiz, "public", arquivo))) throw new Error("Vídeo não encontrado");
    mkdirSync(pasta(arquivo), { recursive: true });
    t.passo = "🎧 Transcrevendo o vídeo (a primeira vez demora)…";
    const tr = await transcrever(t, arquivo);
    if (tr.duracao < 45) throw new Error(`O vídeo tem só ${Math.round(tr.duracao)} s: é curto para cortes (use o modo de clipe normal)`);
    if (tr.palavras.length < 60) throw new Error(`A transcrição só achou ${tr.palavras.length} palavras: o vídeo tem pouca fala para escolher cortes`);
    const min = Math.max(10, Number(d.min) || 20), max = Math.max(min + 5, Number(d.max) || 60);
    const js = janelas(tr);

    // fase 1: pontuar todas as janelas (em lotes, para vídeos muito longos)
    const notas = [];
    for (let k = 0; k < js.length; k += 30) {
      const lote = js.slice(k, k + 30);
      t.passo = `🤖 Pontuando os momentos (${Math.min(k + 30, js.length)}/${js.length})…`;
      const r = await claudeJSON(t, guia, [
        "FASE: pontuar janelas.",
        `IDIOMA: ${tr.idioma}. DURAÇÃO DO VÍDEO: ${Math.round(tr.duracao)} s.`,
        `JANELAS:\n${JSON.stringify(lote.map(({ id, inicio, fim, texto }) => ({ id, inicio: +inicio.toFixed(1), fim: +fim.toFixed(1), texto })))}`,
      ].join("\n\n"));
      notas.push(...(r.janelas ?? []));
    }
    notas.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
    const alvo = Math.min(js.length, Math.max(3, Math.round(tr.duracao / 240) + 3), 15);
    const porId = Object.fromEntries(js.map((j) => [j.id, j]));
    const lista = notas.map((n) => porId[n.id]).filter(Boolean).slice(0, alvo);
    const curta = lista.length ? lista : js.slice(0, alvo);

    // fase 2: detalhar os cortes das melhores janelas
    const quantos = Number(d.quantidade) || 0;
    const minC = quantos || Math.min(3, curta.length * 2), maxC = quantos || Math.min(12, curta.length * 2);
    t.passo = `🤖 Escolhendo os cortes em ${curta.length} momentos…`;
    const r = await claudeJSON(t, guia, [
      "FASE: detalhar os cortes.",
      `IDIOMA: ${tr.idioma}. DURAÇÃO DO VÍDEO: ${Math.round(tr.duracao)} s.`,
      `Cada corte entre min=${min} e max=${max} segundos. Devolve entre min_cortes=${minC} e max_cortes=${maxC} cortes.`,
      d.foco ? `Foco pedido pelo criador: ${d.foco}` : "",
      `JANELAS PRÉ-SELECIONADAS:\n${JSON.stringify(curta.map(({ id, inicio, fim, texto }) => ({ id, inicio: +inicio.toFixed(1), fim: +fim.toFixed(1), texto })))}`,
    ].filter(Boolean).join("\n\n"));
    const cortes = (r.cortes ?? [])
      .filter((c) => Number.isFinite(c.inicio) && Number.isFinite(c.fim) && c.fim > c.inicio)
      .map((c, i) => ({ ...c, ...encaixar(tr, c, min, max), n: i }))
      .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));
    if (!cortes.length) throw new Error("O Claude não encontrou cortes com força neste vídeo");
    const resultado = { arquivo, duracao: tr.duracao, geradoEm: new Date().toISOString(), cortes };
    writeFileSync(join(pasta(arquivo), "cortes.json"), JSON.stringify(resultado, null, 2));
    return resultado;
  }

  // o último resultado guardado deste vídeo (para reabrir o painel sem voltar a analisar)
  const guardado = (arquivo) => {
    const p = join(pasta(arquivo), "cortes.json");
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null;
  };

  return { analisar, guardado };
}
