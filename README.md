# Studioware

Estúdio local de vídeos curtos (Shorts, Reels, TikTok) e vídeos longos para o YouTube: do tema ao MP4 final.
O Claude pesquisa e escreve o roteiro, o estúdio busca a mídia, narra, anima, legenda, renderiza com o Remotion
e pode publicar no YouTube.

## O que faz
- **Roteiros** com pesquisa e fontes, em vários formatos (curiosidades, explicativo, "E se?", quiz, ranking,
  storytelling, livre, vídeo longo), com validador de qualidade e editor no painel.
- **Cenas variadas**: fotos e b-roll, gráficos, linha do tempo, Manim, modelos 3D, animação 3D low poly (motor
  próprio + 3.278 modelos CC0), ilustração desenhada à mão (`pincel`) e quiz.
- **Narração**: Edge (grátis), ElevenLabs ou Chatterbox (local, com clonagem de voz), legendas palavra a palavra.
- **Clipes**: corte de silêncios, transcrição, enquadramento automático no rosto e cortes de vídeos longos com
  nota de viralidade.
- **Canais**: marca d'água (logo e @) e nicho por canal, que orienta as ideias e os roteiros.
- **Modo automático** (opcional): temas do dia por canal e publicação agendada no YouTube.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `server/` | painel (`painel.html`, `painel.css`, `painel.js`) e servidor local (`index.mjs`) |
| `src/` | composições Remotion, cenas, motor low poly (`lowpoly/`), cena pincel (`pincel/`) |
| `scripts/` | pipeline: narração, mídia, transcrição, enquadramento, render, capas |
| `.claude/skills/` | instruções do roteirista e das skills |
| `public/` | marca, música própria, efeitos sonoros e modelos 3D CC0 |

## Correr
```bash
npm install
npm run painel
```
Abre em http://localhost:4321. Precisa de Node 22+, Python 3.14 (`edge-tts`, `numpy`, `Pillow`, `opencv-python`,
`auto-editor`), e do Claude Code com sessão iniciada (ou um token de `claude setup-token` em Chaves de API).
As chaves (ElevenLabs, Pixabay, Sketchfab, Google) ficam só no `.env` local.

## Licença
Proprietário, todos os direitos reservados (ver `LICENSE`). Componentes de terceiros: `THIRD_PARTY_NOTICES.md`.
