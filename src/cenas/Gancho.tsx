import { AbsoluteFill, Sequence, random, useVideoConfig } from "remotion";
import { Glitch } from "../components/Glitch";
import { Icone } from "../components/Icone";
import { MidiaFundo } from "../components/MidiaReal";
import { FONTES, pop, shake, useCaber, useFontes, useFrame } from "../components/motion";
import { ESCALA, Revelar, bounce6, useBrilho, useMargem, useSombra, useTracking, useWiggle } from "../components/ui";
import { SomSfx, Sfx } from "../components/Sfx";
import { AberturaPapel, useFerver } from "../components/PapelMotion";
import { useEstilo } from "../estilos";
import { CenaGancho } from "../types";

const INTERVALO = 5;

// Uma letra recortada à tesoura: polígono de pontas retas, papel e fonte sorteados, sombra curta e dura, a tremer
const FONTES_RESGATE = ["anton", "marker", "serif", "mono", "montserrat"];
const LetraRecortada: React.FC<{ letra: string; semente: string; tamanho: number }> = ({ letra, semente, tamanho }) => {
  const e = useEstilo();
  const w = useWiggle(`letra${semente}`, 8);
  const ferver = useFerver();
  const papeis = ["#fffdf6", "#f1e3c6", e.cor, e.cor2, "#1d1a16", "#d9d4c7"];
  const fundo = papeis[Math.floor(random(`pf${semente}`) * papeis.length)];
  const escuro = ["#1d1a16", e.cor, e.cor2].includes(fundo);
  const fonte = FONTES[FONTES_RESGATE[Math.floor(random(`ff${semente}`) * FONTES_RESGATE.length)]];
  const escala = 0.85 + random(`fs${semente}`) * 0.3;
  // 6 cantos com cortes retos irregulares
  const pts = [[0, 0], [100, 0], [100, 50], [100, 100], [0, 100], [0, 50]].map(([x, y], k) =>
    `${x + (random(`px${semente}${k}`) - 0.5) * 14}% ${y + (random(`py${semente}${k}`) - 0.5) * 14}%`).join(", ");
  return (
    <span style={{ display: "inline-block", filter: ferver(`letra${semente}`, "drop-shadow(5px 5px 1px rgba(0,0,0,0.4))"), transform: `translate(${w.x}px, ${w.y}px) rotate(${(random(`fr${semente}`) - 0.5) * 16 + w.r}deg)`, margin: "0 2px" }}>
      <span style={{ display: "inline-block", background: fundo, color: escuro ? "#fffdf6" : "#1d1a16", fontFamily: fonte, fontSize: tamanho * escala, lineHeight: 1.1, padding: `${tamanho * 0.06}px ${tamanho * 0.12}px`, clipPath: `polygon(${pts})` }}>
        {letra}
      </span>
    </span>
  );
};

// Gancho dos primeiros segundos: palavras entram uma a uma com peso, a última na cor do estilo
export const Gancho: React.FC<{ cena: CenaGancho; cor: string }> = ({ cena, cor }) => {
  const MARGEM = useMargem();
  const f = useFrame();
  const { fps } = useVideoConfig();
  const e = useEstilo();
  const { titulo } = useFontes();
  const caber = useCaber();
  const brilho = useBrilho();
  const sombra = useSombra();
  const tracking = useTracking();
  const palavras = cena.texto_tela.split(/\s+/);
  const gatilhos = palavras.map((_, i) => 2 + i * INTERVALO);
  const fimPalavras = gatilhos[gatilhos.length - 1];
  const papel = e.tema === "papel";
  // editorial (Vox): a palavra-chave leva o marcador amarelo por trás, em vez de ficar amarela no papel creme
  const marcador = e.textura === "jornal";
  // a palavra mais comprida define o tamanho, para nenhuma ficar partida
  const maior = palavras.reduce((a, b) => (b.length > a.length ? b : a), "");
  const tamanho = caber(maior, 1080 - MARGEM * 2, papel ? 140 : ESCALA.display);
  const recortes = ["#fffdf6", e.cor, "#f1e3c6", e.cor2, "#1d1a16"];
  const icone = cena.icone ?? cena.emoji;

  return (
    <AbsoluteFill style={{ transform: shake(f, gatilhos, 20 * e.shake) }}>
      <MidiaFundo midia={cena.midia} opacidade={0.85} desfoque={4} />
      {/* papel: abre com uma folha amassada a desdobrar-se em menos de 1 s */}
      {papel && <AberturaPapel />}
      {/* cada palavra entra com um "pop up" suave, cada um um pouco mais agudo (o título vai "subindo") */}
      {gatilhos.map((g, i) => (
        <Sequence key={i} from={g} durationInFrames={15} layout="none">
          <Sfx nome={`popup-${Math.min(i, 3) + 1}` as SomSfx} volume={0.3} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top: 260, left: MARGEM, right: MARGEM, textAlign: "center" }}>
        <Glitch inicio={fimPalavras} semente="gancho">
          <div style={{ fontFamily: titulo, fontSize: tamanho, lineHeight: papel ? 1.25 : 0.98, color: e.corTexto, textTransform: "uppercase", letterSpacing: papel ? undefined : tracking }}>
            {palavras.map((p, i) => {
              const s = pop(f, fps, gatilhos[i], 13);
              const ultima = i === palavras.length - 1;
              if (papel) {
                // carta de resgate: cada letra é um recorte de revista diferente, colado aos solavancos (sem easing)
                return (
                  <span key={i} style={{ display: "inline-flex", margin: "8px 16px", opacity: f >= gatilhos[i] ? 1 : 0 }}>
                    {[...p].map((letra, k) => <LetraRecortada key={k} letra={letra} semente={`${i}-${k}`} tamanho={tamanho} />)}
                  </span>
                );
              }
              if (e.entrada === "mascara" || e.entrada === "escrever") {
                // corporativo (sobe de trás de uma máscara) e ciência (escrito a giz), palavra a palavra
                return (
                  <Revelar key={i} inicio={gatilhos[i]} duracao={e.entrada === "escrever" ? 10 : 12} style={{ display: "inline-block", margin: "0 0.12em", opacity: f >= gatilhos[i] ? 1 : 0, ...(ultima && (marcador ? { background: `linear-gradient(${cor}, ${cor}) left 60% / ${Math.min(1, Math.max(0, (f - gatilhos[i]) / 13)) * 100}% 64% no-repeat`, padding: "0 0.1em" } : { color: cor })) }}>
                    {p}
                  </Revelar>
                );
              }
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block", margin: "0 0.12em", opacity: f >= gatilhos[i] ? 1 : 0,
                    // kinetic: pop de 6 frames (0 → 118% → 96% → 100%); nos outros estilos, entrada de cima com peso
                    transform: e.entrada === "bounce" ? `scale(${bounce6(f - gatilhos[i])})` : `scale(${1.6 - 0.6 * s}) translateY(${(1 - s) * -20}px)`,
                    color: ultima ? cor : undefined,
                    textShadow: [sombra, ultima && e.brilho ? brilho(cor, 50) : undefined].filter(Boolean).join(", ") || undefined,
                  }}
                >
                  {p}
                </span>
              );
            })}
          </div>
        </Glitch>
        {/* o ícone segue o texto (não tem posição fixa), para nunca o tapar */}
        {icone && (
          <div style={{ marginTop: 56, display: "flex", justifyContent: "center", opacity: pop(f, fps, fimPalavras + 4, 14) }}>
            <Icone nome={icone} tamanho={150} cor={cor} traco={1.5} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
