import { icons } from "lucide-react";

// Ícones vetoriais (Lucide) em vez de emojis: traço consistente que herda a cor do estilo.
// O roteiro usa o nome em kebab-case de lucide.dev/icons (ex.: "shield-check", "gamepad-2").

// emojis de roteiros antigos -> ícone equivalente (os que não estão aqui deixam de aparecer)
const DE_EMOJI: Record<string, string> = {
  "⚡": "zap", "🛡️": "shield-check", "🛡": "shield-check", "🔌": "plug", "🎮": "gamepad-2", "💥": "flame", "🔥": "flame",
  "💸": "banknote", "💰": "wallet", "🚫": "ban", "🧠": "memory-stick", "💾": "hard-drive", "🖥️": "monitor", "🖥": "monitor",
  "🖱️": "mouse", "🖱": "mouse", "⌨️": "keyboard", "⌨": "keyboard", "🎧": "headphones", "🗄️": "server", "💻": "laptop",
  "💺": "armchair", "⚙️": "settings", "🔔": "bell", "📩": "mail", "🛒": "shopping-cart", "🏆": "trophy", "⏱️": "clock",
  "📈": "trending-up", "📉": "trending-down", "⚠️": "triangle-alert", "💡": "lightbulb", "🚀": "rocket", "👾": "ghost", "🕹️": "joystick",
  "🌈": "palette", "📅": "calendar", "🌍": "globe", "⭐": "star",
};

// atalhos para as categorias de hardware usadas em "icone" de produto
const ATALHOS: Record<string, string> = {
  gpu: "gpu", cpu: "cpu", ram: "memory-stick", ssd: "hard-drive", monitor: "monitor", mouse: "mouse", teclado: "keyboard",
  headset: "headphones", fonte: "plug-zap", gabinete: "server", console: "gamepad-2", notebook: "laptop", cadeira: "armchair",
  periferico: "gamepad-2",
};

const pascal = (nome: string) => nome.split(/[-_ ]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");

export const resolverIcone = (nome?: string) => {
  if (!nome) return undefined;
  const chave = DE_EMOJI[nome.trim()] ?? ATALHOS[nome.trim().toLowerCase()] ?? nome.trim().toLowerCase();
  return icons[pascal(chave) as keyof typeof icons];
};

export const Icone: React.FC<{ nome?: string; tamanho: number; cor: string; traco?: number; style?: React.CSSProperties }> = ({
  nome, tamanho, cor, traco = 1.75, style,
}) => {
  const Svg = resolverIcone(nome);
  if (!Svg) return null;
  return <Svg size={tamanho} color={cor} strokeWidth={traco} absoluteStrokeWidth={false} style={style} />;
};
