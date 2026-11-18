// ---------- Editor manual (tela Editar): player ao vivo, timeline com faixas e inspetor ----------
// O player é o vídeo a sério desenhado no navegador (@remotion/player, server/editor/player.js); a timeline mostra
// cenas, apoios, legendas, efeitos sonoros, narração e música; o inspetor são os mesmos formulários do editor de
// roteiro (o #edCorpo muda-se para aqui enquanto a tela está aberta). Tudo o que muda redesenha o player na hora.
// Carregado depois do painel.js (usa as funções dele: abrirEditor, lerEditor, api, toast, ic, esc…).
"use strict";

const ED = {
  aberto: false, id: null, roteiro: null, narrado: [], musicaAuto: null, pedidoMusica: null,
  player: null, pxSeg: 70, sel: { tipo: "cena", i: 0 }, aba: "cena", desfazer: [], refazer: [], sujo: false, ultimoPush: 0,
  manifest: null, inicios: [], fps: 30, encaixe: true, picos: new Map(), arrastar: null,
};
let modoEdicao = false;

// ---------- abrir e fechar ----------
async function carregarPlayerEstudio() {
  if (window.PlayerEstudio) return;
  window.remotion_staticBase = "/public"; // os ficheiros do vídeo (staticFile) vêm de /public/… no painel
  await new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "/editor/player.js";
    s.onload = ok;
    s.onerror = () => falha(new Error("O player do editor não foi compilado: reinicie o painel (ou corra node scripts/build_editor.mjs)"));
    document.head.append(s);
  });
}
async function abrirEdicao(id) {
  try {
    toast("A abrir o editor…", "loader");
    const [dados] = await Promise.all([api(`/api/editor/${id}`), carregarPlayerEstudio()]);
    Object.assign(ED, { aberto: true, id, roteiro: dados.roteiro, narrado: dados.narrado ?? [], musicaAuto: dados.musica, pedidoMusica: dados.roteiro.musica ?? "auto", desfazer: [], refazer: [], sujo: false, sel: { tipo: "cena", i: 0 }, aba: "cena" });
    ED.fps = window.PlayerEstudio.FPS;
    if (dlgEditor.open) dlgEditor.close();
    // o inspetor é o formulário do editor de roteiro, mudado para dentro desta tela
    modoEdicao = true;
    $("#edicaoInspetor").append($("#edCorpo"));
    $("#edicaoTitulo").textContent = dados.roteiro.titulo || id;
    dlgEdicao.showModal();
    await abrirEditor(id, dados.roteiro); // desenha os formulários e chama edicaoAposAbrir
    ED.manifest = manifestDe(ED.roteiro);
    ED.player?.desmontar();
    ED.player = window.PlayerEstudio.montar($("#edicaoPlayer"), ED.manifest);
    ED.player.aoFrame((f) => moverCabeca(f));
    ED.player.aoTocar((t) => { $("#edBtnTocar").innerHTML = ic(t ? "pause" : "play", 18); });
    $("#edicaoPlayer").classList.toggle("horizontal", dados.roteiro.formato === "longo");
    alturaTimeline(); larguraLado();
    ajustarTimeline(); // abre com o vídeo todo à vista
    estadoGuardado();
  } catch (e) { toast(e.message, "triangle-alert"); fecharEdicao(true); }
}
function fecharEdicao(forcar = false) {
  if (!forcar && ED.sujo && !confirm("Há alterações por salvar. Sair mesmo assim?")) return;
  ED.player?.pausar(); ED.player?.desmontar(); ED.player = null;
  modoEdicao = false; ED.aberto = false;
  // o formulário volta ao editor de roteiro
  document.querySelector("#dlgEditor .gaveta-caixa").insertBefore($("#edCorpo"), document.querySelector("#dlgEditor .gaveta-rodape"));
  $("#edCorpo").querySelectorAll(".cena-sel").forEach((x) => x.classList.remove("cena-sel"));
  if (dlgEdicao.open) dlgEdicao.close();
  atualizarGaleria?.();
}
// chamado pelo abrirEditor quando o formulário está nesta tela (em vez de abrir o editor de roteiro)
function edicaoAposAbrir() {
  ED.roteiro = roteiroAberto;
  aplicarInspetor();
  if (ED.player) { ED.manifest = manifestDe(ED.roteiro); ED.player.atualizar(ED.manifest); desenharTimeline(); }
}

// ---------- o vídeo que o player mostra: o roteiro editado com a narração que já existe ----------
const normFala = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
function manifestDe(r) {
  const usados = new Set();
  const cenas = r.cenas.map((c) => {
    if (c.tipo === "clipe") return { ...c };
    // a voz de cada cena segue a fala (mesmo depois de mudar a ordem); fala mudada = voz por refazer no render
    const k = ED.narrado.findIndex((n, j) => !usados.has(j) && normFala(n.fala) === normFala(c.fala));
    if (k >= 0) { usados.add(k); const n = ED.narrado[k]; return { ...c, duracaoMs: n.duracaoMs, palavras: n.palavras, audio: n.audio }; }
    const palavras = normFala(c.fala).replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).map((t, j) => ({ texto: t, inicioMs: j * 330, fimMs: j * 330 + 300 }));
    return { ...c, duracaoMs: c.duracaoMs ?? Math.max(2500, palavras.length * 330 + 500), palavras, porNarrar: true };
  });
  const pedido = r.musica ?? "auto";
  const musica = pedido === "nenhuma" ? undefined : pedido.includes("/") ? pedido : pedido === ED.pedidoMusica ? ED.musicaAuto ?? undefined
    : MUSICAS?.faixas?.find((m) => m.clima === pedido || m.tambem?.includes(pedido))?.arquivo;
  const m = { ...r, cenas, musica };
  ED.inicios = cenas.reduce((a, c, i) => [...a, i ? a[i - 1] + window.PlayerEstudio.framesDaCena(cenas[i - 1]) : 0], []);
  ED.total = cenas.length ? ED.inicios.at(-1) + window.PlayerEstudio.framesDaCena(cenas.at(-1)) : 1;
  const porNarrar = cenas.filter((c) => c.porNarrar).length;
  $("#edicaoAviso").hidden = !porNarrar;
  $("#edicaoAviso").textContent = porNarrar ? `${porNarrar} ${porNarrar === 1 ? "cena tem" : "cenas têm"} a fala nova: o tempo é estimado e a voz é feita no render.` : "";
  return m;
}

// ---------- inspetor: a cena (ou o apoio, o som) escolhido, ou os dados do vídeo ----------
function aplicarInspetor() {
  const insp = $("#edicaoInspetor");
  const somSel = ED.aba === "cena" && (ED.sel.tipo === "som" || ED.sel.tipo === "entrada");
  insp.dataset.aba = somSel ? "som" : ED.aba;
  desenharPainelSom(somSel);
  desenharPainelEfeitos(ED.aba === "cena" && ED.sel.tipo === "cena");
  document.querySelectorAll("#edicaoAbas [data-aba]").forEach((b) => b.classList.toggle("ativo", b.dataset.aba === ED.aba));
  $("#edCorpo").querySelectorAll(".cena").forEach((el) => el.classList.toggle("cena-sel", Number(el.dataset.i) === ED.sel.i));
  $("#edCorpo").querySelectorAll(".apoio-sel, .som-sel").forEach((x) => x.classList.remove("apoio-sel", "som-sel"));
  const cena = $("#edCorpo").querySelector(`.cena[data-i="${ED.sel.i}"]`);
  let alvo = null;
  if (ED.sel.tipo === "apoio") alvo = cena?.querySelector(`.apoio[data-k="${ED.sel.k}"]`);
  if (ED.sel.tipo === "som") alvo = cena?.querySelectorAll(".som-linha")[ED.sel.k] ?? cena?.querySelector(".som-cena");
  alvo?.classList.add(ED.sel.tipo === "apoio" ? "apoio-sel" : "som-sel");
  if (ED.aba === "cena") requestAnimationFrame(() => (alvo ? alvo.scrollIntoView({ block: "nearest" }) : ($("#edCorpo").scrollTop = 0)));
}
function mudarAba(aba) { ED.aba = aba; aplicarInspetor(); }
function selecionar(sel, saltar = true) {
  ED.sel = sel; ED.aba = sel.tipo === "musica" ? "video" : "cena";
  aplicarInspetor();
  marcarSelecao();
  if (saltar && sel.tipo === "cena") ED.player?.irPara(ED.inicios[sel.i] ?? 0);
  if (sel.tipo === "musica") requestAnimationFrame(() => $("#edCorpo").querySelector('[data-f="musica"]')?.closest(".grid2")?.scrollIntoView({ block: "center" }));
}

// ---------- sons na timeline: escolher um som, o inspetor de um som e o da entrada da cena ----------
// as opções do seletor: "Padrão"/"Nenhum" (se pedidas) e todos os sons (efeitos do estúdio e memes), por grupo
const opcoesSomEd = (atual, extra = []) => extra.map(([v, n]) => `<option value="${v}" ${v === (atual ?? "") ? "selected" : ""}>${esc(n)}</option>`).join("") + opcoesSom(atual);
function ouvirDoSeletor(id, botao) {
  const v = document.getElementById(id)?.value ?? "";
  if (v !== "nenhum") ouvirSomMeme(v || "whoosh", botao);
}
const botaoOuvir = (id) => `<button type="button" class="btn icone peq" title="Ouvir" aria-label="Ouvir o som" onclick="ouvirDoSeletor('${id}', this)">${ic("play", 14)}</button>`;
// os sons automáticos que se podem trocar em cada cena (os nomes que as cenas usam por dentro)
const SONS_AUTO = [["whoosh", "Whoosh (passagens e frases)"], ["clique", "Clique (palavra-chave)"], ["impacto", "Impacto"], ["pop", "Pop"], ["popup", "Pop-ups"], ["riser", "Riser"], ["chime", "Chime"]];
function desenharPainelSom(mostrar) {
  let p = $("#edSomPainel");
  if (!p) { p = document.createElement("div"); p.id = "edSomPainel"; p.className = "ed-som-painel"; $("#edicaoInspetor").prepend(p); }
  p.hidden = !mostrar;
  if (!mostrar) return;
  const s = ED.sel, c = ED.roteiro.cenas[s.i];
  if (!c) { p.hidden = true; return; }
  if (s.tipo === "som") {
    const som = c.sons?.[s.k];
    if (!som) { p.hidden = true; return; }
    const vol = Math.round((som.volume ?? 1) * 100);
    p.innerHTML = `<h3>${ic("audio-lines", 16)} Som na cena ${s.i + 1}</h3>
      <div class="campo"><span class="rotulo">Som</span><div class="linha"><select id="edSomNome" onchange="mudarSomSel({ nome: this.value })">${opcoesSomEd(som.nome)}</select>${botaoOuvir("edSomNome")}</div>
        <div class="dica">${esc(dicaSom(som.nome))}</div></div>
      <div class="grid2">
        <div class="campo"><span class="rotulo">Momento <small>s desde o início da cena</small></span><input type="number" step="0.05" min="0" value="${(som.emMs / 1000).toFixed(2)}" onchange="mudarSomSel({ emMs: Math.max(0, Math.round(Number(this.value) * 1000)) })"></div>
        <div class="campo"><span class="rotulo">Volume <small id="edSomVolTxt">${vol}%</small></span><input type="range" min="0" max="200" step="5" value="${vol}" oninput="document.getElementById('edSomVolTxt').textContent = this.value + '%'" onchange="mudarSomSel({ volume: Number(this.value) / 100 })"></div>
      </div>
      <div class="linha" style="gap:6px"><button class="btn fantasma peq" onclick="duplicarSelecao()">${ic("copy", 14)}Duplicar</button><button class="btn fantasma peq" onclick="apagarSelecao()">${ic("trash-2", 14)}Apagar</button></div>
      <p class="meta">Arraste o som na timeline para o mudar de momento. Duplo clique na faixa Sons acrescenta outro.</p>`;
    return;
  }
  const trocas = c.trocaSons ?? {};
  p.innerHTML = `<h3>${ic("wind", 16)} Sons da cena ${s.i + 1}</h3>
    ${s.i ? `<div class="campo"><span class="rotulo">Som de entrada <small>toca na passagem para esta cena</small></span><div class="linha"><select id="edSomEntrada" onchange="mudarSonsCena((c) => { if (this.value) c.somEntrada = this.value; else delete c.somEntrada; })">${opcoesSomEd(c.somEntrada, [["", "Whoosh (padrão)"], ["nenhum", "Sem som"]])}</select>${botaoOuvir("edSomEntrada")}</div></div>` : ""}
    <div class="campo"><span class="rotulo">Sons automáticos desta cena <small>os que a animação toca sozinha: o whoosh de cada frase, o clique na palavra-chave…</small></span>
      ${SONS_AUTO.map(([base, nome]) => `<div class="linha ed-troca-som"><span>${esc(nome)}</span><select id="edTroca-${base}" onchange="mudarSonsCena((c) => { c.trocaSons ??= {}; if (this.value) c.trocaSons['${base}'] = this.value; else delete c.trocaSons['${base}']; if (!Object.keys(c.trocaSons).length) delete c.trocaSons; })">${opcoesSomEd(trocas[base], [["", "Padrão"], ["nenhum", "Sem som"]])}</select>${botaoOuvir(`edTroca-${base}`)}</div>`).join("")}
    </div>
    <p class="meta">Para pôr um som num momento exato, dê duplo clique na faixa Sons (ou use o botão Som na barra da timeline).</p>`;
}
async function mudarSomSel(mud) {
  const s = ED.sel;
  await mudar((r) => { const c = r.cenas[s.i], som = c.sons[s.k]; Object.assign(som, mud); if (som.volume === 1) delete som.volume; c.sons.sort((x, y) => x.emMs - y.emMs); ED.sel = { tipo: "som", i: s.i, k: c.sons.indexOf(som) }; });
}
async function mudarSonsCena(fn) { const i = ED.sel.i; await mudar((r) => fn(r.cenas[i])); }
// escolher um som para pôr num momento (duplo clique na faixa Sons, ou o botão Som na barra: na cabeça de leitura)
function escolherSomPara(segundos) {
  if (segundos === undefined) segundos = seg(ED.player?.frame() ?? 0);
  const i = Math.max(0, ED.inicios.findLastIndex((f) => f <= Math.round(segundos * ED.fps)));
  const emMs = Math.max(0, Math.round((segundos - seg(ED.inicios[i])) * 1000));
  let p = $("#edSomEscolha");
  if (!p) { p = document.createElement("div"); p.id = "edSomEscolha"; p.className = "ed-som-escolha"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Escolher um som"); $("#dlgEdicao").append(p); }
  p.hidden = false;
  p.innerHTML = `<div class="ed-som-escolha-topo"><b>Pôr um som aos ${tempoTL(segundos)} <small>(cena ${i + 1})</small></b>
      <button class="btn fantasma icone peq" onclick="document.getElementById('edSomEscolha').hidden = true" aria-label="Fechar">${ic("x", 14)}</button></div>
    <input type="search" placeholder="Procurar (whoosh, impacto, sino, bruh…)" aria-label="Procurar som">
    <div class="ed-som-lista"></div>`;
  const lista = p.querySelector(".ed-som-lista"), busca = p.querySelector("input");
  const desenhar = () => {
    const q = busca.value.trim().toLowerCase();
    const grupos = {};
    for (const [v, n, dica, cat] of SONS_MEME) if (!q || `${v} ${n} ${cat} ${dica}`.toLowerCase().includes(q)) (grupos[cat] ??= []).push([v, n, dica]);
    lista.innerHTML = Object.entries(grupos).map(([cat, ops]) => `<div class="ed-som-grupo">${esc(cat)}</div>` + ops.map(([v, n, dica]) => `<div class="ed-som-op" title="${esc(dica)}">
        <button type="button" class="btn icone peq" aria-label="Ouvir ${esc(n)}" onclick="ouvirSomMeme('${v}', this)">${ic("play", 14)}</button>
        <button type="button" class="ed-som-por" data-v="${esc(v)}"><b>${esc(n)}</b><small>${esc(dica)}</small></button></div>`).join("")).join("") || `<p class="meta">Nenhum som com esse nome.</p>`;
  };
  busca.addEventListener("input", desenhar);
  busca.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); p.hidden = true; } });
  lista.addEventListener("click", async (e) => {
    const b = e.target.closest(".ed-som-por");
    if (!b) return;
    p.hidden = true;
    await mudar((r) => { const c = r.cenas[i], som = { nome: b.dataset.v, emMs }; (c.sons ??= []).push(som); c.sons.sort((x, y) => x.emMs - y.emMs); ED.sel = { tipo: "som", i, k: c.sons.indexOf(som) }; });
    aplicarInspetor(); marcarSelecao();
    toast(`${nomeSomEd(b.dataset.v)} aos ${tempoTL(segundos)}`, "audio-lines");
  });
  desenhar();
  busca.focus();
}

// ---------- edição livre: a cena num momento, efeitos da cena, copiar/colar e menu de clique direito ----------
// a cena que está a tocar no segundo s do vídeo
const cenaEm = (s) => Math.max(0, ED.inicios.findLastIndex((f) => f <= Math.round(s * ED.fps)));

// efeitos de uma cena (como no rea-capcut): cor, movimento e fades a preto (src/components/EfeitosCena.tsx)
const CORES_FX = [["", "Original"], ["cinema", "Cinema"], ["quente", "Quente"], ["frio", "Frio"], ["pb", "Preto e branco"], ["vintage", "Vintage"], ["vivo", "Vivo"], ["suave", "Suave"], ["noite", "Noite"]];
const FILTROS_FX = {
  cinema: "contrast(1.14) saturate(0.82) sepia(0.1) brightness(0.94)", quente: "sepia(0.28) saturate(1.25) hue-rotate(-10deg)",
  frio: "saturate(0.88) hue-rotate(14deg) contrast(1.06) brightness(1.03)", pb: "grayscale(1) contrast(1.12)",
  vintage: "sepia(0.48) contrast(0.9) brightness(1.06) saturate(0.78)", vivo: "saturate(1.5) contrast(1.08)",
  suave: "contrast(0.86) brightness(1.07) saturate(0.88)", noite: "brightness(0.78) contrast(1.15) saturate(0.7) hue-rotate(18deg)",
};
const MOVIMENTOS_FX = [["", "Nenhum"], ["zoom-in", "Aproximar"], ["zoom-out", "Afastar"], ["pan", "Panorâmica"], ["tremor", "Tremor"]];
const temEfeitos = (c) => !!(c.efeitos && (c.efeitos.cor || c.efeitos.movimento || c.efeitos.entrada || c.efeitos.saida));
const resumoEfeitos = (c) => {
  const e = c.efeitos ?? {};
  return [e.cor && CORES_FX.find(([v]) => v === e.cor)?.[1], e.movimento && MOVIMENTOS_FX.find(([v]) => v === e.movimento)?.[1], e.entrada && `fade in ${e.entrada}s`, e.saida && `fade out ${e.saida}s`].filter(Boolean).join(", ");
};
function desenharPainelEfeitos(mostrar) {
  let p = $("#edEfeitosPainel");
  if (!p) { p = document.createElement("details"); p.id = "edEfeitosPainel"; p.className = "ed-fx-painel"; p.open = true; $("#edicaoInspetor").prepend(p); }
  p.hidden = !mostrar;
  if (!mostrar) return;
  const i = ED.sel.i, c = ED.roteiro.cenas[i];
  if (!c) { p.hidden = true; return; }
  const e = c.efeitos ?? {};
  const fade = (campo, nome) => `<div class="campo"><span class="rotulo">${nome} <small id="edFx-${campo}">${e[campo] ? `${e[campo]} s` : "não"}</small></span>
    <input type="range" min="0" max="1.5" step="0.1" value="${e[campo] ?? 0}" oninput="document.getElementById('edFx-${campo}').textContent = Number(this.value) ? this.value + ' s' : 'não'" onchange="mudarEfeitos(${i}, { ${campo}: Number(this.value) })"></div>`;
  p.innerHTML = `<summary>${ic("sparkles", 15)} Efeitos da cena ${i + 1}${temEfeitos(c) ? ` <small>${esc(resumoEfeitos(c))}</small>` : ""}</summary>
    <div class="ed-fx-corpo">
      <span class="rotulo">Cor</span>
      <div class="ed-fx-cores">${CORES_FX.map(([v, n]) => `<button type="button" class="ed-fx-cor ${v === (e.cor ?? "") ? "ativo" : ""}" onclick="mudarEfeitos(${i}, { cor: '${v}' })" title="${n}">
        <img src="/miniaturas/editorial.jpg" alt="" style="filter:${FILTROS_FX[v] ?? "none"}"><span>${n}</span></button>`).join("")}</div>
      <span class="rotulo">Movimento</span>
      <div class="ed-fx-movs">${MOVIMENTOS_FX.map(([v, n]) => `<button type="button" class="btn peq ${v === (e.movimento ?? "") ? "primario" : "fantasma"}" onclick="mudarEfeitos(${i}, { movimento: '${v}' })">${n}</button>`).join("")}</div>
      <div class="grid2">${fade("entrada", "Fade de entrada")}${fade("saida", "Fade de saída")}</div>
      <div class="linha" style="gap:6px;flex-wrap:wrap">
        <button type="button" class="btn fantasma peq" onclick="efeitosEmTodas(${i})" ${temEfeitos(c) ? "" : "disabled"}>${ic("copy", 14)}Aplicar a todas as cenas</button>
        <button type="button" class="btn fantasma peq" onclick="mudarEfeitos(${i}, null)" ${temEfeitos(c) ? "" : "disabled"}>${ic("rotate-ccw", 14)}Tirar efeitos</button>
      </div>
    </div>`;
}
async function mudarEfeitos(i, mud) {
  await mudar((r) => {
    const c = r.cenas[i];
    if (mud === null) { delete c.efeitos; return; }
    const e = { ...(c.efeitos ?? {}), ...mud };
    for (const k of Object.keys(e)) if (!e[k]) delete e[k];
    if (Object.keys(e).length) c.efeitos = e; else delete c.efeitos;
  });
}
async function efeitosEmTodas(i) {
  const fx = structuredClone(ED.roteiro.cenas[i].efeitos);
  await mudar((r) => r.cenas.forEach((c) => { c.efeitos = structuredClone(fx); }));
  toast(`Efeitos da cena ${i + 1} aplicados às ${ED.roteiro.cenas.length} cenas`, "sparkles");
}

// copiar e colar (Ctrl+C / Ctrl+V): sons e apoios, colados na cabeça de leitura (ou onde se clicou com o botão direito)
function copiarSelecao() {
  const s = ED.sel, c = ED.roteiro.cenas[s.i];
  if (s.tipo === "som" && c?.sons?.[s.k]) ED.copia = { tipo: "som", dado: structuredClone(c.sons[s.k]) };
  else if (s.tipo === "apoio" && c?.broll?.[s.k]) ED.copia = { tipo: "apoio", dado: structuredClone(c.broll[s.k]) };
  else if (s.tipo === "cena" && c?.efeitos) ED.copia = { tipo: "efeitos", dado: structuredClone(c.efeitos) };
  else return toast("Escolha um som, um apoio ou uma cena com efeitos para copiar", "copy");
  toast(ED.copia.tipo === "efeitos" ? "Efeitos copiados: escolha outra cena e cole (Ctrl+V)" : "Copiado: cole com Ctrl+V na cabeça de leitura", "copy");
}
async function colarEm(segundos) {
  const cp = ED.copia;
  if (!cp) return toast("Nada copiado (Ctrl+C num som, apoio ou cena)", "clipboard");
  const j = cp.tipo === "efeitos" ? ED.sel.i : cenaEm(segundos), sJ = seg(ED.inicios[j]), ms = Math.max(0, Math.round((segundos - sJ) * 1000));
  if (cp.tipo === "efeitos") return mudar((r) => { r.cenas[j].efeitos = structuredClone(cp.dado); });
  if (cp.tipo === "som") return mudar((r) => { const c = r.cenas[j], x = { ...structuredClone(cp.dado), emMs: ms }; (c.sons ??= []).push(x); c.sons.sort((a, b) => a.emMs - b.emMs); ED.sel = { tipo: "som", i: j, k: c.sons.indexOf(x) }; });
  if (ED.roteiro.cenas[j].tipo !== "clipe") return toast("Os apoios só se colam em cortes (cenas de clipe)", "triangle-alert");
  await mudar((r) => {
    const c = r.cenas[j], b = structuredClone(cp.dado), len = b.fimMs - b.inicioMs, dur = c.duracaoMs ?? ms + len;
    b.inicioMs = Math.max(0, Math.min(dur - len, ms)); b.fimMs = b.inicioMs + len;
    (c.broll ??= []).push(b); c.broll.sort((x, y) => x.inicioMs - y.inicioMs);
    ED.sel = { tipo: "apoio", i: j, k: c.broll.indexOf(b) };
  });
}

// menu de clique direito na timeline
function fecharMenuTl() { const m = $("#edMenuTl"); if (m) m.hidden = true; }
function abrirMenuTl(e) {
  e.preventDefault();
  const el = e.target.closest("[data-arr]"), s = tempoNoRato(e);
  const tipo = el?.dataset.arr, i = Number(el?.dataset.i), k = Number(el?.dataset.k);
  if (tipo === "cena") selecionar({ tipo: "cena", i }, false);
  else if (tipo === "apoio" || tipo === "som") selecionar({ tipo, i, k }, false);
  else if (tipo === "entrada") selecionar({ tipo: "entrada", i }, false);
  else if (tipo === "musica") selecionar({ tipo: "musica" }, false);
  const it = (icone, texto, acao, atalho = "", desligado = false) => ({ icone, texto, acao, atalho, desligado });
  const colar = it("clipboard-paste", ED.copia ? `Colar ${ED.copia.tipo === "som" ? "o som" : ED.copia.tipo === "apoio" ? "o apoio" : "os efeitos"} aqui` : "Colar", () => colarEm(s), "Ctrl+V", !ED.copia);
  const itens = tipo === "som" || tipo === "apoio" ? [
    it("copy", "Copiar", copiarSelecao, "Ctrl+C"), it("copy-plus", "Duplicar", duplicarSelecao, "D"),
    ...(tipo === "apoio" ? [it("scissors", "Dividir na cabeça de leitura", dividirSelecao, "S")] : []),
    colar, it("trash-2", "Apagar", apagarSelecao, "Delete"),
  ] : tipo === "cena" ? [
    it("sparkles", "Efeitos da cena…", () => { selecionar({ tipo: "cena", i }, false); $("#edEfeitosPainel").open = true; $("#edEfeitosPainel").scrollIntoView({ block: "start" }); }),
    it("audio-lines", "Pôr um som aqui", () => escolherSomPara(s)),
    it("copy", "Copiar efeitos", copiarSelecao, "Ctrl+C", !ED.roteiro.cenas[i]?.efeitos), colar,
    it("copy-plus", "Duplicar cena", duplicarSelecao, "D"), it("trash-2", "Apagar cena", apagarSelecao, "Delete"),
  ] : tipo === "entrada" ? [
    it("wind", "Trocar o som de entrada…", () => selecionar({ tipo: "entrada", i }, false)),
    it("volume-x", i ? "Sem som de entrada" : "Sem som de entrada (a cena 1 não tem)", () => mudar((r) => { r.cenas[i].somEntrada = "nenhum"; }), "", !i),
  ] : [
    it("audio-lines", "Pôr um som aqui", () => escolherSomPara(s)), colar,
    it("locate", "Levar a cabeça de leitura aqui", () => ED.player?.irPara(s * ED.fps)),
  ];
  let m = $("#edMenuTl");
  if (!m) { m = document.createElement("div"); m.id = "edMenuTl"; m.className = "ed-menu-tl"; m.setAttribute("role", "menu"); $("#dlgEdicao").append(m); }
  m.innerHTML = itens.map((x, n) => `<button type="button" role="menuitem" data-n="${n}" ${x.desligado ? "disabled" : ""}>${ic(x.icone, 14)}<span>${esc(x.texto)}</span><kbd>${esc(x.atalho)}</kbd></button>`).join("");
  m.onclick = (ev) => { const b = ev.target.closest("button[data-n]"); if (!b || b.disabled) return; fecharMenuTl(); itens[Number(b.dataset.n)].acao(); };
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.min(e.clientX, innerWidth - r.width - 8)}px`;
  m.style.top = `${Math.max(8, Math.min(e.clientY, innerHeight - r.height - 8))}px`;
  m.querySelector("button:not([disabled])")?.focus();
}

// ---------- alterações: pelos formulários ou pela timeline, com desfazer ----------
function guardarHistorico(forcar = false) {
  const agora = Date.now();
  // escrever num campo junta-se numa só entrada (até 1,5 s entre teclas)
  if (!forcar && agora - ED.ultimoPush < 1500) { ED.ultimoPush = agora; return; }
  ED.desfazer.push(JSON.stringify(ED.roteiro));
  if (ED.desfazer.length > 80) ED.desfazer.shift();
  ED.refazer = []; ED.ultimoPush = agora;
}
let edTemporizador = null;
function aoEditarFormulario() {
  if (!ED.aberto) return;
  clearTimeout(edTemporizador);
  edTemporizador = setTimeout(() => {
    let r;
    try { r = lerEditor(); } catch { return; } // JSON a meio de escrever: espera
    if (JSON.stringify(r) === JSON.stringify(ED.roteiro)) return;
    guardarHistorico();
    ED.roteiro = roteiroAberto = r;
    ED.sujo = true; estadoGuardado();
    ED.manifest = manifestDe(r); ED.player?.atualizar(ED.manifest); desenharTimeline();
  }, 350);
}
// uma mudança feita na timeline: lê o formulário, aplica, redesenha o formulário, o player e a timeline
async function mudar(fn) {
  try { ED.roteiro = roteiroAberto = lerEditor(); } catch (e) { return toast(e.message, "triangle-alert"); }
  guardarHistorico(true);
  fn(ED.roteiro);
  roteiroAberto = ED.roteiro;
  ED.sujo = true; estadoGuardado();
  await abrirEditor(ED.id, ED.roteiro);
}
async function voltarA(texto) {
  ED.roteiro = roteiroAberto = JSON.parse(texto);
  ED.sujo = true; estadoGuardado();
  if (ED.sel.i >= ED.roteiro.cenas.length) ED.sel = { tipo: "cena", i: 0 };
  await abrirEditor(ED.id, ED.roteiro);
}
function desfazerEd() { if (!ED.desfazer.length) return toast("Nada para desfazer", "undo-2"); ED.refazer.push(JSON.stringify(ED.roteiro)); voltarA(ED.desfazer.pop()); }
function refazerEd() { if (!ED.refazer.length) return toast("Nada para refazer", "redo-2"); ED.desfazer.push(JSON.stringify(ED.roteiro)); voltarA(ED.refazer.pop()); }
function estadoGuardado() {
  $("#edicaoEstado").textContent = ED.sujo ? "Alterações por salvar" : "Tudo salvo";
  $("#edicaoEstado").classList.toggle("sujo", ED.sujo);
  $("#edBtnDesfazer").disabled = !ED.desfazer.length; $("#edBtnRefazer").disabled = !ED.refazer.length;
}
async function salvarEdicao(renderizar = false) {
  try {
    ED.roteiro = roteiroAberto = lerEditor();
    await api(`/api/roteiros/${ED.id}`, { method: "PUT", body: ED.roteiro });
    ED.sujo = false; estadoGuardado();
    if (renderizar) { fecharEdicao(true); await produzir(ED.id); } else toast("Salvo", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- timeline ----------
const COR_TIPO = { lowpoly: "#7c5cff", tipografia: "#e0533f", palavras: "#e0533f", numero: "#f2b84b", dado: "#f2b84b", fato: "#2fa4e7", faixa: "#2fa4e7", print: "#2fa4e7", modelo3d: "#3ccf8e", gancho: "#ff6aa2", cta: "#ff6aa2", clipe: "#4b5563", quiz: "#f2b84b", produto: "#2fa4e7" };
const nomeSomEd = (id) => SONS_MEME.find(([v]) => v === id)?.[1] ?? id;
const nomeEntrada = (c) => (!c.somEntrada ? "whoosh" : c.somEntrada === "nenhum" ? "sem som" : nomeSomEd(c.somEntrada));
const seg = (f) => f / ED.fps;
const xDe = (s) => s * ED.pxSeg;
const tempoTL = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0").replace(".", ",")}`;
const PASSOS_REGUA = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const rotuloRegua = (s, frac) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${frac ? r.toFixed(1).padStart(4, "0").replace(".", ",") : String(Math.round(r)).padStart(2, "0")}`; };
// os canvas não podem ser enormes (o navegador recusa larguras muito grandes): com muito zoom, o desenho é esticado
const larguraCanvas = (w) => Math.max(2, Math.min(16000, Math.round(w)));
function desenharTimeline() {
  if (!ED.aberto || !ED.manifest) return;
  const m = ED.manifest, total = seg(ED.total), L = Math.max(xDe(total) + 160, $("#edTlRolar").clientWidth);
  const ini = (i) => seg(ED.inicios[i]);
  const bloco = (cls, x, w, html, attrs = "") => `<div class="tl-bloco ${cls}" style="left:${x}px;width:${Math.max(4, w)}px" ${attrs}>${html}</div>`;
  // régua (como no rea-capcut): o intervalo entre rótulos adapta-se ao zoom (pelo menos ~76 px), com marcas menores pelo meio
  const passo = PASSOS_REGUA.find((n) => n * ED.pxSeg >= 76) ?? 1200, partes = [0.1, 0.5, 1, 5, 10, 60, 300, 600].includes(passo) ? 5 : passo === 15 ? 3 : 2;
  const sub = passo / partes, frac = passo < 1;
  let regua = "";
  for (let j = 0; j * sub <= total + passo; j++) {
    const s = j * sub, maior = j % partes === 0;
    regua += `<span class="tl-marca ${maior ? "" : "menor"}" style="left:${xDe(s)}px">${maior ? rotuloRegua(s, frac) : ""}</span>`;
  }
  const cenas = m.cenas.map((c, i) => {
    const w = xDe(seg(window.PlayerEstudio.framesDaCena(c)));
    const nome = NOME_CENA[c.tipo] ?? c.tipo, texto = c.titulo ?? c.texto_tela ?? c.nome ?? normFala(c.fala).slice(0, 60);
    return bloco(`tl-cena ${ED.sel.tipo === "cena" && ED.sel.i === i ? "sel" : ""} ${c.porNarrar ? "por-narrar" : ""}`, xDe(ini(i)), w - 2,
      `<b>${i + 1}. ${esc(nome)}${temEfeitos(c) ? ` <i class="tl-fx" title="Com efeitos: ${esc(resumoEfeitos(c))}">fx</i>` : ""}</b><span>${esc(texto)}</span>`, `data-i="${i}" data-arr="cena" style="--cor:${COR_TIPO[c.tipo] ?? "#666"}" title="${esc(nome)}: ${esc(texto)}"`);
  }).join("");
  const apoios = m.cenas.flatMap((c, i) => (c.broll ?? []).map((b, k) => bloco(`tl-apoio ${ED.sel.tipo === "apoio" && ED.sel.i === i && ED.sel.k === k ? "sel" : ""}`,
    xDe(ini(i) + b.inicioMs / 1000), xDe((b.fimMs - b.inicioMs) / 1000),
    `<i class="tl-borda esq" data-borda="ini"></i><span>${esc(nomeApoio(b))}</span><i class="tl-borda dir" data-borda="fim"></i>`, `data-i="${i}" data-k="${k}" data-arr="apoio" title="${esc(nomeApoio(b))}: ${segApoio(b.inicioMs)} a ${segApoio(b.fimMs)} s"`))).join("");
  const legendas = m.cenas.flatMap((c, i) => (c.palavras ?? []).map((p, k) => `<span class="tl-palavra ${c.tipo === "clipe" ? "editavel" : ""}" style="left:${xDe(ini(i) + p.inicioMs / 1000)}px;max-width:${Math.max(14, xDe((p.fimMs - p.inicioMs) / 1000) + 6)}px" data-i="${i}" data-k="${k}" title="${esc(p.texto)}${c.tipo === "clipe" ? " (duplo clique para corrigir)" : ""}">${esc(p.texto)}</span>`)).join("");
  // sons: os postos à mão (arrastáveis) e, no início de cada cena, o som de entrada e os automáticos dela (clique para trocar)
  const sons = m.cenas.flatMap((c, i) => [
    `<span class="tl-som entrada ${ED.sel.tipo === "entrada" && ED.sel.i === i ? "sel" : ""} ${c.somEntrada === "nenhum" && i ? "mudo" : ""}" style="left:${xDe(ini(i))}px" data-i="${i}" data-arr="entrada" title="${i ? `Entrada da cena ${i + 1}: ${esc(nomeEntrada(c))}` : "Sons automáticos da cena 1"}. Clique para trocar.">${ic(i && c.somEntrada !== "nenhum" ? "wind" : "settings-2", 12)}<span>${i ? esc(nomeEntrada(c)) : "auto"}${c.trocaSons && Object.keys(c.trocaSons).length ? " ·" : ""}</span></span>`,
    ...(c.sons ?? []).map((s, k) => `<span class="tl-som ${ED.sel.tipo === "som" && ED.sel.i === i && ED.sel.k === k ? "sel" : ""}" style="left:${xDe(ini(i) + s.emMs / 1000)}px" data-i="${i}" data-k="${k}" data-arr="som" title="${esc(nomeSomEd(s.nome))}${s.volume && s.volume !== 1 ? ` (${Math.round(s.volume * 100)}%)` : ""}">${ic("audio-lines", 12)}<span>${esc(nomeSomEd(s.nome))}</span></span>`),
  ]).join("");
  const voz = m.cenas.map((c, i) => { const w = Math.max(2, xDe(seg(window.PlayerEstudio.framesDaCena(c))) - 2); return `<canvas class="tl-onda" data-audio="${esc(c.audio ?? "")}" data-i="${i}" style="left:${xDe(ini(i))}px;width:${w}px" width="${larguraCanvas(w)}" height="40"></canvas>`; }).join("");
  const musica = m.musica ? `<div class="tl-bloco tl-musica ${ED.sel.tipo === "musica" ? "sel" : ""}" style="left:0;width:${xDe(total)}px" data-arr="musica" title="Arraste para escolher o trecho da música">
      <canvas class="tl-onda-musica" width="${larguraCanvas(xDe(total))}" height="40"></canvas><span>${ic("music", 12)} ${esc(MUSICAS?.faixas?.find((f) => f.arquivo === m.musica)?.nome ?? m.musica.split("/").pop())} · desde ${tempoTL(m.musicaInicio ?? 0)}</span></div>` : `<span class="tl-vazio">Sem música</span>`;
  $("#edTlFaixas").style.width = `${L}px`;
  $("#edTlFaixas").innerHTML = `
    <div class="tl-regua" data-faixa="regua">${regua}</div>
    <div class="tl-faixa" data-faixa="cenas">${cenas}</div>
    <div class="tl-faixa curta" data-faixa="apoios">${apoios}</div>
    <div class="tl-faixa curta" data-faixa="legendas">${legendas}</div>
    <div class="tl-faixa curta" data-faixa="sons">${sons}</div>
    <div class="tl-faixa curta" data-faixa="voz">${voz}</div>
    <div class="tl-faixa curta" data-faixa="musica">${musica}</div>
    <div class="tl-cabeca" id="edTlCabeca"><i></i></div>`;
  $("#edTempoTotal").textContent = tempoTL(total);
  moverCabeca(ED.player?.frame() ?? 0);
  desenharOndas();
}
function marcarSelecao() {
  document.querySelectorAll("#edTlFaixas .sel").forEach((x) => x.classList.remove("sel"));
  const s = ED.sel;
  const alvo = s.tipo === "cena" ? `.tl-cena[data-i="${s.i}"]` : s.tipo === "apoio" ? `.tl-apoio[data-i="${s.i}"][data-k="${s.k}"]` : s.tipo === "som" ? `.tl-som[data-arr="som"][data-i="${s.i}"][data-k="${s.k}"]` : s.tipo === "entrada" ? `.tl-som.entrada[data-i="${s.i}"]` : s.tipo === "musica" ? ".tl-musica" : null;
  if (alvo) document.querySelector(`#edTlFaixas ${alvo}`)?.classList.add("sel");
}
function moverCabeca(frame) {
  const cab = $("#edTlCabeca");
  if (!cab) return;
  const x = xDe(seg(frame));
  cab.style.transform = `translateX(${x}px)`;
  $("#edTempoAtual").textContent = tempoTL(seg(frame));
  // a timeline acompanha a cabeça de leitura, por páginas (a tocar ou a andar com as setas), menos enquanto se arrasta
  const rolar = $("#edTlRolar");
  if (ED.arrastar) return;
  if (x > rolar.scrollLeft + rolar.clientWidth - 32) rolar.scrollLeft = Math.max(0, x - rolar.clientWidth * 0.3);
  else if (x < rolar.scrollLeft) rolar.scrollLeft = Math.max(0, x - rolar.clientWidth * 0.7);
}
// ondas da narração (por cena) e da música (o trecho escolhido), lidas com a Web Audio API e guardadas em memória
async function picosDe(caminho, pontos = 4000) {
  if (ED.picos.has(caminho)) return ED.picos.get(caminho);
  const promessa = (async () => {
    const buf = await fetch(`/public/${caminho}`).then((r) => { if (!r.ok) throw new Error(); return r.arrayBuffer(); });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ctx.decodeAudioData(buf); ctx.close();
    const dados = audio.getChannelData(0), passo = Math.max(1, Math.floor(dados.length / pontos)), picos = new Float32Array(Math.ceil(dados.length / passo));
    for (let j = 0; j < picos.length; j++) { let mx = 0; for (let k = j * passo; k < Math.min(dados.length, (j + 1) * passo); k++) mx = Math.max(mx, Math.abs(dados[k])); picos[j] = mx; }
    return { picos, duracao: audio.duration };
  })().catch(() => null);
  ED.picos.set(caminho, promessa);
  return promessa;
}
function pintarOnda(canvas, info, desde = 0, ate = info.duracao) {
  const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = getComputedStyle(canvas).color;
  const n = info.picos.length, porSeg = n / info.duracao;
  for (let x = 0; x < W; x++) {
    const t = desde + ((ate - desde) * x) / W, j = Math.floor(t * porSeg);
    if (j < 0 || j >= n) continue;
    const h = Math.max(1, info.picos[j] * (H - 2));
    g.fillRect(x, (H - h) / 2, 1, h);
  }
}
async function desenharOndas() {
  document.querySelectorAll("#edTlFaixas .tl-onda").forEach(async (cv) => {
    if (!cv.dataset.audio) return;
    const info = await picosDe(cv.dataset.audio);
    if (info && cv.isConnected) pintarOnda(cv, info);
  });
  const cvm = document.querySelector("#edTlFaixas .tl-onda-musica");
  if (cvm && ED.manifest.musica) {
    const info = await picosDe(ED.manifest.musica, 20000);
    if (info && cvm.isConnected) pintarOnda(cvm, info, ED.manifest.musicaInicio ?? 0, (ED.manifest.musicaInicio ?? 0) + seg(ED.total));
  }
}
// ---------- navegação: zoom (botões, slider, Ctrl e a roda à volta do rato), ajustar ao vídeo todo ----------
const ZOOM_MIN = 1, ZOOM_MAX = 400;
// zoom para pxSeg píxeis por segundo, mantendo parado o instante que está debaixo de ancora (px desde a borda esquerda da faixa visível)
function zoomAbsoluto(px, ancora) {
  const rolar = $("#edTlRolar");
  if (ancora === undefined) ancora = rolar.clientWidth / 2;
  const t = (rolar.scrollLeft + ancora) / ED.pxSeg;
  ED.pxSeg = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, px));
  desenharTimeline();
  rolar.scrollLeft = Math.max(0, t * ED.pxSeg - ancora);
  sincronizarZoom();
}
const zoomTimeline = (fator, ancora) => zoomAbsoluto(ED.pxSeg * fator, ancora);
// o slider é logarítmico: cada passo aproxima na mesma proporção
const zoomPara = (v) => zoomAbsoluto(ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, Number(v) / 1000));
function sincronizarZoom() {
  const z = $("#edZoom");
  if (z) z.value = String(Math.round((1000 * Math.log(ED.pxSeg / ZOOM_MIN)) / Math.log(ZOOM_MAX / ZOOM_MIN)));
}
function ajustarTimeline() {
  const rolar = $("#edTlRolar"), total = Math.max(1, seg(ED.total));
  ED.pxSeg = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (rolar.clientWidth - 40) / total));
  desenharTimeline();
  rolar.scrollLeft = 0;
  sincronizarZoom();
}
// saltar para o início da cena anterior ou seguinte (↑ e ↓, como no CapCut)
function saltarCena(dir) {
  const f = ED.player?.frame() ?? 0, marcas = [...ED.inicios, ED.total - 1];
  const alvo = dir > 0 ? marcas.find((x) => x > f) : [...marcas].reverse().find((x) => x < f);
  if (alvo !== undefined) ED.player?.irPara(alvo);
}
// ao arrastar perto das bordas, a timeline rola sozinha
function rolarNasBordas(e) {
  const rolar = $("#edTlRolar"), r = rolar.getBoundingClientRect();
  if (e.clientX > r.right - 28) rolar.scrollLeft += 14;
  else if (e.clientX < r.left + 20) rolar.scrollLeft -= 14;
}

// ---------- tamanho dos painéis (como no rea-capcut): altura da timeline e largura do inspetor, lembrados neste navegador ----------
const TL_BASE = 22 + 46 + 30 * 5; // régua + faixas na altura mínima
const lerPref = (k) => { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } };
const gravarPref = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(Math.round(v))); } catch { /* sem preferências, o tamanho vale só agora */ } };
function alturaTimeline(h, gravar = false) {
  const tl = document.querySelector("#dlgEdicao .ed-tl");
  const alt = Math.round(Math.max(TL_BASE, Math.min(Math.max(TL_BASE, window.innerHeight - 300), h ?? lerPref("ed-altura-tl") ?? 236)));
  tl.style.height = `${alt}px`;
  // as faixas crescem com a timeline (a régua fica igual)
  tl.style.setProperty("--f", String((alt - 22) / (TL_BASE - 22)));
  $("#edRedimTl").setAttribute("aria-valuenow", String(alt));
  if (gravar) gravarPref("ed-altura-tl", alt);
  return alt;
}
function larguraLado(w, gravar = false) {
  const meio = document.querySelector("#dlgEdicao .ed-meio"), lado = document.querySelector("#dlgEdicao .ed-lado");
  if (w === undefined) w = lerPref("ed-largura-lado");
  if (w == null) meio.style.removeProperty("--lado");
  else meio.style.setProperty("--lado", `${Math.round(Math.max(300, Math.min(meio.clientWidth - 360, w)))}px`);
  $("#edRedimLado").style.right = `${lado.offsetWidth - 4}px`;
  if (gravar) gravarPref("ed-largura-lado", w == null ? null : lado.offsetWidth);
  return lado.offsetWidth;
}
// uma alça de redimensionar: arrastar, setas (Shift: passo maior), duplo clique ou Home repõem o tamanho de origem
function ligarAlca(el, eixo, obter, aplicar, repor) {
  const delta = (i, e) => (eixo === "y" ? i.p - e.clientY : i.p - e.clientX);
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); el.focus();
    el._ini = { p: eixo === "y" ? e.clientY : e.clientX, v: obter() };
    el.setPointerCapture(e.pointerId); el.classList.add("ativo");
  });
  el.addEventListener("pointermove", (e) => { if (el._ini) aplicar(el._ini.v + delta(el._ini, e)); });
  const fim = (e) => {
    if (!el._ini) return;
    aplicar(el._ini.v + delta(el._ini, e), true);
    el._ini = null; el.classList.remove("ativo");
  };
  el.addEventListener("pointerup", fim);
  el.addEventListener("pointercancel", () => { el._ini = null; el.classList.remove("ativo"); });
  el.addEventListener("dblclick", repor);
  el.addEventListener("keydown", (e) => {
    const dir = eixo === "y" ? { ArrowUp: 1, ArrowDown: -1 }[e.key] : { ArrowLeft: 1, ArrowRight: -1 }[e.key];
    if (dir) { e.preventDefault(); e.stopPropagation(); aplicar(obter() + dir * (e.shiftKey ? 60 : 20), true); }
    else if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); repor(); }
  });
}

// ---------- rato na timeline: clicar salta, arrastar move e apara ----------
function tempoNoRato(e) { const r = $("#edTlFaixas").getBoundingClientRect(); return Math.max(0, (e.clientX - r.left) / ED.pxSeg); }
// encaixe: o início e o fim das palavras da cena e a cabeça de leitura (até 8 px)
function encaixar(sCena, i, ms) {
  if (!ED.encaixe) return ms;
  const alvos = [...(ED.manifest.cenas[i].palavras ?? []).flatMap((p) => [p.inicioMs, p.fimMs]), (seg(ED.player?.frame() ?? 0) - sCena) * 1000];
  const lim = (8 / ED.pxSeg) * 1000;
  let melhor = ms, d = lim;
  for (const a of alvos) if (Math.abs(a - ms) < d) { d = Math.abs(a - ms); melhor = a; }
  return Math.round(melhor);
}
function aoPremirTimeline(e) {
  // botão do meio: arrastar a timeline para os lados
  if (e.button === 1) {
    e.preventDefault();
    ED.arrastar = { tipo: "panear", x0: e.clientX, sc0: $("#edTlRolar").scrollLeft };
    $("#edTlFaixas").setPointerCapture?.(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  const el = e.target.closest("[data-arr]");
  const s = tempoNoRato(e);
  // fora de um bloco (régua ou espaço vazio): saltar, e continuar a arrastar a cabeça de leitura enquanto o botão está premido
  if (!el) {
    ED.player?.irPara(s * ED.fps);
    ED.arrastar = { tipo: "esfregar" };
    $("#edTlFaixas").setPointerCapture?.(e.pointerId);
    return;
  }
  const tipo = el.dataset.arr, i = Number(el.dataset.i), k = Number(el.dataset.k);
  if (tipo === "cena") selecionar({ tipo: "cena", i }, false);
  if (tipo === "apoio") selecionar({ tipo: "apoio", i, k }, false);
  if (tipo === "som") selecionar({ tipo: "som", i, k }, false);
  if (tipo === "entrada") {
    selecionar({ tipo: "entrada", i }, false);
    if (!i || ED.roteiro.cenas[i].somEntrada === "nenhum") { ED.player?.irPara(ED.inicios[i] ?? 0); e.preventDefault(); return; }
  }
  if (tipo === "musica") selecionar({ tipo: "musica" }, false);
  ED.arrastar = { tipo, i, k, el, x0: e.clientX, sc0: $("#edTlRolar").scrollLeft, s0: s, borda: e.target.dataset.borda ?? null, mexeu: false };
  el.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}
function aoMoverTimeline(e) {
  const a = ED.arrastar;
  if (!a) return;
  if (a.tipo === "panear") { $("#edTlRolar").scrollLeft = a.sc0 - (e.clientX - a.x0); return; }
  if (a.tipo === "esfregar") { rolarNasBordas(e); ED.player?.irPara(tempoNoRato(e) * ED.fps); return; }
  // o que a timeline rolou sozinha durante o arrasto também conta
  const dx = e.clientX - a.x0 + ($("#edTlRolar").scrollLeft - a.sc0);
  if (a.mexeu || Math.abs(dx) >= 4) rolarNasBordas(e);
  if (!a.mexeu && Math.abs(dx) < 4) return;
  a.mexeu = true;
  const ds = dx / ED.pxSeg, cena = ED.manifest.cenas[a.i];
  if (a.tipo === "entrada") {
    const abs = Math.max(0, Math.min(seg(ED.total) - 0.05, seg(ED.inicios[a.i]) + ds)), j = cenaEm(abs), sJ = seg(ED.inicios[j]);
    const ms = Math.max(0, Math.round(encaixar(sJ, j, (abs - sJ) * 1000)));
    a.novo = { j, ms }; a.el.style.left = `${xDe(sJ + ms / 1000)}px`; a.el.classList.add("a-arrastar");
    return;
  }
  if (a.tipo === "apoio") {
    const b = cena.broll[a.k], dur = cena.duracaoMs ?? 0, sCena = seg(ED.inicios[a.i]);
    let ini = b.inicioMs, fim = b.fimMs;
    if (a.borda === "ini") ini = Math.min(fim - 300, Math.max(0, encaixar(sCena, a.i, b.inicioMs + ds * 1000)));
    else if (a.borda === "fim") fim = Math.max(ini + 300, Math.min(dur, encaixar(sCena, a.i, b.fimMs + ds * 1000)));
    else {
      // mover: pode ir para outro corte (cena de clipe); noutras cenas fica onde estava
      const len = fim - ini, abs = sCena + (b.inicioMs + ds * 1000) / 1000;
      let j = cenaEm(abs + len / 2000);
      if (ED.manifest.cenas[j]?.tipo !== "clipe") j = a.i;
      const sJ = seg(ED.inicios[j]), durJ = ED.manifest.cenas[j].duracaoMs ?? dur;
      ini = Math.min(durJ - len, Math.max(0, encaixar(sJ, j, (abs - sJ) * 1000))); fim = ini + len;
      a.novo = { ini, fim, j };
      a.el.style.left = `${xDe(sJ + ini / 1000)}px`;
      a.el.title = `${j !== a.i ? `Corte ${j + 1}: ` : ""}${segApoio(ini)} a ${segApoio(fim)} s`;
      return;
    }
    a.novo = { ini, fim, j: a.i };
    a.el.style.left = `${xDe(sCena + ini / 1000)}px`; a.el.style.width = `${xDe((fim - ini) / 1000)}px`;
    a.el.title = `${segApoio(ini)} a ${segApoio(fim)} s`;
  } else if (a.tipo === "som") {
    const abs = Math.max(0, Math.min(seg(ED.total) - 0.05, seg(ED.inicios[a.i]) + cena.sons[a.k].emMs / 1000 + ds));
    const j = cenaEm(abs), sJ = seg(ED.inicios[j]);
    const ms = Math.max(0, Math.round(encaixar(sJ, j, (abs - sJ) * 1000)));
    a.novo = { j, ms }; a.el.style.left = `${xDe(sJ + ms / 1000)}px`;
    a.el.title = `${nomeSomEd(cena.sons[a.k].nome)}: cena ${j + 1}, aos ${(ms / 1000).toFixed(2)} s`;
  } else if (a.tipo === "cena") {
    a.el.style.transform = `translateX(${dx}px)`; a.el.classList.add("a-arrastar");
    // onde cai: antes da primeira cena cujo meio fica à direita do rato
    const s = tempoNoRato(e);
    let alvo = ED.manifest.cenas.length;
    for (let j = 0; j < ED.manifest.cenas.length; j++) { const meio = seg(ED.inicios[j]) + seg(window.PlayerEstudio.framesDaCena(ED.manifest.cenas[j])) / 2; if (s < meio) { alvo = j; break; } }
    a.novo = alvo;
    const xm = alvo < ED.inicios.length ? xDe(seg(ED.inicios[alvo])) : xDe(seg(ED.total));
    let ind = document.querySelector(".tl-inserir");
    if (!ind) { ind = document.createElement("i"); ind.className = "tl-inserir"; $("#edTlFaixas").append(ind); }
    ind.style.left = `${xm}px`;
  } else if (a.tipo === "musica") {
    const novo = Math.max(0, Math.round(((ED.roteiro.musicaInicio ?? 0) - ds) * 10) / 10);
    a.novo = novo;
    a.el.querySelector("span").lastChild.textContent = ` · desde ${tempoTL(novo)}`;
    const cvm = a.el.querySelector("canvas"), info = ED.picos.get(ED.manifest.musica);
    info?.then((x) => x && pintarOnda(cvm, x, novo, novo + seg(ED.total)));
  }
}
async function aoLargarTimeline(e) {
  const a = ED.arrastar;
  ED.arrastar = null;
  document.querySelector(".tl-inserir")?.remove();
  if (!a || a.tipo === "panear" || a.tipo === "esfregar") return;
  if (!a.mexeu) { if (a.tipo === "entrada") ED.player?.irPara(ED.inicios[a.i] ?? 0); else if (a.tipo !== "musica") ED.player?.irPara(a.s0 * ED.fps); return; }
  if (a.tipo === "entrada" && a.novo) {
    await mudar((r) => {
      const de = r.cenas[a.i], nome = de.somEntrada || "whoosh", para = r.cenas[a.novo.j], som = { nome, emMs: a.novo.ms };
      de.somEntrada = "nenhum";
      (para.sons ??= []).push(som); para.sons.sort((x, y) => x.emMs - y.emMs);
      ED.sel = { tipo: "som", i: a.novo.j, k: para.sons.indexOf(som) };
    });
    aplicarInspetor(); marcarSelecao();
    return toast(`${nomeSomEd(ED.roteiro.cenas[ED.sel.i].sons[ED.sel.k].nome)} movido: agora é um som livre (a entrada da cena ${a.i + 1} ficou sem som)`, "audio-lines");
  }
  if (a.novo === undefined) return desenharTimeline();
  if (a.tipo === "apoio") await mudar((r) => {
    const de = r.cenas[a.i], para = r.cenas[a.novo.j], b = de.broll[a.k];
    b.inicioMs = a.novo.ini; b.fimMs = a.novo.fim;
    if (para !== de) { de.broll.splice(a.k, 1); (para.broll ??= []).push(b); }
    para.broll.sort((x, y) => x.inicioMs - y.inicioMs);
    ED.sel = { tipo: "apoio", i: a.novo.j, k: para.broll.indexOf(b) };
  });
  if (a.tipo === "som") await mudar((r) => {
    const de = r.cenas[a.i], [s] = de.sons.splice(a.k, 1), para = r.cenas[a.novo.j];
    if (!de.sons.length) delete de.sons;
    s.emMs = a.novo.ms; (para.sons ??= []).push(s); para.sons.sort((x, y) => x.emMs - y.emMs);
    ED.sel = { tipo: "som", i: a.novo.j, k: para.sons.indexOf(s) };
  });
  if (a.tipo === "musica") await mudar((r) => { r.musicaInicio = a.novo || undefined; });
  if (a.tipo === "cena" && a.novo !== a.i && a.novo !== a.i + 1) {
    const destino = a.novo > a.i ? a.novo - 1 : a.novo;
    await mudar((r) => { const [c] = r.cenas.splice(a.i, 1); r.cenas.splice(destino, 0, c); });
    ED.sel = { tipo: "cena", i: destino }; aplicarInspetor(); marcarSelecao();
    toast(`Cena movida para a posição ${destino + 1}`, "check");
  } else if (a.tipo === "cena") desenharTimeline();
}
// duplo clique numa palavra das legendas de um corte: corrigir o texto
async function corrigirPalavra(e) {
  const el = e.target.closest(".tl-palavra.editavel");
  if (!el) return;
  const i = Number(el.dataset.i), k = Number(el.dataset.k), p = ED.roteiro.cenas[i].palavras?.[k];
  if (!p) return;
  const novo = prompt("Corrigir a legenda:", p.texto);
  if (novo === null || !novo.trim() || novo.trim() === p.texto) return;
  await mudar((r) => { r.cenas[i].palavras[k].texto = novo.trim(); });
}

// ---------- operações (botões e atalhos) ----------
async function apagarSelecao() {
  const s = ED.sel;
  if (s.tipo === "apoio") await mudar((r) => r.cenas[s.i].broll.splice(s.k, 1));
  else if (s.tipo === "som") await mudar((r) => { const c = r.cenas[s.i]; c.sons.splice(s.k, 1); if (!c.sons.length) delete c.sons; });
  else if (s.tipo === "cena") {
    if (ED.roteiro.cenas.length < 2) return toast("O vídeo precisa de pelo menos uma cena", "triangle-alert");
    if (!confirm(`Apagar a cena ${s.i + 1}?`)) return;
    await mudar((r) => r.cenas.splice(s.i, 1));
  } else return;
  ED.sel = { tipo: "cena", i: Math.min(s.i, ED.roteiro.cenas.length - 1) };
  aplicarInspetor(); marcarSelecao();
}
async function duplicarSelecao() {
  const s = ED.sel;
  if (s.tipo === "apoio") await mudar((r) => { const c = r.cenas[s.i], b = structuredClone(c.broll[s.k]), len = b.fimMs - b.inicioMs; b.inicioMs = Math.min(b.fimMs, (c.duracaoMs ?? b.fimMs + len) - len); b.fimMs = b.inicioMs + len; c.broll.splice(s.k + 1, 0, b); });
  else if (s.tipo === "cena") await mudar((r) => r.cenas.splice(s.i + 1, 0, structuredClone(r.cenas[s.i])));
  else if (s.tipo === "som") await mudar((r) => { const c = r.cenas[s.i], x = structuredClone(c.sons[s.k]); x.emMs = Math.min(c.duracaoMs ?? x.emMs + 500, x.emMs + 500); c.sons.splice(s.k + 1, 0, x); ED.sel = { tipo: "som", i: s.i, k: s.k + 1 }; });
}
// dividir o apoio escolhido na cabeça de leitura (S)
async function dividirSelecao() {
  const s = ED.sel;
  if (s.tipo !== "apoio") return toast("Escolha um apoio na timeline para o dividir", "scissors");
  const ms = Math.round((seg(ED.player.frame()) - seg(ED.inicios[s.i])) * 1000), b = ED.roteiro.cenas[s.i].broll[s.k];
  if (ms <= b.inicioMs + 300 || ms >= b.fimMs - 300) return toast("Ponha a cabeça de leitura no meio do apoio", "scissors");
  await mudar((r) => { const x = r.cenas[s.i].broll[s.k], y = structuredClone(x); x.fimMs = ms; y.inicioMs = ms; r.cenas[s.i].broll.splice(s.k + 1, 0, y); });
}
function aoTeclarEdicao(e) {
  if (!ED.aberto) return;
  const escrever = e.target.closest?.("input, textarea, select, [contenteditable]");
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "z" && !escrever) { e.preventDefault(); return e.shiftKey ? refazerEd() : desfazerEd(); }
  if (ctrl && e.key.toLowerCase() === "y" && !escrever) { e.preventDefault(); return refazerEd(); }
  if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); return salvarEdicao(); }
  if (ctrl && e.key.toLowerCase() === "c" && !escrever) { e.preventDefault(); return copiarSelecao(); }
  if (ctrl && e.key.toLowerCase() === "v" && !escrever) { e.preventDefault(); return colarEm(seg(ED.player?.frame() ?? 0)); }
  if (escrever) return;
  const passo = e.shiftKey ? ED.fps : 1;
  if (e.key === " ") { e.preventDefault(); ED.player?.alternar(e); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); ED.player?.irPara(ED.player.frame() - passo); }
  else if (e.key === "ArrowRight") { e.preventDefault(); ED.player?.irPara(ED.player.frame() + passo); }
  else if (e.key === "Home") ED.player?.irPara(0);
  else if (e.key === "End") ED.player?.irPara(ED.total - 1);
  else if (e.key === "Escape" && !$("#edMenuTl")?.hidden) { e.preventDefault(); fecharMenuTl(); }
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); apagarSelecao(); }
  else if (e.key.toLowerCase() === "s") dividirSelecao();
  else if (e.key.toLowerCase() === "d") duplicarSelecao();
  else if (e.key === "ArrowUp") { e.preventDefault(); saltarCena(-1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); saltarCena(1); }
  else if (e.key === "+" || e.key === "=") zoomTimeline(1.25);
  else if (e.key === "-") zoomTimeline(0.8);
  else if (e.key === "Z" && e.shiftKey) ajustarTimeline();
}

// ligações
document.addEventListener("keydown", aoTeclarEdicao);
(() => {
  const faixas = document.getElementById("edTlFaixas");
  faixas.addEventListener("pointerdown", aoPremirTimeline);
  window.addEventListener("pointermove", aoMoverTimeline);
  window.addEventListener("pointerup", aoLargarTimeline);
  faixas.addEventListener("dblclick", corrigirPalavra);
  faixas.addEventListener("contextmenu", abrirMenuTl);
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#edMenuTl")) fecharMenuTl(); });
  faixas.addEventListener("dblclick", (e) => { if (e.target.closest('[data-faixa="sons"]') && !e.target.closest(".tl-som")) escolherSomPara(tempoNoRato(e)); });
  const rolar = document.getElementById("edTlRolar");
  // a roda: Ctrl (ou o gesto de pinça) aproxima à volta do rato; sem Ctrl, rola a timeline para os lados
  rolar.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomTimeline(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), e.clientX - rolar.getBoundingClientRect().left);
    } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      rolar.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 30 : 1);
    }
  }, { passive: false });
  rolar.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }); // sem o rolar automático do Windows
  ligarAlca($("#edRedimTl"), "y", () => document.querySelector("#dlgEdicao .ed-tl").offsetHeight, (v, g) => alturaTimeline(v, g), () => { gravarPref("ed-altura-tl", null); alturaTimeline(236); });
  ligarAlca($("#edRedimLado"), "x", () => document.querySelector("#dlgEdicao .ed-lado").offsetWidth, (v, g) => larguraLado(v, g), () => { gravarPref("ed-largura-lado", null); larguraLado(null); });
  const insp = document.getElementById("edicaoInspetor");
  insp.addEventListener("input", aoEditarFormulario);
  insp.addEventListener("change", aoEditarFormulario);
  insp.addEventListener("click", (e) => { if (e.target.closest(".mini-op, .lp-linha .btn, .lp .btn")) aoEditarFormulario(); });
  // esc fecha o diálogo nativo: passa pela pergunta das alterações por salvar
  document.getElementById("dlgEdicao").addEventListener("cancel", (e) => { e.preventDefault(); fecharEdicao(); });
  window.addEventListener("resize", () => { if (!ED.aberto) return; alturaTimeline(document.querySelector("#dlgEdicao .ed-tl").offsetHeight); larguraLado(); desenharTimeline(); });
})();
