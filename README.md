# Studioware

Estúdio local de vídeos curtos (Shorts, Reels, TikTok) e vídeos longos para o YouTube: do tema ao MP4 final.
O Claude pesquisa e escreve o roteiro, o estúdio busca a mídia, narra, anima, legenda, renderiza com o Remotion
e pode publicar no YouTube. Também edita os seus próprios vídeos: corta vídeos longos em Shorts e monta-os com a
linguagem dos reels (cortes a cada 3–5 s, apoios visuais, tipografia, dados).

## O que faz
- **Roteiros** com pesquisa e fontes, em vários formatos (curiosidades, explicativo, "E se?", quiz, ranking,
  storytelling, livre, Animação 3D, vídeo longo), com validador de qualidade e editor no painel.
- **Estilos visuais**: Neon Gamer, Pixel 3D (3D em pixel com dithering), Editorial 3D (papel milimétrico,
  tipografia de revista, objetos 3D, câmara 3D com camadas) e Vice Sunset (cidade costeira ao pôr do sol). Os
  estilos antigos ficam ocultos no painel mas continuam a renderizar vídeos antigos.
- **Cenas**: faixa de cinema (b-roll 16:9 com número com brilho), palavras gigantes, tipografia editorial, dado
  editorial (número a contar + barras), gráficos, linha do tempo, Manim, modelos 3D, animação 3D low poly (motor
  próprio) e quiz. Fundos pretos com grelha ondulada.
- **Modelos 3D**: 3.278 modelos low poly CC0 da Kenney, modelos realistas CC0 do Poly Haven
  (`python scripts/baixar_polyhaven.py`) e Sketchfab (só licenças comerciais).
- **Narração**: Edge (grátis), ElevenLabs ou Chatterbox (local, com clonagem de voz). Legendas palavra a palavra
  com as letras a ondular e destaque por cor.
- **Os seus vídeos (clipes e cortes)**:
  - corte de silêncios, transcrição e enquadramento automático no rosto;
  - cortes de vídeos longos com nota de viralidade (só na parte do vídeo com imagem);
  - receita de edição: novo plano a cada 3–5 s nas pausas da fala, título em popup durante 4 s;
  - apoios escolhidos pelo Claude em ecrã inteiro: frases de efeito em tipografia editorial com objeto 3D
    (sem legenda por baixo), dados citados em gráfico, vídeos que explicam o que se diz, faixa e palavras;
  - gameplay com webcam detetada sozinha: webcam em cima, a desvanecer para o jogo em baixo;
  - rosto em cima e gameplay da biblioteca em baixo, com a opção de intercalar momentos.
- **Capas** em 3 variantes (nos cortes, com frames do próprio vídeo como fundo).
- **Canais**: marca d'água (logo e @, redonda quando a logo não tem fundo removível) e nicho por canal, que
  orienta as ideias e os roteiros.
- **Produção**: fila com etapas, botão Parar (e Parar tudo), análises de cortes visíveis e lixeira.
- **Modo automático** (opcional): temas do dia por canal e publicação agendada no YouTube.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `server/` | painel (`painel.html`, `painel.css`, `painel.js`), servidor local (`index.mjs`), cortes, YouTube, modo automático |
| `src/` | composições Remotion, cenas (`cenas/`), componentes, motor low poly (`lowpoly/`) |
| `scripts/` | pipeline: narração, mídia, transcrição, enquadramento (`reframe.py`), exemplos dos cortes, render, capas |
| `.claude/skills/` | instruções do roteirista, dos cortes e das skills |
| `public/` | marca, música própria, efeitos sonoros e modelos 3D CC0 |

## Correr
```bash
npm install
npm run painel
```
Abre em http://localhost:4321. Precisa de Node 22+, Python 3.14 (`edge-tts`, `numpy`, `Pillow`, `opencv-python`,
`auto-editor`) e do Claude Code com sessão iniciada (ou um token de `claude setup-token` em Chaves de API).
O Chatterbox (opcional) usa um ambiente próprio em `.venv-voz`.

Configuração local, só no `.env` (fora do git):
- chaves de API (ElevenLabs, Pixabay, Pexels, Sketchfab, Google) e o token do Claude;
- `PASTA_TEMP`: pasta dos temporários dos renders, por exemplo noutro disco com mais espaço.

### Ficheiros grandes noutro disco
Os renders não copiam a `public/` (o bundle liga-se a ela por junção). As pastas grandes (`out/`, `lixeira/`,
`public/uploads`, `public/videos`, `public/gameplay`, `public/modelos/polyhaven`, `public/modelos3d`) podem viver
noutro disco com uma junção no mesmo caminho (`mklink /J pasta D:\Studioware\pasta`); o painel move ficheiros entre
discos sem problema.

### Fonte das legendas
As legendas usam a fonte Keep Calm (K-Type), que é paga para uso comercial e não vem no repositório: coloque o
ficheiro em `public/fontes/keep-calm.ttf`. Sem ele, as legendas usam a fonte do estilo. Distribuir o Studioware
com a fonte incluída exige a Enterprise Licence da K-Type.

## Licença
Proprietário, todos os direitos reservados (ver `LICENSE`). Componentes de terceiros: `THIRD_PARTY_NOTICES.md`.
