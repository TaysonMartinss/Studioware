// ---------- Instagram: contas ligadas pela API oficial da Meta, números, comentários e publicar Reels ----------
// Usa as funções do painel.js ($, esc, ic, api, toast, esperarTarefa, milhares, quandoCusto, OPCOES, videosCache).
const videosCacheIg = () => (typeof videosCache !== "undefined" && Array.isArray(videosCache) ? videosCache : []);
let igVideos = [], igEstado = null, igConta = null, igDados = null, igPublicando = null;
const IG_MAX_HASHTAGS = 5; // limite do Instagram desde dezembro de 2025
const IG_JANELA = 125; // caracteres da legenda que o feed mostra antes do "... mais"

async function abrirInstagram() {
  const el = $("#igCorpo");
  try { igEstado = await api("/api/instagram"); } catch (e) { el.innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
  if (!igEstado.contas.some((c) => c.igId === igConta)) igConta = igEstado.contas[0]?.igId ?? null;
  igDados = null;
  if (igConta) { try { igDados = (await api(`/api/instagram/dados?conta=${igConta}`)).dados; } catch { /* sem números ainda */ } }
  desenharInstagram();
}

function desenharInstagram() {
  const el = $("#igCorpo"), e = igEstado;
  $("#btnIgPublicar").disabled = !igConta;
  $("#btnIgAtualizar").disabled = !igConta;
  if (!e.configurado) {
    el.innerHTML = `<section class="superficie ig-ajuda"><h2 class="titulo-superficie">${ic("camera", 18)} Ligar o Instagram ao estúdio</h2>
      <p>O estúdio publica e lê os números pela <b>API oficial da Meta</b> (nada de automatizar o navegador, que leva a bloqueios). Precisa de uma app de desenvolvedor da Meta, uma vez só:</p>
      <ol>
        <li>Cada conta do Instagram tem de ser <b>profissional</b> (criador ou empresa) e estar <b>ligada a uma página do Facebook</b>: no Instagram, Definições &gt; Conta &gt; Mudar para conta profissional; depois, na página do Facebook, Definições &gt; Contas ligadas &gt; Instagram.</li>
        <li>Em <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a>: <b>Criar app</b>, tipo <b>Empresa</b> (Business).</li>
        <li>Adicione os produtos <b>Facebook Login para Empresas</b> e <b>Instagram</b> (o da "API com login do Facebook").</li>
        <li>Em Facebook Login &gt; Definições, em "URIs de redirecionamento do OAuth válidos", cole: <code>${esc(e.redirect)}</code></li>
        <li>Em Definições da app &gt; Básicas, copie o <b>ID da app</b> e a <b>Chave secreta da app</b> para <a href="#configuracoes" onclick="irPara('configuracoes');return false">Configurações &gt; Chaves de API</a>.</li>
      </ol>
      <p class="meta">Com a app em modo de desenvolvimento, só as contas de quem tem uma função na app (administrador, programador ou testador) se ligam. Para as suas próprias páginas chega, e não é preciso pedir revisão à Meta.</p>
    </section>`;
    return;
  }
  const contas = e.contas;
  const seletor = contas.length ? `<div class="ig-contas">${contas.map((c) => `
      <button class="ig-conta ${c.igId === igConta ? "ativa" : ""}" onclick="mudarContaIg('${esc(c.igId)}')" title="${esc(c.pagina ? `Página: ${c.pagina}` : "")}">
        ${c.foto ? `<img src="${esc(c.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="ig-sem-foto">${ic("camera", 16)}</span>`}
        <span><b>@${esc(c.usuario)}</b><span class="meta">${c.seguidores != null ? `${milhares(c.seguidores)} seguidores` : ""}</span></span>
      </button>`).join("")}
      <button class="btn fantasma" onclick="ligarInstagram()">${ic("log-in", 15)}Ligar mais contas</button></div>` : "";
  if (!contas.length) {
    el.innerHTML = `<section class="superficie ig-ajuda"><h2 class="titulo-superficie">Nenhuma conta ligada</h2>
      <p>Clique em <b>Ligar contas</b>: o Facebook pergunta que páginas autoriza e o estúdio liga a conta do Instagram de cada uma (pode escolher várias de uma vez).</p>
      <button class="btn primario" onclick="ligarInstagram()">${ic("log-in", 16)}Ligar contas</button>
      <details class="ajuda" style="margin-top:14px"><summary>O login deu erro de URL? Ligue com um token</summary>
        <p>Abra o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a>, escolha a app em "Meta App", em "User or Page" escolha <b>Obter token do usuário</b>, adicione as permissões instagram_basic, instagram_content_publish, instagram_manage_insights, instagram_manage_comments, pages_show_list, pages_read_engagement e business_management, carregue em <b>Generate Access Token</b>, autorize as páginas e cole o token aqui. O estúdio troca-o por tokens das páginas que não expiram.</p>
        <div class="linha" style="gap:6px"><input id="igTokenManual" type="password" placeholder="Token de acesso do utilizador" autocomplete="off" style="flex:1"><button class="btn" onclick="ligarComTokenIg()">${ic("link", 15)}Ligar</button></div>
      </details></section>${blocoAgendaIg()}`;
    return;
  }
  const c = contas.find((x) => x.igId === igConta);
  const canais = Object.entries(e.canais ?? {});
  el.innerHTML = `${seletor}
    <section class="superficie ig-ficha">
      <div class="linha" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div class="ins-canal" style="margin:0">${c.foto ? `<img src="${esc(c.foto)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>@${esc(c.usuario)}</b>
          <span class="meta">${esc(c.nome ?? "")}${c.pagina ? ` · página ${esc(c.pagina)}` : ""}${c.publicacoes != null ? ` · ${milhares(c.publicacoes)} publicações` : ""}</span></div></div>
        <div class="linha" style="gap:8px;flex-wrap:wrap">
          <label class="meta" for="igCanal">Canal do estúdio</label>
          <select id="igCanal" onchange="associarContaIg(this.value)"><option value="">nenhum</option>${canais.map(([k, v]) => `<option value="${esc(k)}" ${c.canal === k ? "selected" : ""}>${esc(v.nome)}</option>`).join("")}</select>
          <button class="btn fantasma peq" onclick="desligarInstagram()">${ic("unlink", 14)}Desligar</button>
        </div>
      </div>
    </section>
    ${blocoAgendaIg()}
    ${blocoNumerosIg()}`;
}

function blocoNumerosIg() {
  const d = igDados;
  if (!d) return `<section class="superficie"><div class="vazio">Ainda sem números desta conta. Clique em <b>Atualizar números</b>.</div></section>`;
  const k = d.conta ?? {}, n = (x) => (x == null ? "—" : milhares(x));
  const kpi = (rotulo, valor, dica = "") => `<div class="custo-cartao" ${dica ? `title="${esc(dica)}"` : ""}><div class="meta">${rotulo}</div><div class="custo-valor">${valor}</div></div>`;
  const novos = (d.seguidoresDia ?? []).reduce((s, x) => s + (x.novos ?? 0), 0);
  return `
    <div class="meta" style="margin:4px 0 10px">Últimos ${d.dias} dias, atualizado ${quandoCusto(d.geradoEm)}. A Meta pode demorar até 48 h a fechar os números.</div>
    <div class="custo-grelha">
      ${kpi("Visualizações", n(k.views))}
      ${kpi("Contas alcançadas", n(k.reach), "Contas diferentes que viram pelo menos uma publicação")}
      ${kpi("Contas que interagiram", n(k.accounts_engaged))}
      ${kpi("Interações", n(k.total_interactions), "Gostos, comentários, partilhas, guardados e respostas")}
      ${kpi("Seguidores", `${milhares(d.perfil?.followers_count ?? 0)}`, d.seguidoresDia?.length ? `+${novos} nos últimos ${d.seguidoresDia.length} dias` : "")}
    </div>
    <section class="superficie"><h2 class="titulo-superficie">Publicações <span class="meta">as últimas ${d.midias.length}; clique em Comentários para ler e responder</span></h2>
      <div class="tabela-rolar"><table class="tabela ins-tabela"><thead><tr><th>Publicação</th><th>Visualizações</th><th>Alcance</th><th>Gostos</th><th>Comentários</th><th>Partilhas</th><th>Guardados</th><th>Tempo médio</th><th></th></tr></thead>
      <tbody>${d.midias.map((m) => {
        const x = m.numeros ?? {};
        return `<tr><td><div class="ins-video ig-midia">${m.miniatura ? `<img src="${esc(m.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="ig-sem-foto">${ic("image", 16)}</span>`}
          <span><a href="${esc(m.link ?? "#")}" target="_blank" rel="noopener">${esc((m.legenda || "(sem legenda)").slice(0, 90))}</a><span class="meta">${m.tipo === "REELS" ? "Reel" : m.tipo === "CAROUSEL_ALBUM" ? "Carrossel" : esc(String(m.tipo ?? "").toLowerCase())} · ${new Date(m.data).toLocaleDateString("pt-BR")}</span></span></div></td>
          <td>${n(x.views)}</td><td>${n(x.reach)}</td><td>${n(x.likes ?? m.likes)}</td><td>${n(x.comments ?? m.comentarios)}</td><td>${n(x.shares)}</td><td>${n(x.saved)}</td>
          <td>${x.ig_reels_avg_watch_time != null ? `${(x.ig_reels_avg_watch_time / 1000).toFixed(1)} s` : "—"}</td>
          <td><button class="btn fantasma peq" onclick="abrirComentariosIg('${esc(m.id)}')">${ic("message-circle", 14)}Comentários</button></td></tr>`;
      }).join("")}</tbody></table></div>
    </section>`;
}

function blocoAgendaIg() {
  const itens = (igEstado.agenda ?? []).filter((x) => !igConta || x.igId === igConta).slice().reverse();
  if (!itens.length) return "";
  const nome = (id) => `@${igEstado.contas.find((c) => c.igId === id)?.usuario ?? id}`;
  const titulo = (v) => videosCacheIg().find((x) => x.id === v)?.titulo ?? v;
  return `<section class="superficie"><h2 class="titulo-superficie">Publicações pelo estúdio <span class="meta">os agendamentos só saem com o painel aberto neste computador</span></h2>
    <div class="ig-agenda">${itens.slice(0, 15).map((x) => `<div class="ig-item">
      <div><b>${esc(titulo(x.video))}</b><div class="meta">${nome(x.igId)} · ${x.estado === "publicado" ? `publicado ${new Date(x.publicadoEm ?? x.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : `${esc(x.estado)} para ${new Date(x.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}${x.passo ? ` · ${esc(x.passo)}` : ""}${x.erro ? ` · <span class="erro-texto">${esc(x.erro)}</span>` : ""}</div></div>
      ${x.url ? `<a class="btn fantasma peq" href="${esc(x.url)}" target="_blank" rel="noopener">${ic("external-link", 14)}Ver</a>` : ""}
      ${x.estado === "agendado" ? `<button class="btn fantasma peq" onclick="cancelarAgendaIg('${esc(x.id)}')">${ic("x", 14)}Cancelar</button>` : ""}
    </div>`).join("")}</div></section>`;
}

async function mudarContaIg(id) { igConta = id; igDados = null; try { igDados = (await api(`/api/instagram/dados?conta=${id}`)).dados; } catch { /* sem números */ } desenharInstagram(); }

async function ligarInstagram() {
  try {
    const { url } = await api("/api/instagram/ligar");
    const antes = new Set(igEstado.contas.map((c) => c.igId));
    window.open(url, "_blank", "noopener");
    toast("Autorize as páginas na janela do Facebook", "log-in");
    let voltas = 0;
    const vigia = setInterval(async () => {
      if (++voltas > 100) return clearInterval(vigia);
      const e = await api("/api/instagram").catch(() => null);
      if (e && e.contas.some((c) => !antes.has(c.igId))) {
        clearInterval(vigia); igEstado = e; igConta = igConta ?? e.contas[0]?.igId; desenharInstagram();
        toast(`Instagram ligado: ${e.contas.filter((c) => !antes.has(c.igId)).map((c) => `@${c.usuario}`).join(", ")}`, "check");
      }
    }, 3000);
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function ligarComTokenIg() {
  const token = $("#igTokenManual").value.trim();
  if (!token) return toast("Cole o token primeiro", "clipboard");
  try {
    const r = await api("/api/instagram/token", { method: "POST", body: { token } });
    $("#igTokenManual").value = "";
    toast(`Instagram ligado: ${r.contas.join(", ")}`, "check");
    abrirInstagram();
  } catch (e) { toast(e.message, "triangle-alert"); }
}
async function desligarInstagram() {
  const c = igEstado.contas.find((x) => x.igId === igConta);
  if (!confirm(`Desligar @${c?.usuario} do estúdio? Os agendamentos desta conta deixam de sair. (No Instagram nada muda.)`)) return;
  try { await api("/api/instagram/desligar", { method: "POST", body: { conta: igConta } }); igConta = null; abrirInstagram(); toast("Conta desligada", "check"); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
async function associarContaIg(canal) {
  try { await api("/api/instagram/associar", { method: "POST", body: { conta: igConta, canal } }); igEstado = await api("/api/instagram"); toast("Canal guardado", "check"); }
  catch (e) { toast(e.message, "triangle-alert"); }
}
async function atualizarNumerosIg() {
  const b = $("#btnIgAtualizar");
  b.disabled = true;
  try {
    const t = await api(`/api/instagram/dados?conta=${igConta}`, { method: "POST" });
    igDados = await esperarTarefa(t, (p) => { b.innerHTML = `${ic("loader", 15)}${esc(p ?? "A ler…")}`; });
    igEstado = await api("/api/instagram");
    desenharInstagram(); toast("Números atualizados", "check");
  } catch (e) { toast(e.message, "triangle-alert"); }
  finally { b.disabled = false; b.innerHTML = `${ic("refresh-cw", 16)}Atualizar números`; }
}
async function cancelarAgendaIg(id) {
  try { await api(`/api/instagram/agenda?id=${encodeURIComponent(id)}`, { method: "DELETE" }); igEstado = await api("/api/instagram"); desenharInstagram(); toast("Agendamento cancelado", "check"); }
  catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- comentários ----------
let igMidiaComentarios = null;
async function abrirComentariosIg(media) {
  igMidiaComentarios = media;
  $("#igComCorpo").innerHTML = '<div class="vazio">A carregar…</div>';
  dlgIgComentarios.showModal();
  try {
    const { comentarios } = await api(`/api/instagram/comentarios?conta=${igConta}&media=${media}`);
    $("#igComCorpo").innerHTML = comentarios.length ? comentarios.map((c) => `<div class="ig-comentario">
      <div><b>@${esc(c.usuario ?? "")}</b> <span class="meta">${new Date(c.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${c.likes ? ` · ${c.likes} gostos` : ""}</span></div>
      <div>${esc(c.texto)}</div>
      ${c.respostas.map((r) => `<div class="ig-resposta"><b>@${esc(r.usuario ?? "")}</b> ${esc(r.texto)}</div>`).join("")}
      <div class="linha" style="gap:6px;margin-top:6px"><input class="ig-responder" data-id="${esc(c.id)}" placeholder="Responder a @${esc(c.usuario ?? "")}" maxlength="2200"><button class="btn peq" onclick="responderIg('${esc(c.id)}')">${ic("send", 14)}Responder</button></div>
    </div>`).join("") : '<div class="vazio">Sem comentários.</div>';
  } catch (e) { $("#igComCorpo").innerHTML = `<div class="vazio">${esc(e.message)}</div>`; }
}
async function responderIg(id) {
  const campo = document.querySelector(`.ig-responder[data-id="${CSS.escape(id)}"]`);
  const texto = campo?.value.trim();
  if (!texto) return toast("Escreva a resposta primeiro", "pencil");
  if (!confirm(`Publicar esta resposta no Instagram?\n\n${texto}`)) return;
  try { await api("/api/instagram/responder", { method: "POST", body: { conta: igConta, comentario: id, texto } }); toast("Resposta publicada", "check"); abrirComentariosIg(igMidiaComentarios); }
  catch (e) { toast(e.message, "triangle-alert"); }
}

// ---------- publicar um Reel ----------
async function abrirPublicarIg(video) {
  if (!igEstado) igEstado = await api("/api/instagram").catch(() => null);
  if (!igEstado?.configurado || !igEstado.contas.length) { irPara("instagram"); return toast("Ligue primeiro uma conta do Instagram", "camera"); }
  const vids = (videosCacheIg().length ? videosCacheIg() : await api("/api/videos")).filter((v) => v.video);
  if (!vids.length) return toast("Ainda não há vídeos renderizados na biblioteca", "film");
  igVideos = vids;
  const conta = igEstado.contas.find((c) => c.igId === igConta) ?? igEstado.contas[0];
  $("#igPubConta").innerHTML = igEstado.contas.map((c) => `<option value="${esc(c.igId)}" ${c.igId === conta.igId ? "selected" : ""}>@${esc(c.usuario)}</option>`).join("");
  $("#igPubVideo").innerHTML = vids.map((v) => `<option value="${esc(v.id)}" ${v.id === video ? "selected" : ""}>${esc(v.titulo)}</option>`).join("");
  $("#igPubLegenda").value = "";
  $("#igPubCapa").value = "";
  $("#igPubQuando").value = "";
  $("#igPubAgora").checked = true;
  mudarQuandoIg();
  dlgIgPublicar.showModal();
  await carregarLegendaIg();
}
// a legenda vem do pacote de publicação do vídeo (Instagram Reels), se já foi gerado
async function carregarLegendaIg() {
  const id = $("#igPubVideo").value;
  $("#igPubPrevia").src = igVideos.find((v) => v.id === id)?.video ?? "";
  try {
    const p = await api(`/api/roteiros/${id}/publicacao`);
    const leg = [p.instagram?.legenda, (p.instagram?.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
    $("#igPubLegenda").value = leg;
    $("#igPubOrigem").textContent = leg ? "Legenda do pacote de publicação deste vídeo. Confira antes de publicar." : "Este vídeo ainda não tem pacote de publicação: escreva a legenda ou gere o pacote na biblioteca.";
  } catch { $("#igPubOrigem").textContent = ""; }
  verificarLegendaIg();
}
function mudarQuandoIg() { $("#igPubQuando").disabled = $("#igPubAgora").checked; }
// o verificador da legenda (regras do ig-caption): o que o feed mostra antes do "... mais", tamanho e hashtags
function verificarLegendaIg() {
  const t = $("#igPubLegenda").value;
  const tags = t.match(/#[\p{L}\d_]+/gu) ?? [];
  const primeira = t.split("\n")[0];
  const janela = t.replace(/\n+/g, " ").slice(0, IG_JANELA);
  const avisos = [];
  if (!t.trim()) avisos.push(["aviso", "Legenda vazia"]);
  if (t.length > 2200) avisos.push(["erro", `${t.length} de 2200 caracteres: o Instagram corta o resto`]);
  if (tags.length > IG_MAX_HASHTAGS) avisos.push(["erro", `${tags.length} hashtags: o Instagram aceita no máximo ${IG_MAX_HASHTAGS} por publicação`]);
  if (primeira.length > IG_JANELA) avisos.push(["aviso", `A primeira linha tem ${primeira.length} caracteres: o feed corta-a a meio aos ${IG_JANELA}`]);
  if (/^#/.test(t.trim())) avisos.push(["aviso", "Começa por hashtag: o gancho tem de vir primeiro"]);
  if (/[​-‍⁠﻿]/.test(t)) avisos.push(["aviso", "Tem caracteres invisíveis (vêm de texto gerado): apague e escreva de novo essa parte"]);
  $("#igPubJanela").textContent = janela + (t.length > IG_JANELA ? "… mais" : "");
  $("#igPubVerif").innerHTML = `<span class="meta">${t.length}/2200 · ${tags.length}/${IG_MAX_HASHTAGS} hashtags</span>` +
    avisos.map(([k, m]) => `<div class="ig-aviso ${k}">${ic(k === "erro" ? "circle-x" : "triangle-alert", 13)}${esc(m)}</div>`).join("");
  return !avisos.some(([k]) => k === "erro");
}
async function publicarIg() {
  if (igPublicando) return;
  if (!verificarLegendaIg()) return toast("Corrija a legenda antes de publicar", "triangle-alert");
  const conta = $("#igPubConta").value, video = $("#igPubVideo").value, legenda = $("#igPubLegenda").value;
  const capa = $("#igPubCapa").value.trim(), capaMs = capa === "" ? null : Math.round(Number(capa.replace(",", ".")) * 1000);
  if (capa !== "" && !Number.isFinite(capaMs)) return toast("O segundo da capa tem de ser um número", "triangle-alert");
  const agora = $("#igPubAgora").checked, quando = agora ? null : $("#igPubQuando").value;
  if (!agora && (!quando || new Date(quando).getTime() < Date.now() + 120000)) return toast("Escolha uma data e hora daqui a pelo menos 2 minutos", "calendar-clock");
  const usuario = igEstado.contas.find((c) => c.igId === conta)?.usuario;
  const titulo = $("#igPubVideo").selectedOptions[0]?.textContent;
  if (!confirm(agora ? `Publicar agora no Instagram @${usuario}?\n\n${titulo}` : `Agendar para ${new Date(quando).toLocaleString("pt-BR")} em @${usuario}?\n\n${titulo}\n\nSó sai se o painel estiver aberto neste computador a essa hora.`)) return;
  const b = $("#btnIgPubConfirmar");
  b.disabled = true; igPublicando = true;
  try {
    const r = await api("/api/instagram/publicar", { method: "POST", body: { conta, video, legenda, capaMs, quando: quando ? new Date(quando).toISOString() : null } });
    if (r.agendado) { toast(`Agendado para ${new Date(r.agendado.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, "calendar-clock"); dlgIgPublicar.close(); }
    else {
      const fim = await esperarTarefa(r, (p) => { b.innerHTML = `${ic("loader", 15)}${esc(p ?? "A publicar…")}`; });
      dlgIgPublicar.close();
      toast("Publicado no Instagram", "check");
      if (fim?.url) window.open(fim.url, "_blank", "noopener");
    }
    if (location.hash === "#instagram") abrirInstagram();
  } catch (e) { toast(e.message, "triangle-alert"); }
  finally { igPublicando = false; b.disabled = false; b.innerHTML = `${ic("send", 15)}Publicar`; }
}
