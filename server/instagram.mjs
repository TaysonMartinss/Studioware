// Ligação ao Instagram pela API oficial da Meta (Instagram Graph API com Facebook Login): contas profissionais
// (criador ou empresa) ligadas a uma página do Facebook. É o único caminho oficial que aceita enviar o vídeo a partir de
// um ficheiro deste computador (upload "resumable"); o "Instagram Login" só publica vídeos que já estejam num endereço
// público. Credenciais da app no .env (META_APP_ID / META_APP_SECRET); o token de cada página fica em
// dados/instagram-contas.json (só neste computador, fora do git). Nada aqui publica sem um pedido explícito no painel.
//
// Fluxo: login do Facebook -> token de utilizador -> token de longa duração -> páginas do utilizador (/me/accounts) com
// a conta do Instagram ligada a cada uma. O token de página obtido de um token de longa duração não expira (até o
// criador mudar a senha ou tirar a permissão), por isso não há renovação a fazer.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const VERSAO_API = "v27.0";
const GRAPH = `https://graph.facebook.com/${VERSAO_API}`;
// permissões pedidas no login (as do Instagram Graph API com Facebook Login)
const ESCOPOS = [
  "instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments",
  "pages_show_list", "pages_read_engagement", "business_management",
];
// métricas de cada Reel e de cada publicação (as que a Meta ainda não retirou; "impressions" e "plays" já saíram)
const METRICAS_REEL = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions", "ig_reels_avg_watch_time"];
const METRICAS_POST = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"];
const METRICAS_CONTA = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "follows_and_unfollows"];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export const criarInstagram = ({ raiz, lerEnv, porta, aoPublicar = () => {} }) => {
  const CONTAS = join(raiz, "dados/instagram-contas.json");
  const AGENDA = join(raiz, "dados/instagram-agenda.json");
  const PASTA_DADOS = join(raiz, "dados/instagram");
  const redirect = `http://localhost:${porta}/oauth/instagram`;
  const pendentes = new Map(); // state -> criado em (protege o callback contra pedidos forjados)

  const cred = () => { const e = { ...lerEnv(), ...process.env }; return { id: e.META_APP_ID, segredo: e.META_APP_SECRET }; };
  const configurado = () => Boolean(cred().id && cred().segredo);
  const lerJSON = (f, padrao) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf-8")) : padrao);
  const gravarJSON = (f, d) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(d, null, 2)); };
  const lerContas = () => lerJSON(CONTAS, {});
  const gravarContas = (c) => gravarJSON(CONTAS, c);

  // pedido à API com o token da página da conta; os erros da Meta vêm em error.message (e às vezes error_user_msg)
  const pedir = async (url, opcoes = {}) => {
    const r = await fetch(url, opcoes);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const e = j.error ?? {};
      const msg = e.error_user_msg || e.message || `HTTP ${r.status}`;
      const erro = new Error(`Instagram respondeu ${r.status}: ${msg}`);
      erro.codigo = e.code; erro.sub = e.error_subcode;
      throw erro;
    }
    return j;
  };
  const conta = (igId) => {
    const c = lerContas()[igId];
    if (!c) throw new Error("Esta conta do Instagram não está ligada ao estúdio");
    return c;
  };
  const api = (igId, caminho, { metodo = "GET", params = {} } = {}) => {
    const { token } = conta(igId);
    const q = new URLSearchParams({ ...params, access_token: token });
    if (metodo === "GET") return pedir(`${GRAPH}/${caminho}?${q}`);
    return pedir(`${GRAPH}/${caminho}`, { method: metodo, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: q });
  };

  // ---------- ligar contas ----------
  const urlLigar = () => {
    const { id } = cred();
    if (!id) throw new Error("Falta o META_APP_ID (Configurações > Chaves de API)");
    const state = randomBytes(16).toString("hex");
    pendentes.set(state, Date.now());
    const q = new URLSearchParams({ client_id: id, redirect_uri: redirect, state, scope: ESCOPOS.join(","), response_type: "code" });
    return `https://www.facebook.com/${VERSAO_API}/dialog/oauth?${q}`;
  };

  // o Facebook devolve um código: troca-o por um token de longa duração e guarda todas as contas do Instagram das páginas
  const concluir = async (code, state) => {
    if (!pendentes.has(state)) throw new Error("Pedido de ligação desconhecido ou expirado. Tente outra vez a partir do painel.");
    pendentes.delete(state);
    const { id, segredo } = cred();
    const curto = await pedir(`${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: id, client_secret: segredo, redirect_uri: redirect, code })}`);
    return ligarComToken(curto.access_token);
  };

  // plano B (e o fim do login): um token de utilizador (do login ou colado do Graph API Explorer da Meta) passa a
  // longa duração e dá os tokens das páginas com Instagram
  const ligarComToken = async (tokenUtilizador) => {
    const { id, segredo } = cred();
    if (!id || !segredo) throw new Error("Falta o ID ou a chave secreta da app da Meta (Configurações > Chaves de API)");
    if (!/^[\w-]{20,600}$/.test(String(tokenUtilizador ?? ""))) throw new Error("Token inválido");
    const curto = { access_token: tokenUtilizador };
    const longo = await pedir(`${GRAPH}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: id, client_secret: segredo, fb_exchange_token: curto.access_token })}`);
    const IG = "{id,username,name,profile_picture_url,followers_count,media_count}";
    const campos = `id,name,access_token,instagram_business_account${IG},connected_instagram_account${IG}`;
    const tk = longo.access_token;
    const listar = async (caminho, q = {}) => {
      const out = [];
      for (let url = `${GRAPH}/${caminho}?${new URLSearchParams({ limit: "100", ...q, access_token: tk })}`; url;) {
        const p = await pedir(url);
        out.push(...(p.data ?? []));
        url = p.paging?.next;
      }
      return out;
    };
    // páginas do perfil e, para as que estão num portfólio empresarial (Business Manager), as do portfólio
    const porId = new Map();
    for (const p of await listar("me/accounts", { fields: campos })) porId.set(p.id, p);
    const empresas = await listar("me/businesses", { fields: "id,name" }).catch(() => []);
    for (const e of empresas) {
      for (const aresta of ["owned_pages", "client_pages"]) {
        for (const p of await listar(`${e.id}/${aresta}`, { fields: campos }).catch(() => [])) if (!porId.has(p.id) || !porId.get(p.id).access_token) porId.set(p.id, p);
      }
    }
    const paginas = [...porId.values()];
    const todas = lerContas();
    const novas = [];
    for (const p of paginas) {
      const ig = p.instagram_business_account ?? p.connected_instagram_account;
      if (!ig?.id || !p.access_token) continue;
      todas[ig.id] = {
        ...(todas[ig.id] ?? {}),
        igId: ig.id, usuario: ig.username, nome: ig.name ?? ig.username, foto: ig.profile_picture_url ?? null,
        seguidores: ig.followers_count ?? null, publicacoes: ig.media_count ?? null,
        paginaId: p.id, pagina: p.name, token: p.access_token, ligadoEm: new Date().toISOString(),
      };
      novas.push(`@${ig.username}`);
    }
    if (!novas.length) {
      // diagnóstico: que páginas vieram e que permissões ficaram por dar
      const recusadas = (await listar("me/permissions").catch(() => [])).filter((x) => x.status !== "granted").map((x) => x.permission);
      const nomes = paginas.map((p) => `${p.name}${p.instagram_business_account || p.connected_instagram_account ? " (Instagram sem acesso de administrador)" : " (sem Instagram)"}`);
      throw new Error([
        nomes.length ? `Páginas que o Facebook devolveu: ${nomes.join(", ")}.` : "O Facebook não devolveu nenhuma página: no login, em \"Editar acesso\", marque as páginas.",
        recusadas.length ? `Permissões não dadas: ${recusadas.join(", ")}.` : "",
        `Portfólios empresariais: ${empresas.length}.`,
        "Cada Instagram tem de ser conta profissional ligada à página (na página do Facebook: Definições > Contas ligadas > Instagram, ou no Instagram: Editar perfil > Página).",
      ].filter(Boolean).join(" "));
    }
    gravarContas(todas);
    return { contas: novas };
  };

  const estado = () => ({
    configurado: configurado(), redirect,
    contas: Object.values(lerContas()).map(({ token, ...c }) => c), // o token nunca sai do servidor
  });
  const desligar = (igId) => { const t = lerContas(); delete t[igId]; gravarContas(t); };
  // a que canal do estúdio pertence esta conta (para usar o nicho, a voz e as legendas desse canal)
  const associar = (igId, canal) => { const t = lerContas(); if (!t[igId]) throw new Error("Conta desconhecida"); t[igId].canal = canal || null; gravarContas(t); };

  // ---------- publicar um Reel a partir de um ficheiro deste computador ----------
  // 1. contentor com upload_type=resumable; 2. envia os bytes para rupload.facebook.com; 3. espera o Instagram
  // processar (status_code FINISHED); 4. media_publish. passo(texto) mostra o progresso no painel.
  const publicarReel = async ({ igId, ficheiro, legenda = "", capaMs, noFeed = true, passo = () => {} }) => {
    if (!existsSync(ficheiro)) throw new Error(`Não encontrei o vídeo ${ficheiro}`);
    const { token } = conta(igId);
    const tamanho = statSync(ficheiro).size;
    if (tamanho > 1024 ** 3) throw new Error("O Instagram aceita Reels até 1 GB");
    passo("A preparar o envio…");
    const params = { media_type: "REELS", upload_type: "resumable", caption: String(legenda).slice(0, 2200), share_to_feed: noFeed ? "true" : "false" };
    if (Number.isFinite(capaMs) && capaMs >= 0) params.thumb_offset = String(Math.round(capaMs));
    const contentor = await api(igId, `${igId}/media`, { metodo: "POST", params });
    passo(`A enviar o vídeo (${(tamanho / 1048576).toFixed(1)} MB)…`);
    const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${VERSAO_API}/${contentor.id}`, {
      method: "POST", headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(tamanho) }, body: readFileSync(ficheiro),
    });
    const ju = await up.json().catch(() => ({}));
    if (!up.ok || ju.success === false) throw new Error(`O envio do vídeo falhou (${up.status}): ${ju.debug_info?.message ?? ju.error?.message ?? ""}`);
    // o processamento demora de segundos a alguns minutos; a Meta pede para não perguntar muitas vezes
    const limite = Date.now() + 20 * 60 * 1000;
    for (let i = 0; ; i++) {
      const s = await api(igId, contentor.id, { params: { fields: "status_code,status" } });
      if (s.status_code === "FINISHED") break;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`O Instagram não aceitou o vídeo: ${s.status ?? s.status_code}`);
      if (Date.now() > limite) throw new Error("O Instagram demorou mais de 20 minutos a processar o vídeo. Tente outra vez mais tarde.");
      passo(`O Instagram está a processar o vídeo… (${Math.round((i * 20) / 60)} min)`);
      await espera(20000);
    }
    passo("A publicar…");
    const pub = await api(igId, `${igId}/media_publish`, { metodo: "POST", params: { creation_id: contentor.id } });
    const media = await api(igId, pub.id, { params: { fields: "permalink,timestamp" } }).catch(() => ({}));
    return { id: pub.id, url: media.permalink ?? null, publicadoEm: media.timestamp ?? new Date().toISOString() };
  };

  // quantas publicações pela API ainda cabem nas últimas 24 h (o limite da Meta é por conta)
  const limitePublicacao = async (igId) => {
    const r = await api(igId, `${igId}/content_publishing_limit`, { params: { fields: "quota_usage,config" } });
    const d = r.data?.[0] ?? {};
    return { usadas: d.quota_usage ?? 0, total: d.config?.quota_total ?? null };
  };

  // ---------- agenda: a API do Instagram não agenda; o painel publica à hora marcada enquanto estiver aberto ----------
  const lerAgenda = () => lerJSON(AGENDA, []);
  const gravarAgenda = (a) => gravarJSON(AGENDA, a);
  const agendar = ({ igId, video, ficheiro, legenda, capaMs, quando }) => {
    conta(igId);
    const t = new Date(quando).getTime();
    if (!Number.isFinite(t)) throw new Error("Data inválida");
    const item = { id: randomBytes(6).toString("hex"), igId, video, ficheiro, legenda, capaMs, quando: new Date(t).toISOString(), estado: "agendado", criadoEm: new Date().toISOString() };
    gravarAgenda([...lerAgenda(), item]);
    return item;
  };
  const cancelar = (id) => {
    const a = lerAgenda();
    const i = a.find((x) => x.id === id);
    if (!i) throw new Error("Agendamento não existe");
    if (i.estado !== "agendado") throw new Error(`Já não dá para cancelar (${i.estado})`);
    gravarAgenda(a.filter((x) => x.id !== id));
  };
  const mudarItem = (id, mud) => gravarAgenda(lerAgenda().map((x) => (x.id === id ? { ...x, ...mud } : x)));
  let ocupado = false;
  const verAgenda = async () => {
    if (ocupado) return;
    const devido = lerAgenda().find((x) => x.estado === "agendado" && new Date(x.quando).getTime() <= Date.now());
    if (!devido) return;
    ocupado = true;
    try {
      mudarItem(devido.id, { estado: "a publicar" });
      const r = await publicarReel({ ...devido, passo: (p) => mudarItem(devido.id, { passo: p }) });
      mudarItem(devido.id, { estado: "publicado", passo: null, url: r.url, mediaId: r.id, publicadoEm: r.publicadoEm });
      aoPublicar({ ...devido, ...r });
    } catch (e) {
      mudarItem(devido.id, { estado: "falhou", passo: null, erro: e.message });
    } finally { ocupado = false; }
  };
  // um agendamento que estava "a publicar" quando o painel fechou volta a "falhou" (não se sabe se chegou a sair)
  gravarAgenda(lerAgenda().map((x) => (x.estado === "a publicar" ? { ...x, estado: "falhou", erro: "O painel fechou durante a publicação: confirme no Instagram antes de tentar outra vez" } : x)));
  setInterval(() => verAgenda().catch(() => {}), 30000).unref();

  // ---------- números da conta e de cada publicação ----------
  const ficheiroDados = (igId) => join(PASTA_DADOS, `${igId}.json`);
  const lerDados = (igId) => lerJSON(ficheiroDados(igId), null);
  // pede as métricas todas; se a Meta recusar uma (muda de nome com frequência), tenta uma a uma e fica com as que der
  const metricas = async (igId, mediaId, lista) => {
    const valores = (r) => Object.fromEntries((r.data ?? []).map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? null]));
    try { return valores(await api(igId, `${mediaId}/insights`, { params: { metric: lista.join(",") } })); } catch {
      const out = {};
      for (const m of lista) { try { Object.assign(out, valores(await api(igId, `${mediaId}/insights`, { params: { metric: m } }))); } catch { /* métrica indisponível */ } }
      return out;
    }
  };
  const atualizarDados = async (igId, { passo = () => {}, dias = 30 } = {}) => {
    passo("A ler a conta…");
    const perfil = await api(igId, igId, { params: { fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website" } });
    passo("A ler as publicações…");
    const lista = await api(igId, `${igId}/media`, { params: { fields: "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count", limit: "30" } });
    const midias = [];
    for (const [i, m] of (lista.data ?? []).entries()) {
      passo(`A ler os números das publicações (${i + 1} de ${lista.data.length})…`);
      const reel = m.media_product_type === "REELS";
      midias.push({
        id: m.id, legenda: m.caption ?? "", tipo: m.media_product_type ?? m.media_type, link: m.permalink, data: m.timestamp,
        miniatura: m.thumbnail_url ?? (m.media_type === "IMAGE" ? m.media_url : null),
        likes: m.like_count ?? null, comentarios: m.comments_count ?? null,
        numeros: await metricas(igId, m.id, reel ? METRICAS_REEL : METRICAS_POST),
      });
    }
    passo("A ler os números da conta…");
    const fim = Math.floor(Date.now() / 1000), inicio = fim - dias * 86400;
    const conta30 = {};
    for (const m of METRICAS_CONTA) {
      try {
        const r = await api(igId, `${igId}/insights`, { params: { metric: m, period: "day", metric_type: "total_value", since: String(inicio), until: String(fim) } });
        conta30[m] = r.data?.[0]?.total_value?.value ?? null;
      } catch { /* indisponível nesta conta */ }
    }
    // seguidores por dia (a Meta só dá os últimos 30 dias, e só a contas com 100 ou mais seguidores)
    let seguidoresDia = [];
    try {
      const r = await api(igId, `${igId}/insights`, { params: { metric: "follower_count", period: "day", since: String(Math.max(inicio, fim - 29 * 86400)), until: String(fim) } });
      seguidoresDia = (r.data?.[0]?.values ?? []).map((v) => ({ dia: v.end_time?.slice(0, 10), novos: v.value }));
    } catch { /* sem dados */ }
    const d = { geradoEm: new Date().toISOString(), dias, perfil, conta: conta30, seguidoresDia, midias };
    gravarJSON(ficheiroDados(igId), d);
    // a ficha da conta guarda também os números mais recentes do perfil
    const t = lerContas();
    if (t[igId]) { Object.assign(t[igId], { usuario: perfil.username, nome: perfil.name ?? perfil.username, foto: perfil.profile_picture_url ?? t[igId].foto, seguidores: perfil.followers_count, publicacoes: perfil.media_count }); gravarContas(t); }
    return d;
  };

  // ---------- comentários ----------
  const comentarios = async (igId, mediaId) => {
    const r = await api(igId, `${mediaId}/comments`, { params: { fields: "id,text,username,timestamp,like_count,replies{id,text,username,timestamp}", limit: "50" } });
    return (r.data ?? []).map((c) => ({ id: c.id, texto: c.text, usuario: c.username, data: c.timestamp, likes: c.like_count ?? 0, respostas: (c.replies?.data ?? []).map((x) => ({ id: x.id, texto: x.text, usuario: x.username, data: x.timestamp })) }));
  };
  const responder = (igId, comentarioId, texto) => {
    const t = String(texto ?? "").trim();
    if (!t) throw new Error("Resposta vazia");
    return api(igId, `${comentarioId}/replies`, { metodo: "POST", params: { message: t.slice(0, 2200) } });
  };

  return {
    configurado, redirect, urlLigar, concluir, ligarComToken, estado, desligar, associar,
    publicarReel, limitePublicacao, agendar, cancelar, lerAgenda, verAgenda,
    atualizarDados, lerDados, comentarios, responder,
  };
};
