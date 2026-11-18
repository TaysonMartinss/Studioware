// Ligação ao YouTube (API de Dados v3 e API de Analytics): login da Google por canal (OAuth de "app de computador"),
// envio de vídeos agendados e as estatísticas do canal (menu Insights). As credenciais da app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) ficam no .env; os tokens de
// cada canal ficam em dados/youtube-tokens.json (só neste computador). Nada aqui publica sem um pedido explícito.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// yt-analytics.readonly: só ler as estatísticas do próprio canal (views, retenção, fontes de tráfego). Os canais ligados
// antes desta permissão continuam a publicar, mas precisam de se ligar outra vez para o menu Insights.
const ESCOPOS = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"];
const ESCOPO_ANALYTICS = "yt-analytics.readonly";

export const criarYouTube = ({ raiz, lerEnv, porta }) => {
  const TOKENS = join(raiz, "dados/youtube-tokens.json");
  const redirect = `http://127.0.0.1:${porta}/oauth/youtube`;
  const pendentes = new Map(); // state -> canal (protege o callback contra pedidos forjados)
  const acessos = new Map(); // canal -> { token, expira }

  const cred = () => { const e = { ...lerEnv(), ...process.env }; return { id: e.GOOGLE_CLIENT_ID, segredo: e.GOOGLE_CLIENT_SECRET }; };
  const lerTokens = () => (existsSync(TOKENS) ? JSON.parse(readFileSync(TOKENS, "utf-8")) : {});
  const gravarTokens = (t) => { mkdirSync(dirname(TOKENS), { recursive: true }); writeFileSync(TOKENS, JSON.stringify(t, null, 2)); };

  const configurado = () => Boolean(cred().id && cred().segredo);

  // 1. endereço da página de consentimento da Google para ligar um canal do estúdio a um canal do YouTube
  const urlLigar = (canal) => {
    const { id } = cred();
    if (!id) throw new Error("Falta o GOOGLE_CLIENT_ID (Chaves de API)");
    const state = randomBytes(16).toString("hex");
    pendentes.set(state, canal);
    const q = new URLSearchParams({
      client_id: id, redirect_uri: redirect, response_type: "code", scope: ESCOPOS.join(" "),
      access_type: "offline", prompt: "consent select_account", state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  };

  // 2. a Google devolve um código: troca-o por tokens e confirma qual é o canal do YouTube
  const concluir = async (code, state) => {
    const canal = pendentes.get(state);
    if (!canal) throw new Error("Pedido de ligação desconhecido ou expirado. Tente outra vez a partir do painel.");
    pendentes.delete(state);
    const { id, segredo } = cred();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: id, client_secret: segredo, redirect_uri: redirect, grant_type: "authorization_code" }),
    });
    const t = await r.json();
    if (!r.ok || !t.refresh_token) throw new Error(`A Google recusou a ligação: ${t.error_description || t.error || r.status}`);
    acessos.set(canal, { token: t.access_token, expira: Date.now() + (t.expires_in - 60) * 1000 });
    const info = await api(canal, "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true");
    const yt = info.items?.[0];
    const todos = lerTokens();
    todos[canal] = { refresh: t.refresh_token, canalId: yt?.id, titulo: yt?.snippet?.title ?? "(sem nome)", ligadoEm: new Date().toISOString(), escopos: String(t.scope ?? "") };
    gravarTokens(todos);
    return { canal, titulo: todos[canal].titulo };
  };

  const acesso = async (canal) => {
    const c = acessos.get(canal);
    if (c && c.expira > Date.now()) return c.token;
    const tk = lerTokens()[canal];
    if (!tk) throw new Error(`O canal ${canal} não está ligado ao YouTube`);
    const { id, segredo } = cred();
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: tk.refresh, grant_type: "refresh_token" }),
    });
    const t = await r.json();
    if (!r.ok) throw new Error(`A Google não renovou o acesso (${t.error || r.status}): volte a ligar o canal`);
    acessos.set(canal, { token: t.access_token, expira: Date.now() + (t.expires_in - 60) * 1000 });
    return t.access_token;
  };

  async function api(canal, url, opcoes = {}) {
    const r = await fetch(url, { ...opcoes, headers: { ...(opcoes.headers ?? {}), Authorization: `Bearer ${await acesso(canal)}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j.error?.message ?? "";
      // a API das estatísticas tem de ser ativada à mão no projeto da Google Cloud (uma vez só)
      if (/youtubeanalytics|YouTube Analytics API/i.test(msg) && /disabled|not been used/i.test(msg)) {
        const projeto = /project=(\d+)/.exec(msg)?.[1];
        throw new Error(`Falta ativar a YouTube Analytics API no projeto da Google Cloud${projeto ? ` (projeto ${projeto})` : ""}. Ative-a e tente outra vez daqui a 1 ou 2 minutos.`);
      }
      throw new Error(`YouTube respondeu ${r.status}: ${msg}`);
    }
    return j;
  }

  const estado = () => {
    const t = lerTokens();
    return { configurado: configurado(), canais: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { titulo: v.titulo, ligadoEm: v.ligadoEm, estatisticas: String(v.escopos ?? "").includes(ESCOPO_ANALYTICS) }])) };
  };
  const desligar = (canal) => { const t = lerTokens(); delete t[canal]; gravarTokens(t); acessos.delete(canal); };

  // 3. envio: privado com publishAt = fica agendado e o YouTube publica sozinho a essa hora
  const enviar = async ({ canal, ficheiro, titulo, descricao, tags, categoria, publicarEm }) => {
    if (!existsSync(ficheiro)) throw new Error(`Não encontrei o vídeo ${ficheiro}`);
    const meta = {
      snippet: { title: titulo.slice(0, 100), description: descricao.slice(0, 4900), tags: cortarTags(tags), categoryId: String(categoria ?? 22), defaultLanguage: "pt", defaultAudioLanguage: "pt" },
      status: { privacyStatus: "private", ...(publicarEm && { publishAt: new Date(publicarEm).toISOString() }), selfDeclaredMadeForKids: false },
    };
    const tamanho = statSync(ficheiro).size;
    const ini = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: { Authorization: `Bearer ${await acesso(canal)}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(tamanho) },
      body: JSON.stringify(meta),
    });
    if (!ini.ok) { const j = await ini.json().catch(() => ({})); throw new Error(`YouTube recusou o envio (${ini.status}): ${j.error?.message ?? ""}`); }
    const destino = ini.headers.get("location");
    const up = await fetch(destino, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(tamanho) }, body: readFileSync(ficheiro) });
    const j = await up.json().catch(() => ({}));
    if (!up.ok || !j.id) throw new Error(`O envio falhou (${up.status}): ${j.error?.message ?? ""}`);
    return { id: j.id, url: `https://youtube.com/shorts/${j.id}`, estado: j.status?.privacyStatus, publicarEm: j.status?.publishAt };
  };

  // ---------- estatísticas (menu Insights) ----------
  // Tudo pelas APIs oficiais e grátis (quota diária da Google); só do canal ligado a este canal do estúdio.
  const dia = (d) => d.toISOString().slice(0, 10);
  const relatorio = (canal, q) => api(canal, `https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({ ids: "channel==MINE", ...q })}`)
    .then((r) => (r.rows ?? []).map((l) => Object.fromEntries((r.columnHeaders ?? []).map((c, i) => [c.name, l[i]]))));
  const segundos = (iso) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "") ?? []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };

  const insights = async (canal, dias = 28) => {
    const tk = lerTokens()[canal];
    if (!tk) throw new Error("Este canal não está ligado ao YouTube");
    if (!String(tk.escopos ?? "").includes(ESCOPO_ANALYTICS)) throw new Error("Falta a permissão de estatísticas: ligue o canal outra vez");
    // o YouTube só tem os números fechados até 2 a 3 dias atrás
    const fim = new Date(Date.now() - 2 * 864e5), inicio = new Date(fim.getTime() - (dias - 1) * 864e5);
    const periodo = { startDate: dia(inicio), endDate: dia(fim) };
    const anterior = { startDate: dia(new Date(inicio.getTime() - dias * 864e5)), endDate: dia(new Date(inicio.getTime() - 864e5)) };
    const M_TOTAL = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares";

    const ch = (await api(canal, "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true")).items?.[0];
    if (!ch) throw new Error("A Google não devolveu o canal");
    // os últimos 50 vídeos publicados (lista de uploads: barata em quota, ao contrário da pesquisa)
    const lista = await api(canal, `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${ch.contentDetails.relatedPlaylists.uploads}`);
    const ids = (lista.items ?? []).map((i) => i.contentDetails.videoId);
    const vids = ids.length ? (await api(canal, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${ids.join(",")}`)).items ?? [] : [];

    const [total, totalAntes, porDia, porVideo, trafego] = await Promise.all([
      relatorio(canal, { ...periodo, metrics: M_TOTAL }),
      relatorio(canal, { ...anterior, metrics: M_TOTAL }),
      relatorio(canal, { ...periodo, metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost", dimensions: "day", sort: "day" }),
      relatorio(canal, { ...periodo, metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained", dimensions: "video", sort: "-views", maxResults: "50" }),
      relatorio(canal, { ...periodo, metrics: "views,estimatedMinutesWatched", dimensions: "insightTrafficSourceType", sort: "-views" }),
    ]);
    // impressões e CTR da miniatura: nem todas as contas as têm na API; sem elas o resto continua
    const impressoes = await relatorio(canal, { ...periodo, metrics: "videoThumbnailImpressions,videoThumbnailImpressionsClickRate", dimensions: "video", sort: "-videoThumbnailImpressions", maxResults: "50" }).catch(() => []);
    const porId = Object.fromEntries(porVideo.map((v) => [v.video, v])), impId = Object.fromEntries(impressoes.map((v) => [v.video, v]));
    return {
      geradoEm: new Date().toISOString(), dias, periodo, canal,
      youtube: { id: ch.id, titulo: ch.snippet.title, foto: ch.snippet.thumbnails?.default?.url, inscritos: +ch.statistics.subscriberCount || 0, views: +ch.statistics.viewCount || 0, videos: +ch.statistics.videoCount || 0 },
      total: total[0] ?? {}, totalAntes: totalAntes[0] ?? {}, porDia, trafego,
      videos: vids.map((v) => {
        const a = porId[v.id] ?? {}, im = impId[v.id] ?? {}, dur = segundos(v.contentDetails?.duration);
        return {
          id: v.id, titulo: v.snippet.title, publicadoEm: v.snippet.publishedAt, miniatura: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url,
          duracao: dur, short: dur > 0 && dur <= 180, privado: v.status?.privacyStatus !== "public",
          total: { views: +v.statistics?.viewCount || 0, likes: +v.statistics?.likeCount || 0, comentarios: +v.statistics?.commentCount || 0 },
          periodo: { views: a.views ?? 0, minutos: a.estimatedMinutesWatched ?? 0, duracaoMedia: a.averageViewDuration ?? null, percentagemMedia: a.averageViewPercentage ?? null, likes: a.likes ?? 0, partilhas: a.shares ?? 0, inscritos: a.subscribersGained ?? 0, impressoes: im.videoThumbnailImpressions ?? null, ctr: im.videoThumbnailImpressionsClickRate ?? null },
        };
      }),
    };
  };
  // a curva de retenção de um vídeo: que fração do público ainda está a ver em cada ponto (0 a 100% do vídeo)
  const retencao = async (canal, video) => {
    const linhas = await relatorio(canal, { startDate: "2015-01-01", endDate: dia(new Date()), metrics: "audienceWatchRatio,relativeRetentionPerformance", dimensions: "elapsedVideoTimeRatio", filters: `video==${video}`, sort: "elapsedVideoTimeRatio" });
    return linhas.map((l) => ({ t: l.elapsedVideoTimeRatio, ficam: l.audienceWatchRatio, relativa: l.relativeRetentionPerformance }));
  };

  return { configurado, urlLigar, concluir, estado, desligar, enviar, redirect, insights, retencao };
};

// o YouTube aceita no máximo 500 caracteres somando as tags
const cortarTags = (tags = []) => {
  const out = []; let soma = 0;
  for (const t of tags.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean)) {
    if (soma + t.length + 2 > 480) break;
    out.push(t); soma += t.length + 2;
  }
  return out;
};
