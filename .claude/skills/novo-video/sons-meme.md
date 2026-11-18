# Sons de efeito populares (portfólio de SFX)

Sons de meme e de edição que o público reconhece, marcados num momento exato da fala. Usam-se com moderação:
**no máximo 2 por corte de 30 a 60 s** (3 num vídeo longo), nunca dois seguidos, e só quando o momento pede mesmo.
Um som certo no sítio certo prende; um som em cada frase cansa e parece amador. Prefira o som que combina com o
**tom do canal** e da frase; não use nenhum num tema sério (morte, doença, tragédia, notícias tristes).
Os sons de "Trilha de momento" são trechos de música: servem para um momento de 5 a 8 s, não para o vídeo todo.

## Formato

- Nos cortes (resposta dos exemplos visuais): `"sons": [{"nome": "<id>", "em": 12.3}]`, com `em` em segundos do corte
  (o tempo da palavra onde o som entra, tirado da transcrição).
- Nas cenas de um roteiro narrado: `"som": {"nome": "<id>", "em": 1.2}` dentro da cena, com `em` em segundos desde o
  início dessa cena (sem `em`, toca no início da cena).

## Catálogo (`id`: quando usar; onde marcar)

### Suspense e tensão
- `sino` (Sino do Undertaker): Suspense ou tensão antes de algo impactante: revelação absurda, notícia chocante, virada inesperada. Marcar logo antes da revelação (na pausa ou na palavra que a anuncia).
- `dexter` (Piano sombrio (Dexter)): Plano suspeito, pensamento maligno, alguém a tramar algo. Marcar no começo da frase suspeita.
- `among_us` (Among Us (troll face)): Algo suspeito ('sus'), alguém a mentir, um plano estranho. Marcar logo depois da frase suspeita.
- `mentality` (Mentality (dark talk)): Frase fria de 'mentalidade', verdade dura dita sem emoção (edit sigma). Marcar logo depois da frase.
- `hells_kitchen` (Suspense do Hell's Kitchen): Expectativa antes de um resultado, veredito ou nota. Marcar antes do resultado.
- `misterio` (Som misterioso): Algo estranho, pergunta intrigante, uma pista. Marcar antes da revelação.

### Impacto e erro
- `hit` (Hit do Minecraft): Impacto, erro, susto ou dano: alguém leva um susto, erra uma jogada, recebe uma crítica. Marcar na palavra do impacto (errou, caiu, bateu).
- `osso` (Osso a partir): Dor exagerada, uma queda, uma resposta que 'parte' alguém. Marcar no momento do impacto.
- `flashbang` (Flashbang): Revelação que cega: informação absurda de repente, tela branca, choque. Marcar na revelação.
- `vidro` (Vidro a partir): Algo se quebra: expectativa, coração, sonho, recorde. Marcar no momento da quebra.
- `cano` (Cano de metal a cair): Barulho absurdo e inesperado: algo cai, susto cómico. Marcar no momento.
- `bong` (Bong (Taco Bell)): Punchline, plot twist, a frase que encerra a discussão. Marcar na palavra final.
- `leon_morte` (Morte do Leon (Resident Evil)): Alguém 'morre' (cómico): leva uma resposta fatal, falha feio. Marcar no momento.
- `you_died` (You died (game over)): Fracasso total, game over, morte cómica. Marcar logo depois da falha.
- `frigideira` (Frigideira (PUBG)): Golpe, pancada, levar com uma resposta. Marcar no impacto.

### Ambiente e clima
- `caverna` (Ambiente de caverna (Minecraft)): Mistério, exploração, solidão ou perigo: investigação, lugar abandonado, história assustadora. Marcar no começo do trecho misterioso.
- `casa_avo` (Casa da avó (relógio e geladeira)): Silêncio constrangedor, ninguém responde, momento parado e nostálgico. Marcar no começo da pausa.
- `geladeira` (Geladeira (silêncio de casa)): Calma noturna, silêncio, momento parado em casa. Marcar no começo.
- `trovao` (Trovão): Revelação sombria, ameaça, tempestade, momento dramático. Marcar na revelação.

### Reação e comédia
- `rizz` (Rizz): Atitude charmosa, confiante ou sedutora: cantada boa, jogada estilosa, muito carisma. Marcar logo depois da frase ou da jogada, como reação.
- `sirene_999` (Sirene de -999): Alguém faz algo muito errado, vergonhoso ou perde todo o respeito (o '-999 de aura'). Marcar logo depois da frase ou da ação vergonhosa.
- `english_spanish` (English or Spanish? (Static)): Impasse ou momento de congelar: todos parados, olhar fixo, quem reage primeiro. Marcar no começo do silêncio.
- `fahhh` (Fahhh): Frustração, choque ou o momento exato em que algo dá errado. Marcar no momento da falha.
- `get_out` (Get out!): Quando alguém diz algo absurdo ou inaceitável: expulsar a ideia. Marcar logo depois da frase.
- `god_damn` (God damn!): Algo impressionante: número absurdo, jogada incrível, resultado inesperado. Marcar logo depois.
- `lula_molusco` (Lula Molusco a andar): Sair de fininho, ir embora sem graça, caminhada desconfortável. Marcar no começo do momento.
- `risada_brinquedo` (Risada de brinquedo): Depois de uma piada ruim ou de alguém que se deu mal. Marcar logo depois.
- `brain_fart` (Peido cerebral): Ideia burra, cérebro a falhar, alguém sem entender nada. Marcar na pausa de confusão.
- `rdr2_honra` (Honra baixa (RDR2)): Atitude errada, perder honra ou respeito, má decisão. Marcar logo depois.
- `mewing` (Bye bye (mewing)): Alguém fica por cima, resposta convencida, ir embora com estilo. Marcar depois da frase.
- `don_pollo` (Don Pollo): Nonsense total, brainrot, situação absurda sem sentido. Marcar no começo.
- `ninar` (Móbil de bebé): Momento fofo ou ingénuo, alguém a agir como criança, inocência. Marcar no começo.
- `gargalhada` (Gargalhada): Algo hilariante, rir de alguém. Marcar logo depois.
- `im_trapped` (I'm trapped): Sentir-se preso numa situação sem saída. Marcar na frase.
- `rizz_tiktok` (Rizz (versão TikTok)): Cantada ou charme, na versão mais longa e musical. Marcar logo depois.
- `gosling` (Ryan Gosling (polegar para cima)): Mudança de opinião: começou mal e terminou bem. Marcar na virada.
- `esqueleto` (Esqueleto no inferno): Situação infernal, caos total, castigo cómico. Marcar no começo.
- `dont_know_me` (They don't know me, son): Alguém subestimado que surpreende, confiança. Marcar logo depois.
- `quilometro` (WTF is a kilometre): Unidades ou números absurdos, comparação EUA contra o resto do mundo. Marcar logo depois da frase.
- `we_dont_care` (We do not care): Algo irrelevante, desdém, 'ninguém quer saber'. Marcar logo depois.
- `piscadela` (Piscadela): Cumplicidade, insinuação, um segredo. Marcar na frase.
- `escrever_fogo` (Escrever com fogo): Anotar algo com determinação intensa, decisão tomada. Marcar no começo.
- `yoshi` (Yoshi (mlem)): Comer, engolir algo, gula. Marcar no momento.
- `amarillo` (Amarillo plátano): Nonsense, algo tolo e absurdo. Marcar no começo.
- `nokia_arabe` (Nokia árabe): Toque de telemóvel antigo, chamada inesperada. Marcar no momento.
- `bacon_burger` (Barbecue bacon burger): Comida, fome, gula exagerada. Marcar na frase da comida.
- `risos_plateia` (Risos de plateia): Depois de uma piada ou situação ridícula (como numa sitcom). Marcar logo depois.

### Transição
- `bass_drop` (Bass drop): A entrada de algo grande: a revelação, o momento em que tudo cai, a mudança de cena. Marcar na palavra da revelação.
- `optimus` (Transformação (Optimus Prime)): Transformação, glow up, antes e depois, mudança radical. Marcar na mudança.
- `camara_lenta` (Câmara lenta): Momento épico ou dramático em câmara lenta, segundos antes do impacto. Marcar no começo do momento.
- `spawn` (Spawn (aparecer)): Alguém ou algo aparece de repente, entrada em cena. Marcar na entrada.
- `katana` (Katana): Corte rápido, resposta afiada, mudança brusca de cena. Marcar na palavra.
- `netflix` (Netflix (tudum)): Começo de uma história, 'o episódio de hoje', apresentação dramática. Marcar no começo da história.
- `tom_desce` (Tom a descer): Algo diminui ou cai: preço, nota, energia. Marcar no momento.
- `tom_sobe` (Tom a subir): Algo sobe ou cresce: preço, nível, hype, antes de revelar. Marcar antes da revelação.
- `guitarra` (Riff de guitarra): Entrada estilosa, revelar algo fixe. Marcar na entrada.

### Vitória e hype
- `moedas` (Moedas (coletar ouro)): Ganho, dinheiro, recompensa, um ponto ganho. Marcar no número ou no ganho.
- `escudo_fortnite` (Poção de escudo (Fortnite)): Recuperar energia: café, energético, descanso, 'carregar a bateria'. Marcar no momento em que bebe ou recupera.
- `travis` (Travis Scott (ad-lib)): Flex, momento estiloso, hype. Marcar logo depois.
- `poppin_bottles` (Poppin bottles): Celebração, festa, ganhar dinheiro, flex. Marcar no começo da celebração.
- `aplausos` (Multidão a aplaudir): Conquista, recorde, final feliz. Marcar logo depois da conquista.

### Tristeza e drama
- `pinguim` (Pinguim deprimido (tema do Guts)): Alguém segue sozinho, desiste de tudo e vai embora, decisão solitária. Marcar no começo do momento.
- `sunshine` (You Are My Sunshine): Ironia triste: algo bonito antes de dar errado, humor negro suave. Marcar no começo.
- `batman_triste` (Batman triste): Tristeza dramática exagerada, decepção. Marcar no começo.
- `libet` (Libet's Delay (slowed)): Reflexão melancólica, uma realização triste, ironia sombria. Marcar no começo.
- `wake_up` (Wake up to reality): Choque de realidade, um sonho que acaba. Marcar na frase.

### Trilha de momento
- `musica_francesa` (Música francesa (meme)): Momento absurdo e fofinho, nonsense, algo 'chique' exagerado. Marcar no começo do momento.
- `super_idol` (Super Idol): Felicidade irónica, algo 'perfeito demais', sucesso exagerado. Marcar no começo.
- `ballin` (Ballin): Ostentação, 'a viver bem', rico, sucesso. Marcar no começo.
- `real_talk` (Real talk): Conversa séria: 'agora a sério', a verdade. Marcar no começo.
- `sax_relax` (Saxofone relax): Momento romântico ou suave exagerado, sedução cómica, tranquilidade. Marcar no começo.
- `sunrise_war` (Sunrise War): Preparação para uma batalha, desafio épico, motivação. Marcar no começo.
- `superman` (Superman (meme)): Herói inesperado, salvar o dia, alguém exageradamente heroico. Marcar no começo.
- `flauta_feliz` (Flauta feliz): Alegria ingénua, tudo corre bem demais (ironia). Marcar no começo.
- `quarto_hotel` (Quarto de Hotel (speed up)): Descontração, vibe relax e engraçada. Marcar no começo.

### Interface e pop-up
- `level_up` (Ding mágico (level up)): Ideia brilhante, subir de nível, conquista, algo que melhora. Marcar na palavra da conquista.
- `errado` (Resposta errada): Resposta errada, palpite falhado, erro. Marcar na palavra do erro.
- `mensagem` (Mensagem (notificação)): Chega uma mensagem ou notificação, alguém manda algo. Marcar no momento.
- `pergunta` (Pergunta): Uma pergunta ao público, dúvida. Marcar na pergunta.
- `selecao` (Seleção suave): Escolher uma opção, selecionar ou destacar um item. Marcar no momento.
- `certo` (Resposta certa): Acerto, resposta correta. Marcar na palavra.
- `atirar_fora` (Atirar fora): Descartar algo, ideia rejeitada, deitar ao lixo. Marcar no momento.

### Nostalgia e tecnologia
- `win95` (Windows 95 a ligar): Algo antigo, tecnologia velha, 'no meu tempo', começar algo. Marcar no começo.
- `winxp_liga` (Windows XP a ligar): Começar algo, nostalgia dos anos 2000, alguém 'a ligar'. Marcar no começo.
- `winxp_desliga` (Windows XP a desligar): Fim, desistir, alguém que 'desligou' de cansaço, encerrar o assunto. Marcar no fim da frase.
- `ps2` (PS2 a ligar): Infância, jogos antigos, flashback. Marcar no começo do flashback.
