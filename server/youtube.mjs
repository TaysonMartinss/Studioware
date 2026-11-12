// Ligação ao YouTube (API de Dados v3): login da Google por canal (OAuth de "app de computador") e envio de
// vídeos agendados. As credenciais da app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) ficam no .env; os tokens de
// cada canal ficam em dados/youtube-tokens.json (só neste computador). Nada aqui publica sem um pedido explícito.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ESCOPOS = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

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
    todos[canal] = { refresh: t.refresh_token, canalId: yt?.id, titulo: yt?.snippet?.title ?? "(sem nome)", ligadoEm: new Date().toISOString() };
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
    if (!r.ok) throw new Error(`YouTube respondeu ${r.status}: ${j.error?.message ?? ""}`);
    return j;
  }

  const estado = () => {
    const t = lerTokens();
    return { configurado: configurado(), canais: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { titulo: v.titulo, ligadoEm: v.ligadoEm }])) };
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

  return { configurado, urlLigar, concluir, estado, desligar, enviar, redirect };
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
