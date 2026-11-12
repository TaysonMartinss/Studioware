// Painel local: http://localhost:4321
// O roteiro é escrito pelo Claude Code em modo headless (claude -p, usa a skill novo-video);
// a narração e o render correm em scripts/produzir.mjs.
import { spawn } from "node:child_process";
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { CLIMAS, POR_ESTILO, POR_FORMATO, gravarCatalogo, lerCatalogo, listarMusicas } from "../scripts/musica.mjs";
import { createServer } from "node:http";
import { basename, join, resolve } from "node:path";
import { criarYouTube } from "./youtube.mjs";
import { criarCortes } from "./cortes.mjs";
import { criarAutomatico } from "./automatico.mjs";

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
  WebSearch: (i) => `🔎 Pesquisando: ${i.query}`,
  WebFetch: (i) => `🌐 Lendo: ${i.url}`,
  Write: (i) => `✍️ Escrevendo ${i.file_path?.split(/[\\/]/).pop()}`,
  Edit: (i) => `✏️ Ajustando ${i.file_path?.split(/[\\/]/).pop()}`,
  Read: (i) => `📖 Lendo ${i.file_path?.split(/[\\/]/).pop()}`,
  Skill: () => "📘 Carregando a skill novo-video",
};

const DURACOES = { curto: "30 a 45 segundos", medio: "45 a 60 segundos", longo: "60 a 90 segundos", video_longo: "5 a 10 minutos" };
// o vídeo longo tem duração própria; os outros formatos escolhem no painel
const duracaoDe = (d) => (d.formato === "longo" ? "video_longo" : ["curto", "medio", "longo"].includes(d.duracao) ? d.duracao : "medio");

// Corre o Claude Code em modo headless com o system prompt do roteirista e mostra no log o que ele está a fazer
function rodarClaude(job, prompt) {
  return new Promise((ok, falha) => {
    // lido a cada chamada, para refletir edições ao ficheiro
    const roteirista = readFileSync(join(RAIZ, ".claude/skills/novo-video/roteirista.md"), "utf-8");
    const p = spawn("claude", [
      "-p", prompt, "--append-system-prompt", roteirista, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
      "--allowedTools", "WebSearch", "WebFetch", "Read", "Write", "Edit", "Glob", "Grep", "Skill",
    ], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: envClaude() });
    let resto = "", ultimo = "";
    p.stdout.on("data", (d) => {
      const linhas = (resto + d).split("\n");
      resto = linhas.pop();
      for (const l of linhas) {
        let ev;
        try { ev = JSON.parse(l); } catch { continue; }
        if (ev.type === "assistant") {
          for (const c of ev.message?.content ?? []) {
            if (c.type === "tool_use") registar(job, (DESCREVER_FERRAMENTA[c.name] ?? (() => `🔧 ${c.name}`))(c.input ?? {}));
          }
        } else if (ev.type === "result" && ev.result) {
          registar(job, `📝 ${ev.result}`);
          ultimo = ev.result;
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
    observacoes: d.observacoes ?? "", revisar: d.revisar !== false, musica: d.musica ?? "auto", lowpoly: Boolean(d.lowpoly) && d.formato !== "animado",
    duracao: duracaoDe(d), editorChefe: d.editorChefe !== false, revisaoVisual: d.revisaoVisual !== false, canal: canalDe(d.canal), auto: Boolean(d.auto),
  });
}

// as escolhas do painel prevalecem sobre o que estiver no roteiro
function aplicarEscolhas(job) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(job.videoId), "utf-8"));
  Object.assign(r, {
    id: job.videoId, formato: job.formato, estilo: job.estilo, narracao: job.narracao, voz: job.voz, musica: job.musica ?? "auto",
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
  registar(job, "🧐 Editor-chefe revisando profundidade, precisão e preços…");
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
  await rodarClaude(job, prompt);
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
function claudeJSON(tarefa, guia, pedido, ferramentas = []) {
  return new Promise((ok, falha) => {
    const sistema = readFileSync(/[\\/]/.test(guia) ? guia : join(GUIAS, guia), "utf-8");
    const p = spawn("claude", [
      "-p", "--append-system-prompt", sistema, "--output-format", "stream-json", "--verbose",
      ...(ferramentas.length ? ["--allowedTools", ...ferramentas] : []),
    ], { cwd: RAIZ, stdio: ["pipe", "pipe", "pipe"], env: envClaude() });
    let resto = "", resultado = null;
    p.stdout.on("data", (d) => {
      const linhas = (resto + d).split("\n");
      resto = linhas.pop();
      for (const l of linhas) {
        let ev;
        try { ev = JSON.parse(l); } catch { continue; }
        if (ev.type === "assistant") {
          for (const c of ev.message?.content ?? []) if (c.type === "tool_use") tarefa.passo = (DESCREVER_FERRAMENTA[c.name] ?? (() => `🔧 ${c.name}`))(c.input ?? {});
        } else if (ev.type === "result") resultado = ev.result;
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
  const t = { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo, estado: "a correr", passo: "🤖 Pensando…", criado: Date.now() };
  tarefas.set(t.id, t);
  for (const [k, v] of tarefas) if (Date.now() - v.criado > 3 * 3600e3) tarefas.delete(k);
  trabalho(t).then((r) => Object.assign(t, { estado: "pronto", resultado: r }), (e) => Object.assign(t, { estado: "erro", erro: e.message }));
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
    "Pesquise na web o que está acontecendo agora antes de sugerir. Responda só com o JSON.",
  ].filter(Boolean).join("\n\n");
  return claudeJSON(t, "ideias.md", pedido, ["WebSearch", "WebFetch"]).then((r) => {
    if (!Array.isArray(r.ideias)) throw new Error("A resposta não trouxe ideias");
    const salvo = { geradoEm: new Date().toISOString(), canal: id, foco: d.foco ?? "", ideias: r.ideias.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0)) };
    writeFileSync(ficheiroIdeias(id), JSON.stringify(salvo, null, 2));
    return salvo;
  });
}

const ficheiroPublicacao = (id) => join(RAIZ, "out", `${id}.publicacao.json`);
function gerarPublicacao(t, id) {
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  const desc = join(RAIZ, "out", `${id}.descricao.txt`);
  const capitulos = existsSync(desc) ? readFileSync(desc, "utf-8").split("\n").filter((l) => /^\d+:\d\d/.test(l.trim())) : [];
  const pedido = [
    `Faça o pacote de publicação deste vídeo (${r.formato === "longo" ? "vídeo longo 16:9 do YouTube" : "vertical: YouTube Shorts, TikTok e Reels"}).`,
    capitulos.length ? `Capítulos (use exatamente estes, na descrição do YouTube):\n${capitulos.join("\n")}` : r.formato === "longo" ? "Ainda não há capítulos com tempos (o vídeo não foi renderizado): deixe a linha \"[capítulos]\" no lugar onde eles entram." : "",
    `Roteiro:\n${JSON.stringify(resumoRoteiro(r), null, 1)}`,
    "Responda só com o JSON.",
  ].filter(Boolean).join("\n\n");
  return claudeJSON(t, "publicacao.md", pedido).then((p) => {
    const salvo = { ...p, geradoEm: new Date().toISOString() };
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
    aoPasso("🖼 Capturando frames de cada cena…");
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
    aoPasso("👁 O Claude está vendo os frames…");
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
  registar(job, "🤖 Claude pesquisando e escrevendo o roteiro…");
  return rodarClaude(job, prompt).then(() => {
    if (!existsSync(caminhoRoteiro(job.videoId))) throw new Error("O Claude não gravou o roteiro");
    aplicarEscolhas(job);
    registar(job, "✅ Primeira versão do roteiro pronta");
  });
}

function produzir(job) {
  job.estado = "na fila de render";
  filaRender = filaRender.then(() => new Promise((ok) => {
    job.estado = "narracao";
    const p = spawn(process.execPath, ["scripts/produzir.mjs", `roteiros/${job.videoId}.json`], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });
    const ler = (d) => {
      for (const l of String(d).split(/\r?\n/).filter(Boolean)) {
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
      if (code === 0) {
        job.estado = "pronto";
        job.progresso = 100;
        registar(job, "🎬 Vídeo pronto!");
        if (job.revisaoVisual !== false) {
          revisaoVisual(job.videoId, (passo) => (job.passoRevisao = passo))
            .then((r) => { job.passoRevisao = null; registar(job, `👁 Revisão visual: nota ${r.nota ?? "?"}/10, ${r.problemas.length} ${r.problemas.length === 1 ? "problema" : "problemas"}${r.problemas.length ? " (ver no editor)" : ""}`); job.aoTerminar?.(job, r); })
            .catch((e) => { job.passoRevisao = null; registar(job, `⚠ Revisão visual não feita: ${e.message}`); job.aoTerminar?.(job, null); });
        } else job.aoTerminar?.(job, null);
      } else {
        job.estado = "erro";
        registar(job, "❌ Falhou a produção (ver log acima)");
        job.aoTerminar?.(job, null);
      }
      ok();
    });
  }));
}

// Corre um script Python do projeto e copia a saída para o log do job
const correrScript = (job, args) => new Promise((ok, falha) => {
  const p = spawn("python", args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  const ler = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => registar(job, l));
  p.stdout.on("data", ler);
  p.stderr.on("data", ler);
  p.on("error", falha);
  p.on("close", (code) => (code === 0 ? ok() : falha(new Error(`${args[0]} falhou`))));
});

// descarrega imagens/b-rolls e renderiza cenas Manim, para a revisão já as mostrar
async function prepararMidia(job) {
  job.estado = "midia";
  registar(job, "🖼 Procurando imagens e b-rolls…");
  await correrScript(job, ["scripts/buscar_midia.py", `roteiros/${job.videoId}.json`]);
  await correrScript(job, ["scripts/manim_cenas.py", `roteiros/${job.videoId}.json`]);
}

async function correrJob(job) {
  try {
    if (job.tipo === "novo") {
      if (!job.importado) await escreverRoteiro(job);
      else aplicarEscolhas(job);
      let q = await validar(job);
      registar(job, `🔍 Validador: ${q.erros.length} erros, ${q.avisos.length} avisos`);
      if (!job.importado && job.editorChefe !== false && (q.erros.length || q.avisos.length)) {
        await editorChefe(job, [...q.erros, ...q.avisos]);
        aplicarEscolhas(job);
        q = await validar(job);
        registar(job, `🔍 Depois do editor: ${q.erros.length} erros, ${q.avisos.length} avisos`);
      }
      q.erros.forEach((e) => registar(job, `⚠ ${e}`));
      await prepararMidia(job);
      // com erros por resolver, o vídeo nunca segue sozinho para render
      if (q.erros.length) job.revisar = true;
    }
    if (job.revisar && job.tipo === "novo") {
      job.estado = "aguardando revisao";
      registar(job, "👀 Revise o roteiro (preços, fatos, avisos) e clique em Produzir");
      return;
    }
    produzir(job);
  } catch (e) {
    job.estado = "erro";
    registar(job, `❌ ${e.message}`);
  }
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
  const tipos = new Set(["gancho", "quiz", "lowpoly", "pincel", "produto", "fato", "grafico", "linha_tempo", "manim", "numero", "comparacao", "modelo3d", "capitulo", "cta"]);
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

const enviarVideo = (req, res, ficheiro) => {
  const tamanho = statSync(ficheiro).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (!range) {
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": tamanho, "Accept-Ranges": "bytes" });
    return createReadStream(ficheiro).pipe(res);
  }
  const ini = range[1] ? Number(range[1]) : 0;
  const fim = range[2] ? Number(range[2]) : tamanho - 1;
  res.writeHead(206, { "Content-Type": "video/mp4", "Content-Length": fim - ini + 1, "Content-Range": `bytes ${ini}-${fim}/${tamanho}`, "Accept-Ranges": "bytes" });
  createReadStream(ficheiro, { start: ini, end: fim }).pipe(res);
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

function moverParaLixeira(id) {
  const destino = join(LIXEIRA, id);
  if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  const r = JSON.parse(readFileSync(caminhoRoteiro(id), "utf-8"));
  for (const [de, para] of PECAS(id)) if (existsSync(de)) renameSync(de, join(destino, para));
  writeFileSync(join(destino, "info.json"), JSON.stringify({ id, titulo: r.titulo, estilo: r.estilo, apagadoEm: Date.now() }));
}
function restaurarDaLixeira(id) {
  const origem = join(LIXEIRA, id);
  if (existsSync(caminhoRoteiro(id))) throw new Error("Já existe um vídeo com este nome na biblioteca");
  for (const [de, para] of PECAS(id)) if (existsSync(join(origem, para))) renameSync(join(origem, para), de);
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
const cortes = criarCortes({ raiz: RAIZ, claudeJSON });
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
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    return createReadStream(join(RAIZ, "server/painel.html")).pipe(res);
  }
  // estilos e lógica do painel (ficheiros à parte; no-cache = o browser confirma se mudaram, sem descarregar de novo)
  if (req.method === "GET" && (url.pathname === "/painel.css" || url.pathname === "/painel.js")) {
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
  if (req.method === "GET" && a === "out" && b === "revisao" && /^[a-z0-9-]{1,80}-\d\.jpg$/.test(c ?? "")) {
    const f = join(RAIZ, "out/revisao", c);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
    return createReadStream(f).pipe(res);
  }
  // capas: a escolhida (out/<id>.capa.jpg) e as variantes (out/capas/<id>-<layout>.jpg)
  if (req.method === "GET" && a === "out" && (/^[a-z0-9-]{1,80}\.capa\.jpg$/.test(b ?? "") || (b === "capas" && /^[a-z0-9-]{1,80}-(impacto|dividido|objeto)\.jpg$/.test(c ?? "")))) {
    const f = b === "capas" ? join(RAIZ, "out/capas", c) : join(RAIZ, "out", b);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
    return createReadStream(f).pipe(res);
  }
  // miniaturas dos estilos e ícones (SVG do Lucide) usados pelo painel
  if (req.method === "GET" && (a === "miniaturas" || a === "icones") && /^[\w-]+\.(jpg|svg)$/.test(b ?? "")) {
    const f = a === "miniaturas" ? join(RAIZ, "server/miniaturas", b) : join(RAIZ, "node_modules/lucide-static/icons", b);
    if (!existsSync(f)) return json(res, 404, { erro: "não existe" });
    res.writeHead(200, { "Content-Type": b.endsWith(".svg") ? "image/svg+xml" : "image/jpeg", "Cache-Control": b.endsWith(".svg") ? "max-age=86400" : "no-cache" }); // miniaturas mudam quando se regeneram os estilos
    return createReadStream(f).pipe(res);
  }
  if (req.method === "GET" && a === "public") {
    const rel = decodeURIComponent(url.pathname.slice("/public/".length));
    const f = resolve(RAIZ, "public", rel);
    if (!f.startsWith(resolve(RAIZ, "public")) || !existsSync(f) || !statSync(f).isFile()) return json(res, 404, { erro: "não existe" });
    if (/\.(mp4|webm)$/i.test(f)) return enviarVideo(req, res, f);
    const tipos = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg" };
    res.writeHead(200, { "Content-Type": tipos[f.split(".").pop().toLowerCase()] ?? "application/octet-stream" });
    return createReadStream(f).pipe(res);
  }
  if (a !== "api") return json(res, 404, { erro: "rota desconhecida" });

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
    let logo = antigo.logo;
    if (typeof d.logo === "string" && /^marca\/rascunho-[a-z0-9]+\.png$/.test(d.logo) && existsSync(join(RAIZ, "public", d.logo))) {
      // o rascunho passa a ser a logo do canal (nome novo a cada troca: o render não usa uma versão em cache)
      logo = `marca/${id}-${Date.now().toString(36)}.png`;
      renameSync(join(RAIZ, "public", d.logo), join(RAIZ, "public", logo));
      if (antigo.logo && /^marca\/[a-z0-9-]+-[a-z0-9]+\.png$/.test(antigo.logo)) rmSync(join(RAIZ, "public", antigo.logo), { force: true });
    }
    if (!logo) return json(res, 400, { erro: "Envie a logo do canal" });
    todos[id] = {
      ...antigo, nome, arroba, logo,
      pixelado: Boolean(d.pixelado) || undefined,
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
    return json(res, 200, { estilos: estilos(), canais: canais(), vozesEdge: VOZES_EDGE, temElevenLabs: Boolean(process.env.ELEVENLABS_API_KEY || lerEnv().ELEVENLABS_API_KEY), temPixabay: Boolean(process.env.PIXABAY_API_KEY || lerEnv().PIXABAY_API_KEY), temSketchfab: Boolean(process.env.SKETCHFAB_API_TOKEN || lerEnv().SKETCHFAB_API_TOKEN), temGoogle: youtube.configurado(), temClaudeToken: Boolean(tokenClaude()), temChatterbox: existsSync(join(RAIZ, ".venv-voz/Scripts/python.exe")), vozesChatterbox: vozesChatterbox() });

  if (b === "chaves" && req.method === "POST") {
    const d = await corpo(req);
    const novas = {};
    for (const nome of ["ELEVENLABS_API_KEY", "PIXABAY_API_KEY", "SKETCHFAB_API_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CLAUDE_CODE_OAUTH_TOKEN"]) {
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
        id: videoId, titulo, formato: "clipe", estilo: d.estilo ?? "hormozi", musica: d.musica ?? "auto",
        ...(canalDe(d.canal) === "nenhum" ? { marcaDagua: false } : canalDe(d.canal) && { canal: d.canal }),
        destaques: [], emojis, legenda_post: x.legenda_post, nota: x.nota,
        cenas: [{ tipo: "clipe", bruto: d.arquivo, inicio: x.inicio, fim: x.fim, fala: "", titulo: d.gancho === false ? undefined : x.gancho, cortar: d.cortar !== false, enquadrar: d.enquadrar !== false }],
      }, null, 2));
      const job = novoJob({ tipo: "render", formato: "clipe", videoId, tema: titulo, estilo: d.estilo, narracao: "clipe" });
      produzir(job);
      return job;
    });
    return json(res, 201, criados);
  }

  if (b === "jobs" && req.method === "GET") return json(res, 200, [...jobs.values()].sort((x, y) => y.criado - x.criado));
  if (b === "jobs" && req.method === "POST") {
    const d = await corpo(req);
    if (!d.tema?.trim()) return json(res, 400, { erro: "Falta o tema" });
    const videoId = `${slug(d.tema) || "video"}-${Date.now().toString(36).slice(-5)}`;
    if (d.formato === "clipe") {
      // vídeos do próprio criador: não há roteiro para escrever, só cortar, legendar e renderizar
      const arquivos = (d.arquivos ?? []).filter((a) => /^uploads\/[\w.-]+$/.test(a));
      if (!arquivos.length) return json(res, 400, { erro: "Envie pelo menos um vídeo" });
      writeFileSync(caminhoRoteiro(videoId), JSON.stringify({
        id: videoId, titulo: d.tema.trim(), formato: "clipe", estilo: d.estilo ?? "hormozi", musica: d.musica ?? "auto",
        ...(canalDe(d.canal) === "nenhum" ? { marcaDagua: false } : canalDe(d.canal) && { canal: d.canal }),
        destaques: (d.destaques ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        cenas: arquivos.map((a) => ({ tipo: "clipe", bruto: a, fala: "", cortar: d.cortar !== false })),
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
      narracao: d.narracao ?? "edge", voz: d.voz, pais: d.pais ?? "Brasil (R$)", revisar: true, musica: d.musica ?? "auto",
      duracao: duracaoDe(d), editorChefe: false, canal: canalDe(d.canal),
    });
    registar(job, `📥 Roteiro importado de outra IA (${r.cenas.length} cenas)`);
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
        t.passo = "🎨 Preparando o estúdio…";
        const p = spawn(process.execPath, args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });
        let ultima = "";
        p.stdout.on("data", (x) => {
          for (const l of String(x).split("\n").map((s) => s.trim()).filter(Boolean)) {
            if (l.startsWith("✔")) t.passo = `🎨 ${l.split("-").pop().replace(".jpg", "")} pronta`;
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
    const fica = ["formato", "estilo", "narracao", "voz", "velocidade", "musica", "musicaVolume", "sfxVolume", "canal", "marcaDagua", "mercado", "duracao_alvo"];
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
    registar(job, `🔁 Roteiro corrigido reenviado (${r.cenas.length} cenas)`);
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
      if (d.fonte) r.cenas[i].midia = { fonte: d.fonte, consulta: d.consulta, ...(d.tipo && { tipo: d.tipo }), ...(d.indice && { indice: Number(d.indice) }) };
      else delete r.cenas[i].midia;
      writeFileSync(p, JSON.stringify(r, null, 2));
      const registo = { log: [] };
      if (d.fonte) await correrScript(registo, ["scripts/buscar_midia.py", `roteiros/${c}.json`, "--cena", String(i)]).catch(() => {});
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

createServer((req, res) => rotas(req, res).catch((e) => json(res, 500, { erro: e.message })))
  .listen(PORTA, "127.0.0.1", () => { console.log(`Painel em http://localhost:${PORTA}`); automatico.iniciar(); });
