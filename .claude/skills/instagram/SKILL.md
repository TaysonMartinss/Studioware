---
name: instagram
description: >
  Gestão das contas do Instagram das páginas do estúdio (baseado no instagram-agent-skill, MIT): roteiro de Reel com
  ganchos pontuados, legenda verificada, carrossel, stories, plano da semana, comentários e respostas, DMs,
  pontuação do perfil, pesquisa do que está viral no nicho, reaproveitar vídeos e auditoria das publicações com os
  números reais da API da Meta. Usar com /instagram <comando> ou quando o pedido for sobre Instagram, Reels,
  legendas, perfil ou métricas do Instagram. NÃO usar para produzir/renderizar vídeos (skill novo-video) nem para
  o YouTube (skill youtube).
tools:
  - Read
  - Write
  - Bash
  - WebSearch
  - Edit
  - Grep
  - Glob
---

# Instagram das páginas do estúdio

Responda **sempre em português do Brasil** (PT-PT só se o pedido o disser). As sub-skills em `sub-skills/` estão em
inglês: siga o método delas, mas escreva tudo em português e com as adaptações abaixo.

## Contexto (já recolhido: não perguntar de novo)
- **Canais do estúdio:** `src/canais.json` (nome, arroba e nicho de cada um). Cada conta do Instagram pode estar
  associada a um canal do estúdio; use o nicho desse canal.
- **Contas do Instagram ligadas:** peça a lista ao painel, que nunca devolve tokens:
  `curl -s http://127.0.0.1:4321/api/instagram` (campo `contas`: igId, usuario, seguidores, canal).
  **Nunca leia `dados/instagram-contas.json`**: tem os tokens de acesso das páginas.
- **Números reais** (depois de "Atualizar números" na página Instagram do painel): `dados/instagram/<igId>.json`
  com `perfil`, `conta` (alcance, visualizações, interações dos últimos 30 dias) e `midias` (cada publicação com
  views, reach, likes, comments, shares, saved, ig_reels_avg_watch_time em ms). É a base de `/instagram audit` e o
  que decide o que repetir. Não invente números: se faltarem, diga e use `{{número}}`.
- **Vídeos do estúdio:** roteiros em `roteiros/*.json`, vídeos em `out/<id>.mp4`, pacote de publicação em
  `out/<id>.publicacao.json` (campo `instagram`: legenda e hashtags).
- **Publicar:** quem publica é o criador, no painel (página Instagram > Publicar Reel, ou no pacote de publicação >
  Instagram), pela API oficial. Esta skill **nunca publica, comenta ou envia DMs sozinha** e nunca automatiza o
  browser no Instagram (viola os termos e bloqueia a conta). Entregue sempre um bloco pronto a copiar.

## Voz de cada página
Cada conta tem a sua voz em `dados/instagram/voz-<usuario>.md` (modelo em `templates/voz.md`). Onde uma sub-skill
diz `~/.claude/instagram/voice.md`, leia este ficheiro. Se não existir, peça 3 legendas ou reels da conta (ou leia as
legendas em `dados/instagram/<igId>.json`), escreva o ficheiro a partir delas e mostre-o ao criador.
O ficheiro de pesquisa do `/instagram viral` fica em `dados/instagram/swipe-<usuario>.md`.

## Comandos
| Comando | Sub-skill | Para quê |
|---|---|---|
| `/instagram reel` | `sub-skills/ig-reel.md` | Ideia → 3 ganchos (26 fórmulas em `ferramentas/hooks.json`), roteiro falado, texto na tela e tempos |
| `/instagram viral` | `sub-skills/ig-viral.md` | O que está a funcionar no nicho, pelo múltiplo sobre a mediana de cada conta |
| `/instagram legenda` | `sub-skills/ig-caption.md` | Legenda com os 125 caracteres que o feed mostra antes do "… mais" |
| `/instagram carrossel` | `sub-skills/ig-carousel.md` | Capa que faz deslizar, texto de cada slide (1080×1350) |
| `/instagram stories` | `sub-skills/ig-story.md` | Sequência de stories do dia e que sticker faz o quê |
| `/instagram perfil` | `sub-skills/ig-profile.md` | Pontuação do perfil em 100 (`ferramentas/rubric.json`) e reescrita |
| `/instagram plano` | `sub-skills/ig-plan.md` | A semana: o que publicar, formato, quando e com quem interagir |
| `/instagram humano` | `sub-skills/ig-human.md` | Tira o "cheiro a IA" do texto (ver limites abaixo) |
| `/instagram comentar` | `sub-skills/ig-comment.md` | Comentários em publicações de outros (para crescer no nicho) |
| `/instagram responder` | `sub-skills/ig-reply.md` | Respostas aos comentários das próprias publicações (o painel mostra-os e publica a resposta) |
| `/instagram dm` | `sub-skills/ig-dm.md` | Palavra-chave, primeira mensagem, proposta de parceria e follow-ups |
| `/instagram reaproveitar` | `sub-skills/ig-repurpose.md` | Um vídeo do estúdio (ou longo do YouTube) → uma semana de Reels e carrosséis |
| `/instagram audit` | `sub-skills/ig-audit.md` | Autópsia do que já saiu, com os números de `dados/instagram/<igId>.json` |

Sem comando: escolha a sub-skill pelo pedido. Se o pedido não disser a conta e houver mais de uma, pergunte qual.

## Ferramentas (Python, sem rede, correm aqui)
Corra com `PYTHONIOENCODING=utf-8 python -I .claude/skills/instagram/ferramentas/<script> …`, com os textos num
ficheiro temporário fora do projeto.
- `caption.py legenda.txt --keywords "a,b"`: caixa do que o feed mostra, tamanho, hashtags (**máximo 5** desde
  dezembro de 2025), links. **Fiável em português** para tamanho, janela de 125, hashtags e links; a deteção do
  pedido de ação (CTA) e do "gancho concreto" foi feita para inglês: confirme à mão.
- `beats.py roteiro.txt --target 30 --wpm 170`: tempos de cada frase. Português falado anda pelos 160–180 palavras
  por minuto (use o `--wpm` da voz da conta).
- `hookscore.py ganchos.txt`: em português só **LENGTH** e **SPECIFICITY** valem; STAKES, ADDRESS, FRONTLOAD e os
  "dealbreakers" procuram palavras inglesas. Use para eliminar ganchos longos ou vagos, não para escolher o melhor.
- `humanize.py` / `detect.py` / `slop.json`: o léxico é inglês. Em português use só a limpeza de caracteres
  invisíveis e da tipografia (travessão longo → vírgula, aspas curvas → retas) e aplique à mão a lista PT abaixo.
- `swipe.py`: ranking por múltiplo sobre a mediana; funciona com qualquer língua.

## Clichês a cortar em português (o equivalente do slop.json)
"neste vídeo", "fica até o final", "você não vai acreditar", "isso vai mudar sua vida", "segue para mais",
"marca alguém que precisa ver isso", "o algoritmo ama", "corre que", "sem mais delongas", "bora lá", "é sobre isso",
"não é sobre X, é sobre Y", "confira", "imperdível", "incrível" repetido, emojis como marcadores de lista, três
palavras em maiúsculas seguidas, parede de hashtags.

## Regras do estúdio
- Ganchos e legendas no tom do canal associado (ver `src/canais.json` e a voz da conta).
- Vídeos de saúde e de drogas: informar e prevenir, sem glamourizar nem dar instruções de uso.
- Golpes: explicar como reconhecer e evitar, nunca o passo a passo para os aplicar.
- Nada de números, clientes ou resultados inventados.

Créditos: método e ferramentas de [instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill)
de Jake Schincariol (MIT, ver `LICENSE`). Adaptado para PT-BR, várias contas e o painel do estúdio; nas ferramentas
só mudaram as classes de letras para aceitar acentos.
