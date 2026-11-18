import { useMemo } from "react";
import * as THREE from "three";
import { caixa, cilindro, entre, esfera, geo, lerp, mat, rng } from "./util";
import { Inst, Instancias } from "./Instancias";
import { Hora } from "./ambiente";
import { BandeiraBrasil } from "./F1";
import { Digitos } from "./Vicio";

// Pacote "política e economia do Brasil" (vídeos de opinião e análise; figuras genéricas, sem caras de pessoas reais):
//   - Brasilia: a Esplanada com o Congresso (duas torres, a cúpula da Câmara virada para cima e a do Senado para baixo),
//     o Planalto em colunas, o mastro com a bandeira e o espelho de água. Variante "protesto": multidão com bandeiras
//     e cartazes dos dois lados.
//   - Plenario: plenário da Câmara (bancadas verdes em semicírculo, deputados, mesa diretora, tribuna e o painel de
//     votação com SIM / NÃO a contar).
//   - Supermercado: corredor com prateleiras e o cartaz do preço a subir (inflação).
//   - Objetos: urna (urna eletrónica; "votar" carrega no CONFIRMA), mala_dinheiro (abre em `quando` e mostra as notas),
//     plataforma_petroleo (plataforma no mar com chama e a broca a rodar), pulpito (púlpito com microfone).

// ---------- Brasília ----------
const Congresso: React.FC = () => {
  const branco = mat("#eef0ee"), vidro = mat("#6f8aa0", { metal: 0.4, aspereza: 0.35 });
  return (
    <group>
      {/* plataforma horizontal */}
      <mesh position-y={1.6} geometry={caixa(34, 3.2, 14)} material={branco} />
      {/* cúpula da Câmara (para cima) à direita, do Senado (para baixo) à esquerda */}
      <mesh position={[7.5, 3.2 + 7.5 * (1 - Math.cos(Math.PI / 2.6)), 0]} rotation-x={Math.PI} geometry={geo("cupula-camara", () => new THREE.SphereGeometry(7.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6))} material={branco} />
      <mesh position={[-7.5, 3.2, 0]} geometry={geo("cupula-senado", () => new THREE.SphereGeometry(5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4))} material={branco} />
      {/* as duas torres com a passagem a meio */}
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, -5]}>
          <mesh position-y={16} geometry={caixa(2.6, 32, 7)} material={branco} />
          {Array.from({ length: 26 }, (_, i) => <mesh key={i} position={[x > 0 ? 1.31 : -1.31, 3 + i * 1.1, 0]} geometry={caixa(0.02, 0.5, 6.4)} material={vidro} />)}
        </group>
      ))}
      <mesh position={[0, 22, -5]} geometry={caixa(1.0, 3, 6)} material={branco} />
      {/* rampa */}
      <mesh position={[0, 1.6, 9]} rotation-x={0.2} geometry={caixa(5, 0.3, 8)} material={branco} />
    </group>
  );
};

const Planalto: React.FC = () => (
  <group>
    <mesh position-y={4.6} geometry={caixa(30, 1.2, 12)} material={mat("#eef0ee")} />
    <mesh position-y={2.3} geometry={caixa(27, 3.4, 9)} material={mat("#7d93a6", { metal: 0.4, aspereza: 0.3 })} />
    <mesh position-y={0.2} geometry={caixa(31, 0.4, 13)} material={mat("#d9dcd8")} />
    {/* colunas finas em "pena" */}
    {Array.from({ length: 9 }, (_, i) => [-1, 1].map((l) => (
      <mesh key={`${i}${l}`} position={[-13 + i * 3.25, 2.4, l * 6.1]} scale={[1, 1, 0.35]} geometry={cilindro(0.7, 0.15, 4.4, 4)} material={mat("#f6f7f5")} />
    )))}
  </group>
);

const Multidao: React.FC<{ t: number }> = ({ t }) => {
  // pessoas simplificadas (corpo + cabeça) e bandeiras: verde e amarelo de um lado, vermelho do outro
  const r = rng(91);
  const gente = useMemo(() => {
    const corpos: Inst[] = [], cabecas: Inst[] = [];
    for (let i = 0; i < 260; i++) {
      const lado = i % 2 ? 1 : -1;
      const x = lado * lerp(2.5, 16, r()), z = lerp(-14, -3, r());
      const cor = lado > 0 ? ["#d62828", "#b71c1c", "#ef5350", "#f2f2f2"][i % 4] : ["#1f9d3a", "#f2d21b", "#1f9d3a", "#1d4ed8"][i % 4];
      corpos.push({ p: [x, 0.75, z], s: [1, 0.9 + r() * 0.25, 1], cor });
      cabecas.push({ p: [x, 1.4, z], cor: ["#f2c9a6", "#e0ab7f", "#b97a4f", "#8a5634"][i % 4] });
    }
    return { corpos, cabecas };
  }, []);
  const pula = (i: number, it: Inst, tt: number, m: THREE.Object3D) => { m.position.set(it.p[0], it.p[1] + 0.12 * Math.max(0, Math.sin(tt * 6 + i * 1.7)), it.p[2]); const s = it.s as [number, number, number] | undefined; if (s) m.scale.set(...s); };
  return (
    <group>
      <Instancias itens={gente.corpos} geometria={cilindro(0.22, 0.18, 1.1, 6)} material={mat("#ffffff")} t={t} mover={pula} />
      <Instancias itens={gente.cabecas} geometria={esfera(0.16, 0)} material={mat("#ffffff")} t={t} mover={(i, it, tt, m) => m.position.set(it.p[0], it.p[1] + 0.12 * Math.max(0, Math.sin(tt * 6 + i * 1.7)), it.p[2])} />
      {/* bandeiras e cartazes */}
      {Array.from({ length: 16 }, (_, i) => {
        const lado = i % 2 ? 1 : -1, x = lado * (3 + (i * 1.9) % 13), z = -4 - ((i * 3.1) % 9);
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position-y={1.6} geometry={cilindro(0.02, 0.02, 3.2, 4)} material={mat("#8a6a4a")} />
            <group position={[0.45, 2.9, 0]} rotation-y={0.3 * Math.sin(t * 3 + i)}>
              {lado < 0 && i % 4 === 1 ? <BandeiraBrasil t={t + i} l={0.9} a={0.62} />
                : <mesh geometry={caixa(0.9, 0.6, 0.02)} material={mat(lado > 0 ? "#d62828" : i % 3 ? "#f2d21b" : "#1f9d3a", { ladoDuplo: true })} />}
            </group>
          </group>
        );
      })}
    </group>
  );
};

export const Brasilia: React.FC<{ hora: Hora; t: number; protesto?: boolean }> = ({ hora, t, protesto }) => (
  <group>
    {/* relvado da Esplanada, espelho de água e o eixo em asfalto */}
    <mesh position-y={-0.05} geometry={caixa(400, 0.1, 400)} material={mat("#6f9a3e")} />
    <mesh position={[0, 0.01, -10]} geometry={caixa(12, 0.04, 160)} material={mat("#c9c3b4")} />
    <mesh position={[0, 0.03, -26]} geometry={caixa(40, 0.04, 8)} material={mat("#4f7fa6", { aspereza: 0.15, metal: 0.4 })} />
    <group position={[0, 0, -60]}><Congresso /></group>
    <group position={[-48, 0, -55]} rotation-y={0.35}><Planalto /></group>
    {/* ministérios ao longo do eixo */}
    {Array.from({ length: 8 }, (_, i) => [-1, 1].map((l) => (
      <mesh key={`${i}${l}`} position={[l * 26, 5, 10 - i * 12]} geometry={caixa(6, 10, 9)} material={mat(i % 2 ? "#e4e1d8" : "#d9d5ca")} />
    )))}
    {/* mastro e bandeira grande */}
    <group position={[14, 0, -18]}>
      <mesh position-y={10} geometry={cilindro(0.15, 0.2, 20, 6)} material={mat("#c9ced6", { metal: 0.6 })} />
      <group position={[2.2, 18.5, 0]}><BandeiraBrasil t={t * 0.5} l={4.2} a={2.9} /></group>
    </group>
    {protesto && <Multidao t={t} />}
  </group>
);

// ---------- plenário ----------
export const Plenario: React.FC<{ t: number; votacao?: boolean }> = ({ t, votacao = true }) => {
  const bancadas = useMemo(() => {
    const it: Inst[] = [], gente: Inst[] = [];
    const r = rng(5);
    for (let fila = 0; fila < 6; fila++) {
      const raio = 3.4 + fila * 0.9, n = 14 + fila * 3;
      for (let k = 0; k < n; k++) {
        const a = lerp(-1.25, 1.25, k / (n - 1));
        const x = Math.sin(a) * raio, z = -Math.cos(a) * raio + 0.6;
        it.push({ p: [x, 0.25 + fila * 0.32, z], r: -a, cor: "#2f7a4a" });
        if (r() < 0.78) gente.push({ p: [x, 0.95 + fila * 0.32, z - 0.15], cor: ["#2c3446", "#3a3a3a", "#5a2c2c", "#2c4a5a", "#e8e2d6"][Math.floor(r() * 5)] });
      }
    }
    return { it, gente };
  }, []);
  const sim = votacao ? Math.round(lerp(0, 308, entre(t, 0.4, 3.2))) : 0, nao = votacao ? Math.round(lerp(0, 141, entre(t, 0.5, 3.0))) : 0;
  return (
    <group>
      <hemisphereLight args={["#fff4e0", "#3a3226", 0.8]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 6, 1]} intensity={22} distance={18} color="#fff1dd" />
      <mesh position-y={-0.02} geometry={caixa(30, 0.04, 30)} material={mat("#2f5a3a")} />
      <mesh position={[0, 0.01, 0.6]} geometry={cilindro(3, 3, 0.02, 24)} material={mat("#3d6e48")} />
      {/* degraus e bancadas */}
      {Array.from({ length: 6 }, (_, f) => <mesh key={f} position={[0, 0.08 + f * 0.32, 0.6]} geometry={geo(`degrau${f}`, () => new THREE.RingGeometry(3.0 + f * 0.9, 3.9 + f * 0.9, 24, 1, -Math.PI / 2 - 1.35, 2.7).rotateX(-Math.PI / 2))} material={mat("#6b5640", { ladoDuplo: true })} />)}
      <Instancias itens={bancadas.it} geometria={caixa(0.42, 0.5, 0.4)} material={mat("#ffffff")} />
      <Instancias itens={bancadas.gente} geometria={cilindro(0.15, 0.13, 0.55, 5)} material={mat("#ffffff")} />
      <Instancias itens={bancadas.gente.map((g) => ({ p: [g.p[0], g.p[1] + 0.4, g.p[2]] as [number, number, number], cor: "#d9a77f" }))} geometria={esfera(0.11, 0)} material={mat("#ffffff")} />
      {/* parede do fundo de madeira, mesa diretora e painel de votação */}
      <mesh position={[0, 3, -8.5]} geometry={caixa(26, 6, 0.3)} material={mat("#7a5a3a")} />
      <group position={[0, 0, -2.2]}>
        <mesh position-y={0.55} geometry={caixa(4.2, 1.1, 0.9)} material={mat("#5a4028")} />
        <mesh position={[0, 1.15, 0.1]} geometry={caixa(4.4, 0.08, 1.0)} material={mat("#3e2c1a")} />
      </group>
      <group position={[0, 4.4, -8.3]}>
        <mesh geometry={caixa(5.4, 2.6, 0.12)} material={mat("#05070a")} />
        <mesh position={[-1.25, 0.75, 0.07]} geometry={caixa(2.0, 0.32, 0.01)} material={mat("#1f9d3a", { emissivo: "#2fd15a", brilho: 0.8 })} />
        <mesh position={[1.25, 0.75, 0.07]} geometry={caixa(2.0, 0.32, 0.01)} material={mat("#c62828", { emissivo: "#ff3b3b", brilho: 0.8 })} />
        <group position={[-1.25, -0.25, 0.1]}><Digitos texto={String(sim).padStart(3, "0")} altura={0.75} cor="#3dff6a" brilho={1.6} /></group>
        <group position={[1.25, -0.25, 0.1]}><Digitos texto={String(nao).padStart(3, "0")} altura={0.75} cor="#ff4a4a" brilho={1.6} /></group>
      </group>
      {/* bandeira atrás da mesa */}
      <group position={[-4.2, 0, -7.6]}>
        <mesh position-y={1.8} geometry={cilindro(0.04, 0.04, 3.6, 5)} material={mat("#c9a24a", { metal: 0.6 })} />
        <group position={[0.65, 3.0, 0]}><BandeiraBrasil t={t * 0.3} l={1.2} a={0.84} /></group>
      </group>
    </group>
  );
};

// ---------- supermercado ----------
export const Supermercado: React.FC<{ t: number; quando?: number }> = ({ t, quando = 0.5 }) => {
  const produtos = useMemo(() => {
    const it: Inst[] = [];
    const r = rng(33);
    for (const lado of [-1, 1]) for (let x = 0; x < 22; x++) for (let n = 0; n < 4; n++) {
      it.push({ p: [lado * 1.55, 0.42 + n * 0.5, -6 + x * 0.42], s: [0.9 + r() * 0.3, 0.9 + r() * 0.5, 1], cor: ["#e53935", "#fbc02d", "#43a047", "#1e88e5", "#f4f4f4", "#8e24aa", "#ff7043"][Math.floor(r() * 7)] });
    }
    return it;
  }, []);
  // o preço do cartaz sobe: R$ 4,99 → 12,99
  const k = entre(t, quando, quando + 3);
  const preco = lerp(4.99, 12.99, k);
  const [inteiro, cent] = preco.toFixed(2).split(".");
  return (
    <group>
      <hemisphereLight args={["#f4f8ff", "#5a5a5a", 0.9]} />
      <ambientLight intensity={0.35} />
      {[-4, 0].map((z) => <pointLight key={z} position={[0, 3.2, z]} intensity={10 + 0.6 * Math.sin(t * 40 + z)} distance={9} color="#eef6ff" />)}
      <mesh position-y={-0.02} geometry={caixa(10, 0.04, 16)} material={mat("#d8d8d2")} />
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[0, 0.005, -7 + i * 1.6]} geometry={caixa(10, 0.01, 0.04)} material={mat("#c4c4bc")} />)}
      <mesh position={[0, 2, -7.2]} geometry={caixa(10, 4, 0.1)} material={mat("#eef0ea")} />
      <mesh position={[0, 3.6, -7.1]} geometry={caixa(10, 0.5, 0.05)} material={mat("#e53935")} />
      {/* prateleiras dos dois lados */}
      {[-1, 1].map((l) => (
        <group key={l} position-x={l * 1.75}>
          <mesh position={[0, 1.1, -1.6]} geometry={caixa(0.5, 2.3, 9.4)} material={mat("#b8bcc2", { metal: 0.3 })} />
          {Array.from({ length: 4 }, (_, n) => <mesh key={n} position={[-l * 0.12, 0.18 + n * 0.5, -1.6]} geometry={caixa(0.62, 0.04, 9.4)} material={mat("#9aa0a8", { metal: 0.4 })} />)}
          {Array.from({ length: 4 }, (_, n) => <mesh key={`e${n}`} position={[-l * 0.43, 0.13 + n * 0.5, -1.6]} geometry={caixa(0.02, 0.08, 9.4)} material={mat("#fff176")} />)}
        </group>
      ))}
      <Instancias itens={produtos} geometria={caixa(0.26, 0.34, 0.3)} material={mat("#ffffff")} />
      {/* cartaz do preço pendurado: o número sobe e fica a vermelho */}
      <group position={[0, 2.75, -2]}>
        {[-0.9, 0.9].map((x) => <mesh key={x} position={[x, 0.75, 0]} geometry={cilindro(0.01, 0.01, 1.3, 3)} material={mat("#555")} />)}
        <mesh geometry={caixa(2.4, 1.0, 0.06)} material={mat(k > 0.02 ? "#ffeb3b" : "#ffffff")} />
        <mesh position={[-0.92, 0.18, 0.04]} geometry={caixa(0.36, 0.2, 0.01)} material={mat("#c62828")} />
        <group position={[0.15, -0.05, 0.05]}><Digitos texto={`${inteiro}`} altura={0.5} cor={k > 0.5 ? "#c62828" : "#1b1b1b"} brilho={0.2} /></group>
        <group position={[0.92, 0.15, 0.05]}><Digitos texto={cent} altura={0.22} cor={k > 0.5 ? "#c62828" : "#1b1b1b"} brilho={0.2} /></group>
        {/* seta a subir */}
        <mesh position={[1.35, 0.2 + 0.08 * Math.sin(t * 5), 0.05]} geometry={geo("seta-preco", () => new THREE.ConeGeometry(0.14, 0.28, 3))} material={mat("#c62828", { emissivo: "#ff3b3b", brilho: 0.5 * k })} />
      </group>
      {/* carrinho */}
      <group position={[0.7, 0, 1.2]} rotation-y={-0.3}>
        <mesh position-y={0.7} geometry={caixa(0.55, 0.4, 0.8)} material={mat("#c9ced6", { metal: 0.6, opacidade: 0.85 })} />
        {[[-0.22, -0.32], [0.22, -0.32], [-0.22, 0.32], [0.22, 0.32]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.08, z]} rotation-z={Math.PI / 2} geometry={cilindro(0.07, 0.07, 0.05, 8)} material={mat("#222")} />)}
        <mesh position={[0, 0.95, 0.45]} rotation-z={Math.PI / 2} geometry={cilindro(0.025, 0.025, 0.55, 6)} material={mat("#e53935")} />
        {[0, 1, 2].map((i) => <mesh key={i} position={[-0.12 + i * 0.12, 0.68, -0.15 + i * 0.1]} geometry={caixa(0.14, 0.2, 0.14)} material={mat(["#fbc02d", "#43a047", "#e53935"][i])} />)}
      </group>
    </group>
  );
};

// ---------- objetos ----------
export const Urna: React.FC<{ t: number; quando: number; votar?: boolean }> = ({ t, quando, votar }) => {
  const k = votar ? entre(t, quando, quando + 0.25) * (1 - entre(t, quando + 0.4, quando + 0.6)) : 0;
  const fim = votar && t > quando + 0.3;
  return (
    <group>
    <mesh position-y={0.38} geometry={caixa(1.3, 0.04, 0.9)} material={mat("#6e4b30")} />
    {[[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.18, z]} geometry={caixa(0.05, 0.36, 0.05)} material={mat("#4a3220")} />)}
    <group position-y={0.58} rotation-x={0.55}>
      <mesh geometry={caixa(1.0, 0.25, 0.7)} material={mat("#e9e1cf")} />
      {/* ecrã */}
      <mesh position={[-0.22, 0.13, 0]} geometry={caixa(0.46, 0.02, 0.36)} material={mat("#ddeeff", { emissivo: fim ? "#ffffff" : "#bcd6ee", brilho: 0.6 })} />
      {fim && <group position={[-0.22, 0.15, 0]} rotation-x={-Math.PI / 2}><mesh geometry={caixa(0.36, 0.12, 0.005)} material={mat("#1b1b1b")} /></group>}
      {/* teclado: 3x4 e as teclas BRANCO, CORRIGE, CONFIRMA */}
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[0.18 + (i % 3) * 0.1, 0.14, -0.2 + Math.floor(i / 3) * 0.085]} geometry={caixa(0.08, 0.03, 0.065)} material={mat("#2a2a2a")} />)}
      <mesh position={[0.17, 0.14, 0.26]} geometry={caixa(0.09, 0.03, 0.07)} material={mat("#f4f4f4")} />
      <mesh position={[0.27, 0.14, 0.26]} geometry={caixa(0.09, 0.03, 0.07)} material={mat("#ff8a3d")} />
      <mesh position={[0.4, 0.14 - 0.02 * k, 0.26]} geometry={caixa(0.13, 0.03, 0.08)} material={mat("#2fb34a", { emissivo: "#2fd15a", brilho: 0.6 * k })} />
    </group>
    </group>
  );
};

export const MalaDinheiro: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const abre = entre(t, quando, quando + 0.6);
  const notas = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: -0.35 + (i % 4) * 0.23, z: -0.12 + Math.floor(i / 4) * 0.12 })), []);
  return (
    <group rotation-y={-0.4}>
      <mesh position-y={0.12} geometry={caixa(1.0, 0.24, 0.6)} material={mat("#1b1b1f", { aspereza: 0.5 })} />
      {notas.map((n, i) => <mesh key={i} position={[n.x, 0.2 + 0.02 * (i % 3), n.z]} geometry={caixa(0.2, 0.08, 0.1)} material={mat(i % 2 ? "#2f8f5a" : "#7fbf6a")} />)}
      {/* tampa: roda pela dobradiça de trás */}
      <group position={[0, 0.24, -0.3]} rotation-x={-1.9 * abre}>
        <mesh position={[0, 0.06, 0.3]} geometry={caixa(1.0, 0.12, 0.6)} material={mat("#1b1b1f", { aspereza: 0.5 })} />
      </group>
      <mesh position={[0, 0.28, 0.31]} geometry={caixa(0.3, 0.04, 0.03)} material={mat("#c9a24a", { metal: 0.7 })} />
      {/* notas a voar quando abre */}
      {abre > 0.5 && Array.from({ length: 10 }, (_, i) => {
        const tt = (t - quando - 0.3 + i * 0.13) % 1.6;
        return <mesh key={i} position={[Math.sin(i * 2.3) * (0.2 + tt * 0.5), 0.3 + tt * 1.1 - tt * tt * 0.3, Math.cos(i * 1.7) * tt * 0.4]} rotation={[tt * 4 + i, tt * 3, i]} geometry={caixa(0.18, 0.005, 0.08)} material={mat("#7fbf6a", { ladoDuplo: true })} />;
      })}
    </group>
  );
};

export const PlataformaPetroleo: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {/* mar à volta */}
    <mesh position-y={0.02} rotation-x={-Math.PI / 2} geometry={geo("mar-plataforma", () => new THREE.CircleGeometry(5, 18))} material={mat("#1f5f8b", { aspereza: 0.2, metal: 0.3 })} />
    {[-1, 1].map((x) => [-1, 1].map((z) => <mesh key={`${x}${z}`} position={[x * 1.1, 1.0, z * 1.1]} geometry={cilindro(0.18, 0.22, 2.0, 6)} material={mat("#f2c230")} />))}
    <mesh position-y={2.15} geometry={caixa(3.2, 0.3, 3.2)} material={mat("#5a5f68")} />
    <mesh position={[-0.8, 2.6, 0.6]} geometry={caixa(1.2, 0.6, 1.4)} material={mat("#e9e9e4")} />
    <mesh position={[0.9, 2.5, -0.9]} geometry={caixa(0.8, 0.4, 0.8)} material={mat("#c62828")} />
    {/* torre de perfuração e a broca a rodar */}
    <group position={[0.6, 2.3, 0.6]}>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.35, 1.5, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.35]} rotation={[Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.12, 0, -Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.12]} geometry={cilindro(0.04, 0.04, 3, 4)} material={mat("#d9d9d9", { metal: 0.5 })} />)}
      <mesh position-y={1.4} rotation-y={t * 4} geometry={cilindro(0.08, 0.08, 2.6, 6)} material={mat("#7a7f88", { metal: 0.6 })} />
    </group>
    {/* braço da chama */}
    <group position={[-1.5, 2.3, -1.2]} rotation-z={0.6}>
      <mesh position-y={1.2} geometry={cilindro(0.05, 0.05, 2.4, 4)} material={mat("#9aa0a8")} />
      <mesh position-y={2.6 + 0.05 * Math.sin(t * 12)} scale={[1, 1.4 + 0.2 * Math.sin(t * 9), 1]} geometry={esfera(0.25, 0)} material={mat("#ff8a1a", { emissivo: "#ff6a00", brilho: 1.6 })} />
      <pointLight position-y={2.6} intensity={3} distance={6} color="#ff8a1a" />
    </group>
  </group>
);

export const Pulpito: React.FC<{ cor: string }> = ({ cor }) => (
  <group>
    <mesh position-y={0.55} geometry={cilindro(0.35, 0.45, 1.1, 6)} material={mat("#5a4028")} />
    <mesh position={[0, 1.13, 0.05]} rotation-x={0.3} geometry={caixa(0.75, 0.06, 0.5)} material={mat("#3e2c1a")} />
    {/* brasão genérico: círculo azul com estrelas e um aro dourado */}
    <mesh position={[0, 0.65, 0.42]} rotation-x={Math.PI / 2 - 0.08} geometry={cilindro(0.18, 0.18, 0.02, 14)} material={mat(cor || "#1d4ed8")} />
    <mesh position={[0, 0.65, 0.42]} rotation-x={-0.08} geometry={geo("aro-brasao", () => new THREE.TorusGeometry(0.19, 0.02, 4, 16))} material={mat("#c9a24a", { metal: 0.6 })} />
    {/* microfone de haste */}
    <mesh position={[0, 1.3, 0.12]} rotation-x={-0.5} geometry={cilindro(0.008, 0.008, 0.35, 4)} material={mat("#222")} />
    <mesh position={[0, 1.45, 0.2]} geometry={esfera(0.035, 1)} material={mat("#1a1a1a")} />
  </group>
);
