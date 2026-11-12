// Modo automático: uma vez por dia (à hora escolhida), para cada canal ligado, pesquisa os assuntos do momento,
// escolhe os melhores, produz cada vídeo sem esperar pela revisão e, quando o vídeo está pronto e passou as
// verificações, envia-o para o YouTube agendado para um dos horários do canal.
// Está desligado por omissão: só corre quando o criador o ativa no painel (ou carrega em "Correr agora").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// formatos que se fazem só com pesquisa (sem catálogo de preços nem vídeo longo)
const FORMATOS_AUTO = ["curiosidades", "explicativo", "ese", "quiz", "livre", "animado"];
const FOCO = "Os assuntos MAIS QUENTES de hoje no nicho do canal (estratégia tendencia): notícias, lançamentos, polémicas e conversas das últimas 24 a 72 horas que dão um bom Short. Use só formatos que se fazem com pesquisa: curiosidades, explicativo, ese, quiz ou livre (nada de ranking, storytelling nem longo). Ordene pela urgência e pelo potencial.";

export const criarAutomatico = ({ raiz, canais, gerarIdeias, criarJob, correrJob, lerPublicacao, gerarPublicacao, lerRoteiro, youtube }) => {
  const F = join(raiz, "dados/automatico.json");
  const estado = { aCorrer: false, passo: "" };

  const padraoCanal = (id) => ({
    ativo: false, quantidade: 3, estilo: id === "ovaranalisa" ? "hormozi" : "neon", narracao: "edge",
    voz: "pt-BR-AntonioNeural", lowpoly: false, horarios: ["12:00", "18:00", "21:00"], publicarYoutube: true,
  });
  const ler = () => {
    const c = existsSync(F) ? JSON.parse(readFileSync(F, "utf-8")) : {};
    const cfg = { ativo: false, hora: "07:00", ultimaExecucao: null, historico: [], ...c, canais: { ...(c.canais ?? {}) } };
    for (const id of Object.keys(canais())) cfg.canais[id] = { ...padraoCanal(id), ...(cfg.canais[id] ?? {}) };
    return cfg;
  };
  const gravar = (cfg) => { mkdirSync(dirname(F), { recursive: true }); writeFileSync(F, JSON.stringify(cfg, null, 2)); };

  // só os campos que o painel pode mudar (o histórico e a última execução são do servidor)
  const atualizarConfig = (d) => {
    const cfg = ler();
    if (typeof d.ativo === "boolean") cfg.ativo = d.ativo;
    if (/^\d{2}:\d{2}$/.test(d.hora ?? "")) cfg.hora = d.hora;
    for (const [id, c] of Object.entries(d.canais ?? {})) {
      if (!cfg.canais[id]) continue;
      const atual = cfg.canais[id];
      if (typeof c.ativo === "boolean") atual.ativo = c.ativo;
      if (c.quantidade) atual.quantidade = Math.min(3, Math.max(1, Number(c.quantidade) || 3));
      for (const k of ["estilo", "narracao", "voz"]) if (typeof c[k] === "string" && c[k]) atual[k] = c[k];
      if (typeof c.lowpoly === "boolean") atual.lowpoly = c.lowpoly;
      if (typeof c.publicarYoutube === "boolean") atual.publicarYoutube = c.publicarYoutube;
      if (Array.isArray(c.horarios)) atual.horarios = c.horarios.filter((h) => /^\d{2}:\d{2}$/.test(h)).slice(0, 3);
    }
    gravar(cfg);
    return cfg;
  };

  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const agoraHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  // próximo horário: hoje a essa hora, ou amanhã se já passou (com 45 min de folga para o render acabar)
  const proximo = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now() + 45 * 60 * 1000) d.setDate(d.getDate() + 1);
    return d.toISOString();
  };

  const registar = (entrada) => { const cfg = ler(); cfg.historico = [entrada, ...cfg.historico].slice(0, 80); gravar(cfg); };
  const atualizar = (videoId, patch) => {
    const cfg = ler();
    const e = cfg.historico.find((x) => x.videoId === videoId);
    if (e) Object.assign(e, patch, { atualizadoEm: new Date().toISOString() });
    gravar(cfg);
  };

  // depois do render e da revisão visual: verifica e envia para o YouTube, agendado
  const publicar = async (job, revisao) => {
    const cfg = ler(), c = cfg.canais[job.canal], id = job.videoId;
    const entrada = cfg.historico.find((x) => x.videoId === id);
    if (job.estado !== "pronto") return atualizar(id, { estado: "falhou no render" });
    if (!c?.publicarYoutube) return atualizar(id, { estado: "pronto (publicação no YouTube desligada)" });
    const graves = (revisao?.problemas ?? []).filter((p) => p.gravidade === "alta");
    if (graves.length) return atualizar(id, { estado: `pronto, NÃO publicado: a revisão visual encontrou ${graves.length} problema(s) grave(s). Corrija no editor e publique à mão.` });
    if (!youtube.estado().canais[job.canal]) return atualizar(id, { estado: "pronto, NÃO publicado: este canal não está ligado ao YouTube" });
    try {
      atualizar(id, { estado: "a preparar a publicação" });
      const pub = lerPublicacao(id) ?? await gerarPublicacao({ passo: "" }, id);
      const r = lerRoteiro(id);
      const vertical = r.formato !== "longo";
      const titulo = pub.titulos?.find((x) => x.tipo === "misto")?.texto ?? pub.titulos?.[0]?.texto ?? r.titulo;
      const descricao = [pub.youtube?.descricao ?? r.legenda_post ?? "", (pub.youtube?.hashtags ?? []).join(" "), vertical ? "#Shorts" : ""].filter(Boolean).join("\n\n");
      // se o horário já passou (ex.: o vídeo esperou pela revisão), vai para a mesma hora no dia seguinte
      let quando = entrada?.publicarEm;
      if (!quando || new Date(quando).getTime() < Date.now() + 15 * 60 * 1000) quando = proximo(entrada?.horario ?? "18:00");
      atualizar(id, { estado: "a enviar para o YouTube", publicarEm: quando });
      const enviado = await youtube.enviar({
        canal: job.canal, ficheiro: join(raiz, "out", `${id}.mp4`), titulo, descricao, tags: pub.youtube?.tags ?? [],
        categoria: canais()[job.canal]?.categoriaYoutube, publicarEm: quando,
      });
      atualizar(id, { estado: "agendado no YouTube", titulo, youtube: enviado.url, youtubeId: enviado.id });
    } catch (e) {
      atualizar(id, { estado: `pronto, envio falhou: ${e.message}` });
    }
  };

  const correr = async (motivo = "agenda") => {
    if (estado.aCorrer) return;
    estado.aCorrer = true;
    const cfg = ler();
    cfg.ultimaExecucao = hoje();
    gravar(cfg);
    try {
      for (const [id, c] of Object.entries(cfg.canais)) {
        if (!c.ativo || !canais()[id]) continue;
        const nome = canais()[id].nome;
        estado.passo = `🔎 ${nome}: a pesquisar os assuntos do momento…`;
        let ideias = [];
        try {
          const r = await gerarIdeias({ set passo(v) { estado.passo = `🔎 ${nome}: ${v}`; } }, { canal: id, quantidade: 8, foco: FOCO });
          ideias = r.ideias.filter((i) => FORMATOS_AUTO.includes(i.formato)).slice(0, c.quantidade);
        } catch (e) {
          registar({ data: new Date().toISOString(), canal: id, estado: `falhou a pesquisa de ideias: ${e.message}`, motivo });
          continue;
        }
        const horarios = [...c.horarios].sort();
        for (const [k, ideia] of ideias.entries()) {
          estado.passo = `✍ ${nome}: roteiro ${k + 1} de ${ideias.length} — ${ideia.titulo}`;
          const job = criarJob({
            tema: ideia.tema || ideia.titulo, formato: ideia.formato, estilo: c.estilo, narracao: c.narracao, voz: c.voz,
            canal: id, lowpoly: c.lowpoly, revisar: false, editorChefe: true, revisaoVisual: true, auto: true,
          });
          registar({ data: new Date().toISOString(), canal: id, videoId: job.videoId, titulo: ideia.titulo, formato: ideia.formato, estado: "a produzir", horario: horarios[k % horarios.length] ?? "18:00", publicarEm: proximo(horarios[k % horarios.length] ?? "18:00"), motivo });
          job.aoTerminar = (j, revisao) => publicar(j, revisao);
          try { await correrJob(job); } catch { /* o erro fica no job */ }
          if (job.estado === "aguardando revisao") atualizar(job.videoId, { estado: "parado: o validador encontrou erros que o editor-chefe não resolveu. Reveja no painel." });
          else if (job.estado === "erro") atualizar(job.videoId, { estado: `falhou: ${job.log.at(-1) ?? ""}` });
        }
      }
    } finally {
      estado.aCorrer = false;
      estado.passo = "";
    }
  };

  // verifica a cada minuto se chegou a hora (se o PC esteve desligado à hora marcada, corre quando o painel abrir)
  const iniciar = () => {
    const verificar = () => {
      const cfg = ler();
      if (cfg.ativo && cfg.ultimaExecucao !== hoje() && agoraHHMM() >= cfg.hora) correr("agenda").catch(() => {});
    };
    setTimeout(verificar, 15000);
    setInterval(verificar, 60000);
  };

  return { ler, atualizarConfig, estado, correr, iniciar, proximo };
};
