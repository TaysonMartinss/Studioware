# Componentes de terceiros

O código próprio do Studioware é proprietário (ver `LICENSE`). Estes componentes de terceiros mantêm as suas licenças.

## Código e bibliotecas (dependências em `package.json` e instaladas à parte)
| Componente | Uso | Licença |
|---|---|---|
| Remotion (`remotion`, `@remotion/*`) | composição e render dos vídeos | Remotion License: gratuita até 3 pessoas; empresas maiores e venda do produto exigem licença de empresa (remotion.pro) |
| React, Three.js, React Three Fiber, drei | interface e 3D | MIT |
| p5.brush | cena `pincel` | MIT |
| Lucide (`lucide-react`, `lucide-static`) | ícones | ISC |
| whisper.cpp (via `@remotion/install-whisper-cpp`) | transcrição | MIT |
| Auto-Editor | corte de silêncios | Unlicense |
| OpenCV | deteção de rostos | Apache 2.0 |
| Chatterbox Multilingual (Resemble AI) | narração local | MIT |
| edge-tts | narração com as vozes do Microsoft Edge | GPL-3.0 (biblioteca); o uso das vozes depende dos termos da Microsoft |
| Manim | animações matemáticas | MIT |

## Código adaptado
- **openshorts** (github.com/mutonby/openshorts), MIT, Copyright (c) 2024 OpenShorts: lógica da câmara do
  enquadramento automático (`scripts/reframe.py`) e critérios de escolha de momentos (`server/cortes.mjs`,
  `.claude/skills/novo-video/cortes.md`). Licença completa em `scripts/licencas/openshorts-LICENSE.txt`.
- **claude-youtube**, MIT: base da skill `.claude/skills/youtube`.
- **Skills do Remotion** (remotion-dev/skills): `.claude/skills/remotion-*` e `.agents/skills`.

## Recursos
| Recurso | Pasta | Licença |
|---|---|---|
| Modelos 3D da Kenney (37 packs) | `public/modelos/kenney/` | CC0 1.0 (domínio público); licença de cada pack junto dos modelos |
| Modelo de rostos YuNet (opencv_zoo) | `modelos/face_detection_yunet_2023mar.onnx` | Apache 2.0 |
| Fontes (Google Fonts) | carregadas em tempo de execução | SIL Open Font License |
| Músicas em `public/musicas/` que estão no git | geradas por `scripts/gerar_musicas.py` | próprias |

## Fora do repositório (cada instalação traz os seus)
- Modelos do Sketchfab (`public/modelos3d/`): licença individual de cada modelo.
- Músicas importadas (YouTube Audio Library e outras): uso nos vídeos conforme a licença de cada faixa; não se redistribuem.
- Amostras de voz para clonar (`public/vozes/`): só com autorização da pessoa.
