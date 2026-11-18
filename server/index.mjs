// Painel local: http://localhost:4321
// O roteiro é escrito pelo Claude Code em modo headless (claude -p, usa a skill novo-video);
// a narração e o render correm em scripts/produzir.mjs.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { CLIMAS, POR_ESTILO, POR_FORMATO, escolherMusica, gravarCatalogo, lerCatalogo, listarMusicas } from "../scripts/musica.mjs";
import { createServer } from "node:http";
import { basename, join, resolve } from "node:path";
import { criarYouTube } from "./youtube.mjs";
import { criarInstagram } from "./instagram.mjs";
import { criarCortes } from "./cortes.mjs";
import { esperarExterno, modoIA, pedidosPendentes, tirarJSON as tirarJSONExterno } from "../scripts/ia.mjs";
import { criarAutomatico } from "./automatico.mjs";
import { lerCustos, registarClaude } from "../scripts/custos.mjs";

const RAIZ = resolve(import.meta.dirname, "..");
const PORTA = Number(process.env.PORTA) || 4321;
const ID_VALIDO = /^[a-z0-9-]{1,80}$/;

const VOZES_EDGE = [
  { id: "pt-BR-AntonioNeural", nome: "Antonio (BR, masculina)" },
  { id: "pt-BR-FranciscaNeural", nome: "Francisca (BR, feminina)" },
  { id: "pt-BR-ThalitaMultilingualNeural", nome: "Thalita (BR, feminina)" },
  { id: "pt-PT-DuarteNeural", nome: "Duarte (PT, masculina)" },
  { id: "pt-PT-RaquelNeural", nome: "Raquel (PT, feminina)" },
];

const FORMATOS = {
  livre: "formato livre: não segue nenhum molde. O criador descreve o vídeo que imagina (tema, estrutura, tom, ritmo, tipos de cena) e o roteirista é o realizador: escolhe a estrutura e os tipos de cena que melhor servem a ideia, misturando à vontade (fato, grafico, linha_tempo, comparacao, numero, modelo3d, lowpoly, quiz, manim…), sempre com início, meio e fim e um gancho forte na primeira cena (guia na seção do formato)",
  quiz: "quiz interativo: o espectador tenta acertar {itens} perguntas sobre o tema. Gancho que desafia, depois para cada pergunta uma cena quiz (pergunta, 3 opções, resposta, contagem real de 5 s) seguida da cena que revela e explica a resposta com um dado surpreendente (fato com mídia, numero ou grafico); dificuldade a subir e a última pergunta é a pegadinha; cta para comentar quantas acertou (guia na seção do formato)",
  ranking: "ranking de produtos com recomendação de compra (gancho, produtos, cta; um modelo3d do produto vencedor dá destaque ao #1)",
  longo: "vídeo longo para o YouTube em 16:9 (5 a 10 minutos): documentário curto dividido em 4 a 7 capítulos (cenas capitulo), com mídia em quase todas as cenas e 2 ou 3 cortes para Shorts no campo cortes (estrutura da seção 3.6 do roteirista)",
  animado: "\"E se?\" em animação 3D low poly: a mesma escalada do E se?, mas quase todas as cenas são do tipo lowpoly (personagens 3D em estádio, cidade, quarto, natureza ou planeta, com hora do dia e câmera), sem fotos; 1 cena de conteúdo por frase, cada uma com outro cenário, plano, ação ou hora (estrutura na seção do formato)",
  ese: "viral \"E se?\": uma pergunta hipotética levada às últimas consequências, numa escalada no tempo ou na escala, com base científica e sem vender nada (estrutura da seção E se? da skill; cta para comentar a próxima pergunta ou seguir)",
  storytelling: "storytelling de venda: uma história que cria a necessidade e termina na compra de UM produto (estrutura da seção Storytelling da skill; cta com acao link ou comentar)",
  curiosidades: "curiosidades do mundo gamer (gancho, cenas fato com mídia real, cta)",
  explicativo: "vídeo explicativo estilo Kurzgesagt/Vox (gancho, mistura de fato, grafico, linha_tempo, modelo3d para mostrar hardware por dentro e, se fizer sentido, manim, cta)",
};

// pedido do painel "Animação 3D low poly em vez de fotos" (em qualquer formato; o "animado" já é assim)
const REGRA_LOWPOLY = "Visual em animação 3D low poly (pedido do criador): as cenas de conteúdo são do tipo `lowpoly` em vez de fotos e b-rolls (nada de `fato` com foto). Use personagens, cenários, objetos animados e etiquetas 3D para encenar cada momento; `numero`, `grafico`, `quiz` e `manim` continuam permitidos quando mostram um dado melhor do que uma cena. A primeira cena pode ser uma `lowpoly` com `titulo`. Cada cena muda alguma coisa (cenário, plano, ação, hora ou câmera).";

const estilos = () => JSON.parse(readFileSync(join(RAIZ, "src/estilos.json"), "utf-8"));
const caminhoRoteiro = (id) => join(RAIZ, "roteiros", `${id}.json`);

// ---------- .env (chave ElevenLabs, fica só nesta máquina) ----------
const lerEnv = () => {
  const p = join(RAIZ, ".env");
  if (!existsSync(p)) return {};
  return Object.fromEntries(
    readFileSync(p, "utf-8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
};
// pasta dos temporários (bundles e cópias de vídeo do Remotion, Whisper, ffmpeg): PASTA_TEMP no .env, noutro disco
// se o C: tiver pouco espaço. Vale para o painel e para tudo o que ele lança (herdam TEMP/TMP).
{
  const temp = lerEnv().PASTA_TEMP;
  if (temp) {
    try { mkdirSync(temp, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = temp; }
    catch (e) { console.warn(`PASTA_TEMP inválida (${temp}): ${e.message}`); }
  }
}
const gravarEnv = (vars) =>
  writeFileSync(join(RAIZ, ".env"), Object.entries({ ...lerEnv(), ...vars }).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

// ---------- Claude (roteiros): token de longa duração de `claude setup-token`, se existir ----------
// sem ele o `claude -p` usa o login normal, que expira e parte o modo automático de madrugada
const tokenClaude = () => process.env.CLAUDE_CODE_OAUTH_TOKEN || lerEnv().CLAUDE_CODE_OAUTH_TOKEN;
const LOGIN_EXPIRADO = /authenticat|oauth|login|401|token/i;
const erroClaude = (texto, base) => new Error(LOGIN_EXPIRADO.test(texto ?? "")
  ? "O login do Claude expirou. Num terminal corra \"claude\" e escreva /login, ou cole um token de \"claude setup-token\" em Chaves de API (não expira)."
  : base);
const envClaude = () => (tokenClaude() ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: tokenClaude() } : process.env);

// ---------- Chatterbox: vozes clonadas a partir das amostras em public/vozes ----------
const vozesChatterbox = () => {
  const pasta = join(RAIZ, "public/vozes");
  return existsSync(pasta) ? readdirSync(pasta).filter((f) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f)).map((f) => ({ id: `vozes/${f}`, nome: f.replace(/\.\w+$/, "").replace(/-/g, " ") })) : [];
};

// ---------- ElevenLabs ----------
const chaveEleven = () => process.env.ELEVENLABS_API_KEY || lerEnv().ELEVENLABS_API_KEY;

// O plano grátis não pode usar vozes da biblioteca (nem as "professional" adicionadas) pela API
let planoCache = { chave: null, tier: null, em: 0 };
async function planoEleven(forcar = false) {
  const chave = chaveEleven();
  if (!chave) return null;
  if (!forcar && planoCache.chave === chave && Date.now() - planoCache.em < 10 * 60e3) return planoCache.tier;
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": chave } }).catch(() => null);
  const tier = r?.ok ? (await r.json()).tier : null;
  planoCache = { chave, tier, em: Date.now() };
  return tier;
}
const ehGratis = (tier) => !tier || tier === "free";
const falaPortugues = (v) => v.labels?.language === "pt" || (v.verified_languages ?? []).some((l) => l.language === "pt");

// Vozes da biblioteca partilhada ("dono:voz") têm de ser adicionadas à conta antes de narrar.
// Devolve o voice_id a usar no roteiro.
async function prepararVozEleven(voz) {
  if (!voz?.includes(":")) return voz;
  if (ehGratis(await planoEleven())) throw new Error("No plano grátis da ElevenLabs as vozes da biblioteca não funcionam pela API. Escolha uma voz do grupo \"Falam português\" ou a voz grátis.");
  const [dono, id] = voz.split(":");
  const chave = chaveEleven();
  const conta = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": chave } })).json();
  const ja = conta.voices?.find((v) => v.voice_id === id || v.sharing?.original_voice_id === id);
  if (ja) return ja.voice_id;
  const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${dono}/${id}`, {
    method: "POST", headers: { "xi-api-key": chave, "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: `PT ${id.slice(0, 6)}` }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = JSON.stringify(d.detail ?? d);
    if (/limit|slot/i.test(msg)) throw new Error("A sua conta ElevenLabs não tem espaço para mais vozes (o plano grátis permite 3). Remova uma em elevenlabs.io > My Voices.");
    throw new Error(`A ElevenLabs não deixou adicionar a voz: ${msg.slice(0, 200)}`);
  }
  return d.voice_id ?? id;
}

// ---------- biblioteca de gameplay (metade de baixo do layout rosto + gameplay) ----------
// clipes do próprio criador em public/gameplay (fora do git); a duração fica guardada em .duracoes.json
const PASTA_GAMEPLAY = join(RAIZ, "public/gameplay");
function gameplays() {
  if (!existsSync(PASTA_GAMEPLAY)) return [];
  const cache = join(PASTA_GAMEPLAY, ".duracoes.json");
  const duracoes = existsSync(cache) ? JSON.parse(readFileSync(cache, "utf-8")) : {};
  let mudou = false;
  const lista = readdirSync(PASTA_GAMEPLAY).filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f) && !f.startsWith(".") && !f.includes(".tmp.")).map((f) => {
    if (!duracoes[f]) {
      const r = spawnSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `"${join(PASTA_GAMEPLAY, f)}"`], { shell: true, encoding: "utf-8" });
      duracoes[f] = Number(String(r.stdout).trim()) || 0;
      mudou = true;
    }
    return { arquivo: `gameplay/${f}`, nome: f.replace(/\.\w+$/, "").replace(/-/g, " "), duracaoS: duracoes[f] };
  });
  if (mudou) writeFileSync(cache, JSON.stringify(duracoes));
  return lista.filter((g) => g.duracaoS > 5);
}
// um trecho da biblioteca para um Short: o clipe pedido (ou um ao acaso) e um início ao acaso que caiba
function trechoGameplay(pedido, duracaoS = 60, intercalar = false) {
  const lista = gameplays();
  if (!pedido || pedido === "nenhuma" || !lista.length) return undefined;
  const g = lista.find((x) => x.arquivo === pedido) ?? lista[Math.floor(Math.random() * lista.length)];
  const folga = Math.max(0, g.duracaoS - duracaoS - 1);
  return { arquivo: g.arquivo, duracaoS: g.duracaoS, inicioS: Math.round(Math.random() * folga * 10) / 10, ...(intercalar ? { intercalar: true } : {}) };
}

// ---------- "Aprendo com seu exemplo": um estilo novo a partir de um vídeo de referência ----------
// Do link só se usam as imagens públicas (YouTube: capa e os 3 frames automáticos; Instagram: a capa), sem descarregar
// o vídeo. Com o vídeo enviado, tiram-se 12 frames. O Claude vê as imagens e traduz a direção de arte nas peças do motor.
const PASTA_APRENDIDOS = join(RAIZ, "out/estilos-aprendidos");
const OPCOES_ESTILO = {
  tema: ["grelha", "gradiente", "solido", "papel", "estrelas", "claro", "synthwave", "hud", "cartesiano", "mundo3d", "editorial", "vice"],
  overlay: ["scan", "vhs", "hud", "papel", "grao", null],
  transicao: ["whip", "corte", "suave", "papel", "forma", "vhs", "hud", "voo", "folha"],
  legenda: ["padrao", "hormozi", "papel", "pilula", "elegante", "neon", "hud", "marcador", "aquarela"],
  fonte: ["anton", "archivo", "kalam", "inter", "montserrat", "marker", "poppins", "grotesk", "vt323", "orbitron", "mono", "serif", "stix"],
};
const NAVEGADOR = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" };
async function baixarImagem(url, destino) {
  const r = await fetch(url, { headers: NAVEGADOR });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length < 2000) throw new Error("imagem vazia");
  writeFileSync(destino, b);
  return destino;
}
async function imagensDoLink(link, pasta) {
  const out = [];
  const yt = link.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/);
  if (yt) {
    for (const n of ["maxresdefault", "hqdefault", "hq1", "hq2", "hq3"]) {
      try { out.push(await baixarImagem(`https://i.ytimg.com/vi/${yt[1]}/${n}.jpg`, join(pasta, `youtube-${n}.jpg`))); } catch { /* nem todos existem */ }
    }
  } else if (/instagram\.com\//.test(link)) {
    try {
      const html = await (await fetch(link, { headers: NAVEGADOR })).text();
      const og = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      if (og) out.push(await baixarImagem(og, join(pasta, "instagram-capa.jpg")));
    } catch { /* o Instagram às vezes pede sessão */ }
  }
  return out;
}
// ffmpeg e ffprobe do próprio Remotion, chamados diretamente (sem passar pela shell: "%02d" e vírgulas nos filtros
// partiam-se no cmd do Windows)
const BINARIOS = join(RAIZ, "node_modules/@remotion/compositor-win32-x64-msvc");
const ffmpegDireto = (args) => (existsSync(join(BINARIOS, "ffmpeg.exe"))
  ? spawnSync(join(BINARIOS, "ffmpeg.exe"), args, { encoding: "utf-8" })
  : spawnSync("npx", ["remotion", "ffmpeg", ...args.map((a) => `"${a}"`)], { shell: true, encoding: "utf-8" }));
const ffprobeDuracao = (video) => {
  const r = existsSync(join(BINARIOS, "ffprobe.exe"))
    ? spawnSync(join(BINARIOS, "ffprobe.exe"), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration:format=duration", "-of", "json", video], { encoding: "utf-8" })
    : spawnSync("npx", ["remotion", "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration:format=duration", "-of", "json", `"${video}"`], { shell: true, encoding: "utf-8" });
  // a duração da imagem (há gravações em que o áudio continua depois de a imagem acabar)
  try { const j = JSON.parse(r.stdout); return Number(j.streams?.[0]?.duration) || Number(j.format?.duration) || 60; } catch { return 60; }
};
// 12 frames espalhados (direção de arte) + 4 rajadas de 6 frames seguidos a 0,1 s (movimento: transições, câmara,
// motion blur, entrada das letras), cada rajada numa tira só para o Claude comparar os frames lado a lado.
// O ffmpeg do Remotion não tem os filtros fps/tile: um salto por frame, -r 10 nas rajadas e a tira feita com o Pillow.
function framesDoVideo(arquivo, pasta) {
  const video = join(RAIZ, "public", arquivo);
  const dur = ffprobeDuracao(video);
  for (let k = 0; k < 12; k++) {
    const t = (dur * (k + 0.5)) / 12;
    ffmpegDireto(["-y", "-loglevel", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=-2:540", join(pasta, `frame-${String(k + 1).padStart(2, "0")}.jpg`)]);
  }
  [0.15, 0.38, 0.62, 0.85].forEach((q, k) => {
    const partes = join(pasta, `parte-${k + 1}-%d.jpg`);
    ffmpegDireto(["-y", "-loglevel", "error", "-ss", (dur * q).toFixed(2), "-i", video, "-r", "10", "-frames:v", "6", "-vf", "scale=-2:360", partes]);
    spawnSync("python", ["-c", [
      "import sys, glob; from PIL import Image",
      "fs = sorted(glob.glob(sys.argv[1]), key=lambda f: int(f.rsplit('-', 1)[1].split('.')[0]))",
      "ims = [Image.open(f) for f in fs]",
      "w = sum(i.width for i in ims); h = max(i.height for i in ims); t = Image.new('RGB', (w, h)); x = 0",
      "for i in ims: t.paste(i, (x, 0)); x += i.width",
      "t.save(sys.argv[2], quality=85) if ims else None",
    ].join("\n"), join(pasta, `parte-${k + 1}-*.jpg`), join(pasta, `rajada-${k + 1}.jpg`)], { encoding: "utf-8" });
  });
  for (const f of readdirSync(pasta)) if (f.startsWith("parte-")) rmSync(join(pasta, f), { force: true });
  return readdirSync(pasta).filter((f) => /^(frame|rajada)-/.test(f)).sort().map((f) => join(pasta, f));
}
const hex = (v, padrao) => (typeof v === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v.trim()) ? v.trim() : padrao);
const entre = (v, a, b, padrao) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : padrao);
const de = (lista, v, padrao) => (lista.includes(v) ? v : padrao);
// ---------- nível 2: o módulo de efeitos do estilo (o Claude escreve src/aprendidos/<id>.tsx) ----------
const PASTA_MODULOS = join(RAIZ, "src/aprendidos");
// registo dos módulos: um import por ficheiro <id>.tsx (os que começam por "_" são o kit e o exemplo)
function regenerarRegistoEfeitos() {
  const ids = readdirSync(PASTA_MODULOS).filter((f) => /^[a-z0-9-]+\.tsx$/.test(f)).map((f) => f.replace(/\.tsx$/, ""));
  const nome = (id) => `m_${id.replace(/-/g, "_")}`;
  writeFileSync(join(PASTA_MODULOS, "index.ts"), [
    "// Registo dos módulos de efeitos dos estilos aprendidos. Gerado pelo servidor (\"Aprendo com seu exemplo\"):",
    "// não editar à mão. Cada entrada liga o id do estilo (src/estilos.json) ao seu módulo src/aprendidos/<id>.tsx.",
    'import type { EfeitosEstilo } from "./_kit";',
    ...ids.map((id) => `import { efeitos as ${nome(id)} } from "./${id}";`),
    "",
    `export const EFEITOS: Record<string, EfeitosEstilo> = {${ids.map((id) => ` "${id}": ${nome(id)}`).join(",")}${ids.length ? " " : ""}};`,
    "",
  ].join("\n"));
}
// o Claude como agente: lê as imagens, o kit e o exemplo, e escreve o módulo
const rodarAgente = (t, sistema, prompt) => new Promise((ok, falha) => {
  const p = guardarProcesso(t, spawn("claude", ["-p", prompt, "--append-system-prompt", sistema, "--output-format", "json", "--permission-mode", "acceptEdits",
    "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep"], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: envClaude() }));
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.on("error", (e) => falha(new Error(`Não consegui iniciar o Claude Code: ${e.message}`)));
  p.on("close", (code) => {
    let r = "";
    try { const ev = JSON.parse(out); r = String(ev.result ?? ""); registarClaude(RAIZ, ev, { etapa: "Aprender estilo" }); } catch { /* sem resumo */ }
    return code === 0 ? ok(r) : falha(erroClaude(r, "O Claude terminou com erro"));
  });
});
// erros de tipos só deste módulo (o resto do projeto já compila)
const errosDoModulo = (id) => {
  const r = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: RAIZ, shell: true, encoding: "utf-8" });
  return String(r.stdout || "").split(/\r?\n/).filter((l) => l.includes(`aprendidos/${id}.tsx`) || l.includes("aprendidos/index.ts")).join("\n");
};
const renderOk = (id) => new Promise((ok) => {
  const m = spawn(process.execPath, ["scripts/miniaturas.mjs", id], { cwd: RAIZ, stdio: "ignore" });
  m.on("close", (code) => ok(code === 0));
  m.on("error", () => ok(false));
});
async function aprenderEfeitos(t, id, novo, guia, imagens, analise) {
  const arquivo = join(PASTA_MODULOS, `${id}.tsx`);
  const sistema = readFileSync(join(RAIZ, ".claude/skills/novo-video/aprender-efeitos.md"), "utf-8");
  const prompt = [
    `O id do estilo é "${id}": escreve src/aprendidos/${id}.tsx.`,
    "Imagens do vídeo de referência (frames e rajadas de 6 frames seguidos; lê cada uma com Read):",
    ...imagens.map((f) => `- ${f}`),
    `Direção de arte já escolhida: ${JSON.stringify(novo)}`,
    guia ? `Guia do roteirista para este estilo: ${guia}` : "",
    analise ? `Análise medida do vídeo (lê com Read): ${analise}. Usa-a para acertar o ritmo dos cortes (duração dos planos), a entrada e saída das letras, as cores e o contorno do texto e a posição das legendas.` : "",
    "Lê primeiro src/aprendidos/_kit.tsx e src/aprendidos/_exemplo.tsx.",
  ].filter(Boolean).join("\n");
  t.passo = "O Claude está recriando os efeitos (câmara, transições, motion blur, legendas)…";
  let resumo = await rodarAgente(t, sistema, prompt);
  if (!existsSync(arquivo)) return { efeitos: false, motivo: "o Claude não escreveu o módulo de efeitos" };
  regenerarRegistoEfeitos();
  t.passo = "Verificando o código dos efeitos…";
  let erros = errosDoModulo(id);
  if (erros) {
    t.passo = "Corrigindo o código dos efeitos…";
    resumo = await rodarAgente(t, sistema, `Corrige src/aprendidos/${id}.tsx: o TypeScript deu estes erros (mantém os efeitos):\n${erros.slice(0, 3000)}`);
    erros = errosDoModulo(id);
  }
  t.passo = "Testando os efeitos em um render…";
  if (!erros && await renderOk(id)) return { efeitos: true, resumo };
  // não ficou válido: o estilo fica só com a direção de arte (o ficheiro sai do registo)
  rmSync(arquivo, { force: true });
  regenerarRegistoEfeitos();
  await renderOk(id);
  return { efeitos: false, motivo: erros ? "o código dos efeitos não compilou" : "o render de teste falhou" };
}


// ---------- gerir os estilos aprendidos (menu Estilos) ----------
// Os de fábrica só se leem; os aprendidos editam-se à mão, refinam-se com o Claude ou vão para a lixeira.
// os campos de um estilo, validados contra as listas do motor; o que faltar fica como estava (base)
function camposEstilo(e, base) {
  return {
    cor: hex(e.cor, base.cor), cor2: hex(e.cor2, base.cor2), fundo: hex(e.fundo, base.fundo), corTexto: hex(e.corTexto, base.corTexto),
    sombra: typeof e.sombra === "string" ? e.sombra.slice(0, 60) : base.sombra, superficie: hex(e.superficie, base.superficie),
    tema: de(OPCOES_ESTILO.tema, e.tema, base.tema ?? "solido"), overlay: de(OPCOES_ESTILO.overlay, e.overlay === undefined ? base.overlay ?? null : e.overlay, null),
    transicao: de(OPCOES_ESTILO.transicao, e.transicao, base.transicao ?? "corte"), legenda: de(OPCOES_ESTILO.legenda, e.legenda, base.legenda ?? "padrao"),
    titulo: de(OPCOES_ESTILO.fonte, e.titulo, base.titulo ?? "anton"), corpo: de(OPCOES_ESTILO.fonte, e.corpo, base.corpo ?? "inter"),
    glitch: typeof e.glitch === "boolean" ? e.glitch : base.glitch === true, shake: entre(e.shake, 0, 1.5, base.shake ?? 0.4), flash: entre(e.flash, 0, 0.5, base.flash ?? 0),
    passo: entre(e.passo, 1, 3, base.passo ?? 1), raio: entre(e.raio, 0, 30, base.raio ?? 10), brilho: typeof e.brilho === "boolean" ? e.brilho : base.brilho === true,
    ...(typeof e.tracking === "string" ? { tracking: e.tracking.slice(0, 12) } : base.tracking ? { tracking: base.tracking } : {}),
    ...(e.pixel && typeof e.pixel === "object" ? { pixel: { tamanho: entre(e.pixel.tamanho, 4, 16, 10), niveis: entre(e.pixel.niveis, 4, 12, 8) } } : base.pixel ? { pixel: base.pixel } : {}),
  };
}
const gravarEstilos = (todos) => writeFileSync(join(RAIZ, "src/estilos.json"), JSON.stringify(todos, null, 2) + "\n");
const GUIA_EXTERNO = join(RAIZ, ".claude/skills/novo-video/formatos-externo.md");
// a secção "## estilo: <id>" do guia do roteirista (até à secção seguinte)
const secaoGuia = (txt, id) => txt.match(new RegExp(`## estilo: ${id}\\r?\\n[\\s\\S]*?(?=\\r?\\n## |$)`))?.[0] ?? null;
function trocarGuia(id, guia) {
  const txt = readFileSync(GUIA_EXTERNO, "utf-8"), atual = secaoGuia(txt, id);
  const nova = guia ? `## estilo: ${id}\n${String(guia).trim()}\n` : "";
  if (atual) writeFileSync(GUIA_EXTERNO, txt.replace(atual + (guia ? "" : "\n"), nova));
  else if (guia) writeFileSync(GUIA_EXTERNO, txt.replace("## estilo: editorial", `${nova}\n## estilo: editorial`));
}
function estiloAprendido(id) {
  const e = estilos()[id];
  if (!e) throw new Error("Este estilo não existe");
  if (!e.aprendido) throw new Error("Os estilos de fábrica não se alteram aqui: crie um a partir de um exemplo e refine-o");
  return e;
}
// edição à mão: grava e refaz a miniatura (que é também o teste de que o estilo renderiza)
async function editarEstilo(t, id, d) {
  const atual = estiloAprendido(id), todos = estilos();
  todos[id] = {
    ...atual, ...camposEstilo(d.estilo ?? {}, atual),
    nome: String(d.nome ?? atual.nome).trim().slice(0, 32) || atual.nome, descricao: String(d.descricao ?? atual.descricao).slice(0, 160),
    aprendido: { ...atual.aprendido, editado: new Date().toISOString() },
  };
  gravarEstilos(todos);
  t.passo = "Gerando a miniatura do estilo…";
  await renderOk(id);
  return { id, nome: todos[id].nome };
}
// refinar com o Claude: muda o que o criador pedir (direção de arte e, se houver, o módulo de efeitos)
async function refinarEstilo(t, id, d) {
  const atual = estiloAprendido(id), pedidoCriador = String(d.pedido ?? "").trim().slice(0, 800);
  if (!pedidoCriador) throw new Error("Diga o que quer mudar no estilo");
  const ref = join(RAIZ, "out/estilos-ref", id), analise = join(ref, "analise.json"), storyboard = join(ref, "storyboard.jpg");
  const miniatura = join(RAIZ, "server/miniaturas", `${id}.jpg`);
  const { aprendido, nome, descricao, ...campos } = atual;
  const pedido = [
    "Estás a REFINAR um estilo que já existe, não a criar outro: muda só o que o criador pede e mantém o resto igual.",
    "Responde no mesmo formato JSON de sempre, com o estilo completo (todos os campos, os mudados e os que ficam).",
    `Estilo atual: ${JSON.stringify({ nome, descricao, estilo: campos })}`,
    `O que o criador quer mudar: ${pedidoCriador}`,
    existsSync(miniatura) ? `Como o estilo está agora (frame de exemplo): ${miniatura}` : "",
    existsSync(analise) ? `Análise medida do vídeo de referência (lê com Read): ${analise}` : "",
    existsSync(storyboard) ? `Storyboard do vídeo de referência: ${storyboard}` : "",
    aprendido.link ? `Link do exemplo original: ${aprendido.link}` : "",
  ].filter(Boolean).join("\n");
  t.passo = "O Claude está refinando o estilo…";
  const r = await claudeJSONPeloClaude(t, join(RAIZ, ".claude/skills/novo-video/aprender-estilo.md"), pedido, ["Read"]);
  if (t.cancelado) throw new Error("Parado");
  const todos = estilos();
  const novo = {
    ...atual, ...camposEstilo(r.estilo ?? {}, atual),
    nome: String(r.nome ?? nome).slice(0, 32) || nome, descricao: String(r.descricao ?? descricao).slice(0, 160),
    aprendido: { ...aprendido, refinado: new Date().toISOString(), ...(r.observado ? { observado: String(r.observado).slice(0, 300) } : {}) },
  };
  gravarEstilos({ ...todos, [id]: novo });
  if (r.guia) trocarGuia(id, r.guia);
  // os efeitos em código: o Claude ajusta o módulo; se deixar de compilar ou de renderizar, volta o anterior
  const modulo = join(PASTA_MODULOS, `${id}.tsx`);
  let efeitos = existsSync(modulo) ? "mantidos" : "sem";
  const antes = existsSync(modulo) ? readFileSync(modulo, "utf-8") : null;
  if (antes !== null && d.efeitos !== false) {
    const sistema = readFileSync(join(RAIZ, ".claude/skills/novo-video/aprender-efeitos.md"), "utf-8");
    t.passo = "O Claude está ajustando os efeitos…";
    await rodarAgente(t, sistema, [
      `Refina src/aprendidos/${id}.tsx (os efeitos do estilo "${id}"), sem o reescrever do zero: muda só o que o criador pede e mantém o resto.`,
      `O que o criador quer mudar: ${pedidoCriador}`,
      `Direção de arte do estilo: ${JSON.stringify(novo)}`,
      existsSync(analise) ? `Análise medida do vídeo de referência (lê com Read): ${analise}` : "",
      "Lê primeiro src/aprendidos/_kit.tsx.",
    ].filter(Boolean).join("\n"));
    t.passo = "Verificando o código dos efeitos…";
    let erros = errosDoModulo(id);
    if (erros) {
      t.passo = "Corrigindo o código dos efeitos…";
      await rodarAgente(t, sistema, `Corrige src/aprendidos/${id}.tsx: o TypeScript deu estes erros (mantém os efeitos):\n${erros.slice(0, 3000)}`);
      erros = errosDoModulo(id);
    }
    efeitos = "ajustados";
    if (erros) { writeFileSync(modulo, antes); efeitos = "mantidos (o ajuste não compilou)"; }
  }
  t.passo = "Gerando a miniatura do estilo…";
  if (!(await renderOk(id)) && efeitos === "ajustados") {
    // o ajuste compilou mas não renderiza: volta o módulo anterior
    writeFileSync(modulo, antes);
    efeitos = "mantidos (o ajuste falhou no render)";
    await renderOk(id);
  }
  return { id, nome: novo.nome, descricao: novo.descricao, observado: novo.aprendido.observado, efeitos };
}
// apagar: tudo o que é do estilo vai para lixeira/estilos/<id>-<data>/ (dá para o repor à mão)
function apagarEstilo(id) {
  const atual = estiloAprendido(id), todos = estilos();
  const destino = join(LIXEIRA, "estilos", `${id}-${Date.now().toString(36)}`);
  mkdirSync(destino, { recursive: true });
  const txt = readFileSync(GUIA_EXTERNO, "utf-8"), guia = secaoGuia(txt, id);
  writeFileSync(join(destino, "estilo.json"), JSON.stringify({ [id]: atual, guia }, null, 2));
  const mover = (de, para) => { if (existsSync(de)) { cpSync(de, join(destino, para), { recursive: true }); rmSync(de, { recursive: true, force: true }); } };
  mover(join(PASTA_MODULOS, `${id}.tsx`), `${id}.tsx`);
  mover(join(RAIZ, "server/miniaturas", `${id}.jpg`), "miniatura.jpg");
  mover(join(RAIZ, "out/estilos-ref", id), "analise");
  delete todos[id];
  gravarEstilos(todos);
  if (guia) trocarGuia(id, null);
  regenerarRegistoEfeitos();
  return { ok: true, lixeira: destino };
}

// ---------- análise da referência com o rea-video (github.com/JuneYaooo/rea-video, Apache-2.0) ----------
// Corre neste computador, sem API: corta o vídeo em planos, mede o texto na tela (cor, contorno, tamanho, posição,
// entrada e saída), os efeitos sonoros (e a que momento visual estão presos), a música (BPM), a câmara e a luz.
// Vive num Python à parte (.venv-rea) e precisa de um ffmpeg completo (o do Remotion não tem os filtros fps/tile/ass).
const REA_EXE = join(RAIZ, ".venv-rea/Scripts/rea-video.exe");
let ffmpegCompleto;
function pastaFfmpegCompleto() {
  if (ffmpegCompleto !== undefined) return ffmpegCompleto;
  const env = process.env.FFMPEG_DIR || lerEnv().FFMPEG_DIR;
  if (env && existsSync(join(env, "ffmpeg.exe"))) return (ffmpegCompleto = env);
  // o winget instala em %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_…\ffmpeg-<versão>-full_build\bin
  const pacotes = join(process.env.LOCALAPPDATA ?? "", "Microsoft/WinGet/Packages");
  try {
    for (const p of readdirSync(pacotes).filter((x) => /^Gyan\.FFmpeg/i.test(x)))
      for (const v of readdirSync(join(pacotes, p)))
        if (existsSync(join(pacotes, p, v, "bin/ffmpeg.exe"))) return (ffmpegCompleto = join(pacotes, p, v, "bin"));
  } catch { /* sem winget */ }
  const r = spawnSync("where", ["ffmpeg"], { encoding: "utf-8" });
  const achado = (r.stdout ?? "").split(/\r?\n/).find((l) => l.trim() && !l.includes("compositor-win32"));
  return (ffmpegCompleto = achado ? achado.trim().replace(/[\\/]ffmpeg\.exe$/i, "") : null);
}
const reaDisponivel = () => existsSync(REA_EXE) && Boolean(pastaFfmpegCompleto());

// analisa até 60 s do vídeo (public/<arquivo>) e devolve { resumo, storyboard, relatorio } ou null se não der
function analisarReferencia(t, arquivo, pasta) {
  if (!reaDisponivel()) return Promise.resolve(null);
  const ff = pastaFfmpegCompleto(), ref = join(pasta, "referencia.mp4"), saida = join(pasta, "analise");
  spawnSync(join(ff, "ffmpeg.exe"), ["-y", "-loglevel", "error", "-i", join(RAIZ, "public", arquivo), "-t", "60", "-c", "copy", ref]);
  if (!existsSync(ref)) return Promise.resolve(null);
  return new Promise((ok) => {
    t.passo = "Analisando o vídeo plano a plano (rea-video)…";
    const p = guardarProcesso(t, spawn(REA_EXE, ["decompose", ref, "-o", saida], {
      cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${ff};${process.env.PATH}`, PYTHONIOENCODING: "utf-8", REA_VIDEO_HOME: join(RAIZ, "out/rea-video"), REA_VIDEO_MODELS: join(RAIZ, "out/rea-video/modelos") },
    }));
    let planos = 0;
    const ler = (d) => {
      for (const l of String(d).split(/\r?\n/)) {
        if (/downloading/i.test(l)) t.passo = "Baixando os modelos de análise (só na primeira vez)…";
        else if (/shot_\d+ /.test(l)) t.passo = `Analisando o plano ${++planos}…`;
        else if (/packaging layer/i.test(l)) t.passo = "Lendo os textos, as legendas e os stickers…";
        else if (/stems|separat/i.test(l)) t.passo = "Separando a voz, a música e os efeitos…";
      }
    };
    p.stdout.on("data", ler); p.stderr.on("data", ler);
    p.on("error", () => ok(null));
    p.on("close", (code) => {
      const bd = join(saida, "breakdown.json");
      if (code !== 0 || !existsSync(bd)) return ok(null);
      try {
        const resumo = resumirAnalise(JSON.parse(readFileSync(bd, "utf-8")));
        writeFileSync(join(pasta, "analise.json"), JSON.stringify(resumo, null, 1));
        ok({ resumo, arquivoResumo: join(pasta, "analise.json"), storyboard: existsSync(join(saida, "storyboard.jpg")) ? join(saida, "storyboard.jpg") : null, relatorio: join(saida, "report.html") });
      } catch { ok(null); }
    });
  });
}
// o que importa para recriar o estilo, num JSON pequeno para o Claude (o breakdown inteiro tem centenas de KB)
function resumirAnalise(b) {
  const n = (v, c = 2) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10 ** c) / 10 ** c : undefined);
  const planos = (b.shots ?? []).map((s) => ({
    de: n(s.start), ate: n(s.end), duracao: n(s.duration), entrada: typeof s.transition_in === "string" ? s.transition_in : s.transition_in?.kind,
    camara: s.aspects?.camera?.result?.support_zh ?? s.aspects?.camera?.measured?.motion, enquadramento: s.aspects?.framing?.result?.shot_size,
    luz: s.aspects?.lighting?.result?.quality, cor: { saturacao: n(s.features?.saturation), luma: n(s.features?.luma), contraste: n(s.features?.contrast) },
    movimentos: (s.motion?.events ?? []).slice(0, 5).map((e) => ({ tipo: e.kind, suavizacao: e.easing, desliza: e.slide, escala: e.scale, cor: e.colour, texto: (e.text ?? []).join(" ") || undefined })),
  }));
  const durs = planos.map((p) => p.duracao).filter(Boolean).sort((a, c) => a - c);
  const pk = b.packaging ?? {};
  const textos = (pk.text_cues ?? []).filter((c) => (c.conf ?? 1) > 0.8).map((c) => ({
    de: n(c.t0), ate: n(c.t1), texto: c.text, tipo: c.kind, faixa: c.band, caixa: (c.bbox_median ?? c.bbox)?.map((v) => n(v, 3)), alturaLinha: n(c.line_h, 3),
    angulo: c.angle, entrada: c.anim_in?.kind, saida: c.anim_out?.kind, estilo: c.style, descricao: c.style_zh, decor: c.decor,
  }));
  const musica = b.audio?.music ?? {}, voz = b.audio?.voice ?? {};
  return {
    nota: "Medido pelo rea-video nos primeiros 60 s (sem modelo de visão: ignore se diz que a imagem é 'IA'; importa o ritmo, o texto, a cor e o som).",
    duracao: n(b.source?.duration ?? b.audio?.duration),
    ritmo: { planos: planos.length, duracaoMedia: n(durs.reduce((t, d) => t + d, 0) / Math.max(1, durs.length)), duracaoMediana: durs[Math.floor(durs.length / 2)] },
    planos,
    textos: textos.slice(0, 60),
    contagemTextos: pk.counts,
    efeitosSonoros: (pk.sfx_anchored ?? []).map((s) => ({ t: n(s.t), tipo: s.type, preso_a: s.anchor })),
    musica: { presente: musica.present, bpm: musica.tempo_bpm, partilha: n(musica.ratio) },
    voz: { presente: voz.present, partilha: n(voz.ratio), estilo: voz.style, genero: voz.gender_hint },
    resumo: b.summary?.verdict ?? b.summary,
  };
}

async function aprenderEstilo(t, d) {
  const pasta = join(PASTA_APRENDIDOS, Date.now().toString(36));
  mkdirSync(pasta, { recursive: true });
  t.passo = "Coletando imagens do exemplo…";
  let arquivo = typeof d.arquivo === "string" && /^uploads\/[\w.-]+$/.test(d.arquivo) ? d.arquivo : null;
  // só o link: baixa o vídeo (YouTube ou Instagram) para o analisar a sério; se não der, ficam as imagens públicas
  if (!arquivo && d.link && lerLink(d.link)) {
    try { arquivo = (await baixarLink(t, String(d.link).trim())).arquivo; } catch { /* segue com as imagens do link */ }
  }
  const imagens = [
    ...(d.link && !arquivo ? await imagensDoLink(String(d.link).trim(), pasta) : []),
    ...(arquivo ? framesDoVideo(arquivo, pasta) : []),
  ];
  // a análise medida (cortes, texto, cor, som); sem rea-video instalado, o Claude estuda só as imagens
  const analise = arquivo ? await analisarReferencia(t, arquivo, pasta) : null;
  if (t.cancelado) throw new Error("Parado");
  if (analise?.storyboard) imagens.unshift(analise.storyboard);
  t.analise = analise;
  if (!imagens.length) throw new Error("Não consegui imagens deste exemplo. O Instagram às vezes pede sessão: envie também o vídeo (o estilo sai mais fiel).");
  t.passo = `O Claude está estudando o estilo (${imagens.length} imagens)…`;
  const todos = estilos();
  const pedido = [
    "Imagens do vídeo de referência (lê cada uma com Read):",
    ...imagens.map((f) => `- ${f}`),
    d.link ? `Link do exemplo: ${d.link}` : "",
    analise ? `Análise medida do vídeo (planos, texto na tela com cores e animações, efeitos sonoros, música): ${analise.arquivoResumo} (lê com Read; o storyboard é a primeira imagem)` : "",
    d.notas ? `O que o criador quer deste estilo: ${String(d.notas).slice(0, 400)}` : "",
    `Estilos que já existem (o novo tem de ser diferente): ${Object.values(todos).map((e) => e.nome).join(", ")}`,
  ].filter(Boolean).join("\n");
  // precisa de ver as imagens: corre sempre com o Claude, mesmo no modo IA externa
  const r = await claudeJSONPeloClaude(t, join(RAIZ, ".claude/skills/novo-video/aprender-estilo.md"), pedido, ["Read"]);
  const e = r.estilo ?? {}, base = todos.neon;
  const novo = {
    nome: String(r.nome ?? "Meu estilo").slice(0, 32), descricao: String(r.descricao ?? "").slice(0, 160),
    cor: hex(e.cor, base.cor), cor2: hex(e.cor2, base.cor2), fundo: hex(e.fundo, base.fundo), corTexto: hex(e.corTexto, base.corTexto),
    sombra: typeof e.sombra === "string" ? e.sombra.slice(0, 60) : base.sombra, superficie: hex(e.superficie, base.superficie),
    tema: de(OPCOES_ESTILO.tema, e.tema, "solido"), overlay: de(OPCOES_ESTILO.overlay, e.overlay ?? null, null),
    transicao: de(OPCOES_ESTILO.transicao, e.transicao, "corte"), legenda: de(OPCOES_ESTILO.legenda, e.legenda, "padrao"),
    titulo: de(OPCOES_ESTILO.fonte, e.titulo, "anton"), corpo: de(OPCOES_ESTILO.fonte, e.corpo, "inter"),
    glitch: e.glitch === true, shake: entre(e.shake, 0, 1.5, 0.4), flash: entre(e.flash, 0, 0.5, 0), passo: entre(e.passo, 1, 3, 1),
    raio: entre(e.raio, 0, 30, 10), brilho: e.brilho === true, ...(typeof e.tracking === "string" ? { tracking: e.tracking.slice(0, 12) } : {}),
    ...(e.pixel && typeof e.pixel === "object" ? { pixel: { tamanho: entre(e.pixel.tamanho, 4, 16, 10), niveis: entre(e.pixel.niveis, 4, 12, 8) } } : {}),
    aprendido: {
      link: d.link || null, em: new Date().toISOString(), observado: String(r.observado ?? "").slice(0, 300),
      ...(analise ? { analise: { planos: analise.resumo.ritmo.planos, duracaoMediaPlano: analise.resumo.ritmo.duracaoMedia, bpm: analise.resumo.musica.bpm, textos: analise.resumo.textos.length, efeitosSonoros: analise.resumo.efeitosSonoros.length } } : {}),
    },
  };
  let id = `meu-${slug(novo.nome) || "estilo"}`.slice(0, 32);
  for (let k = 2; todos[id]; k++) id = `${id.replace(/-\d+$/, "")}-${k}`;
  writeFileSync(join(RAIZ, "src/estilos.json"), JSON.stringify({ ...todos, [id]: novo }, null, 2) + "\n");
  // o guia do roteirista para este estilo (lido pelo "Roteiro de outra IA" e pelo roteirista)
  if (r.guia) {
    const fx = join(RAIZ, ".claude/skills/novo-video/formatos-externo.md");
    const txt = readFileSync(fx, "utf-8");
    writeFileSync(fx, txt.replace("## estilo: editorial", `## estilo: ${id}\n${String(r.guia).trim()}\n\n## estilo: editorial`));
  }
  // nível 2 (opcional): os efeitos em código; sem ele (ou se falhar) fica só a direção de arte
  let efeitos = { efeitos: false };
  if (d.efeitos !== false) {
    try { efeitos = await aprenderEfeitos(t, id, novo, r.guia, imagens, analise?.arquivoResumo); }
    catch (e) { if (t.cancelado) throw e; efeitos = { efeitos: false, motivo: e.message }; }
  }
  if (!efeitos.efeitos) {
    t.passo = "Gerando a miniatura do estilo…";
    await renderOk(id);
  }
  // o relatório da análise fica com o estilo (o painel mostra o storyboard e abre o relatório completo)
  if (analise) {
    const destino = join(RAIZ, "out/estilos-ref", id);
    mkdirSync(destino, { recursive: true });
    if (analise.storyboard) copyFileSync(analise.storyboard, join(destino, "storyboard.jpg"));
    if (existsSync(analise.relatorio)) copyFileSync(analise.relatorio, join(destino, "relatorio.html"));
    copyFileSync(analise.arquivoResumo, join(destino, "analise.json"));
  }
  return { id, nome: novo.nome, descricao: novo.descricao, observado: novo.aprendido.observado, analise: analise ? { ...novo.aprendido.analise, storyboard: analise.storyboard ? `/out/estilos-ref/${id}/storyboard.jpg` : null, relatorio: `/out/estilos-ref/${id}/relatorio.html` } : null, ...efeitos };
}

// ---------- parar operações ----------
// o processo em curso fica guardado fora do JSON (não enumerável) para o botão Parar o poder matar
const guardarProcesso = (alvo, p) => {
  Object.defineProperty(alvo, "processo", { value: p, writable: true, enumerable: false, configurable: true });
  p.on("close", () => { if (alvo.processo === p) alvo.processo = null; });
  if (alvo.cancelado) matarArvore(p);
  return p;
};
// mata o processo e os filhos (Chrome do render, ffmpeg, Whisper…); no Windows o kill normal deixa-os vivos
const matarArvore = (p) => {
  if (!p?.pid) return;
  if (process.platform === "win32") spawn("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(-p.pid, "SIGKILL"); } catch { p.kill("SIGKILL"); }
};
class Parado extends Error { constructor() { super("Parado por si"); } }



// vídeos em public/uploads: os enviados pelo painel e os baixados do YouTube (yt-<id>.mp4, com o título num .json ao lado).
// "Em uso" = um Short da biblioteca ainda não recortou o seu trecho dele (depois de transcrito, o Short usa o próprio
// trecho em public/videos/<id>/ e o vídeo original já não faz falta).
function listarUploads() {
  const pasta = join(RAIZ, "public/uploads");
  if (!existsSync(pasta)) return [];
  const precisam = new Set();
  if (existsSync(join(RAIZ, "roteiros"))) for (const f of readdirSync(join(RAIZ, "roteiros")).filter((x) => x.endsWith(".json"))) {
    try { for (const c of JSON.parse(readFileSync(join(RAIZ, "roteiros", f), "utf-8")).cenas ?? []) if (c.bruto && !c.palavras?.length) precisam.add(c.bruto); } catch { /* roteiro ilegível */ }
  }
  return readdirSync(pasta).filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f)).map((f) => {
    const st = statSync(join(pasta, f));
    const arquivo = `uploads/${f}`;
    let info = {};
    try { info = JSON.parse(readFileSync(join(pasta, f.replace(/\.\w+$/, ".json")), "utf-8")); } catch { /* sem título guardado */ }
    const yt = f.match(/^yt-([\w-]+)\./)?.[1], ig = f.match(/^ig-([\w-]+)\./)?.[1];
    return {
      arquivo, nome: info.titulo || f.replace(/-[a-z0-9]{8}\.\w+$/, "").replace(/\.\w+$/, "").replace(/-/g, " "),
      origem: yt ? "YouTube" : ig ? "Instagram" : "Enviado",
      link: info.link || (yt ? `https://www.youtube.com/watch?v=${yt}` : ig ? `https://www.instagram.com/reel/${ig}/` : undefined),
      tamanhoMB: Math.round(st.size / 2 ** 20), criado: st.mtimeMs, emUso: precisam.has(arquivo),
    };
  }).sort((a, b) => b.criado - a.criado);
}

// ---------- vídeo do YouTube por link (para os cortes) ----------
// O yt-dlp corre neste computador (sem API paga nem site de terceiros): descarrega o vídeo até 1080p para
// public/uploads/yt-<id>.mp4, juntando imagem e som com o ffmpeg do Remotion. Se já foi descarregado, reaproveita.
const LINK_YOUTUBE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{6,20})/;
// Instagram: reels, posts com vídeo e IGTV públicos (os privados ou com restrição de idade pedem sessão iniciada)
const LINK_INSTAGRAM = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]{5,40})/;
// de um link colado: o site, o id e o endereço limpo (sem parâmetros de partilha)
function lerLink(link) {
  const yt = String(link).match(LINK_YOUTUBE)?.[1];
  if (yt) return { site: "YouTube", prefixo: "yt", id: yt, url: `https://www.youtube.com/watch?v=${yt}` };
  const ig = String(link).match(LINK_INSTAGRAM)?.[1];
  if (ig) return { site: "Instagram", prefixo: "ig", id: ig, url: `https://www.instagram.com/reel/${ig}/` };
  return null;
}
function baixarLink(t, link) {
  const alvo = lerLink(link);
  if (!alvo) return Promise.reject(new Error("Cole um link de vídeo do YouTube (youtube.com/watch, youtu.be, shorts) ou do Instagram (reel ou post)"));
  const id = alvo.id;
  const pasta = join(RAIZ, "public/uploads");
  mkdirSync(pasta, { recursive: true });
  const arquivo = `uploads/${alvo.prefixo}-${id}.mp4`;
  return new Promise((ok, falha) => {
    t.passo = "Lendo o link…";
    let titulo = "", erro = "";
    const p = guardarProcesso(t, spawn("python", ["-m", "yt_dlp", alvo.url,
      "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b",
      "--merge-output-format", "mp4", "--no-playlist", "--no-overwrites", "--newline", "--progress",
      // o YouTube exige resolver um desafio em JavaScript para dar todas as qualidades: usa o próprio Node do painel
      "--js-runtimes", `node:${process.execPath}`,
      ...(existsSync(join(BINARIOS, "ffmpeg.exe")) ? ["--ffmpeg-location", BINARIOS] : []),
      "--print", "before_dl:TITULO %(title)s", "-o", join(pasta, `${alvo.prefixo}-${id}.%(ext)s`),
    ], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8" } }));
    let parte = 0;
    p.stdout.on("data", (d) => {
      for (const l of String(d).split(/\r?\n/)) {
        if (l.startsWith("TITULO ")) titulo = l.slice(7).trim();
        if (l.includes("Destination:")) parte++;
        const pc = l.match(/\[download\]\s+([\d.]+)%/);
        if (pc) t.passo = `Baixando ${parte > 1 ? "o som" : "o vídeo"}: ${Math.round(Number(pc[1]))}%`;
        if (l.startsWith("[Merger]")) t.passo = "Juntando imagem e som…";
      }
    });
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", (e) => falha(new Error(`Não consegui iniciar o yt-dlp: ${e.message} (instale com: python -m pip install --user yt-dlp)`)));
    p.on("close", (code) => {
      if (t.cancelado) return falha(new Error("Parado"));
      if (code !== 0 || !existsSync(join(RAIZ, "public", arquivo))) {
        const msg = erro.split(/\r?\n/).filter((l) => l.startsWith("ERROR")).pop() ?? erro.trim().split(/\r?\n/).pop() ?? "";
        const login = /login|log in|sign in|rate-limit|private/i.test(msg);
        return falha(new Error(alvo.site === "Instagram" && login
          ? "O Instagram pediu sessão iniciada para este vídeo (privado, com restrição ou limite de pedidos). Baixe-o pelo telemóvel e envie o ficheiro."
          : `O ${alvo.site} não deixou baixar este vídeo. ${msg.replace(/^ERROR:\s*/, "").slice(0, 200)}`.trim()));
      }
      // o título fica ao lado do vídeo, para a lista de vídeos baixados
      try { writeFileSync(join(pasta, `${alvo.prefixo}-${id}.json`), JSON.stringify({ titulo, link: alvo.url, baixadoEm: Date.now() })); } catch { /* só o nome */ }
      ok({ arquivo, nome: titulo || `${alvo.site} ${id}` });
    });
  });
}

// ---------- jobs ----------
const jobs = new Map();
let filaRender = Promise.resolve();

const novoJob = (dados) => {
  const job = { id: `j${Date.now().toString(36)}`, criado: Date.now(), estado: "na fila", progresso: 0, log: [], ...dados };
  jobs.set(job.id, job);
  return job;
};
const registar = (job, linha) => {
  job.log.push(linha);
  if (job.log.length > 300) job.log.shift();
};

const slug = (t) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 6).join("-");

const DESCREVER_FERRAMENTA = {
  WebSearch: (i) => `Pesquisando: ${i.query}`,
  WebFetch: (i) => `Lendo: ${i.url}`,
  Write: (i) => `Escrevendo ${i.file_path?.split(/[\\/]/).pop()}`,
  Edit: (i) => `Ajustando ${i.file_path?.split(/[\\/]/).pop()}`,
  Read: (i) => `Lendo ${i.file_path?.split(/[\\/]/).pop()}`,
  Skill: () => "Carregando a skill novo-video",
};

const DURACOES = { curto: "30 a 45 segundos", medio: "45 a 60 segundos", longo: "60 a 90 segundos", video_longo: "5 a 10 minutos" };
// o vídeo longo tem duração própria; os outros formatos escolhem no painel
const duracaoDe = (d) => (d.formato === "longo" ? "video_longo" : ["curto", "medio", "longo"].includes(d.duracao) ? d.duracao : "medio");

// Corre o Claude Code em modo headless com o system prompt do roteirista e mostra no log o que ele está a fazer
function rodarClaude(job, prompt, etapa = "Roteiro") {
  return new Promise((ok, falha) => {
    // lido a cada chamada, para refletir edições ao ficheiro
    const roteirista = readFileSync(join(RAIZ, ".claude/skills/novo-video/roteirista.md"), "utf-8");
    const p = spawn("claude", [
      "-p", prompt, "--append-system-prompt", roteirista, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
      "--allowedTools", "WebSearch", "WebFetch", "Read", "Write", "Edit", "Glob", "Grep", "Skill",
    ], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: envClaude() });
    guardarProcesso(job, p);
    let resto = "", ultimo = "";
    p.stdout.on("data", (d) => {
      const linhas = (resto + d).split("\n");
      resto = linhas.pop();
      for (const l of linhas) {
        let ev;
        try { ev = JSON.parse(l); } catch { continue; }
        if (ev.type === "assistant") {
          for (const c of ev.message?.content ?? []) {
            if (c.type === "tool_use") registar(job, (DESCREVER_FERRAMENTA[c.name] ?? (() => `${c.name}`))(c.input ?? {}));
          }
        } else if (ev.type === "result") {
          registarClaude(RAIZ, ev, { etapa, video: job.videoId });
          if (ev.result) { registar(job, `${ev.result}`); ultimo = ev.result; }
        }
      }
    });
    p.stderr.on("data", (d) => registar(job, String(d).trim()));
    p.on("error", (e) => falha(new Error(`Não consegui iniciar o Claude Code: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? ok() : falha(erroClaude(ultimo, "O Claude terminou com erro"))));
  });
}

// canais (marca d'água): src/canais.json; "nenhum" = vídeo sem marca d'água
const canais = () => JSON.parse(readFileSync(join(RAIZ, "src/canais.json"), "utf-8"));
const canalDe = (c) => (c === "nenhum" || canais()[c] ? c : undefined);
const canalPadrao = () => Object.keys(canais())[0] ?? "duckexplica";
const gravarCanais = (todos) => writeFileSync(join(RAIZ, "src/canais.json"), JSON.stringify(todos, null, 2) + "\n");

// job de vídeo novo (roteiro → validação → mídia → revisão ou render), a partir do pedido do painel ou do modo automático
function criarJobNovo(d, videoId = `${slug(d.tema) || "video"}-${Date.now().toString(36).slice(-5)}`) {
  return novoJob({
    tipo: "novo", videoId, formato: FORMATOS[d.formato] ? d.formato : "ranking", tema: d.tema.trim(), estilo: d.estilo ?? "neon", narracao: d.narracao ?? "edge",
    voz: d.voz, produtos: Math.min(5, Math.max(3, Number(d.produtos) || 3)), pais: d.pais ?? "Brasil (R$)",
    observacoes: d.observacoes ?? "", revisar: d.revisar !== false, musica: d.musica ?? "auto", ...(Number(d.musicaInicio) > 0 ? { musicaInicio: Math.round(Number(d.musicaInicio) * 10) / 10 } : {}), lowpoly: Boolean(d.lowpoly) && d.formato !== "animado",
    duracao: duracaoDe(d), editorChefe: d.editorChefe !== false, revisaoVisual: d.revisaoVisual !== false, canal: canalDe(d.canal), auto: Boolean(d.auto),
  });
}

// as escolhas do painel prevalecem sobre o que estiver no roteiro
function aplicarEscolhas(job) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(job.videoId), "utf-8"));
  Object.assign(r, {
    id: job.videoId, formato: job.formato, estilo: job.estilo, narracao: job.narracao, voz: job.voz, musica: job.musica ?? "auto",
    musicaInicio: job.musicaInicio,
    canal: job.canal ?? r.canal ?? canalPadrao(), duracao_alvo: job.duracao, mercado: String(job.pais).startsWith("Portugal") ? "Portugal" : "Brasil",
  });
  delete r.cor;
  if (r.canal === "nenhum") { r.marcaDagua = false; r.canal = undefined; } else if (job.canal) delete r.marcaDagua;
  writeFileSync(caminhoRoteiro(job.videoId), JSON.stringify(r, null, 2));
}

// validador automático: preenche os preços da tela a partir do catálogo e devolve {erros, avisos}
async function validar(job) {
  const saida = { log: [] };
  await correrScript(saida, ["scripts/validar_roteiro.py", `roteiros/${job.videoId}.json`, "--corrigir", "--json"]).catch(() => {});
  try { return JSON.parse(saida.log.at(-1)); } catch { return { erros: ["O validador não respondeu"], avisos: [] }; }
}

// segunda leitura: corrige o que o validador apanhou e aprofunda as cenas rasas
async function editorChefe(job, problemas) {
  job.estado = "editor";
  registar(job, "Editor-chefe revisando profundidade, precisão e preços…");
  const prompt = [
    `És o editor-chefe do canal. Revise o roteiro em roteiros/${job.videoId}.json (lê também dados/precos.json).`,
    problemas.length ? `O validador automático encontrou estes problemas, que TÊM de ficar resolvidos:\n- ${problemas.join("\n- ")}` : "O validador não encontrou erros.",
    "Depois faz a tua revisão de editor, pela ordem:",
    "1. Profundidade: cada cena tem de passar no teste do \"e daí?\" (seção 3.2 do system prompt). Reescreve as cenas rasas com dados concretos e o porquê. Se faltar informação, pesquisa (WebSearch) e acrescenta o fato, com fonte e link, ao campo pesquisa.",
    "2. Precisão: cada afirmação tem de estar na pesquisa. Preços só do catálogo dados/precos.json (atualiza-o com 2 lojas se o preço tiver mais de 7 dias ou faltar) e ligados com produto_ref ou precos_usados.",
    "3. Honestidade: tira promessas que não existem e afirmações que o canal não pode provar.",
    "4. Arco e retenção: o gancho promete, o meio aprofunda, o fim entrega e volta ao gancho.",
    "5. Fala: PT-BR natural, números por extenso, no máximo duas marcas por cena.",
    `Duração alvo: ${DURACOES[job.duracao] ?? DURACOES.medio}.`,
    "Mantém o formato JSON, os ids, o estilo, a narração, a voz e a mídia que já estão certos. Grava o arquivo.",
    "No fim responde numa linha com o que mudaste.",
  ].join("\n");
  if (modoIA(RAIZ) === "externa") {
    const atual = readFileSync(caminhoRoteiro(job.videoId), "utf-8");
    const pedido = prompt.replace(/Grava o arquivo\.\nNo fim responde numa linha com o que mudaste\./, "Devolve o roteiro COMPLETO já corrigido, no mesmo formato JSON.") +
      `\n\nO roteiro atual:\n${atual}`;
    registar(job, "À espera do editor-chefe da IA externa (Produção)");
    const r = await esperarExterno({ raiz: RAIZ, rotulo: `Editor-chefe: ${job.tema}`, pedido, ferramentas: ["WebSearch"], deveParar: () => Boolean(job.cancelado) });
    if (r.json) {
      const corrigido = lerRoteiroExterno(JSON.stringify(r.json));
      writeFileSync(caminhoRoteiro(job.videoId), JSON.stringify({ id: job.videoId, ...corrigido }, null, 2));
      return;
    }
  }
  await rodarClaude(job, prompt, "Editor-chefe");
}

// ---------- skill youtube (claude-youtube, MIT): ideias, pacote de publicação, variantes de gancho ----------
// Tarefas curtas do Claude que devolvem JSON. Correm em segundo plano; o painel pergunta pelo estado.
const tarefas = new Map();
const GUIAS = join(RAIZ, ".claude/skills/youtube/painel");

function tirarJSON(texto) {
  const t = String(texto ?? "");
  const ini = t.indexOf("{"), fim = t.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("O Claude não respondeu com JSON");
  return JSON.parse(t.slice(ini, fim + 1));
}

// o pedido vai pelo stdin (os roteiros longos passariam o limite da linha de comandos do Windows)
// nomes dos passos que aparecem na Produção quando a IA é externa
const ROTULO_GUIA = { "ideias.md": "Ideias de vídeos", "publicacao.md": "Título, descrição e tags", "ganchos.md": "Variantes de gancho", "cortes.md": "Cortes de um vídeo longo" };
async function claudeJSON(tarefa, guia, pedido, ferramentas = []) {
  if (modoIA(RAIZ) === "externa") {
    const nome = guia.split(/[\\/]/).pop();
    if (nome === "revisao-visual.md") throw new Error("a revisão visual só funciona com o Claude (precisa de ver os frames)");
    if (tarefa && typeof tarefa === "object") tarefa.passo = "À espera da IA externa: copie o pedido na Produção e cole a resposta";
    const sistema = readFileSync(/[\\/]/.test(guia) ? guia : join(GUIAS, guia), "utf-8");
    const r = await esperarExterno({ raiz: RAIZ, rotulo: ROTULO_GUIA[nome] ?? nome.replace(/\.md$/, ""), sistema, pedido, ferramentas, deveParar: () => Boolean(tarefa?.cancelado) });
    if (r.json) return r.json;
  }
  return claudeJSONPeloClaude(tarefa, guia, pedido, ferramentas);
}
function claudeJSONPeloClaude(tarefa, guia, pedido, ferramentas = []) {
  return new Promise((ok, falha) => {
    const sistema = readFileSync(/[\\/]/.test(guia) ? guia : join(GUIAS, guia), "utf-8");
    const p = spawn("claude", [
      "-p", "--append-system-prompt", sistema, "--output-format", "stream-json", "--verbose",
      ...(ferramentas.length ? ["--allowedTools", ...ferramentas] : []),
    ], { cwd: RAIZ, stdio: ["pipe", "pipe", "pipe"], env: envClaude() });
    if (tarefa && typeof tarefa === "object" && !Object.getOwnPropertyDescriptor(tarefa, "passo")?.set) guardarProcesso(tarefa, p);
    let resto = "", resultado = null;
    p.stdout.on("data", (d) => {
      const linhas = (resto + d).split("\n");
      resto = linhas.pop();
      for (const l of linhas) {
        let ev;
        try { ev = JSON.parse(l); } catch { continue; }
        if (ev.type === "assistant") {
          for (const c of ev.message?.content ?? []) if (c.type === "tool_use") tarefa.passo = (DESCREVER_FERRAMENTA[c.name] ?? (() => `${c.name}`))(c.input ?? {});
        } else if (ev.type === "result") {
          resultado = ev.result;
          const nome = guia.split(/[\\/]/).pop();
          registarClaude(RAIZ, ev, { etapa: ROTULO_GUIA[nome] ?? (nome === "revisao-visual.md" ? "Revisão visual" : nome.replace(/\.md$/, "")), video: tarefa?.videoId });
        }
      }
    });
    p.stderr.on("data", () => {});
    p.on("error", (e) => falha(new Error(`Não consegui iniciar o Claude Code: ${e.message}`)));
    p.on("close", (code) => {
      if (code !== 0 || !resultado) return falha(erroClaude(resultado, "O Claude terminou com erro (pode ter acabado o limite diário)"));
      try { ok(tirarJSON(resultado)); } catch (e) { falha(e); }
    });
    p.stdin.end(pedido);
  });
}

function novaTarefa(tipo, trabalho) {
  const t = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo, estado: "a correr", passo: "Pensando…", criado: Date.now() };
  tarefas.set(t.id, t);
  for (const [k, v] of tarefas) if (Date.now() - v.criado > 3 * 3600e3) tarefas.delete(k);
  trabalho(t).then((r) => { if (!t.cancelado) Object.assign(t, { estado: "pronto", resultado: r }); }, (e) => { if (!t.cancelado) Object.assign(t, { estado: "erro", erro: e.message }); });
  return t;
}

// o essencial do roteiro para o Claude ler (sem caminhos de mídia nem tempos)
function resumoRoteiro(r) {
  return {
    titulo: r.titulo, formato: r.formato, mercado: r.mercado ?? "Brasil", thumbnail: r.thumbnail, legenda_post: r.legenda_post,
    cenas: r.cenas.map((c, i) => ({ n: i, tipo: c.tipo, ...["texto_tela", "kicker", "titulo", "nome", "preco", "valor", "sufixo", "texto"].reduce((o, k) => (c[k] !== undefined ? { ...o, [k]: c[k] } : o), {}), fala: c.fala })),
    pesquisa: r.pesquisa ?? [], precos_usados: r.precos_usados ?? [],
  };
}

// uma lista de ideias por canal (a última gerada fica guardada)
const ficheiroIdeias = (canal) => join(RAIZ, `dados/ideias-${canais()[canal] ? canal : canalPadrao()}.json`);
function gerarIdeias(t, d) {
  const id = canais()[d.canal] ? d.canal : canalPadrao();
  const canal = canais()[id];
  // só os vídeos deste canal contam como "já feitos"
  const feitos = readdirSync(join(RAIZ, "roteiros")).filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(readFileSync(join(RAIZ, "roteiros", f), "utf-8")); } catch { return null; } })
    .filter((r) => r && (r.canal ?? canalPadrao()) === id).map((r) => r.titulo).filter(Boolean);
  const pedido = [
    `Hoje é ${new Date().toISOString().slice(0, 10)}. Sugira ${Math.min(15, Math.max(3, Number(d.quantidade) || 10))} ideias de vídeos para o canal ${canal.nome} (${canal.arroba}), seguindo o guia.`,
    `Nicho do canal: ${canal.nicho ?? "o que o criador pedir"}.`,
    d.foco ? `Foco pedido pelo criador: ${d.foco}` : "Sem foco específico: varie os temas dentro do nicho do canal.",
    FORMATOS[d.formato] ? `Use só o formato: ${d.formato}` : "",
    `Mercado: ${String(d.pais ?? "Brasil").startsWith("Portugal") ? "Portugal (PT-PT, euros)" : "Brasil (PT-BR, reais)"}.`,
    `Vídeos que o canal já fez (não repetir):\n- ${feitos.slice(0, 120).join("\n- ") || "(nenhum)"}`,
    (() => { const dg = lerInsights(id)?.diagnostico; return dg ? `O que os números do canal no YouTube dizem (siga o que funciona):\n- ${[...(dg.funciona ?? []), ...(dg.acoes ?? []).map((a) => a.titulo)].slice(0, 8).join("\n- ")}` : ""; })(),
    "Pesquise na web o que está acontecendo agora antes de sugerir. Responda só com o JSON.",
  ].filter(Boolean).join("\n\n");
  return claudeJSON(t, "ideias.md", pedido, ["WebSearch", "WebFetch"]).then((r) => {
    if (!Array.isArray(r.ideias)) throw new Error("A resposta não trouxe ideias");
    const salvo = { geradoEm: new Date().toISOString(), canal: id, foco: d.foco ?? "", ideias: r.ideias.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0)) };
    writeFileSync(ficheiroIdeias(id), JSON.stringify(salvo, null, 2));
    return salvo;
  });
}

// ---------- Insights: as estatísticas do YouTube de cada canal, cruzadas com o que o estúdio fez ----------
// Os números vêm da API oficial (server/youtube.mjs) e ficam guardados em dados/insights/<canal>.json; o
// cruzamento liga cada vídeo do YouTube ao vídeo do estúdio (pelo id do envio automático ou pelo título).
const ficheiroInsights = (canal) => join(RAIZ, "dados/insights", `${canal}.json`);
const lerInsights = (canal) => { try { return JSON.parse(readFileSync(ficheiroInsights(canal), "utf-8")); } catch { return null; } };
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// emojis 3D (Fluent Emoji, MIT) que a galeria do Objeto mostra: [nome em inglês, nome em PT, tem tom de pele]
const EMOJIS_GALERIA = [
  ["brain", "Cérebro"], ["light bulb", "Lâmpada acesa"], ["kitchen knife", "Faca"], ["dagger", "Punhal"], ["anatomical heart", "Coração"], ["lungs", "Pulmões"],
  ["bone", "Osso"], ["tooth", "Dente"], ["pill", "Comprimido"], ["syringe", "Seringa"], ["dna", "DNA"], ["microbe", "Micróbio / vírus"], ["drop of blood", "Gota de sangue"],
  ["stethoscope", "Estetoscópio"], ["eye", "Olho"], ["flexed biceps", "Músculo", true], ["hospital", "Hospital"], ["thermometer", "Termómetro"],
  ["skull", "Caveira"], ["fire", "Fogo"], ["money bag", "Saco de dinheiro"], ["trophy", "Troféu"], ["rocket", "Foguetão"], ["warning", "Alerta"], ["alarm clock", "Despertador"],
  ["hourglass done", "Ampulheta"], ["red apple", "Maçã"], ["droplet", "Gota de água"], ["zzz", "Sono"], ["bed", "Cama"], ["video game", "Comando de jogo"], ["joystick", "Joystick"],
  ["desktop computer", "Computador"], ["laptop", "Portátil"], ["mobile phone", "Telemóvel"], ["battery", "Bateria"], ["electric plug", "Ficha elétrica"], ["gear", "Engrenagem"],
  ["magnifying glass tilted left", "Lupa"], ["chart increasing", "Gráfico a subir"], ["chart decreasing", "Gráfico a descer"], ["gem stone", "Diamante"], ["crown", "Coroa"],
  ["bomb", "Bomba"], ["high voltage", "Raio"], ["star", "Estrela"], ["thinking face", "Cara a pensar"], ["exploding head", "Cabeça a explodir"], ["face screaming in fear", "Cara de medo"],
  ["smiling face with sunglasses", "Cara de óculos"], ["hundred points", "100"], ["check mark button", "Certo"], ["cross mark", "Errado"], ["robot", "Robô"], ["alien", "Alien"],
  ["cocktail glass", "Drink / gin tônica"], ["tumbler glass", "Copo de dose"], ["cup with straw", "Copo com palhinha"], ["wine glass", "Taça de vinho"],
  ["bottle with popping cork", "Garrafa a estourar"], ["clinking glasses", "Brinde"], ["clinking beer mugs", "Brinde de cerveja"], ["ice", "Gelo"], ["lemon", "Limão"],
  ["woozy face", "Cara bêbada"], ["face with spiral eyes", "Tonto / ressaca"], ["nauseated face", "Enjoo"], ["face vomiting", "Vomitar"], ["hot face", "Cara a ferver"],
  ["sleeping face", "A dormir"], ["sweat droplets", "Suor"], ["broken heart", "Coração partido"], ["ambulance", "Ambulância"], ["prohibited", "Proibido"],
  ["calendar", "Calendário"], ["money with wings", "Dinheiro a voar"],
  ["ghost", "Fantasma"], ["globe showing americas", "Planeta Terra"], ["hot beverage", "Bebida quente"], ["cigarette", "Cigarro"], ["beer mug", "Cerveja"],
];
const normalizarTitulo = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/#\S+/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// o que o estúdio sabe de cada vídeo que fez para este canal
function videosDoEstudio(canal) {
  const pasta = join(RAIZ, "roteiros");
  if (!existsSync(pasta)) return [];
  let auto = [];
  try { auto = JSON.parse(readFileSync(join(RAIZ, "dados/automatico.json"), "utf-8")).historico ?? []; } catch { /* sem modo automático */ }
  return readdirSync(pasta).filter((f) => f.endsWith(".json")).map((f) => {
    const id = f.slice(0, -5);
    let r, pub = null;
    try { r = JSON.parse(readFileSync(join(pasta, f), "utf-8")); } catch { return null; }
    if ((r.canal ?? canalPadrao()) !== canal) return null;
    try { pub = JSON.parse(readFileSync(ficheiroPublicacao(id), "utf-8")); } catch { /* sem publicação */ }
    const cenas = r.cenas ?? [];
    const sons = cenas.reduce((n, c) => n + (c.sons?.length ?? 0) + (c.som ? 1 : 0), 0);
    const duracao = Math.round(cenas.reduce((s, c) => s + (c.duracaoMs ?? 0), 0) / 1000) || null;
    const musica = typeof r.musica === "string" ? r.musica.split("/").slice(-2, -1)[0] ?? null : null;
    return {
      id, estilo: r.estilo ?? "neon", formato: r.formato ?? "livre", duracao, sfx: sons > 0, sons, musica,
      gancho: String(cenas[0]?.fala ?? cenas[0]?.texto_tela ?? "").slice(0, 140),
      titulos: [r.titulo, ...(pub?.titulos ?? []).map((t) => t?.texto ?? t)].filter(Boolean).map(normalizarTitulo),
      youtubeId: auto.find((a) => a.videoId === id && a.youtubeId)?.youtubeId ?? null,
    };
  }).filter(Boolean);
}
const NOMES_FORMATO = { livre: "Livre", quiz: "Quiz", ranking: "Ranking", storytelling: "Storytelling", curiosidades: "Curiosidades", explicativo: "Explicativo", ese: "E se?", animado: "E se? animado", clipe: "Clipe", longo: "Vídeo longo" };
const faixaDuracao = (s) => (!s ? null : s <= 30 ? "até 30 s" : s <= 45 ? "31 a 45 s" : s <= 60 ? "46 a 60 s" : s <= 90 ? "61 a 90 s" : s <= 180 ? "1,5 a 3 min" : "mais de 3 min");
// junta os números do YouTube aos vídeos do estúdio e calcula as médias por estilo, formato, duração e efeitos sonoros
function cruzarInsights(dados) {
  const estudio = videosDoEstudio(dados.canal), nomesEstilo = estilos();
  const ligados = [];
  for (const v of dados.videos ?? []) {
    const t = normalizarTitulo(v.titulo);
    const e = estudio.find((x) => x.youtubeId === v.id) ?? estudio.find((x) => x.titulos.some((y) => y && (y === t || (y.length > 12 && (t.startsWith(y) || y.startsWith(t))))));
    v.estudio = e ? { id: e.id, estilo: e.estilo, estiloNome: nomesEstilo[e.estilo]?.nome ?? e.estilo, formato: e.formato, duracao: e.duracao, sfx: e.sfx, sons: e.sons, musica: e.musica, gancho: e.gancho } : null;
    if (e && v.periodo.views > 0) ligados.push(v);
  }
  const media = (l, f) => { const xs = l.map(f).filter((x) => Number.isFinite(x)); return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null; };
  const grupo = (titulo, chave) => {
    const g = {};
    for (const v of ligados) { const k = chave(v); if (k != null) (g[k] ??= []).push(v); }
    return { titulo, grupos: Object.entries(g).map(([nome, l]) => ({
      nome, n: l.length, views: media(l, (v) => v.periodo.views), percentagem: media(l, (v) => v.periodo.percentagemMedia),
      duracaoVista: media(l, (v) => v.periodo.duracaoMedia), ctr: media(l, (v) => v.periodo.ctr), inscritos: media(l, (v) => v.periodo.inscritos),
    })).sort((a, b) => (b.percentagem ?? 0) - (a.percentagem ?? 0)) };
  };
  dados.cruzamento = {
    ligados: ligados.length, doEstudio: (dados.videos ?? []).filter((v) => v.estudio).length,
    eixos: [
      grupo("Estilo", (v) => v.estudio.estiloNome),
      grupo("Formato", (v) => NOMES_FORMATO[v.estudio.formato] ?? v.estudio.formato),
      grupo("Duração", (v) => faixaDuracao(v.estudio.duracao ?? v.duracao)),
      grupo("Efeitos sonoros", (v) => (v.estudio.sfx ? "com SFX" : "sem SFX")),
      grupo("Tipo", (v) => (v.short ? "Short" : "Vídeo longo")),
    ].filter((e) => e.grupos.length),
  };
  return dados;
}
async function atualizarInsights(t, canal, dias) {
  t.passo = "Buscando os números no YouTube…";
  const dados = await youtube.insights(canal, dias);
  const antigo = lerInsights(canal);
  if (antigo?.diagnostico) dados.diagnostico = antigo.diagnostico; // o diagnóstico fica até se pedir outro
  mkdirSync(join(RAIZ, "dados/insights"), { recursive: true });
  writeFileSync(ficheiroInsights(canal), JSON.stringify(dados, null, 1));
  return cruzarInsights(dados);
}
async function diagnosticarCanal(t, canal) {
  const dados = lerInsights(canal);
  if (!dados) throw new Error("Atualize os números primeiro");
  cruzarInsights(dados);
  // o Claude lê um ficheiro mais pequeno: sem miniaturas nem o diagnóstico antigo
  const { diagnostico, ...resto } = dados;
  const paraLer = join(RAIZ, "dados/insights", `${canal}.analise.json`);
  writeFileSync(paraLer, JSON.stringify({ ...resto, videos: resto.videos.map(({ miniatura, ...v }) => v) }, null, 1));
  const c = canais()[canal];
  t.passo = "O Claude está analisando o canal…";
  const r = await claudeJSON(t, "insights.md", [
    `Canal do estúdio: ${c?.nome ?? canal} (${c?.arroba ?? ""}), nicho: ${c?.nicho ?? "não indicado"}.`,
    `Números do YouTube nos últimos ${dados.dias} dias e o cruzamento com o estúdio (lê com Read): ${paraLer}`,
    "Responde só com o JSON.",
  ].join("\n\n"), ["Read"]);
  dados.diagnostico = { ...r, em: new Date().toISOString(), dias: dados.dias };
  writeFileSync(ficheiroInsights(canal), JSON.stringify(dados, null, 1));
  return dados.diagnostico;
}

const ficheiroPublicacao = (id) => join(RAIZ, "out", `${id}.publicacao.json`);
function gerarPublicacao(t, id) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  const desc = join(RAIZ, "out", `${id}.descricao.txt`);
  const capitulos = existsSync(desc) ? readFileSync(desc, "utf-8").split("\n").filter((l) => /^\d+:\d\d/.test(l.trim())) : [];
  const pedido = [
    `Faça o pacote de publicação deste vídeo (${r.formato === "longo" ? "vídeo longo 16:9 do YouTube" : "vertical: YouTube Shorts, TikTok, Reels e Facebook"}). Os títulos vão todos em CAIXA ALTA.`,
    capitulos.length ? `Capítulos (use exatamente estes, na descrição do YouTube):\n${capitulos.join("\n")}` : r.formato === "longo" ? "Ainda não há capítulos com tempos (o vídeo não foi renderizado): deixe a linha \"[capítulos]\" no lugar onde eles entram." : "",
    `Roteiro:\n${JSON.stringify(resumoRoteiro(r), null, 1)}`,
    "Responda só com o JSON.",
  ].filter(Boolean).join("\n\n");
  return claudeJSON(t, "publicacao.md", pedido).then((p) => {
    // títulos sempre em caixa alta, mesmo que a IA se esqueça
    const titulos = Array.isArray(p.titulos) ? p.titulos.map((x) => (x && typeof x.texto === "string" ? { ...x, texto: x.texto.toLocaleUpperCase("pt-BR") } : x)) : p.titulos;
    const salvo = { ...p, titulos, geradoEm: new Date().toISOString() };
    mkdirSync(join(RAIZ, "out"), { recursive: true });
    writeFileSync(ficheiroPublicacao(id), JSON.stringify(salvo, null, 2));
    return salvo;
  });
}

function gerarGanchos(t, id) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  const pedido = [
    `Escreva 5 variantes para o gancho (cena 0) deste ${r.formato === "longo" ? "vídeo longo" : "Short"}. O resto do roteiro fica igual.`,
    `Roteiro:\n${JSON.stringify(resumoRoteiro(r), null, 1)}`,
    "Responda só com o JSON.",
  ].join("\n\n");
  return claudeJSON(t, "ganchos.md", pedido).then((g) => {
    if (!Array.isArray(g.variantes) || !g.variantes.length) throw new Error("A resposta não trouxe variantes");
    return g;
  });
}

// ---------- revisão visual (review-loop do claude-motion, MIT) ----------
// Tira frames de cada cena do vídeo renderizado, monta folhas de contacto e o Claude revê-as com uma lista
// (texto cortado ou ilegível, sobreposições, foco, frame 0). Resultado em out/revisao/<id>.json.
const ficheiroRevisao = (id) => join(RAIZ, "out/revisao", `${id}.json`);
function revisaoVisual(id, aoPasso = () => {}) {
  return new Promise((ok, falha) => {
    aoPasso("Capturando frames de cada cena…");
    const p = spawn("python", ["scripts/folha_contacto.py", id], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let saida = "", erro = "";
    p.stdout.on("data", (d) => (saida += d));
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", falha);
    p.on("close", (code) => {
      if (code !== 0) return falha(new Error(erro.trim().split("\n").pop() || "Não consegui tirar os frames"));
      let folha;
      try { folha = JSON.parse(saida.trim().split("\n").pop()); } catch { return falha(new Error("A folha de contato não respondeu")); }
      ok(folha);
    });
  }).then(async (folha) => {
    aoPasso("O Claude está vendo os frames…");
    const pedido = [
      `Revê este vídeo (${folha.quadros.length} quadros em ${folha.folhas.length} folhas de contato). Lê cada folha com Read:`,
      ...folha.folhas.map((f) => `- ${join(RAIZ, f)}`),
      `Mapa dos quadros: ${JSON.stringify(folha.quadros)}`,
      "Responde só com o JSON.",
    ].join("\n");
    const r = await claudeJSON({ set passo(v) { aoPasso(v); } }, join(RAIZ, ".claude/skills/novo-video/revisao-visual.md"), pedido, ["Read"]);
    const salvo = { nota: r.nota, resumo: r.resumo ?? "", problemas: Array.isArray(r.problemas) ? r.problemas : [], folhas: folha.folhas.map((f) => `/${f}`), revistoEm: new Date().toISOString() };
    writeFileSync(ficheiroRevisao(id), JSON.stringify(salvo, null, 2));
    return salvo;
  });
}

// IA externa: o pedido completo do "Roteiro de outra IA" fica na Produção; a resposta (o roteiro em JSON) é validada
// como no import e o vídeo segue. "Usar o Claude neste" volta ao caminho normal.
async function escreverRoteiroExterno(job, promptClaude) {
  registar(job, "À espera do roteiro da IA externa (copie o pedido na Produção e cole a resposta)");
  const r = await esperarExterno({ raiz: RAIZ, rotulo: `Roteiro: ${job.tema}`, pedido: promptExterno(job), ferramentas: ["WebSearch"], deveParar: () => Boolean(job.cancelado) });
  if (r.claude) {
    registar(job, "Claude pesquisando e escrevendo o roteiro…");
    await rodarClaude(job, promptClaude);
    if (!existsSync(caminhoRoteiro(job.videoId))) throw new Error("O Claude não gravou o roteiro");
  } else {
    const roteiro = lerRoteiroExterno(JSON.stringify(r.json));
    writeFileSync(caminhoRoteiro(job.videoId), JSON.stringify({ id: job.videoId, ...roteiro }, null, 2));
  }
  aplicarEscolhas(job);
  registar(job, "Primeira versão do roteiro pronta");
}

function escreverRoteiro(job) {
  const est = estilos()[job.estilo] ?? estilos().neon;
  const prompt = [
    "Usa a skill novo-video, mas faz APENAS os passos 1 (pesquisar) e 2 (escrever o roteiro).",
    "NÃO corras npm run video nem renderizes nada.",
    `Tema: ${job.tema}`,
    `Formato: ${(FORMATOS[job.formato] ?? FORMATOS.ranking).replaceAll("{itens}", String(job.produtos))}`,
    // formatos sem secção própria na skill: o guia vem de formatos-externo.md (o mesmo que a outra IA recebe)
    job.formato === "quiz" ? `Guia do formato quiz (campos da cena quiz em .claude/skills/novo-video/esquema-roteiro.md):
${guiaDe("formato: quiz").replaceAll("{itens}", String(job.produtos))}` : "",
    job.formato === "livre" ? `Guia do formato livre (o pedido do criador manda; os campos de cada tipo de cena estão em .claude/skills/novo-video/esquema-roteiro.md):
${guiaDe("formato: livre")}` : "",
    job.formato === "animado" ? `Guia do formato animado (cenas do tipo lowpoly, campos em .claude/skills/novo-video/esquema-roteiro.md):
${guiaDe("formato: animado")}` : "",
    job.formato === "livre" ? "" : `Número de itens (produtos, curiosidades ou blocos): ${job.produtos}`,
    `País e moeda (se houver preços): ${job.pais}`,
    `Idioma da narração: ${String(job.pais).startsWith("Portugal") ? "português europeu (o mercado é Portugal)" : "português brasileiro (PT-BR)"}.`,
    canais()[job.canal] ? `Canal: ${canais()[job.canal].nome} (${canais()[job.canal].arroba})${canais()[job.canal].nicho ? `, nicho: ${canais()[job.canal].nicho}` : ""}. Escreve para o público deste canal.` : "",
    `Estilo visual: ${est.nome} — ${est.descricao}. Ajusta o tom do texto a este estilo. ${guiaDe(`estilo: ${job.estilo}`) ?? ""}`,
    `Duração alvo: ${DURACOES[job.duracao] ?? DURACOES.medio} (duracao_alvo = "${job.duracao ?? "medio"}").`,
    job.observacoes ? `Observações do criador: ${job.observacoes}` : "",
    job.lowpoly || job.formato === "animado" ? `${job.lowpoly ? REGRA_LOWPOLY + " " : ""}Campos da cena lowpoly em .claude/skills/novo-video/esquema-roteiro.md; para objetos que o motor não desenha, usa o objeto modelo com um nome de .claude/skills/novo-video/modelos-lowpoly.md.` : "",
    `Grava o roteiro em roteiros/${job.videoId}.json com "id": "${job.videoId}". Não incluas os campos cor, estilo, narracao nem voz.`,
    "Inclui mídia real (campo midia) sempre que fizer sentido, como a skill explica.",
    "Logo a seguir ao gancho, uma apresentação clara do tema (seção 3a): uma ou duas frases que dizem de que é o vídeo, com o tema pelo nome, e o que a pessoa vai entender; só depois o desenvolvimento.",
    "O roteiro tem de seguir o arco narrativo (início, meio e fim) e as regras de fala natural da skill (seções 3a e 3b): frases curtas, números e siglas por extenso na fala, marcas [pausa] antes das revelações, sempre logo a seguir a uma vírgula ou a um ponto (nunca no meio de uma frase sem pontuação: soa a vídeo travado).",
    "Antes de gravar o arquivo, faz a revisão da seção 3c: relê as falas em sequência como se as dissesses em voz alta e reescreve o que soar a texto lido ou não responder à promessa do gancho.",
    "Começa pela pesquisa (seção 3.1): preenche o campo pesquisa com fatos específicos, cada um com fonte e link.",
    "Preços: usa e atualiza o catálogo dados/precos.json (seção 3.3) e liga cada produto com produto_ref.",
    "A última cena é sempre um `cta` e a fala dele pede para se inscrever no canal (\"se inscreve pra não perder o próximo\"), mesmo quando a ação principal é comentar ou o link: ex. \"Comenta aí qual foi a tua e se inscreve no canal.\" O tela mostra sempre o botão de inscrição.",
    "Preenche também os campos thumbnail e legenda_post.",
    "No fim responde numa linha com as fontes usadas (e os preços, se houver).",
  ].filter(Boolean).join("\n");

  job.estado = "roteiro";
  if (modoIA(RAIZ) === "externa") return escreverRoteiroExterno(job, prompt);
  registar(job, "Claude pesquisando e escrevendo o roteiro…");
  return rodarClaude(job, prompt).then(() => {
    if (!existsSync(caminhoRoteiro(job.videoId))) throw new Error("O Claude não gravou o roteiro");
    aplicarEscolhas(job);
    registar(job, "Primeira versão do roteiro pronta");
  });
}

function produzir(job) {
  job.estado = "na fila de render";
  filaRender = filaRender.then(() => new Promise((ok) => {
    if (job.cancelado) return ok(); // parado enquanto esperava na fila
    job.estado = "narracao";
    const p = guardarProcesso(job, spawn(process.execPath, ["scripts/produzir.mjs", `roteiros/${job.videoId}.json`], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: envClaude() }));
    const ler = (d) => {
      for (const bruto of String(d).split(/\r?\n/).filter(Boolean)) {
        // sem as cores do terminal; as linhas "Tab N, node_modules/…" do Remotion (o texto vai no [navegador] do
        // produzir.mjs) enchiam o log de 300 linhas e empurravam para fora o erro que interessa
        const l = bruto.replace(/\x1b\[\d+(;\d+)*m/g, "").trimEnd();
        if (!l.trim() || /^\s*Tab \d+, node_modules\//.test(l)) continue;
        const etapa = l.match(/^\[etapa\] (\w+)/);
        const prog = l.match(/^\[progresso\] (\d+)/);
        if (etapa) job.estado = etapa[1] === "preparar" ? "render" : etapa[1];
        else if (prog) job.progresso = Number(prog[1]);
        else registar(job, l);
      }
    };
    p.stdout.on("data", ler);
    p.stderr.on("data", ler);
    p.on("close", (code) => {
      if (job.cancelado) {
        job.estado = "parado";
        registar(job, "⏹ Parado por si");
      } else if (code === 0) {
        job.estado = "pronto";
        job.progresso = 100;
        registar(job, "Vídeo pronto");
        if (job.revisaoVisual !== false) {
          revisaoVisual(job.videoId, (passo) => (job.passoRevisao = passo))
            .then((r) => { job.passoRevisao = null; registar(job, `Revisão visual: nota ${r.nota ?? "?"}/10, ${r.problemas.length} ${r.problemas.length === 1 ? "problema" : "problemas"}${r.problemas.length ? " (ver no editor)" : ""}`); job.aoTerminar?.(job, r); })
            .catch((e) => { job.passoRevisao = null; registar(job, `Revisão visual não feita: ${e.message}`); job.aoTerminar?.(job, null); });
        } else job.aoTerminar?.(job, null);
      } else {
        job.estado = "erro";
        registar(job, "Falhou a produção (ver log acima)");
        job.aoTerminar?.(job, null);
      }
      ok();
    });
  }));
}

// Corre um script Python do projeto e copia a saída para o log do job
const correrScript = (job, args) => new Promise((ok, falha) => {
  if (job.cancelado) return falha(new Parado());
  const p = guardarProcesso(job, spawn("python", args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8" } }));
  const ler = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => registar(job, l));
  p.stdout.on("data", ler);
  p.stderr.on("data", ler);
  p.on("error", falha);
  p.on("close", (code) => (code === 0 ? ok() : falha(new Error(`${args[0]} falhou`))));
});

// descarrega imagens/b-rolls e renderiza cenas Manim, para a revisão já as mostrar
async function prepararMidia(job) {
  job.estado = "midia";
  registar(job, "Procurando imagens e b-rolls…");
  await correrScript(job, ["scripts/buscar_midia.py", `roteiros/${job.videoId}.json`]);
  await correrScript(job, ["scripts/manim_cenas.py", `roteiros/${job.videoId}.json`]);
}

async function correrJob(job) {
  try {
    if (job.tipo === "novo") {
      if (!job.importado) await escreverRoteiro(job);
      else aplicarEscolhas(job);
      let q = await validar(job);
      registar(job, `Validador: ${q.erros.length} erros, ${q.avisos.length} avisos`);
      if (!job.importado && job.editorChefe !== false && (q.erros.length || q.avisos.length)) {
        await editorChefe(job, [...q.erros, ...q.avisos]);
        aplicarEscolhas(job);
        q = await validar(job);
        registar(job, `Depois do editor: ${q.erros.length} erros, ${q.avisos.length} avisos`);
      }
      q.erros.forEach((e) => registar(job, `Erro: ${e}`));
      await prepararMidia(job);
      // com erros por resolver, o vídeo nunca segue sozinho para render
      if (q.erros.length) job.revisar = true;
    }
    if (job.revisar && job.tipo === "novo") {
      job.estado = "aguardando revisao";
      registar(job, "Revise o roteiro (preços, fatos, avisos) e clique em Produzir");
      return;
    }
    produzir(job);
  } catch (e) {
    if (job.cancelado) return; // o estado "parado" já foi posto por pararJob
    job.estado = "erro";
    registar(job, `Erro: ${e.message}`);
  }
}

// botão Parar: na fila sai da fila; a correr, mata o processo (o render, o Claude ou o script de mídia)
function pararJob(job) {
  if (["pronto", "erro", "parado"].includes(job.estado)) return false;
  job.cancelado = true;
  job.estado = "parado";
  registar(job, "⏹ Parado por si");
  matarArvore(job.processo);
  return true;
}

// Prompt para escrever o roteiro noutra IA (ChatGPT, Gemini…) quando o Claude não está disponível:
// as mesmas regras do roteirista + o formato do JSON + o pedido feito no painel
// divide um .md em secções "## ..." (o que vem antes do primeiro ## fica à parte)
const seccoes = (texto) => texto.split(/\r?\n(?=## )/);
// guias por formato e por estilo (formatos-externo.md): "## formato: ranking", "## estilo: neon"…
function guiaDe(chave) {
  const t = readFileSync(join(RAIZ, ".claude/skills/novo-video/formatos-externo.md"), "utf-8");
  return seccoes(t).find((s) => s.startsWith(`## ${chave}\n`) || s.startsWith(`## ${chave}\r\n`))?.replace(/^## .*\r?\n/, "").trim();
}

function promptExterno(d) {
  const ler = (f) => readFileSync(join(RAIZ, ".claude/skills/novo-video", f), "utf-8");
  const est = estilos()[d.estilo] ?? estilos().neon;
  const portugal = String(d.pais ?? "").startsWith("Portugal");
  const duracao = duracaoDe(d);
  const formato = FORMATOS[d.formato] ? d.formato : "ranking";
  const itens = Math.min(5, Math.max(3, Number(d.produtos) || 3));
  const comPrecos = ["ranking", "storytelling"].includes(formato);
  // só as regras que servem a este formato: o E se?, o vídeo longo e os preços saem quando não se aplicam
  const tirar = { "## 3.3": !comPrecos && formato !== "livre", "## 3.5": !["ese", "animado", "livre"].includes(formato), "## 3.6": formato !== "longo" };
  const roteirista = seccoes(ler("roteirista.md")).filter((s) => !Object.entries(tirar).some(([k, sai]) => sai && s.startsWith(k))).join("\n");
  let esquema = ler("esquema-roteiro.md");
  if (formato !== "ese") esquema = esquema.replace('## Exemplo (formato "E se?", encurtado)', "## Exemplo de sintaxe (é de outro formato: copie só a forma do JSON, não a estrutura)");
  return [
    roteirista,
    "",
    "## Diferenças para quem escreve fora do estúdio",
    comPrecos
      ? "- Você não tem acesso ao catálogo de preços. Pesquise o preço atual de cada produto em pelo menos 2 lojas confiáveis e registe cada preço na `pesquisa` com loja, link e data; ignore `produto_ref`."
      : "- Este formato não vende produtos. Se citar algum preço, pesquise-o e registe-o na `pesquisa` com loja, link e data.",
    "- Pesquise na web antes de escrever. Se não puder navegar, use só fatos de que tem certeza e diga a fonte original; nunca invente links.",
    "",
    `## O formato deste vídeo: ${formato}`,
    (guiaDe(`formato: ${formato}`) ?? FORMATOS[formato]).replaceAll("{itens}", String(itens)),
    "",
    `## O estilo visual: ${est.nome}`,
    `${est.descricao}. ${guiaDe(`estilo: ${d.estilo}`) ?? ""}`.trim(),
    "",
    esquema,
    "",
    "## O pedido",
    `- Tema: ${String(d.tema ?? "").trim()}`,
    `- Formato: ${FORMATOS[formato].replaceAll("{itens}", String(itens))}`,
    ["ranking", "curiosidades", "quiz"].includes(formato) ? `- Número de ${{ ranking: "produtos", curiosidades: "curiosidades", quiz: "perguntas" }[formato]}: ${itens}` : null,
    `- País e moeda${comPrecos ? "" : " (se houver preços)"}: ${d.pais ?? "Brasil (R$)"}`,
    `- Idioma da narração: ${portugal ? "português europeu (o mercado é Portugal)" : "português brasileiro (PT-BR)"}`,
    `- Estilo visual: ${est.nome}. Ajuste o tom do texto como diz a seção do estilo.`,
    `- Duração alvo: ${DURACOES[duracao]}.`,
    d.observacoes?.trim() ? `- Observações do criador: ${d.observacoes.trim()}` : null,
    d.lowpoly && formato !== "animado" ? `- ${REGRA_LOWPOLY}` : null,
    formato === "longo" ? "- É um vídeo longo: o JSON vai ter 45 a 90 cenas. Escreva-o inteiro, sem resumir nem cortar cenas. Se a resposta for cortada a meio, eu escrevo \"continue\" e você continua exatamente do ponto onde parou, sem repetir nada." : null,
    "",
    "Faça a pesquisa, escreva, revise (seção 6) e responda só com o JSON.",
    "Ao me devolver o resultado, coloque **todo o JSON dentro de uma única caixa de código JSON** (comece a resposta com ```json e termine com ```), sem texto antes nem depois, para eu poder copiar com o botão de copiar da caixa.",
  ].filter((l) => l !== null).join("\n")
    // a outra IA não conhece a skill: as referências apontam para as secções deste mesmo texto
    .replace("campos descritos na skill", "campos descritos abaixo").replace(/ da skill/g, "").replace(/\(estrutura da secção [^)]*\)/g, "(estrutura na seção do formato, acima)");
}

// tira o JSON da resposta de outra IA (aceita blocos ```json e texto à volta)
function lerRoteiroExterno(texto) {
  const t = String(texto ?? "");
  const ini = t.indexOf("{"), fim = t.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("Não encontrei um JSON na resposta. Cole a resposta inteira da IA.");
  let r;
  try { r = JSON.parse(t.slice(ini, fim + 1)); } catch (e) { throw new Error(`O JSON tem um erro (${e.message}). Peça à IA para corrigir e responder só com o JSON.`); }
  if (!Array.isArray(r.cenas) || !r.cenas.length) throw new Error("O roteiro não tem cenas");
  const tipos = new Set(["dado", "calendario", "tipografia", "print", "faixa", "palavras", "gancho", "quiz", "lowpoly", "pincel", "produto", "fato", "grafico", "linha_tempo", "manim", "numero", "comparacao", "modelo3d", "capitulo", "cta"]);
  const maus = r.cenas.map((c, i) => (tipos.has(c?.tipo) ? null : `cena ${i + 1} (${c?.tipo ?? "sem tipo"})`)).filter(Boolean);
  if (maus.length) throw new Error(`Tipos de cena desconhecidos: ${maus.join(", ")}`);
  r.cenas.forEach((c) => { if (typeof c.fala !== "string") c.fala = ""; });
  ["id", "cor", "estilo", "narracao", "voz"].forEach((k) => delete r[k]);
  return r;
}

// ---------- HTTP ----------
const json = (res, codigo, dados) => {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(dados));
};
const corpo = (req) => new Promise((ok, falha) => {
  let d = "";
  req.on("data", (c) => (d += c));
  req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { falha(e); } });
});

// ficheiros que o painel está a enviar ao browser. O .pipe() não fecha o ficheiro quando o browser desiste a meio
// (uma prévia de vídeo carrega só o início e cancela), e no Windows um ficheiro aberto impede mover a pasta
// (EPERM ao mandar para a lixeira). Por isso: fecha-se quando a ligação fecha, e libertar() fecha os de uma pasta.
const abertos = new Set();
function enviarFicheiro(ficheiro, res, opcoes) {
  const s = createReadStream(ficheiro, opcoes);
  const item = { f: resolve(ficheiro), s, res };
  abertos.add(item);
  const fechar = () => { abertos.delete(item); s.destroy(); };
  s.on("close", () => abertos.delete(item));
  res.on("close", fechar);
  s.on("error", () => { fechar(); if (!res.headersSent) res.writeHead(500); res.end(); });
  return s.pipe(res);
}
function libertar(pasta) {
  const base = resolve(pasta);
  for (const item of [...abertos]) if (item.f === base || item.f.startsWith(base + "\\") || item.f.startsWith(base + "/")) { item.s.destroy(); item.res.destroy(); abertos.delete(item); }
}

// envia com suporte a Range (o browser precisa dele para saltar para o meio de um vídeo ou de uma música)
const enviarVideo = (req, res, ficheiro, tipo = "video/mp4") => {
  const tamanho = statSync(ficheiro).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (!range) {
    res.writeHead(200, { "Content-Type": tipo, "Content-Length": tamanho, "Accept-Ranges": "bytes" });
    return enviarFicheiro(ficheiro, res);
  }
  const ini = range[1] ? Number(range[1]) : 0;
  const fim = range[2] ? Number(range[2]) : tamanho - 1;
  res.writeHead(206, { "Content-Type": tipo, "Content-Length": fim - ini + 1, "Content-Range": `bytes ${ini}-${fim}/${tamanho}`, "Accept-Ranges": "bytes" });
  enviarFicheiro(ficheiro, res, { start: ini, end: fim });
};

// ---------- lixeira ----------
// Mover para a lixeira tira o vídeo da biblioteca sem o apagar: roteiro, MP4 e mídia vão para lixeira/<id>/.
// Só "apagar de vez" (ou esvaziar) remove os ficheiros.
const LIXEIRA = join(RAIZ, "lixeira");
const PECAS = (id) => [
  [caminhoRoteiro(id), "roteiro.json"],
  [join(RAIZ, "out", `${id}.mp4`), "video.mp4"],
  [join(RAIZ, "out", `${id}.props.json`), "props.json"],
  [join(RAIZ, "out", `${id}.descricao.txt`), "descricao.txt"],
  [join(RAIZ, "out", `${id}.publicacao.json`), "publicacao.json"],
  [join(RAIZ, "out", `${id}.capa.jpg`), "capa.jpg"],
  [join(RAIZ, "out/capas", `${id}.json`), "capas.json"],
  [join(RAIZ, "out/revisao", `${id}.json`), "revisao.json"],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) => [join(RAIZ, "out/revisao", `${id}-${k}.jpg`), `revisao-${k}.jpg`]),
  ...["impacto", "dividido", "objeto"].map((l) => [join(RAIZ, "out/capas", `${id}-${l}.jpg`), `capa-${l}.jpg`]),
  [join(RAIZ, "public/videos", id), "midia"],
];
const tamanho = (p) => {
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  return st.isDirectory() ? readdirSync(p).reduce((t, f) => t + tamanho(join(p, f)), 0) : st.size;
};
// Short vertical a partir de um corte do vídeo longo: gancho próprio + as cenas do trecho + CTA para o vídeo completo.
// A mídia é copiada para a pasta do Short (continua a funcionar se o longo for para a lixeira); o Manim volta a
// renderizar na vertical e a narração é refeita no render.
function criarCorte(id, k) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  const corte = r.cortes?.[k];
  if (!corte) throw new Error("Esse corte não existe");
  const novoId = `${id.slice(0, 66)}-short-${k + 1}`;
  if (existsSync(caminhoRoteiro(novoId))) throw new Error("Este Short já foi criado: está na biblioteca");
  const pasta = join(RAIZ, "public/videos", novoId);
  mkdirSync(pasta, { recursive: true });
  const copiar = (m) => {
    if (!m?.arquivo?.startsWith(`videos/${id}/`) || !existsSync(join(RAIZ, "public", m.arquivo))) return m;
    const arquivo = `videos/${novoId}/${basename(m.arquivo)}`;
    copyFileSync(join(RAIZ, "public", m.arquivo), join(RAIZ, "public", arquivo));
    return { ...m, arquivo, ...(m.fonte === "arquivo" && { consulta: arquivo }) };
  };
  const cenas = r.cenas.slice(corte.inicio, corte.fim + 1)
    .filter((c) => !["capitulo", "gancho", "cta"].includes(c.tipo))
    .map(({ audio, duracaoMs, palavras, ...c }) => {
      if (c.tipo === "manim") { const { midia, ...resto } = c; return resto; }
      return c.midia ? { ...c, midia: copiar(c.midia) } : c;
    });
  if (!cenas.length) throw new Error("O corte não tem cenas de conteúdo");
  const hashtags = (r.legenda_post ?? "").match(/#[\p{L}\d_]+/gu) ?? [];
  const short = {
    id: novoId, titulo: corte.titulo, formato: "explicativo", estilo: r.estilo, narracao: r.narracao, voz: r.voz, velocidade: r.velocidade,
    musica: r.musica ?? "auto", destaques: r.destaques ?? [], mercado: r.mercado, duracao_alvo: "medio", pesquisa: r.pesquisa ?? [],
    canal: r.canal, ...(r.marcaDagua === false && { marcaDagua: false }),
    precos_usados: r.precos_usados ?? [], thumbnail: corte.gancho?.texto_tela ?? "",
    legenda_post: [`${corte.titulo}. O vídeo completo está no canal.`, hashtags.slice(0, 5).join(" ")].filter(Boolean).join(" "),
    origem: { longo: id, corte: k },
    cenas: [
      { tipo: "gancho", texto_tela: corte.gancho?.texto_tela ?? corte.titulo.toUpperCase(), fala: corte.gancho?.fala ?? "", midia: cenas.find((c) => c.midia?.arquivo)?.midia },
      ...cenas,
      { tipo: "cta", texto_tela: "VÍDEO COMPLETO NO CANAL", acao: "seguir", botao: "VER O VÍDEO COMPLETO", fala: "O vídeo completo, com todos os detalhes, tá no canal. [pausa] Corre lá." },
    ],
  };
  writeFileSync(caminhoRoteiro(novoId), JSON.stringify(short, null, 2));
  return novoId;
}

// move um ficheiro ou pasta; entre discos diferentes (out/ e public/videos no A:, roteiros no C:) o rename dá EXDEV:
// copia e só depois apaga o original
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function mover(de, para) {
  libertar(de);
  for (let tentativa = 0; ; tentativa++) {
    try { return renameSync(de, para); }
    catch (e) {
      // pasta presa no Windows: tenta de novo algumas vezes; se continuar, copia e apaga (o rm também insiste)
      const preso = ["EPERM", "EBUSY", "EACCES"].includes(e.code);
      if (preso && tentativa < 6) { esperar(250); continue; }
      if (e.code !== "EXDEV" && !preso) throw e;
      cpSync(de, para, { recursive: true });
      try { rmSync(de, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); }
      catch (e2) {
        // não deu para apagar o original: desfaz a cópia para não ficar o vídeo em dois sítios
        rmSync(para, { recursive: true, force: true });
        throw new Error(`O Windows não deixou mover ${basename(de)}: algum programa tem um ficheiro dele aberto (feche o vídeo noutros programas e tente de novo)`);
      }
      return;
    }
  }
}
// move todas as peças; se uma falhar, as que já foram voltam ao sítio (nunca fica um vídeo meio apagado)
function moverPecas(pares) {
  const feitos = [];
  try {
    for (const [de, para] of pares) { mover(de, para); feitos.push([de, para]); }
  } catch (e) {
    for (const [de, para] of feitos.reverse()) { try { mover(para, de); } catch { /* fica onde está */ } }
    throw e;
  }
}
function moverParaLixeira(id) {
  const destino = join(LIXEIRA, id);
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  // uma entrada antiga da lixeira com o mesmo nome só é limpa quando o vídeo está inteiro na biblioteca (lido acima)
  if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  moverPecas(PECAS(id).filter(([de]) => existsSync(de)).map(([de, para]) => [de, join(destino, para)]));
  writeFileSync(join(destino, "info.json"), JSON.stringify({ id, titulo: r.titulo, estilo: r.estilo, apagadoEm: Date.now() }));
}
function restaurarDaLixeira(id) {
  const origem = join(LIXEIRA, id);
  if (existsSync(caminhoRoteiro(id))) throw new Error("Já existe um vídeo com este nome na biblioteca");
  moverPecas(PECAS(id).filter(([, para]) => existsSync(join(origem, para))).map(([de, para]) => [join(origem, para), de]));
  rmSync(origem, { recursive: true, force: true });
}
const listarLixeira = () =>
  existsSync(LIXEIRA)
    ? readdirSync(LIXEIRA).filter((id) => ID_VALIDO.test(id) && existsSync(join(LIXEIRA, id, "info.json"))).map((id) => {
      const info = JSON.parse(readFileSync(join(LIXEIRA, id, "info.json"), "utf-8"));
      return { ...info, temVideo: existsSync(join(LIXEIRA, id, "video.mp4")), tamanhoMB: Math.round(tamanho(join(LIXEIRA, id)) / 2 ** 20 * 10) / 10 };
    }).sort((a, b) => b.apagadoEm - a.apagadoEm)
    : [];
const ocupado = (id) => [...jobs.values()].some((j) => j.videoId === id && !["pronto", "erro", "aguardando revisao"].includes(j.estado));

const listarVideos = () =>
  readdirSync(join(RAIZ, "roteiros")).filter((f) => f.endsWith(".json")).map((f) => {
    const id = f.slice(0, -5);
    const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
    const mp4 = join(RAIZ, "out", `${id}.mp4`);
    const existe = existsSync(mp4);
    const props = join(RAIZ, "out", `${id}.props.json`);
    const usada = existe && existsSync(props) ? JSON.parse(readFileSync(props, "utf-8")).manifest?.musica : undefined;
    const faixa = usada && listarMusicas(RAIZ).find((m) => m.arquivo === usada);
    return {
      id, titulo: r.titulo, estilo: r.estilo ?? "neon", narracao: r.narracao ?? "edge",
      musica: faixa ? { nome: faixa.nome, artista: faixa.artista, credito: faixa.credito } : null,
      // no vídeo longo, a descrição já vem com os capítulos (escrita no render)
      thumbnail: r.thumbnail ?? "", legendaPost: existsSync(join(RAIZ, "out", `${id}.descricao.txt`)) ? readFileSync(join(RAIZ, "out", `${id}.descricao.txt`), "utf-8").trim() : r.legenda_post ?? "",
      formato: r.formato ?? "", cortes: (r.cortes ?? []).map((c) => c.titulo),
      video: existe ? `/out/${id}.mp4?v=${statSync(mp4).mtimeMs}` : null,
      capa: existsSync(join(RAIZ, "out", `${id}.capa.jpg`)) ? `/out/${id}.capa.jpg?v=${statSync(join(RAIZ, "out", `${id}.capa.jpg`)).mtimeMs}` : null,
      atualizado: (existe ? statSync(mp4) : statSync(caminhoRoteiro(id))).mtimeMs,
    };
  }).sort((a, b) => b.atualizado - a.atualizado);

// YouTube e modo automático (desligado até o criador o ativar no painel)
const youtube = criarYouTube({ raiz: RAIZ, lerEnv, porta: PORTA });
// Instagram (API oficial da Meta): contas ligadas, publicar Reels, agenda e números
const instagram = criarInstagram({ raiz: RAIZ, lerEnv, porta: PORTA });
const ID_VIDEO = /^[a-z0-9-]{1,80}$/;
const ID_META = /^\d{5,30}$/;
const ID_COMENTARIO = /^[\w-]{5,60}$/;
const cortes = criarCortes({ raiz: RAIZ, claudeJSON, guardarProcesso });
const automatico = criarAutomatico({
  raiz: RAIZ, canais, youtube,
  gerarIdeias, correrJob,
  criarJob: (d) => criarJobNovo(d),
  gerarPublicacao,
  lerPublicacao: (id) => (existsSync(ficheiroPublicacao(id)) ? JSON.parse(readFileSync(ficheiroPublicacao(id), "utf-8")) : null),
  lerRoteiro: (id) => JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8")),
});

// Proteção do painel contra outros sites abertos no mesmo browser:
// - Host tem de ser localhost/127.0.0.1 (trava o "DNS rebinding", em que um site se faz passar por localhost);
// - pedidos que mudam coisas (POST/PUT/DELETE) só do próprio painel: Origin igual, ou sem Origin, e o cabeçalho
//   X-Painel, que um site estranho não consegue enviar sem uma pré-verificação CORS que este servidor nunca aprova.
const HOST_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const ORIGENS = new Set([`http://localhost:${PORTA}`, `http://127.0.0.1:${PORTA}`]);
const pedidoSeguro = (req) => {
  if (!HOST_LOCAL.test(req.headers.host ?? "")) return false;
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origem = req.headers.origin;
  if (origem && !ORIGENS.has(origem)) return false;
  return req.headers["x-painel"] === "1";
};

const rotas = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const [, a, b, c] = url.pathname.split("/");
  if (!pedidoSeguro(req)) return json(res, 403, { erro: "Pedido recusado: só o próprio painel pode fazer isto" });

  // a Google volta aqui depois de o criador autorizar o canal do YouTube
  if (req.method === "GET" && url.pathname === "/oauth/youtube") {
    const pagina = (titulo, texto) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(`<!doctype html><meta charset="utf-8"><title>${titulo}</title><body style="font-family:system-ui;background:#0f1115;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:460px;text-align:center"><h2>${titulo}</h2><p>${texto}</p><p style="opacity:.6">Pode fechar esta janela e voltar ao painel.</p></div>`); };
    if (url.searchParams.get("error")) return pagina("Conexão cancelada", "A Google não deu autorização.");
    try {
      const r = await youtube.concluir(url.searchParams.get("code"), url.searchParams.get("state"));
      return pagina("YouTube conectado", `O canal do estúdio <b>${r.canal}</b> publica agora em <b>${r.titulo.replace(/[<>&]/g, "")}</b>.`);
    } catch (e) { return pagina("Não foi possível conectar", e.message.replace(/[<>&]/g, "")); }
  }
  // o Facebook volta aqui depois de o criador autorizar as páginas com Instagram
  if (req.method === "GET" && url.pathname === "/oauth/instagram") {
    const limpo = (x) => String(x ?? "").replace(/[<>&]/g, "");
    const pagina = (titulo, texto) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(`<!doctype html><meta charset="utf-8"><title>${titulo}</title><body style="font-family:system-ui;background:#0f1115;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:460px;text-align:center"><h2>${titulo}</h2><p>${texto}</p><p style="opacity:.6">Pode fechar esta janela e voltar ao painel.</p></div>`); };
    if (url.searchParams.get("error")) return pagina("Conexão cancelada", limpo(url.searchParams.get("error_description") || "O Facebook não deu autorização."));
    try {
      const r = await instagram.concluir(url.searchParams.get("code"), url.searchParams.get("state"));
      return pagina("Instagram conectado", `Contas ligadas ao estúdio: <b>${limpo(r.contas.join(", "))}</b>.`);
    } catch (e) { return pagina("Não foi possível conectar", limpo(e.message)); }
  }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return createReadStream(join(RAIZ, "server/painel.html")).pipe(res);
  }
  // estilos e lógica do painel (ficheiros à parte; no-cache = o browser confirma se mudaram, sem descarregar de novo)
  if (req.method === "GET" && (url.pathname === "/painel.css" || url.pathname === "/painel.js" || url.pathname === "/edicao.js" || url.pathname === "/instagram.js")) {
    res.writeHead(200, { "Content-Type": url.pathname.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8", "Cache-Control": "no-cache" });
    return createReadStream(join(RAIZ, "server", url.pathname.slice(1))).pipe(res);
  }
  if (req.method === "GET" && a === "lixeira" && ID_VALIDO.test(b ?? "") && c === "video.mp4") {
    const f = join(LIXEIRA, b, "video.mp4");
    return existsSync(f) ? enviarVideo(req, res, f) : json(res, 404, { erro: "não existe" });
  }
  if (req.method === "GET" && a === "out" && b?.endsWith(".mp4") && ID_VALIDO.test(b.slice(0, -4))) {
    const f = join(RAIZ, "out", b);
    return existsSync(f) ? enviarVideo(req, res, f) : json(res, 404, { erro: "não existe" });
  }
  // pré-visualização de uma cena no editor (scripts/previa_cena.mjs)
  if (req.method === "GET" && a === "out" && b === "previa" && /^[a-z0-9-]{1,80}-\d{1,3}\.jpg$/.test(c ?? "")) {
    const f = join(RAIZ, "out/previa", c);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
    return enviarFicheiro(f, res);
  }
  if (req.method === "GET" && a === "out" && b === "revisao" && /^[a-z0-9-]{1,80}-\d\.jpg$/.test(c ?? "")) {
    const f = join(RAIZ, "out/revisao", c);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
    return enviarFicheiro(f, res);
  }
  // análise da referência de um estilo aprendido: o storyboard e o relatório do rea-video
  if (req.method === "GET" && a === "out" && b === "estilos-ref" && /^[a-z0-9-]{1,40}$/.test(c ?? "") && ["storyboard.jpg", "relatorio.html"].includes(url.pathname.split("/").pop())) {
    const f = join(RAIZ, "out/estilos-ref", c, url.pathname.split("/").pop());
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": f.endsWith(".jpg") ? "image/jpeg" : "text/html; charset=utf-8" });
    return enviarFicheiro(f, res);
  }
  // capas: a escolhida (out/<id>.capa.jpg) e as variantes (out/capas/<id>-<layout>.jpg)
  if (req.method === "GET" && a === "out" && (/^[a-z0-9-]{1,80}\.capa\.jpg$/.test(b ?? "") || (b === "capas" && /^[a-z0-9-]{1,80}-(impacto|dividido|objeto)\.jpg$/.test(c ?? "")))) {
    const f = b === "capas" ? join(RAIZ, "out/capas", c) : join(RAIZ, "out", b);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
    return enviarFicheiro(f, res);
  }
  // miniaturas dos estilos e ícones (SVG do Lucide) usados pelo painel
  // o player ao vivo do editor manual (scripts/build_editor.mjs)
  if (req.method === "GET" && a === "editor" && b === "player.js") {
    compilarPlayerEditor();
    const f = join(RAIZ, "server/editor/player.js");
    if (!existsSync(f)) return json(res, 404, { erro: "o player do editor ainda não foi compilado (node scripts/build_editor.mjs)" });
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" });
    return enviarFicheiro(f, res);
  }
  if (req.method === "GET" && (a === "miniaturas" || a === "icones") && /^[\w-]+\.(jpg|svg)$/.test(b ?? "")) {
    const f = a === "miniaturas" ? join(RAIZ, "server/miniaturas", b) : join(RAIZ, "node_modules/lucide-static/icons", b);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": b.endsWith(".svg") ? "image/svg+xml" : "image/jpeg", "Cache-Control": b.endsWith(".svg") ? "max-age=86400" : "no-cache" }); // miniaturas mudam quando se regeneram os estilos
    return enviarFicheiro(f, res);
  }
  if (req.method === "GET" && a === "public") {
    const rel = decodeURIComponent(url.pathname.slice("/public/".length));
    const f = resolve(RAIZ, "public", rel);
    if (!f.startsWith(resolve(RAIZ, "public")) || !existsSync(f) || !statSync(f).isFile()) return json(res, 404, { erro: "não existe" });
    if (/\.(mp4|webm)$/i.test(f)) return enviarVideo(req, res, f);
    const tipos = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
      // o player ao vivo do editor também pede modelos 3D, texturas e fontes
      glb: "model/gltf-binary", gltf: "model/gltf+json", bin: "application/octet-stream", json: "application/json", ktx2: "image/ktx2", hdr: "application/octet-stream",
      ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
    };
    const tipo = tipos[f.split(".").pop().toLowerCase()] ?? "application/octet-stream";
    if (tipo.startsWith("audio/")) return enviarVideo(req, res, f, tipo);
    res.writeHead(200, { "Content-Type": tipo });
    return enviarFicheiro(f, res);
  }
  if (a !== "api") return json(res, 404, { erro: "rota desconhecida" });

  // ---------- custos (menu Custos): o que cada vídeo e cada etapa gastou ----------
  // o plano do Claude (para comparar o gasto com a mensalidade): fica no .env
  if (b === "custos" && c === "plano" && req.method === "POST") {
    const d = await corpo(req);
    if (!["pro", "max5", "max20", "api", ""].includes(d.plano)) return json(res, 400, { erro: "Plano inválido" });
    gravarEnv({ CLAUDE_PLANO: d.plano });
    return json(res, 200, { plano: d.plano });
  }
  if (b === "custos" && req.method === "GET") {
    const linhas = lerCustos(RAIZ);
    const agora = Date.now(), dia = 86400e3;
    const periodo = (ms) => {
      const l = linhas.filter((x) => agora - Date.parse(x.em) <= ms);
      const claude = l.filter((x) => x.servico === "claude");
      return {
        usd: claude.reduce((t, x) => t + (x.custoUSD || 0), 0),
        chamadas: claude.length,
        tokens: claude.reduce((t, x) => t + (x.tokens?.entrada || 0) + (x.tokens?.saida || 0) + (x.tokens?.cacheLeitura || 0) + (x.tokens?.cacheEscrita || 0), 0),
        caracteres: l.filter((x) => x.servico === "elevenlabs").reduce((t, x) => t + (x.caracteres || 0), 0),
        externos: l.filter((x) => x.servico === "ia-externa").length,
      };
    };
    const juntar = (chave) => {
      const m = new Map();
      for (const x of linhas) {
        const k = x[chave]; if (!k) continue;
        const a = m.get(k) ?? { chave: k, usd: 0, chamadas: 0, caracteres: 0, externos: 0, ultimo: x.em };
        if (x.servico === "claude") { a.usd += x.custoUSD || 0; a.chamadas++; }
        if (x.servico === "elevenlabs") a.caracteres += x.caracteres || 0;
        if (x.servico === "ia-externa") a.externos++;
        if (x.em > a.ultimo) a.ultimo = x.em;
        m.set(k, a);
      }
      return [...m.values()];
    };
    const titulo = (id) => { try { return JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8")).titulo || id; } catch { return id; } };
    let eleven = null;
    const chave = chaveEleven();
    if (chave) {
      const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": chave } }).catch(() => null);
      if (r?.ok) { const s = await r.json(); eleven = { plano: s.tier, usados: s.character_count, limite: s.character_limit, renova: s.next_character_count_reset_unix ? s.next_character_count_reset_unix * 1000 : null }; }
    }
    return json(res, 200, {
      hoje: periodo(dia), semana: periodo(7 * dia), mes: periodo(30 * dia), total: periodo(Infinity),
      porEtapa: juntar("etapa").sort((a, b) => b.usd - a.usd || b.externos - a.externos),
      porVideo: juntar("video").sort((a, b) => (b.ultimo > a.ultimo ? 1 : -1)).slice(0, 40).map((v) => ({ ...v, titulo: titulo(v.chave) })),
      recentes: linhas.slice(-40).reverse().map((x) => ({ ...x, titulo: x.video ? titulo(x.video) : undefined })),
      eleven, modo: modoIA(RAIZ), claude: { plano: process.env.CLAUDE_PLANO || lerEnv().CLAUDE_PLANO || "", token: Boolean(tokenClaude()) },
    });
  }

  // ---------- canais (marca d'água: nome, @, logo e nicho) ----------
  if (b === "canais" && c === "logo" && req.method === "POST") {
    // a logo chega em bruto; fica um rascunho em public/marca até o canal ser guardado
    const ext = (url.searchParams.get("nome") ?? "").toLowerCase().match(/\.(png|jpg|jpeg|webp)$/)?.[1];
    if (!ext) return json(res, 400, { erro: "A logo tem de ser PNG, JPG ou WEBP" });
    mkdirSync(join(RAIZ, "public/marca"), { recursive: true });
    const marca = Date.now().toString(36);
    const bruto = join(RAIZ, "out", `logo-${marca}.${ext}`);
    mkdirSync(join(RAIZ, "out"), { recursive: true });
    await pipeline(req, createWriteStream(bruto));
    const destino = `marca/rascunho-${marca}.png`;
    const saida = { log: [] };
    try {
      await correrScript(saida, ["scripts/preparar_logo.py", bruto, join(RAIZ, "public", destino), ...(url.searchParams.get("fundo") === "remover" ? ["--remover-fundo"] : [])]);
    } catch { return json(res, 400, { erro: "Não consegui ler a imagem da logo" }); } finally { rmSync(bruto, { force: true }); }
    return json(res, 200, { logo: destino, ...JSON.parse(saida.log.at(-1) ?? "{}") });
  }
  if (b === "canais" && !c && req.method === "POST") {
    const d = await corpo(req);
    const todos = canais();
    const nome = String(d.nome ?? "").trim().slice(0, 60);
    let arroba = String(d.arroba ?? "").trim().replace(/\s+/g, "").slice(0, 40);
    if (!nome) return json(res, 400, { erro: "Dê um nome ao canal" });
    if (!arroba) return json(res, 400, { erro: "Falta o @ do canal" });
    if (!arroba.startsWith("@")) arroba = `@${arroba}`;
    // id: o que já tinha (edição) ou a partir do @
    let id = todos[d.id] ? d.id : slug(arroba.slice(1)) || slug(nome) || "canal";
    if (!todos[d.id]) { const base = id; for (let k = 2; todos[id]; k++) id = `${base}-${k}`; }
    const antigo = todos[id] ?? {};
    let logo = antigo.logo, redonda = antigo.redonda;
    if (typeof d.logo === "string" && /^marca\/rascunho-[a-z0-9]+\.png$/.test(d.logo) && existsSync(join(RAIZ, "public", d.logo))) {
      redonda = Boolean(d.redonda) || undefined;
      // o rascunho passa a ser a logo do canal (nome novo a cada troca: o render não usa uma versão em cache)
      logo = `marca/${id}-${Date.now().toString(36)}.png`;
      renameSync(join(RAIZ, "public", d.logo), join(RAIZ, "public", logo));
      if (antigo.logo && /^marca\/[a-z0-9-]+-[a-z0-9]+\.png$/.test(antigo.logo)) rmSync(join(RAIZ, "public", antigo.logo), { force: true });
    }
    if (!logo) return json(res, 400, { erro: "Envie a logo do canal" });
    todos[id] = {
      ...antigo, nome, arroba, logo,
      pixelado: Boolean(d.pixelado) || undefined,
      redonda, // logo opaca (fundo que não saiu): recortada em círculo na marca d'água
      nicho: String(d.nicho ?? "").trim().slice(0, 600) || undefined,
      categoriaYoutube: Number(d.categoriaYoutube) || antigo.categoriaYoutube || 22,
    };
    gravarCanais(todos);
    return json(res, 200, { id, canais: todos });
  }
  if (b === "canais" && c && req.method === "DELETE") {
    const todos = canais();
    if (!todos[c]) return json(res, 404, { erro: "Esse canal não existe" });
    if (Object.keys(todos).length === 1) return json(res, 400, { erro: "Tem de ficar pelo menos um canal" });
    delete todos[c];
    gravarCanais(todos);
    return json(res, 200, { canais: todos });
  }

  if (b === "upload" && req.method === "POST") {
    // corpo = ficheiro em bruto; nome vem na query
    const original = (url.searchParams.get("nome") ?? "ficheiro").toLowerCase();
    const clima = url.searchParams.get("clima");
    if (url.searchParams.get("voz")) {
      // amostra de voz para o Chatterbox clonar (10 a 30 s de fala limpa)
      const ext = original.match(/\.(mp3|wav|m4a|ogg|flac)$/)?.[1];
      if (!ext) return json(res, 400, { erro: "formato de áudio não suportado (mp3, wav, m4a, ogg, flac)" });
      mkdirSync(join(RAIZ, "public/vozes"), { recursive: true });
      const nome = `${slug(url.searchParams.get("voz")) || "voz"}.${ext}`;
      await pipeline(req, createWriteStream(join(RAIZ, "public/vozes", nome)));
      return json(res, 200, { caminho: `vozes/${nome}`, vozes: vozesChatterbox() });
    }
    if (url.searchParams.get("gameplay")) {
      // clipe de gameplay para a biblioteca (metade de baixo do layout rosto + gameplay)
      const ext = original.match(/\.(mp4|mov|webm|mkv)$/)?.[1];
      if (!ext) return json(res, 400, { erro: "formato de vídeo não suportado (mp4, mov, webm, mkv)" });
      mkdirSync(PASTA_GAMEPLAY, { recursive: true });
      const nome = `${slug(original.replace(/\.\w+$/, "")) || "gameplay"}-${Date.now().toString(36)}.${ext}`;
      const bruto = join(PASTA_GAMEPLAY, `.bruto-${nome}`);
      await pipeline(req, createWriteStream(bruto));
      // o cartão de baixo tem ~1000x850 px: converte para 720p a 30 fps, sem som (≈10x mais leve). Cada render lê o
      // ficheiro inteiro para o Temp, por isso uma gameplay de 450 MB pesava 450 MB por vídeo. Corre em segundo plano.
      const final = join(PASTA_GAMEPLAY, nome.replace(/\.\w+$/, ".mp4"));
      const aspas = (x) => `"${x}"`;
      const conv = spawn("npx", ["remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", aspas(bruto), "-vf", aspas("scale=-2:720"), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-an", aspas(`${final}.tmp.mp4`)], { shell: true, stdio: "ignore" });
      conv.on("close", (code) => {
        try {
          if (code === 0) { renameSync(`${final}.tmp.mp4`, final); rmSync(bruto, { force: true }); }
          else renameSync(bruto, final); // não converteu: fica o original
        } catch { /* fica para a próxima */ }
      });
      return json(res, 200, { caminho: `gameplay/${basename(final)}`, gameplays: gameplays(), aConverter: true });
    }
    if (clima) {
      // faixa de música para a biblioteca
      if (!CLIMAS[clima]) return json(res, 400, { erro: "clima desconhecido" });
      const ext = original.match(/\.(mp3|wav|m4a|ogg)$/)?.[1];
      if (!ext) return json(res, 400, { erro: "formato de áudio não suportado (mp3, wav, m4a, ogg)" });
      mkdirSync(join(RAIZ, "public/musicas", clima), { recursive: true });
      const nome = `${slug(original.replace(/\.\w+$/, "")) || "faixa"}.${ext}`;
      await pipeline(req, createWriteStream(join(RAIZ, "public/musicas", clima, nome)));
      return json(res, 200, { caminho: `musicas/${clima}/${nome}` });
    }
    const ext = original.match(/\.(mp4|mov|webm|mkv|jpg|jpeg|png|webp|glb)$/)?.[1];
    if (!ext) return json(res, 400, { erro: "formato não suportado (mp4, mov, webm, mkv, jpg, png, webp, glb)" });
    mkdirSync(join(RAIZ, "public/uploads"), { recursive: true });
    const nome = `${slug(original.replace(/\.\w+$/, "")) || "ficheiro"}-${Date.now().toString(36)}.${ext}`;
    await pipeline(req, createWriteStream(join(RAIZ, "public/uploads", nome)));
    return json(res, 200, { caminho: `uploads/${nome}` });
  }

  if (req.method === "GET" && b === "opcoes")
    return json(res, 200, { estilos: estilos(), canais: canais(), vozesEdge: VOZES_EDGE, temElevenLabs: Boolean(process.env.ELEVENLABS_API_KEY || lerEnv().ELEVENLABS_API_KEY), temPixabay: Boolean(process.env.PIXABAY_API_KEY || lerEnv().PIXABAY_API_KEY), temSketchfab: Boolean(process.env.SKETCHFAB_API_TOKEN || lerEnv().SKETCHFAB_API_TOKEN), temGoogle: youtube.configurado(), temMeta: instagram.configurado(), temClaudeToken: Boolean(tokenClaude()), temChatterbox: existsSync(join(RAIZ, ".venv-voz/Scripts/python.exe")), temRea: reaDisponivel(), opcoesEstilo: OPCOES_ESTILO, comEfeitos: readdirSync(PASTA_MODULOS).filter((f) => /^[a-z0-9-]+\.tsx$/.test(f)).map((f) => f.slice(0, -4)), vozesChatterbox: vozesChatterbox() });

  if (b === "chaves" && req.method === "POST") {
    const d = await corpo(req);
    const novas = {};
    for (const nome of ["ELEVENLABS_API_KEY", "PIXABAY_API_KEY", "SKETCHFAB_API_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "META_APP_ID", "META_APP_SECRET", "CLAUDE_CODE_OAUTH_TOKEN"]) {
      if (!d[nome]) continue;
      if (/\s/.test(d[nome])) return json(res, 400, { erro: `${nome} inválida` });
      novas[nome] = d[nome];
    }
    gravarEnv(novas);
    return json(res, 200, { ok: true });
  }
  if (b === "elevenlabs" && c === "vozes" && req.method === "GET") {
    const chave = chaveEleven();
    if (!chave) return json(res, 400, { erro: "Sem chave ElevenLabs" });
    // as vozes da conta + as vozes em português da biblioteca partilhada (Brasil e Portugal)
    const [minhas, partilhadas] = await Promise.all([
      fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": chave } }),
      fetch("https://api.elevenlabs.io/v1/shared-voices?language=pt&page_size=100&sort=usage_character_count_1y", { headers: { "xi-api-key": chave } }),
    ]);
    if (!minhas.ok) return json(res, minhas.status, { erro: `ElevenLabs respondeu ${minhas.status}` });
    const gratis = ehGratis(await planoEleven(true));
    const conta = (await minhas.json()).voices.map((v) => {
      const daBiblioteca = v.category === "professional" || Boolean(v.sharing?.original_voice_id);
      return {
        id: v.voice_id, nome: v.name.split(" - ")[0], descricao: v.name.split(" - ")[1] ?? "", preview: v.preview_url,
        // vozes de fábrica com português verificado funcionam no plano grátis
        grupo: falaPortugues(v) && !daBiblioteca ? "Falam português" : "As suas vozes",
        detalhe: [v.labels?.gender === "female" ? "feminina" : v.labels?.gender === "male" ? "masculina" : v.labels?.gender, daBiblioteca ? "biblioteca" : v.labels?.accent && `sotaque ${{ american: "americano", british: "britânico", australian: "australiano", brazilian: "brasileiro" }[v.labels.accent] ?? v.labels.accent}`].filter(Boolean).join(", "),
        bloqueada: gratis && daBiblioteca,
      };
    });
    const naConta = new Set(conta.map((v) => v.id));
    const biblioteca = partilhadas.ok
      ? (await partilhadas.json()).voices.filter((v) => v.free_users_allowed !== false && !naConta.has(v.voice_id)).map((v) => ({
        // "dono:voz" = ainda não está na conta; é adicionada quando for usada
        id: `${v.public_owner_id}:${v.voice_id}`, nome: v.name.split(" - ")[0], descricao: v.name.split(" - ")[1] ?? v.descriptive ?? "",
        grupo: v.locale === "pt-PT" ? "Português (Portugal)" : "Português (Brasil)", preview: v.preview_url, bloqueada: gratis,
        detalhe: [v.gender === "female" ? "feminina" : v.gender === "male" ? "masculina" : v.gender, { young: "jovem", middle_aged: "meia-idade", old: "madura" }[v.age] ?? v.age].filter(Boolean).join(", "),
      }))
      : [];
    return json(res, 200, { plano: gratis ? "grátis" : "pago", vozes: [...conta.filter((v) => v.grupo === "Falam português"), ...biblioteca, ...conta.filter((v) => v.grupo !== "Falam português")] });
  }

  // pesquisa visual de modelos 3D (só licenças com uso comercial; a pesquisa não precisa de token)
  if (b === "sketchfab" && c === "busca" && req.method === "GET") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return json(res, 400, { erro: "Escreva o que procura" });
    const saida = { log: [] };
    try {
      await correrScript(saida, ["scripts/buscar_midia.py", "--sketchfab", q]);
      return json(res, 200, JSON.parse(saida.log.at(-1) ?? "[]"));
    } catch {
      return json(res, 502, { erro: "O Sketchfab não respondeu" });
    }
  }

  // cortes automáticos de um vídeo longo: analisar (tarefa em segundo plano), ver o último resultado, produzir os escolhidos
  if (b === "cortes" && !c && req.method === "POST") {
    const d = await corpo(req);
    return json(res, 202, novaTarefa("cortes", (t) => cortes.analisar(t, d)));
  }
  // ---------- vídeos enviados e baixados (public/uploads): ver o espaço e apagar ----------
  if (b === "uploads" && req.method === "GET") return json(res, 200, listarUploads());
  if (b === "uploads" && req.method === "DELETE") {
    const d = await corpo(req);
    const lista = listarUploads();
    const pedidos = (d.arquivos ?? []).filter((a) => /^uploads\/[\w.-]+$/.test(a));
    const emUso = pedidos.filter((a) => lista.find((x) => x.arquivo === a)?.emUso);
    if (emUso.length) return json(res, 409, { erro: `${emUso.length === 1 ? "Este vídeo está" : `${emUso.length} vídeos estão`} a ser usado(s) por um vídeo da biblioteca. Apague ou produza esse vídeo primeiro.` });
    let libertado = 0;
    for (const a of pedidos) {
      const f = join(RAIZ, "public", a);
      if (!existsSync(f)) continue;
      libertado += statSync(f).size;
      rmSync(f, { force: true });
      rmSync(f.replace(/\.\w+$/, ".json"), { force: true });
    }
    return json(res, 200, { apagados: pedidos.length, libertadoMB: Math.round(libertado / 2 ** 20) });
  }
  // modelos realistas do Poly Haven já no projeto (para escolher o objeto de uma frase de efeito)
  if (b === "polyhaven" && req.method === "GET") {
    const f = join(RAIZ, "src/lowpoly/polyhaven.json");
    const cat = existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : {};
    return json(res, 200, Object.entries(cat).filter(([, m]) => existsSync(join(RAIZ, "public", m.arquivo))).map(([id, m]) => ({ id, nome: m.nome, categorias: m.categorias })));
  }
  // galeria do campo Objeto: o que cada fonte tem, com miniatura, para ver antes de escolher
  if (b === "objetos" && req.method === "GET") {
    const fonte = url.searchParams.get("fonte") ?? "", q = semAcento(url.searchParams.get("q") ?? "");
    const filtrar = (lista) => (q ? lista.filter((o) => q.split(/\s+/).every((t) => semAcento([o.id, o.nome, ...(o.tags ?? [])].join(" ")).includes(t))) : lista);
    if (fonte === "polyhaven") {
      const f = join(RAIZ, "src/lowpoly/polyhaven.json"), cat = existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : {};
      return json(res, 200, filtrar(Object.entries(cat).filter(([, m]) => existsSync(join(RAIZ, "public", m.arquivo)))
        .map(([id, m]) => ({ id, nome: m.nome, tags: [...(m.categorias ?? []), ...(m.tags ?? [])], mini: `https://cdn.polyhaven.com/asset_img/thumbs/${encodeURIComponent(id)}.png?width=256&height=256` }))));
    }
    if (fonte === "anatomia") {
      const f = join(RAIZ, "src/lowpoly/anatomia.json"), cat = existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : {};
      return json(res, 200, filtrar(Object.entries(cat).filter(([, m]) => existsSync(join(RAIZ, "public", m.arquivo)))
        .map(([id, m]) => ({ id, nome: m.nome, tags: m.tags, mini: existsSync(join(RAIZ, "public/modelos3d/miniaturas", `anatomia-${id}.jpg`)) ? `/public/modelos3d/miniaturas/anatomia-${id}.jpg` : null }))));
    }
    if (fonte === "emoji") {
      const raiz = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";
      return json(res, 200, filtrar(EMOJIS_GALERIA.map(([id, nome, tom]) => {
        const pasta = encodeURIComponent(id[0].toUpperCase() + id.slice(1)), base = id.replace(/-/g, " ").split(/\s+/).join("_");
        return { id, nome, tags: [id], mini: tom ? `${raiz}/${pasta}/Default/3D/${base}_3d_default.png` : `${raiz}/${pasta}/3D/${base}_3d.png` };
      })));
    }
    if (fonte === "cs2") {
      const f = join(RAIZ, "out/cache/cs2-skins.json");
      if (!existsSync(f)) return json(res, 200, []); // o catálogo vem na primeira troca de um objeto do CS2
      const lista = JSON.parse(readFileSync(f, "utf-8")).map((s) => ({ id: s.name, nome: s.name, tags: [s.weapon?.name, s.category?.name, s.pattern?.name].filter(Boolean), mini: s.image, cor: s.rarity?.color }));
      return json(res, 200, filtrar(lista).slice(0, 120));
    }
    return json(res, 200, []);
  }
  if (b === "baixar-link" && req.method === "POST") {
    const d = await corpo(req);
    if (!lerLink(d.link)) return json(res, 400, { erro: "Cole um link de vídeo do YouTube (youtube.com/watch, youtu.be, shorts) ou do Instagram (reel ou post)" });
    return json(res, 202, novaTarefa("baixar", (t) => baixarLink(t, d.link)));
  }
  if (b === "cortes" && !c && req.method === "GET") return json(res, 200, cortes.guardado(url.searchParams.get("arquivo") ?? "") ?? {});
  if (b === "cortes" && c === "produzir" && req.method === "POST") {
    const d = await corpo(req);
    if (!/^uploads\/[\w.-]+$/.test(d.arquivo ?? "")) return json(res, 400, { erro: "Vídeo inválido" });
    const escolhidos = (d.cortes ?? []).filter((x) => Number.isFinite(x.inicio) && Number.isFinite(x.fim) && x.fim > x.inicio).slice(0, 15);
    if (!escolhidos.length) return json(res, 400, { erro: "Escolha pelo menos um corte" });
    const criados = escolhidos.map((x) => {
      const titulo = String(x.titulo || x.gancho || "Corte").slice(0, 100);
      const videoId = `${slug(titulo) || "corte"}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
      const emojis = Object.fromEntries((x.palavras_chave ?? []).filter((k) => k?.palavra && k?.emoji).map((k) => [k.palavra, k.emoji]));
      writeFileSync(caminhoRoteiro(videoId), JSON.stringify({
        id: videoId, titulo, formato: "clipe", estilo: d.estilo ?? "hormozi", musica: d.musica ?? "auto", ...(Number(d.musicaInicio) > 0 ? { musicaInicio: Math.round(Number(d.musicaInicio) * 10) / 10 } : {}),
        ...(canalDe(d.canal) === "nenhum" ? { marcaDagua: false } : canalDe(d.canal) && { canal: d.canal }),
        destaques: Object.keys(emojis), legenda_post: x.legenda_post, nota: x.nota,
        cenas: [{ tipo: "clipe", bruto: d.arquivo, inicio: x.inicio, fim: x.fim, fala: "", titulo: d.gancho === false ? undefined : x.gancho, cortar: d.cortar !== false, enquadrar: d.enquadrar !== false, exemplos: d.exemplos !== false, gameplay: trechoGameplay(d.gameplay, x.fim - x.inicio, d.gameplayIntercalar === true) }],
      }, null, 2));
      const job = novoJob({ tipo: "render", formato: "clipe", videoId, tema: titulo, estilo: d.estilo, narracao: "clipe" });
      produzir(job);
      return job;
    });
    return json(res, 201, criados);
  }

  // IA externa: pedidos à espera (copiar e colar noutra IA) e o modo
  if (b === "ia-externa" && !c && req.method === "GET") return json(res, 200, { modo: modoIA(RAIZ), pedidos: pedidosPendentes(RAIZ) });
  const pedidoDe = url.pathname.match(/^\/api\/ia-externa\/([a-z0-9]{6,20})\/(resposta|claude)$/);
  if (pedidoDe && req.method === "POST") {
    const [, idPedido, acao] = pedidoDe;
    const base = join(RAIZ, "out/ia-externa", idPedido);
    if (!existsSync(`${base}.json`)) return json(res, 404, { erro: "Esse pedido já não está à espera" });
    if (acao === "claude") { writeFileSync(`${base}.claude`, "1"); return json(res, 200, { ok: true }); }
    const d = await corpo(req);
    let valor;
    try { valor = tirarJSONExterno(d.texto); } catch (e) { return json(res, 400, { erro: e.message }); }
    writeFileSync(`${base}.resposta.json`, JSON.stringify(valor));
    return json(res, 200, { ok: true });
  }
  // gerir os estilos aprendidos: editar (PATCH), refinar com o Claude (POST …/refinar) e apagar (DELETE)
  if (b === "estilos" && /^[a-z0-9-]{1,40}$/.test(c ?? "") && c !== "aprender") {
    const sub = url.pathname.split("/")[4];
    try {
      if (req.method === "PATCH" && !sub) {
        const d = await corpo(req);
        estiloAprendido(c);
        return json(res, 202, novaTarefa("estilo", (t) => editarEstilo(t, c, d)));
      }
      if (req.method === "DELETE" && !sub) return json(res, 200, apagarEstilo(c));
      if (req.method === "POST" && sub === "refinar") {
        const d = await corpo(req);
        estiloAprendido(c);
        if (!String(d.pedido ?? "").trim()) return json(res, 400, { erro: "Diga o que quer mudar no estilo" });
        return json(res, 202, novaTarefa("estilo", (t) => refinarEstilo(t, c, d)));
      }
    } catch (e) { return json(res, 400, { erro: e.message }); }
  }
  if (b === "estilos" && c === "aprender" && req.method === "POST") {
    const d = await corpo(req);
    if (!d.link && !d.arquivo) return json(res, 400, { erro: "Cole um link do YouTube ou do Instagram, ou envie o vídeo" });
    return json(res, 202, novaTarefa("estilo", (t) => aprenderEstilo(t, d)));
  }
  if (b === "ia-modo" && req.method === "POST") {
    const d = await corpo(req);
    gravarEnv({ IA_MODO: d.modo === "externa" ? "externa" : "claude" });
    return json(res, 200, { modo: modoIA(RAIZ) });
  }
  if (b === "gameplay" && !c && req.method === "GET") return json(res, 200, gameplays());
  if (b === "jobs" && req.method === "GET") return json(res, 200, [...jobs.values()].sort((x, y) => y.criado - x.criado));
  if (b === "jobs" && c === "parar-tudo" && req.method === "POST") {
    return json(res, 200, { parados: [...jobs.values()].filter(pararJob).length });
  }
  // tirar da Produção os vídeos que falharam ou foram parados (só o registo: o roteiro e a mídia ficam)
  const ACABADOS = ["erro", "parado", "pronto"];
  if (b === "jobs" && !c && req.method === "DELETE") {
    let n = 0;
    for (const [id, j] of jobs) if (j.estado === "erro" || j.estado === "parado") { jobs.delete(id); n++; }
    return json(res, 200, { removidos: n });
  }
  const removerDe = url.pathname.match(/^\/api\/jobs\/([\w-]{1,40})$/);
  if (removerDe && req.method === "DELETE") {
    const job = jobs.get(removerDe[1]);
    if (!job) return json(res, 200, { removidos: 0 });
    if (!ACABADOS.includes(job.estado)) return json(res, 409, { erro: "Este vídeo ainda está em produção: pare-o primeiro" });
    jobs.delete(job.id);
    return json(res, 200, { removidos: 1 });
  }
  const pararDe = url.pathname.match(/^\/api\/jobs\/([\w-]{1,40})\/parar$/);
  if (pararDe && req.method === "POST") {
    const job = jobs.get(pararDe[1]);
    if (!job) return json(res, 404, { erro: "Esse vídeo já não está na fila" });
    return json(res, 200, { parado: pararJob(job) });
  }
  if (b === "jobs" && req.method === "POST") {
    const d = await corpo(req);
    if (!d.tema?.trim()) return json(res, 400, { erro: "Falta o tema" });
    const videoId = `${slug(d.tema) || "video"}-${Date.now().toString(36).slice(-5)}`;
    if (d.formato === "clipe") {
      // vídeos do próprio criador: não há roteiro para escrever, só cortar, legendar e renderizar
      const arquivos = (d.arquivos ?? []).filter((a) => /^uploads\/[\w.-]+$/.test(a));
      if (!arquivos.length) return json(res, 400, { erro: "Envie pelo menos um vídeo" });
      writeFileSync(caminhoRoteiro(videoId), JSON.stringify({
        id: videoId, titulo: d.tema.trim(), formato: "clipe", estilo: d.estilo ?? "hormozi", musica: d.musica ?? "auto", ...(Number(d.musicaInicio) > 0 ? { musicaInicio: Math.round(Number(d.musicaInicio) * 10) / 10 } : {}),
        ...(canalDe(d.canal) === "nenhum" ? { marcaDagua: false } : canalDe(d.canal) && { canal: d.canal }),
        destaques: (d.destaques ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        cenas: arquivos.map((a) => ({ tipo: "clipe", bruto: a, fala: "", cortar: d.cortar !== false, enquadrar: d.enquadrar !== false, exemplos: d.exemplos === true, gameplay: trechoGameplay(d.gameplay, 60, d.gameplayIntercalar === true) })),
      }, null, 2));
      const job = novoJob({ tipo: "render", formato: "clipe", videoId, tema: d.tema.trim(), estilo: d.estilo, narracao: "clipe" });
      produzir(job);
      return json(res, 201, job);
    }
    if (d.narracao === "elevenlabs") {
      try { d.voz = await prepararVozEleven(d.voz); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    const job = criarJobNovo(d, videoId);
    correrJob(job);
    return json(res, 201, job);
  }

  if (b === "prompt-externo" && req.method === "POST") {
    const d = await corpo(req);
    if (!d.tema?.trim()) return json(res, 400, { erro: "Falta o tema" });
    return json(res, 200, { texto: promptExterno(d) });
  }
  if (b === "importar-roteiro" && req.method === "POST") {
    const d = await corpo(req);
    let r;
    try { r = lerRoteiroExterno(d.texto); } catch (e) { return json(res, 400, { erro: e.message }); }
    if (d.narracao === "elevenlabs") {
      try { d.voz = await prepararVozEleven(d.voz); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    const tema = r.titulo || d.tema || "roteiro";
    const videoId = `${slug(tema) || "video"}-${Date.now().toString(36).slice(-5)}`;
    writeFileSync(caminhoRoteiro(videoId), JSON.stringify({ id: videoId, ...r }, null, 2));
    const job = novoJob({
      tipo: "novo", importado: true, videoId, formato: FORMATOS[d.formato] ? d.formato : "ranking", tema: tema.trim(), estilo: d.estilo ?? "neon",
      narracao: d.narracao ?? "edge", voz: d.voz, pais: d.pais ?? "Brasil (R$)", revisar: true, musica: d.musica ?? "auto", ...(Number(d.musicaInicio) > 0 ? { musicaInicio: Math.round(Number(d.musicaInicio) * 10) / 10 } : {}),
      duracao: duracaoDe(d), editorChefe: false, canal: canalDe(d.canal),
    });
    registar(job, `Roteiro importado de outra IA (${r.cenas.length} cenas)`);
    correrJob(job);
    return json(res, 201, job);
  }
  if (b === "videos" && req.method === "GET") return json(res, 200, listarVideos());
  if (b === "videos" && req.method === "POST" && url.searchParams.get("acao") === "lixeira") {
    const { ids } = await corpo(req);
    const validos = (ids ?? []).filter((id) => ID_VALIDO.test(id) && existsSync(caminhoRoteiro(id)));
    const emProducao = validos.filter(ocupado);
    if (emProducao.length) return json(res, 409, { erro: "Há vídeos ainda em produção; espere que terminem" });
    validos.forEach(moverParaLixeira);
    return json(res, 200, { movidos: validos.length });
  }
  if (b === "lixeira" && req.method === "GET") return json(res, 200, listarLixeira());
  if (b === "precos") {
    const f = join(RAIZ, "dados/precos.json");
    const cat = existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : { produtos: {} };
    if (req.method === "GET") return json(res, 200, cat);
    if (req.method === "PATCH") {
      const d = await corpo(req);
      if (!cat.produtos[d.chave]) return json(res, 404, { erro: "produto não existe" });
      const preco = Number(String(d.preco).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
      if (!(preco > 0)) return json(res, 400, { erro: "preço inválido" });
      Object.assign(cat.produtos[d.chave], { preco, data: new Date().toISOString().slice(0, 10), ...(d.loja && { loja: d.loja }), ...(d.url && { url: d.url }) });
      writeFileSync(f, JSON.stringify(cat, null, 2));
      return json(res, 200, cat.produtos[d.chave]);
    }
    if (req.method === "DELETE" && c) {
      delete cat.produtos[c];
      writeFileSync(f, JSON.stringify(cat, null, 2));
      return json(res, 200, { ok: true });
    }
  }
  if (b === "lixeira" && req.method === "POST" && ID_VALIDO.test(c ?? "")) {
    try { restaurarDaLixeira(c); return json(res, 200, { ok: true }); } catch (e) { return json(res, 409, { erro: e.message }); }
  }
  if (b === "lixeira" && req.method === "DELETE") {
    // um vídeo (c) ou a lixeira toda
    const alvo = c ? [c].filter((id) => ID_VALIDO.test(id)) : listarLixeira().map((v) => v.id);
    const libertado = alvo.reduce((t, id) => t + tamanho(join(LIXEIRA, id)), 0);
    alvo.forEach((id) => rmSync(join(LIXEIRA, id), { recursive: true, force: true }));
    return json(res, 200, { apagados: alvo.length, libertadoMB: Math.round(libertado / 2 ** 20) });
  }
  if (b === "musicas" && req.method === "GET") {
    return json(res, 200, { climas: CLIMAS, faixas: listarMusicas(RAIZ), porEstilo: POR_ESTILO, porFormato: POR_FORMATO });
  }
  // importar faixa (ex.: YouTube Audio Library): analisa, sugere clima, normaliza e cataloga
  if (b === "musicas" && c === "importar" && req.method === "POST") {
    const original = url.searchParams.get("nome") ?? "faixa.mp3";
    if (!/\.(mp3|wav|m4a|ogg)$/i.test(original)) return json(res, 400, { erro: "formato de áudio não suportado (mp3, wav, m4a, ogg)" });
    mkdirSync(join(RAIZ, "out/importar"), { recursive: true });
    const tmp = join(RAIZ, "out/importar", `${Date.now().toString(36)}${original.slice(original.lastIndexOf("."))}`);
    await pipeline(req, createWriteStream(tmp));
    const args = ["scripts/importar_musica.py", tmp, "--nome", original];
    const clima = url.searchParams.get("clima");
    if (CLIMAS[clima]) args.push("--clima", clima);
    if (url.searchParams.get("credito")) args.push("--credito", url.searchParams.get("credito"));
    const saida = { log: [] };
    try {
      await correrScript(saida, args);
      return json(res, 200, JSON.parse(saida.log.at(-1)));
    } catch {
      return json(res, 500, { erro: `Não consegui importar: ${saida.log.slice(-2).join(" ")}` });
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  if (b === "musicas" && (req.method === "PATCH" || req.method === "DELETE")) {
    const d = req.method === "PATCH" ? await corpo(req) : { arquivo: url.searchParams.get("arquivo") };
    const atual = listarMusicas(RAIZ).find((m) => m.arquivo === d.arquivo);
    if (!atual) return json(res, 404, { erro: "faixa não existe" });
    const catalogo = lerCatalogo(RAIZ);
    const info = catalogo[atual.arquivo] ?? {};
    delete catalogo[atual.arquivo];
    if (req.method === "DELETE") {
      rmSync(join(RAIZ, "public", atual.arquivo), { force: true });
      gravarCatalogo(catalogo, RAIZ);
      return json(res, 200, { ok: true });
    }
    let arquivo = atual.arquivo;
    if (d.clima && d.clima !== atual.clima) {
      if (!CLIMAS[d.clima]) return json(res, 400, { erro: "clima desconhecido" });
      // mudar de clima = mudar de pasta
      arquivo = `musicas/${d.clima}/${atual.arquivo.split("/").pop()}`;
      mkdirSync(join(RAIZ, "public/musicas", d.clima), { recursive: true });
      renameSync(join(RAIZ, "public", atual.arquivo), join(RAIZ, "public", arquivo));
    }
    catalogo[arquivo] = { ...info, titulo: d.titulo ?? atual.nome, artista: d.artista ?? atual.artista, credito: d.credito ?? atual.credito, origem: info.origem ?? atual.origem };
    gravarCatalogo(catalogo, RAIZ);
    return json(res, 200, { arquivo });
  }

  // skill youtube: ideias, pacote de publicação, variantes de gancho (tarefas em segundo plano)
  const pararTarefa = url.pathname.match(/^\/api\/tarefas\/([\w-]{1,40})\/parar$/);
  if (pararTarefa && req.method === "POST") {
    const t = tarefas.get(pararTarefa[1]);
    if (!t) return json(res, 404, { erro: "tarefa não existe" });
    if (t.estado === "a correr") Object.assign(t, { cancelado: true, estado: "parado", erro: "Parado por si" });
    matarArvore(t.processo);
    return json(res, 200, { parado: true });
  }
  if (b === "tarefas" && req.method === "GET" && c) {
    const t = tarefas.get(c);
    return t ? json(res, 200, t) : json(res, 404, { erro: "tarefa não existe (o painel foi reiniciado?)" });
  }
  if (b === "automatico" && !c && req.method === "GET") return json(res, 200, { config: automatico.ler(), estado: automatico.estado, youtube: youtube.estado() });
  if (b === "automatico" && !c && req.method === "PUT") return json(res, 200, { config: automatico.atualizarConfig(await corpo(req)) });
  if (b === "automatico" && c === "correr" && req.method === "POST") {
    if (automatico.estado.aCorrer) return json(res, 409, { erro: "O modo automático já está rodando" });
    automatico.correr("manual").catch(() => {});
    return json(res, 202, { ok: true });
  }
  // Insights: GET guardado (+ cruzamento), POST atualizar, POST analisar, GET retenção de um vídeo
  if (b === "insights") {
    const canal = url.searchParams.get("canal");
    if (!canais()[canal]) return json(res, 400, { erro: "Canal desconhecido" });
    if (req.method === "GET" && !c) {
      const d = lerInsights(canal);
      return json(res, 200, { youtube: youtube.estado(), dados: d ? cruzarInsights(d) : null });
    }
    if (req.method === "POST" && c === "atualizar") {
      const dias = [7, 28, 90, 365].includes(Number(url.searchParams.get("dias"))) ? Number(url.searchParams.get("dias")) : 28;
      return json(res, 202, novaTarefa("insights", (t) => atualizarInsights(t, canal, dias)));
    }
    if (req.method === "POST" && c === "analisar") return json(res, 202, novaTarefa("insights", (t) => diagnosticarCanal(t, canal)));
    if (req.method === "GET" && c === "retencao") {
      const video = url.searchParams.get("video") ?? "";
      if (!/^[\w-]{11}$/.test(video)) return json(res, 400, { erro: "Vídeo inválido" });
      try { return json(res, 200, { pontos: await youtube.retencao(canal, video) }); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
  }
  // ---------- Instagram ----------
  if (b === "instagram") {
    const igOk = (x) => ID_META.test(String(x ?? ""));
    if (!c && req.method === "GET") return json(res, 200, { ...instagram.estado(), agenda: instagram.lerAgenda().slice(-60), canais: canais() });
    if (c === "ligar" && req.method === "GET") {
      try { return json(res, 200, { url: instagram.urlLigar() }); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    if (c === "token" && req.method === "POST") {
      const { token } = await corpo(req);
      try { return json(res, 200, await instagram.ligarComToken(String(token ?? "").trim())); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    if (c === "desligar" && req.method === "POST") {
      const { conta } = await corpo(req);
      if (!igOk(conta)) return json(res, 400, { erro: "Conta inválida" });
      instagram.desligar(conta);
      return json(res, 200, { ok: true });
    }
    if (c === "associar" && req.method === "POST") {
      const { conta, canal } = await corpo(req);
      if (!igOk(conta) || (canal && !canais()[canal])) return json(res, 400, { erro: "Conta ou canal inválido" });
      try { instagram.associar(conta, canal); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    // publicar um vídeo da biblioteca: agora (tarefa com progresso) ou agendado (o painel publica à hora marcada)
    if (c === "publicar" && req.method === "POST") {
      const d = await corpo(req);
      if (!igOk(d.conta) || !ID_VIDEO.test(String(d.video ?? ""))) return json(res, 400, { erro: "Conta ou vídeo inválido" });
      const ficheiro = join(RAIZ, "out", `${d.video}.mp4`);
      if (!existsSync(ficheiro)) return json(res, 400, { erro: "Este vídeo ainda não foi renderizado" });
      const legenda = String(d.legenda ?? "").slice(0, 2200);
      const capaMs = Number.isFinite(Number(d.capaMs)) && d.capaMs !== "" && d.capaMs !== null ? Number(d.capaMs) : undefined;
      if (d.quando && new Date(d.quando).getTime() > Date.now() + 60000) {
        try { return json(res, 200, { agendado: instagram.agendar({ igId: d.conta, video: d.video, ficheiro, legenda, capaMs, quando: d.quando }) }); } catch (e) { return json(res, 400, { erro: e.message }); }
      }
      return json(res, 202, novaTarefa("instagram", (t) => instagram.publicarReel({ igId: d.conta, ficheiro, legenda, capaMs, passo: (p) => { t.passo = p; } })));
    }
    if (c === "agenda" && req.method === "DELETE") {
      try { instagram.cancelar(url.searchParams.get("id")); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    if (c === "limite" && req.method === "GET") {
      if (!igOk(url.searchParams.get("conta"))) return json(res, 400, { erro: "Conta inválida" });
      try { return json(res, 200, await instagram.limitePublicacao(url.searchParams.get("conta"))); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    if (c === "dados") {
      const conta = url.searchParams.get("conta");
      if (!igOk(conta)) return json(res, 400, { erro: "Conta inválida" });
      if (req.method === "GET") return json(res, 200, { dados: instagram.lerDados(conta) });
      if (req.method === "POST") return json(res, 202, novaTarefa("instagram", (t) => instagram.atualizarDados(conta, { passo: (p) => { t.passo = p; } })));
    }
    if (c === "comentarios" && req.method === "GET") {
      const conta = url.searchParams.get("conta"), media = url.searchParams.get("media");
      if (!igOk(conta) || !igOk(media)) return json(res, 400, { erro: "Conta ou publicação inválida" });
      try { return json(res, 200, { comentarios: await instagram.comentarios(conta, media) }); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    if (c === "responder" && req.method === "POST") {
      const d = await corpo(req);
      if (!igOk(d.conta) || !ID_COMENTARIO.test(String(d.comentario ?? ""))) return json(res, 400, { erro: "Conta ou comentário inválido" });
      try { return json(res, 200, await instagram.responder(d.conta, d.comentario, d.texto)); } catch (e) { return json(res, 400, { erro: e.message }); }
    }
    return json(res, 404, { erro: "Rota do Instagram desconhecida" });
  }
  if (b === "youtube" && c === "ligar" && req.method === "GET") {
    const canal = url.searchParams.get("canal");
    if (!canais()[canal]) return json(res, 400, { erro: "Canal desconhecido" });
    try { return json(res, 200, { url: youtube.urlLigar(canal) }); } catch (e) { return json(res, 400, { erro: e.message }); }
  }
  if (b === "youtube" && c === "desligar" && req.method === "POST") {
    const { canal } = await corpo(req);
    youtube.desligar(canal);
    return json(res, 200, { ok: true });
  }
  if (b === "ideias" && req.method === "GET") {
    const f = ficheiroIdeias(url.searchParams.get("canal"));
    return json(res, 200, existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : { ideias: [] });
  }
  if (b === "ideias" && req.method === "POST") {
    const d = await corpo(req);
    return json(res, 202, novaTarefa("ideias", (t) => gerarIdeias(t, d)));
  }
  const revisaoDe = url.pathname.match(/^\/api\/roteiros\/([a-z0-9-]{1,80})\/revisao$/);
  if (revisaoDe) {
    const id = revisaoDe[1];
    if (req.method === "GET") return json(res, 200, existsSync(ficheiroRevisao(id)) ? JSON.parse(readFileSync(ficheiroRevisao(id), "utf-8")) : {});
    if (req.method === "POST") {
      if (!existsSync(join(RAIZ, "out", `${id}.mp4`))) return json(res, 400, { erro: "Renderize o vídeo primeiro" });
      return json(res, 202, novaTarefa("revisao", (t) => revisaoVisual(id, (p) => (t.passo = p))));
    }
  }
  // capa (thumbnail): gerar as 3 variantes, ver o estado e escolher uma
  const capaDe = url.pathname.match(/^\/api\/roteiros\/([a-z0-9-]{1,80})\/capa(\/escolher)?$/);
  if (capaDe) {
    const [, id, escolher] = capaDe;
    if (!existsSync(caminhoRoteiro(id))) return json(res, 404, { erro: "roteiro não existe" });
    const info = join(RAIZ, "out/capas", `${id}.json`);
    const ler = () => (existsSync(info) ? JSON.parse(readFileSync(info, "utf-8")) : {});
    if (req.method === "GET") return json(res, 200, ler());
    if (req.method === "POST" && escolher) {
      const { layout } = await corpo(req);
      const f = join(RAIZ, "out/capas", `${id}-${layout}.jpg`);
      if (!["impacto", "dividido", "objeto"].includes(layout) || !existsSync(f)) return json(res, 400, { erro: "essa variante não existe" });
      copyFileSync(f, join(RAIZ, "out", `${id}.capa.jpg`));
      writeFileSync(info, JSON.stringify({ ...ler(), escolhida: layout }, null, 2));
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST") {
      const d = await corpo(req);
      const args = ["scripts/capa.mjs", id];
      if (d.texto?.trim()) args.push("--texto", d.texto.trim().slice(0, 60));
      if (d.destaque?.trim()) args.push("--destaque", d.destaque.trim().slice(0, 30));
      if (Number.isInteger(d.fundo)) args.push("--fundo", String(d.fundo));
      if (["vertical", "horizontal"].includes(d.formato)) args.push("--formato", d.formato);
      return json(res, 202, novaTarefa("capa", (t) => new Promise((ok, falha) => {
        t.passo = "Preparando o estúdio…";
        const p = spawn(process.execPath, args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });
        let ultima = "";
        p.stdout.on("data", (x) => {
          for (const l of String(x).split("\n").map((s) => s.trim()).filter(Boolean)) {
            if (l.startsWith("✔")) t.passo = `Capa ${l.split("-").pop().replace(".jpg", "")} pronta`;
            if (l.startsWith("{")) ultima = l;
          }
        });
        p.on("error", falha);
        p.on("close", (code) => {
          if (code !== 0 || !ultima) return falha(new Error("Não consegui gerar a capa"));
          const r = JSON.parse(ultima);
          // a primeira vez escolhe-se a de impacto, para a biblioteca já ter capa
          if (!r.escolhida) {
            copyFileSync(join(RAIZ, "out/capas", `${id}-impacto.jpg`), join(RAIZ, "out", `${id}.capa.jpg`));
            r.escolhida = "impacto";
            writeFileSync(info, JSON.stringify(r, null, 2));
          }
          ok(r);
        });
      })));
    }
  }
  const ytDe = url.pathname.match(/^\/api\/roteiros\/([a-z0-9-]{1,80})\/(publicacao|ganchos)$/);
  if (ytDe) {
    const [, id, qual] = ytDe;
    if (!existsSync(caminhoRoteiro(id))) return json(res, 404, { erro: "roteiro não existe" });
    if (qual === "publicacao" && req.method === "GET") {
      return json(res, 200, existsSync(ficheiroPublicacao(id)) ? JSON.parse(readFileSync(ficheiroPublicacao(id), "utf-8")) : {});
    }
    if (req.method === "POST") {
      return json(res, 202, novaTarefa(qual, (t) => (qual === "publicacao" ? gerarPublicacao(t, id) : gerarGanchos(t, id))));
    }
  }

  // criar o Short de um corte do vídeo longo
  // reenviar o JSON corrigido pela outra IA para o MESMO roteiro: mantém as escolhas do painel e volta a validar e a buscar mídia
  const reimportar = url.pathname.match(/^\/api\/roteiros\/([a-z0-9-]{1,80})\/reimportar$/);
  if (req.method === "POST" && reimportar) {
    const id = reimportar[1];
    if (!existsSync(caminhoRoteiro(id))) return json(res, 404, { erro: "roteiro não existe" });
    if (ocupado(id)) return json(res, 409, { erro: "Este vídeo ainda está em produção; espere que termine" });
    const d = await corpo(req);
    let r;
    try { r = lerRoteiroExterno(d.texto); } catch (e) { return json(res, 400, { erro: e.message }); }
    const antigo = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
    // a mídia já escolhida fica quando a cena continua a pedir a mesma coisa
    r.cenas.forEach((c, i) => {
      const v = antigo.cenas?.[i];
      if (v?.midia?.arquivo && c.tipo === v.tipo && (!c.midia || c.midia.consulta === v.midia.consulta)) c.midia = v.midia;
    });
    const fica = ["formato", "estilo", "narracao", "voz", "velocidade", "musica", "musicaVolume", "musicaInicio", "sfxVolume", "canal", "marcaDagua", "mercado", "duracao_alvo"];
    const manter = Object.fromEntries(fica.filter((k) => antigo[k] !== undefined).map((k) => [k, antigo[k]]));
    writeFileSync(caminhoRoteiro(id), JSON.stringify({ ...r, ...manter, id }, null, 2));
    const espera = [...jobs.values()].find((j) => j.videoId === id && j.estado === "aguardando revisao");
    const job = espera ?? novoJob({ tipo: "novo", videoId: id, tema: r.titulo || antigo.titulo || id });
    Object.assign(job, {
      tipo: "novo", importado: true, revisar: true, editorChefe: false, estado: "na fila",
      formato: antigo.formato ?? "ranking", estilo: antigo.estilo ?? "neon", narracao: antigo.narracao ?? "edge", voz: antigo.voz,
      musica: antigo.musica ?? "auto", duracao: antigo.duracao_alvo ?? "medio", canal: antigo.marcaDagua === false ? "nenhum" : antigo.canal,
      pais: antigo.mercado === "Portugal" ? "Portugal (€)" : "Brasil (R$)",
    });
    registar(job, `Roteiro corrigido reenviado (${r.cenas.length} cenas)`);
    correrJob(job);
    return json(res, 200, job);
  }
  const corteDe = url.pathname.match(/^\/api\/roteiros\/([a-z0-9-]{1,80})\/cortes\/(\d+)$/);
  if (req.method === "POST" && corteDe) {
    if (!existsSync(caminhoRoteiro(corteDe[1]))) return json(res, 404, { erro: "roteiro não existe" });
    let novoId;
    try { novoId = criarCorte(corteDe[1], Number(corteDe[2])); } catch (e) { return json(res, 400, { erro: e.message }); }
    await correrScript({ log: [] }, ["scripts/validar_roteiro.py", `roteiros/${novoId}.json`, "--corrigir"]).catch(() => {});
    return json(res, 201, { id: novoId });
  }
  if (b === "editor" && ID_VALIDO.test(c ?? "") && req.method === "GET") {
    const p = caminhoRoteiro(c);
    if (!existsSync(p)) return json(res, 404, { erro: "roteiro não existe" });
    const roteiro = JSON.parse(readFileSync(p, "utf-8"));
    let narrado = [];
    try {
      narrado = JSON.parse(readFileSync(join(RAIZ, "public/videos", c, "manifest.json"), "utf-8")).cenas
        .map((x) => ({ fala: x.fala ?? "", duracaoMs: x.duracaoMs, palavras: x.palavras, audio: x.audio }));
    } catch { /* ainda não narrado: o editor estima os tempos */ }
    let musica = null;
    try { musica = escolherMusica(roteiro, RAIZ) ?? null; } catch { /* sem biblioteca de música */ }
    return json(res, 200, { roteiro, narrado, musica });
  }
  if (b === "roteiros" && ID_VALIDO.test(c ?? "")) {
    const p = caminhoRoteiro(c);
    if (!existsSync(p)) return json(res, 404, { erro: "roteiro não existe" });
    if (req.method === "GET") return json(res, 200, JSON.parse(readFileSync(p, "utf-8")));
    if (req.method === "PUT") {
      const r = await corpo(req);
      r.id = c;
      if (r.narracao === "elevenlabs") {
        try { r.voz = await prepararVozEleven(r.voz); } catch (e) { return json(res, 400, { erro: e.message }); }
      }
      writeFileSync(p, JSON.stringify(r, null, 2));
      return json(res, 200, { ok: true });
    }
    // trocar a mídia de uma cena: nova fonte/consulta (ou ficheiro enviado) e descarrega já
    const midiaDe = url.pathname.match(/\/midia\/(\d+)$/);
    if (req.method === "POST" && midiaDe) {
      const i = Number(midiaDe[1]);
      const r = JSON.parse(readFileSync(p, "utf-8"));
      if (!r.cenas[i]) return json(res, 404, { erro: "cena não existe" });
      const d = await corpo(req);
      // campo "objeto": o objeto que flutua na tipografia editorial (modelo 3D, emoji, ícone ou imagem isolada)
      const nova = !d.fonte ? undefined
        : d.fonte === "icone" ? { fonte: "icone", consulta: d.consulta, arquivo: `icone:${d.consulta}`, formato: "icone" }
        : ["polyhaven", "anatomia"].includes(d.fonte) ? { fonte: d.fonte, modelo: d.consulta, tipo: "modelo3d" }
        : { fonte: d.fonte, consulta: d.consulta, ...(d.tipo && { tipo: d.tipo }), ...(d.indice && { indice: Number(d.indice) }) };
      const campo = d.campo === "objeto" ? "objeto" : "midia";
      if (nova) r.cenas[i][campo] = { ...nova, ...(campo === "midia" && r.cenas[i].midia?.pontos && { pontos: r.cenas[i].midia.pontos }) };
      else delete r.cenas[i][campo];
      writeFileSync(p, JSON.stringify(r, null, 2));
      const registo = { log: [] };
      if (nova && !nova.arquivo) await correrScript(registo, ["scripts/buscar_midia.py", `roteiros/${c}.json`, "--cena", String(i)]).catch(() => {});
      return json(res, 200, { roteiro: JSON.parse(readFileSync(p, "utf-8")), log: registo.log });
    }
    // pré-visualização de uma cena: um frame com o que está no roteiro (sem renderizar o vídeo)
    const previaDe = url.pathname.match(/\/previa\/(\d+)$/);
    if (req.method === "POST" && previaDe) {
      const i = Number(previaDe[1]);
      if (!JSON.parse(readFileSync(p, "utf-8")).cenas[i]) return json(res, 404, { erro: "cena não existe" });
      return json(res, 202, novaTarefa("previa", (t) => new Promise((ok, falha) => {
        t.passo = "Desenhando a cena…";
        const proc = guardarProcesso(t, spawn(process.execPath, ["scripts/previa_cena.mjs", c, String(i), String(Number(url.searchParams.get("t")) || 0.6)], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] }));
        let erro = "";
        proc.stderr.on("data", (x) => (erro += x));
        proc.on("error", falha);
        proc.on("close", (code) => (code === 0 ? ok({ url: `/out/previa/${c}-${i}.jpg?v=${Date.now()}` }) : falha(new Error(erro.trim().split("\n").filter((l) => !/THREE|Tab \d/.test(l)).pop() || "Não consegui desenhar a cena"))));
      })));
    }
    // apoio visual de um corte: troca a mídia (vídeo, foto, print) ou o objeto da frase de efeito e descarrega já
    const apoioDe = url.pathname.match(/\/apoio\/(\d+)\/(\d+)$/);
    if (req.method === "POST" && apoioDe) {
      const [i, k] = [Number(apoioDe[1]), Number(apoioDe[2])];
      const r = JSON.parse(readFileSync(p, "utf-8"));
      const b = r.cenas[i]?.broll?.[k];
      if (!b) return json(res, 404, { erro: "apoio não existe" });
      const d = await corpo(req);
      const nova = !d.fonte ? undefined
        : d.fonte === "icone" ? { fonte: "icone", consulta: d.consulta, arquivo: `icone:${d.consulta}`, formato: "icone" }
        : ["polyhaven", "anatomia"].includes(d.fonte) ? { fonte: d.fonte, modelo: d.consulta, tipo: "modelo3d" }
        : { fonte: d.fonte, consulta: d.consulta, ...(d.tipo && { tipo: d.tipo }), ...(d.indice && { indice: Number(d.indice) }) };
      if (d.campo === "objeto") { if (!b.cena) return json(res, 400, { erro: "este apoio não tem objeto" }); if (nova) b.cena.objeto = nova; else delete b.cena.objeto; }
      else { if (nova) b.midia = { ...nova, ...(b.midia?.pontos && { pontos: b.midia.pontos }) }; else delete b.midia; }
      writeFileSync(p, JSON.stringify(r, null, 2));
      const registo = { log: [] };
      if (nova && !nova.arquivo) await correrScript(registo, ["scripts/buscar_midia.py", `roteiros/${c}.json`, "--cena", String(i)]).catch(() => {});
      return json(res, 200, { roteiro: JSON.parse(readFileSync(p, "utf-8")), log: registo.log });
    }
    const modeloDe = url.pathname.match(/\/modelo\/(\d+)$/);
    if (req.method === "POST" && modeloDe) {
      const i = Number(modeloDe[1]);
      const r = JSON.parse(readFileSync(p, "utf-8"));
      if (r.cenas[i]?.tipo !== "modelo3d") return json(res, 404, { erro: "cena 3D não existe" });
      const d = await corpo(req);
      if (d.consulta) r.cenas[i].modelo = { fonte: ["url", "sketchfab"].includes(d.fonte) ? d.fonte : "arquivo", consulta: d.consulta, ...(d.credito && { credito: d.credito }) };
      else delete r.cenas[i].modelo;
      writeFileSync(p, JSON.stringify(r, null, 2));
      const registo = { log: [] };
      if (d.consulta) await correrScript(registo, ["scripts/buscar_midia.py", `roteiros/${c}.json`, "--cena", String(i)]).catch(() => {});
      return json(res, 200, { roteiro: JSON.parse(readFileSync(p, "utf-8")), log: registo.log });
    }
    if (req.method === "POST" && url.searchParams.get("acao") === "produzir") {
      const r = JSON.parse(readFileSync(p, "utf-8"));
      // reaproveita o job que estava à espera de revisão, se existir
      const espera = [...jobs.values()].find((j) => j.videoId === c && j.estado === "aguardando revisao");
      const job = espera ?? novoJob({ tipo: "render", videoId: c, tema: r.titulo, estilo: r.estilo, narracao: r.narracao });
      produzir(job);
      return json(res, 200, job);
    }
  }
  json(res, 404, { erro: "rota desconhecida" });
};

// o player do editor manual é o mesmo código do vídeo (src/), compilado para o navegador: recompila se src/ mudou
// (no arranque e sempre que o editor pede o player, para as mudanças nas cenas aparecerem sem reiniciar o painel)
function compilarPlayerEditor() {
  const saida = join(RAIZ, "server/editor/player.js");
  const maisRecente = (pasta) => readdirSync(pasta, { withFileTypes: true }).reduce((m, e) => Math.max(m, e.isDirectory() ? maisRecente(join(pasta, e.name)) : statSync(join(pasta, e.name)).mtimeMs), 0);
  try {
    if (existsSync(saida) && statSync(saida).mtimeMs >= Math.max(maisRecente(join(RAIZ, "src")), statSync(join(RAIZ, "public/sfx/catalogo.json")).mtimeMs)) return;
    console.log("A compilar o player do editor…");
    const r = spawnSync(process.execPath, ["scripts/build_editor.mjs"], { cwd: RAIZ, encoding: "utf-8" });
    console.log(r.status === 0 ? r.stdout.trim() : `Não consegui compilar o player do editor: ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
  } catch (e) { console.log(`Player do editor: ${e.message}`); }
}
compilarPlayerEditor();

createServer((req, res) => rotas(req, res).catch((e) => json(res, 500, { erro: e.message })))
  .listen(PORTA, "127.0.0.1", () => { console.log(`Painel em http://localhost:${PORTA}`); automatico.iniciar(); });
