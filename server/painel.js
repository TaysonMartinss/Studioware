const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (nome, tam = 16) => `<i class="i" style="--u:url(/icones/${nome}.svg);width:${tam}px;height:${tam}px"></i>`;
// os pedidos ao painel levam X-Painel: o servidor recusa ações que não venham deste painel (proteção contra outros
// sites). Só os do próprio painel: a outros sites (as fontes da Google que o player do editor pede) o cabeçalho
// faz a pré-verificação de CORS falhar.
const fetchOriginal = window.fetch.bind(window);
const doPainel = (url) => { try { return new URL(url instanceof Request ? url.url : String(url), location.href).origin === location.origin; } catch { return true; } };
window.fetch = (url, opcoes = {}) => fetchOriginal(url, doPainel(url) ? { ...opcoes, headers: { ...(opcoes.headers ?? {}), "X-Painel": "1" } } : opcoes);
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
  ["livre", "pen-line", "Livre", "Sem molde: descreva o vídeo que imagina", "Descreva o vídeo", "Ex.: começa com o apito final, volta 90 minutos atrás e mostra lance a lance como o VAR mudou o jogo, com um gráfico da posse de bola no meio"],
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
const VISTAS = ["criar", "producao", "biblioteca", "ideias", "insights", "instagram", "estilos", "canais", "automatico", "custos", "configuracoes"];
const AO_ENTRAR = { insights: () => abrirInsights(), instagram: () => abrirInstagram(), estilos: () => desenharPaginaEstilos(), custos: () => abrirCustos(), ideias: () => abrirIdeias(), canais: () => abrirCanais(), automatico: () => abrirAuto(), configuracoes: () => abrirConfig(), biblioteca: () => atualizarGaleria() };
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
  const temLink = origem === "cortes" && $("#linkCortes").value.trim();
  if (clipe && !$("#ficheirosClipe").files.length && !temLink) { $("#erroFicheiros").hidden = false; $("#zonaClipe").focus?.(); return false; }
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
    clipe && ["Arquivos", [...$("#ficheirosClipe").files].map((f) => f.name).join(", ") || (origem === "cortes" && $("#linkCortes").value.trim()) || ""],
    !clipe && estado.formato !== "longo" && ["Duração", { curto: "30–45 s", medio: "45–60 s", longo: "60–90 s" }[estado.duracao]],
    ["Estilo", OPCOES.estilos[estado.estilo]?.nome ?? estado.estilo],
    !clipe && ["Narração", `${{ edge: "Voz grátis", elevenlabs: "ElevenLabs", chatterbox: "Chatterbox" }[estado.narracao]}${voz ? `, ${voz}` : ""}`],
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

// ---------- o tema bate com o canal? (evita renderizar com a marca d'água errada) ----------
// Sem IA: compara as palavras do tema com o nicho de cada canal. Uma palavra do próprio nicho vale 2; uma palavra do
// vocabulário de uma área que o nicho cita (futebol, games, GTA, hardware…) vale 1.
const AREAS = {
  futebol: "futebol gol golo var arbitro arbitragem penalti penalty impedimento cartao clube selecao copa mundial champions libertadores brasileirao campeonato jogador treinador tecnico messi ronaldo neymar mbappe vini vinicius flamengo palmeiras corinthians santos gremio vasco botafogo madrid barcelona benfica porto sporting escanteio lance zagueiro goleiro atacante estadio",
  games: "jogo jogos game games gamer gameplay console ps5 ps4 playstation xbox nintendo switch steam fps rpg minecraft fortnite roblox gta cs2 counter valorant zelda mario pokemon elden fifa eafc",
  gta: "gta rockstar leonida vice lucia jason trailer rdr redemption roleplay streamer youtuber criadores",
  hardware: "hardware pc placa gpu rtx radeon nvidia amd intel processador cpu ram memoria ssd monitor notebook setup teclado mouse headset fonte gabinete",
  tecnologia: "tecnologia ia inteligencia artificial celular iphone android smartphone app internet robo chatgpt apple samsung",
  ciencia: "ciencia espaco planeta nasa universo buraco estrela lua marte sol galaxia fisica quimica biologia cerebro corpo asteroide foguete",
};
const VAZIAS = new Set("de do da em no na os as um ou se ao aos que para com por uma umas uns dos das nos nas como mais sobre seu sua seus suas isso esse essa este esta ate quando porque qual quais tem ter vai foi sao ser entre pelo pela muito mesmo voce vocês voces video videos".split(" "));
const palavrasDe = (texto) => (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !VAZIAS.has(w));
// "decolagens" e "decolagem" contam como a mesma palavra (radical de 5 letras); palavras curtas têm de ser iguais
const igual = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
function pontosCanal(canal, tema) {
  const nicho = palavrasDe(`${canal.nicho ?? ""} ${canal.nome ?? ""}`);
  const areas = Object.entries(AREAS).filter(([k, v]) => nicho.some((w) => igual(w, k) || v.split(" ").includes(w))).flatMap(([, v]) => v.split(" "));
  return palavrasDe(tema).reduce((t, w) => t + (nicho.some((n) => igual(n, w)) ? 2 : areas.some((a) => igual(a, w)) ? 1 : 0), 0);
}
// devolve o canal que combina melhor com o tema, se não for o selecionado (só com 2 ou mais canais)
function canalMelhor(tema) {
  const todos = Object.entries(OPCOES.canais ?? {});
  const atual = $("#canal").value;
  if (todos.length < 2 || !atual || !tema?.trim()) return null;
  const pontos = todos.map(([id, c]) => [id, pontosCanal(c, tema)]).sort((a, b) => b[1] - a[1]);
  const doAtual = pontos.find(([id]) => id === atual)?.[1] ?? 0;
  const [melhor, pts] = pontos[0];
  return melhor !== atual && pts > doAtual && pts >= 1 ? melhor : null;
}
function desenharAvisoCanal(alvo, tema) {
  const id = canalMelhor(tema), el = $(alvo);
  el.hidden = !id;
  if (!id) return;
  const c = OPCOES.canais[id], atual = OPCOES.canais[$("#canal").value];
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start"><i class="i" style="--u:url(/icones/triangle-alert.svg);flex:none;margin-top:2px"></i><span>Este tema parece ser do canal <b>${esc(c.nome)}</b>, mas está selecionado <b>${esc(atual?.nome ?? "")}</b>. O vídeo sai com a marca d'água ${esc(atual?.arroba ?? "")}; para mudar depois, é preciso renderizar de novo.</span></div>
    <div class="linha" style="gap:8px;margin-top:10px"><button class="btn peq" onclick="trocarCanalPara('${esc(id)}', '${alvo}')"><i class="i" style="--u:url(/icones/repeat.svg)"></i>Trocar para ${esc(c.nome)}</button><button class="btn peq fantasma" onclick="$('${alvo}').hidden = true">Manter ${esc(atual?.nome ?? "")}</button></div>`;
}
function trocarCanalPara(id, alvo) {
  $("#canal").value = id;
  mudouCanal();
  $(alvo).hidden = true;
  if (dlgConfirmarCriar.open) $("#confirmarResumo").innerHTML = htmlResumo(linhasResumo());
  toast(`Canal trocado para ${OPCOES.canais[id].nome}`, "check");
}

// antes de criar: um modal com o resumo para confirmar (evita criar duas vezes por engano)
function criarDoAssistente() {
  if (!passoValido(1)) return irParaPasso(1);
  if (origem === "outraia") return abrirOutraIA();
  if ($("#criar").disabled || dlgConfirmarCriar.open) return;
  const cortes = origem === "cortes";
  $("#confirmarTitulo").textContent = cortes ? "Procurar os melhores momentos?" : "Criar este vídeo?";
  $("#confirmarDica").textContent = cortes ? "Confira as escolhas. O vídeo é enviado e analisado; os momentos aparecem para escolher." : "Confira as escolhas. Depois de começar, o vídeo entra na Produção.";
  $("#textoConfirmar").textContent = cortes ? "Sim, analisar" : "Sim, criar";
  $("#confirmarResumo").innerHTML = htmlResumo(linhasResumo());
  desenharAvisoCanal("#confirmarAvisoCanal", cortes ? $("#focoCortes").value : $("#tema").value);
  dlgConfirmarCriar.showModal();
}
async function confirmarCriar() {
  dlgConfirmarCriar.close();
  const cortes = origem === "cortes", resumo = linhasResumo();
  const ok = await criar();
  if (!ok) return;
  recomecarCriacao();
  // nos cortes a gaveta da análise já abre sozinha; nos outros, o aviso de sucesso
  if (cortes) return;
  const titulo = resumo.find(([k]) => k === "Tema" || k === "Título")?.[1] ?? "";
  $("#criadoTitulo").textContent = origem === "clipes" ? "Clipes enviados" : "Vídeo em produção";
  $("#criadoTexto").textContent = `${titulo ? `"${titulo}" ` : "O vídeo "}já está na Produção. Pode acompanhar lá cada etapa; quando ficar pronto, aparece na Biblioteca.`;
  dlgCriado.showModal();
}
// depois de um sucesso: o formulário volta ao primeiro passo, limpo (o canal, o estilo e a voz ficam)
function recomecarCriacao() {
  $("#tema").value = ""; $("#obs").value = "";
  $("#ficheirosClipe").value = ""; $("#linkCortes").value = "";
  $("#nomesClipe").textContent = origem === "cortes" ? "Escolha o vídeo longo" : "Escolha os vídeos (pela ordem em que entram)";
  passoAtual = 1;
  irParaPasso(1);
  desenharLado();
}

// canal no topo: muda o contexto de todas as páginas
function mudouCanal() {
  try { localStorage.canal = $("#canal").value; } catch {}
  desenharSeletorCanal();
  const vista = location.hash.slice(1);
  if (vista === "ideias") abrirIdeias();
  if (vista === "insights") abrirInsights();
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
    const faixas = MUSICAS.faixas.filter((f) => f.clima === k || f.tambem?.includes(k));
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
  atualizarDicaMusicaTexto();
  atualizarTrechoForm();
}
function atualizarDicaMusicaTexto() {
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

// ---------- trecho da música (como no Instagram) ----------
// A onda da faixa inteira com uma janela do tamanho do vídeo: arrasta-se para escolher onde a música começa e
// ouve-se o trecho. Só aparece com uma faixa escolhida (a automática é sorteada na produção).
const ondas = new Map();
function ondaDe(arquivo) {
  if (!ondas.has(arquivo)) ondas.set(arquivo, (async () => {
    const dados = await (await fetch(`/public/${arquivo}`)).arrayBuffer();
    // cópia local da faixa para ouvir: salta para qualquer segundo mesmo sem o servidor aceitar Range
    const url = URL.createObjectURL(new Blob([dados.slice(0)], { type: "audio/mpeg" }));
    const audio = await new OfflineAudioContext(1, 2, 44100).decodeAudioData(dados);
    const canal = audio.getChannelData(0), N = 120, passo = Math.max(1, Math.floor(canal.length / N));
    const picos = Array.from({ length: N }, (_, i) => { let m = 0; for (let k = i * passo; k < Math.min(canal.length, (i + 1) * passo); k += 32) m = Math.max(m, Math.abs(canal[k])); return m; });
    const max = Math.max(...picos, 0.01);
    return { picos: picos.map((p) => p / max), duracao: audio.duration, url };
  })());
  return ondas.get(arquivo);
}
const relogioMusica = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let tocadorTrecho = null;
function pararTrecho() { if (tocadorTrecho) { tocadorTrecho.audio.pause(); cancelAnimationFrame(tocadorTrecho.raf); tocadorTrecho.fim?.(); tocadorTrecho = null; } }
// desenha o seletor em `el`; aoMudar(segundos) quando a pessoa larga a janela
async function montarTrecho(el, { arquivo, inicio = 0, duracaoVideo = 45, aoMudar }) {
  pararTrecho();
  el.hidden = false;
  el.innerHTML = '<div class="trecho-topo">Carregando a música…</div>';
  let onda;
  try { onda = await ondaDe(arquivo); } catch { el.innerHTML = '<div class="trecho-topo">Não consegui ler esta música.</div>'; return; }
  const janela = Math.min(onda.duracao, duracaoVideo);
  const maxInicio = Math.max(0, onda.duracao - janela);
  let atual = Math.min(maxInicio, Math.max(0, inicio));
  el.innerHTML = `
    <div class="trecho-topo"><button class="btn icone peq" title="Ouvir o trecho" aria-label="Ouvir o trecho">${ic("play", 14)}</button>
      <span>Começa em <b class="t-ini"></b> e toca <b>${relogioMusica(janela)}</b> dos ${relogioMusica(onda.duracao)} da faixa</span></div>
    <div class="trecho-onda" role="slider" tabindex="0" aria-label="Onde a música começa" aria-valuemin="0" aria-valuemax="${Math.round(maxInicio)}">
      <div class="trecho-barras">${onda.picos.map((p) => `<i style="height:${Math.max(4, p * 100)}%"></i>`).join("")}</div>
      <div class="trecho-janela"></div><div class="trecho-agulha" hidden></div>
    </div>
    <div class="dica" style="margin-top:6px">Arraste a janela para escolher o trecho, como no Instagram (as setas do teclado ajustam de 1 em 1 segundo).</div>`;
  const caixa = el.querySelector(".trecho-onda"), jan = el.querySelector(".trecho-janela"), agulha = el.querySelector(".trecho-agulha"), barras = [...el.querySelectorAll(".trecho-barras i")];
  const desenhar = () => {
    const a = atual / onda.duracao, b = (atual + janela) / onda.duracao;
    jan.style.left = `${a * 100}%`; jan.style.width = `${(janela / onda.duracao) * 100}%`;
    barras.forEach((x, i) => x.classList.toggle("dentro", (i + 0.5) / barras.length >= a && (i + 0.5) / barras.length <= b));
    el.querySelector(".t-ini").textContent = relogioMusica(atual);
    caixa.setAttribute("aria-valuenow", Math.round(atual));
  };
  desenhar();
  let arrasto = null;
  caixa.onpointerdown = (ev) => {
    pararTrecho();
    const r = caixa.getBoundingClientRect();
    const t = ((ev.clientX - r.left) / r.width) * onda.duracao;
    // carregar fora da janela centra-a ali; dentro, agarra-a onde se carregou
    const dentro = t >= atual && t <= atual + janela;
    arrasto = { r, desvio: dentro ? t - atual : janela / 2 };
    atual = Math.min(maxInicio, Math.max(0, t - arrasto.desvio)); desenhar();
    caixa.setPointerCapture(ev.pointerId);
  };
  caixa.onpointermove = (ev) => {
    if (!arrasto) return;
    const t = ((ev.clientX - arrasto.r.left) / arrasto.r.width) * onda.duracao;
    atual = Math.min(maxInicio, Math.max(0, t - arrasto.desvio)); desenhar();
  };
  caixa.onpointerup = () => { if (!arrasto) return; arrasto = null; atual = Math.round(atual * 10) / 10; aoMudar?.(atual); };
  caixa.onkeydown = (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    const passo = ev.shiftKey ? 5 : 1;
    atual = Math.min(maxInicio, Math.max(0, atual + (ev.key === "ArrowRight" ? passo : -passo))); desenhar(); aoMudar?.(atual);
  };
  const botao = el.querySelector(".trecho-topo button");
  botao.onclick = () => {
    if (tocadorTrecho) return pararTrecho();
    const audio = new Audio(onda.url);
    // a posição só se pode mudar depois de o browser ler o cabeçalho da faixa
    audio.volume = 0.6;
    audio.addEventListener("loadedmetadata", () => { audio.currentTime = atual; audio.play(); }, { once: true });
    botao.innerHTML = ic("square", 14);
    agulha.hidden = false;
    const passo = () => {
      if (audio.currentTime >= atual + janela || audio.ended) return pararTrecho();
      agulha.style.left = `${(audio.currentTime / onda.duracao) * 100}%`;
      tocadorTrecho.raf = requestAnimationFrame(passo);
    };
    tocadorTrecho = { audio, raf: requestAnimationFrame(passo), fim: () => { botao.innerHTML = ic("play", 14); agulha.hidden = true; } };
  };
}
// duração prevista do vídeo para o tamanho da janela (a real só se sabe depois da narração)
const duracaoPrevista = () => (estado.formato === "longo" ? 360 : estado.formato === "clipe" ? 45 : { curto: 40, medio: 53, longo: 75 }[estado.duracao] ?? 50);
function atualizarTrechoForm() {
  // só com uma faixa escolhida: a automática (ou "qualquer faixa" de um clima) só é sorteada na produção
  const escolha = $("#musica").value, f = escolha.includes("/") ? faixaDe(escolha, estado.estilo) : null;
  if (!f) {
    pararTrecho(); estado.musicaInicio = 0;
    $("#trechoMusica").hidden = escolha === "nenhuma";
    $("#trechoMusica").innerHTML = '<div class="dica">Para escolher o trecho da música, escolha uma faixa da lista.</div>';
    return;
  }
  if (estado.musicaArquivo !== f.arquivo) { estado.musicaArquivo = f.arquivo; estado.musicaInicio = 0; }
  montarTrecho($("#trechoMusica"), {
    arquivo: f.arquivo, inicio: estado.musicaInicio, duracaoVideo: duracaoPrevista(),
    aoMudar: (s) => {
      estado.musicaInicio = s;
    },
  });
}
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
            <div class="meta">${esc(f.origem)}${f.bpm ? `, ${f.bpm} BPM` : ""}${f.duracaoS ? `, ${Math.round(f.duracaoS)} s` : ""}</div>
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
  $("#estilos").innerHTML = estilosVisiveis().filter(([k]) => k).map(([k, e]) => `
    <button class="estilo ${k === estado.estilo ? "ativo" : ""}" data-k="${k}" title="${esc(e.descricao)}">
      <img src="${miniEstilo(k)}" alt="" loading="lazy"><span>${esc(e.nome)}</span>
    </button>`).join("");
  // cartão para criar um estilo a partir de um exemplo (YouTube, Instagram ou o próprio vídeo)
  $("#estilos").insertAdjacentHTML("beforeend", `<button class="estilo aprender" type="button" onclick="irPara('estilos')" title="Criar, editar e apagar estilos"><span class="aprender-mais">${ic("palette", 26)}</span><span>Gerir estilos</span></button>`);
  $("#estiloDesc").textContent = OPCOES.estilos[estado.estilo]?.descricao ?? "";
  document.querySelectorAll(".estilo[data-k]").forEach((el) => (el.onclick = () => { estado.estilo = el.dataset.k; desenharEstilos(); atualizarDicaMusica(); }));
}


// ---------- Insights: números do YouTube por canal ----------
const FONTES_TRAFEGO = { SHORTS: "Feed de Shorts", YT_SEARCH: "Pesquisa do YouTube", RELATED_VIDEO: "Vídeos sugeridos", SUBSCRIBER: "Inscritos", BROWSE: "Página inicial", EXT_URL: "Links de fora", NO_LINK_OTHER: "Direto ou desconhecido", PLAYLIST: "Playlists", YT_CHANNEL: "Página do canal", NOTIFICATION: "Notificações", YT_OTHER_PAGE: "Outras páginas do YouTube", END_SCREEN: "Ecrã final", HASHTAGS: "Hashtags", SOUND_PAGE: "Página do som", ADVERTISING: "Anúncios", CAMPAIGN_CARD: "Cartões", ANNOTATION: "Cartões", SHORTS_CONTENT_LINKS: "Links nos Shorts", LIVE_REDIRECT: "Live", PRODUCT_PAGE: "Página de produto", VIDEO_REMIXES: "Remixes" };
// cada canal tem os seus números e o seu diagnóstico, guardados à parte: um trabalho que acaba depois de se mudar
// de canal fica no canal que o pediu e só se desenha se esse canal ainda for o escolhido no topo
let insEstado = null;
const insCanais = {}; // canal -> { dados, ocupado }
const insDe = (canal = canalAtual()) => (insCanais[canal] ??= { dados: null, ocupado: false });
const nomeCanal = (canal) => OPCOES.canais?.[canal]?.nome ?? canal;
const tempoCurto = (s) => (s == null ? "—" : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)} s`);
const pct = (v, casas = 0) => (v == null ? "—" : `${Number(v).toFixed(casas).replace(".", ",")}%`);
const dataDia = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
function variacao(atual, antes, inverso = false) {
  if (!Number.isFinite(atual) || !Number.isFinite(antes) || antes === 0) return "";
  const d = ((atual - antes) / Math.abs(antes)) * 100;
  if (Math.abs(d) < 0.5) return `<span class="ins-var">igual ao período anterior</span>`;
  const bom = inverso ? d < 0 : d > 0;
  return `<span class="ins-var ${bom ? "sobe" : "desce"}">${ic(d > 0 ? "trending-up" : "trending-down", 13)}${d > 0 ? "+" : ""}${Math.round(d)}% vs. período anterior</span>`;
}
async function abrirInsights() {
  const canal = canalAtual(), el = $("#insightsCorpo");
  if (!insDe(canal).dados) el.innerHTML = '<div class="vazio">Carregando…</div>';
  try {
    const r = await api(`/api/insights?canal=${canal}`);
    insEstado = r.youtube;
    insDe(canal).dados = r.dados;
  } catch (e) { if (canal === canalAtual()) el.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
  if (canal === canalAtual()) desenharInsights();
}
function desenharInsights() {
  const el = $("#insightsCorpo"), canal = canalAtual(), ligado = insEstado?.canais?.[canal], { dados: insDados, ocupado } = insDe(canal);
  $("#insCanalNome").textContent = nomeCanal(canal);
  $("#btnInsAtualizar").disabled = !ligado?.estatisticas || ocupado;
  if (!insEstado?.configurado) {
    el.innerHTML = `<div class="vazio-grande">${ic("key-round", 28)}<b>Falta ligar a app da Google</b><span class="meta">Os números vêm da API oficial do YouTube, que é grátis. Cole o Client ID e o Client secret em Configurações (as instruções estão lá) e ative a "YouTube Analytics API" no mesmo projeto da Google Cloud.</span><button class="btn primario" onclick="irPara('configuracoes')">Abrir Configurações</button></div>`;
    return;
  }
  if (!ligado || !ligado.estatisticas) {
    el.innerHTML = `<div class="vazio-grande">${ic("chart-line", 28)}<b>${ligado ? "Falta a permissão de estatísticas" : "Este canal não está ligado ao YouTube"}</b><span class="meta">${ligado
      ? `O canal ${esc(ligado.titulo)} foi ligado antes de o estúdio pedir acesso às estatísticas. Ligue outra vez e aceite a permissão nova ("Ver relatórios do YouTube Analytics"): a publicação continua a funcionar igual.`
      : "Ligue o canal do YouTube para ver as views, a retenção e as fontes de tráfego, e o que funciona nos vídeos do estúdio."}</span>
      <button class="btn primario" onclick="ligarYoutubeInsights('${canal}')">${ligado ? "Ligar outra vez" : "Conectar YouTube"}</button></div>`;
    return;
  }
  if (!insDados) {
    el.innerHTML = `<div class="vazio-grande">${ic("refresh-cw", 28)}<b>Ainda não há números</b><span class="meta">Busque os números do canal ${esc(ligado.titulo)} no YouTube. Ficam guardados neste computador.</span><button class="btn primario" onclick="atualizarInsights()">Buscar números</button></div>`;
    return;
  }
  const d = insDados, t = d.total ?? {}, a = d.totalAntes ?? {};
  const liquidos = (x) => (x.subscribersGained ?? 0) - (x.subscribersLost ?? 0);
  const kpi = (rotulo, valor, delta, dica = "") => `<div class="custo-cartao" ${dica ? `title="${esc(dica)}"` : ""}><div class="meta">${rotulo}</div><div class="custo-valor">${valor}</div>${delta}</div>`;
  const totalTrafego = (d.trafego ?? []).reduce((s, x) => s + (x.views ?? 0), 0) || 1;
  el.innerHTML = `
    <div class="ins-canal">${d.youtube.foto ? `<img src="${esc(d.youtube.foto)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>${esc(d.youtube.titulo)}</b>
      <span class="meta">${milhares(d.youtube.inscritos)} inscritos · ${milhares(d.youtube.views)} views desde o início · últimos ${d.dias} dias (${dataDia(d.periodo.startDate)} a ${dataDia(d.periodo.endDate)}), atualizado ${quandoCusto(d.geradoEm)}</span></div></div>
    <div class="custo-grelha">
      ${kpi("Views", milhares(t.views ?? 0), variacao(t.views, a.views))}
      ${kpi("Horas vistas", milhares(Math.round((t.estimatedMinutesWatched ?? 0) / 60)), variacao(t.estimatedMinutesWatched, a.estimatedMinutesWatched))}
      ${kpi("Percentagem vista", pct(t.averageViewPercentage, 1), variacao(t.averageViewPercentage, a.averageViewPercentage), "Em média, que parte de cada vídeo as pessoas veem. Nos Shorts passa de 100% quando o vídeo dá a volta.")}
      ${kpi("Duração média vista", tempoCurto(t.averageViewDuration), variacao(t.averageViewDuration, a.averageViewDuration))}
      ${kpi("Inscritos", `${liquidos(t) >= 0 ? "+" : ""}${milhares(liquidos(t))}`, variacao(liquidos(t), liquidos(a)), `${t.subscribersGained ?? 0} ganhos e ${t.subscribersLost ?? 0} perdidos`)}
    </div>
    <div class="duas-colunas ins-colunas">
      <section class="superficie"><h2 class="titulo-superficie">Views por dia</h2>${graficoDias(d.porDia ?? [])}</section>
      <section class="superficie"><h2 class="titulo-superficie">De onde vêm as views</h2>
        ${(d.trafego ?? []).length ? `<div class="ins-barras">${d.trafego.slice(0, 8).map((x) => `<div class="ins-barra"><span>${esc(FONTES_TRAFEGO[x.insightTrafficSourceType] ?? x.insightTrafficSourceType)}</span><b>${pct((x.views / totalTrafego) * 100)}</b><i style="--p:${(x.views / totalTrafego) * 100}%"></i></div>`).join("")}</div>` : '<div class="meta">Sem views no período.</div>'}
      </section>
    </div>
    ${blocoDiagnostico(d)}
    ${blocoCruzamento(d.cruzamento)}
    <section class="superficie"><h2 class="titulo-superficie">Vídeos <span class="meta">os últimos ${d.videos.length}; números dos últimos ${d.dias} dias. Clique num vídeo para ver a retenção.</span></h2>
      <div class="tabela-rolar"><table class="tabela ins-tabela"><thead><tr><th>Vídeo</th><th>Views</th><th>Vista</th><th>Duração vista</th><th>CTR</th><th>Inscritos</th><th>No estúdio</th></tr></thead>
      <tbody>${d.videos.map((v, i) => `<tr class="ins-linha" onclick="mostrarRetencao(${i}, this)">
        <td><div class="ins-video"><img src="${esc(v.miniatura ?? "")}" alt="" loading="lazy" referrerpolicy="no-referrer"><span><a href="https://youtube.com/${v.short ? "shorts/" : "watch?v="}${v.id}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(v.titulo)}</a>
          <small class="meta">${dataDia(v.publicadoEm)} · ${v.short ? "Short" : "Vídeo longo"} · ${tempoCurto(v.duracao)}${v.privado ? " · não público" : ""}</small></span></div></td>
        <td>${milhares(v.periodo.views)}</td><td>${pct(v.periodo.percentagemMedia)}</td><td>${tempoCurto(v.periodo.duracaoMedia)}</td>
        <td>${v.periodo.ctr == null ? "—" : pct(v.periodo.ctr, 1)}</td><td>${v.periodo.inscritos ? `+${v.periodo.inscritos}` : "—"}</td>
        <td>${v.estudio ? `<span class="selo-estilo">${esc(v.estudio.estiloNome)}</span> <span class="selo-estilo">${esc(v.estudio.formato)}</span>` : '<span class="meta">—</span>'}</td></tr>`).join("")}</tbody></table></div>
    </section>`;
}
// barras de views por dia (SVG simples, sem biblioteca)
function graficoDias(dias) {
  if (!dias.length) return '<div class="meta">Sem dados no período.</div>';
  const L = 600, A = 180, max = Math.max(1, ...dias.map((x) => x.views ?? 0)), w = L / dias.length;
  const barras = dias.map((x, i) => { const h = Math.max(1, ((x.views ?? 0) / max) * (A - 20)); return `<rect x="${i * w + w * 0.15}" y="${A - h}" width="${Math.max(1, w * 0.7)}" height="${h}" rx="${Math.min(3, w * 0.3)}"><title>${dataDia(x.day)}: ${milhares(x.views ?? 0)} views, ${milhares(Math.round((x.estimatedMinutesWatched ?? 0) / 60))} h vistas</title></rect>`; }).join("");
  // os rótulos ficam fora do SVG: com preserveAspectRatio="none" o texto sairia esticado
  return `<div class="ins-grafico-caixa"><span class="meta">máximo ${milhares(max)} views</span>
    <svg class="ins-grafico" viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="Views por dia"><line x1="0" y1="${A}" x2="${L}" y2="${A}" class="eixo"/>${barras}</svg>
    <div class="ins-eixo-x meta"><span>${dataDia(dias[0].day)}</span><span>${dataDia(dias.at(-1).day)}</span></div></div>`;
}
function blocoCruzamento(c) {
  if (!c?.eixos?.length) return `<section class="superficie"><h2 class="titulo-superficie">O que funciona no seu canal</h2><div class="meta">Ainda nenhum vídeo do YouTube foi reconhecido como feito no estúdio. O estúdio liga-os pelo envio automático ou pelo título: publique com um dos títulos sugeridos na Publicação e atualize os números.</div></section>`;
  const eixo = (e) => { const max = Math.max(1, ...e.grupos.map((g) => g.percentagem ?? 0)); return `<div class="ins-eixo"><b>${esc(e.titulo)}</b>${e.grupos.map((g) => `<div class="ins-barra ${g.n < 3 ? "poucos" : ""}" title="${g.n} ${g.n === 1 ? "vídeo" : "vídeos"}${g.n < 3 ? " (poucos dados: é só um indício)" : ""}">
    <span>${esc(g.nome)} <small class="meta">${g.n} ${g.n === 1 ? "vídeo" : "vídeos"}</small></span><b>${pct(g.percentagem)} vista</b><i style="--p:${((g.percentagem ?? 0) / max) * 100}%"></i>
    <small class="meta">${milhares(Math.round(g.views ?? 0))} views em média · ${tempoCurto(g.duracaoVista)} vistos${g.ctr != null ? ` · CTR ${pct(g.ctr, 1)}` : ""}</small></div>`).join("")}</div>`; };
  return `<section class="superficie"><h2 class="titulo-superficie">O que funciona no seu canal <span class="meta">${c.ligados} ${c.ligados === 1 ? "vídeo do estúdio" : "vídeos do estúdio"} com views no período, ordenados pela percentagem vista</span></h2>
    <div class="ins-eixos">${c.eixos.map(eixo).join("")}</div></section>`;
}
function blocoDiagnostico(d) {
  const g = d.diagnostico;
  const botao = `<button class="btn ${g ? "" : "primario"}" onclick="analisarCanal()"><i class="i" style="--u:url(/icones/sparkles.svg)"></i>${g ? "Analisar de novo" : "Analisar com o Claude"}</button>`;
  if (!g) return `<section class="superficie ins-diag"><div class="linha" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 class="titulo-superficie" style="margin:0 0 4px">Diagnóstico</h2><span class="meta">O Claude lê estes números com os guias da skill de YouTube e diz o que manter, o que mudar e o que fazer a seguir. As ações passam também para as Ideias.</span></div>${botao}</div></section>`;
  const SAUDE = { boa: "Boa", atencao: "Atenção", fraca: "Fraca" };
  const lista = (titulo, l) => (l?.length ? `<div><b class="ins-sub">${titulo}</b><ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
  return `<section class="superficie ins-diag">
    <div class="linha" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><h2 class="titulo-superficie" style="margin:0">Diagnóstico <span class="ins-saude ${esc(g.saude ?? "")}">${SAUDE[g.saude] ?? ""}</span> <span class="meta">${quandoCusto(g.em)}, ${g.dias} dias</span></h2>${botao}</div>
    <p>${esc(g.resumo ?? "")}</p>
    <div class="duas-colunas">${lista("O que funciona", g.funciona)}${lista("O que não está a funcionar", g.nao_funciona)}</div>
    ${(g.acoes ?? []).length ? `<b class="ins-sub">O que fazer</b><div class="ins-acoes">${g.acoes.map((x, i) => `<div class="ins-acao"><span class="ins-num">${i + 1}</span><div><div class="linha" style="gap:8px;flex-wrap:wrap"><b>${esc(x.titulo)}</b><span class="selo-estilo">impacto ${esc(x.impacto ?? "")}</span></div><div class="meta">${esc(x.porque ?? "")}</div><div>${esc(x.como ?? "")}</div></div></div>`).join("")}</div>` : ""}
    ${(g.ideias ?? []).length ? `<b class="ins-sub">Próximos vídeos</b><div class="ins-ideias">${g.ideias.map((x, i) => `<button class="btn" onclick="ideiaDoInsight(${i})">${ic("pencil", 14)}${esc(x)}</button>`).join("")}</div>` : ""}
  </section>`;
}
function ideiaDoInsight(i) {
  $("#tema").value = insDe().dados.diagnostico.ideias[i];
  escolherOrigem("ia"); irPara("criar"); irParaPasso(1); $("#tema").focus();
  toast("Ideia no formulário: reveja e continue", "lightbulb");
}
async function mostrarRetencao(i, linha) {
  const prox = linha.nextElementSibling;
  if (prox?.classList.contains("ins-retencao")) { prox.remove(); return; }
  document.querySelectorAll(".ins-retencao").forEach((x) => x.remove());
  const canal = canalAtual(), v = insDe(canal).dados.videos[i];
  linha.insertAdjacentHTML("afterend", `<tr class="ins-retencao"><td colspan="7"><div class="meta">Carregando a retenção…</div></td></tr>`);
  const cel = linha.nextElementSibling.firstElementChild;
  try {
    const { pontos } = await api(`/api/insights/retencao?canal=${canal}&video=${v.id}`);
    cel.innerHTML = curvaRetencao(pontos, v);
  } catch (e) { cel.innerHTML = `<div class="meta">${esc(e.message)}</div>`; }
}
// que fração do público ainda está a ver ao longo do vídeo; a linha a tracejado é a média de vídeos parecidos
function curvaRetencao(pontos, v) {
  if (!pontos?.length) return '<div class="meta">O YouTube ainda não tem a curva deste vídeo (precisa de algumas centenas de views).</div>';
  const L = 600, A = 160, max = Math.max(1, ...pontos.map((p) => p.ficam));
  const x = (t) => t * L, y = (r) => A - (r / max) * (A - 10);
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.ficam).toFixed(1)}`).join(" ");
  const tres = pontos.find((p) => p.t * v.duracao >= 3) ?? pontos[0];
  return `<div class="ins-ret"><div class="linha" style="gap:18px;flex-wrap:wrap"><b>Retenção</b><span class="meta">aos 3 s ficam ${pct(tres.ficam * 100)} · no fim ${pct(pontos.at(-1).ficam * 100)}${max > 1 ? " (acima de 100%: há quem volte a ver partes)" : ""}</span></div>
    <svg class="ins-grafico" viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="Curva de retenção">
      <line x1="0" y1="${y(1)}" x2="${L}" y2="${y(1)}" class="eixo tracejado"/><path d="${linha} L${L},${A} L0,${A} Z" class="area"/><path d="${linha}" class="curva"/></svg>
    <div class="ins-eixo-x meta"><span>0:00</span><span>a tracejado: 100% do público</span><span>${tempoCurto(v.duracao)}</span></div></div>`;
}
function tarefaInsights(titulo, canal, t) {
  const aviso = $("#avisoAprender");
  $("#avisoAprenderTitulo").textContent = `${titulo}: ${nomeCanal(canal)}`; $("#avisoAprenderPasso").textContent = "Começando…";
  aviso.onclick = () => irPara("insights");
  aviso.hidden = false;
  return esperarTarefa(t, (p) => ($("#avisoAprenderPasso").textContent = p ?? "")).finally(() => (aviso.hidden = true));
}
async function atualizarInsights() {
  const canal = canalAtual(), meu = insDe(canal);
  meu.ocupado = true; $("#btnInsAtualizar").disabled = true;
  try {
    const t = await api(`/api/insights/atualizar?canal=${canal}&dias=${$("#insDias").value}`, { method: "POST" });
    meu.dados = await tarefaInsights("Buscando os números", canal, t);
    meu.ocupado = false;
    if (canal === canalAtual()) desenharInsights();
    toast(`Números atualizados: ${nomeCanal(canal)}`, "check");
  } catch (e) {
    meu.ocupado = false;
    // a API das estatísticas por ativar: um passo só, na Google Cloud, com o link direto
    if (canal !== canalAtual()) toast(`${nomeCanal(canal)}: ${e.message}`, "triangle-alert");
    else if (/Analytics API/.test(e.message)) {
      const projeto = /projeto (\d+)/.exec(e.message)?.[1];
      $("#insightsCorpo").innerHTML = `<div class="vazio-grande">${ic("power", 28)}<b>Falta um passo na Google Cloud</b>
        <span class="meta">O canal ficou ligado. Agora ative a YouTube Analytics API (grátis) no projeto da app: abra o link, clique em <b>Ativar</b> e volte aqui. A Google demora 1 a 2 minutos a aplicar.</span>
        <div class="linha" style="gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn primario" href="https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com${projeto ? `?project=${projeto}` : ""}" target="_blank" rel="noopener">${ic("external-link", 16)}Ativar a API</a>
        <button class="btn" onclick="atualizarInsights()">${ic("refresh-cw", 16)}Já ativei, tentar de novo</button></div></div>`;
    } else toast(e.message, "triangle-alert");
  }
  if (canal === canalAtual()) $("#btnInsAtualizar").disabled = !insEstado?.canais?.[canal]?.estatisticas;
}
async function analisarCanal() {
  const canal = canalAtual();
  try {
    const t = await api(`/api/insights/analisar?canal=${canal}`, { method: "POST" });
    const diagnostico = await tarefaInsights("Analisando o canal", canal, t);
    if (insDe(canal).dados) insDe(canal).dados.diagnostico = diagnostico;
    if (canal === canalAtual()) desenharInsights();
    toast(`Diagnóstico pronto: ${nomeCanal(canal)}`, "check");
  } catch (e) { toast(`${nomeCanal(canal)}: ${e.message}`, "triangle-alert"); }
}
async function ligarYoutubeInsights(canal) {
  try {
    const { url } = await api(`/api/youtube/ligar?canal=${canal}`);
    window.open(url, "_blank");
    toast("Autorize na janela da Google, escolha o canal e aceite o acesso às estatísticas. Depois volte aqui.", "external-link");
    const vigia = setInterval(async () => {
      const r = await api(`/api/insights?canal=${canal}`).catch(() => null);
      if (r?.youtube.canais[canal]?.estatisticas) {
        clearInterval(vigia); insEstado = r.youtube; insDe(canal).dados = r.dados;
        if (canal === canalAtual()) desenharInsights();
        toast(`YouTube conectado em ${nomeCanal(canal)}: ${r.youtube.canais[canal].titulo}`, "check");
      }
    }, 3000);
    setTimeout(() => clearInterval(vigia), 5 * 60 * 1000);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- menu Estilos: ver, editar, refinar e apagar ----------
// a miniatura muda quando o estilo é editado: a data da última mudança evita a cópia antiga do navegador
const miniEstilo = (k) => { const a = OPCOES.estilos[k]?.aprendido; return `/miniaturas/${k}.jpg${a ? `?v=${encodeURIComponent(a.refinado ?? a.editado ?? a.em ?? "")}` : ""}`; };
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "");
function cartaoEstilo(k, e) {
  const a = e.aprendido, efeitos = (OPCOES.comEfeitos ?? []).includes(k);
  const selos = a ? [
    `<span class="selo-estilo">Aprendido ${dataCurta(a.em)}</span>`,
    efeitos ? `<span class="selo-estilo">Efeitos em código</span>` : "",
    a.analise ? `<span class="selo-estilo">${a.analise.planos} planos medidos</span>` : "",
  ].join("") : `<span class="selo-estilo">De fábrica</span>`;
  return `<div class="cartao-estilo" data-k="${k}">
    <img src="${miniEstilo(k)}" alt="" loading="lazy">
    <div class="cartao-estilo-corpo">
      <b>${esc(e.nome)}</b>
      <span class="meta">${esc(e.descricao ?? "")}</span>
      <div class="selos-estilo">${selos}</div>
      ${a ? `<div class="linha acoes-estilo">
        <button class="btn" onclick="abrirEditarEstilo('${k}')"><i class="i" style="--u:url(/icones/pencil.svg)"></i>Editar</button>
        ${a.analise ? `<a class="btn fantasma icone" href="/out/estilos-ref/${k}/relatorio.html" target="_blank" rel="noopener" title="Relatório da análise do vídeo de exemplo" aria-label="Relatório da análise"><i class="i" style="--u:url(/icones/file-text.svg)"></i></a>` : ""}
        ${a.link ? `<a class="btn fantasma icone" href="${esc(a.link)}" target="_blank" rel="noopener" title="Ver o vídeo de exemplo" aria-label="Ver o vídeo de exemplo"><i class="i" style="--u:url(/icones/external-link.svg)"></i></a>` : ""}
        <button class="btn fantasma icone perigo-texto" onclick="apagarEstilo('${k}')" title="Apagar o estilo" aria-label="Apagar o estilo"><i class="i" style="--u:url(/icones/trash-2.svg)"></i></button>
      </div>` : ""}
    </div>
  </div>`;
}
function desenharPaginaEstilos() {
  const lista = Object.entries(OPCOES.estilos);
  const meus = lista.filter(([, e]) => e.aprendido), fabrica = lista.filter(([, e]) => !e.aprendido && !e.oculto);
  $("#estilosPagina").innerHTML = `
    <h2 class="titulo-secao">Os seus estilos</h2>
    ${meus.length ? `<div class="grade-estilos">${meus.map(([k, e]) => cartaoEstilo(k, e)).join("")}</div>`
      : `<div class="vazio-grande">${ic("graduation-cap", 28)}<b>Ainda não há estilos seus</b><span class="meta">Mostre um vídeo com o visual que quer e o estúdio aprende as cores, a letra, o ritmo e os efeitos.</span><button class="btn primario" onclick="abrirAprender()">Aprendo com seu exemplo</button></div>`}
    <h2 class="titulo-secao">De fábrica</h2>
    <div class="grade-estilos">${fabrica.map(([k, e]) => cartaoEstilo(k, e)).join("")}</div>`;
}
// o aviso no canto acompanha o trabalho; no fim, atualiza as opções, o passo 2 e esta página
async function trabalhoDeEstilo(titulo, t) {
  const aviso = $("#avisoAprender");
  $("#avisoAprenderTitulo").textContent = titulo; $("#avisoAprenderPasso").textContent = "Começando…";
  aviso.onclick = () => irPara("estilos");
  aviso.hidden = false;
  try { return await esperarTarefa(t, (p) => ($("#avisoAprenderPasso").textContent = p ?? "")); }
  finally {
    aviso.hidden = true;
    OPCOES = await api("/api/opcoes");
    desenharEstilos(); desenharPaginaEstilos();
  }
}
let estiloEditado = null;
const ROTULOS_ESCOLHA = { tema: "Fundo", legenda: "Legendas", titulo: "Letra dos títulos", corpo: "Letra do corpo", transicao: "Corte entre cenas", overlay: "Textura por cima" };
const NOMES_OPCAO = {
  grelha: "Escuro com luz de cor", gradiente: "Gradiente", solido: "Escuro liso", papel: "Papel craft", estrelas: "Espaço", claro: "Claro limpo", synthwave: "Pôr do sol anos 80",
  hud: "Interface sci-fi", cartesiano: "Quadro de matemática", mundo3d: "Estúdio 3D escuro", editorial: "Papel milimétrico (revista)", vice: "Céu com palmeiras",
  scan: "Linhas de ecrã", vhs: "VHS", grao: "Grão", padrao: "Palavra a palavra", hormozi: "Gigantes saltitantes", pilula: "Em pílula", elegante: "Discretas",
  neon: "Neon", marcador: "Marcador", aquarela: "Aquarela", whip: "Chicote", corte: "Seco", suave: "Suave", forma: "Forma", voo: "Voo de câmara 3D", folha: "Folha",
};
const NOMES_FONTE = { anton: "Anton", archivo: "Archivo", kalam: "Kalam (manuscrita)", inter: "Inter", montserrat: "Montserrat", marker: "Marker", poppins: "Poppins", grotesk: "Space Grotesk", vt323: "VT323 (pixel)", orbitron: "Orbitron", mono: "Mono", serif: "Serifa de revista", stix: "STIX (livro)" };
function abrirEditarEstilo(k) {
  const e = OPCOES.estilos[k];
  if (!e?.aprendido) return;
  estiloEditado = k;
  $("#editarEstiloTitulo").textContent = `Editar: ${e.nome}`;
  $("#editarEstiloMini").src = miniEstilo(k);
  $("#eeNome").value = e.nome; $("#eeDescricao").value = e.descricao ?? ""; $("#eeRefinar").value = "";
  $("#eeEfeitosLinha").hidden = !(OPCOES.comEfeitos ?? []).includes(k);
  const cores = [["cor", "Destaque"], ["cor2", "Segunda cor"], ["fundo", "Fundo"], ["corTexto", "Texto"]];
  $("#eeCores").innerHTML = cores.map(([c, rot]) => `<label class="cor-estilo"><input type="color" data-c="${c}" value="${String(e[c] ?? "#000000").slice(0, 7)}"><span>${rot}</span></label>`).join("");
  const op = OPCOES.opcoesEstilo ?? {};
  const listaDe = (campo) => (campo === "titulo" || campo === "corpo" ? op.fonte : op[campo]) ?? [];
  $("#eeEscolhas").innerHTML = Object.entries(ROTULOS_ESCOLHA).map(([campo, rot]) => `<div class="campo"><label class="rotulo" for="ee-${campo}">${rot}</label>
    <select id="ee-${campo}" data-campo="${campo}">${listaDe(campo).map((v) => `<option value="${v ?? ""}" ${(e[campo] ?? null) === v ? "selected" : ""}>${v === null ? "Nenhuma" : esc((campo === "titulo" || campo === "corpo" ? NOMES_FONTE[v] : NOMES_OPCAO[v]) ?? v)}</option>`).join("")}</select></div>`).join("");
  $("#eeShake").value = e.shake ?? 0.4; $("#eeShakeValor").textContent = $("#eeShake").value;
  $("#eeFlash").value = e.flash ?? 0; $("#eeFlashValor").textContent = $("#eeFlash").value;
  $("#eeGlitch").checked = e.glitch === true; $("#eeBrilho").checked = e.brilho === true;
  dlgEditarEstilo.showModal();
}
async function guardarEstilo() {
  const k = estiloEditado, estilo = {};
  document.querySelectorAll("#eeCores input").forEach((i) => (estilo[i.dataset.c] = i.value));
  document.querySelectorAll("#eeEscolhas select").forEach((s) => (estilo[s.dataset.campo] = s.value === "" ? null : s.value));
  Object.assign(estilo, { shake: Number($("#eeShake").value), flash: Number($("#eeFlash").value), glitch: $("#eeGlitch").checked, brilho: $("#eeBrilho").checked });
  try {
    const t = await api(`/api/estilos/${k}`, { method: "PATCH", body: { nome: $("#eeNome").value.trim(), descricao: $("#eeDescricao").value.trim(), estilo } });
    dlgEditarEstilo.close();
    const r = await trabalhoDeEstilo("Guardando o estilo", t);
    toast(`Estilo guardado: ${r.nome}`, "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function refinarEstilo() {
  const k = estiloEditado, pedido = $("#eeRefinar").value.trim();
  if (!pedido) return toast("Diga o que quer mudar no estilo", "pencil");
  try {
    const t = await api(`/api/estilos/${k}/refinar`, { method: "POST", body: { pedido, efeitos: $("#eeEfeitos").checked } });
    dlgEditarEstilo.close();
    const r = await trabalhoDeEstilo("Refinando o estilo", t);
    toast(`Estilo refinado: ${r.nome}${r.efeitos && r.efeitos !== "sem" ? ` (efeitos ${r.efeitos})` : ""}`, "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function apagarEstilo(k) {
  const e = OPCOES.estilos[k];
  if (!confirm(`Apagar o estilo "${e.nome}"? Vai para a lixeira do estúdio (lixeira/estilos), com os efeitos e a análise. Os vídeos já feitos com ele ficam como estão.`)) return;
  try {
    await api(`/api/estilos/${k}`, { method: "DELETE" });
    OPCOES = await api("/api/opcoes");
    if (estado.estilo === k) estado.estilo = "neon";
    desenharEstilos(); desenharPaginaEstilos();
    toast(`Estilo apagado: ${e.nome}`, "trash-2");
  } catch (err) { toast(err.message, "triangle-alert"); }
}

// ---------- "Aprendo com seu exemplo" ----------
let aprendendo = false; // a análise corre por minutos: o diálogo fecha e o progresso fica num aviso no canto
function abrirAprender() {
  if (!aprendendo) { $("#aprenderPasso").textContent = ""; $("#btnAprender").disabled = false; $("#aprenderResultado").hidden = true; }
  // com o rea-video instalado, o vídeo (enviado ou baixado do link) é medido plano a plano antes de o Claude criar o estilo
  $("#aprenderDica").textContent = OPCOES.temRea
    ? "Mostre um vídeo com o visual que quer e o estúdio cria um estilo novo com as mesmas cores, letra, fundo e ritmo. O vídeo (enviado ou baixado do link) é analisado plano a plano: o ritmo dos cortes, as cores e as animações do texto, os sons e a música. Demora 2 a 4 minutos para 60 s."
    : "Mostre um vídeo com o visual que quer e o estúdio cria um estilo novo com as mesmas cores, letra, fundo e ritmo. Do link usa só as imagens públicas (capa e frames); para o estilo sair mais fiel, envie também o vídeo.";
  dlgAprender.showModal();
}
// o que a análise mediu e o storyboard, para conferir o estilo que saiu
function desenharAnaliseAprendida(r) {
  const a = r.analise, caixa = $("#aprenderResultado");
  const dado = (v, rot) => (v || v === 0 ? `<div><b>${v}</b><span>${rot}</span></div>` : "");
  caixa.innerHTML = `<div class="aprender-topo"><b>${esc(r.nome)}</b><span class="meta">${esc(r.observado ?? "")}</span></div>
    <div class="aprender-dados">${dado(a.planos, "planos")}${dado(a.duracaoMediaPlano ? `${String(a.duracaoMediaPlano).replace(".", ",")} s` : "", "por plano")}${dado(a.bpm ? Math.round(a.bpm) : "", "BPM da música")}${dado(a.textos, "textos na tela")}${dado(a.efeitosSonoros, "efeitos sonoros")}</div>
    <div class="linha" style="gap:10px;justify-content:space-between"><a class="btn" href="${a.relatorio}" target="_blank" rel="noopener"><i class="i" style="--u:url(/icones/file-text.svg)"></i>Relatório completo</a>
    <button class="btn primario" onclick="dlgAprender.close()">Usar o estilo</button></div>
    ${a.storyboard ? `<div class="aprender-storyboard-caixa"><img class="aprender-storyboard" src="${a.storyboard}" alt="Storyboard: um frame por plano"></div>` : ""}`;
  caixa.hidden = false;
}
async function aprenderEstilo() {
  const link = $("#aprenderLink").value.trim(), f = $("#aprenderVideo").files[0];
  if (!link && !f) return toast("Cole um link ou escolha o vídeo", "link");
  $("#btnAprender").disabled = true;
  try {
    let arquivo;
    if (f) { $("#aprenderPasso").textContent = "A enviar o vídeo…"; arquivo = await enviarFicheiro(f); }
    const t = await api("/api/estilos/aprender", { method: "POST", body: { link, arquivo, notas: $("#aprenderNotas").value.trim(), efeitos: $("#aprenderEfeitos").checked } });
    aprendendo = true;
    dlgAprender.close();
    const aviso = $("#avisoAprender");
    $("#avisoAprenderTitulo").textContent = "Aprendendo o estilo"; aviso.onclick = abrirAprender;
    aviso.hidden = false;
    const r = await esperarTarefa(t, (p) => { $("#aprenderPasso").textContent = p ?? ""; $("#avisoAprenderPasso").textContent = p ?? "Aprendendo o estilo…"; });
    aprendendo = false; aviso.hidden = true;
    OPCOES = await api("/api/opcoes");
    estado.estilo = r.id;
    desenharEstilos(); desenharPaginaEstilos();
    if (r.analise) { desenharAnaliseAprendida(r); if (!dlgAprender.open) dlgAprender.showModal(); $("#aprenderResultado").scrollIntoView({ block: "start" }); }
    $("#aprenderPasso").textContent = "";
    toast(r.efeitos ? `Estilo novo com efeitos: ${r.nome}` : `Estilo novo: ${r.nome}${r.motivo ? ` (só a direção de arte: ${r.motivo})` : ""}`, "check");
  } catch (e) { $("#aprenderPasso").textContent = ""; toast(e.message, "triangle-alert"); }
  aprendendo = false; $("#avisoAprender").hidden = true;
  $("#btnAprender").disabled = false;
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
      <div><b>${esc(OPCOES.canais?.[h.canal]?.nome ?? h.canal)}</b>, ${esc(h.titulo ?? "")}</div>
      <div class="meta">${esc(h.estado ?? "")}${h.publicarEm ? `, publica ${new Date(h.publicarEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}${h.youtube ? `, <a href="${esc(h.youtube)}" target="_blank" rel="noopener" style="color:var(--acento)">ver</a>` : ""}</div>
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
    .map((v) => `<option value="${esc(v.id)}" ${v.bloqueada ? "disabled" : ""} ${v.id === atual ? "selected" : ""}>${esc(v.nome)}${v.detalhe ? `, ${esc(v.detalhe)}` : ""}${v.descricao ? `, ${esc(v.descricao)}` : ""}</option>`).join("")}</optgroup>`).join("");
}
$("#ouvir").onclick = () => {
  const v = vozesEleven?.vozes.find((x) => x.id === $("#voz").value);
  if (v?.preview) new Audio(v.preview).play();
};
$("#pais").onchange = () => desenharVozes();

// ---------- motor de IA: Claude Code ou IA externa (copiar e colar) ----------
let modoIA = "claude";
function desenharIaModo() {
  document.querySelectorAll("#iaModo button").forEach((b) => b.classList.toggle("ativo", b.dataset.v === modoIA));
  $("#iaModoDica").textContent = modoIA === "externa"
    ? "Cada passo que precisa de IA (roteiro, editor-chefe, ideias, cortes, exemplos, título e descrição) fica à espera em Produção: copie o pedido, cole no ChatGPT, Gemini ou outra IA e cole a resposta de volta. Em qualquer passo pode escolher \"Usar o Claude neste\". A revisão visual precisa de ver imagens e só funciona com o Claude."
    : "O Claude Code faz todos os passos sozinho, com a sua sessão ou o token configurado abaixo.";
}
document.querySelectorAll("#iaModo button").forEach((b) => (b.onclick = async () => {
  try { modoIA = (await api("/api/ia-modo", { method: "POST", body: { modo: b.dataset.v } })).modo; desenharIaModo(); toast(modoIA === "externa" ? "IA externa: os pedidos aparecem em Produção" : "Usando o Claude Code", "check"); }
  catch (e) { toast(e.message, "triangle-alert"); }
}));

// pedidos à espera da IA externa (na Produção): copiar o pedido, colar a resposta, ou usar o Claude neste
let pedidosDesenhados = "";
async function atualizarPedidosIA() {
  const d = await api("/api/ia-externa");
  modoIA = d.modo;
  const assinatura = d.pedidos.map((p) => p.id).join(",");
  if (assinatura !== pedidosDesenhados) {
    pedidosDesenhados = assinatura;
    const caixa = $("#pedidosIA");
    // guarda o que já foi colado nas caixas que continuam
    const colados = Object.fromEntries([...caixa.querySelectorAll("textarea[data-id]")].map((t) => [t.dataset.id, t.value]));
    caixa.hidden = !d.pedidos.length;
    window.__pedidosIA = Object.fromEntries(d.pedidos.map((p) => [p.id, p.texto]));
    caixa.innerHTML = d.pedidos.map((p) => `
      <div class="job pedido-ia">
        <div class="job-linha">
          <div class="job-titulo">${ic("bot", 15)} ${esc(p.rotulo)}</div>
          <span class="estado"><span class="ponto espera"></span>À espera da IA externa há ${decorrido(Date.now() - p.criado)}</span>
        </div>
        <div class="linha">
          <button class="btn primario peq" onclick="copiarPedidoIA('${p.id}')">${ic("copy", 14)}Copiar pedido</button>
          <button class="btn fantasma peq" onclick="usarClaudeIA('${p.id}')">${ic("bot", 14)}Usar o Claude neste</button>
          <span class="meta">${Math.round(p.texto.length / 1000)} mil caracteres</span>
        </div>
        <textarea data-id="${p.id}" placeholder="Cole aqui a resposta da outra IA (o JSON)">${esc(colados[p.id] ?? "")}</textarea>
        <div class="linha"><button class="btn peq" onclick="enviarRespostaIA('${p.id}')">${ic("check", 14)}Enviar resposta</button></div>
      </div>`).join("");
  }
  return d.pedidos.length;
}
async function copiarPedidoIA(id) {
  try { await navigator.clipboard.writeText(window.__pedidosIA?.[id] ?? ""); toast("Pedido copiado: cole-o na outra IA", "copy"); }
  catch { toast("Não consegui copiar; selecione o texto à mão", "triangle-alert"); }
}
async function enviarRespostaIA(id) {
  const texto = document.querySelector(`#pedidosIA textarea[data-id="${id}"]`)?.value ?? "";
  if (!texto.trim()) return toast("Cole primeiro a resposta da outra IA", "clipboard");
  try { await api(`/api/ia-externa/${id}/resposta`, { method: "POST", body: { texto } }); toast("Resposta recebida, o processo continua", "check"); pedidosDesenhados = ""; atualizarPedidosIA(); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
async function usarClaudeIA(id) {
  try { await api(`/api/ia-externa/${id}/claude`, { method: "POST" }); toast("Usando o Claude neste passo", "check"); pedidosDesenhados = ""; atualizarPedidosIA(); }
  catch (e) { toast(e.message, "triangle-alert"); }
}

function abrirConfig() {
  desenharIaModo();
  $("#chave").value = ""; $("#chavePixabay").value = ""; $("#chaveSketchfab").value = "";
  $("#estadoSketchfab").textContent = OPCOES.temSketchfab ? "· configurada" : "";
  $("#estadoEleven").textContent = OPCOES.temElevenLabs ? "· configurada" : "";
  $("#estadoPixabay").textContent = OPCOES.temPixabay ? "· configurada" : "";
  $("#estadoGoogle").textContent = OPCOES.temGoogle ? "· configurada" : ""; $("#estadoMeta").textContent = OPCOES.temMeta ? "· configurada" : ""; $("#metaId").value = ""; $("#metaSegredo").value = ""; $("#estadoClaude").textContent = OPCOES.temClaudeToken ? "· configurado" : ""; $("#tokenClaude").value = ""; $("#googleId").value = ""; $("#googleSegredo").value = "";
}
async function guardarChave() {
  try {
    const eleven = $("#chave").value.trim(), pixabay = $("#chavePixabay").value.trim(), sketchfab = $("#chaveSketchfab").value.trim();
    const gId = $("#googleId").value.trim(), gSeg = $("#googleSegredo").value.trim(), tClaude = $("#tokenClaude").value.trim();
    const mId = $("#metaId").value.trim(), mSeg = $("#metaSegredo").value.trim();
    await api("/api/chaves", { method: "POST", body: { ELEVENLABS_API_KEY: eleven, PIXABAY_API_KEY: pixabay, SKETCHFAB_API_TOKEN: sketchfab, GOOGLE_CLIENT_ID: gId, GOOGLE_CLIENT_SECRET: gSeg, META_APP_ID: mId, META_APP_SECRET: mSeg, CLAUDE_CODE_OAUTH_TOKEN: tClaude } });
    if (mId && mSeg) OPCOES.temMeta = true;
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
  narracao: estado.narracao, voz: $("#voz").value, observacoes: $("#obs").value.trim(), musica: $("#musica").value, musicaInicio: estado.musicaInicio || undefined, duracao: estado.duracao,
  canal: $("#canal").value, lowpoly: lowpolyEnvio(),
});
function abrirOutraIA() {
  const p = pedidoAtual();
  if (estado.formato === "clipe") return toast("Os clipes não precisam de roteiro", "scissors");
  if (!p.tema) { $("#tema").focus(); return toast("Escreva primeiro o tema do vídeo", "pencil"); }
  $("#outraIAResumo").textContent = `${nomeFormato(p.formato)}, ${OPCOES.estilos[p.estilo]?.nome ?? p.estilo}, ${p.tema}`;
  desenharAvisoCanal("#outraIAAvisoCanal", p.tema);
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
    atualizarJobs();
    recomecarCriacao();
    $("#criadoTitulo").textContent = "Roteiro importado";
    $("#criadoTexto").textContent = "O estúdio está validando o roteiro e buscando a mídia. Depois ele espera a sua revisão na Produção antes de narrar e renderizar.";
    dlgCriado.showModal();
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#importarIA").disabled = false;
}

async function criar() {
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  const tema = $("#tema").value.trim();
  if (estado.formato === "clipe" && $("#modoCortes").checked) return analisarCortes();
  if ($("#criar").disabled) return false;
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
        formato: "clipe", tema, estilo: estado.estilo, canal: $("#canal").value, arquivos, musica: $("#musica").value, musicaInicio: estado.musicaInicio || undefined, cortar: $("#cortar").checked, destaques: $("#destaquesClipe").value, enquadrar: $("#enquadrar").checked, exemplos: $("#exemplos").checked, gameplay: $("#gameplay").value, gameplayIntercalar: $("#gameplayIntercalar").checked,
      } });
      $("#ficheirosClipe").value = ""; $("#nomesClipe").textContent = "Escolha os vídeos (pela ordem em que entram)";
      toast("Cortando e legendando", "scissors");
    } else {
      if (estado.narracao === "elevenlabs" && !$("#voz").value) throw new Error("Escolha uma voz da ElevenLabs");
      await api("/api/jobs", { method: "POST", body: {
        formato: formatoEnvio(), tema, estilo: estado.estilo, produtos: estado.produtos, pais: $("#pais").value, narracao: estado.narracao,
        voz: $("#voz").value, observacoes: $("#obs").value.trim(), revisar: $("#revisar").checked, musica: $("#musica").value, musicaInicio: estado.musicaInicio || undefined,
        duracao: estado.duracao, editorChefe: $("#editorChefe").checked, revisaoVisual: $("#revisaoVisual").checked, canal: $("#canal").value, lowpoly: lowpolyEnvio(),
      } });
      toast("Na fila. O Claude está pesquisando.", "search");
    }
    $("#tema").value = ""; $("#obs").value = "";
    atualizarJobs();
    $("#criar").disabled = false;
    return true;
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#criar").disabled = false;
  return false;
}

// ---------- fila ----------
const ETAPAS = [["roteiro", "Roteiro"], ["editor", "Editor"], ["midia", "Mídia"], ["aguardando revisao", "Revisão"], ["clipes", "Cortes"], ["narracao", "Narração"], ["render", "Render"], ["pronto", "Pronto"]];
const NOME_ESTADO = { "na fila": "Na fila", "na fila de render": "Aguardando render", roteiro: "Escrevendo o roteiro", editor: "Editor-chefe revisando", midia: "Buscando mídia", "aguardando revisao": "Aguardando sua revisão", clipes: "Cortando e legendando", narracao: "Narrando", render: "Renderizando", pronto: "Pronto", erro: "Falhou", parado: "Parado" };
const nomeFormato = (k) => FORMATOS.find(([f]) => f === k)?.[2] ?? "";
let jobsAntes = {}, logsAbertos = new Set();
let filaDesenhada = "";
async function atualizarJobs() {
  const analisando = (await seguirAnalises().catch(() => 0)) + (await atualizarPedidosIA().catch(() => 0));
  const jobs = await api("/api/jobs");
  const ativos = jobs.filter((j) => j.estado !== "pronto" || Date.now() - j.criado < 10 * 60e3);
  const emCurso = ativos.filter((j) => !["pronto", "erro", "parado"].includes(j.estado)).length + analisando;
  $("#limparFalhados").hidden = !jobs.some((j) => j.estado === "erro" || j.estado === "parado");
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
        <span class="meta">${esc(nomeFormato(j.formato))}, ${esc(OPCOES.estilos[j.estilo]?.nome ?? j.estilo ?? "")}</span>
        <span class="estado"><span class="ponto ${ponto}"></span>${NOME_ESTADO[j.estado] ?? esc(j.estado)}${j.estado === "render" ? ` ${j.progresso}%` : ""}</span>
        ${j.estado === "aguardando revisao" ? `<button class="btn primario peq" onclick="abrirEditor('${j.videoId}')">Rever roteiro</button>` : ""}
        ${podeParar ? `<button class="btn peq" title="Parar este vídeo" onclick="pararJob('${j.id}')">${ic("square", 13)}Parar</button>` : ""}
        ${j.estado === "erro" || j.estado === "parado" ? `<button class="btn fantasma peq" title="Tirar da Produção (o roteiro e a mídia ficam)" onclick="removerJob('${j.id}')">${ic("x", 14)}Remover</button>` : ""}
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
// tirar da lista os vídeos que falharam ou foram parados: só sai o registo, o roteiro e a mídia continuam
async function removerJob(id) {
  try { await api(`/api/jobs/${id}`, { method: "DELETE" }); } catch (e) { return toast(e.message, "triangle-alert"); }
  logsAbertos.delete(id); filaDesenhada = ""; atualizarJobs();
}
async function limparFalhados() {
  try { const r = await api("/api/jobs", { method: "DELETE" }); toast(r.removidos === 1 ? "1 vídeo tirado da Produção" : `${r.removidos} vídeos tirados da Produção`, "check"); }
  catch (e) { return toast(e.message, "triangle-alert"); }
  filaDesenhada = ""; atualizarJobs();
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
          ${(p.fontes ?? []).length ? `, também: ${(p.fontes ?? []).map((f) => `${esc(f.loja)} R$ ${esc(String(f.preco))}`).join(", ")}` : ""}
          ${p.url ? `, <a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--acento)">ver na loja</a>` : ""}</div>
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
// ---------- vídeos enviados e baixados ----------
let uploadsLista = [];
async function abrirUploads() { await desenharUploads(); dlgUploads.showModal(); }
async function desenharUploads() {
  uploadsLista = await api("/api/uploads");
  const total = uploadsLista.reduce((t, v) => t + v.tamanhoMB, 0);
  $("#uploadsTotal").textContent = uploadsLista.length ? `${uploadsLista.length} ${uploadsLista.length === 1 ? "vídeo" : "vídeos"}, ${(total / 1024).toFixed(1).replace(".", ",")} GB` : "";
  $("#uploadsCorpo").innerHTML = uploadsLista.length ? uploadsLista.map((v, i) => `
    <label class="faixa" style="cursor:${v.emUso ? "default" : "pointer"}">
      <input type="checkbox" data-upload="${i}" ${v.emUso ? "disabled" : ""} onchange="contarUploads()" style="margin-top:4px;accent-color:var(--acento)" aria-label="Selecionar ${esc(v.nome)}">
      <video src="/public/${esc(v.arquivo)}#t=8" preload="metadata" muted class="mini-video"></video>
      <div class="faixa-campos">
        <b style="font-weight:500">${esc(v.nome)}</b>
        <div class="meta">${v.origem === "Enviado" ? "Enviado" : `Baixado do ${v.origem}`} em ${new Date(v.criado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}, ${v.tamanhoMB} MB</div>
        ${v.emUso ? '<div class="meta" style="color:var(--aviso)">Em uso: um Short da biblioteca ainda vai ser cortado dele</div>' : ""}
        ${v.link ? `<a class="meta" href="${esc(v.link)}" target="_blank" rel="noopener">Abrir no ${esc(v.origem)}</a>` : ""}
      </div>
    </label>`).join("") : '<div class="vazio">Nenhum vídeo enviado ou baixado.</div>';
  contarUploads();
}
function contarUploads() {
  const marcados = [...document.querySelectorAll("#uploadsCorpo input[data-upload]:checked")].map((x) => uploadsLista[Number(x.dataset.upload)]);
  const mb = marcados.reduce((t, v) => t + v.tamanhoMB, 0);
  $("#uploadsSelecao").textContent = marcados.length ? `${marcados.length} ${marcados.length === 1 ? "selecionado" : "selecionados"}, ${mb} MB` : "";
  $("#btnApagarUploads").disabled = !marcados.length;
}
async function apagarUploads() {
  const marcados = [...document.querySelectorAll("#uploadsCorpo input[data-upload]:checked")].map((x) => uploadsLista[Number(x.dataset.upload)]);
  if (!marcados.length || !confirm(`Apagar ${marcados.length === 1 ? "este vídeo" : `estes ${marcados.length} vídeos`} do disco? Não passa pela lixeira e não dá para desfazer.`)) return;
  try {
    const d = await api("/api/uploads", { method: "DELETE", body: { arquivos: marcados.map((v) => v.arquivo) } });
    toast(`${d.apagados} ${d.apagados === 1 ? "vídeo apagado" : "vídeos apagados"}. ${d.libertadoMB} MB liberados`, "trash-2");
  } catch (e) { toast(e.message, "triangle-alert"); }
  desenharUploads();
}

async function desenharLixeira() {
  const itens = await api("/api/lixeira");
  $("#contaLixo").textContent = itens.length;
  const total = itens.reduce((t, v) => t + v.tamanhoMB, 0);
  $("#lixoTotal").textContent = itens.length ? `${itens.length} ${itens.length === 1 ? "vídeo" : "vídeos"}, ${total.toFixed(1)} MB` : "";
  $("#btnEsvaziar").disabled = !itens.length;
  $("#lixoCorpo").innerHTML = itens.length ? itens.map((v) => `
    <div class="faixa">
      ${v.temVideo ? `<video src="/lixeira/${v.id}/video.mp4#t=2" preload="metadata" muted class="mini-video"></video>` : `<div class="mini-video sem-midia">${ic("file-text", 18)}</div>`}
      <div class="faixa-campos">
        <b style="font-weight:500">${esc(v.titulo)}</b>
        <div class="meta">${esc(OPCOES.estilos[v.estilo]?.nome ?? v.estilo ?? "")}, na lixeira ${quando(v.apagadoEm)}, ${v.tamanhoMB} MB</div>
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
  toast(`Apagado. ${d.libertadoMB} MB liberados`, "trash-2");
  desenharLixeira();
}
async function esvaziarLixeira() {
  if (!confirm("Apagar de vez todos os vídeos da lixeira? Não dá para desfazer.")) return;
  const d = await api("/api/lixeira", { method: "DELETE" });
  toast(`${d.apagados} apagados. ${d.libertadoMB} MB liberados`, "trash-2");
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
        <div class="meta">${esc(OPCOES.estilos[v.estilo]?.nome ?? v.estilo)}, ${quando(v.atualizado)}</div>
        ${v.thumbnail ? `<div class="meta" title="Texto da thumbnail">${ic("image", 12)} ${esc(v.thumbnail)}</div>` : ""}
        ${v.musica ? `<div class="meta" title="${esc(v.musica.credito)}">${ic("music", 12)} ${esc(v.musica.nome)}${v.musica.artista ? `, ${esc(v.musica.artista)}` : ""}</div>` : ""}
      </div>
      <div class="cartao-acoes">
        <button class="btn fantasma icone peq" onclick="abrirEditor('${v.id}')" title="Editar o roteiro" aria-label="Editar o roteiro">${ic("pencil", 15)}</button>
        <button class="btn fantasma icone peq" onclick="abrirEdicao('${v.id}')" title="Editor com timeline e player ao vivo" aria-label="Abrir a timeline">${ic("film", 15)}</button>
        <button class="btn fantasma icone peq" onclick="abrirPublicacao('${v.id}')" title="Dados da publicação: títulos, descrição, tags e legendas" aria-label="Dados da publicação">${ic("megaphone", 15)}</button>
        ${v.legendaPost || v.musica?.credito ? `<button class="btn fantasma icone peq" title="Copiar legenda do post" aria-label="Copiar legenda do post" onclick="copiarLegenda(${esc(JSON.stringify(v.legendaPost))}, ${esc(JSON.stringify(v.musica?.credito ?? ""))})">${ic("clipboard-copy", 15)}</button>` : ""}
        ${v.video ? `<a class="btn fantasma icone peq" href="${v.video}" download="${v.id}.mp4" title="Baixar o vídeo" aria-label="Baixar o vídeo">${ic("download", 15)}</a>` : `<button class="btn fantasma icone peq" onclick="produzir('${v.id}')" title="Renderizar o vídeo" aria-label="Renderizar o vídeo">${ic("play", 15)}</button>`}
        <button class="btn fantasma icone peq" title="Mover para a lixeira" aria-label="Mover para a lixeira" onclick="paraLixeira(['${v.id}'])">${ic("trash-2", 15)}</button>
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

const NOME_CENA = { dado: "Dado (editorial)", calendario: "Calendário (tempo a passar)", tipografia: "Tipografia editorial", faixa: "Faixa de cinema", palavras: "Palavras gigantes", lowpoly: "Animação 3D", quiz: "Pergunta (quiz)", modelo3d: "Modelo 3D", numero: "Número", comparacao: "Comparação", gancho: "Gancho", cta: "Fecho", fato: "Curiosidade", grafico: "Gráfico", linha_tempo: "Linha do tempo", manim: "Manim", clipe: "Clipe", produto: "Produto" };
const CAMPOS_JSON = { lowpoly: ["cenario", "hora", "variante", "plano", "camera", "festa", "personagens", "objetos", "corpos", "rotulos", "etiqueta"], numero: ["valor", "prefixo", "sufixo", "texto", "icone", "alerta"], comparacao: ["esquerda", "direita", "vencedor"], grafico: ["grafico", "dados", "unidade", "destaque"], linha_tempo: ["eventos"], manim: ["codigo"] };
const FONTES_MIDIA = [["", "Sem mídia"], ["steam", "Steam (jogo)"], ["wikimedia", "Wikimedia (foto livre)"], ["pixabay", "Pixabay (stock)"], ["sketchfab", "Modelo 3D: Sketchfab"], ["procedural", "Modelo 3D do estúdio"], ["anatomia", "Modelo 3D: anatomia e saúde"], ["emoji", "2D: emoji 3D (cérebro, lâmpada…)"], ["cs2", "2D: skin do CS2"], ["url", "Link direto (foto, vídeo ou .glb)"]];
// o que escrever na pesquisa, por fonte
const DICA_FONTE = {
  anatomia: "coracao, cerebro, torso_orgaos, esqueleto, corpo, musculos, estomago, rim, olho, dna, globulos, comprimido, seringa",
  emoji: "Nome em inglês ou português (ex.: brain, light bulb, lâmpada, faca)", cs2: "Nome da skin (ex.: AK-47 | Redline, Karambit Doppler)",
  steam: "Nome do jogo", wikimedia: "Termo em inglês (ex.: graphics card)", pixabay: "Termo em inglês (ex.: gamer setup)",
  sketchfab: "Termo em inglês (ex.: rtx 4090, ps5 controller)", procedural: "gpu, cpu, ram ou ssd", url: "Link de .jpg/.mp4/.glb ou de um vídeo do YouTube, Instagram, TikTok (?t=90 para começar aos 90 s)",
};
function mudarFonteMidia(sel) {
  const el = sel.closest(".midia");
  el.querySelector('[data-m="consulta"]').placeholder = DICA_FONTE[sel.value] ?? "Nome do jogo, termo de pesquisa ou link";
  const tres = ["sketchfab", "procedural", "anatomia", "emoji", "cs2"].includes(sel.value); // sem escolha de foto ou vídeo
  el.querySelector('[data-m="tipo"]').hidden = tres;
  el.querySelector(".aviso-3d").hidden = !(sel.value === "sketchfab" && !OPCOES.temSketchfab);
  el.querySelector(".aviso-stock").hidden = !(sel.value === "pixabay" && !OPCOES.temPixabay);
}

const blocoMidia = (c, i) => {
  if (["manim", "clipe", "comparacao", "modelo3d", "lowpoly"].includes(c.tipo)) return "";
  const m = c.midia ?? {};
  // "pexels" ficou nos roteiros antigos: agora é o Pixabay
  const fonte = m.fonte === "pexels" ? "pixabay" : m.fonte === "arquivo" ? "" : m.fonte ?? "";
  const tres = ["sketchfab", "procedural", "anatomia", "emoji", "cs2"].includes(fonte) || m.formato === "modelo3d";
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
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(c.titulo)}</div><div class="meta">cenas ${c.inicio + 1} a ${c.fim + 1}, gancho: ${esc(c.gancho?.texto_tela ?? "")}</div></div>
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
  $("#linkCortesBox").hidden = !on;
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
    lista.map((g) => `<option value="${esc(g.arquivo)}">${esc(g.nome)}, ${min(g.duracaoS)}</option>`).join("");
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

// as escolhas do formulário para os Shorts de uma análise: ficam guardadas com ela, porque a análise pode demorar
// (sobretudo com IA externa) e o painel pode ser recarregado ou mudado entretanto
const escolhasCortes = () => ({
  estilo: estado.estilo, canal: $("#canal").value, musica: $("#musica").value, musicaInicio: estado.musicaInicio || undefined,
  cortar: $("#cortar").checked, enquadrar: $("#enquadrar").checked, gancho: $("#ganchoCortes").checked, exemplos: $("#exemplos").checked,
  gameplay: $("#gameplay").value, gameplayIntercalar: $("#gameplayIntercalar").checked,
});
async function analisarCortes() {
  const f = $("#ficheirosClipe").files[0], link = $("#linkCortes").value.trim();
  if (!f && !link) { toast("Escolha o vídeo ou cole o link do YouTube ou do Instagram", "film"); return false; }
  if ($("#criar").disabled) return false;
  const escolhas = escolhasCortes();
  const [min, max] = $("#duracaoCortes").value.split("-").map(Number);
  $("#criar").disabled = true;
  try {
    let arquivo, nome;
    if (f) {
      toast("Enviando o vídeo…", "upload");
      arquivo = await enviarFicheiro(f); nome = f.name;
    } else {
      // vídeo do YouTube ou do Instagram: baixado aqui pelo yt-dlp; o progresso aparece no aviso
      const t = await api("/api/baixar-link", { method: "POST", body: { link } });
      ({ arquivo, nome } = await esperarTarefa(t, (passo) => passo && toast(passo, "download")));
    }
    await iniciarAnalise({ arquivo, nome, min, max, foco: $("#focoCortes").value.trim(), escolhas });
    $("#criar").disabled = false;
    return true;
  } catch (e) { toast(e.message, "triangle-alert"); }
  $("#criar").disabled = false;
  return false;
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
  // o nome do vídeo e o estilo e a música com que os Shorts vão sair
  const e = a.escolhas, faixa = e && (e.musica.includes("/") ? MUSICAS.faixas.find((m) => m.arquivo === e.musica)?.nome : { auto: "música automática", nenhuma: "sem música" }[e.musica] ?? MUSICAS.climas?.[e.musica]);
  $("#cortesMeta").textContent = e ? `${a.nome}, ${OPCOES.estilos[e.estilo]?.nome ?? e.estilo}, ${faixa ?? "música"}` : a.nome;
  $("#cortesLista").innerHTML = "";
  $("#btnProduzirCortes").disabled = true;
  if (!dlgCortes.open) dlgCortes.showModal();
  if (a.estado === "pronto") return mostrarMomentos(a);
  $("#cortesPasso").textContent = a.estado === "erro" ? `Falhou: ${a.erro}` : a.passo ?? "";
}
async function mostrarMomentos(a) {
  $("#cortesPasso").textContent = "Carregando os momentos…";
  // o resultado fica gravado em disco: serve mesmo depois de o painel ser reiniciado
  const r = a.resultado ?? await api(`/api/cortes?arquivo=${encodeURIComponent(a.arquivo)}`);
  if (!r?.cortes?.length) { $("#cortesPasso").textContent = "Não encontrei o resultado desta análise. Analise o vídeo de novo."; return; }
  cortesAtuais = r;
  $("#cortesPasso").textContent = `${r.cortes.length} momentos em ${tempo(r.duracao)} de vídeo${r.aviso ? `. Aviso: ${r.aviso}` : ""}`;
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
    const estado = a.estado === "pronto" ? `${a.n} momentos` : a.estado === "erro" ? "Falhou" : a.estado === "parado" ? "Parado" : `Analisando há ${decorrido(Date.now() - a.inicio)}`;
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
      <div class="meta">${tempo(c.inicio)}–${tempo(c.fim)}, ${Math.round(c.fim - c.inicio)} s, ${esc(c.titulo ?? "")}</div>
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
  // o estilo, a música e o resto escolhidos quando a análise começou (as análises antigas usam o formulário atual)
  const escolhas = analises.find((x) => x.id === analiseNaGaveta)?.escolhas ?? escolhasCortes();
  try {
    await api("/api/cortes/produzir", { method: "POST", body: { arquivo: cortesAtuais.arquivo, cortes: escolhidos, ...escolhas } });
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
  $("#ideiasMeta").textContent = d.geradoEm ? `Geradas em ${d.geradoEm.slice(0, 16).replace("T", " ")}${d.foco ? `, foco: ${d.foco}` : ""}` : "";
  $("#ideiasLista").innerHTML = ideiasAtuais.length ? ideiasAtuais.map((x, k) => `
    <div class="caixa-info">
      <div class="linha" style="justify-content:space-between;align-items:flex-start;gap:10px"><b style="font-size:14px">${esc(x.titulo)}</b>${x.nota ? `<span class="nota-ideia" title="Potencial (1 a 10)">${esc(x.nota)}/10</span>` : ""}</div>
      <div class="meta" style="margin-top:4px">${esc(nomeFormato(x.formato) || x.formato)}, ${esc(NOME_ESTRATEGIA[x.estrategia] ?? x.estrategia ?? "")}${x.urgencia ? `, ${esc(x.urgencia)}` : ""}</div>
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
function desenharPublicacao(id, p, passo, naJanela = false) {
  const caixa = naJanela ? $("#pubCorpo") : $("#blocoPub");
  if (!caixa || (naJanela ? !dlgPublicacao.open || dlgPublicacao.dataset.id !== id : roteiroAberto?.id !== id)) return;
  textosPub = [];
  const item = (texto) => {
    if (!texto) return "";
    textosPub.push(texto);
    return `<div class="pub-item"><div>${esc(texto)}</div><button class="btn fantasma icone peq" title="Copiar" onclick="copiarPub(${textosPub.length - 1})">${ic("copy", 14)}</button></div>`;
  };
  const juntar = (lista, sep = " ") => (lista ?? []).join(sep);
  const tem = p && p.titulos;
  const botao = `<button class="btn peq" id="btnPub" onclick="${naJanela ? "gerarPublicacaoJanela" : "gerarPublicacao"}('${esc(id)}')" ${passo ? "disabled" : ""}>${ic(tem ? "refresh-cw" : "megaphone", 14)}${tem ? "Gerar de novo" : "Gerar pacote"}</button>`;
  caixa.innerHTML = `
    <div class="linha" style="justify-content:space-between">${naJanela ? "<span></span>" : "<b>Publicação</b>"}${botao}</div>
    ${passo ? `<div class="meta" style="margin-top:8px">${esc(passo)}</div>` : ""}
    ${tem ? `
      <div class="pub-rotulo">Títulos</div>${p.titulos.map((t) => item(String(t.texto ?? "").toLocaleUpperCase("pt-BR"))).join("")}
      <div class="pub-rotulo">YouTube: descrição</div>${item(p.youtube?.descricao)}
      <div class="pub-rotulo">YouTube: hashtags e tags</div>${item(juntar(p.youtube?.hashtags))}${item(juntar(p.youtube?.tags, ", "))}
      <div class="pub-rotulo">TikTok</div>${item([p.tiktok?.legenda, juntar(p.tiktok?.hashtags)].filter(Boolean).join("\n\n"))}
      <div class="pub-rotulo">Instagram Reels</div>${item([p.instagram?.legenda, juntar(p.instagram?.hashtags)].filter(Boolean).join("\n\n"))}
      ${p.facebook ? `<div class="pub-rotulo">Facebook</div>${item([p.facebook.legenda, juntar(p.facebook.hashtags)].filter(Boolean).join("\n\n"))}` : ""}
      <div class="pub-rotulo">Comentário fixado</div>${item(p.comentario_fixado)}
      ${p.capa?.texto ? `<div class="pub-rotulo">Capa</div>${item(p.capa.texto)}<div class="dica">${esc(p.capa.conceito ?? "")}</div>` : ""}
      <div class="dica" style="margin-top:10px">Gerado ${esc((p.geradoEm ?? "").slice(0, 16).replace("T", " "))}. Confira antes de publicar.</div>`
    : passo ? "" : '<div class="dica" style="margin-top:8px">Títulos em caixa alta, descrição, tags e legendas para YouTube, TikTok, Reels e Facebook, a partir deste roteiro. Nos vídeos longos, gere depois de renderizar para os capítulos virem com os tempos.</div>'}`;
}
async function gerarPublicacao(id) {
  try {
    await guardarSilencioso();
    desenharPublicacao(id, {}, "Escrevendo…");
    const t = await api(`/api/roteiros/${id}/publicacao`, { method: "POST" });
    const p = await esperarTarefa(t, (passo) => desenharPublicacao(id, {}, passo));
    desenharPublicacao(id, p);
    toast("Pacote de publicação pronto", "check");
  } catch (e) { toast(e.message, "triangle-alert"); carregarPublicacao(id); }
}

// a mesma publicação, aberta do cartão da Biblioteca (sem abrir o roteiro): ver, copiar cada texto ou tudo, gerar
async function abrirPublicacao(id) {
  const v = videosCache.find((x) => x.id === id);
  dlgPublicacao.dataset.id = id;
  $("#pubTitulo").textContent = v?.titulo || id;
  $("#pubCorpo").innerHTML = `<div class="meta">${ic("loader", 14)} A carregar…</div>`;
  dlgPublicacao.showModal();
  let p = {};
  try { p = await api(`/api/roteiros/${id}/publicacao`); } catch { /* ainda não gerado */ }
  desenharPublicacao(id, p, null, true);
}
async function gerarPublicacaoJanela(id) {
  try {
    desenharPublicacao(id, {}, "Escrevendo…", true);
    const t = await api(`/api/roteiros/${id}/publicacao`, { method: "POST" });
    const p = await esperarTarefa(t, (passo) => desenharPublicacao(id, {}, passo, true));
    desenharPublicacao(id, p, null, true);
    toast("Pacote de publicação pronto", "check");
  } catch (e) {
    toast(e.message, "triangle-alert");
    let p = {}; try { p = await api(`/api/roteiros/${id}/publicacao`); } catch { /* nada guardado */ }
    desenharPublicacao(id, p, null, true);
  }
}
function copiarTudoPub() {
  if (!textosPub.length) return toast("Ainda não há pacote: carregue em Gerar pacote", "megaphone");
  // cada secção com o seu nome por cima, para colar tudo num bloco de notas
  const partes = [...document.querySelectorAll("#pubCorpo .pub-rotulo, #pubCorpo .pub-item > div")].map((el) => (el.classList.contains("pub-rotulo") ? `\n== ${el.textContent} ==` : el.textContent));
  navigator.clipboard.writeText(partes.join("\n").trim()).then(() => toast("Pacote todo copiado", "check"));
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
    desenharRevisao(id, {}, "Capturando frames…");
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
        <div class="meta" style="padding:4px 8px">${NOME_LAYOUT[l]}${c.escolhida === l ? ", escolhida" : ""}</div>
      </button>`).join("")}</div>
      <div class="linha" style="margin-top:8px;gap:8px"><a class="btn fantasma peq" href="/out/${esc(id)}.capa.jpg?v=${v}" download="${esc(id)}-capa.jpg">${ic("download", 14)}Baixar a escolhida</a></div>` : ""}
    ${!passo && !c.geradoEm ? '<div class="dica" style="margin-top:8px">Usa as fotos, os b-rolls e o modelo 3D do próprio vídeo. Gera 3 variantes para escolher; a escolhida aparece na biblioteca.</div>' : ""}`;
}
async function gerarCapa(id, fundo) {
  try {
    await guardarSilencioso();
    const corpo = { texto: $("#capaTexto").value, destaque: $("#capaDestaque").value, formato: $("#capaFormato").value, ...(fundo !== undefined && { fundo }) };
    desenharCapa(id, capaAtual, "Preparando o estúdio…");
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
          <span class="meta">${esc(v.mecanismo)}, risco ${esc(v.risco)}${k === g.recomendada ? ", recomendado" : ""}</span></div>
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
    <div style="margin:-4px 0 10px"><button class="btn fantasma peq" onclick="sugerirGanchos(${i}, this)">${ic("list-plus", 14)}Sugerir 5 ganchos</button><div id="ganchos-${i}"></div></div>`;
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
          ${m.sketchfab ? `<div class="dica" style="margin:0">${esc(m.sketchfab.nome)}, ${esc(m.sketchfab.autor)}, ${esc(m.sketchfab.licenca)}</div>` : ""}
          <div class="dica" style="margin:0">Só aparecem modelos com licença que permite uso comercial. O crédito é preenchido sozinho.</div>
        </div>
      </div>`;
  }
  if (c.tipo === "clipe") return campo("Título por cima do vídeo", "titulo", c.titulo) + blocoApoios(c, i);
  const editorial = camposEditoriais(c, i);
  if (editorial !== null) return editorial;
  const extra = Object.fromEntries((CAMPOS_JSON[c.tipo] ?? []).filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));
  return `${c.tipo === "numero" ? "" : campo("Título na tela", "titulo", c.titulo)}${campo("Dados (JSON)", "json", JSON.stringify(extra, null, 2), "textarea")}`;
}


// ---------- cenas 3D low poly: editor visual (vídeos novos e apoios dos cortes) ----------
// cenário com miniatura, hora, plano e câmara, personagens e objetos por cliques; o JSON fica em "Avançado" para
// as posições e o resto (o que estiver lá entra primeiro e os campos por cima)
const NOMES_CENARIO = {
  estudio: "Estúdio", cidade: "Cidade", quarto: "Quarto", sala_estar: "Sala de estar", natureza: "Natureza", estadio: "Estádio", corrida: "Corrida (F1)",
  espaco: "Espaço", planeta: "Planeta", laboratorio: "Laboratório", hospital: "Hospital", sala_aula: "Sala de aula", bolsa: "Bolsa de valores",
  estudio_jogos: "Estúdio de jogos", nave: "Nave", fundo_mar: "Fundo do mar", pre_historia: "Pré-história", abrigo: "Abrigo nuclear",
  planeta_alien: "Planeta alienígena", oficina_relojoaria: "Relojoaria", boutique_luxo: "Boutique de luxo", balada: "Balada", lounge: "Lounge com narguilé", banheiro_balada: "Banheiro de balada", carnaval: "Bloco de carnaval", rua_sp: "Rua de São Paulo", quarto_escuro: "Quarto às 3 da manhã", consultorio: "Consultório de psicólogo", brasilia: "Brasília (Esplanada)", plenario: "Plenário da Câmara", supermercado: "Supermercado",
};
const VARIANTES_CENARIO = {
  natureza: [["floresta", "Floresta"], ["deserto", "Deserto"], ["neve", "Neve"]],
  planeta: [["terra", "Terra"], ["lua", "Lua"], ["marte", "Marte"], ["sol", "Sol"], ["mercurio", "Mercúrio"], ["venus", "Vénus"], ["jupiter", "Júpiter"], ["saturno", "Saturno"], ["urano", "Urano"], ["neptuno", "Neptuno"]],
  espaco: [["sistema_solar", "Sistema solar"], ["buraco_negro", "Buraco negro"], ["escala", "Comparar tamanhos"], ["vazio", "Vazio"]],
  corrida: [["vazia", "Pista"], ["chuva", "Chuva"], ["boxes", "Boxes"], ["podio", "Pódio"]],
  bolsa: [["alta", "Em alta"], ["queda", "Em queda"]],
  cidade: [["", "Normal"], ["ruinas", "Em ruínas"]],
  quarto_escuro: [["", "Noite (só a luz do celular)"], ["manha", "Manhã (arrumado, recuperação)"]],
  brasilia: [["", "Esplanada"], ["protesto", "Protesto (multidão dos dois lados)"]],
  plenario: [["", "Votação (SIM / NÃO a contar)"], ["sem_votacao", "Sem votação"]],
};
const VISUAIS_3D = [["pessoa", "Pessoa"], ["medico", "Médico"], ["cientista", "Cientista"], ["crianca", "Criança"], ["executivo", "Executivo"], ["gamer", "Gamer"], ["jogador", "Jogador de futebol"], ["arbitro", "Árbitro"], ["astronauta", "Astronauta"], ["mergulhador", "Mergulhador"], ["piloto", "Piloto"], ["piloto_capacete", "Piloto de capacete"], ["mecanico", "Mecânico"], ["relojoeiro", "Relojoeiro"], ["motoboy", "Motoboy"], ["politico", "Político"], ["presidente", "Presidente (com a faixa)"], ["robo", "Robô"], ["alienigena", "Alienígena"]];
const ACOES_3D = [["parado", "Parado"], ["falar", "Falar"], ["pensar", "Pensar"], ["apontar", "Apontar"], ["acenar", "Acenar"], ["andar", "Andar"], ["correr", "Correr"], ["celebrar", "Celebrar"], ["choque", "Em choque"], ["triste", "Triste"], ["encolher", "Encolher os ombros"], ["bracos_cruzados", "Braços cruzados"], ["digitar", "Digitar"], ["sentar", "Sentar"], ["dancar", "Dançar"], ["torcer", "Torcer"], ["chutar", "Chutar"], ["cair", "Cair"], ["flutuar", "Flutuar"], ["apitar", "Apitar"], ["beber", "Beber (em pé)"], ["beber_sentado", "Beber (sentado)"], ["ao_telefone", "Ao telefone"], ["entregar", "Entregar (estender a mão)"], ["rolar_celular", "Rolar o celular (em pé)"], ["celular_sentado", "Rolar o celular (sentado)"], ["cabeca_nas_maos", "Cabeça entre as mãos (sentado)"], ["esconder_rosto", "Esconder a cara (vergonha)"], ["discursar", "Discursar"], ["protestar", "Protestar (cartaz no ar)"], ["nervoso", "Nervoso / paranoia"], ["tontura", "Tontura"], ["cheirar", "Cheirar (pó)"], ["baforar", "Baforar (lança-perfume)"], ["cartao", "Mostrar cartão"], ["var", "Sinal do VAR"]];
const EXPRESSOES_3D = [["neutro", "Neutra"], ["feliz", "Feliz"], ["triste", "Triste"], ["choque", "Choque"], ["bravo", "Brava"], ["pensativo", "Pensativa"], ["convencido", "Convencida"]];
const SEGURA_3D = [["", "Nada"], ["celular", "Celular"], ["portatil", "Portátil"], ["comando", "Comando"], ["dinheiro", "Dinheiro"], ["trofeu", "Troféu"], ["bola", "Bola"], ["relogio", "Relógio"], ["bandeira", "Bandeira"], ["bandeira_brasil", "Bandeira do Brasil"], ["champanhe", "Champanhe"], ["apito", "Apito"], ["cartao_amarelo", "Cartão amarelo"], ["cartao_vermelho", "Cartão vermelho"], ["copo_gin", "Copo de gin"], ["garrafa_gin", "Garrafa de gin"], ["cartao_banco", "Cartão do banco"], ["maquininha", "Maquininha de cartão"], ["microfone", "Microfone"], ["placa_protesto", "Cartaz de protesto"], ["carteira_trabalho", "Carteira de trabalho"], ["nota_enrolada", "Nota enrolada"], ["lanca_perfume", "Lança-perfume"], ["pano", "Pano / lenço"], ["geiger", "Contador Geiger"], ["pinca", "Pinça"], ["bandeira_xadrez", "Bandeira xadrez"]];
const OBJETOS_3D = ["celula", "adn", "molecula", "atomo", "frasco", "bomba", "radiacao", "explosao", "fogo", "fumo", "foguetao", "satelite", "estacao", "asteroide", "ovni", "portal", "vulcao", "cristal", "cogumelo",
  "tiranossauro", "braquiossauro", "pterossauro", "tubarao", "baleia", "cardume", "vaca", "touro", "urso", "trofeu", "bola", "carro_f1", "velas", "seta", "moedas", "dinheiro", "empresa",
  "placa_mae", "processador", "placa_de_video", "memoria_ram", "ssd", "cooler", "fonte", "console", "controle", "tv", "codigo", "motor_jogo", "arte_3d", "som", "nivel", "bug",
  "relogio", "mecanismo", "engrenagens", "escape", "mola_real", "rubi", "lingotes", "fundicao", "maquina_cnc", "tanque_agua", "missil", "bombardeiro", "smartphone", "cerebro", "urna", "mala_dinheiro", "plataforma_petroleo", "pulpito",
  "cubo", "esfera", "piramide", "cilindro", "cone", "dodecaedro", "icosaedro", "toro", "superficie", "eixos", "modelo"];
const nomeObj3d = (t) => (t === "modelo" ? "Modelo do catálogo (Kenney)" : t === "adn" ? "DNA" : t.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()));
const opcoesLp = (lista, atual) => lista.map(([v, n]) => `<option value="${v}" ${v === (atual ?? "") ? "selected" : ""}>${esc(n)}</option>`).join("");

const linhaPersonagem = (p, k) => `<div class="lp-linha lp-pers" data-k="${k ?? ""}">
  <select data-p="visual" title="Quem é">${opcoesLp(VISUAIS_3D, p.visual ?? "pessoa")}</select>
  <select data-p="acao" title="O que faz">${opcoesLp(ACOES_3D, p.acao ?? "parado")}</select>
  <select data-p="expressao" title="Expressão">${opcoesLp(EXPRESSOES_3D, p.expressao ?? "neutro")}</select>
  <select data-p="segura" title="O que segura">${opcoesLp(SEGURA_3D, p.segura ?? "")}</select>
  <input data-p="rotulo" value="${esc(p.rotulo ?? "")}" placeholder="Nome por cima (opcional)">
  <label class="lp-check" title="A boca mexe com a narração"><input type="checkbox" data-p="fala" ${p.fala ? "checked" : ""}>Fala</label>
  <button type="button" class="btn fantasma icone peq" title="Tirar" aria-label="Tirar esta personagem" onclick="this.closest('.lp-linha').remove()">${ic("x", 14)}</button></div>`;
const linhaObjeto = (o, k) => `<div class="lp-linha lp-obj" data-k="${k ?? ""}">
  <select data-o3="tipo" onchange="this.parentElement.querySelector('[data-o3=modelo]').hidden = this.value !== 'modelo'">${OBJETOS_3D.map((t) => `<option value="${t}" ${t === (o.tipo ?? "cubo") ? "selected" : ""}>${esc(nomeObj3d(t))}</option>`).join("")}</select>
  <input data-o3="modelo" value="${esc(o.modelo ?? "")}" placeholder="pack/nome (lista em modelos-lowpoly.md)" ${o.tipo === "modelo" ? "" : "hidden"}>
  <input data-o3="variante" value="${esc(o.variante ?? "")}" placeholder="Variante (opcional)">
  <input data-o3="rotulo" value="${esc(o.rotulo ?? "")}" placeholder="Etiqueta (opcional)">
  <input data-o3="quando" type="number" step="0.1" min="0" value="${o.quando ?? ""}" placeholder="Aos s" title="Segundo em que acontece (descolagem, explosão…)" style="width:84px">
  <button type="button" class="btn fantasma icone peq" title="Tirar" aria-label="Tirar este objeto" onclick="this.closest('.lp-linha').remove()">${ic("x", 14)}</button></div>`;
function formLowpoly(c) {
  const variantes = VARIANTES_CENARIO[c.cenario];
  return `<div class="lp">
    <div class="campo"><span class="rotulo">Cenário</span>
      <div class="escolhas-mini lp-cenarios" role="radiogroup">
        <input type="hidden" data-lp="cenario" value="${esc(c.cenario ?? "estudio")}">
        ${CENARIOS_3D.map((x) => `<button type="button" class="mini-op ${x === (c.cenario ?? "estudio") ? "ativo" : ""}" role="radio" aria-checked="${x === c.cenario}" data-v="${x}" title="${esc(NOMES_CENARIO[x] ?? x)}" onclick="escolherCenario(this)">
          <img src="${MINI_APOIO(`cenario-${x}`)}" alt="" loading="lazy"><span>${esc(NOMES_CENARIO[x] ?? x)}</span></button>`).join("")}
      </div></div>
    <div class="grid2 lp-grade">
      <div class="campo lp-variante" ${variantes ? "" : "hidden"}><label class="rotulo">Variante</label><select data-lp="variante">${opcoesLp(variantes ?? [], c.variante ?? "")}</select></div>
      <div class="campo"><label class="rotulo">Hora</label><select data-lp="hora">${opcoesLp([["dia", "Dia"], ["tarde", "Fim de tarde"], ["noite", "Noite"]], c.hora ?? "dia")}</select></div>
      <div class="campo"><label class="rotulo">Plano</label><select data-lp="plano">${opcoesLp([["aberto", "Aberto (o cenário todo)"], ["medio", "Médio"], ["close", "Close (perto)"]], c.plano ?? "medio")}</select></div>
      <div class="campo"><label class="rotulo">Câmara</label><select data-lp="camera">${opcoesLp([["suave", "Suave"], ["estatica", "Parada"], ["aproximar", "Aproximar"], ["afastar", "Afastar"], ["orbitar", "Orbitar"], ["travelling", "Travelling"], ["seguir", "Seguir a personagem"]], c.camera ?? "suave")}</select></div>
    </div>
    <label class="interruptor lp-festa" ${c.cenario === "estadio" ? "" : "hidden"}><span>Público a festejar <small>golo, título</small></span><input type="checkbox" data-lp="festa" ${c.festa ? "checked" : ""}></label>
    <div class="campo"><span class="rotulo">Personagens <small>${ic("info", 12)} quem aparece e o que faz</small></span>
      <div class="lp-lista" data-lista="pers">${(c.personagens ?? []).map((p, k) => linhaPersonagem(p, k)).join("")}</div>
      <button type="button" class="btn fantasma peq" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', linhaPersonagem({ visual: 'pessoa', acao: 'falar', fala: true }))">${ic("plus", 14)}Adicionar personagem</button></div>
    <div class="campo"><span class="rotulo">Objetos 3D</span>
      <div class="lp-lista" data-lista="obj">${(c.objetos ?? []).map((o, k) => linhaObjeto(o, k)).join("")}</div>
      <button type="button" class="btn fantasma peq" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', linhaObjeto({ tipo: 'cubo' }))">${ic("plus", 14)}Adicionar objeto</button></div>
    <div class="grid2">
      <div class="campo"><label class="rotulo">Etiqueta na tela (opcional)</label><input data-lp="etiquetaTexto" value="${esc(c.etiqueta?.texto ?? "")}" placeholder="Ex.: MITO"></div>
      <div class="campo"><label class="rotulo">Marca da etiqueta</label><select data-lp="etiquetaMarca">${opcoesLp([["", "Nenhuma"], ["certo", "Certo (verde)"], ["errado", "Errado (vermelho)"]], c.etiqueta?.marca ?? "")}</select></div>
    </div>
    <details class="ajuda"><summary>Avançado: posições, cores e o resto (JSON)</summary>
      <textarea data-lp="json" rows="6" style="font-family:ui-monospace,Consolas,monospace;font-size:12px;margin-top:8px">${esc(JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => !["fala", "palavras", "duracaoMs", "tipo", "som", "audio"].includes(k))), null, 2))}</textarea>
      <div class="dica">Os campos de cima mandam: aqui muda-se o que eles não têm (posições, destino, cores, olhar).</div></details>
  </div>`;
}
function escolherCenario(botao) {
  escolherMini(botao);
  const lp = botao.closest(".lp"), cen = botao.dataset.v, vars = VARIANTES_CENARIO[cen];
  lp.querySelector(".lp-variante").hidden = !vars;
  lp.querySelector('[data-lp="variante"]').innerHTML = opcoesLp(vars ?? [], "");
  lp.querySelector(".lp-festa").hidden = cen !== "estadio";
}
// lê o editor visual: começa no JSON avançado (posições e o resto) e põe os campos por cima
function lerLowpoly(lp, base) {
  const v = (f) => lp.querySelector(`[data-lp="${f}"]`)?.value.trim() ?? "";
  let c = { ...base };
  try { const j = JSON.parse(v("json") || "{}"); c = { ...c, ...j }; } catch { throw new Error("O JSON avançado de uma cena 3D não é válido"); }
  const antes = { pers: c.personagens ?? [], obj: c.objetos ?? [] };
  c.cenario = v("cenario") || "estudio";
  for (const k of ["hora", "plano", "camera"]) { const x = v(k); if (x) c[k] = x; else delete c[k]; }
  const variante = v("variante"); if (variante && VARIANTES_CENARIO[c.cenario]) c.variante = variante; else delete c.variante;
  if (c.cenario === "estadio" && lp.querySelector('[data-lp="festa"]')?.checked) c.festa = true; else delete c.festa;
  c.personagens = [...lp.querySelectorAll(".lp-pers")].map((el) => {
    const q = (f) => el.querySelector(`[data-p="${f}"]`);
    const p = { ...(el.dataset.k !== "" ? antes.pers[Number(el.dataset.k)] : {}), visual: q("visual").value, acao: q("acao").value, expressao: q("expressao").value };
    if (q("segura").value) p.segura = q("segura").value; else delete p.segura;
    if (q("rotulo").value.trim()) p.rotulo = q("rotulo").value.trim(); else delete p.rotulo;
    if (q("fala").checked) p.fala = true; else delete p.fala;
    return p;
  });
  if (!c.personagens.length) delete c.personagens;
  c.objetos = [...lp.querySelectorAll(".lp-obj")].map((el) => {
    const q = (f) => el.querySelector(`[data-o3="${f}"]`).value.trim();
    const o = { ...(el.dataset.k !== "" ? antes.obj[Number(el.dataset.k)] : {}), tipo: q("tipo") };
    if (o.tipo === "modelo" && q("modelo")) o.modelo = q("modelo"); else delete o.modelo;
    for (const k of ["variante", "rotulo"]) { if (q(k)) o[k] = q(k); else delete o[k]; }
    if (q("quando") !== "" && Number.isFinite(Number(q("quando")))) o.quando = Number(q("quando")); else delete o.quando;
    return o;
  });
  if (!c.objetos.length) delete c.objetos;
  const et = v("etiquetaTexto");
  if (et) c.etiqueta = { texto: et, ...(v("etiquetaMarca") && { marca: v("etiquetaMarca") }) }; else delete c.etiqueta;
  return c;
}

// ---------- cenas dos vídeos novos: trocar o tipo, campos de cada tipo e pré-visualizar ----------
const TIPOS_CENA = [
  ["lowpoly", "Animação 3D", "cenario-estudio", "Personagens e objetos 3D num cenário, para o que não existe em vídeo"],
  ["tipografia", "Frase de efeito", "tipografia-centro", "A fala escrita como numa revista, com um objeto 3D"],
  ["palavras", "Palavras gigantes", "palavras", "1 a 4 palavras enormes para uma ideia forte"],
  ["numero", "Número em destaque", "numero", "Um número grande com o que significa"],
  ["dado", "Dado com gráfico", "dado", "Um número a contar, com barras de comparação"],
  ["calendario", "Calendário a passar", "calendario", "Folhas de calendário a cair de uma data (ou ano) até outra"],
  ["fato", "Foto com título", "midia", "Uma foto ou vídeo com um título por cima"],
  ["faixa", "Faixa de cinema", "faixa", "Vídeo ou foto horizontal numa faixa, com um título"],
  ["print", "Print com câmara 3D", "passeio", "Uma notícia, tweet ou página percorrida por uma câmara 3D"],
  ["modelo3d", "Modelo 3D a girar", "lowpoly", "Um objeto 3D (anatomia, produto) a girar com etiquetas"],
];
function seletorTipoCena(i, atual) {
  const t = TIPOS_CENA.find(([v]) => v === atual);
  if (!t) return "";
  return `<div class="tipo-apoio tipo-cena">
    <button type="button" class="tipo-atual" aria-haspopup="true" aria-expanded="false" onclick="abrirTiposApoio(this)">
      <img src="${MINI_APOIO(t[2])}" alt=""><b>${esc(t[1])}</b>${ic("chevron-down", 14)}</button>
    <div class="tipo-pop" hidden>
      ${TIPOS_CENA.map(([v, nome, mini, dica]) => `<button type="button" class="tipo-op ${v === atual ? "ativo" : ""}" onclick="mudarTipoCena(${i}, '${v}')">
        <img src="${MINI_APOIO(mini)}" alt="" loading="lazy"><b>${esc(nome)}</b><small>${esc(dica)}</small></button>`).join("")}
    </div></div>`;
}
// muda o tipo de uma cena: a fala, a narração já feita, o som e a mídia ficam; o resto começa com valores simples
async function mudarTipoCena(i, tipo) {
  try {
    roteiroAberto = lerEditor();
    const a = roteiroAberto.cenas[i];
    const base = Object.fromEntries(Object.entries(a).filter(([k]) => ["fala", "duracaoMs", "palavras", "audio", "som", "midia"].includes(k)));
    const titulo = a.titulo ?? a.texto_tela ?? "";
    const modelo3d = a.midia?.formato === "modelo3d" || ["anatomia", "polyhaven", "sketchfab"].includes(a.midia?.fonte) ? a.midia : a.objeto?.formato === "modelo3d" ? a.objeto : null;
    const novo = { ...base, tipo };
    if (tipo === "lowpoly") Object.assign(novo, { cenario: "estudio", hora: "dia", plano: "medio", camera: "suave", personagens: [{ visual: "pessoa", acao: "falar", expressao: "neutro", fala: true }] });
    else if (tipo === "tipografia") Object.assign(novo, { layout: "centro", ...(modelo3d && { objeto: modelo3d }) });
    else if (tipo === "palavras") Object.assign(novo, { textos: (titulo || "PALAVRA").toUpperCase().split(/\s+/).slice(0, 2), fundo: "escuro" });
    else if (tipo === "numero") Object.assign(novo, { valor: Number(a.valor) || 0, texto: a.texto ?? a.rotulo ?? titulo });
    else if (tipo === "dado") Object.assign(novo, { valor: Number(a.valor) || 0, rotulo: a.rotulo ?? a.texto ?? titulo });
    else if (tipo === "calendario") Object.assign(novo, { de: a.de ?? String(new Date().getFullYear() - 10), ate: a.ate ?? String(new Date().getFullYear()), rotulo: a.rotulo ?? titulo });
    else if (tipo === "fato" || tipo === "faixa" || tipo === "print") Object.assign(novo, { titulo: titulo.slice(0, 60) });
    else if (tipo === "modelo3d") Object.assign(novo, { titulo, animacao: "girar", ...(modelo3d && { modelo: modelo3d }) });
    if (["lowpoly", "palavras", "numero", "dado", "calendario"].includes(tipo)) delete novo.midia;
    roteiroAberto.cenas[i] = novo;
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    await reabrirNaCena(roteiroAberto, i);
    toast(`Cena ${i + 1}: ${TIPOS_CENA.find(([v]) => v === tipo)[1]}`, "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function reabrirNaCena(roteiro, i) {
  const corpo = $("#edCorpo"), sel = `.cena[data-i="${i}"]`;
  const antes = document.querySelector(sel)?.getBoundingClientRect().top ?? null;
  await abrirEditor(roteiro.id, roteiro);
  const fixar = () => { const el = document.querySelector(sel); if (el && antes !== null) corpo.scrollTop += el.getBoundingClientRect().top - antes; };
  fixar();
  for (const ms of [150, 400, 900, 1600]) setTimeout(fixar, ms);
}
// campos dos tipos editoriais e de mídia nos vídeos novos (iguais aos dos apoios dos cortes)
function camposEditoriais(c, i) {
  const fundoEd = (atual) => `<div class="campo"><span class="rotulo">Fundo</span>${escolhaMiniF("fundo", FUNDOS_MINI, atual ?? "")}</div>`;
  if (c.tipo === "lowpoly") return campo("Título na tela (opcional)", "titulo", c.titulo) + formLowpoly(c);
  if (c.tipo === "tipografia") {
    const obj = c.objeto;
    return `<div class="campo"><span class="rotulo">Variação</span>
        ${escolhaMiniF("variacao", [["revista-centro", "Revista, centrada", MINI_APOIO("tipografia-centro")], ["revista-dividido", "Revista, objeto grande", MINI_APOIO("tipografia-dividido")], ["titulo", "Título com máscara", MINI_APOIO("tipografia-titulo")]], c.variante === "titulo" ? "titulo" : `revista-${c.layout ?? "centro"}`)}</div>
      ${fundoEd(c.fundo)}
      ${campo("Palavras em grande (vírgulas; vazio = automático)", "chaves", (c.chaves ?? []).join(", "))}
      <div class="midia" style="margin-top:10px">
        <div class="previa">${previaApoio(obj)}</div>
        <div class="midia-campos">
          <span class="rotulo" style="margin:0">Objeto</span>
          <div class="linha"><select data-ob="fonte" onchange="sugerirObjeto(this)">${opcoesApoio([["", "Sem objeto"], ...FONTES_OBJETO], obj?.fonte === "arquivo" ? "" : obj?.fonte)}</select></div>
          <div class="linha"><input data-o="consulta" value="${esc(obj?.modelo ?? obj?.consulta ?? "")}" placeholder="${esc(dicaConsultaObjeto(obj?.fonte))}">
            ${botaoGaleriaObjeto(obj?.fonte)}<button class="btn peq" data-trocar onclick="trocarObjetoCena(${i})">${ic("refresh-cw", 14)}Trocar</button></div>
          <div class="dica" style="margin:0">${obj?.credito ? esc(obj.credito) : "Escolha a fonte e carregue em Ver para escolher pela miniatura, ou escreva e carregue em Trocar."}</div>
          <div class="galeria-obj" hidden></div>
        </div></div>`;
  }
  if (c.tipo === "palavras") return `<div class="grid2"><div class="campo"><label class="rotulo">Palavras (vírgulas, até 4)</label><input data-f="textos" value="${esc((c.textos ?? []).join(", "))}"></div>
    <div class="campo"><label class="rotulo">Fundo</label><select data-f="fundoPalavras">${opcoesApoio([["escuro", "Escuro"], ["papel", "Papel"]], c.fundo ?? "escuro")}</select></div></div>`;
  if (c.tipo === "calendario") return `<div class="grid2">${campo("De (ano, mês/ano ou dia/mês/ano)", "de", c.de)}${campo("Até", "ate", c.ate)}</div>
    <div class="dica" style="margin-top:-6px">${DICA_CALENDARIO}</div>
    ${campo("Título (opcional)", "rotulo", c.rotulo)}${fundoEd(c.fundo)}`;
  if (c.tipo === "numero" || c.tipo === "dado") return `<div class="grid3">
      <div class="campo"><label class="rotulo">Número</label><input data-f="valor" type="number" step="any" value="${esc(String(c.valor ?? 0))}"></div>
      <div class="campo"><label class="rotulo">Antes / depois</label><div class="linha"><input data-f="prefixo" value="${esc(c.prefixo ?? "")}" placeholder="R$"><input data-f="sufixo" value="${esc(c.sufixo ?? "")}" placeholder="%"></div></div>
      ${c.tipo === "numero" ? `<div class="campo"><label class="rotulo">Tom</label><select data-f="alerta">${opcoesApoio([["", "Normal"], ["1", "Alerta (vermelho)"]], c.alerta ? "1" : "")}</select></div>` : "<div></div>"}</div>
    ${campo("O que significa", c.tipo === "numero" ? "texto" : "rotulo", c.tipo === "numero" ? c.texto : c.rotulo)}
    ${c.tipo === "dado" ? fundoEd(c.fundo) + campo("Comparação em barras (até 6; opcional)", "barras", textoBarras(c), "textarea") + `<div class="dica" style="margin-top:-6px">${DICA_BARRAS}</div>` : ""}`;
  if (c.tipo === "faixa") return campo("Título na faixa (até 3 palavras)", "titulo", c.titulo);
  if (c.tipo === "print") return `${campo("Etiqueta no topo (opcional)", "titulo", c.titulo)}
    <div class="campo"><span class="rotulo">Variação</span>${escolhaMiniF("telaCheia", [["", "Sobre o túnel 3D", MINI_APOIO("passeio")], ["1", "Ecrã inteiro", MINI_APOIO("passeio-cheio")]], c.telaCheia ? "1" : "")}</div>`;
  return null;
}
// lê os campos editoriais (devolve true se o tipo é um destes)
function lerEditoriais(el, c) {
  const val = (f) => el.querySelector(`[data-f="${f}"]`)?.value.trim() ?? "";
  if (c.tipo === "lowpoly") {
    const nova = lerLowpoly(el.querySelector(".lp"), c);
    const sons = { sons: c.sons, somEntrada: c.somEntrada, trocaSons: c.trocaSons, efeitos: c.efeitos }; // sons e efeitos não vêm do formulário 3D
    for (const k of Object.keys(c)) delete c[k];
    Object.assign(c, nova);
    for (const [k, v] of Object.entries(sons)) if (v !== undefined) c[k] = v;
    if (val("titulo")) c.titulo = val("titulo"); else delete c.titulo;
    return true;
  }
  if (c.tipo === "tipografia") {
    const v = val("variacao") || "revista-centro";
    if (v === "titulo") { c.variante = "titulo"; delete c.layout; } else { delete c.variante; c.layout = v.split("-")[1]; }
    if (val("fundo")) c.fundo = val("fundo"); else delete c.fundo;
    const chaves = val("chaves").split(",").map((s) => s.trim()).filter(Boolean); if (chaves.length) c.chaves = chaves; else delete c.chaves;
    return true;
  }
  if (c.tipo === "palavras") { c.textos = val("textos").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4); c.fundo = val("fundoPalavras") || "escuro"; return true; }
  if (c.tipo === "calendario") {
    for (const k of ["de", "ate"]) c[k] = val(k) || c[k] || "";
    if (val("rotulo")) c.rotulo = val("rotulo"); else delete c.rotulo;
    if (val("fundo")) c.fundo = val("fundo"); else delete c.fundo;
    return true;
  }
  if (c.tipo === "numero" || c.tipo === "dado") {
    const v = Number(val("valor")); if (Number.isFinite(v)) c.valor = v;
    // sem trim: o espaço de " anos" ou "R$ " separa o número da palavra
    for (const k of ["prefixo", "sufixo"]) { const x = el.querySelector(`[data-f="${k}"]`)?.value ?? ""; if (x.trim()) c[k] = x; else delete c[k]; }
    if (c.tipo === "numero") { c.texto = val("texto"); if (val("alerta")) c.alerta = true; else delete c.alerta; }
    else {
      c.rotulo = val("rotulo");
      if (val("fundo")) c.fundo = val("fundo"); else delete c.fundo;
      gravarBarras(c, el.querySelector('[data-f="barras"]')?.value);
    }
    return true;
  }
  if (c.tipo === "faixa") { if (val("titulo")) c.titulo = val("titulo"); else delete c.titulo; return true; }
  if (c.tipo === "print") { if (val("titulo")) c.titulo = val("titulo"); else delete c.titulo; if (val("telaCheia")) c.telaCheia = true; else delete c.telaCheia; return true; }
  return false;
}
async function trocarObjetoCena(i) {
  try {
    await guardarSilencioso();
    const el = document.querySelector(`.cena[data-i="${i}"]`);
    let fonte = el.querySelector('[data-ob="fonte"]').value, consulta = el.querySelector('[data-o="consulta"]').value.trim();
    if (fonte && !consulta) return toast("Escreva o que procura", "search");
    if (fonte && !["polyhaven", "icone", "anatomia"].includes(fonte)) {
      if (!polyhavenLista) await carregarPolyhaven();
      if (polyhavenLista.some((m) => m.id.toLowerCase() === consulta.toLowerCase())) { fonte = "polyhaven"; toast("É um modelo do projeto: a usar o Poly Haven", "box"); }
    }
    toast(fonte ? "Procurando…" : "Objeto removido", fonte ? "search" : "trash-2");
    const d = await api(`/api/roteiros/${roteiroAberto.id}/midia/${i}`, { method: "POST", body: { campo: "objeto", fonte, consulta } });
    if (fonte && !d.roteiro.cenas[i].objeto?.arquivo) toast(d.log.at(-1) ?? "Não encontrei nada", "triangle-alert"); else if (fonte) toast("Objeto trocado", "check");
    await reabrirNaCena(d.roteiro, i);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
// pré-visualização: guarda e desenha um frame desta cena (sem renderizar o vídeo)
async function previaCena(i, botao) {
  const caixa = document.querySelector(`.cena[data-i="${i}"] .previa-cena`);
  try {
    await guardarSilencioso();
    botao.disabled = true;
    caixa.hidden = false;
    caixa.innerHTML = `<div class="meta">${ic("loader", 14)} Desenhando a cena (uns 20 a 40 s)…</div>`;
    const t = await api(`/api/roteiros/${roteiroAberto.id}/previa/${i}`, { method: "POST" });
    const r = await esperarTarefa(t, (p) => { const m = caixa.querySelector(".meta"); if (m && p) m.lastChild.textContent = ` ${p}`; });
    caixa.innerHTML = `<img src="${r.url}" alt="Pré-visualização da cena ${i + 1}"><span class="meta">Um frame a 60% da cena, com o que está escrito agora. Mude e carregue outra vez para ver.</span>`;
  } catch (e) { caixa.innerHTML = `<div class="meta">${esc(e.message)}</div>`; }
  botao.disabled = false;
}

// ---------- apoios visuais de um corte (frases de efeito, dados, vídeos, prints) ----------
const NOME_APOIO = { tipografia: "Frase de efeito", dado: "Dado", palavras: "Palavras", numero: "Número", lowpoly: "Cena 3D", pincel: "Desenho" };
const FUNDOS_MINI = [["", "Alterna sozinho", null], ...[["papel", "Papel"], ["topografia", "Topografia"], ["grelha", "Grelha azul"], ["tunel", "Túnel 3D"]].map(([v, n]) => [v, n, `/miniaturas/apoio-fundo-${v}.jpg`])];
const FUNDOS_ED = [["", "Automático (alterna)"], ["papel", "Papel milimétrico"], ["topografia", "Topografia"], ["grelha", "Grelha azul"], ["tunel", "Túnel 3D"]];
const FONTES_OBJETO = [["polyhaven", "Modelo 3D do projeto (Poly Haven)"], ["anatomia", "Modelo 3D: anatomia e saúde"], ["sketchfab", "Modelo 3D do Sketchfab"], ["emoji", "2D: emoji 3D"], ["cs2", "2D: skin do CS2"], ["icone", "Ícone"], ["pixabay", "Imagem (Pixabay)"], ["wikimedia", "Imagem (Wikimedia)"]];
// barras do Dado: uma por linha "Rótulo: valor [unidade]"; * no início marca a barra a vermelho
const DICA_CALENDARIO = "2010 → 2023 passa anos; 03/2020 → 12/2020 passa meses; 01/01/2024 → 31/01/2024 passa dias. Pode ir para trás (2023 → 2010). Mais de 32 folhas: salta folhas, mas acaba sempre na data final";
const DICA_BARRAS = "Uma por linha, Rótulo: valor (ex.: São Paulo: 12,5 µg/m³). Comece com * a que fica a vermelho. Com barras e o número a 0, só aparece o gráfico";
function lerBarras(texto) {
  let destaque;
  const barras = String(texto ?? "").split("\n").map((l) => l.match(/^\s*(\*)?\s*(.+?)\s*:\s*(-?[\d.,]+)\s*(.*)$/)).filter(Boolean).slice(0, 6).map((m, i) => {
    if (m[1]) destaque = i;
    const n = m[3].includes(",") ? m[3].replace(/\./g, "").replace(",", ".") : m[3];
    return { rotulo: m[2].trim(), valor: Number(n) || 0, ...(m[4].trim() && { formato: `${m[3]} ${m[4].trim()}` }) };
  });
  return { barras, destaque };
}
const textoBarras = (c) => (c?.barras ?? []).map((b, i) => `${i === c.destaque ? "*" : ""}${b.rotulo}: ${b.formato ?? String(b.valor).replace(".", ",")}`).join("\n");
function gravarBarras(c, texto) {
  const { barras, destaque } = lerBarras(texto);
  if (barras.length) c.barras = barras; else delete c.barras;
  if (barras.length && destaque !== undefined) c.destaque = destaque; else delete c.destaque;
}
const FONTES_APOIO = [["pixabay", "Pixabay"], ["pexels", "Pexels"], ["wikimedia", "Wikimedia"], ["steam", "Steam (jogo)"], ["emoji", "Emoji 3D"], ["cs2", "Skin do CS2"], ["url", "Link direto"]];
let polyhavenLista = null;
// todos os tipos de apoio que um corte pode ter (a chave é o que o seletor guarda)
const TIPOS_APOIO = [
  ["tipografia", "Frase de efeito"], ["dado", "Dado (número e gráfico)"], ["calendario", "Calendário (tempo a passar)"], ["numero", "Número em destaque"], ["palavras", "Palavras gigantes"],
  ["midia", "Vídeo ou foto em ecrã inteiro"], ["faixa", "Faixa de cinema"], ["passeio", "Print com câmara 3D"], ["lowpoly", "Cena 3D low poly"],
];
const CENARIOS_3D = ["estudio", "cidade", "quarto", "sala_estar", "natureza", "estadio", "corrida", "espaco", "planeta", "laboratorio", "hospital", "sala_aula", "bolsa", "estudio_jogos", "nave", "fundo_mar", "pre_historia", "abrigo", "planeta_alien", "oficina_relojoaria", "boutique_luxo", "balada", "lounge", "banheiro_balada", "carnaval", "rua_sp", "quarto_escuro", "consultorio", "brasilia", "plenario", "supermercado"];
// miniaturas de exemplo (scripts/miniaturas_apoios.mjs): o que cada tipo, variação e fundo faz
const MINI_APOIO = (chave) => `/miniaturas/apoio-${chave}.jpg`;
const MINI_TIPO = { tipografia: "tipografia-centro", dado: "dado", calendario: "calendario", numero: "numero", palavras: "palavras", midia: "midia", faixa: "faixa", passeio: "passeio", lowpoly: "lowpoly" };
const DICA_TIPO = {
  tipografia: "A frase que a pessoa diz, escrita como numa revista, com um objeto", dado: "Um número a contar, com gráfico de barras se houver comparação",
  calendario: "Folhas de calendário a cair de uma data (ou ano) até outra, para o tempo que passou",
  numero: "Um número grande com o que significa", palavras: "1 a 4 palavras enormes para uma emoção ou ideia forte",
  midia: "Um vídeo ou foto a ocupar o ecrã todo", faixa: "Vídeo ou foto horizontal numa faixa de cinema, com um título",
  passeio: "Um print (notícia, tweet, página) percorrido por uma câmara 3D", lowpoly: "Uma cena 3D animada, para situações que não existem em vídeo",
};
// escolha por miniaturas: um campo escondido guarda o valor (lido pelo lerApoios como os outros campos)
function escolhaMini(campo, lista, atual) {
  return `<div class="escolhas-mini" role="radiogroup">
    <input type="hidden" data-a="${campo}" value="${esc(atual ?? "")}">
    ${lista.map(([v, rotulo, img]) => `<button type="button" class="mini-op ${v === (atual ?? "") ? "ativo" : ""}" role="radio" aria-checked="${v === (atual ?? "")}" data-v="${esc(v)}" title="${esc(rotulo)}" onclick="escolherMini(this)">
      ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="mini-auto">${ic("shuffle", 18)}</span>`}<span>${esc(rotulo)}</span></button>`).join("")}
  </div>`;
}
const escolhaMiniF = (campo, lista, atual) => escolhaMini(campo, lista, atual).replace('data-a="', 'data-f="');
function escolherMini(botao) {
  const grupo = botao.closest(".escolhas-mini");
  grupo.querySelector("input").value = botao.dataset.v;
  grupo.querySelectorAll(".mini-op").forEach((x) => { const on = x === botao; x.classList.toggle("ativo", on); x.setAttribute("aria-checked", on); });
}
// seletor de tipo: o tipo atual com a miniatura e, ao abrir, a grelha de todos os tipos com exemplo e uma frase
function seletorTipo(i, k, atual) {
  return `<div class="tipo-apoio">
    <button type="button" class="tipo-atual" aria-haspopup="true" aria-expanded="false" onclick="abrirTiposApoio(this)">
      <img src="${MINI_APOIO(MINI_TIPO[atual])}" alt=""><b>${esc(TIPOS_APOIO.find(([v]) => v === atual)?.[1] ?? atual)}</b>${ic("chevron-down", 14)}</button>
    <div class="tipo-pop" hidden>
      ${TIPOS_APOIO.map(([v, nome]) => `<button type="button" class="tipo-op ${v === atual ? "ativo" : ""}" onclick="mudarTipoApoio(${i}, ${k}, '${v}')">
        <img src="${MINI_APOIO(MINI_TIPO[v])}" alt="" loading="lazy"><b>${esc(nome)}</b><small>${esc(DICA_TIPO[v])}</small></button>`).join("")}
    </div>
  </div>`;
}
function abrirTiposApoio(botao) {
  const pop = botao.nextElementSibling, abrir = pop.hidden;
  document.querySelectorAll(".tipo-pop").forEach((p) => { p.hidden = true; p.previousElementSibling.setAttribute("aria-expanded", "false"); });
  pop.hidden = !abrir; botao.setAttribute("aria-expanded", String(abrir));
}
document.addEventListener("click", (e) => { if (!e.target.closest(".tipo-apoio")) document.querySelectorAll(".tipo-pop").forEach((p) => (p.hidden = true)); });
const tipoDoApoio = (b) => b.cena?.tipo ?? (b.layout === "faixa" ? "faixa" : b.layout === "passeio" ? "passeio" : "midia");
const segApoio = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
const nomeApoio = (b) => (b.cena ? NOME_APOIO[b.cena.tipo] ?? b.cena.tipo : b.layout === "faixa" ? "Faixa de cinema" : b.layout === "passeio" ? "Print com câmara 3D" : "Vídeo ou foto");
const previaApoio = (m) => !m?.arquivo ? `<div class="sem-midia">sem mídia</div>`
  : m.arquivo.startsWith("icone:") ? `<div class="sem-midia">${ic(m.arquivo.slice(6), 28)}</div>`
  : m.formato === "modelo3d" ? (() => {
      const ph = m.arquivo?.match(/^modelos\/polyhaven\/([^/]+)\//)?.[1];
      const thumb = ph ? `https://cdn.polyhaven.com/asset_img/thumbs/${ph}.png?width=256` : m.sketchfab?.thumb;
      return thumb ? `<img src="${esc(thumb)}" alt="${esc(m.credito ?? "")}" style="object-fit:contain;background:var(--campo)">` : `<div class="sem-midia">${ic("box", 24)}<br>${esc(m.credito ?? m.modelo ?? "3D")}</div>`;
    })()
  : m.formato === "video" ? `<video src="/public/${esc(m.arquivo)}#t=1" preload="metadata" muted></video>` : `<img src="/public/${esc(m.arquivo)}" alt="">`;
const opcoesApoio = (lista, atual) => lista.map(([v, n]) => `<option value="${v}" ${v === (atual ?? "") ? "selected" : ""}>${n}</option>`).join("");
// o que a pessoa diz entre dois tempos do corte (as palavras do Whisper, em ms desde o início do corte)
const falaEntre = (c, iniMs, fimMs) => (c.palavras ?? []).filter((p) => p.inicioMs >= iniMs - 20 && p.inicioMs < fimMs).map((p) => p.texto).join(" ");
const relogioCorte = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
// transcrição do corte em blocos de ~5 s (ou nas pausas), com o segundo em que cada um começa
// corrige as palavras do Whisper a partir dos trechos editados. Mesmo número de palavras: troca só o texto (os tempos
// ficam exatos). Número diferente: as palavras novas ocupam o tempo do trecho, cada uma na proporção do seu tamanho.
function lerTranscricao(el, c) {
  const trechos = [...el.querySelectorAll('[data-t="trecho"]')].filter((x) => x.value.replace(/\s+/g, " ").trim() !== x.dataset.original);
  // do fim para o início: mudar o número de palavras de um trecho não desloca os índices dos anteriores
  for (const x of trechos.sort((a, b) => Number(b.dataset.de) - Number(a.dataset.de))) {
    const de = Number(x.dataset.de), ate = Number(x.dataset.ate);
    const antigas = c.palavras.slice(de, ate + 1);
    const novas = x.value.split(/\s+/).filter(Boolean);
    if (!antigas.length) continue;
    let substitutas;
    if (novas.length === antigas.length) substitutas = antigas.map((p, k) => ({ ...p, texto: novas[k] }));
    else if (!novas.length) substitutas = [];
    else {
      const ini = antigas[0].inicioMs, fim = antigas.at(-1).fimMs, pesos = novas.map((w) => w.length + 2), total = pesos.reduce((t, v) => t + v, 0);
      let t = ini;
      substitutas = novas.map((w, k) => { const dur = ((fim - ini) * pesos[k]) / total; const p = { texto: w, inicioMs: Math.round(t), fimMs: Math.round(t + dur) }; t += dur; return p; });
    }
    c.palavras.splice(de, antigas.length, ...substitutas);
  }
}
function transcricaoCorte(c) {
  const ws = c.palavras ?? [];
  if (!ws.length) return "";
  const blocos = [];
  ws.forEach((p, n) => {
    const atual = blocos.at(-1);
    if (!atual || p.inicioMs - atual.ini >= 5000 || p.inicioMs - atual.fim > 700) blocos.push({ ini: p.inicioMs, fim: p.fimMs, de: n, ate: n, ws: [p.texto] });
    else { atual.ws.push(p.texto); atual.fim = p.fimMs; atual.ate = n; }
  });
  // cada trecho é editável: corrigir aqui corrige a legenda (e as frases de efeito), sem transcrever de novo
  return `<details class="ajuda transcricao"><summary>Ver e corrigir o que a pessoa diz (transcrição e legenda)</summary>
    <div class="dica" style="margin-top:6px">A legenda sai desta transcrição. Corrija as palavras erradas e grave: os tempos mantêm-se, e se mudar o número de palavras de um trecho, elas são espalhadas pelo tempo dele.</div>
    <div class="transcricao-lista">${blocos.map((b) => `<div><span class="meta">${(b.ini / 1000).toFixed(1).replace(".", ",")} s</span>
      <input data-t="trecho" data-de="${b.de}" data-ate="${b.ate}" data-original="${esc(b.ws.join(" "))}" value="${esc(b.ws.join(" "))}" aria-label="Transcrição a partir de ${(b.ini / 1000).toFixed(1)} s"></div>`).join("")}</div>
  </details>`;
}
// ao mudar os tempos de um apoio, a fala por baixo atualiza
// as palavras da frase como botões: a escolhida é a que fica enorme (sem escolha, a mais comprida)
function desenharChaves(tx) {
  const caixa = tx.closest(".apoio").querySelector(".chaves-frase"), campo = tx.closest(".apoio").querySelector('[data-a="chave"]');
  const limpa = (w) => w.replace(/[.,;:!?…"“”()]+/g, "");
  const ws = tx.value.split(/\s+/).map(limpa).filter(Boolean);
  const auto = ws.reduce((m, w) => (w.length > m.length ? w : m), "");
  const atual = ws.some((w) => w.toLowerCase() === campo.value.toLowerCase()) ? campo.value : "";
  caixa.innerHTML = ws.length ? ws.map((w) => `<button type="button" class="chave-op ${(atual ? w.toLowerCase() === atual.toLowerCase() : w === auto) ? "ativo" : ""}" onclick="escolherChave(this)">${esc(w)}</button>`).join("")
    + `<div class="dica" style="width:100%">${atual ? "" : "Sem escolha, fica a palavra mais comprida."}</div>` : '<span class="meta">Escreva o texto acima.</span>';
}
function escolherChave(botao) {
  const apoio = botao.closest(".apoio");
  apoio.querySelector('[data-a="chave"]').value = botao.textContent;
  desenharChaves(apoio.querySelector('[data-a="texto"]'));
}
function atualizarFalaApoio(i, k) {
  const a = document.querySelector(`.cena[data-i="${i}"] .apoio[data-k="${k}"]`);
  const c = roteiroAberto.cenas[i];
  const ini = Number(a.querySelector('[data-a="ini"]').value) * 1000, fim = Number(a.querySelector('[data-a="fim"]').value) * 1000;
  const texto = fim > ini ? falaEntre(c, ini, fim) : "";
  // as palavras à volta do trecho (3 s antes e depois): as que o apoio cobre ficam acesas; clicar escolhe o início e o fim
  const ws = c.palavras ?? [];
  const dentro = (p) => p.inicioMs >= ini - 20 && p.inicioMs < fim;
  const perto = ws.map((p, n) => ({ ...p, n })).filter((p) => p.fimMs >= ini - 3000 && p.inicioMs <= fim + 3000);
  const proximo = a.dataset.proximo === "fim" ? "fim" : "ini";
  a.querySelector(".fala-apoio").innerHTML = perto.length ? `
    <div class="linha" style="justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      <span class="meta">${texto ? "O que este apoio cobre (aceso):" : "Nenhuma fala neste trecho. As palavras perto:"}</span>
      <span class="meta">Clique ${proximo === "ini" ? "na <b>primeira</b>" : "na <b>última</b>"} palavra do trecho</span></div>
    <div class="palavras-trecho">${perto.map((p) => `<button type="button" class="pal ${dentro(p) ? "dentro" : ""}" title="${(p.inicioMs / 1000).toFixed(1).replace(".", ",")} s" onclick="marcarPalavraTrecho(${i}, ${k}, ${p.n})">${esc(p.texto)}</button>`).join("")}</div>`
    : '<span class="meta">Nenhuma fala neste trecho.</span>';
  const tx = a.querySelector('[data-a="texto"]');
  if (tx && tx.value.replace(/\s+/g, " ").trim() === (tx.dataset.falado ?? "").replace(/\s+/g, " ").trim()) { tx.value = texto; tx.dataset.falado = texto; desenharChaves(tx); }
  else if (tx) tx.dataset.falado = texto;
}
// clicar numa palavra: a primeira vez marca o início do apoio nela, a segunda marca o fim (o apoio acaba quando ela acaba)
function marcarPalavraTrecho(i, k, n) {
  const a = document.querySelector(`.cena[data-i="${i}"] .apoio[data-k="${k}"]`);
  const ws = roteiroAberto.cenas[i].palavras, p = ws[n];
  const ini = a.querySelector('[data-a="ini"]'), fim = a.querySelector('[data-a="fim"]');
  // tempos ao centésimo: o início exatamente quando a palavra começa e o fim logo antes da palavra seguinte
  const fimDe = (m) => Math.min(ws[m].fimMs + 150, (ws[m + 1]?.inicioMs ?? Infinity) - 10) / 1000;
  if (a.dataset.proximo !== "fim") {
    ini.value = (p.inicioMs / 1000).toFixed(2);
    if (Number(fim.value) * 1000 <= p.inicioMs) fim.value = fimDe(n).toFixed(2);
    a.dataset.proximo = "fim";
  } else {
    if (p.fimMs <= Number(ini.value) * 1000) ini.value = (p.inicioMs / 1000).toFixed(2);
    else { fim.value = fimDe(n).toFixed(2); a.dataset.proximo = "ini"; }
  }
  atualizarFalaApoio(i, k);
}
function blocoApoios(c, i) {
  const lista = c.broll ?? [];
  return `<div class="apoios">
    ${transcricaoCorte(c)}
    <span class="rotulo">Apoios visuais <small>${lista.length ? `${lista.length} por cima da fala` : "nenhum"}</small></span>
    ${lista.map((b, k) => {
      const t = b.cena?.tipo;
      const obj = b.cena?.objeto;
      return `<div class="apoio" data-k="${k}">
        <div class="linha" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          ${seletorTipo(i, k, tipoDoApoio(b))}
          <span class="linha" style="gap:6px"><span class="meta">de</span><input data-a="ini" type="number" step="0.01" min="0" value="${segApoio(b.inicioMs)}" style="width:80px" oninput="atualizarFalaApoio(${i}, ${k})"><span class="meta">a</span><input data-a="fim" type="number" step="0.01" min="0" value="${segApoio(b.fimMs)}" style="width:80px" oninput="atualizarFalaApoio(${i}, ${k})"><span class="meta">s</span>
          <button class="btn fantasma icone peq" title="Tirar este apoio" aria-label="Tirar este apoio" onclick="removerApoio(${i}, ${k})">${ic("trash-2", 14)}</button></span>
        </div>
        <div class="fala-apoio"></div>
        ${t === "tipografia" ? `
          <div class="campo" style="margin-top:12px"><span class="rotulo">Variação</span>
            ${escolhaMini("variacao", [["revista-centro", "Revista, centrada", MINI_APOIO("tipografia-centro")], ["revista-dividido", "Revista, objeto grande", MINI_APOIO("tipografia-dividido")], ["titulo", "Título com máscara", MINI_APOIO("tipografia-titulo")]], b.cena.variante === "titulo" ? "titulo" : `revista-${b.cena.layout ?? "centro"}`)}</div>
          <div class="campo"><span class="rotulo">Fundo</span>${escolhaMini("fundo", FUNDOS_MINI, b.cena.fundo ?? "")}</div>
          <div class="campo"><label class="rotulo">Texto na tela</label>
            <textarea data-a="texto" rows="2" data-falado="${esc(falaEntre(c, b.inicioMs, b.fimMs))}" oninput="desenharChaves(this)">${esc(b.cena.texto ?? falaEntre(c, b.inicioMs, b.fimMs))}</textarea>
            <div class="dica">Começa com o que a pessoa diz neste trecho. Pode encurtar ou corrigir: as palavras entram no ritmo da fala.</div></div>
          <div class="campo"><span class="rotulo">Palavra em grande <small>clique na palavra que fica enorme</small></span>
            <input type="hidden" data-a="chave" value="${esc((b.cena.chaves ?? [])[0] ?? "")}">
            <div class="chaves-frase"></div></div>
          <div class="midia" style="margin-top:10px">
            <div class="previa">${previaApoio(obj)}</div>
            <div class="midia-campos">
              <span class="rotulo" style="margin:0">Objeto</span>
              <div class="linha"><select data-o="fonte" onchange="sugerirObjeto(this)">${opcoesApoio([["", "Sem objeto"], ...FONTES_OBJETO], obj?.fonte === "arquivo" ? "" : obj?.fonte)}</select></div>
              <div class="linha"><input data-o="consulta" value="${esc(obj?.modelo ?? obj?.consulta ?? "")}" placeholder="${esc(dicaConsultaObjeto(obj?.fonte))}">
                ${botaoGaleriaObjeto(obj?.fonte)}<button class="btn peq" data-trocar onclick="trocarApoio(${i}, ${k}, 'objeto')">${ic("refresh-cw", 14)}Trocar</button></div>
              <div class="dica" style="margin:0">${obj?.credito ? esc(obj.credito) : "Escolha a fonte e carregue em Ver para escolher pela miniatura, ou escreva e carregue em Trocar."}</div>
              <div class="galeria-obj" hidden></div>
            </div>
          </div>`
        : t === "dado" ? `
          <div class="grid2" style="margin-top:10px">
            <div class="campo"><label class="rotulo">Número grande (opcional)</label><input data-a="valor" type="number" step="any" value="${b.cena.valor ? esc(String(b.cena.valor)) : ""}" placeholder="vazio = só o gráfico"></div>
            <div class="campo"><label class="rotulo">Texto antes / depois do número</label><div class="linha"><input data-a="prefixo" value="${esc(b.cena.prefixo ?? "")}" placeholder="ex.: R$"><input data-a="sufixo" value="${esc(b.cena.sufixo ?? "")}" placeholder="ex.: %, mil"></div></div>
          </div>
          <div class="campo"><label class="rotulo">O que significa</label><input data-a="rotulo" value="${esc(b.cena.rotulo ?? "")}"></div>
          <div class="campo"><label class="rotulo">Comparação em barras (até 6; opcional)</label><textarea data-a="barras" rows="4" placeholder="Brasil: 15&#10;*Roraima: 47,8 µg/m³&#10;OMS: 5">${esc(textoBarras(b.cena))}</textarea>
            <div class="dica" style="margin:4px 0 0">${DICA_BARRAS}</div></div>
          <div class="campo"><span class="rotulo">Fundo</span>${escolhaMini("fundo", FUNDOS_MINI, b.cena.fundo ?? "")}</div>`
        : t === "calendario" ? `
          <div class="grid2" style="margin-top:10px">
            <div class="campo"><label class="rotulo">De (ano, mês/ano ou dia/mês/ano)</label><input data-a="de" value="${esc(b.cena.de ?? "")}" placeholder="2010"></div>
            <div class="campo"><label class="rotulo">Até</label><input data-a="ate" value="${esc(b.cena.ate ?? "")}" placeholder="2023"></div>
          </div>
          <div class="dica" style="margin:0 0 8px">${DICA_CALENDARIO}</div>
          <div class="campo"><label class="rotulo">Título (opcional)</label><input data-a="rotulo" value="${esc(b.cena.rotulo ?? "")}" placeholder="13 anos depois"></div>
          <div class="campo"><span class="rotulo">Fundo</span>${escolhaMini("fundo", FUNDOS_MINI, b.cena.fundo ?? "")}</div>`
        : t === "palavras" ? `<div class="grid2" style="margin-top:10px"><div class="campo"><label class="rotulo">Palavras (vírgulas, até 4)</label><input data-a="textos" value="${esc((b.cena.textos ?? []).join(", "))}"></div>
            <div class="campo"><label class="rotulo">Fundo</label><select data-a="fundoPalavras">${opcoesApoio([["escuro", "Escuro"], ["papel", "Papel"]], b.cena.fundo ?? "escuro")}</select></div></div>`
        : t === "numero" ? `<div class="grid3" style="margin-top:10px">
            <div class="campo"><label class="rotulo">Número</label><input data-a="valor" type="number" step="any" value="${esc(String(b.cena.valor))}"></div>
            <div class="campo"><label class="rotulo">Antes / depois</label><div class="linha"><input data-a="prefixo" value="${esc(b.cena.prefixo ?? "")}" placeholder="R$"><input data-a="sufixo" value="${esc(b.cena.sufixo ?? "")}" placeholder="%"></div></div>
            <div class="campo"><label class="rotulo">Tom</label><select data-a="alerta">${opcoesApoio([["", "Normal"], ["1", "Alerta (vermelho)"]], b.cena.alerta ? "1" : "")}</select></div></div>
          <div class="campo"><label class="rotulo">O que significa</label><input data-a="texto" value="${esc(b.cena.texto ?? "")}"></div>`
        : t === "lowpoly" ? `<div style="margin-top:10px">${formLowpoly(b.cena)}</div>`
        : t ? `<div class="campo" style="margin-top:10px"><label class="rotulo">Dados da cena (JSON)</label><textarea data-a="json" rows="4" style="font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(JSON.stringify(b.cena, null, 2))}</textarea></div>`
        : `
          ${b.layout === "faixa" ? `<div class="campo" style="margin-top:10px"><label class="rotulo">Título na faixa</label><input data-a="titulo" value="${esc(b.titulo ?? "")}" placeholder="475M VIEWS"></div>` : ""}
          ${b.layout === "passeio" ? `<div class="campo" style="margin-top:12px"><span class="rotulo">Variação</span>${escolhaMini("telaCheia", [["", "Sobre o túnel 3D", MINI_APOIO("passeio")], ["1", "Ecrã inteiro", MINI_APOIO("passeio-cheio")]], b.telaCheia ? "1" : "")}</div>` : ""}
          <div class="midia" style="margin-top:10px">
            <div class="previa">${previaApoio(b.midia)}</div>
            <div class="midia-campos">
              <div class="linha"><select data-m="fonte">${opcoesApoio([["", "Sem mídia"], ...FONTES_APOIO], b.midia?.fonte)}</select>
                <select data-m="tipo" style="width:auto">${opcoesApoio([["video", "Vídeo"], ["imagem", "Foto"]], b.midia?.tipo ?? b.midia?.formato ?? "video")}</select></div>
              <div class="linha"><input data-m="consulta" value="${esc(b.midia?.consulta ?? "")}" placeholder="${b.midia?.fonte === "url" ? "link da foto/vídeo ou do YouTube, Instagram, TikTok (?t=90)" : "termos em inglês"}">
                <button class="btn peq" onclick="trocarApoio(${i}, ${k}, 'midia')">${ic("refresh-cw", 14)}Trocar</button>
                <button class="btn fantasma peq" title="O resultado seguinte da mesma pesquisa" onclick="trocarApoio(${i}, ${k}, 'midia', true)">Outra</button></div>
              ${b.midia?.credito ? `<div class="dica" style="margin:0">${esc(b.midia.credito)}</div>` : ""}
            </div>
          </div>`}
      </div>`;
    }).join("")}
    <button class="btn fantasma peq" style="margin-top:8px" onclick="adicionarApoio(${i})">${ic("plus", 14)}Adicionar frase de efeito</button>
  </div>`;
}
// lê os campos de um apoio para o roteiro (chamado pelo lerEditor)
function lerApoios(el, c) {
  const val = (raiz, f) => raiz.querySelector(`[data-a="${f}"]`)?.value.trim() ?? "";
  el.querySelectorAll(".apoio").forEach((a) => {
    const b = c.broll?.[Number(a.dataset.k)];
    if (!b) return;
    const ini = Number(val(a, "ini")), fim = Number(val(a, "fim"));
    if (Number.isFinite(ini) && Number.isFinite(fim) && fim > ini) { b.inicioMs = Math.round(ini * 1000); b.fimMs = Math.round(fim * 1000); }
    const t = b.cena?.tipo;
    if (t === "tipografia") {
      const chave = val(a, "chave"); if (chave) b.cena.chaves = [chave]; else delete b.cena.chaves;
      const tx = a.querySelector('[data-a="texto"]');
      const norm = (s) => s.replace(/\s+/g, " ").trim();
      if (tx && norm(tx.value) && norm(tx.value) !== norm(tx.dataset.falado ?? "")) b.cena.texto = norm(tx.value); else delete b.cena.texto;
      const v = val(a, "variacao") || "revista-centro";
      if (v === "titulo") b.cena.variante = "titulo"; else { delete b.cena.variante; b.cena.layout = v.split("-")[1]; }
    }
    if (t === "calendario") { for (const k of ["de", "ate"]) b.cena[k] = val(a, k) || b.cena[k] || ""; const r = val(a, "rotulo"); if (r) b.cena.rotulo = r; else delete b.cena.rotulo; }
    if (t === "tipografia" || t === "dado" || t === "calendario") { const f = val(a, "fundo"); if (f) b.cena.fundo = f; else delete b.cena.fundo; }
    if (t === "dado") {
      const v = Number(val(a, "valor")); if (Number.isFinite(v)) b.cena.valor = v;
      for (const k of ["prefixo", "sufixo", "rotulo"]) { const x = k === "rotulo" ? val(a, k) : a.querySelector(`[data-a="${k}"]`)?.value ?? ""; if (x.trim()) b.cena[k] = x; else if (k !== "rotulo") delete b.cena[k]; }
      gravarBarras(b.cena, a.querySelector('[data-a="barras"]')?.value);
    }
    if (t === "palavras") { b.cena.textos = val(a, "textos").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4); b.cena.fundo = val(a, "fundoPalavras") || "escuro"; }
    if (t === "numero") {
      const v = Number(val(a, "valor")); if (Number.isFinite(v)) b.cena.valor = v;
      for (const k of ["prefixo", "sufixo"]) { const x = a.querySelector(`[data-a="${k}"]`)?.value ?? ""; if (x.trim()) b.cena[k] = x; else delete b.cena[k]; }
      b.cena.texto = val(a, "texto"); if (val(a, "alerta")) b.cena.alerta = true; else delete b.cena.alerta;
    }
    if (t === "lowpoly") b.cena = { ...lerLowpoly(a.querySelector(".lp"), b.cena), tipo: "lowpoly", fala: "" };
    if (b.layout === "faixa") { const x = val(a, "titulo"); if (x) b.titulo = x; else delete b.titulo; }
    if (b.layout === "passeio") { if (val(a, "telaCheia")) b.telaCheia = true; else delete b.telaCheia; }
  });
  c.broll?.sort((x, y) => x.inicioMs - y.inicioMs);
}
// ---------- galeria do campo Objeto: as miniaturas do que cada fonte tem, para ver antes de escolher ----------
const FONTES_GALERIA = ["polyhaven", "anatomia", "emoji", "cs2"];
const dicaConsultaObjeto = (fonte) => ({
  polyhaven: "nome do modelo (ex.: Camera_01) ou carregue em Ver", anatomia: "coração, cérebro, esqueleto… ou carregue em Ver",
  emoji: "nome em inglês (ex.: light bulb) ou carregue em Ver", cs2: "nome da skin (ex.: AK-47 | Redline) ou carregue em Ver",
  icone: "nome do ícone (lucide.dev/icons)", sketchfab: "termos em inglês (ex.: hourglass)",
}[fonte] ?? "termos em inglês (ex.: hourglass)");
const botaoGaleriaObjeto = (fonte) => `<button type="button" class="btn peq fantasma" data-galeria onclick="galeriaObjeto(this)" ${FONTES_GALERIA.includes(fonte) ? "" : "hidden"} title="Ver as opções com miniatura">${ic("layout-grid", 14)}Ver</button>`;
function sugerirObjeto(sel) {
  const caixa = sel.closest(".midia-campos"), inp = caixa.querySelector('[data-o="consulta"]');
  inp.placeholder = dicaConsultaObjeto(sel.value);
  const tem = FONTES_GALERIA.includes(sel.value);
  caixa.querySelector("[data-galeria]").hidden = !tem;
  const gal = caixa.querySelector(".galeria-obj");
  gal.hidden = true; gal.innerHTML = "";
  if (tem) galeriaObjeto(caixa.querySelector("[data-galeria]")); // ao escolher a fonte, mostra logo o que ela tem
}
async function galeriaObjeto(botao) {
  const caixa = botao.closest(".midia-campos"), gal = caixa.querySelector(".galeria-obj");
  const fonte = caixa.querySelector('[data-ob="fonte"], [data-o="fonte"]').value;
  if (!gal.hidden && gal.dataset.fonte === fonte) { gal.hidden = true; return; }
  gal.dataset.fonte = fonte; gal.hidden = false;
  gal.innerHTML = `<div class="galeria-obj-topo"><input type="search" placeholder="Filtrar (ex.: ${fonte === "cs2" ? "karambit, ak-47" : fonte === "emoji" ? "brain, lâmpada" : fonte === "anatomia" ? "pulmões, ossos" : "chair, camera"})" aria-label="Filtrar">
    <button type="button" class="btn peq fantasma icone" onclick="this.closest('.galeria-obj').hidden = true" title="Fechar" aria-label="Fechar">${ic("x", 14)}</button></div>
    <div class="galeria-obj-grade"><div class="meta">${ic("loader", 14)} A carregar…</div></div>`;
  const filtro = gal.querySelector("input");
  let pedido = 0, espera;
  const carregar = async () => {
    const n = ++pedido, grade = gal.querySelector(".galeria-obj-grade");
    try {
      const lista = await api(`/api/objetos?fonte=${encodeURIComponent(fonte)}&q=${encodeURIComponent(filtro.value.trim())}`);
      if (n !== pedido) return;
      const atual = caixa.querySelector('[data-o="consulta"]').value.trim().toLowerCase();
      grade.innerHTML = lista.length ? lista.map((o) => `<button type="button" class="galeria-obj-op ${o.id.toLowerCase() === atual ? "ativo" : ""}" data-id="${esc(o.id)}" title="${esc(o.nome)}" ${o.cor ? `style="--raridade:${esc(o.cor)}"` : ""}>
          ${o.mini ? `<img src="${esc(o.mini)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className: 'sem-mini', textContent: 'sem miniatura'}))">` : `<span class="sem-mini">sem miniatura</span>`}
          <span>${esc(o.nome)}</span></button>`).join("")
        : `<div class="meta">${fonte === "cs2" && !filtro.value.trim() ? "O catálogo do CS2 descarrega-se na primeira troca: escreva o nome de uma skin e carregue em Trocar." : "Nada com esse filtro."}</div>`;
      if (fonte === "cs2" && lista.length === 120) grade.insertAdjacentHTML("beforeend", `<div class="meta">Mostra as primeiras 120: filtre para ver outras.</div>`);
    } catch (e) { if (n === pedido) grade.innerHTML = `<div class="meta">${esc(e.message)}</div>`; }
  };
  filtro.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(carregar, 200); });
  gal.querySelector(".galeria-obj-grade").addEventListener("click", (e) => {
    const op = e.target.closest(".galeria-obj-op");
    if (!op) return;
    caixa.querySelector('[data-o="consulta"]').value = op.dataset.id;
    gal.hidden = true;
    caixa.querySelector("[data-trocar]").click(); // troca já, com a função certa (cena ou apoio)
  });
  await carregar();
  filtro.focus({ preventScroll: true });
}
async function carregarPolyhaven() {
  try { polyhavenLista = await api("/api/polyhaven"); } catch { polyhavenLista = []; }
  let dl = document.getElementById("listaPolyhaven");
  if (!dl) { dl = document.createElement("datalist"); dl.id = "listaPolyhaven"; document.body.append(dl); }
  dl.innerHTML = polyhavenLista.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join("");
}
async function trocarApoio(i, k, campo, proxima = false) {
  try {
    await guardarSilencioso();
    const el = document.querySelector(`.cena[data-i="${i}"] .apoio[data-k="${k}"]`);
    const q = (s) => el.querySelector(s)?.value.trim() ?? "";
    const pre = campo === "objeto" ? "o" : "m";
    let fonte = q(`[data-${pre}="fonte"]`);
    const consulta = q(`[data-${pre}="consulta"]`);
    if (fonte && !consulta) return toast("Escreva o que procura", "search");
    if (campo === "objeto" && fonte !== "polyhaven" && fonte !== "icone") {
      if (!polyhavenLista) await carregarPolyhaven();
      if (polyhavenLista.some((m) => m.id.toLowerCase() === consulta.toLowerCase())) { fonte = "polyhaven"; toast("É um modelo do projeto: a usar o Poly Haven", "box"); }
    }
    const atual = campo === "objeto" ? roteiroAberto.cenas[i].broll[k].cena?.objeto : roteiroAberto.cenas[i].broll[k].midia;
    toast(fonte ? "Procurando…" : "Removido", fonte ? "search" : "trash-2");
    const d = await api(`/api/roteiros/${roteiroAberto.id}/apoio/${i}/${k}`, { method: "POST", body: {
      campo, fonte, consulta, tipo: campo === "midia" ? q('[data-m="tipo"]') : undefined, indice: proxima ? (atual?.indice ?? 0) + 1 : 0,
    } });
    const novo = campo === "objeto" ? d.roteiro.cenas[i].broll[k].cena?.objeto : d.roteiro.cenas[i].broll[k].midia;
    if (fonte && !novo?.arquivo) toast(d.log.at(-1) ?? "Não encontrei nada", "triangle-alert"); else if (fonte) toast("Trocado", "check");
    await reabrirNoApoio(d.roteiro, i, k);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
// muda o tipo de um apoio: mantém o tempo (e a mídia, entre vídeo, faixa e print) e começa o resto com valores simples
async function mudarTipoApoio(i, k, tipo) {
  try {
    roteiroAberto = lerEditor();
    const c = roteiroAberto.cenas[i], antigo = c.broll[k];
    const novo = { inicioMs: antigo.inicioMs, fimMs: antigo.fimMs, cheio: true };
    const midia = antigo.midia ?? (antigo.cena?.objeto?.formato === "imagem" ? antigo.cena.objeto : undefined);
    if (tipo === "tipografia") novo.cena = { tipo, fala: "", layout: "centro", ...(antigo.cena?.objeto && { objeto: antigo.cena.objeto }) };
    else if (tipo === "calendario") novo.cena = { tipo, fala: "", de: String(new Date().getFullYear() - 10), ate: String(new Date().getFullYear()) };
    else if (tipo === "dado") novo.cena = { tipo, fala: "", valor: Number(antigo.cena?.valor) || 0, rotulo: antigo.cena?.texto ?? antigo.cena?.rotulo ?? "" };
    else if (tipo === "numero") novo.cena = { tipo, fala: "", valor: Number(antigo.cena?.valor) || 0, texto: antigo.cena?.rotulo ?? antigo.cena?.texto ?? "" };
    else if (tipo === "palavras") novo.cena = { tipo, fala: "", textos: antigo.cena?.chaves?.length ? antigo.cena.chaves.map((x) => x.toUpperCase()) : ["PALAVRA"], fundo: "escuro" };
    else if (tipo === "lowpoly") novo.cena = { tipo, fala: "", cenario: "estudio", hora: "noite", camera: "suave" };
    else {
      novo.midia = midia ? { ...midia, ...(tipo === "passeio" && { tipo: "imagem" }) } : { fonte: "pixabay", consulta: "", tipo: tipo === "passeio" ? "imagem" : "video" };
      if (tipo !== "midia") novo.layout = tipo;
      if (tipo === "faixa" && antigo.titulo) novo.titulo = antigo.titulo;
    }
    c.broll[k] = novo;
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    await reabrirNoApoio(roteiroAberto, i, k);
    if (novo.midia && !novo.midia.arquivo) toast("Escreva o que procurar e carregue em Trocar", "search");
  } catch (e) { toast(e.message, "triangle-alert"); }
}
// redesenha o editor sem perder o sítio: o apoio mexido fica na mesma altura do ecrã, mesmo quando os blocos de cima
// (capa, publicação, revisão, música) acabam de carregar depois e mudam de tamanho
async function reabrirNoApoio(roteiro, i, k) {
  const corpo = $("#edCorpo");
  const sel = `.cena[data-i="${i}"] .apoio[data-k="${k}"]`;
  const antes = document.querySelector(sel)?.getBoundingClientRect().top ?? null;
  const topo = corpo.scrollTop;
  await abrirEditor(roteiro.id, roteiro);
  const fixar = () => {
    const el = document.querySelector(sel);
    if (el && antes !== null) corpo.scrollTop += el.getBoundingClientRect().top - antes;
    else if (el) el.scrollIntoView({ block: "center" });
    else corpo.scrollTop = topo;
  };
  fixar();
  // os blocos de cima carregam aos poucos: volta a acertar enquanto carregam
  for (const ms of [150, 400, 900, 1600]) setTimeout(fixar, ms);
}
async function removerApoio(i, k) {
  try {
    roteiroAberto = lerEditor();
    roteiroAberto.cenas[i].broll.splice(k, 1);
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    await reabrirNoApoio(roteiroAberto, i, Math.max(0, k - 1));
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function adicionarApoio(i) {
  try {
    roteiroAberto = lerEditor();
    const c = roteiroAberto.cenas[i];
    c.broll ??= [];
    // logo a seguir ao último apoio (ou aos 3 s), com 4 s, sem passar do fim do corte
    const fimCorte = c.duracaoMs ?? 30000;
    const ini = Math.min(Math.max(3000, (c.broll.at(-1)?.fimMs ?? 0) + 2000), Math.max(0, fimCorte - 4000));
    c.broll.push({ inicioMs: ini, fimMs: Math.min(fimCorte, ini + 4000), cheio: true, cena: { tipo: "tipografia", fala: "", layout: "centro" } });
    c.broll.sort((x, y) => x.inicioMs - y.inicioMs);
    const novoK = c.broll.findIndex((b) => b.inicioMs === ini && b.cena?.tipo === "tipografia");
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    await reabrirNoApoio(roteiroAberto, i, novoK);
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- sons de efeito populares (sons-meme.md) ----------
// o portfólio de SFX vem do catálogo (public/sfx/catalogo.json): [id, nome, quando usar e onde marcar, categoria, auto]
let SONS_MEME = [], ARQUIVO_MEME = {};
// os efeitos do estúdio (public/sfx/*.wav, os que as cenas já usam sozinhas): também se podem pôr à mão
const SONS_ESTUDIO = [
  ["whoosh", "Whoosh (passagem)"], ["impacto", "Impacto"], ["pop", "Pop"], ["clique", "Clique"], ["popup-1", "Pop-up 1"], ["popup-2", "Pop-up 2"],
  ["popup-3", "Pop-up 3"], ["popup-4", "Pop-up 4"], ["riser", "Riser (subida de tensão)"], ["chime", "Chime (brilho)"], ["rasgo", "Papel a rasgar"],
  ["amassado", "Papel amassado"], ["fita", "Fita adesiva"], ["cartao", "Cartão"], ["caneta", "Caneta"], ["obturador", "Obturador de câmara"],
].map(([id, nome]) => [id, nome, "Efeito do estúdio: o mesmo que as cenas usam sozinhas.", "Efeitos do estúdio", false]);
fetch("/public/sfx/catalogo.json").then((r) => r.json()).then((c) => {
  SONS_MEME = [...SONS_ESTUDIO, ...Object.entries(c).map(([id, s]) => [id, s.nome, s.auto ? `${s.quando}. Marcar ${s.onde}.` : s.quando, s.auto ? s.categoria : "Só à mão", s.auto])];
  ARQUIVO_MEME = Object.fromEntries(Object.entries(c).map(([id, s]) => [id, s.arquivo]));
}).catch(() => { SONS_MEME = [...SONS_ESTUDIO]; });
const urlSom = (nome) => (SONS_ESTUDIO.some(([v]) => v === nome) ? `/public/sfx/${nome}.wav` : `/public/sfx/memes/${ARQUIVO_MEME[nome] ?? `${nome}.mp3`}`);
let somTocando = null;
function ouvirSomMeme(nome, botao) {
  if (somTocando) { somTocando.pause(); somTocando = null; botao.innerHTML = ic("play", 14); return; }
  somTocando = new Audio(urlSom(nome));
  somTocando.volume = 0.7; somTocando.play();
  botao.innerHTML = ic("square", 14);
  somTocando.onended = () => { somTocando = null; botao.innerHTML = ic("play", 14); };
}
// as opções agrupadas por categoria (suspense, impacto, reação…), como no guia
const opcoesSom = (atual) => {
  const grupos = {};
  for (const [v, n, , cat] of SONS_MEME) (grupos[cat] ??= []).push(`<option value="${v}" ${v === atual ? "selected" : ""}>${esc(n)}</option>`);
  return Object.entries(grupos).map(([cat, ops]) => `<optgroup label="${esc(cat)}">${ops.join("")}</optgroup>`).join("");
};
const dicaSom = (nome) => SONS_MEME.find(([v]) => v === nome)?.[2] ?? "";
// nos cortes: a lista de sons, cada um num momento da fala
function blocoSons(c, i) {
  const sons = c.sons ?? [];
  return `<div class="sons-corte">
    <span class="rotulo">Sons de efeito <small>${sons.length ? `${sons.length} ${c.tipo === "clipe" ? "no corte" : "na cena"}` : c.tipo === "clipe" ? "nenhum; use no máximo 2 por corte" : "nenhum (além dos automáticos da cena)"}</small></span>
    ${sons.map((s, k) => `<div class="som-linha" data-k="${k}">
      <input type="hidden" data-s="volume" value="${s.volume ?? ""}">
      <select data-s="nome" style="width:auto" onchange="this.closest('.som-linha').querySelector('.dica').textContent = dicaSom(this.value)">${opcoesSom(s.nome)}</select>
      <button class="btn icone peq" title="Ouvir" aria-label="Ouvir o som" onclick="ouvirSomMeme(this.previousElementSibling.value, this)">${ic("play", 14)}</button>
      <span class="meta">aos</span><input data-s="em" type="number" step="0.01" min="0" value="${(s.emMs / 1000).toFixed(2)}" style="width:86px" oninput="falaDoSom(${i}, ${k})"><span class="meta">s</span>
      <button class="btn fantasma icone peq" title="Tirar este som" aria-label="Tirar este som" onclick="removerSom(${i}, ${k})">${ic("trash-2", 14)}</button>
      <div class="dica" style="width:100%;margin:0">${esc(dicaSom(s.nome))}</div>
      <div class="som-fala meta" style="width:100%"></div>
    </div>`).join("")}
    <button class="btn fantasma peq" style="margin-top:6px" onclick="adicionarSom(${i})">${ic("plus", 14)}Adicionar som</button>
  </div>`;
}
// as palavras ditas à volta do momento do som (para o pôr na palavra certa)
function falaDoSom(i, k) {
  const linha = document.querySelector(`.cena[data-i="${i}"] .som-linha[data-k="${k}"]`);
  const em = Number(linha.querySelector('[data-s="em"]').value) * 1000;
  const ws = roteiroAberto.cenas[i].palavras ?? [];
  const n = ws.findIndex((p) => p.fimMs >= em);
  const perto = n < 0 ? [] : ws.slice(Math.max(0, n - 4), n + 5);
  linha.querySelector(".som-fala").innerHTML = perto.length ? `Nesse momento: ${perto.map((p) => (p === ws[n] ? `<b style="color:var(--texto)">${esc(p.texto)}</b>` : esc(p.texto))).join(" ")}` : "";
}
function lerSons(el, c) {
  const sons = [...el.querySelectorAll(".som-linha")].map((x) => {
    const vol = x.querySelector('[data-s="volume"]')?.value;
    return { nome: x.querySelector('[data-s="nome"]').value, emMs: Math.round(Number(x.querySelector('[data-s="em"]').value) * 1000), ...(vol !== "" && vol != null && Number(vol) !== 1 ? { volume: Number(vol) } : {}) };
  })
    .filter((s) => Number.isFinite(s.emMs) && s.emMs >= 0).sort((a, b) => a.emMs - b.emMs);
  if (sons.length) c.sons = sons; else delete c.sons;
}
async function adicionarSom(i) {
  try {
    roteiroAberto = lerEditor();
    const c = roteiroAberto.cenas[i];
    (c.sons ??= []).push({ nome: "hit", emMs: Math.min((c.sons.at(-1)?.emMs ?? 0) + 5000, Math.max(0, (c.duracaoMs ?? 20000) - 2000)) });
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    abrirEditor(roteiroAberto.id, roteiroAberto);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function removerSom(i, k) {
  try {
    roteiroAberto = lerEditor();
    roteiroAberto.cenas[i].sons.splice(k, 1);
    await api(`/api/roteiros/${roteiroAberto.id}`, { method: "PUT", body: roteiroAberto });
    abrirEditor(roteiroAberto.id, roteiroAberto);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
// (o antigo campo de um som por cena passou a ser a lista de sons, como nos cortes)

async function abrirEditor(id, roteiro) {
  roteiroAberto = roteiro ?? await api(`/api/roteiros/${id}`);
  const r = roteiroAberto;
  // o som único antigo das cenas narradas passa para a lista de sons (o vídeo toca os dois formatos)
  for (const c of r.cenas ?? []) if (c.som && c.tipo !== "clipe") { (c.sons ??= []).push({ nome: c.som.nome, emMs: Math.round((c.som.em ?? 0) * 1000) }); c.sons.sort((a, b) => a.emMs - b.emMs); delete c.som; }
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
    <div class="campo" style="margin-top:12px"><span class="rotulo">Trecho da música</span><div class="trecho" id="edTrecho" style="margin-top:0"></div><input type="hidden" data-f="musicaInicio" value="${r.musicaInicio ?? 0}"></div>
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
        <div class="cena-topo"><span class="n">${String(i + 1).padStart(2, "0")}</span>${seletorTipoCena(i, c.tipo) || `<span class="tipo">${NOME_CENA[c.tipo] ?? c.tipo}</span>`}
          <span class="meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">${esc(c.nome ?? c.titulo ?? c.texto_tela ?? "")}</span>
          ${c.tipo === "clipe" ? "" : `<button type="button" class="btn fantasma peq" title="Desenhar um frame desta cena com o que está escrito agora" onclick="previaCena(${i}, this)">${ic("eye", 14)}Pré-visualizar</button>`}</div>
        <div class="previa-cena" hidden></div>
        <div class="cena-corpo">
          ${camposCena(c, i)}
          ${c.tipo === "clipe" ? "" : campo("Narração", "fala", c.fala, "textarea") + `<div class="dica" style="margin-top:-6px">Escreva como se fala: números por extenso. Use <code>[pausa]</code> para respirar e <code>[pausa longa]</code> antes de uma revelação.</div>`}
          ${blocoMidia(c, i)}
          ${blocoSons(c, i)}
        </div>
      </div>`).join("")}`;
  await trocarMotorEditor(r.narracao ?? "edge", r.voz);
  if (r.cenas.some((c) => c.broll?.some((b) => b.cena?.tipo === "tipografia")) && !polyhavenLista) carregarPolyhaven();
  document.querySelectorAll(".cena").forEach((el) => el.querySelectorAll(".som-linha").forEach((x) => falaDoSom(Number(el.dataset.i), Number(x.dataset.k))));
  // as palavras do trecho de cada apoio (sem mexer no texto escrito à mão)
  document.querySelectorAll(".cena").forEach((el) => el.querySelectorAll(".apoio").forEach((a) => {
    const tx = a.querySelector('[data-a="texto"]'), guardado = tx?.value;
    atualizarFalaApoio(Number(el.dataset.i), Number(a.dataset.k));
    if (tx) { tx.value = guardado; desenharChaves(tx); }
  }));
  $("#edCorpo").querySelector('[data-f="musica"]')?.addEventListener("change", () => { $("#edCorpo").querySelector('[data-f="musicaInicio"]').value = 0; montarTrechoEditor(); });
  montarTrechoEditor();
  carregarPublicacao(r.id);
  carregarCapa(r.id);
  carregarRevisao(r.id);
  if (typeof modoEdicao !== "undefined" && modoEdicao) return edicaoAposAbrir();
  if (!dlgEditor.open) dlgEditor.showModal();
}

// trecho da música no editor: a duração real do vídeo quando já há narração
function montarTrechoEditor() {
  const corpo = $("#edCorpo"), r = roteiroAberto;
  const sel = corpo.querySelector('[data-f="musica"]'), campoIni = corpo.querySelector('[data-f="musicaInicio"]'), el = $("#edTrecho");
  if (!sel || !el) return;
  const f = sel.value.includes("/") ? faixaDe(sel.value, r.estilo) : null;
  el.closest(".campo").hidden = sel.value === "nenhuma";
  if (!f) { el.innerHTML = '<div class="dica">Para escolher o trecho, escolha uma faixa da lista (a automática só é sorteada na produção).</div>'; return; }
  const ms = (r.cenas ?? []).reduce((t, c) => t + (c.duracaoMs ?? 0), 0);
  const prevista = r.formato === "longo" ? 360 : { curto: 40, medio: 53, longo: 75 }[r.duracao_alvo] ?? 50;
  montarTrecho(el, {
    arquivo: f.arquivo, inicio: Number(campoIni.value) || 0, duracaoVideo: ms > 3000 ? ms / 1000 : prevista,
    aoMudar: (s) => { campoIni.value = s; },
  });
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
  r.musicaInicio = Number(val(corpo, "musicaInicio")) || undefined;
  r.sfxVolume = Number(val(corpo, "sfxVolume"));
  corpo.querySelectorAll(".cena").forEach((el) => {
    const c = r.cenas[el.dataset.i];
    if (c.tipo !== "clipe") c.fala = val(el, "fala");
    lerSons(el, c); // todas as cenas têm a lista de sons (o antigo "som" único passou para ela ao abrir)
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
    if (c.tipo === "clipe") { lerTranscricao(el, c); lerApoios(el, c); }
    if (lerEditoriais(el, c)) return;
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
        <span>${esc(m.nome)}</span><small>${esc(m.licenca.replace("CC Attribution", "CC BY"))}, ${m.tamanhoMB} MB</small>
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

// o trecho da música para de tocar quando o editor fecha
dlgEditor.addEventListener("close", () => pararTrecho());

// ---------- custos ----------
// Claude: o Claude Code diz no fim de cada pedido quanto custaria na API (com assinatura Pro/Max não é cobrado à parte,
// mas é a medida do que se gastou do limite). ElevenLabs: caracteres narrados. IA externa: pedidos respondidos fora.
const usd = (v) => `US$ ${(v >= 100 ? v.toFixed(0) : v >= 0.01 || !v ? v.toFixed(2) : v.toFixed(3)).replace(".", ",")}`;
const milhares = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M` : n >= 1e4 ? `${Math.round(n / 1e3)} mil` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".", ",")} mil` : String(n || 0));
const quandoCusto = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; };
async function mudarPlanoClaude(plano) {
  try { await api("/api/custos/plano", { method: "POST", body: { plano } }); } catch (e) { return toast(e.message, "triangle-alert"); }
  abrirCustos();
}
async function abrirCustos() {
  const el = $("#custosCorpo");
  let c;
  try { c = await api("/api/custos"); } catch (e) { el.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
  const cartao = (rotulo, p) => `<div class="custo-cartao"><div class="meta">${rotulo}</div><div class="custo-valor">${usd(p.usd)}</div>
    <div class="meta">${p.chamadas} ${p.chamadas === 1 ? "pedido" : "pedidos"} ao Claude, ${milhares(p.tokens)} tokens</div>
    ${p.caracteres ? `<div class="meta">${milhares(p.caracteres)} caracteres na ElevenLabs</div>` : ""}
    ${p.externos ? `<div class="meta">${p.externos} ${p.externos === 1 ? "resposta" : "respostas"} de IA externa</div>` : ""}</div>`;
  const e = c.eleven;
  // Claude: a mensalidade do plano e quanto dela o estúdio gastou nos últimos 30 dias (o equivalente na API)
  const PLANOS = { pro: ["Pro", 20], max5: ["Max 5x", 100], max20: ["Max 20x", 200], api: ["Chave de API (paga por uso)", 0] };
  const pl = PLANOS[c.claude?.plano];
  const parte = pl && pl[1] ? Math.min(100, (c.mes.usd / pl[1]) * 100) : 0;
  const cartaoClaude = `<section class="superficie"><div class="linha" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:10px">
      <h2 class="titulo-superficie" style="margin:0">Claude</h2>
      <label class="linha" style="gap:8px"><span class="meta">Plano</span><select id="planoClaude" style="width:auto" onchange="mudarPlanoClaude(this.value)">
        <option value="" ${!pl ? "selected" : ""}>Escolha o seu plano</option>
        ${Object.entries(PLANOS).map(([k, [nome, preco]]) => `<option value="${k}" ${c.claude?.plano === k ? "selected" : ""}>${nome}${preco ? ` (US$ ${preco}/mês)` : ""}</option>`).join("")}
      </select></label></div>
    ${!pl ? '<div class="meta">Escolha o plano para comparar o gasto do estúdio com a mensalidade.</div>'
      : pl[1] ? `<div class="linha" style="justify-content:space-between;flex-wrap:wrap"><span>${usd(c.mes.usd)} de ${usd(pl[1])} da mensalidade nos últimos 30 dias</span><span class="meta">${Math.round(parte)}%</span></div>
        <div class="custo-barra"><b style="width:${parte}%"></b></div>
        <div class="dica">A mensalidade é o custo fixo. O valor à esquerda é o que os pedidos do estúdio custariam na API: mostra quanto do plano o estúdio usa, não é cobrado à parte.</div>`
      : `<div>${usd(c.mes.usd)} nos últimos 30 dias, ${usd(c.total.usd)} desde o início</div><div class="dica">Com chave de API, este é o valor cobrado pela Anthropic.</div>`}
    ${c.modo === "externa" ? '<div class="aviso">O motor de IA está em IA externa: o Claude não está a ser usado, por isso o gasto dele fica em zero. Pode mudar em Configurações.</div>' : ""}
  </section>`;
  const barra = e && e.limite ? Math.min(100, (e.usados / e.limite) * 100) : 0;
  const linhaTabela = (x, nome) => `<tr><td>${nome}</td><td>${x.usd ? usd(x.usd) : "—"}</td><td>${x.chamadas || "—"}</td><td>${x.caracteres ? milhares(x.caracteres) : "—"}</td><td>${x.externos || "—"}</td><td class="meta">${quandoCusto(x.ultimo)}</td></tr>`;
  const cabeca = (primeira) => `<tr><th>${primeira}</th><th>Claude</th><th>Pedidos</th><th>Caracteres</th><th>IA externa</th><th>Último</th></tr>`;
  const vazio = !c.recentes.length;
  el.innerHTML = `
    <div class="dica" style="margin-bottom:14px">${c.modo === "externa" ? "Está no modo IA externa: as respostas coladas de outras IAs não custam nada ao estúdio (só se contam). " : ""}O valor do Claude é o equivalente na API que o próprio Claude Code calcula. Com uma assinatura (Pro ou Max) não é cobrado à parte: mostra quanto se gastou do limite. Com uma chave de API é o que se paga.</div>
    <div class="custo-grelha">${cartao("Hoje", c.hoje)}${cartao("Últimos 7 dias", c.semana)}${cartao("Últimos 30 dias", c.mes)}${cartao("Desde o início", c.total)}</div>
    ${cartaoClaude}
    ${e ? `<section class="superficie"><h2 class="titulo-superficie">ElevenLabs, plano ${esc(e.plano ?? "")}</h2>
      <div class="linha" style="justify-content:space-between"><span>${milhares(e.usados)} de ${milhares(e.limite)} caracteres este mês</span><span class="meta">${e.renova ? `renova a ${new Date(e.renova).toLocaleDateString("pt-BR")}` : ""}</span></div>
      <div class="custo-barra"><b style="width:${barra}%"></b></div></section>` : ""}
    ${vazio ? '<div class="vazio">Ainda não há custos registrados. Aparecem aqui a partir do próximo vídeo, ideia ou pacote de publicação.</div>' : `
    <section class="superficie"><h2 class="titulo-superficie">Por etapa</h2>
      <div style="overflow-x:auto"><table class="tabela">${cabeca("Etapa")}${c.porEtapa.map((x) => linhaTabela(x, esc(x.chave))).join("")}</table></div></section>
    <section class="superficie"><h2 class="titulo-superficie">Por vídeo</h2>
      ${c.porVideo.length ? `<div style="overflow-x:auto"><table class="tabela">${cabeca("Vídeo")}${c.porVideo.map((x) => linhaTabela(x, `<a href="#" onclick="abrirEditor('${esc(x.chave)}');return false">${esc(x.titulo)}</a>`)).join("")}</table></div>` : '<div class="meta">Os pedidos fora de um vídeo (ideias, cortes, estilos) estão só por etapa.</div>'}</section>
    <section class="superficie"><h2 class="titulo-superficie">Últimos pedidos</h2>
      <div style="overflow-x:auto"><table class="tabela"><tr><th>Quando</th><th>Etapa</th><th>Vídeo</th><th>Serviço</th><th>Custo</th></tr>
      ${c.recentes.map((x) => `<tr><td class="meta">${quandoCusto(x.em)}</td><td>${esc(x.etapa ?? "")}</td><td>${esc(x.titulo ?? "—")}</td><td>${{ claude: "Claude", elevenlabs: "ElevenLabs", "ia-externa": "IA externa" }[x.servico] ?? esc(x.servico)}</td>
        <td>${x.servico === "claude" ? `${usd(x.custoUSD)} <span class="meta">· ${milhares((x.tokens?.entrada ?? 0) + (x.tokens?.saida ?? 0) + (x.tokens?.cacheLeitura ?? 0) + (x.tokens?.cacheEscrita ?? 0))} tokens</span>` : x.servico === "elevenlabs" ? `${milhares(x.caracteres)} caracteres` : "grátis"}</td></tr>`).join("")}
      </table></div></section>`}`;
}
