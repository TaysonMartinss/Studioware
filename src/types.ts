export type Palavra = { texto: string; inicioMs: number; fimMs: number };

export type Spec = { label: string; valor: number };

// Imagem ou b-roll real. O roteiro diz onde procurar; scripts/buscar_midia.py descarrega e preenche "arquivo".
export type Midia = {
  fonte: "steam" | "wikimedia" | "pixabay" | "pexels" | "url" | "arquivo" | "sketchfab" | "procedural";
  consulta?: string; // nome do jogo, termo de pesquisa ou URL direta
  tipo?: "imagem" | "video" | "modelo3d"; // preferência
  indice?: number; // qual resultado usar (0 = primeiro)
  arquivo?: string; // caminho dentro de public/
  formato?: "imagem" | "video" | "modelo3d"; // modelo3d: arquivo é um .glb ou "procedural:gpu|cpu|ram|ssd"
  duracaoS?: number;
  inicioS?: number; // salta o início (ex.: logos de trailers)
  credito?: string;
};

type Base = {
  fala: string;
  midia?: Midia;
  // Preenchidos pelo scripts/narrar.py
  audio?: string;
  duracaoMs?: number;
  palavras?: Palavra[];
};

export type CenaGancho = Base & {
  tipo: "gancho";
  texto_tela: string;
  icone?: string; // nome Lucide (lucide.dev/icons)
  emoji?: string; // obsoleto: convertido para ícone
};

export type CenaProduto = Base & {
  tipo: "produto";
  rank?: number; // sem rank = revelação do produto num vídeo de storytelling
  etiqueta?: string; // texto do selo no topo quando não há rank (ex.: "A SOLUÇÃO")
  categoria: string;
  // gpu | cpu | ram | ssd | monitor | periferico — escolhe o ícone animado
  icone?: string;
  nome: string;
  preco: string;
  selo?: string;
  tags?: string[];
  specs?: Spec[];
  imagem?: string; // caminho dentro de public/
};

// Curiosidade/facto: título curto no topo + mídia real em destaque
export type CenaFato = Base & {
  tipo: "fato";
  numero?: number;
  kicker?: string; // etiqueta acima do título (ex.: "Depois de uma hora" num E se?); por defeito "Curiosidade nº…"
  titulo: string;
  icone?: string;
  emoji?: string;
};

// Gráfico que se desenha sozinho (barras ou linha)
export type CenaGrafico = Base & {
  tipo: "grafico";
  titulo: string;
  grafico: "barras" | "linha";
  dados: { rotulo: string; valor: number }[];
  unidade?: string; // ex.: "FPS", "milhões", "%"
  destaque?: number; // índice do ponto/barra em destaque
};

// Linha do tempo com eventos a aparecer
export type CenaLinhaTempo = Base & {
  tipo: "linha_tempo";
  titulo: string;
  eventos: { ano: string; texto: string; icone?: string; emoji?: string }[];
};

// Animação matemática/científica feita em Manim (Python). "codigo" define uma classe Cena(Scene).
// scripts/manim_cenas.py renderiza para mp4 e preenche midia.
export type CenaManim = Base & {
  tipo: "manim";
  titulo?: string;
  codigo: string;
};

// Vídeo gravado pelo criador: cortado pelo Auto-Editor e transcrito pelo Whisper (scripts/transcrever.mjs)
export type CenaClipe = Base & {
  tipo: "clipe";
  bruto: string; // caminho em public/ do vídeo original
  cortar?: boolean; // cortar silêncios (padrão: sim)
  margem?: number; // segundos mantidos à volta da fala
  titulo?: string;
  // b-roll: cartão por cima do vídeo, ou (cheio) exemplo de ecrã inteiro com a pessoa num canto e a voz a continuar
  broll?: { inicioMs: number; fimMs: number; midia?: Midia; cena?: CenaLowPoly | CenaPincel; cheio?: boolean }[];
  exemplos?: boolean; // pedir ao Claude exemplos visuais (scripts/exemplos_clipe.mjs)
  exemplosFeitos?: boolean;
  inicio?: number; fim?: number; // momento de um vídeo longo (segundos do original); o script recorta-o
  enquadrar?: boolean; // vídeo horizontal: seguir o rosto no vertical (padrão: sim)
  // preenchidos pelo script
  enquadramento?: {
    modo: "seguir" | "geral" | "passa" | "webcam"; largura: number; altura: number; fps: number; cropLargura?: number; xs?: number[];
    // webcam: gameplay com webcam por cima; cada trecho diz onde está a webcam (cam), ou que a edição foi para a webcam em ecrã cheio (rosto), ou que não há rosto (geral)
    segmentos?: { de: number; cam?: [number, number, number, number]; rosto?: [number, number, number, number]; geral?: boolean }[];
  };
  arquivo?: string;
  largura?: number;
  altura?: number;
};

// Número de impacto que conta até ao valor (estatística, preço, tempo)
export type CenaNumero = Base & {
  tipo: "numero";
  valor: number;
  prefixo?: string; // ex.: "R$ "
  sufixo?: string; // ex.: "%", " mil", "x"
  texto: string; // o que o número significa (curto)
  icone?: string;
  emoji?: string;
  alerta?: boolean; // tom de perigo (cor vermelha), para o "problema" da história
};

// Antes x depois / sem x com / produto A x B
export type LadoComparacao = { rotulo: string; itens: string[]; midia?: Midia; icone?: string; emoji?: string };
export type CenaComparacao = Base & {
  tipo: "comparacao";
  titulo?: string;
  esquerda: LadoComparacao;
  direita: LadoComparacao;
  vencedor?: "esquerda" | "direita";
};

// Modelo 3D (GLB/GLTF) a girar, a explodir em peças ou com a câmara a aproximar-se.
// Sem ficheiro, usa um modelo procedural de hardware (gpu, cpu, ssd, ram).
export type Modelo3D = {
  fonte?: "arquivo" | "url";
  consulta?: string; // caminho em public/ ou URL de um .glb
  arquivo?: string; // preenchido por scripts/buscar_midia.py
  credito?: string;
};
export type Etiqueta3D = { texto: string; ancora: "topo" | "frente" | "lado" | "base" | "centro"; inicioS?: number };
export type CenaModelo3D = Base & {
  tipo: "modelo3d";
  titulo?: string;
  kicker?: string;
  modelo?: Modelo3D;
  procedural?: "gpu" | "cpu" | "ssd" | "ram";
  animacao?: "girar" | "explodir" | "aproximar" | "revelar";
  etiquetas?: Etiqueta3D[];
};

// Abertura de capítulo nos vídeos longos (16:9): número grande + título; vira marcador de capítulo do YouTube
export type CenaCapitulo = Base & {
  tipo: "capitulo";
  numero?: number;
  titulo: string;
  kicker?: string;
};

export type CenaCta = Base & {
  tipo: "cta";
  texto_tela: string;
  botao?: string;
  // seguir (padrão) | link = "link na bio" para comprar | comentar = "comenta PALAVRA que eu mando o link"
  acao?: "seguir" | "link" | "comentar";
  palavra?: string; // para acao "comentar"
};

// Quiz: pergunta e opções; depois da fala há `segundos` de contagem em silêncio (o narrar.py junta-os à duração)
export const QUIZ_SEGUNDOS = 5;
export const QUIZ_REVELA_MS = 1300; // "TEMPO!" e a resposta certa a acender
export type CenaQuiz = Base & {
  tipo: "quiz";
  pergunta: string; // curta, vai em letras grandes
  opcoes: string[]; // 2 a 4; a fala lê-as pela mesma ordem e com as mesmas palavras
  resposta?: number; // índice da certa (0 = A); acende a verde no fim da contagem
  numero?: number; // "Pergunta 2 de 5"
  total?: number;
  segundos?: number; // tempo para responder (padrão 5)
  falaMs?: number; // preenchido pelo narrar.py: quando acaba a fala e começa a contagem
};

// Animação 3D low poly (motor próprio em src/lowpoly): cenário, personagens com ações, câmara e título
export type Posicao3D = "esquerda" | "centro" | "direita" | "fundo" | [number, number];
export type PersonagemLowPoly = {
  nome?: string; // para outra personagem olhar para esta
  visual?: "pessoa" | "jogador" | "arbitro" | "gamer" | "cientista" | "astronauta" | "crianca" | "executivo" | "mergulhador" | "medico" | "alienigena" | "robo" | "piloto" | "piloto_capacete" | "mecanico" | "relojoeiro";
  cor?: string; pele?: string; cabelo?: string;
  acao?: "parado" | "andar" | "correr" | "acenar" | "apontar" | "celebrar" | "choque" | "pensar" | "falar" | "encolher" | "bracos_cruzados" | "chutar" | "torcer" | "dancar" | "sentar" | "digitar" | "apitar" | "cartao" | "var" | "cair" | "flutuar" | "triste";
  expressao?: "neutro" | "feliz" | "triste" | "choque" | "bravo" | "pensativo" | "convencido";
  posicao?: Posicao3D;
  destino?: Posicao3D; // anda (ou corre, com acao "correr") até aqui durante a cena
  olhar?: string; // "camera" (padrão), "esquerda", "direita", "fundo" ou o nome de outra personagem
  segura?: "cartao_amarelo" | "cartao_vermelho" | "apito" | "celular" | "trofeu" | "bola" | "bandeira" | "portatil" | "comando" | "geiger" | "bandeira_xadrez" | "bandeira_brasil" | "champanhe" | "dinheiro" | "pinca" | "relogio";
  fala?: boolean; // a boca mexe enquanto a narração fala
  rotulo?: string; // etiqueta 3D por cima da cabeça
};
export type ObjetoLowPoly = {
  tipo: "foguetao" | "satelite" | "estacao" | "asteroide" | "atomo" | "molecula" | "adn" | "celula" | "vulcao"
    | "cubo" | "esfera" | "piramide" | "cilindro" | "cone" | "dodecaedro" | "icosaedro" | "toro" | "superficie" | "eixos"
    | "explosao" | "fogo" | "fumo" | "bola" | "trofeu" | "frasco" | "tiranossauro" | "braquiossauro" | "pterossauro" | "tubarao" | "baleia" | "cardume" | "ovni" | "vaca" | "cristal" | "portal" | "cogumelo" | "bomba" | "missil" | "bombardeiro" | "radiacao" | "carro_f1" | "velas" | "seta" | "touro" | "urso" | "moedas" | "dinheiro" | "empresa" | "modelo" | "placa_mae" | "processador" | "placa_de_video" | "memoria_ram" | "ssd" | "cooler" | "fonte" | "console" | "controle" | "tv" | "codigo" | "motor_jogo" | "arte_3d" | "som" | "nivel" | "bug" | "relogio" | "mecanismo" | "engrenagens" | "escape" | "mola_real" | "rubi" | "lingotes" | "fundicao" | "maquina_cnc" | "tanque_agua";
  modelo?: string; // tipo "modelo": "pack/nome" do catálogo (.claude/skills/novo-video/modelos-lowpoly.md)
  rotacao?: number; // graus (0 = de frente para a câmara)
  posicao?: Posicao3D | [number, number, number];
  quando?: number; // segundos desde o início da cena (descolagem, impacto, erupção, explosão)
  escala?: number;
  cor?: string;
  cor2?: string; // segunda cor (carro_f1: asas e riscas)
  variante?: string; // molecula: agua | co2 | metano | oxigenio | amonia; superficie: onda | sela | paraboloide | gaussiana | seno; ovni: abduzir; dinossauros: andar | rugir | parado; bomba: redonda | comprida; bombardeiro: largar; carro_f1: parado | andar (passa pela posição em `quando`); velas: alta | queda | volatil; seta: sobe | desce; touro: parado | andar | investir; urso: parado | atacar; moedas: crescer | cair; dinheiro: chuva; console: pronto | montar | explodir; controle: jogar; tv: ligar; bug: corrigido; relogio: pronto | explodir | traseira | quartzo; mecanismo: automatico; mola_real: dar_corda; lingotes: ouro | aco | platina
  rotulo?: string; // etiqueta 3D presa ao objeto
};
export type CenaLowPoly = Base & {
  tipo: "lowpoly";
  cenario: "estadio" | "cidade" | "quarto" | "natureza" | "planeta" | "espaco" | "laboratorio" | "estudio"
    | "fundo_mar" | "pre_historia" | "corrida" | "sala_aula" | "sala_estar" | "hospital" | "nave" | "planeta_alien" | "abrigo" | "bolsa" | "estudio_jogos" | "oficina_relojoaria" | "boutique_luxo";
  hora?: "dia" | "tarde" | "noite";
  variante?: string; // natureza: floresta | deserto | neve; planeta: sol | mercurio | venus | terra | lua | marte | jupiter | saturno | urano | neptuno; espaco: sistema_solar | buraco_negro | escala | vazio; corrida: chuva | boxes | podio | vazia; bolsa: alta | queda; cidade: ruinas
  corpos?: string[]; // espaco "escala": que corpos comparar (ex.: ["terra", "jupiter", "sol"])
  objetos?: ObjetoLowPoly[];
  rotulos?: boolean; // nomes dos planetas no sistema solar e na escala (padrão: só na escala)
  plano?: "aberto" | "medio" | "close";
  camera?: "suave" | "estatica" | "aproximar" | "afastar" | "orbitar" | "travelling" | "seguir";
  festa?: boolean; // estádio: o público salta (golo, título)
  personagens?: PersonagemLowPoly[];
  titulo?: string;
  etiqueta?: { texto: string; marca?: "certo" | "errado" };
};

// Ilustração desenhada à mão (p5.brush): elementos que se desenham traço a traço sobre papel
export type PosPincel = "centro" | "esquerda" | "direita" | "topo" | "baixo" | "topo_esquerda" | "topo_direita" | "baixo_esquerda" | "baixo_direita" | [number, number];
export type ElementoPincel = {
  tipo: "icone" | "texto" | "seta" | "circulo" | "sublinhado" | "x" | "visto" | "barras" | "linha";
  nome?: string; // icone: nome da Lucide (ex.: "rocket", "piggy-bank")
  texto?: string; // texto: frase curta em letra manuscrita
  rotulo?: string; // icone: legenda por baixo
  posicao?: PosPincel; // onde fica (frações da área útil, [x, y] de 0 a 1); sem posição, o estúdio distribui
  tamanho?: number; // 1 = normal
  cor?: string; // cor da aguarela (icone, barras, linha) ou do traço (seta, circulo…); "nenhuma" tira a mancha do ícone
  traco?: "caneta" | "lapis" | "marcador" | "carvao" | "giz";
  quando?: number; // segundo em que começa a desenhar-se (padrão: um a seguir ao outro)
  duracao?: number;
  de?: PosPincel | number; para?: PosPincel | number; // seta: índice de outro elemento ou posição
  alvo?: PosPincel | number; // circulo, sublinhado, x, visto: índice do elemento ou posição
  valores?: number[]; rotulos?: string[]; formatos?: string[]; cores?: string[]; // barras e linha
};
export type CenaPincel = Base & {
  tipo: "pincel";
  papel?: "papel" | "branco" | "caderno" | "quadro";
  titulo?: string;
  elementos?: ElementoPincel[];
  tremer?: boolean; // o traço treme como numa animação desenhada (padrão: sim)
};

export type Cena = CenaGancho | CenaQuiz | CenaLowPoly | CenaPincel | CenaProduto | CenaFato | CenaGrafico | CenaLinhaTempo | CenaManim | CenaClipe | CenaNumero | CenaComparacao | CenaModelo3D | CenaCapitulo | CenaCta;

export type Manifest = {
  id: string;
  titulo: string;
  formato?: "quiz" | "livre" | "ese" | "animado" | "ranking" | "storytelling" | "curiosidades" | "explicativo" | "clipe" | "longo";
  cor?: string; // sobrepõe a cor do estilo
  estilo?: string; // chave de src/estilos.json
  narracao?: "edge" | "elevenlabs";
  voz?: string;
  velocidade?: string;
  destaques?: string[];
  emojis?: Record<string, string>; // palavra-chave → emoji que salta ao lado da legenda
  // no roteiro: "auto" | "nenhuma" | clima (energetica, tensa, ambiente, synthwave, lofi) | caminho em public/
  // no manifest final: caminho do ficheiro escolhido (scripts/produzir.mjs resolve)
  musica?: string;
  musicaVolume?: number; // multiplicador (1 = normal)
  thumbnail?: string; // texto curto para a capa (3 a 5 palavras)
  legenda_post?: string; // legenda pronta para a publicação (hashtags e créditos)
  sfxVolume?: number; // efeitos sonoros: 0 = sem efeitos, 1 = normal
  marcaDagua?: boolean; // logo + @ do canal (padrão: sim)
  canal?: string; // qual canal (chave de src/canais.json); padrão duckexplica
  cenas: Cena[];
  // vídeo longo: trechos que funcionam sozinhos e viram Shorts (índices das cenas, inclusive)
  cortes?: Corte[];
};

export type Corte = {
  titulo: string;
  inicio: number;
  fim: number;
  gancho: { texto_tela: string; fala: string };
};

export const FPS = 30;
export const PAD_MS = 250;

export const framesDaCena = (c: Cena) =>
  Math.ceil((((c.duracaoMs ?? 3000) + PAD_MS) / 1000) * FPS);
