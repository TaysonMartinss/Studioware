const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (nome, tam = 16) => `<i class="i" style="--u:url(/icones/${nome}.svg);width:${tam}px;height:${tam}px"></i>`;
// todos os pedidos levam X-Painel: o servidor recusa ações que não venham deste painel (proteção contra outros sites)
const fetchOriginal = window.fetch.bind(window);
window.fetch = (url, opcoes = {}) => fetchOriginal(url, { ...opcoes, headers: { ...(opcoes.headers ?? {}), "X-Painel": "1" } });
const api = async (url, opcoes = {}) => {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opcoes, body: opcoes.body && JSON.stringify(opcoes.body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.erro || r.statusText);
  return d;
};
let tToast;
const toast = (msg, icone = "info") => {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.setAttribute("aria-live", "polite");
  t.innerHTML = `${ic(icone)}<span>${esc(msg)}</span>`;
  document.body.append(t);
  clearTimeout(tToast);
  tToast = setTimeout(() => t.remove(), 3500);
};

let MUSICAS = { climas: {}, faixas: [], porEstilo: {}, porFormato: {} }, tocador = null;
let OPCOES = {}, estado = { estilo: "neon", produtos: 3, narracao: "edge", formato: "storytelling", duracao: "medio" }, vozesEleven = null;

const FORMATOS = [
  ["quiz", "circle-help", "Quiz", "Perguntas com contagem para o público jogar", "Tema do quiz", "Ex.: futebol nas Copas do Mundo, cada vez mais difícil"],
  ["livre", "sparkles", "Livre", "Sem molde: descreva o vídeo que imagina", "Descreva o vídeo", "Ex.: começa com o apito final, volta 90 minutos atrás e mostra lance a lance como o VAR mudou o jogo, com um gráfico da posse de bola no meio"],
  ["animacao", "box", "Animação 3D", "Qualquer tema, tudo em low poly 3D", "Descreva o vídeo", "Ex.: como funciona um motor de carro, peça a peça, até o carro andar"],
  ["ese", "orbit", "E se?", "Hipótese levada ao extremo, com ciência", "A pergunta \"E se…?\"", "Ex.: E se a internet do mundo caísse por um dia inteiro?"],
  ["animado", "clapperboard", "E se? animado", "Animação 3D low poly, sem fotos", "A pergunta \"E se…?\"", "Ex.: E se você pudesse voltar dez segundos no tempo?"],
  ["storytelling", "clapperboard", "Storytelling de venda", "História que termina na compra de um produto", "O que quer vender e a quem", "Ex.: filtro de linha para quem tem PC gamer, mostrando o risco de um pico de energia"],
  ["ranking", "list-ordered", "Ranking", "Os melhores produtos com preço", "Tema do ranking", "Ex.: 3 melhores monitores 144 Hz até R$ 1.500"],
  ["curiosidades", "lightbulb", "Curiosidades", "Fatos do mundo gamer com imagens reais", "Tema", "Ex.: segredos escondidos em jogos da Nintendo"],
  ["explicativo", "chart-column", "Explicativo", "Gráficos, linha do tempo e animações", "Pergunta a explicar", "Ex.: porque é que as placas de vídeo ficaram tão caras?"],
  ["longo", "monitor-play", "Vídeo longo (YouTube)", "5 a 10 min em 16:9, com capítulos e cortes para Shorts", "Tema do vídeo", "Ex.: a história da Nvidia, da quase falência à empresa mais valiosa do mundo"],
  ["clipe", "film", "Os meus clipes", "Cortes automáticos e legendas", "Título do vídeo", "Ex.: montei o meu PC gamer"],
];
// "Animação 3D" é o formato livre com todas as cenas em low poly (o servidor já sabe fazer as duas coisas)
const formatoEnvio = () => (estado.formato === "animacao" ? "livre" : estado.formato);
const lowpolyEnvio = () => estado.formato === "animacao" || (!$("#campoLowpoly").hidden && $("#lowpoly").checked);

function segmentado(el, chave, valorDe = (b) => b.dataset.v ?? Number(b.textContent), aoMudar) {
  const botoes = [...el.querySelectorAll("button")];
  const marcar = () => botoes.forEach((b) => b.classList.toggle("ativo", valorDe(b) === estado[chave]));
  botoes.forEach((b) => (b.onclick = () => { estado[chave] = valorDe(b); marcar(); aoMudar?.(); }));
  marcar();
}

function desenharFormatos() {
  $("#formato").innerHTML = FORMATOS.filter(([k]) => k !== "clipe").map(([k, icone, nome, desc]) => `
    <button class="formato ${k === estado.formato ? "ativo" : ""}" data-k="${k}">${ic(icone)}<div><b>${nome}</b><span>${desc}</span></div></button>`).join("");
  document.querySelectorAll(".formato").forEach((b) => (b.onclick = () => { estado.formato = b.dataset.k; desenharFormatos(); mudarFormato(); atualizarDicaMusica(); }));
}
function mudarFormato() {
  const clipe = estado.formato === "clipe";
  const [, , , , rotulo, dica] = FORMATOS.find(([k]) => k === estado.formato);
  $("#clipeBox").hidden = !clipe;
  $("#soRoteiro").hidden = clipe;
  $("#blocoFormato").hidden = clipe;
  $("#blocoDetalhes").hidden = clipe;
  $("#blocoAvancado").hidden = clipe;
  // nos cortes de vídeo longo não há título: os títulos vêm de cada momento
  $("#blocoTema").hidden = clipe && $("#modoCortes").checked;
  // o vídeo longo tem duração e número de capítulos próprios
  const longo = estado.formato === "longo";
  $("#campoDuracao").hidden = longo;
  $("#produtos").closest(".campo").hidden = longo || ["livre", "animacao"].includes(estado.formato);
  $("#rotuloItens").textContent = estado.formato === "quiz" ? "Perguntas" : "Itens";
  // o "E se? animado" já é todo em low poly
  // o "E se? animado" e a "Animação 3D" já são todos em low poly
  $("#campoLowpoly").hidden = ["animado", "animacao"].includes(estado.formato);
  $("#rotuloTema").textContent = rotulo;
  $("#tema").placeholder = dica;
  $("#textoCriar").textContent = origem === "outraia" ? "Preparar o prompt" : clipe ? ($("#modoCortes").checked ? "Encontrar momentos" : "Processar clipes") : $("#revisar").checked ? "Criar roteiro" : "Criar vídeo";
}
$("#revisar").onchange = mudarFormato;
$("#ficheirosClipe").onchange = (ev) => {
  const n = ev.target.files.length;
  $("#erroFicheiros").hidden = true;
  $("#nomesClipe").textContent = n ? [...ev.target.files].map((f) => f.name).join(", ") : "Escolha os vídeos (pela ordem em que entram)";
};

// ---------- navegação entre páginas (o endereço guarda a página: #criar, #producao…) ----------
const VISTAS = ["criar", "producao", "biblioteca", "ideias", "canais", "automatico", "configuracoes"];
const AO_ENTRAR = { ideias: () => abrirIdeias(), canais: () => abrirCanais(), automatico: () => abrirAuto(), configuracoes: () => abrirConfig(), biblioteca: () => atualizarGaleria() };
function irPara(vista, { historico = true } = {}) {
  if (!VISTAS.includes(vista)) vista = "criar";
  document.querySelectorAll(".vista").forEach((v) => (v.hidden = v.dataset.vista !== vista));
  document.querySelectorAll(".nav a").forEach((a) => (a.getAttribute("aria-current") === "page") !== (a.dataset.vista === vista) && (a.dataset.vista === vista ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (historico && location.hash !== `#${vista}`) history.pushState(null, "", `#${vista}`);
  try { AO_ENTRAR[vista]?.(); } catch (e) { console.error(e); }
  $("#principal").scrollTop = 0;
}
window.addEventListener("popstate", () => irPara(location.hash.slice(1), { historico: false }));
document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); irPara(a.dataset.vista); }));

// ---------- criar em 3 passos ----------
let origem = "ia", passoAtual = 1;
function escolherOrigem(o) {
  origem = o;
  document.querySelectorAll("#origens button").forEach((b) => { const on = b.dataset.origem === o; b.classList.toggle("ativo", on); b.setAttribute("aria-checked", on); });
  const clipe = o === "clipes" || o === "cortes";
  if (clipe) estado.formato = "clipe";
  else if (estado.formato === "clipe") estado.formato = "ese";
  $("#modoCortes").checked = o === "cortes";
  mudarModoCortes();
  desenharFormatos();
  mudarFormato();
  atualizarDicaMusica();
  $("#erroTema").hidden = true; $("#erroFicheiros").hidden = true;
}
document.querySelectorAll("#origens button").forEach((b) => (b.onclick = () => escolherOrigem(b.dataset.origem)));
$("#tema").addEventListener("input", () => ($("#erroTema").hidden = true));

function passoValido(n) {
  if (n !== 1) return true;
  const clipe = origem === "clipes" || origem === "cortes";
  if (clipe && !$("#ficheirosClipe").files.length) { $("#erroFicheiros").hidden = false; $("#zonaClipe").focus?.(); return false; }
  if (origem !== "cortes" && !$("#tema").value.trim()) {
    $("#erroTema").textContent = origem === "clipes" ? "Dê um título ao vídeo para continuar." : "Escreva o tema do vídeo para continuar.";
    $("#erroTema").hidden = false; $("#tema").focus(); return false;
  }
  return true;
}
function irParaPasso(n) {
  n = Math.min(3, Math.max(1, n));
  // avançar exige os passos anteriores válidos; voltar é sempre livre
  for (let k = passoAtual; k < n; k++) if (!passoValido(k)) return;
  passoAtual = n;
  [1, 2, 3].forEach((k) => ($(`#passo-${k}`).hidden = k !== n));
  document.querySelectorAll("#passos li").forEach((li) => {
    const k = Number(li.dataset.p);
    li.classList.toggle("atual", k === n); li.classList.toggle("feito", k < n);
    li.querySelector("button").setAttribute("aria-current", k === n ? "step" : "false");
  });
  $("#btnVoltar").style.visibility = n === 1 ? "hidden" : "visible";
  $("#btnContinuar").hidden = n === 3;
  $("#criar").hidden = n !== 3;
  if (n === 3) desenharResumo();
  $("#principal").scrollTop = 0;
}
function continuarPasso() { irParaPasso(passoAtual + 1); }

const NOMES_ORIGEM = { ia: "Novo vídeo com IA", cortes: "Cortes de vídeo longo", clipes: "Meus clipes", outraia: "Roteiro de outra IA" };
function linhasResumo() {
  const canal = OPCOES.canais?.[$("#canal").value];
  const clipe = origem === "clipes" || origem === "cortes";
  const voz = $("#voz").selectedOptions[0]?.textContent ?? "";
  const linhas = [
    ["Canal", canal ? `${canal.nome} (${canal.arroba})` : "Sem marca d'água"],
    ["Origem", NOMES_ORIGEM[origem]],
    !clipe && ["Formato", nomeFormato(estado.formato)],
    origem !== "cortes" && [clipe ? "Título" : "Tema", $("#tema").value.trim()],
    clipe && ["Arquivos", [...$("#ficheirosClipe").files].map((f) => f.name).join(", ")],
    !clipe && estado.formato !== "longo" && ["Duração", { curto: "30–45 s", medio: "45–60 s", longo: "60–90 s" }[estado.duracao]],
    ["Estilo", OPCOES.estilos[estado.estilo]?.nome ?? estado.estilo],
    !clipe && ["Narração", `${{ edge: "Voz grátis", elevenlabs: "ElevenLabs", chatterbox: "Chatterbox" }[estado.narracao]}${voz ? ` · ${voz}` : ""}`],
    ["Música", $("#musica").selectedOptions[0]?.textContent ?? "Automática"],
  ].filter(Boolean);
  return linhas;
}
const htmlResumo = (linhas) => linhas.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || "—")}</dd></div>`).join("");
function desenharResumo() {
  $("#resumo").innerHTML = htmlResumo(linhasResumo());
  const ligadas = ["editorChefe", "revisaoVisual", "revisar"].filter((id) => $(`#${id}`).checked && !$(`#${id}`).closest(".campo").hidden).length;
  $("#resumoAvancado").textContent = `${ligadas} ${ligadas === 1 ? "ativa" : "ativas"}`;
}
// coluna da direita: canal, estilo e resumo, sempre atualizados (só aparece em ecrãs largos)
let ladoPendente = false;
function desenharLado() {
  if (ladoPendente) return;
  ladoPendente = true;
  requestAnimationFrame(() => {
    ladoPendente = false;
    if (!OPCOES.estilos) return;
    const canal = OPCOES.canais?.[$("#canal").value];
    $("#ladoLogo").hidden = !canal;
    if (canal) { $("#ladoLogo").src = `/public/${canal.logo}`; $("#ladoLogo").style.imageRendering = canal.pixelado ? "pixelated" : "auto"; }
    $("#ladoCanal").textContent = canal ? `${canal.nome}` : "Sem marca d'água";
    $("#ladoNicho").textContent = canal ? canal.nicho || "Sem nicho definido: as ideias e o roteiro ficam genéricos." : "O vídeo sai sem logo nem @.";
    const e = OPCOES.estilos[estado.estilo];
    $("#ladoEstiloImg").src = `/miniaturas/${estado.estilo}.jpg`;
    $("#ladoEstilo").textContent = e?.nome ?? estado.estilo;
    $("#ladoEstiloDesc").textContent = e?.descricao ?? "";
    // o canal e o estilo já têm cartão próprio: o resumo mostra o resto
    $("#resumoLado").innerHTML = htmlResumo(linhasResumo().filter(([k]) => k !== "Canal" && k !== "Estilo"));
  });
}
// qualquer mudança no formulário (cliques, texto, escolhas) atualiza a coluna
["input", "change", "click"].forEach((ev) => $("#vista-criar").addEventListener(ev, desenharLado));

function criarDoAssistente() {
  if (!passoValido(1)) return irParaPasso(1);
  if (origem === "outraia") return abrirOutraIA();
  criar();
}

// canal no topo: muda o contexto de todas as páginas
function mudouCanal() {
  try { localStorage.canal = $("#canal").value; } catch {}
  desenharSeletorCanal();
  const vista = location.hash.slice(1);
  if (vista === "ideias") abrirIdeias();
  if (vista === "canais") desenharListaCanais();
  if (passoAtual === 3) desenharResumo();
  desenharLado();
}

// biblioteca: procurar pelo título
function filtrarBiblioteca() {
  const q = ($("#procurarBib")?.value ?? "").trim().toLowerCase();
  document.querySelectorAll("#galeria .cartao").forEach((c) => (c.hidden = q && !c.querySelector(".cartao-titulo")?.textContent.toLowerCase().includes(q)));
}

// tema claro ou escuro (o escolhido fica guardado; sem escolha segue o sistema)
function alternarTema() {
  const escuro = document.documentElement.dataset.tema ? document.documentElement.dataset.tema === "escuro" : !matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.dataset.tema = escuro ? "claro" : "escuro";
  try { localStorage.tema = document.documentElement.dataset.tema; } catch {}
  desenharIconeTema();
}
function desenharIconeTema() {
  const claro = document.documentElement.dataset.tema ? document.documentElement.dataset.tema === "claro" : matchMedia("(prefers-color-scheme: light)").matches;
  $("#iconeTema").style.setProperty("--u", `url(/icones/${claro ? "moon" : "sun"}.svg)`);
}

// ---------- música ----------
const opcoesMusica = (atual = "auto") => `
  <option value="auto" ${atual === "auto" ? "selected" : ""}>Automática (combina com o estilo)</option>
  <option value="nenhuma" ${atual === "nenhuma" ? "selected" : ""}>Sem música</option>
  ${Object.entries(MUSICAS.climas).map(([k, nome]) => {
    const faixas = MUSICAS.faixas.filter((f) => f.clima === k);
    if (!faixas.length) return "";
    return `<optgroup label="${esc(nome)}"><option value="${k}" ${atual === k ? "selected" : ""}>Qualquer faixa ${esc(nome.toLowerCase())}</option>${faixas
      .map((f) => `<option value="${esc(f.arquivo)}" ${atual === f.arquivo ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</optgroup>`;
  }).join("")}`;

// faixa que vai tocar para uma escolha (para o botão de ouvir e para a dica)
function faixaDe(escolha, estiloAtual) {
  if (escolha === "nenhuma") return null;
  if (escolha.includes("/")) return MUSICAS.faixas.find((f) => f.arquivo === escolha);
  // mesma regra do pipeline: o estilo manda quando tem sonoridade própria; senão, o formato
  const clima = escolha === "auto" ? MUSICAS.porEstilo[estiloAtual] ?? MUSICAS.porFormato[formatoEnvio()] ?? "energetica" : escolha;
  return MUSICAS.faixas.find((f) => f.clima === clima) ?? MUSICAS.faixas[0];
}

function desenharMusica() {
  const atual = $("#musica").value || "auto";
  $("#musica").innerHTML = opcoesMusica(atual);
  atualizarDicaMusica();
}
function atualizarDicaMusica() {
  const escolha = $("#musica").value;
  const f = faixaDe(escolha, estado.estilo);
  $("#dicaMusica").textContent = escolha === "auto" && f ? `Com este estilo: ${MUSICAS.climas[f.clima] ?? f.clima}. Baixa sozinha quando a voz fala.` : escolha === "nenhuma" ? "Só narração e efeitos sonoros." : "Baixa sozinha quando a voz fala.";
}
function tocarMusica(arquivo, botao) {
  if (tocador && !tocador.paused) { tocador.pause(); tocador = null; botao.innerHTML = ic("play"); return; }
  if (!arquivo) return toast("Sem música para ouvir", "music");
  tocador = new Audio(`/public/${arquivo}`);
  tocador.volume = 0.6;
  tocador.play();
  botao.innerHTML = ic("square");
  tocador.onended = () => (botao.innerHTML = ic("play"));
}
$("#musica").onchange = atualizarDicaMusica;
$("#ouvirMusica").onclick = (ev) => tocarMusica(faixaDe($("#musica").value, estado.estilo)?.arquivo, ev.currentTarget);
// ---------- biblioteca de música (YouTube Audio Library e outras) ----------
const DE_YOUTUBE = [
  ["energetica", "Bright, Happy, Inspirational", "Pop, Dance & Electronic"],
  ["tensa", "Dramatic, Dark, Angry", "Cinematic"],
  ["ambiente", "Calm, Romantic", "Ambient, Classical"],
  ["synthwave", "Bright ou Dramatic", "Electronic (anos 80, synth)"],
  ["lofi", "Calm, Funky", "Hip Hop & Rap, R&B & Soul"],
];
async function recarregarMusicas() {
  MUSICAS = await api("/api/musicas");
  const atual = $("#musica").value;
  desenharMusica();
  if ([...$("#musica").options].some((o) => o.value === atual)) $("#musica").value = atual;
  $("#contaMusicas").textContent = `· ${MUSICAS.faixas.length}`;
}
function abrirBiblioteca() { desenharBiblioteca(); dlgMusicas.showModal(); }
function desenharBiblioteca() {
  const opClima = (atual) => Object.entries(MUSICAS.climas).map(([k, n]) => `<option value="${k}" ${k === atual ? "selected" : ""}>${esc(n)}</option>`).join("");
  $("#bibCorpo").innerHTML = `
    <div class="caixa-info">
      <b>Importar da YouTube Audio Library</b>
      <ol>
        <li>Abra o <a href="https://studio.youtube.com/" target="_blank" rel="noopener">YouTube Studio</a> e vá a <b>Audio Library</b> no menu da esquerda.</li>
        <li>Filtre por <b>Attribution not required</b> e pelo clima que procura (tabela abaixo). Clique em baixar.</li>
        <li>Arraste aqui os MP3. O título e o artista vêm do nome do arquivo, o clima é sugerido pela análise do som e o volume é normalizado.</li>
      </ol>
      <table class="tabela"><tr><th>Clima aqui</th><th>Mood no YouTube</th><th>Género</th></tr>
        ${DE_YOUTUBE.map(([k, mood, genero]) => `<tr><td>${esc(MUSICAS.climas[k])}</td><td>${mood}</td><td>${genero}</td></tr>`).join("")}</table>
      <div class="dica" style="margin-top:8px">Se a faixa pedir atribuição, cole o texto em "Crédito": aparece no vídeo pronto, para copiar para a descrição.</div>
    </div>
    <label class="zona-ficheiros" id="zonaMusica" style="margin-top:14px">
      ${ic("upload", 20)}<div style="margin-top:6px">Arraste ou escolha os arquivos de áudio</div>
      <input type="file" id="ficheirosMusica" accept="audio/*" multiple>
    </label>
    <div class="linha" style="margin-top:8px"><label class="rotulo" style="margin:0;white-space:nowrap">Clima das faixas novas</label>
      <select id="climaImportar"><option value="">Detetar automaticamente</option>${opClima("")}</select></div>
    <div id="filaImportar"></div>
    ${Object.entries(MUSICAS.climas).map(([k, nome]) => {
      const faixas = MUSICAS.faixas.filter((f) => f.clima === k);
      return `<h3 class="secao-titulo" style="margin:22px 0 8px">${esc(nome)} <span class="contador">${faixas.length}</span></h3>
        ${faixas.length ? faixas.map((f) => `
        <div class="faixa" data-arquivo="${esc(f.arquivo)}">
          <button class="btn icone peq" title="Ouvir" onclick="tocarMusica('${esc(f.arquivo)}', this)">${ic("play", 14)}</button>
          <div class="faixa-campos">
            <div class="linha"><input data-c="titulo" value="${esc(f.nome)}" placeholder="Título"><input data-c="artista" value="${esc(f.artista)}" placeholder="Artista"></div>
            <div class="linha"><input data-c="credito" value="${esc(f.credito)}" placeholder="Crédito para a descrição (se a licença pedir)"><select data-c="clima" style="width:170px">${opClima(f.clima)}</select></div>
            <div class="meta">${esc(f.origem)}${f.bpm ? ` · ${f.bpm} BPM` : ""}${f.duracaoS ? ` · ${Math.round(f.duracaoS)} s` : ""}</div>
          </div>
          <button class="btn fantasma icone peq" title="Apagar" onclick="apagarFaixa('${esc(f.arquivo)}')">${ic("trash-2", 14)}</button>
        </div>`).join("") : '<div class="meta" style="padding:4px 0">Sem faixas.</div>'}`;
    }).join("")}`;
  // edições guardam sozinhas ao sair do campo
  document.querySelectorAll(".faixa").forEach((el) => el.querySelectorAll("[data-c]").forEach((c) => (c.onchange = () => guardarFaixa(el))));
  const zona = $("#zonaMusica");
  zona.ondragover = (ev) => { ev.preventDefault(); zona.classList.add("arrastar"); };
  zona.ondragleave = () => zona.classList.remove("arrastar");
  zona.ondrop = (ev) => { ev.preventDefault(); zona.classList.remove("arrastar"); importarFaixas([...ev.dataTransfer.files]); };
  $("#ficheirosMusica").onchange = (ev) => importarFaixas([...ev.target.files]);
}
async function importarFaixas(ficheiros) {
  ficheiros = ficheiros.filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f.name));
  if (!ficheiros.length) return toast("Escolha arquivos de áudio (mp3, wav, m4a, ogg)", "triangle-alert");
  const fila = $("#filaImportar");
  fila.innerHTML = ficheiros.map((f, i) => `<div class="meta" id="imp${i}">${ic("loader", 12)} ${esc(f.name)}</div>`).join("");
  const clima = $("#climaImportar").value;
  let ok = 0;
  for (const [i, f] of ficheiros.entries()) {
    try {
      const r = await fetch(`/api/musicas/importar?nome=${encodeURIComponent(f.name)}${clima ? `&clima=${clima}` : ""}`, { method: "POST", body: f });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      $(`#imp${i}`).innerHTML = `${ic("check", 12)} ${esc(d.titulo)} → ${esc(MUSICAS.climas[d.clima])} (${d.bpm} BPM)`;
      ok++;
    } catch (e) {
      $(`#imp${i}`).innerHTML = `${ic("triangle-alert", 12)} ${esc(f.name)}: ${esc(e.message)}`;
    }
  }
  await recarregarMusicas();
  const resumo = fila.innerHTML;
  desenharBiblioteca();
  $("#filaImportar").innerHTML = resumo;
  toast(`${ok} de ${ficheiros.length} faixas importadas`, "music");
}
async function guardarFaixa(el) {
  const v = (c) => el.querySelector(`[data-c="${c}"]`).value.trim();
  try {
    await api("/api/musicas", { method: "PATCH", body: { arquivo: el.dataset.arquivo, titulo: v("titulo"), artista: v("artista"), credito: v("credito"), clima: v("clima") } });
    await recarregarMusicas();
    if (el.querySelector('[data-c="clima"]').value !== el.closest("[data-arquivo]").dataset.arquivo.split("/")[1]) desenharBiblioteca();
    toast("Faixa atualizada", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function apagarFaixa(arquivo) {
  if (!confirm("Apagar esta faixa da biblioteca?")) return;
  try {
    await api(`/api/musicas?arquivo=${encodeURIComponent(arquivo)}`, { method: "DELETE" });
    await recarregarMusicas();
    desenharBiblioteca();
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// só os estilos em uso aparecem para escolher (os ocultos continuam a renderizar vídeos antigos)
const estilosVisiveis = (atual) => Object.entries(OPCOES.estilos).filter(([k, e]) => !e.oculto || k === atual);
function desenharEstilos() {
  if (OPCOES.estilos[estado.estilo]?.oculto) estado.estilo = "neon";
  $("#estilos").innerHTML = estilosVisiveis().map(([k, e]) => `
    <button class="estilo ${k === estado.estilo ? "ativo" : ""}" data-k="${k}" title="${esc(e.descricao)}">
      <img src="/miniaturas/${k}.jpg" alt="" loading="lazy"><span>${esc(e.nome)}</span>
    </button>`).join("");
  $("#estiloDesc").textContent = OPCOES.estilos[estado.estilo]?.descricao ?? "";
  document.querySelectorAll(".estilo").forEach((el) => (el.onclick = () => { estado.estilo = el.dataset.k; desenharEstilos(); atualizarDicaMusica(); }));
}

// ---------- modo automático ----------
let autoDados = null;
async function abrirAuto() { await carregarAuto(); }
async function carregarAuto() {
  try { autoDados = await api("/api/automatico"); desenharAuto(); } catch (e) { toast(e.message, "triangle-alert"); }
}
function desenharAuto() {
  const { config: cfg, estado: est, youtube: yt } = autoDados;
  const opcoesEstilo = (atual) => estilosVisiveis(atual).map(([k, e]) => `<option value="${k}" ${k === atual ? "selected" : ""}>${esc(e.nome)}</option>`).join("");
  const canaisHtml = Object.entries(cfg.canais).map(([id, c]) => {
    const info = OPCOES.canais?.[id] ?? { nome: id, arroba: "" };
    const ligado = yt.canais[id];
    return `<div class="caixa-info" data-canal="${id}" style="margin-top:12px">
      <div class="linha" style="justify-content:space-between"><b>${esc(info.nome)} <span class="meta">${esc(info.arroba)}</span></b>
        <label class="interruptor" style="margin:0"><span>Ativo</span><input type="checkbox" data-a="ativo" ${c.ativo ? "checked" : ""}></label></div>
      <div class="grid2" style="margin-top:10px">
        <div class="campo"><label class="rotulo">Vídeos por dia</label><select data-a="quantidade">${[1, 2, 3].map((n) => `<option ${n === c.quantidade ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="campo"><label class="rotulo">Estilo</label><select data-a="estilo">${opcoesEstilo(c.estilo)}</select></div>
      </div>
      <div class="campo"><label class="rotulo">Horários de publicação (um por vídeo)</label>
        <div class="linha">${[0, 1, 2].map((k) => `<input type="time" data-h="${k}" value="${c.horarios[k] ?? ""}" style="width:110px">`).join("")}</div></div>
      <div class="campo"><label class="interruptor"><span>Animação 3D low poly em vez de fotos</span><input type="checkbox" data-a="lowpoly" ${c.lowpoly ? "checked" : ""}></label></div>
      <div class="campo"><label class="interruptor"><span>Publicar no YouTube (agendado)</span><input type="checkbox" data-a="publicarYoutube" ${c.publicarYoutube ? "checked" : ""}></label></div>
      <div class="linha" style="justify-content:space-between">
        <span class="meta">${ligado ? `${ic("check", 14)} YouTube: ${esc(ligado.titulo)}` : yt.configurado ? "YouTube não conectado" : "Faltam as credenciais da Google (Chaves de API)"}</span>
        ${ligado ? `<button class="btn fantasma peq" onclick="desligarYoutube('${id}')">Desligar</button>` : `<button class="btn peq" onclick="ligarYoutube('${id}')">${ic("upload", 14)}${yt.configurado ? "Conectar YouTube" : "Configurar YouTube"}</button>`}
      </div>
    </div>`;
  }).join("");
  const hist = (cfg.historico ?? []).slice(0, 25).map((h) => `<div style="font-size:12px;padding:6px 0;border-top:1px solid var(--borda)">
      <div><b>${esc(OPCOES.canais?.[h.canal]?.nome ?? h.canal)}</b> · ${esc(h.titulo ?? "")}</div>
      <div class="meta">${esc(h.estado ?? "")}${h.publicarEm ? ` · publica ${new Date(h.publicarEm).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}${h.youtube ? ` · <a href="${esc(h.youtube)}" target="_blank" rel="noopener" style="color:var(--acento)">ver</a>` : ""}</div>
    </div>`).join("") || '<div class="meta">Ainda não correu.</div>';
  $("#autoCorpo").innerHTML = `
    <div class="caixa-info">
      <label class="interruptor" style="margin:0"><span><b>Ativar o modo automático</b></span><input type="checkbox" id="autoAtivo" ${cfg.ativo ? "checked" : ""}></label>
      <div class="campo" style="margin-top:10px"><label class="rotulo">Corre todos os dias às</label><input type="time" id="autoHora" value="${cfg.hora}" style="width:120px"></div>
      <div class="dica">Para cada canal ativo: pesquisa os assuntos do momento, escolhe os melhores, escreve e produz cada vídeo (com o editor-chefe e a revisão visual) e agenda-o no YouTube para os horários do canal. Não publica vídeos com erros por resolver nem com problemas graves na revisão visual. O PC tem de estar ligado e o painel aberto; se estiver desligado à hora marcada, corre quando o painel abrir.</div>
      <div class="dica">Enquanto o projeto da Google não passar a auditoria do YouTube, os vídeos enviados pela API ficam privados: aparecem agendados no YouTube Studio, mas tem de os tornar públicos à mão.</div>
      ${est.aCorrer ? `<div class="linha" style="margin-top:8px;color:var(--acento)">${ic("loader", 14)}${esc(est.passo || "Rodando…")}</div>` : cfg.ultimaExecucao ? `<div class="meta" style="margin-top:8px">Última execução: ${esc(cfg.ultimaExecucao)}</div>` : ""}
    </div>
    ${canaisHtml}
    <div class="caixa-info" style="margin-top:12px"><b>Histórico</b>${hist}</div>`;
  $("#btnAutoAgora").disabled = est.aCorrer;
}
function lerAuto() {
  const canais = {};
  document.querySelectorAll("#autoCorpo [data-canal]").forEach((el) => {
    const v = (k) => el.querySelector(`[data-a="${k}"]`);
    canais[el.dataset.canal] = {
      ativo: v("ativo").checked, quantidade: Number(v("quantidade").value), estilo: v("estilo").value, lowpoly: v("lowpoly").checked, publicarYoutube: v("publicarYoutube").checked,
      horarios: [...el.querySelectorAll("[data-h]")].map((i) => i.value).filter(Boolean),
    };
  });
  return { ativo: $("#autoAtivo").checked, hora: $("#autoHora").value || "07:00", canais };
}
async function guardarAuto() {
  try {
    await api("/api/automatico", { method: "PUT", body: lerAuto() });
    toast($("#autoAtivo").checked ? `Modo automático ativado: roda todos os dias às ${$("#autoHora").value}` : "Modo automático desligado", "check");
    atualizarSeloAuto();
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function correrAutoAgora() {
  if (!confirm("Correr o modo automático agora? Vai pesquisar, produzir e agendar no YouTube os vídeos de cada canal ativo.")) return;
  try {
    await api("/api/automatico", { method: "PUT", body: lerAuto() });
    await api("/api/automatico/correr", { method: "POST" });
    toast("Modo automático rodando", "play");
    setTimeout(carregarAuto, 1500);
    atualizarJobs();
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function ligarYoutube(canal) {
  // sem as credenciais da app Google não há como ligar: leva o criador ao sítio onde as põe
  if (!autoDados?.youtube.configurado) {
    irPara("configuracoes");
    $("#googleId").focus();
    return toast("Primeiro cole o Client ID e o Client secret da Google (as instruções estão por baixo do campo). Depois volte ao Modo automático.", "key-round");
  }
  try {
    await api("/api/automatico", { method: "PUT", body: lerAuto() });
    const { url } = await api(`/api/youtube/ligar?canal=${canal}`);
    window.open(url, "_blank");
    toast("Autorize na janela da Google e escolha o canal do YouTube. Depois volte aqui.", "external-link");
    const vigia = setInterval(async () => {
      const d = await api("/api/automatico").catch(() => null);
      if (d?.youtube.canais[canal]) { clearInterval(vigia); autoDados = d; desenharAuto(); toast(`YouTube conectado: ${d.youtube.canais[canal].titulo}`, "check"); }
    }, 3000);
    setTimeout(() => clearInterval(vigia), 5 * 60 * 1000);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function desligarYoutube(canal) {
  if (!confirm("Desconectar este canal do YouTube?")) return;
  await api("/api/youtube/desligar", { method: "POST", body: { canal } });
  carregarAuto();
}
async function atualizarSeloAuto() {
  try { const d = await api("/api/automatico"); $("#autoSelo").textContent = d.estado.aCorrer ? "· rodando" : d.config.ativo ? `· ${d.config.hora}` : ""; } catch {}
}

// canais (src/canais.json): cada um tem o seu logo e @ na marca d'água
const opcoesCanal = (atual) => Object.entries(OPCOES.canais ?? {}).map(([k, c]) => `<option value="${k}" ${k === atual ? "selected" : ""}>${esc(c.nome)} (${esc(c.arroba)})</option>`).join("")
  + `<option value="nenhum" ${atual === "nenhum" ? "selected" : ""}>Sem marca d'água</option>`;
const primeiroCanal = () => Object.keys(OPCOES.canais ?? {})[0] ?? "nenhum";
function desenharCanais(escolher) {
  let guardado = escolher ?? primeiroCanal();
  if (!escolher) try { guardado = localStorage.canal || guardado; } catch {}
  $("#canal").innerHTML = opcoesCanal(guardado);
  if (!$("#canal").value || ($("#canal").value !== "nenhum" && !OPCOES.canais?.[$("#canal").value])) $("#canal").value = primeiroCanal();
  try { localStorage.canal = $("#canal").value; } catch {}
  desenharSeletorCanal();
}

// menu do canal no topo: logo, nome e @ de cada canal, com teclado (setas, Enter, Esc)
const logoMini = (c) => c ? `<img src="/public/${esc(c.logo)}" alt="" style="image-rendering:${c.pixelado ? "pixelated" : "auto"}">` : ic("eye-off", 14);
function desenharSeletorCanal() {
  const atual = $("#canal").value, c = OPCOES.canais?.[atual];
  $("#canalAtualLogo").innerHTML = logoMini(c);
  $("#canalAtualNome").textContent = c ? c.nome : "Sem marca d'água";
  $("#btnCanal").setAttribute("aria-label", `Canal: ${c ? c.nome : "sem marca d'água"}. Trocar canal`);
  const itens = [...Object.entries(OPCOES.canais ?? {}).map(([id, k]) => [id, k]), ["nenhum", null]];
  $("#menuCanal").innerHTML = itens.map(([id, k]) => `
    <div role="option" tabindex="-1" data-canal="${esc(id)}" aria-selected="${id === atual}">
      <span class="canal-mini">${logoMini(k)}</span>
      <span><b>${esc(k ? k.nome : "Sem marca d'água")}</b><small>${esc(k ? k.arroba : "O vídeo sai sem logo nem @")}</small></span>
      <i class="i marcado" style="--u:url(/icones/check.svg)"></i>
    </div>`).join("") + `<hr><button type="button" class="acao-menu" data-acao="gerir" tabindex="-1">${ic("settings", 16)}Gerir canais</button>`;
}
function abrirMenuCanal(focarPrimeiro = false) {
  $("#menuCanal").hidden = false;
  $("#btnCanal").setAttribute("aria-expanded", "true");
  const itens = [...$("#menuCanal").querySelectorAll("[role=option], .acao-menu")];
  const alvo = focarPrimeiro ? itens[0] : itens.find((i) => i.getAttribute("aria-selected") === "true") ?? itens[0];
  focarItemCanal(alvo);
}
function fecharMenuCanal(devolverFoco = false) {
  $("#menuCanal").hidden = true;
  $("#btnCanal").setAttribute("aria-expanded", "false");
  if (devolverFoco) $("#btnCanal").focus();
}
function focarItemCanal(el) {
  $("#menuCanal").querySelectorAll(".foco").forEach((x) => x.classList.remove("foco"));
  if (!el) return;
  el.classList.add("foco");
  el.focus();
}
function escolherItemCanal(el) {
  if (!el) return;
  if (el.dataset.acao === "gerir") { fecharMenuCanal(); return irPara("canais"); }
  $("#canal").value = el.dataset.canal;
  mudouCanal();
  fecharMenuCanal(true);
  toast(`Canal: ${OPCOES.canais?.[el.dataset.canal]?.nome ?? "sem marca d'água"}`, "check");
}
$("#btnCanal").addEventListener("click", () => ($("#menuCanal").hidden ? abrirMenuCanal() : fecharMenuCanal()));
$("#btnCanal").addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); abrirMenuCanal(); } });
$("#menuCanal").addEventListener("click", (e) => escolherItemCanal(e.target.closest("[role=option], .acao-menu")));
$("#menuCanal").addEventListener("keydown", (e) => {
  const itens = [...$("#menuCanal").querySelectorAll("[role=option], .acao-menu")];
  const i = itens.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); focarItemCanal(itens[(i + 1) % itens.length]); }
  else if (e.key === "ArrowUp") { e.preventDefault(); focarItemCanal(itens[(i - 1 + itens.length) % itens.length]); }
  else if (e.key === "Home") { e.preventDefault(); focarItemCanal(itens[0]); }
  else if (e.key === "End") { e.preventDefault(); focarItemCanal(itens.at(-1)); }
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolherItemCanal(document.activeElement); }
  else if (e.key === "Escape" || e.key === "Tab") { fecharMenuCanal(e.key === "Escape"); }
});
document.addEventListener("click", (e) => { if (!$("#menuCanal").hidden && !e.target.closest(".seletor-canal-caixa")) fecharMenuCanal(); });

// ---------- criar e editar canais (nome, @, logo e nicho) ----------
let canalEmEdicao = null, logoRascunho = null, logoOpaca = false;
function abrirCanais() {
  desenharListaCanais();
  fecharFormCanal();
}
function fecharFormCanal() { $("#formCanal").hidden = true; $("#btnNovoCanal").hidden = false; }
function desenharListaCanais() {
  const atual = $("#canal").value;
  $("#canaisLista").innerHTML = Object.entries(OPCOES.canais ?? {}).map(([id, c]) => `
    <div class="canal-cartao ${id === atual ? "atual" : ""}">
      <img class="canal-logo" src="/public/${esc(c.logo)}" alt="" style="image-rendering:${c.pixelado ? "pixelated" : "auto"}">
      <div style="flex:1;min-width:0">
        <div class="linha" style="justify-content:space-between;gap:8px"><b>${esc(c.nome)}</b><span class="meta">${esc(c.arroba)}</span></div>
        <div class="meta" style="margin-top:4px;font-size:12px">${c.nicho ? esc(c.nicho) : "<i>Sem nicho: as ideias ficam genéricas</i>"}</div>
        <div class="linha" style="gap:6px;margin-top:8px">
          <button class="btn peq" onclick="usarCanal('${esc(id)}')">${id === atual ? "Em uso" : "Usar"}</button>
          <button class="btn fantasma peq" onclick="editarCanal('${esc(id)}')">${ic("pencil", 14)}Editar</button>
          <button class="btn fantasma peq" onclick="apagarCanal('${esc(id)}')" title="Apagar canal" aria-label="Apagar canal">${ic("trash-2", 14)}</button>
        </div>
      </div>
    </div>`).join("");
}
function usarCanal(id) { desenharCanais(id); desenharListaCanais(); toast(`Canal em uso: ${OPCOES.canais[id].nome}`, "check"); }
function editarCanal(id) {
  canalEmEdicao = id ?? null; logoRascunho = null;
  const c = id ? OPCOES.canais[id] : {};
  $("#tituloFormCanal").textContent = id ? `Editar ${c.nome}` : "Novo canal";
  $("#canalNome").value = c.nome ?? ""; $("#canalArroba").value = c.arroba ?? ""; $("#canalNicho").value = c.nicho ?? "";
  $("#canalCategoria").value = String(c.categoriaYoutube ?? 22); $("#canalPixelado").checked = Boolean(c.pixelado);
  $("#canalLogo").value = "";
  $("#formCanal").hidden = false; $("#btnNovoCanal").hidden = true;
  previsualizarMarca();
  $("#canalNome").focus();
}
function previsualizarMarca() {
  const logo = logoRascunho ?? (canalEmEdicao ? OPCOES.canais[canalEmEdicao]?.logo : null);
  let arroba = $("#canalArroba").value.trim().replace(/\s+/g, "");
  if (arroba && !arroba.startsWith("@")) arroba = `@${arroba}`;
  const redonda = logoRascunho ? logoOpaca : Boolean(OPCOES.canais?.[canalEmEdicao]?.redonda);
  $("#marcaPrevia").innerHTML = `${logo ? `<img src="/public/${esc(logo)}" alt="" class="${redonda ? "redonda" : ""}" style="image-rendering:${$("#canalPixelado").checked ? "pixelated" : "auto"}">` : ""}<span>${esc(arroba || "@seucanal")}</span>`;
}
async function enviarLogoCanal() {
  const f = $("#canalLogo").files[0];
  if (!f) return;
  try {
    toast("Preparando a logo…", "image");
    const d = await enviarComProgresso(`/api/canais/logo?nome=${encodeURIComponent(f.name)}&fundo=${$("#canalSemFundo").checked ? "remover" : "manter"}`, f);
    logoRascunho = d.logo;
    logoOpaca = Boolean(d.opaca);
    previsualizarMarca();
    toast(d.fundoRemovido ? "Logo pronta, sem o fundo" : $("#canalSemFundo").checked ? "Logo pronta (não havia um fundo liso para tirar)" : "Logo pronta", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function guardarCanal() {
  $("#btnGuardarCanal").disabled = true;
  try {
    const d = await api("/api/canais", { method: "POST", body: {
      id: canalEmEdicao, nome: $("#canalNome").value, arroba: $("#canalArroba").value, nicho: $("#canalNicho").value,
      categoriaYoutube: Number($("#canalCategoria").value), pixelado: $("#canalPixelado").checked, logo: logoRascunho, redonda: logoOpaca,
    } });
    OPCOES.canais = d.canais;
    desenharCanais(d.id);
    desenharListaCanais();
    fecharFormCanal();
    toast(canalEmEdicao ? "Canal atualizado" : "Canal criado e em uso", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#btnGuardarCanal").disabled = false;
}
async function apagarCanal(id) {
  if (!confirm(`Apagar o canal ${OPCOES.canais[id].nome}? Os vídeos já feitos não mudam; os roteiros dele passam a usar outro canal.`)) return;
  try {
    const d = await api(`/api/canais/${encodeURIComponent(id)}`, { method: "DELETE" });
    OPCOES.canais = d.canais;
    desenharCanais($("#canal").value === id ? primeiroCanal() : $("#canal").value);
    desenharListaCanais();
    toast("Canal apagado", "trash-2");
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function desenharVozes() {
  const sel = $("#voz"), aviso = $("#avisoVoz");
  aviso.hidden = true;
  $("#ouvir").hidden = estado.narracao !== "elevenlabs";
  if (estado.narracao === "chatterbox") {
    if (!OPCOES.temChatterbox) {
      sel.innerHTML = "";
      aviso.hidden = false;
      aviso.innerHTML = `${ic("triangle-alert", 14)}<span>O Chatterbox não está instalado neste computador (falta o ambiente .venv-voz).</span>`;
      return;
    }
    sel.innerHTML = opcoesVozChatterbox();
    aviso.hidden = false;
    aviso.innerHTML = `${ic("mic", 14)}<span>Voz local e grátis, na placa gráfica. Para clonar uma voz, envie 10 a 30 s de fala limpa (a sua, ou de quem autorizar): <label class="btn peq" style="margin:4px 0 0">${ic("upload", 14)}Enviar amostra<input type="file" accept="audio/*" hidden onchange="enviarAmostraVoz(this.files[0])"></label></span>`;
    return;
  }
  if (estado.narracao === "edge") {
    sel.innerHTML = OPCOES.vozesEdge.map((v) => `<option value="${v.id}">${esc(v.nome)}</option>`).join("");
    sel.value = $("#pais").value.startsWith("Portugal") ? "pt-PT-DuarteNeural" : "pt-BR-AntonioNeural";
    return;
  }
  if (!OPCOES.temElevenLabs) {
    sel.innerHTML = "";
    aviso.hidden = false;
    aviso.innerHTML = `${ic("key-round", 14)}<span>Adicione a chave da ElevenLabs em Chaves de API.</span>`;
    return;
  }
  try {
    await carregarVozesEleven();
    sel.innerHTML = opcoesVozEleven();
    if (vozesEleven.plano === "grátis") {
      aviso.hidden = false;
      aviso.innerHTML = `${ic("info", 14)}<span>Plano grátis: só as vozes "Falam português" e as suas funcionam. As da biblioteca precisam de um plano pago.</span>`;
    }
  } catch (e) {
    aviso.hidden = false;
    aviso.innerHTML = `${ic("triangle-alert", 14)}<span>Não consegui listar as vozes: ${esc(e.message)}</span>`;
  }
}
// Chatterbox: a voz própria dele e as vozes clonadas (amostras em public/vozes)
function opcoesVozChatterbox(atual) {
  const vozes = [{ id: "padrao", nome: "Voz própria do Chatterbox" }, ...(OPCOES.vozesChatterbox ?? []).map((v) => ({ ...v, nome: `Clonada: ${v.nome}` }))];
  return vozes.map((v) => `<option value="${esc(v.id)}" ${v.id === atual ? "selected" : ""}>${esc(v.nome)}</option>`).join("");
}
async function enviarAmostraVoz(ficheiro) {
  if (!ficheiro) return;
  const nome = prompt("Nome desta voz (ex.: Tayson)", ficheiro.name.replace(/\.\w+$/, ""));
  if (!nome) return;
  try {
    toast("Enviando a amostra…", "upload");
    const r = await fetch(`/api/upload?nome=${encodeURIComponent(ficheiro.name)}&voz=${encodeURIComponent(nome)}`, { method: "POST", body: ficheiro });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro ?? "Não consegui salvar a amostra");
    OPCOES.vozesChatterbox = d.vozes;
    await desenharVozes();
    $("#voz").value = d.caminho;
    toast("Voz salva", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function carregarVozesEleven() { vozesEleven ??= await api("/api/elevenlabs/vozes"); }
// opções agrupadas: "Falam português" primeiro; as que o plano não permite ficam desativadas
function opcoesVozEleven(atual) {
  const preferido = $("#pais").value.startsWith("Portugal") ? "Português (Portugal)" : "Português (Brasil)";
  const ordem = (g) => (g === "Falam português" ? 0 : g === preferido ? 1 : g.startsWith("Português") ? 2 : 3);
  const grupos = [...new Set(vozesEleven.vozes.map((v) => v.grupo))].sort((a, b) => ordem(a) - ordem(b));
  return grupos.map((g) => `<optgroup label="${esc(g)}${vozesEleven.vozes.filter((v) => v.grupo === g).every((v) => v.bloqueada) ? " (plano pago)" : ""}">${vozesEleven.vozes.filter((v) => v.grupo === g)
    .map((v) => `<option value="${esc(v.id)}" ${v.bloqueada ? "disabled" : ""} ${v.id === atual ? "selected" : ""}>${esc(v.nome)}${v.detalhe ? ` · ${esc(v.detalhe)}` : ""}${v.descricao ? ` · ${esc(v.descricao)}` : ""}</option>`).join("")}</optgroup>`).join("");
}
$("#ouvir").onclick = () => {
  const v = vozesEleven?.vozes.find((x) => x.id === $("#voz").value);
  if (v?.preview) new Audio(v.preview).play();
};
$("#pais").onchange = () => desenharVozes();

function abrirConfig() {
  $("#chave").value = ""; $("#chavePixabay").value = ""; $("#chaveSketchfab").value = "";
  $("#estadoSketchfab").textContent = OPCOES.temSketchfab ? "· configurada" : "";
  $("#estadoEleven").textContent = OPCOES.temElevenLabs ? "· configurada" : "";
  $("#estadoPixabay").textContent = OPCOES.temPixabay ? "· configurada" : "";
  $("#estadoGoogle").textContent = OPCOES.temGoogle ? "· configurada" : ""; $("#estadoClaude").textContent = OPCOES.temClaudeToken ? "· configurado" : ""; $("#tokenClaude").value = ""; $("#googleId").value = ""; $("#googleSegredo").value = "";
}
async function guardarChave() {
  try {
    const eleven = $("#chave").value.trim(), pixabay = $("#chavePixabay").value.trim(), sketchfab = $("#chaveSketchfab").value.trim();
    const gId = $("#googleId").value.trim(), gSeg = $("#googleSegredo").value.trim(), tClaude = $("#tokenClaude").value.trim();
    await api("/api/chaves", { method: "POST", body: { ELEVENLABS_API_KEY: eleven, PIXABAY_API_KEY: pixabay, SKETCHFAB_API_TOKEN: sketchfab, GOOGLE_CLIENT_ID: gId, GOOGLE_CLIENT_SECRET: gSeg, CLAUDE_CODE_OAUTH_TOKEN: tClaude } });
    if (tClaude) OPCOES.temClaudeToken = true;
    if (gId && gSeg) OPCOES.temGoogle = true;
    if (sketchfab) OPCOES.temSketchfab = true;
    if (eleven) { OPCOES.temElevenLabs = true; vozesEleven = null; }
    if (pixabay) OPCOES.temPixabay = true;
    abrirConfig(); toast("Chaves salvas", "check");
    desenharVozes();
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// envia um ficheiro em bruto com a percentagem no aviso (XMLHttpRequest dá o progresso do envio; o fetch não)
function enviarComProgresso(url, ficheiro) {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    x.setRequestHeader("X-Painel", "1");
    let ultimo = -1;
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total < 5e6) return; // ficheiros pequenos: não vale a pena
      const p = Math.floor((e.loaded / e.total) * 20) * 5;
      if (p !== ultimo) { ultimo = p; toast(`Enviando ${ficheiro.name}… ${p}% de ${(e.total / 1e6).toFixed(0)} MB`, "upload"); }
    };
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch { /* resposta vazia */ }
      x.status >= 200 && x.status < 300 ? ok(d) : falha(new Error(d.erro || `Envio falhou (${x.status})`));
    };
    x.onerror = () => falha(new Error("A conexão com o painel caiu durante o envio"));
    x.send(ficheiro);
  });
}
// envia um ficheiro em bruto para public/uploads e devolve o caminho
async function enviarFicheiro(ficheiro) {
  return (await enviarComProgresso(`/api/upload?nome=${encodeURIComponent(ficheiro.name)}`, ficheiro)).caminho;
}

// ---------- roteiro escrito noutra IA ----------
// usa as mesmas escolhas do formulário (formato, estilo, narração, duração…)
const pedidoAtual = () => ({
  formato: formatoEnvio(), tema: $("#tema").value.trim(), estilo: estado.estilo, produtos: estado.produtos, pais: $("#pais").value,
  narracao: estado.narracao, voz: $("#voz").value, observacoes: $("#obs").value.trim(), musica: $("#musica").value, duracao: estado.duracao,
  canal: $("#canal").value, lowpoly: lowpolyEnvio(),
});
function abrirOutraIA() {
  const p = pedidoAtual();
  if (estado.formato === "clipe") return toast("Os clipes não precisam de roteiro", "scissors");
  if (!p.tema) { $("#tema").focus(); return toast("Escreva primeiro o tema do vídeo", "pencil"); }
  $("#outraIAResumo").textContent = `${nomeFormato(p.formato)} · ${OPCOES.estilos[p.estilo]?.nome ?? p.estilo} · ${p.tema}`;
  dlgOutraIA.showModal();
}
async function copiarPromptExterno() {
  try {
    const { texto } = await api("/api/prompt-externo", { method: "POST", body: pedidoAtual() });
    await navigator.clipboard.writeText(texto);
    toast("Prompt copiado", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function importarRoteiroIA() {
  const texto = $("#respostaIA").value.trim();
  if (!texto) return toast("Cole a resposta da IA", "clipboard-paste");
  if (estado.narracao === "elevenlabs" && !$("#voz").value) return toast("Escolha uma voz da ElevenLabs", "triangle-alert");
  $("#importarIA").disabled = true;
  try {
    await api("/api/importar-roteiro", { method: "POST", body: { ...pedidoAtual(), texto } });
    $("#respostaIA").value = ""; $("#tema").value = ""; $("#obs").value = "";
    dlgOutraIA.close();
    toast("Importado. Validando e buscando mídia.", "check");
    atualizarJobs();
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#importarIA").disabled = false;
}

async function criar() {
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  const tema = $("#tema").value.trim();
  if (estado.formato === "clipe" && $("#modoCortes").checked) return analisarCortes();
  if (!tema) { $("#tema").focus(); return toast(estado.formato === "clipe" ? "Dê um título ao vídeo" : "Escreva o tema do vídeo", "pencil"); }
  $("#criar").disabled = true;
  try {
    if (estado.formato === "clipe") {
      const ficheiros = [...$("#ficheirosClipe").files];
      if (!ficheiros.length) throw new Error("Escolha pelo menos um vídeo");
      toast("Enviando os vídeos…", "upload");
      const arquivos = [];
      for (const f of ficheiros) arquivos.push(await enviarFicheiro(f));
      await api("/api/jobs", { method: "POST", body: {
        formato: "clipe", tema, estilo: estado.estilo, canal: $("#canal").value, arquivos, musica: $("#musica").value, cortar: $("#cortar").checked, destaques: $("#destaquesClipe").value, enquadrar: $("#enquadrar").checked, exemplos: $("#exemplos").checked, gameplay: $("#gameplay").value,
      } });
      $("#ficheirosClipe").value = ""; $("#nomesClipe").textContent = "Escolha os vídeos (pela ordem em que entram)";
      toast("Cortando e legendando", "scissors");
    } else {
      if (estado.narracao === "elevenlabs" && !$("#voz").value) throw new Error("Escolha uma voz da ElevenLabs");
      await api("/api/jobs", { method: "POST", body: {
        formato: formatoEnvio(), tema, estilo: estado.estilo, produtos: estado.produtos, pais: $("#pais").value, narracao: estado.narracao,
        voz: $("#voz").value, observacoes: $("#obs").value.trim(), revisar: $("#revisar").checked, musica: $("#musica").value,
        duracao: estado.duracao, editorChefe: $("#editorChefe").checked, revisaoVisual: $("#revisaoVisual").checked, canal: $("#canal").value, lowpoly: lowpolyEnvio(),
      } });
      toast("Na fila. O Claude está pesquisando.", "search");
    }
    $("#tema").value = ""; $("#obs").value = "";
    atualizarJobs();
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#criar").disabled = false;
}

// ---------- fila ----------
const ETAPAS = [["roteiro", "Roteiro"], ["editor", "Editor"], ["midia", "Mídia"], ["aguardando revisao", "Revisão"], ["clipes", "Cortes"], ["narracao", "Narração"], ["render", "Render"], ["pronto", "Pronto"]];
const NOME_ESTADO = { "na fila": "Na fila", "na fila de render": "Aguardando render", roteiro: "Escrevendo o roteiro", editor: "Editor-chefe revisando", midia: "Buscando mídia", "aguardando revisao": "Aguardando sua revisão", clipes: "Cortando e legendando", narracao: "Narrando", render: "Renderizando", pronto: "Pronto", erro: "Falhou", parado: "Parado" };
const nomeFormato = (k) => FORMATOS.find(([f]) => f === k)?.[2] ?? "";
let jobsAntes = {}, logsAbertos = new Set();
let filaDesenhada = "";
async function atualizarJobs() {
  const analisando = await seguirAnalises().catch(() => 0);
  const jobs = await api("/api/jobs");
  const ativos = jobs.filter((j) => j.estado !== "pronto" || Date.now() - j.criado < 10 * 60e3);
  const emCurso = ativos.filter((j) => !["pronto", "erro", "parado"].includes(j.estado)).length + analisando;
  $("#pararTudo").hidden = ativos.filter((j) => !["pronto", "erro", "parado", "aguardando revisao"].includes(j.estado)).length < 2;
  $("#contaFila").textContent = emCurso;
  $("#chipFila").hidden = !emCurso;
  $("#textoChipFila").textContent = `${emCurso} em produção`;
  document.title = emCurso ? `(${emCurso}) Studioware` : "Studioware";
  avisarSistema(jobs);
  const assinatura = JSON.stringify([ativos.map((j) => [j.id, j.estado, j.progresso, j.log.length]), [...logsAbertos]]);
  if (assinatura === filaDesenhada) return finalizarJobs(jobs);
  filaDesenhada = assinatura;
  $("#jobs").innerHTML = ativos.length ? ativos.map((j) => {
    const etapas = ETAPAS.filter(([k]) =>
      (k !== "aguardando revisao" || j.revisar) && (k !== "clipes" || j.formato === "clipe") &&
      (j.formato !== "clipe" || !["roteiro", "narracao"].includes(k)) && (j.tipo === "novo" || !["roteiro", "aguardando revisao", "editor"].includes(k)) && (k !== "editor" || j.editorChefe !== false));
    const chave = j.estado === "na fila de render" ? etapas[0]?.[0] : j.estado;
    const atual = etapas.findIndex(([k]) => k === chave);
    const ponto = j.estado === "pronto" ? "ok" : j.estado === "erro" ? "erro" : j.estado === "parado" ? "parado" : j.estado === "aguardando revisao" ? "espera" : "vivo";
    const podeParar = !["pronto", "erro", "parado", "aguardando revisao"].includes(j.estado);
    return `<div class="job">
      <div class="job-linha">
        <div class="job-titulo">${esc(j.tema)}</div>
        <span class="meta">${esc(nomeFormato(j.formato))} · ${esc(OPCOES.estilos[j.estilo]?.nome ?? j.estilo ?? "")}</span>
        <span class="estado"><span class="ponto ${ponto}"></span>${NOME_ESTADO[j.estado] ?? esc(j.estado)}${j.estado === "render" ? ` ${j.progresso}%` : ""}</span>
        ${j.estado === "aguardando revisao" ? `<button class="btn primario peq" onclick="abrirEditor('${j.videoId}')">Rever roteiro</button>` : ""}
        ${podeParar ? `<button class="btn peq" title="Parar este vídeo" onclick="pararJob('${j.id}')">${ic("square", 13)}Parar</button>` : ""}
        <button class="btn fantasma icone peq" title="Ver registro" onclick="alternarLog('${j.id}')">${ic("terminal", 14)}</button>
      </div>
      <div class="etapas">${etapas.map(([k, nome], i) => {
        const cls = j.estado === "erro" || j.estado === "parado" ? (i === Math.max(0, atual) ? "falhou" : i < atual ? "feita" : "") : j.estado === "pronto" || i < atual ? "feita" : i === atual ? "agora" : "";
        const barra = cls === "agora" ? `<b style="width:${k === "render" ? j.progresso : 35}%"></b>` : "";
        return `<div class="etapa ${cls}"><i>${barra}</i><small>${nome}</small></div>`;
      }).join("")}</div>
      ${logsAbertos.has(j.id) || j.estado === "erro" ? `<div class="log">${esc(j.log.slice(-40).join("\n"))}</div>` : ""}
    </div>`;
  }).join("") : '<div class="vazio">Nada em produção.</div>';
  document.querySelectorAll(".log").forEach((l) => (l.scrollTop = l.scrollHeight));
  return finalizarJobs(jobs);
}
async function pararJob(id) {
  const j = (await api("/api/jobs")).find((x) => x.id === id);
  if (!j || !confirm(`Parar "${j.tema}"? O que já foi feito deste vídeo perde-se.`)) return;
  try { await api(`/api/jobs/${id}/parar`, { method: "POST" }); toast("Vídeo parado", "square"); }
  catch (e) { toast(e.message, "triangle-alert"); }
  filaDesenhada = ""; atualizarJobs();
}
async function pararTudo() {
  if (!confirm("Parar todos os vídeos em produção e na fila?")) return;
  try { const r = await api("/api/jobs/parar-tudo", { method: "POST" }); toast(`${r.parados} ${r.parados === 1 ? "vídeo parado" : "vídeos parados"}`, "square"); }
  catch (e) { toast(e.message, "triangle-alert"); }
  filaDesenhada = ""; atualizarJobs();
}
// avisos do Windows quando um vídeo fica pronto (ou espera revisão) e o painel não está à vista
const avisados = new Set();
function avisarSistema(jobs) {
  for (const j of jobs) {
    if (!["pronto", "aguardando revisao"].includes(j.estado) || avisados.has(j.id + j.estado)) continue;
    avisados.add(j.id + j.estado);
    if (jobsAntes[j.id] === undefined || jobsAntes[j.id] === j.estado) continue; // já estava assim quando o painel abriu
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(j.estado === "pronto" ? "Vídeo pronto" : "Roteiro aguardando sua revisão", { body: j.tema, icon: "/icones/clapperboard.svg" });
    }
  }
}
function finalizarJobs(jobs) {

  const mudou = jobs.some((j) => jobsAntes[j.id] !== j.estado && ["pronto", "aguardando revisao"].includes(j.estado));
  jobsAntes = Object.fromEntries(jobs.map((j) => [j.id, j.estado]));
  if (mudou) atualizarGaleria();
}
function alternarLog(id) { logsAbertos.has(id) ? logsAbertos.delete(id) : logsAbertos.add(id); atualizarJobs(); }

const quando = (ms) => {
  const min = Math.round((Date.now() - ms) / 60e3);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};
// ---------- catálogo de preços (um preço por produto, partilhado por todos os vídeos) ----------
const diasDesde = (d) => Math.floor((Date.now() - new Date(d + "T12:00:00").getTime()) / 86400e3);
async function abrirPrecos() { await desenharPrecos(); dlgPrecos.showModal(); }
async function desenharPrecos() {
  const cat = await api("/api/precos");
  const itens = Object.entries(cat.produtos ?? {}).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  $("#precosRegra").textContent = cat.regra ?? "";
  $("#precosTotal").textContent = itens.length ? `${itens.length} produtos` : "";
  $("#precosCorpo").innerHTML = itens.length ? itens.map(([k, p]) => {
    const dias = diasDesde(p.data);
    return `<div class="faixa" data-chave="${esc(k)}">
      <div class="faixa-campos">
        <div class="linha"><b style="font-weight:500;flex:1">${esc(p.nome)}</b><span class="meta">${esc(k)}</span></div>
        <div class="linha">
          <input data-p="preco" value="${esc(String(p.preco).replace(".", ","))}" style="width:130px">
          <input data-p="loja" value="${esc(p.loja ?? "")}" placeholder="Loja" style="width:140px">
          <input data-p="url" value="${esc(p.url ?? "")}" placeholder="Link">
          <button class="btn peq" onclick="guardarPreco('${esc(k)}')">${ic("check", 14)}Salvar</button>
        </div>
        <div class="meta">${dias > 7 ? `<span style="color:var(--aviso)">${ic("triangle-alert", 12)} desatualizado: ${dias} dias</span>` : `atualizado há ${dias} ${dias === 1 ? "dia" : "dias"}`}
          ${(p.fontes ?? []).length ? ` · também: ${(p.fontes ?? []).map((f) => `${esc(f.loja)} R$ ${esc(String(f.preco))}`).join(", ")}` : ""}
          ${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--acento)">ver na loja</a>` : ""}</div>
      </div>
      <button class="btn fantasma icone peq perigo-texto" title="Tirar do catálogo" onclick="apagarPreco('${esc(k)}')">${ic("trash-2", 14)}</button>
    </div>`;
  }).join("") : '<div class="vazio">Ainda não há preços. O Claude preenche o catálogo ao pesquisar o primeiro vídeo com produtos.</div>';
}
async function guardarPreco(chave) {
  const el = document.querySelector(`[data-chave="${chave}"]`);
  const v = (c) => el.querySelector(`[data-p="${c}"]`).value.trim();
  try { await api("/api/precos", { method: "PATCH", body: { chave, preco: v("preco"), loja: v("loja"), url: v("url") } }); toast("Preço atualizado (data de hoje)", "check"); desenharPrecos(); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
async function apagarPreco(chave) {
  if (!confirm("Tirar este produto do catálogo?")) return;
  await api(`/api/precos/${encodeURIComponent(chave)}`, { method: "DELETE" });
  desenharPrecos();
}

// ---------- seleção e lixeira ----------
let selecionando = false;
const selecionados = new Set();
function alternarSelecao() {
  selecionando = !selecionando;
  selecionados.clear();
  $("#barraSelecao").hidden = !selecionando;
  $("#btnSelecionar").hidden = selecionando;
  atualizarGaleria();
}
function marcar(id, sim) {
  sim ? selecionados.add(id) : selecionados.delete(id);
  document.querySelector(`.cartao[data-id="${id}"]`)?.classList.toggle("escolhido", sim);
  $("#textoSelecao").textContent = `${selecionados.size} selecionado${selecionados.size === 1 ? "" : "s"}`;
}
function selecionarTodos() {
  document.querySelectorAll(".cartao[data-id]").forEach((c) => { marcar(c.dataset.id, true); c.querySelector(".marca").checked = true; });
}
async function paraLixeira(ids) {
  if (!ids.length) return toast("Selecione pelo menos um vídeo", "square-check");
  try {
    const d = await api("/api/videos?acao=lixeira", { method: "POST", body: { ids } });
    toast(`${d.movidos} ${d.movidos === 1 ? "vídeo movido" : "vídeos movidos"} para a lixeira`, "trash-2");
    if (selecionando) alternarSelecao(); else atualizarGaleria();
  } catch (e) { toast(e.message, "triangle-alert"); }
}
const moverSelecionados = () => paraLixeira([...selecionados]);

async function abrirLixeira() { await desenharLixeira(); dlgLixeira.showModal(); }
async function desenharLixeira() {
  const itens = await api("/api/lixeira");
  $("#contaLixo").textContent = itens.length;
  const total = itens.reduce((t, v) => t + v.tamanhoMB, 0);
  $("#lixoTotal").textContent = itens.length ? `${itens.length} ${itens.length === 1 ? "vídeo" : "vídeos"} · ${total.toFixed(1)} MB` : "";
  $("#btnEsvaziar").disabled = !itens.length;
  $("#lixoCorpo").innerHTML = itens.length ? itens.map((v) => `
    <div class="faixa">
      ${v.temVideo ? `<video src="/lixeira/${v.id}/video.mp4#t=2" preload="metadata" muted class="mini-video"></video>` : `<div class="mini-video sem-midia">${ic("file-text", 18)}</div>`}
      <div class="faixa-campos">
        <b style="font-weight:500">${esc(v.titulo)}</b>
        <div class="meta">${esc(OPCOES.estilos[v.estilo]?.nome ?? v.estilo ?? "")} · na lixeira ${quando(v.apagadoEm)} · ${v.tamanhoMB} MB</div>
        <div class="linha">
          <button class="btn peq" onclick="restaurar('${v.id}')">${ic("undo-2", 14)}Restaurar</button>
          <button class="btn fantasma peq perigo-texto" onclick="apagarDeVez('${v.id}')">${ic("trash-2", 14)}Apagar de vez</button>
        </div>
      </div>
    </div>`).join("") : '<div class="vazio">A lixeira está vazia.</div>';
}
async function restaurar(id) {
  try { await api(`/api/lixeira/${id}`, { method: "POST" }); toast("Vídeo restaurado", "undo-2"); await desenharLixeira(); atualizarGaleria(); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
async function apagarDeVez(id) {
  if (!confirm("Apagar este vídeo de vez? Não dá para desfazer.")) return;
  const d = await api(`/api/lixeira/${id}`, { method: "DELETE" });
  toast(`Apagado · ${d.libertadoMB} MB libertados`, "trash-2");
  desenharLixeira();
}
async function esvaziarLixeira() {
  if (!confirm("Apagar de vez todos os vídeos da lixeira? Não dá para desfazer.")) return;
  const d = await api("/api/lixeira", { method: "DELETE" });
  toast(`${d.apagados} apagados · ${d.libertadoMB} MB libertados`, "trash-2");
  desenharLixeira();
}

let videosCache = [];
async function atualizarGaleria() {
  const vids = await api("/api/videos");
  videosCache = vids;
  $("#contaBib").textContent = vids.length;
  $("#galeria").innerHTML = vids.length ? vids.map((v) => `
    <div class="cartao ${selecionados.has(v.id) ? "escolhido" : ""}" data-id="${v.id}">
      ${selecionando ? `<label class="seletor"><input type="checkbox" class="marca" ${selecionados.has(v.id) ? "checked" : ""} onchange="marcar('${v.id}', this.checked)"></label>` : ""}
      ${v.video ? `<video src="${v.video}#t=2" controls preload="metadata" playsinline ${v.capa ? `poster="${v.capa}"` : ""}></video>` : v.capa ? `<img src="${v.capa}" alt="" style="width:100%;aspect-ratio:9/16;object-fit:cover;display:block">` : `<div class="sem-video">${ic("file-text", 22)}Roteiro sem vídeo</div>`}
      <div class="cartao-info">
        <div class="cartao-titulo">${esc(v.titulo)}</div>
        <div class="meta">${esc(OPCOES.estilos[v.estilo]?.nome ?? v.estilo)} · ${quando(v.atualizado)}</div>
        ${v.thumbnail ? `<div class="meta" title="Texto da thumbnail">${ic("image", 12)} ${esc(v.thumbnail)}</div>` : ""}
        ${v.musica ? `<div class="meta" title="${esc(v.musica.credito)}">${ic("music", 12)} ${esc(v.musica.nome)}${v.musica.artista ? ` — ${esc(v.musica.artista)}` : ""}</div>` : ""}
      </div>
      <div class="cartao-acoes">
        <button class="btn fantasma peq" onclick="abrirEditor('${v.id}')">${ic("pencil", 14)}Editar</button>
        ${v.legendaPost || v.musica?.credito ? `<button class="btn fantasma icone peq" title="Copiar legenda do post" onclick="copiarLegenda(${esc(JSON.stringify(v.legendaPost))}, ${esc(JSON.stringify(v.musica?.credito ?? ""))})">${ic("clipboard-copy", 14)}</button>` : ""}
        ${v.video ? `<a class="btn fantasma peq" href="${v.video}" download="${v.id}.mp4">${ic("download", 14)}Baixar</a>` : `<button class="btn fantasma peq" onclick="produzir('${v.id}')">${ic("play", 14)}Renderizar</button>`}
        <button class="btn fantasma icone peq" style="margin-left:auto" title="Mover para a lixeira" onclick="paraLixeira(['${v.id}'])">${ic("trash-2", 14)}</button>
      </div>
    </div>`).join("") : `<div class="vazio vazio-grande" style="grid-column:1/-1">${ic("clapperboard", 28)}<b>A sua biblioteca está vazia</b><span>Os vídeos prontos aparecem aqui, com capa e publicação.</span><button class="btn primario" onclick="irPara('criar')">${ic("sparkles", 16)}Criar o primeiro vídeo</button></div>`;
  filtrarBiblioteca();
  api("/api/lixeira").then((l) => ($("#contaLixo").textContent = l.length));
}

// legenda do post + crédito da música (se não estiver já na legenda)
function copiarLegenda(legenda, credito) {
  const texto = [legenda, credito && !legenda.includes(credito) ? credito : ""].filter(Boolean).join("\n\n");
  navigator.clipboard.writeText(texto).then(() => toast("Legenda do post copiada", "check"));
}

async function produzir(id) {
  await api(`/api/roteiros/${id}?acao=produzir`, { method: "POST" });
  toast("Renderizando", "play");
  atualizarJobs();
}

// ---------- editor de roteiro (gaveta lateral) ----------
let roteiroAberto = null;
const campo = (rotulo, nome, valor, tipo = "input") =>
  `<div class="campo"><label class="rotulo">${rotulo}</label>${tipo === "textarea" ? `<textarea data-f="${nome}" rows="${nome === "json" ? 6 : 2}">${esc(valor)}</textarea>` : `<input data-f="${nome}" value="${esc(valor)}">`}</div>`;

const NOME_CENA = { dado: "Dado (editorial)", tipografia: "Tipografia editorial", faixa: "Faixa de cinema", palavras: "Palavras gigantes", lowpoly: "Animação 3D", quiz: "Pergunta (quiz)", modelo3d: "Modelo 3D", numero: "Número", comparacao: "Comparação", gancho: "Gancho", cta: "Fecho", fato: "Curiosidade", grafico: "Gráfico", linha_tempo: "Linha do tempo", manim: "Manim", clipe: "Clipe", produto: "Produto" };
const CAMPOS_JSON = { lowpoly: ["cenario", "hora", "variante", "plano", "camera", "festa", "personagens", "objetos", "corpos", "rotulos", "etiqueta"], numero: ["valor", "prefixo", "sufixo", "texto", "icone", "alerta"], comparacao: ["esquerda", "direita", "vencedor"], grafico: ["grafico", "dados", "unidade", "destaque"], linha_tempo: ["eventos"], manim: ["codigo"] };
const FONTES_MIDIA = [["", "Sem mídia"], ["steam", "Steam (jogo)"], ["wikimedia", "Wikimedia (foto livre)"], ["pixabay", "Pixabay (stock)"], ["sketchfab", "Modelo 3D: Sketchfab"], ["procedural", "Modelo 3D do estúdio"], ["url", "Link direto (foto, vídeo ou .glb)"]];
// o que escrever na pesquisa, por fonte
const DICA_FONTE = {
  steam: "Nome do jogo", wikimedia: "Termo em inglês (ex.: graphics card)", pixabay: "Termo em inglês (ex.: gamer setup)",
  sketchfab: "Termo em inglês (ex.: rtx 4090, ps5 controller)", procedural: "gpu, cpu, ram ou ssd", url: "Link para .jpg, .png, .mp4 ou .glb",
};
function mudarFonteMidia(sel) {
  const el = sel.closest(".midia");
  el.querySelector('[data-m="consulta"]').placeholder = DICA_FONTE[sel.value] ?? "Nome do jogo, termo de pesquisa ou link";
  const tres = ["sketchfab", "procedural"].includes(sel.value);
  el.querySelector('[data-m="tipo"]').hidden = tres;
  el.querySelector(".aviso-3d").hidden = !(sel.value === "sketchfab" && !OPCOES.temSketchfab);
  el.querySelector(".aviso-stock").hidden = !(sel.value === "pixabay" && !OPCOES.temPixabay);
}

const blocoMidia = (c, i) => {
  if (["manim", "clipe", "comparacao", "modelo3d", "lowpoly"].includes(c.tipo)) return "";
  const m = c.midia ?? {};
  // "pexels" ficou nos roteiros antigos: agora é o Pixabay
  const fonte = m.fonte === "pexels" ? "pixabay" : m.fonte === "arquivo" ? "" : m.fonte ?? "";
  const tres = ["sketchfab", "procedural"].includes(fonte) || m.formato === "modelo3d";
  const previa = m.arquivo && m.formato === "modelo3d"
    ? m.sketchfab?.thumb ? `<img src="${esc(m.sketchfab.thumb)}" alt="">` : `<div class="sem-midia">${ic("box", 22)}<br>Modelo 3D<br>${esc(m.arquivo.startsWith("procedural:") ? m.arquivo.slice(11).toUpperCase() : m.arquivo.split("/").pop())}</div>`
    : m.arquivo
    ? m.formato === "video" ? `<video src="/public/${esc(m.arquivo)}" muted autoplay loop playsinline></video>` : `<img src="/public/${esc(m.arquivo)}" alt="">`
    : `<div class="sem-midia">${m.fonte ? "Não encontrada" : "Sem mídia"}</div>`;
  return `<div class="midia">
    <div class="previa">${previa}</div>
    <div class="midia-campos">
      <div class="linha">
        <select data-m="fonte" onchange="mudarFonteMidia(this)">${FONTES_MIDIA.map(([v, n]) => `<option value="${v}" ${v === fonte ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-m="tipo" style="width:110px" ${tres ? "hidden" : ""}><option value="imagem">Imagem</option><option value="video" ${m.tipo === "video" ? "selected" : ""}>Vídeo</option></select>
      </div>
      <input data-m="consulta" placeholder="${esc(DICA_FONTE[fonte] ?? "Nome do jogo, termo de pesquisa ou link")}" value="${esc(m.fonte === "arquivo" ? "" : m.consulta?.startsWith("uid:") ? "" : m.consulta)}">
      <div class="aviso aviso-3d" style="margin:0" ${fonte === "sketchfab" && !OPCOES.temSketchfab ? "" : "hidden"}>${ic("key-round", 14)}<span>Para baixar modelos, adicione o token do Sketchfab em Chaves de API.</span></div>
      <div class="aviso aviso-stock" style="margin:0" ${fonte === "pixabay" && !OPCOES.temPixabay ? "" : "hidden"}>${ic("key-round", 14)}<span>Adicione a chave grátis do Pixabay em Chaves de API.</span></div>
      <div class="linha">
        <button class="btn peq" onclick="trocarMidia(${i})">${ic("search", 14)}Buscar</button>
        <button class="btn peq" onclick="trocarMidia(${i}, 1)" title="Próximo resultado">${ic("refresh-cw", 14)}Outra</button>
        <label class="btn peq" style="margin:0">${ic("upload", 14)}Enviar<input type="file" accept="image/*,video/*,.glb" hidden onchange="enviarMidia(${i}, this.files[0])"></label>
      </div>
      ${m.credito ? `<div class="dica" style="margin:0">${esc(m.credito)}</div>` : ""}
      ${tres ? '<div class="dica" style="margin:0">O modelo gira no lugar da foto. No Sketchfab só entram modelos com licença comercial; "Outra" passa ao resultado seguinte.</div>' : ""}
    </div>
  </div>`;
};

// vídeo longo: os trechos marcados pelo roteirista viram Shorts verticais
function blocoCortes(r) {
  if (r.formato !== "longo" || !(r.cortes ?? []).length) return "";
  return `<div class="caixa-info" style="margin-top:14px">
    <div class="linha" style="justify-content:space-between"><b>Cortes para Shorts</b><span class="meta">${r.cortes.length} trechos</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">${r.cortes.map((c, k) => `
      <div class="linha" style="gap:10px">
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(c.titulo)}</div><div class="meta">cenas ${c.inicio + 1} a ${c.fim + 1} · gancho: ${esc(c.gancho?.texto_tela ?? "")}</div></div>
        <button class="btn peq" onclick="criarShort('${esc(r.id)}', ${k}, this)">${ic("smartphone", 14)}Criar Short</button>
      </div>`).join("")}</div>
    <div class="dica" style="margin-top:8px">O Short entra na biblioteca com gancho e CTA próprios; reveja e clique em Produzir.</div>
  </div>`;
}
async function criarShort(id, k, botao) {
  botao.disabled = true;
  try {
    const { id: novo } = await api(`/api/roteiros/${id}/cortes/${k}`, { method: "POST" });
    toast("Short criado na biblioteca", "check");
    atualizarGaleria();
    abrirEditor(novo);
  } catch (e) { toast(e.message, "triangle-alert"); botao.disabled = false; }
}

// ---------- skill youtube: ideias, pacote de publicação, variantes de gancho ----------
// as tarefas do Claude correm no servidor; aqui pergunta-se pelo estado até ficarem prontas
// ---------- cortes automáticos (vídeo longo → vários Shorts) ----------
let cortesAtuais = null;
function mudarModoCortes() {
  const on = $("#modoCortes").checked;
  $("#opcoesCortes").hidden = !on;
  $("#ficheirosClipe").multiple = !on;
  $("#nomesClipe").textContent = on ? "Escolha o vídeo longo" : "Escolha os vídeos (pela ordem em que entram)";
  mudarFormato();
}
const tempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
// ---------- biblioteca de gameplay ----------
function desenharGameplays(lista, escolher) {
  const atual = escolher ?? $("#gameplay").value;
  const min = (s) => `${Math.floor(s / 60)} min`;
  $("#gameplay").innerHTML = `<option value="nenhuma">Sem gameplay (layout normal)</option>` +
    (lista.length ? `<option value="aleatoria">Qualquer uma da biblioteca (${lista.length})</option>` : "") +
    lista.map((g) => `<option value="${esc(g.arquivo)}">${esc(g.nome)} · ${min(g.duracaoS)}</option>`).join("");
  $("#gameplay").value = [...$("#gameplay").options].some((o) => o.value === atual) ? atual : "nenhuma";
}
async function carregarGameplays() { try { desenharGameplays(await api("/api/gameplay")); } catch {} }
async function enviarGameplay(f) {
  if (!f) return;
  try {
    toast("Enviando a gameplay…", "upload");
    const d = await enviarComProgresso(`/api/upload?nome=${encodeURIComponent(f.name)}&gameplay=1`, f);
    desenharGameplays(d.gameplays, d.caminho);
    toast("Gameplay na biblioteca", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function analisarCortes() {
  const f = $("#ficheirosClipe").files[0];
  if (!f) return toast("Escolha o vídeo", "film");
  const [min, max] = $("#duracaoCortes").value.split("-").map(Number);
  $("#criar").disabled = true;
  try {
    toast("Enviando o vídeo…", "upload");
    const arquivo = await enviarFicheiro(f);
    await iniciarAnalise({ arquivo, nome: f.name, min, max, foco: $("#focoCortes").value.trim() });
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#criar").disabled = false;
}

// ---------- análises de cortes: correm no servidor e aparecem na Produção até serem vistas ----------
// guardadas no browser (id da tarefa + vídeo), para sobreviverem a fechar a gaveta ou recarregar a página
let analises = [];
try { analises = JSON.parse(localStorage.analisesCortes || "[]"); } catch {}
let analiseNaGaveta = null; // id da análise que a gaveta está a mostrar
const gravarAnalises = () => { try { localStorage.analisesCortes = JSON.stringify(analises.slice(0, 10)); } catch {} };
async function iniciarAnalise(a) {
  const t = await api("/api/cortes", { method: "POST", body: { arquivo: a.arquivo, min: a.min, max: a.max, foco: a.foco } });
  const nova = { ...a, id: t.id, inicio: Date.now(), estado: "a correr", passo: t.passo };
  analises = [nova, ...analises.filter((x) => x.arquivo !== a.arquivo)];
  gravarAnalises();
  abrirAnalise(nova.id);
  desenharAnalises();
}
function abrirAnalise(id) {
  const a = analises.find((x) => x.id === id);
  if (!a) return;
  analiseNaGaveta = id;
  $("#cortesMeta").textContent = a.nome;
  $("#cortesLista").innerHTML = "";
  $("#btnProduzirCortes").disabled = true;
  if (!dlgCortes.open) dlgCortes.showModal();
  if (a.estado === "pronto") return mostrarMomentos(a);
  $("#cortesPasso").textContent = a.estado === "erro" ? `Falhou: ${a.erro}` : a.passo ?? "";
}
async function mostrarMomentos(a) {
  $("#cortesPasso").textContent = "A carregar os momentos…";
  // o resultado fica gravado em disco: serve mesmo depois de o painel ser reiniciado
  const r = a.resultado ?? await api(`/api/cortes?arquivo=${encodeURIComponent(a.arquivo)}`);
  if (!r?.cortes?.length) { $("#cortesPasso").textContent = "Não encontrei o resultado desta análise. Analise o vídeo de novo."; return; }
  cortesAtuais = r;
  $("#cortesPasso").textContent = `${r.cortes.length} momentos em ${tempo(r.duracao)} de vídeo`;
  desenharCortes();
}
async function seguirAnalises() {
  const vivas = analises.filter((a) => a.estado === "a correr");
  for (const a of vivas) {
    let t;
    try { t = await api(`/api/tarefas/${a.id}`); }
    catch {
      // a tarefa já não existe no servidor (painel reiniciado): vê se o resultado chegou a ser gravado
      const r = await api(`/api/cortes?arquivo=${encodeURIComponent(a.arquivo)}`).catch(() => null);
      t = r?.cortes?.length && new Date(r.geradoEm).getTime() > a.inicio ? { estado: "pronto", resultado: r }
        : { estado: "erro", erro: "A análise parou porque o painel foi reiniciado." };
    }
    Object.assign(a, { estado: t.estado, passo: t.passo ?? a.passo, erro: t.erro, fim: t.estado !== "a correr" ? Date.now() : undefined });
    if (t.estado === "pronto") { a.n = t.resultado?.cortes?.length ?? 0; a.duracao = t.resultado?.duracao; a.resultado = t.resultado; }
    if (analiseNaGaveta === a.id && dlgCortes.open) {
      if (t.estado === "pronto") mostrarMomentos(a);
      else $("#cortesPasso").textContent = t.estado === "erro" ? `Falhou: ${t.erro}` : a.passo ?? "";
    }
    if (t.estado !== "a correr" && t.estado !== "parado") avisarAnalise(a);
  }
  if (vivas.length) { gravarAnalises(); desenharAnalises(); }
  return analises.filter((a) => a.estado === "a correr").length;
}
function avisarAnalise(a) {
  if (analiseNaGaveta === a.id && dlgCortes.open) return; // já está a ver
  const msg = a.estado === "pronto" ? `${a.n} momentos encontrados em ${a.nome}` : `A análise de ${a.nome} falhou`;
  toast(`${msg}. Veja em Produção.`, a.estado === "pronto" ? "scissors" : "triangle-alert");
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    new Notification(a.estado === "pronto" ? "Cortes prontos" : "Análise de cortes falhou", { body: msg, icon: "/icones/scissors.svg" });
  }
}
async function pararAnalise(id) {
  const a = analises.find((x) => x.id === id);
  if (!a || !confirm(`Parar a análise de ${a.nome}?`)) return;
  await api(`/api/tarefas/${id}/parar`, { method: "POST" }).catch(() => {});
  Object.assign(a, { estado: "parado", erro: undefined, fim: Date.now() });
  gravarAnalises(); desenharAnalises();
  if (analiseNaGaveta === id && dlgCortes.open) $("#cortesPasso").textContent = "Análise parada.";
}
function descartarAnalise(id) {
  analises = analises.filter((a) => a.id !== id);
  gravarAnalises();
  desenharAnalises();
}
async function repetirAnalise(id) {
  const a = analises.find((x) => x.id === id);
  if (!a) return;
  try { await iniciarAnalise({ arquivo: a.arquivo, nome: a.nome, min: a.min, max: a.max, foco: a.foco }); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
const decorrido = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`; };
function desenharAnalises() {
  const caixa = $("#analises");
  caixa.hidden = !analises.length;
  caixa.innerHTML = analises.map((a) => {
    const ponto = a.estado === "pronto" ? "ok" : a.estado === "erro" ? "erro" : a.estado === "parado" ? "parado" : "vivo";
    const estado = a.estado === "pronto" ? `${a.n} momentos` : a.estado === "erro" ? "Falhou" : a.estado === "parado" ? "Parado" : `A analisar · ${decorrido(Date.now() - a.inicio)}`;
    const id = esc(a.id);
    return `<div class="job">
      <div class="job-linha">
        <div class="job-titulo">${ic("scissors", 15)} ${esc(a.nome)}</div>
        <span class="meta">Cortes automáticos</span>
        <span class="estado"><span class="ponto ${ponto}"></span>${estado}</span>
        ${a.estado === "pronto" ? `<button class="btn primario peq" onclick="abrirAnalise('${id}')">Ver momentos</button>` : ""}
        ${a.estado === "a correr" ? `<button class="btn peq" onclick="abrirAnalise('${id}')">Abrir</button><button class="btn peq" title="Parar a análise" onclick="pararAnalise('${id}')">${ic("square", 13)}Parar</button>` : ""}
        ${a.estado === "erro" || a.estado === "parado" ? `<button class="btn peq" onclick="repetirAnalise('${id}')">${ic("rotate-ccw", 14)}Tentar de novo</button>` : ""}
        ${a.estado !== "a correr" ? `<button class="btn fantasma icone peq" title="Tirar da lista" aria-label="Tirar da lista" onclick="descartarAnalise('${id}')">${ic("x", 14)}</button>` : ""}
      </div>
      ${a.estado === "a correr" ? `<div class="analise-passo">${esc(a.passo ?? "")}</div><div class="barra-viva"><b></b></div>` : ""}
      ${a.estado === "erro" ? `<div class="analise-passo erro">${esc(a.erro ?? "")}</div>` : ""}
    </div>`;
  }).join("");
}
// fechar a gaveta não para nada: avisa onde continuar a acompanhar
dlgCortes.addEventListener("close", () => {
  const a = analises.find((x) => x.id === analiseNaGaveta);
  analiseNaGaveta = null;
  if (a?.estado === "a correr") toast("A análise continua. Acompanhe em Produção.", "scissors");
});
function desenharCortes() {
  const src = `/public/${cortesAtuais.arquivo}`;
  $("#cortesLista").innerHTML = cortesAtuais.cortes.map((c, i) => `
    <div style="padding:12px;display:flex;flex-direction:column;gap:8px;border:1px solid var(--borda);border-radius:12px">
      <label class="linha" style="justify-content:space-between;align-items:flex-start;gap:10px;cursor:pointer">
        <span class="linha" style="gap:10px;align-items:flex-start"><input type="checkbox" data-corte="${i}" ${c.nota >= 60 ? "checked" : ""} onchange="contarCortes()"><b style="font-size:14px">${esc(c.gancho ?? c.titulo)}</b></span>
        <span class="nota-ideia" title="Potencial viral (0 a 100)">${esc(c.nota ?? "?")}</span>
      </label>
      <div class="meta">${tempo(c.inicio)}–${tempo(c.fim)} · ${Math.round(c.fim - c.inicio)} s · ${esc(c.titulo ?? "")}</div>
      <div style="font-size:13px">${esc(c.motivo ?? "")}</div>
      <div style="font-size:18px">${(c.palavras_chave ?? []).map((k) => `<span title="${esc(k.palavra)}">${esc(k.emoji)}</span>`).join(" ")} <span class="meta" style="font-size:12px">${(c.palavras_chave ?? []).map((k) => esc(k.palavra)).join(", ")}</span></div>
      <video controls preload="none" src="${src}#t=${c.inicio.toFixed(1)},${c.fim.toFixed(1)}" style="width:100%;max-height:220px;border-radius:8px;background:#000"></video>
    </div>`).join("");
  contarCortes();
}
function contarCortes() {
  const n = $("#cortesLista").querySelectorAll("input[data-corte]:checked").length;
  $("#btnProduzirCortes").disabled = !n;
  $("#textoProduzirCortes").textContent = n === 1 ? "Produzir 1 Short" : `Produzir ${n} Shorts`;
}
async function produzirCortes() {
  const escolhidos = [...$("#cortesLista").querySelectorAll("input[data-corte]:checked")].map((x) => cortesAtuais.cortes[Number(x.dataset.corte)]);
  if (!escolhidos.length) return;
  $("#btnProduzirCortes").disabled = true;
  try {
    await api("/api/cortes/produzir", { method: "POST", body: {
      arquivo: cortesAtuais.arquivo, cortes: escolhidos, estilo: estado.estilo, canal: $("#canal").value, musica: $("#musica").value,
      cortar: $("#cortar").checked, enquadrar: $("#enquadrar").checked, gancho: $("#ganchoCortes").checked, exemplos: $("#exemplos").checked, gameplay: $("#gameplay").value,
    } });
    dlgCortes.close();
    toast(`${escolhidos.length} Shorts na fila de render`, "scissors");
    atualizarJobs();
  } catch (e) { toast(e.message, "triangle-alert"); $("#btnProduzirCortes").disabled = false; }
}

async function esperarTarefa(t, aoPasso) {
  while (t.estado === "a correr") {
    aoPasso?.(t.passo);
    await new Promise((r) => setTimeout(r, 2500));
    t = await api(`/api/tarefas/${t.id}`);
  }
  if (t.estado === "erro") throw new Error(t.erro);
  return t.resultado;
}
const NOME_ESTRATEGIA = { busca: "Busca", feed: "Feed", tendencia: "Tendência", venda: "Venda" };
let ideiasAtuais = [];
// as ideias seguem o canal escolhido no topo do formulário (cada canal tem o seu nicho e a sua lista)
const canalAtual = () => $("#canal").value === "nenhum" ? primeiroCanal() : $("#canal").value;
async function abrirIdeias() {
  const c = OPCOES.canais?.[canalAtual()];
  $("#ideiasDica").textContent = !c ? $("#ideiasDica").textContent : c.nicho
    ? `Ideias para ${c.nome} (${c.arroba}), só dentro do nicho: ${c.nicho}. O Claude pesquisa o que está acontecendo agora e evita os temas que o canal já fez. Para outro canal, troque no seletor do topo.`
    : `${c.nome} ainda não tem nicho: as ideias vão sair genéricas. Defina o nicho na página Canais.`;
  $("#ideiasFoco").value = "";
  try { desenharIdeias(await api(`/api/ideias?canal=${encodeURIComponent(canalAtual())}`)); } catch (e) { toast(e.message, "triangle-alert"); }
}
function desenharIdeias(d) {
  ideiasAtuais = d.ideias ?? [];
  $("#ideiasMeta").textContent = d.geradoEm ? `· ${d.geradoEm.slice(0, 16).replace("T", " ")}${d.foco ? ` · ${d.foco}` : ""}` : "";
  $("#ideiasLista").innerHTML = ideiasAtuais.length ? ideiasAtuais.map((x, k) => `
    <div class="caixa-info">
      <div class="linha" style="justify-content:space-between;align-items:flex-start;gap:10px"><b style="font-size:14px">${esc(x.titulo)}</b>${x.nota ? `<span class="nota-ideia" title="Potencial (1 a 10)">${esc(x.nota)}/10</span>` : ""}</div>
      <div class="meta" style="margin-top:4px">${esc(nomeFormato(x.formato) || x.formato)} · ${esc(NOME_ESTRATEGIA[x.estrategia] ?? x.estrategia ?? "")}${x.urgencia ? ` · ${esc(x.urgencia)}` : ""}</div>
      ${x.gancho ? `<div style="font-size:13px;margin-top:8px">“${esc(x.gancho)}”</div>` : ""}
      ${x.porque ? `<div class="dica" style="margin-top:6px">${esc(x.porque)}</div>` : ""}
      <div style="margin-top:10px"><button class="btn peq" onclick="usarIdeia(${k})">${ic("pencil", 14)}Usar esta ideia</button></div>
    </div>`).join("") : '<div class="vazio">Ainda sem ideias. Clique em Gerar ideias.</div>';
}
async function gerarIdeias() {
  const botao = $("#btnIdeias");
  botao.disabled = true;
  try {
    const t = await api("/api/ideias", { method: "POST", body: { foco: $("#ideiasFoco").value.trim(), pais: $("#pais").value, canal: canalAtual() } });
    desenharIdeias(await esperarTarefa(t, (p) => ($("#ideiasPasso").textContent = p)));
    toast("Ideias prontas", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#ideiasPasso").textContent = "";
  botao.disabled = false;
}
function usarIdeia(k) {
  const x = ideiasAtuais[k];
  $("#tema").value = x.tema || x.titulo;
  if (FORMATOS.some(([f]) => f === x.formato)) { estado.formato = x.formato; desenharFormatos(); mudarFormato(); atualizarDicaMusica(); }
  escolherOrigem("ia");
  irPara("criar");
  irParaPasso(1);
  $("#tema").focus();
  toast("Ideia no formulário: reveja e continue", "lightbulb");
}

// pacote de publicação (títulos, descrição, tags, legendas): fica guardado em out/<id>.publicacao.json
let textosPub = [];
const copiarPub = (i) => navigator.clipboard.writeText(textosPub[i]).then(() => toast("Copiado", "check"));
function blocoPublicacao(r) {
  return `<div class="caixa-info" style="margin-top:14px" id="blocoPub"><div class="linha" style="justify-content:space-between"><b>Publicação</b><span class="meta">carregando…</span></div></div>`;
}
async function carregarPublicacao(id) {
  try { desenharPublicacao(id, await api(`/api/roteiros/${id}/publicacao`)); } catch { desenharPublicacao(id, {}); }
}
function desenharPublicacao(id, p, passo) {
  const caixa = $("#blocoPub");
  if (!caixa || roteiroAberto?.id !== id) return;
  textosPub = [];
  const item = (texto) => {
    if (!texto) return "";
    textosPub.push(texto);
    return `<div class="pub-item"><div>${esc(texto)}</div><button class="btn fantasma icone peq" title="Copiar" onclick="copiarPub(${textosPub.length - 1})">${ic("copy", 14)}</button></div>`;
  };
  const juntar = (lista, sep = " ") => (lista ?? []).join(sep);
  const tem = p && p.titulos;
  const botao = `<button class="btn peq" id="btnPub" onclick="gerarPublicacao('${esc(id)}')" ${passo ? "disabled" : ""}>${ic(tem ? "refresh-cw" : "megaphone", 14)}${tem ? "Gerar de novo" : "Gerar pacote"}</button>`;
  caixa.innerHTML = `
    <div class="linha" style="justify-content:space-between"><b>Publicação</b>${botao}</div>
    ${passo ? `<div class="meta" style="margin-top:8px">${esc(passo)}</div>` : ""}
    ${tem ? `
      <div class="pub-rotulo">Títulos</div>${p.titulos.map((t) => item(t.texto)).join("")}
      <div class="pub-rotulo">YouTube: descrição</div>${item(p.youtube?.descricao)}
      <div class="pub-rotulo">YouTube: hashtags e tags</div>${item(juntar(p.youtube?.hashtags))}${item(juntar(p.youtube?.tags, ", "))}
      <div class="pub-rotulo">TikTok</div>${item([p.tiktok?.legenda, juntar(p.tiktok?.hashtags)].filter(Boolean).join("\n\n"))}
      <div class="pub-rotulo">Instagram Reels</div>${item([p.instagram?.legenda, juntar(p.instagram?.hashtags)].filter(Boolean).join("\n\n"))}
      <div class="pub-rotulo">Comentário fixado</div>${item(p.comentario_fixado)}
      ${p.capa?.texto ? `<div class="pub-rotulo">Capa</div>${item(p.capa.texto)}<div class="dica">${esc(p.capa.conceito ?? "")}</div>` : ""}
      <div class="dica" style="margin-top:10px">Gerado ${esc((p.geradoEm ?? "").slice(0, 16).replace("T", " "))}. Confira antes de publicar.</div>`
    : passo ? "" : '<div class="dica" style="margin-top:8px">Títulos, descrição, tags e legendas para YouTube, TikTok e Reels, a partir deste roteiro. Nos vídeos longos, gere depois de renderizar para os capítulos virem com os tempos.</div>'}`;
}
async function gerarPublicacao(id) {
  try {
    await guardarSilencioso();
    desenharPublicacao(id, {}, "🤖 Escrevendo…");
    const t = await api(`/api/roteiros/${id}/publicacao`, { method: "POST" });
    const p = await esperarTarefa(t, (passo) => desenharPublicacao(id, {}, passo));
    desenharPublicacao(id, p);
    toast("Pacote de publicação pronto", "check");
  } catch (e) { toast(e.message, "triangle-alert"); carregarPublicacao(id); }
}

// revisão visual: folhas de contacto com frames de cada cena, revistas pelo Claude
const COR_GRAVIDADE = { alta: "var(--erro)", media: "var(--aviso)", baixa: "var(--suave)" };
async function carregarRevisao(id) {
  try { desenharRevisao(id, await api(`/api/roteiros/${id}/revisao`)); } catch { desenharRevisao(id, {}); }
}
function irParaCena(n) {
  const el = document.querySelector(`.cena[data-i="${n - 1}"]`);
  if (el) { $("#edCorpo").scrollTop = el.offsetTop - 20; el.animate([{ outline: "2px solid var(--acento)" }, { outline: "2px solid transparent" }], { duration: 1600 }); }
}
function desenharRevisao(id, r, passo) {
  const caixa = $("#blocoRevisao");
  if (!caixa || roteiroAberto?.id !== id) return;
  const temVideo = (videosCache ?? []).some((v) => v.id === id && v.video);
  const v = Date.parse(r.revistoEm ?? "") || 0;
  caixa.innerHTML = `
    <div class="linha" style="justify-content:space-between"><b>Revisão visual</b>
      <button class="btn peq" onclick="reverVisual('${esc(id)}')" ${passo || !temVideo ? "disabled" : ""} title="${temVideo ? "" : "Renderize o vídeo primeiro"}">${ic("eye", 14)}${r.revistoEm ? "Rever de novo" : "Rever agora"}</button></div>
    ${passo ? `<div class="meta" style="margin-top:8px">${esc(passo)}</div>` : ""}
    ${r.revistoEm ? `
      <div class="linha" style="margin-top:8px;gap:10px"><span class="nota-ideia">${esc(r.nota ?? "?")}/10</span><span style="font-size:13px">${esc(r.resumo)}</span></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${r.problemas.length ? r.problemas.map((p) => `
        <div class="linha" style="align-items:flex-start;gap:8px;font-size:12px">
          <span style="color:${COR_GRAVIDADE[p.gravidade] ?? "var(--aviso)"};white-space:nowrap">${ic("triangle-alert", 14)}</span>
          <span>${p.cena ? `<a href="#" onclick="irParaCena(${Number(p.cena)});return false" style="color:var(--acento)">Cena ${esc(p.cena)}</a>: ` : ""}${esc(p.problema)}${p.sugestao ? ` <span class="meta">→ ${esc(p.sugestao)}</span>` : ""}</span>
        </div>`).join("") : `<div class="linha" style="color:var(--ok);font-size:12px">${ic("check", 14)}Nada a corrigir nos frames.</div>`}</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(3, r.folhas.length)}, 1fr);gap:6px;margin-top:10px">${r.folhas.map((f) => `<a href="${esc(f)}?v=${v}" target="_blank" rel="noopener"><img src="${esc(f)}?v=${v}" alt="" style="width:100%;display:block;border-radius:6px;border:1px solid var(--borda)"></a>`).join("")}</div>`
    : passo ? "" : `<div class="dica" style="margin-top:8px">${temVideo ? "Tira frames de cada cena e o Claude procura texto cortado ou ilegível, sobreposições e cenas vazias." : "Fica disponível depois de renderizar. Roda sozinha no fim de cada render (opção nas configurações do formulário)."}</div>`}`;
}
async function reverVisual(id) {
  try {
    desenharRevisao(id, {}, "🖼 Capturando frames…");
    const t = await api(`/api/roteiros/${id}/revisao`, { method: "POST" });
    desenharRevisao(id, await esperarTarefa(t, (p) => desenharRevisao(id, {}, p)));
    toast("Revisão visual pronta", "check");
  } catch (e) { toast(e.message, "triangle-alert"); carregarRevisao(id); }
}

// capa (thumbnail): 3 variantes geradas a partir da mídia do próprio vídeo; a escolhida vai para out/<id>.capa.jpg
const NOME_LAYOUT = { impacto: "Impacto", dividido: "Dividido", objeto: "Objeto" };
let capaAtual = {};
async function carregarCapa(id) {
  try { desenharCapa(id, await api(`/api/roteiros/${id}/capa`)); } catch { desenharCapa(id, {}); }
}
function desenharCapa(id, c, passo) {
  const caixa = $("#blocoCapa");
  if (!caixa || roteiroAberto?.id !== id) return;
  capaAtual = c;
  const r = roteiroAberto;
  const deitado = (c.formato ?? (r.formato === "longo" ? "horizontal" : "vertical")) === "horizontal";
  const v = Date.parse(c.geradoEm ?? "") || 0;
  const n = c.candidatos?.length ?? 0;
  caixa.innerHTML = `
    <div class="linha" style="justify-content:space-between"><b>Capa</b><span class="meta">${c.geradoEm ? `${n} fundos possíveis` : ""}</span></div>
    <div class="grid2" style="margin-top:10px">
      <div class="campo"><label class="rotulo">Texto da capa (2 a 5 palavras)</label><input id="capaTexto" value="${esc(c.texto ?? r.thumbnail ?? "")}" maxlength="60"></div>
      <div class="campo"><label class="rotulo">Palavra em destaque</label><input id="capaDestaque" value="${esc(c.destaque ?? "")}" placeholder="a última, se vazio" maxlength="30"></div>
    </div>
    <div class="linha" style="gap:8px;flex-wrap:wrap">
      <select id="capaFormato" style="width:auto"><option value="vertical" ${deitado ? "" : "selected"}>9:16 (Shorts, Reels, TikTok)</option><option value="horizontal" ${deitado ? "selected" : ""}>16:9 (YouTube)</option></select>
      <button class="btn peq primario" onclick="gerarCapa('${esc(id)}')" ${passo ? "disabled" : ""}>${ic(c.geradoEm ? "refresh-cw" : "image", 14)}${c.geradoEm ? "Gerar de novo" : "Gerar capas"}</button>
      ${n > 1 ? `<button class="btn peq" onclick="gerarCapa('${esc(id)}', ${((c.fundo ?? 0) + 1) % n})" ${passo ? "disabled" : ""}>${ic("images", 14)}Outro fundo</button>` : ""}
    </div>
    ${passo ? `<div class="meta" style="margin-top:8px">${esc(passo)}</div>` : ""}
    ${c.variantes?.length ? `<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:12px">${c.variantes.map((l) => `
      <button onclick="escolherCapa('${esc(id)}', '${l}')" title="Usar esta capa" style="padding:0;border:2px solid ${c.escolhida === l ? "var(--acento)" : "var(--borda)"};border-radius:10px;overflow:hidden;background:none;cursor:pointer;text-align:left">
        <img src="/out/capas/${esc(id)}-${l}.jpg?v=${v}" alt="" style="width:100%;display:block;aspect-ratio:${deitado ? "16/9" : "9/16"};object-fit:cover">
        <div class="meta" style="padding:4px 8px">${NOME_LAYOUT[l]}${c.escolhida === l ? " · escolhida" : ""}</div>
      </button>`).join("")}</div>
      <div class="linha" style="margin-top:8px;gap:8px"><a class="btn fantasma peq" href="/out/${esc(id)}.capa.jpg?v=${v}" download="${esc(id)}-capa.jpg">${ic("download", 14)}Baixar a escolhida</a></div>` : ""}
    ${!passo && !c.geradoEm ? '<div class="dica" style="margin-top:8px">Usa as fotos, os b-rolls e o modelo 3D do próprio vídeo. Gera 3 variantes para escolher; a escolhida aparece na biblioteca.</div>' : ""}`;
}
async function gerarCapa(id, fundo) {
  try {
    await guardarSilencioso();
    const corpo = { texto: $("#capaTexto").value, destaque: $("#capaDestaque").value, formato: $("#capaFormato").value, ...(fundo !== undefined && { fundo }) };
    desenharCapa(id, capaAtual, "🎨 Preparando o estúdio…");
    const t = await api(`/api/roteiros/${id}/capa`, { method: "POST", body: corpo });
    const c = await esperarTarefa(t, (p) => desenharCapa(id, capaAtual, p));
    desenharCapa(id, c);
    atualizarGaleria();
    toast("Capas prontas", "check");
  } catch (e) { toast(e.message, "triangle-alert"); carregarCapa(id); }
}
async function escolherCapa(id, layout) {
  try {
    await api(`/api/roteiros/${id}/capa/escolher`, { method: "POST", body: { layout } });
    carregarCapa(id);
    atualizarGaleria();
    toast(`Capa ${NOME_LAYOUT[layout].toLowerCase()} escolhida`, "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// 5 ganchos alternativos; "Usar" só muda os campos no editor (guarda-se como sempre)
let variantesGancho = [];
async function sugerirGanchos(i, botao) {
  const caixa = $(`#ganchos-${i}`);
  botao.disabled = true;
  try {
    await guardarSilencioso();
    const id = roteiroAberto.id;
    const t = await api(`/api/roteiros/${id}/ganchos`, { method: "POST" });
    const g = await esperarTarefa(t, (p) => (caixa.innerHTML = `<div class="meta" style="margin-top:8px">${esc(p)}</div>`));
    if (roteiroAberto?.id !== id) return;
    variantesGancho = g.variantes;
    $(`#ganchos-${i}`).innerHTML = g.variantes.map((v, k) => `
      <div class="variante ${k === g.recomendada ? "recomendada" : ""}">
        <div class="linha" style="justify-content:space-between;gap:8px"><b style="font-size:13px">${esc(v.texto_tela)}</b>
          <span class="meta">${esc(v.mecanismo)} · risco ${esc(v.risco)}${k === g.recomendada ? " · recomendado" : ""}</span></div>
        <div style="font-size:13px;margin-top:6px">${esc(v.fala)}</div>
        <div class="dica" style="margin-top:4px">${esc(v.porque ?? "")}</div>
        <div style="margin-top:8px"><button class="btn peq" onclick="usarGancho(${i}, ${k})">${ic("check", 14)}Usar este</button></div>
      </div>`).join("");
  } catch (e) { toast(e.message, "triangle-alert"); caixa.innerHTML = ""; }
  botao.disabled = false;
}
function usarGancho(i, k) {
  const v = variantesGancho[k];
  const el = document.querySelector(`.cena[data-i="${i}"]`);
  el.querySelector('[data-f="texto_tela"]').value = v.texto_tela;
  el.querySelector('[data-f="fala"]').value = v.fala;
  $(`#ganchos-${i}`).innerHTML = "";
  toast("Gancho trocado no editor. Clique em Salvar.", "check");
}

// resultado do validador + pesquisa (o que sustenta o roteiro), para rever antes de renderizar
function blocoQualidade(r) {
  const q = r.qualidade ?? { erros: [], avisos: [] };
  const pesquisa = r.pesquisa ?? [];
  const lista = (itens, cor, icone) => itens.map((t) => `<div class="linha" style="align-items:flex-start;gap:8px;color:${cor};font-size:12px">${ic(icone, 14)}<span>${esc(t)}</span></div>`).join("");
  return `<div class="caixa-info" style="margin-top:14px">
    <div class="linha" style="justify-content:space-between"><b>Qualidade</b><span class="meta">${q.validadoEm ? `validado ${esc(q.validadoEm.replace("T", " "))}` : "ainda não validado"}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${q.erros.length || q.avisos.length ? lista(q.erros, "var(--erro)", "circle-x") + lista(q.avisos, "var(--aviso)", "triangle-alert") : `<div class="linha" style="color:var(--ok);font-size:12px">${ic("check", 14)}Sem problemas: preços batem com o catálogo e a fala está limpa.</div>`}
    </div>
    <div class="linha" style="flex-wrap:wrap;margin-top:10px">
      ${q.erros.length || q.avisos.length ? `<button class="btn fantasma peq" onclick="copiarCorrecoes()">${ic("copy", 14)}Copiar correções para a IA</button>` : ""}
      <button class="btn fantasma peq" onclick="caixaReenvio.hidden = !caixaReenvio.hidden">${ic("upload", 14)}Reenviar JSON corrigido</button>
    </div>
    <div id="caixaReenvio" hidden style="margin-top:8px">
      <textarea id="jsonReenvio" rows="8" placeholder='Cole aqui a resposta da IA com o JSON corrigido' style="width:100%;font-family:var(--mono, monospace);font-size:12px"></textarea>
      <div class="dica">Substitui as cenas deste roteiro. Ficam o estilo, a narração, a música e o canal que escolheu, e a mídia das cenas que não mudaram. Depois volta a validar e buscando mídia.</div>
      <button class="btn primario peq" id="btnReenvio" onclick="reenviarJSON()">${ic("refresh-cw", 14)}Substituir e validar</button>
    </div>
    <details style="margin-top:10px"><summary class="meta" style="cursor:pointer">Pesquisa (${pesquisa.length} fatos com fonte)</summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${pesquisa.map((p) => `<div style="font-size:12px"><span>${esc(p.fato)}</span> <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--acento)">${esc(p.fonte ?? "fonte")}</a></div>`).join("") || '<div class="meta">Sem pesquisa registada.</div>'}</div>
    </details>
  </div>`;
}

// devolver o feedback do validador à outra IA, e trazer de volta o JSON corrigido para o mesmo roteiro
async function copiarCorrecoes() {
  const q = roteiroAberto.qualidade ?? { erros: [], avisos: [] };
  const texto = [
    "O estúdio validou o roteiro que você escreveu e encontrou estes problemas. Corrija todos, mantendo a ideia, o formato do JSON e o resto das regras.",
    q.erros.length ? `\nErros (obrigatório corrigir):\n${q.erros.map((e) => `- ${e}`).join("\n")}` : "",
    q.avisos.length ? `\nAvisos (corrija sempre que possível):\n${q.avisos.map((e) => `- ${e}`).join("\n")}` : "",
    "\nResponda só com o JSON completo e corrigido (todas as cenas, não só as que mudaram), sem texto antes nem depois.",
  ].filter(Boolean).join("\n");
  try { await navigator.clipboard.writeText(texto); toast("Correções copiadas. Cole na conversa com a IA.", "copy"); }
  catch { toast("Não consegui copiar", "triangle-alert"); }
}
async function reenviarJSON() {
  const texto = $("#jsonReenvio").value.trim();
  if (!texto) return toast("Cole a resposta da IA", "clipboard-paste");
  $("#btnReenvio").disabled = true;
  try {
    await api(`/api/roteiros/${roteiroAberto.id}/reimportar`, { method: "POST", body: { texto } });
    dlgEditor.close();
    toast("Roteiro substituído. Validando e buscando mídia.", "check");
    atualizarJobs(); atualizarGaleria();
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#btnReenvio") && ($("#btnReenvio").disabled = false);
}

function camposCena(c, i) {
  if (c.tipo === "produto") return `
    <div class="grid2">
      ${campo("Nome", "nome", c.nome)}${campo("Categoria", "categoria", c.categoria)}
      ${campo("Preço", "preco", c.preco)}${campo("Selo acima do preço", "selo", c.selo)}
    </div>
    ${campo("Benefícios (separados por vírgula)", "tags", (c.tags ?? []).join(", "))}
    ${campo("Barras (Rótulo: 0–100, uma por linha)", "specs", (c.specs ?? []).map((s) => `${s.label}: ${s.valor}`).join("\n"), "textarea")}`;
  if (c.tipo === "gancho") return `${campo("Texto na tela", "texto_tela", c.texto_tela)}
    <div style="margin:-4px 0 10px"><button class="btn fantasma peq" onclick="sugerirGanchos(${i}, this)">${ic("wand-sparkles", 14)}Sugerir 5 ganchos</button><div id="ganchos-${i}"></div></div>`;
  if (c.tipo === "cta") return `<div class="grid2">${campo("Texto na tela", "texto_tela", c.texto_tela)}${campo("Botão / resposta", "botao", c.botao)}</div>
    <div class="grid2"><div class="campo"><label class="rotulo">Ação</label><select data-f="acao">${[["seguir", "Seguir"], ["link", "Link na bio"], ["comentar", "Comentar palavra"]].map(([v, n]) => `<option value="${v}" ${v === (c.acao ?? "seguir") ? "selected" : ""}>${n}</option>`).join("")}</select></div>${campo("Palavra a comentar", "palavra", c.palavra)}</div>`;
  if (c.tipo === "quiz") return `${campo("Pergunta na tela", "pergunta", c.pergunta)}
    ${campo("Opções (uma por linha, pela ordem em que a fala as lê)", "opcoes", (c.opcoes ?? []).join("\n"), "textarea")}
    <div class="grid2">
      <div class="campo"><label class="rotulo">Resposta certa</label><select data-f="resposta"><option value="">Não mostrar</option>${(c.opcoes ?? []).map((o, k) => `<option value="${k}" ${k === c.resposta ? "selected" : ""}>${"ABCD"[k]}: ${esc(o)}</option>`).join("")}</select></div>
      ${campo("Segundos para responder", "segundos", String(c.segundos ?? 5))}
    </div>
    <div class="dica" style="margin-top:-6px">A narração lê a pergunta e as opções, sem contar. A contagem corre depois, em silêncio.</div>`;
  if (c.tipo === "fato") return `<div class="grid2">${campo("Etiqueta (ex.: Depois de uma hora)", "kicker", c.kicker)}${campo("Título na tela", "titulo", c.titulo)}</div>`;
  if (c.tipo === "modelo3d") {
    const sel = (nome, atual, opcoes) => `<select data-f="${nome}">${opcoes.map(([v, n]) => `<option value="${v}" ${v === atual ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    const m = c.modelo ?? {};
    return `<div class="grid2">${campo("Etiqueta acima do título", "kicker", c.kicker)}${campo("Título na tela", "titulo", c.titulo)}</div>
      <div class="grid2">
        <div class="campo"><label class="rotulo">Animação</label>${sel("animacao", c.animacao ?? "girar", [["girar", "Girar"], ["explodir", "Explodir em peças"], ["aproximar", "Câmera aproximando"], ["revelar", "Revelar girando"]])}</div>
        <div class="campo"><label class="rotulo">Modelo de reserva (sem arquivo)</label>${sel("procedural", c.procedural ?? "gpu", [["gpu", "Placa de vídeo"], ["cpu", "Processador"], ["ram", "Memória RAM"], ["ssd", "SSD M.2"]])}</div>
      </div>
      ${campo("Etiquetas (JSON: texto, ancora topo|frente|lado|base|centro, inicioS)", "json", JSON.stringify(c.etiquetas ?? [], null, 2), "textarea")}
      <div class="midia">
        <div class="previa"><div class="sem-midia">${m.arquivo ? `${ic("box", 22)}<br>${esc(m.arquivo.split("/").pop())}` : "Modelo procedural"}</div></div>
        <div class="midia-campos">
          <label class="rotulo" style="margin:0">Modelo 3D (.glb)</label>
          <input data-m3d="consulta" placeholder="Link direto para um .glb (ou envie um arquivo)" value="${esc(m.fonte === "url" ? m.consulta : "")}">
          <input data-m3d="credito" placeholder="Crédito do modelo (se a licença pedir)" value="${esc(m.credito)}">
          <div class="linha">
            <button class="btn peq" onclick="trocarModelo(${i})">${ic("link", 14)}Usar link</button>
            <label class="btn peq" style="margin:0">${ic("upload", 14)}Enviar .glb<input type="file" accept=".glb" hidden onchange="enviarModelo(${i}, this.files[0])"></label>
            ${m.arquivo ? `<button class="btn fantasma peq" onclick="trocarModelo(${i}, true)">${ic("trash-2", 14)}Remover</button>` : ""}
          </div>
          <div class="linha" style="margin-top:4px">
            <input data-m3d="busca" placeholder="Procurar no Sketchfab (ex.: RTX 4090, PS5, teclado mecânico)" value="${esc(m.fonte === "sketchfab" && !m.consulta?.startsWith("uid:") ? m.consulta : "")}" onkeydown="if (event.key === 'Enter') procurarSketchfab(${i})">
            <button class="btn peq" onclick="procurarSketchfab(${i})">${ic("search", 14)}Procurar</button>
          </div>
          ${OPCOES.temSketchfab ? "" : `<div class="aviso" style="margin:0">${ic("key-round", 14)}<span>Para baixar, adicione o token do Sketchfab em Chaves de API.</span></div>`}
          <div class="resultados-3d" id="res3d-${i}"></div>
          ${m.sketchfab ? `<div class="dica" style="margin:0">${esc(m.sketchfab.nome)} · ${esc(m.sketchfab.autor)} · ${esc(m.sketchfab.licenca)}</div>` : ""}
          <div class="dica" style="margin:0">Só aparecem modelos com licença que permite uso comercial. O crédito é preenchido sozinho.</div>
        </div>
      </div>`;
  }
  if (c.tipo === "clipe") return campo("Título por cima do vídeo", "titulo", c.titulo);
  const extra = Object.fromEntries((CAMPOS_JSON[c.tipo] ?? []).filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));
  return `${c.tipo === "numero" ? "" : campo("Título na tela", "titulo", c.titulo)}${campo("Dados (JSON)", "json", JSON.stringify(extra, null, 2), "textarea")}`;
}

async function abrirEditor(id, roteiro) {
  roteiroAberto = roteiro ?? await api(`/api/roteiros/${id}`);
  const r = roteiroAberto;
  $("#edTitulo").textContent = r.titulo || id;
  const opcoesEstilo = estilosVisiveis(r.estilo ?? "neon").map(([k, e]) => `<option value="${k}" ${k === (r.estilo ?? "neon") ? "selected" : ""}>${esc(e.nome)}</option>`).join("");
  $("#edCorpo").innerHTML = `
    <div class="grid2">
      ${campo("Título", "titulo", r.titulo)}
      <div class="campo"><label class="rotulo">Estilo</label><select data-f="estilo">${opcoesEstilo}</select></div>
    </div>
    <div class="campo" style="margin-top:12px"><label class="rotulo">Canal (marca d'água)</label><select data-f="canal">${opcoesCanal(r.marcaDagua === false ? "nenhum" : r.canal ?? primeiroCanal())}</select></div>
    <div style="margin-top:12px">${campo("Palavras em destaque (vírgulas)", "destaques", (r.destaques ?? []).join(", "))}</div>
    <div style="margin-top:12px">${campo("Texto da thumbnail", "thumbnail", r.thumbnail)}</div>
    <div style="margin-top:12px">${campo("Legenda do post (hashtags e créditos)", "legenda_post", r.legenda_post, "textarea")}</div>
    <div class="grid2" style="margin-top:12px">
      <div class="campo"><label class="rotulo">Narração</label><select data-f="narracao" onchange="trocarMotorEditor(this.value)">
        <option value="edge" ${(r.narracao ?? "edge") === "edge" ? "selected" : ""}>Voz grátis</option>
        <option value="elevenlabs" ${r.narracao === "elevenlabs" ? "selected" : ""} ${OPCOES.temElevenLabs ? "" : "disabled"}>ElevenLabs</option>
        <option value="chatterbox" ${r.narracao === "chatterbox" ? "selected" : ""} ${OPCOES.temChatterbox ? "" : "disabled"}>Chatterbox</option></select></div>
      <div class="campo"><label class="rotulo">Voz</label><select data-f="voz" id="edVoz"></select></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="campo"><label class="rotulo">Música</label><div class="linha"><select data-f="musica">${opcoesMusica(r.musica ?? "auto")}</select>
        <button class="btn icone" title="Ouvir" onclick="tocarMusica(faixaDe(this.previousElementSibling.value, roteiroAberto.estilo)?.arquivo, this)">${ic("play")}</button></div></div>
      <div class="campo"><label class="rotulo">Volume da música <span id="volMusica">${Math.round((r.musicaVolume ?? 1) * 100)}%</span></label>
        <input type="range" data-f="musicaVolume" min="0.3" max="1.8" step="0.1" value="${r.musicaVolume ?? 1}" oninput="volMusica.textContent = Math.round(this.value * 100) + '%'" style="width:100%;accent-color:var(--acento)"></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="campo"><label class="rotulo">Efeitos sonoros (whoosh, impactos) <span id="volSfx">${(r.sfxVolume ?? 1) === 0 ? "desligados" : Math.round((r.sfxVolume ?? 1) * 100) + "%"}</span></label>
        <input type="range" data-f="sfxVolume" min="0" max="1.5" step="0.1" value="${r.sfxVolume ?? 1}" oninput="volSfx.textContent = Number(this.value) === 0 ? 'desligados' : Math.round(this.value * 100) + '%'" style="width:100%;accent-color:var(--acento)"></div>
    </div>
    ${blocoQualidade(r)}
    ${blocoCortes(r)}
    <div class="caixa-info" style="margin-top:14px" id="blocoRevisao"><b>Revisão visual</b><span class="meta"> carregando…</span></div>
    ${blocoPublicacao(r)}
    <div class="caixa-info" style="margin-top:14px" id="blocoCapa"><b>Capa</b><span class="meta"> carregando…</span></div>
    ${r.cenas.map((c, i) => `
      <div class="cena" data-i="${i}">
        <div class="cena-topo"><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="tipo">${NOME_CENA[c.tipo] ?? c.tipo}</span>
          <span class="meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome ?? c.titulo ?? c.texto_tela ?? "")}</span></div>
        <div class="cena-corpo">
          ${camposCena(c, i)}
          ${c.tipo === "clipe" ? "" : campo("Narração", "fala", c.fala, "textarea") + `<div class="dica" style="margin-top:-6px">Escreva como se fala: números por extenso. Use <code>[pausa]</code> para respirar e <code>[pausa longa]</code> antes de uma revelação.</div>`}
          ${blocoMidia(c, i)}
        </div>
      </div>`).join("")}`;
  await trocarMotorEditor(r.narracao ?? "edge", r.voz);
  carregarPublicacao(r.id);
  carregarCapa(r.id);
  carregarRevisao(r.id);
  if (!dlgEditor.open) dlgEditor.showModal();
}

async function trocarMotorEditor(motor, atual) {
  const sel = $("#edVoz");
  if (!sel) return;
  if (motor === "elevenlabs") {
    try { await carregarVozesEleven(); sel.innerHTML = opcoesVozEleven(atual); } catch (e) { toast(e.message, "triangle-alert"); }
    // se a voz atual não pode ser usada, passa para a primeira que pode
    if (sel.selectedOptions[0]?.disabled || !sel.value) sel.value = [...sel.options].find((o) => !o.disabled)?.value ?? "";
  } else if (motor === "chatterbox") {
    sel.innerHTML = opcoesVozChatterbox(atual);
  } else {
    sel.innerHTML = OPCOES.vozesEdge.map((v) => `<option value="${v.id}" ${v.id === atual ? "selected" : ""}>${esc(v.nome)}</option>`).join("");
  }
}

function lerEditor() {
  const r = structuredClone(roteiroAberto);
  const val = (raiz, f) => raiz.querySelector(`[data-f="${f}"]`)?.value.trim() ?? "";
  const corpo = $("#edCorpo");
  r.titulo = val(corpo, "titulo");
  r.estilo = val(corpo, "estilo");
  const canal = val(corpo, "canal");
  if (canal === "nenhum") { r.marcaDagua = false; delete r.canal; } else { r.canal = canal; delete r.marcaDagua; }
  r.destaques = val(corpo, "destaques").split(",").map((s) => s.trim()).filter(Boolean);
  r.musica = val(corpo, "musica") || "auto";
  r.thumbnail = val(corpo, "thumbnail") || undefined;
  r.legenda_post = val(corpo, "legenda_post") || undefined;
  r.narracao = val(corpo, "narracao") || "edge";
  r.voz = val(corpo, "voz") || undefined;
  r.musicaVolume = Number(val(corpo, "musicaVolume")) || 1;
  r.sfxVolume = Number(val(corpo, "sfxVolume"));
  corpo.querySelectorAll(".cena").forEach((el) => {
    const c = r.cenas[el.dataset.i];
    if (c.tipo !== "clipe") c.fala = val(el, "fala");
    if (c.tipo === "gancho") { c.texto_tela = val(el, "texto_tela"); return; }
    if (c.tipo === "quiz") {
      c.pergunta = val(el, "pergunta");
      c.opcoes = val(el, "opcoes").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 4);
      const resp = val(el, "resposta");
      if (resp !== "" && Number(resp) < c.opcoes.length) c.resposta = Number(resp); else delete c.resposta;
      c.segundos = Math.min(15, Math.max(3, Number(val(el, "segundos")) || 5));
      return;
    }
    if (c.tipo === "cta") { for (const k of ["texto_tela", "botao", "acao", "palavra"]) { const v = val(el, k); if (v) c[k] = v; else delete c[k]; } return; }
    if (c.tipo === "fato" || c.tipo === "clipe") { c.titulo = val(el, "titulo"); if (c.tipo === "fato") { const k = val(el, "kicker"); if (k) c.kicker = k; else delete c.kicker; } return; }
    if (c.tipo === "modelo3d") {
      for (const k of ["kicker", "titulo", "animacao", "procedural"]) { const v = val(el, k); if (v) c[k] = v; else delete c[k]; }
      try { c.etiquetas = JSON.parse(val(el, "json") || "[]"); } catch { throw new Error(`JSON das etiquetas inválido na cena ${Number(el.dataset.i) + 1}`); }
      return;
    }
    if (CAMPOS_JSON[c.tipo]) {
      if (c.tipo !== "numero") c.titulo = val(el, "titulo");
      try { Object.assign(c, JSON.parse(val(el, "json") || "{}")); } catch { throw new Error(`JSON inválido na cena ${Number(el.dataset.i) + 1}`); }
      return;
    }
    for (const f of ["nome", "categoria", "preco", "selo"]) { const v = val(el, f); if (v) c[f] = v; else delete c[f]; }
    c.tags = val(el, "tags").split(",").map((s) => s.trim()).filter(Boolean);
    c.specs = val(el, "specs").split("\n").map((l) => l.split(":")).filter((p) => p.length === 2)
      .map(([label, v]) => ({ label: label.trim(), valor: Math.max(0, Math.min(100, Number(v) || 0)) }));
  });
  return r;
}

// guarda o que está no editor antes de mexer na mídia, para não perder alterações
async function guardarSilencioso() {
  roteiroAberto = lerEditor();
  await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
}

async function trocarMidia(i, proxima = 0) {
  try {
    await guardarSilencioso();
    const el = document.querySelector(`.cena[data-i="${i}"]`);
    const fonte = el.querySelector('[data-m="fonte"]').value;
    const atual = roteiroAberto.cenas[i].midia;
    const indice = proxima ? (atual?.indice ?? 0) + 1 : 0;
    toast(fonte ? "Procurando…" : "Mídia removida", fonte ? "search" : "trash-2");
    const d = await api(`/api/roteiros/${roteiroAberto.id}/midia/${i}`, { method: "POST", body: {
      fonte, consulta: el.querySelector('[data-m="consulta"]').value.trim(), tipo: el.querySelector('[data-m="tipo"]').value, indice,
    } });
    if (fonte && !d.roteiro.cenas[i].midia?.arquivo) toast(d.log.at(-1) ?? "Não encontrei nada", "triangle-alert");
    abrirEditor(roteiroAberto.id, d.roteiro);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function trocarModelo(i, remover = false) {
  try {
    await guardarSilencioso();
    const el = document.querySelector(`.cena[data-i="${i}"]`);
    const consulta = remover ? "" : el.querySelector('[data-m3d="consulta"]').value.trim();
    if (!remover && !consulta) return toast("Cole o link de um arquivo .glb", "link");
    toast(remover ? "Modelo removido" : "Baixando o modelo…", remover ? "trash-2" : "download");
    const d = await api(`/api/roteiros/${roteiroAberto.id}/modelo/${i}`, { method: "POST", body: { fonte: "url", consulta, credito: el.querySelector('[data-m3d="credito"]').value.trim() } });
    if (consulta && !d.roteiro.cenas[i].modelo?.arquivo) toast(d.log.at(-1) ?? "Não consegui baixar o modelo", "triangle-alert");
    abrirEditor(roteiroAberto.id, d.roteiro);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function procurarSketchfab(i) {
  const el = document.querySelector(`.cena[data-i="${i}"]`);
  const q = el.querySelector('[data-m3d="busca"]').value.trim();
  if (!q) return toast("Escreva o que procura", "search");
  const caixa = $(`#res3d-${i}`);
  caixa.innerHTML = `<div class="meta">Procurando…</div>`;
  try {
    const r = await api(`/api/sketchfab/busca?q=${encodeURIComponent(q)}`);
    caixa.innerHTML = r.length ? r.slice(0, 12).map((m) => `
      <button class="modelo-res" title="${esc(m.nome)} — ${esc(m.autor)} (${esc(m.licenca)})" onclick="escolherSketchfab(${i}, '${m.uid}')">
        ${m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy">` : ""}
        <span>${esc(m.nome)}</span><small>${esc(m.licenca.replace("CC Attribution", "CC BY"))} · ${m.tamanhoMB} MB</small>
      </button>`).join("") : `<div class="meta">Nada com licença comercial para "${esc(q)}".</div>`;
  } catch (e) { caixa.innerHTML = `<div class="aviso">${esc(e.message)}</div>`; }
}

async function escolherSketchfab(i, uid) {
  if (!OPCOES.temSketchfab) return toast("Adicione o token do Sketchfab em Chaves de API", "key-round");
  try {
    await guardarSilencioso();
    toast("Baixando o modelo…", "download");
    const d = await api(`/api/roteiros/${roteiroAberto.id}/modelo/${i}`, { method: "POST", body: { fonte: "sketchfab", consulta: `uid:${uid}` } });
    if (!d.roteiro.cenas[i].modelo?.arquivo) toast(d.log.at(-1) ?? "Não consegui baixar o modelo", "triangle-alert");
    else toast("Modelo pronto", "check");
    abrirEditor(roteiroAberto.id, d.roteiro);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function enviarModelo(i, ficheiro) {
  if (!ficheiro) return;
  try {
    await guardarSilencioso();
    toast("Enviando o modelo…", "upload");
    const caminho = await enviarFicheiro(ficheiro);
    const el = document.querySelector(`.cena[data-i="${i}"]`);
    const d = await api(`/api/roteiros/${roteiroAberto.id}/modelo/${i}`, { method: "POST", body: { fonte: "arquivo", consulta: caminho, credito: el.querySelector('[data-m3d="credito"]').value.trim() } });
    abrirEditor(roteiroAberto.id, d.roteiro);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function enviarMidia(i, ficheiro) {
  if (!ficheiro) return;
  try {
    await guardarSilencioso();
    toast("Enviando…", "upload");
    const caminho = await enviarFicheiro(ficheiro);
    const d = await api(`/api/roteiros/${roteiroAberto.id}/midia/${i}`, { method: "POST", body: { fonte: "arquivo", consulta: caminho } });
    abrirEditor(roteiroAberto.id, d.roteiro);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

async function guardarRoteiro(depoisProduzir) {
  try {
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: lerEditor() });
    dlgEditor.close();
    if (depoisProduzir) await produzir(roteiroAberto.id); else toast("Roteiro salvo", "check");
    atualizarGaleria();
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- arranque ----------
(async () => {
  [OPCOES, MUSICAS] = await Promise.all([api("/api/opcoes"), api("/api/musicas")]);
  desenharMusica();
  $("#contaMusicas").textContent = `· ${MUSICAS.faixas.length}`;
  desenharFormatos();
  desenharEstilos();
  desenharCanais();
  atualizarSeloAuto(); setInterval(atualizarSeloAuto, 30000);
  segmentado($("#produtos"), "produtos");
  segmentado($("#duracao"), "duracao", (b) => b.dataset.v);
  segmentado($("#narracao"), "narracao", (b) => b.dataset.v, desenharVozes);
  mudarFormato();
  desenharVozes();
  atualizarGaleria();
  atualizarJobs();
  escolherOrigem("ia");
  irParaPasso(1);
  desenharIconeTema();
  desenharLado();
  desenharAnalises();
  carregarGameplays();
  irPara(location.hash.slice(1) || "criar", { historico: false });
  // a fila atualiza de 2 em 2 s com o painel à vista; escondido, de 10 em 10 s (chega para os avisos do Windows)
  let ultimaFila = Date.now();
  setInterval(() => {
    if (document.hidden && Date.now() - ultimaFila < 10000) return;
    ultimaFila = Date.now();
    atualizarJobs().catch(() => {});
  }, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) atualizarJobs().catch(() => {}); });
  // Ctrl+Enter no formulário cria o vídeo (ou procura os momentos, no modo cortes)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && e.target.closest?.("#vista-criar") && !$("#criar").disabled) { e.preventDefault(); criarDoAssistente(); }
  });
})();
