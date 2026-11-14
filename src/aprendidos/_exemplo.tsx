// Módulo de efeitos de EXEMPLO (referência para os estilos aprendidos; não está registado).
// Mostra as quatro peças: fundo animado, câmara 3D por cena com transição e motion blur, camada por cima e legendas.
import { AbsoluteFill, Camara3D, DesfoqueMovimento, Easing, interpolate, progresso, random, useTempo, type EfeitosEstilo } from "./_kit";

// fundo: degradê que respira devagar, com um brilho que atravessa o ecrã
const Fundo: React.FC<{ cor: string }> = ({ cor }) => {
  const { f, duracao } = useTempo();
  const a = interpolate(f, [0, duracao], [20, 340]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${a}deg, #0b0b14, #1a1030 60%, ${cor}55)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${30 + 40 * Math.sin(f / 60)}% 30%, ${cor}33, transparent 45%)` }} />
    </AbsoluteFill>
  );
};

// cena: entra com um empurrão de câmara (zoom + rotação 3D) e motion blur de chicote; sai a afastar-se
const Cena: React.FC<{ children: React.ReactNode; indice: number; duracao: number; cor: string }> = ({ children, indice, duracao }) => {
  const { f } = useTempo();
  const lado = random(`lado${indice}`) > 0.5 ? 1 : -1;
  const entrada = progresso(f, 0, 9, Easing.out(Easing.cubic));
  const saida = progresso(f, duracao - 6, duracao, Easing.in(Easing.cubic));
  const x = (f2: number) => (1 - progresso(f2, 0, 9, Easing.out(Easing.cubic))) * 600 * lado;
  const vx = x(f) - x(f - 1); // velocidade horizontal para o motion blur
  const dolly = interpolate(f, [0, duracao], [0, 60]); // a câmara avança devagar durante a cena
  return (
    <DesfoqueMovimento vx={vx}>
      <Camara3D x={x(f)} z={dolly - saida * 200} ry={(1 - entrada) * 18 * lado} escala={1 + (1 - entrada) * 0.12}>
        <AbsoluteFill style={{ opacity: Math.min(1, entrada * 1.4) * (1 - saida) }}>{children}</AbsoluteFill>
      </Camara3D>
    </DesfoqueMovimento>
  );
};

// por cima: vinheta suave (não tapa as legendas)
const Overlay: React.FC<{ cor: string }> = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, #00000088 100%)", pointerEvents: "none" }} />
);

export const efeitos: EfeitosEstilo = {
  Fundo, Cena, Overlay,
  // legendas: cada palavra salta com uma rotação aleatória; a ativa na cor do estilo, os destaques maiores
  legenda: {
    porPagina: 3, top: 1250, maiusculas: true,
    bloco: (e) => ({ fontFamily: "Anton, sans-serif", fontSize: 104, lineHeight: 1.1, gap: "0 24px" }),
    palavra: (e, cor, { s, ativa, destaque, semente }) => ({
      color: ativa ? cor : "#fff",
      transform: `scale(${(0.6 + 0.4 * s) * (destaque ? 1.15 : 1)}) rotate(${(random(semente) - 0.5) * 8 * (1 - s)}deg)`,
      WebkitTextStroke: "10px #000", paintOrder: "stroke fill", textShadow: "0 6px 0 #000",
    }),
  },
};
