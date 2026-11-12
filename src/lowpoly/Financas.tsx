import { useMemo } from "react";
import { caixa, cilindro, cone, entre, esfera, mat, rng, sai } from "./util";

// Pacote de finanças / bolsa de valores: o pregão (cenário `bolsa`) e objetos para explicar o mercado:
// gráfico de velas, touro (mercado em alta), urso (em baixa), moedas, dinheiro, a empresa dividida em ações e a seta.

const VERDE = "#22c55e", VERMELHO = "#ef4444";
const PAREDE = -2.6;

// série de preços determinística: alta sobe, queda desce, volatil anda aos saltos
const serie = (n: number, tendencia: string, semente = 3) => {
  const r = rng(semente), tr = tendencia === "queda" ? -1 : tendencia === "volatil" ? 0 : 1, ruido = tendencia === "volatil" ? 0.8 : 0.4;
  const v: { a: number; f: number; max: number; min: number }[] = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    const a = p, f = p + tr * 0.22 + (r() - 0.5) * ruido;
    v.push({ a, f, max: Math.max(a, f) + r() * 0.15, min: Math.min(a, f) - r() * 0.15 });
    p = f;
  }
  const lo = Math.min(...v.map((c) => c.min)), hi = Math.max(...v.map((c) => c.max)), k = 1 / Math.max(0.01, hi - lo);
  return v.map((c) => ({ a: (c.a - lo) * k, f: (c.f - lo) * k, max: (c.max - lo) * k, min: (c.min - lo) * k }));
};

// ---------- gráfico de velas: as velas aparecem uma a uma a partir de `quando` ----------
export const Velas: React.FC<{ t: number; quando: number; tendencia?: string }> = ({ t, quando, tendencia = "alta" }) => {
  const velas = useMemo(() => serie(12, tendencia), [tendencia]);
  const A = 2.4, passo = 0.32;
  return (
    <group position-y={-A / 2}>
      <mesh position={[0, A / 2, -0.2]} geometry={caixa(passo * 12 + 0.5, A + 0.6, 0.04)} material={mat("#0f1522", { opacidade: 0.85 })} />
      {[0.25, 0.5, 0.75].map((y) => <mesh key={y} position={[0, y * A, -0.17]} geometry={caixa(passo * 12 + 0.3, 0.01, 0.01)} material={mat("#2b3650")} />)}
      {velas.map((c, i) => {
        const k = sai((t - quando - i * 0.22) / 0.3);
        if (k <= 0) return null;
        const sobe = c.f >= c.a, cor = sobe ? VERDE : VERMELHO;
        const corpo = Math.max(0.03, Math.abs(c.f - c.a) * A), meio = ((c.a + c.f) / 2) * A;
        return (
          <group key={i} position-x={(i - 5.5) * passo} scale={[1, k, 1]}>
            <mesh position-y={((c.max + c.min) / 2) * A} geometry={caixa(0.03, (c.max - c.min) * A, 0.03)} material={mat(cor)} />
            <mesh position-y={meio} geometry={caixa(0.2, corpo, 0.2)} material={mat(cor, { emissivo: cor, brilho: 0.35 })} />
          </group>
        );
      })}
    </group>
  );
};

// ---------- seta da tendência (sobe a verde, desce a vermelho), cresce em `quando` ----------
export const Seta: React.FC<{ t: number; quando: number; desce?: boolean }> = ({ t, quando, desce }) => {
  const k = sai((t - quando) / 0.6), cor = desce ? VERMELHO : VERDE;
  return (
    <group rotation-z={desce ? -2.3 : -0.75} scale={[1, Math.max(0.001, k), 1]}>
      <mesh position-y={-0.2} geometry={caixa(0.28, 1.6, 0.28)} material={mat(cor, { emissivo: cor, brilho: 0.3 })} />
      <mesh position-y={0.85} geometry={cone(0.45, 0.6, 4)} rotation-y={Math.PI / 4} material={mat(cor, { emissivo: cor, brilho: 0.3 })} />
    </group>
  );
};

// ---------- touro (mercado em alta): anda ou investe de cabeça baixa ----------
export const Touro: React.FC<{ t: number; acao?: string }> = ({ t, acao }) => {
  const anda = acao === "andar" || acao === "investir", investe = acao === "investir";
  const pele = mat("#8a5a2e"), escuro = mat("#5a3a1e");
  const passo = anda ? Math.sin(t * (investe ? 14 : 8)) * 0.5 : 0;
  return (
    <group rotation-y={-0.55} position-x={investe ? Math.sin(t * 7) * 0.12 : 0}>
      <mesh position-y={0.95} geometry={caixa(1.6, 0.8, 0.75)} material={pele} />
      <mesh position={[0.45, 1.38, 0]} geometry={caixa(0.6, 0.35, 0.62)} material={pele} />
      <group position={[0.95, investe ? 0.85 : 1.08, 0]} rotation-z={investe ? -0.45 : 0}>
        <mesh geometry={caixa(0.5, 0.45, 0.46)} material={pele} />
        <mesh position={[0.3, -0.08, 0]} geometry={caixa(0.22, 0.26, 0.34)} material={mat("#c08a5a")} />
        {[1, -1].map((l) => (
          <group key={l}>
            <mesh position={[0.05, 0.22, 0.3 * l]} rotation={[-0.9 * l, 0, -0.5]} geometry={cone(0.06, 0.45, 5)} material={mat("#efe6cf")} />
            <mesh position={[0.18, 0.06, 0.235 * l]} geometry={esfera(0.04, 0)} material={mat("#111")} />
          </group>
        ))}
      </group>
      {[[0.55, 1], [0.55, -1], [-0.55, 1], [-0.55, -1]].map(([x, l], i) => (
        <group key={i} position={[x, 0.6, 0.25 * l]} rotation-z={passo * (i % 3 === 0 ? 1 : -1)}>
          <mesh position-y={-0.3} geometry={cilindro(0.1, 0.08, 0.6, 6)} material={pele} />
          <mesh position-y={-0.58} geometry={caixa(0.16, 0.06, 0.16)} material={escuro} />
        </group>
      ))}
      <mesh position={[-0.85, 1.0, 0]} rotation-z={0.5 + Math.sin(t * 3) * 0.2} geometry={caixa(0.04, 0.6, 0.04)} material={escuro} />
    </group>
  );
};

// ---------- urso (mercado em baixa): parado ou a atacar (põe-se de pé e dá uma patada) ----------
export const Urso: React.FC<{ t: number; acao?: string }> = ({ t, acao }) => {
  const ataca = acao === "atacar";
  const pele = mat("#5a3c28"), claro = mat("#a07a5a");
  const sobe = ataca ? 0.5 + 0.45 * Math.sin(t * 3) : 0;
  return (
    <group rotation-y={-0.55}>
      <group position-x={-0.55} rotation-z={sobe}>
        <group position-x={0.55}>
          <mesh position-y={0.85} scale={[1.45, 1, 1]} geometry={esfera(0.58, 1)} material={pele} />
          <group position={[0.85, 1.15, 0]}>
            <mesh geometry={esfera(0.34, 1)} material={pele} />
            {[1, -1].map((l) => <mesh key={l} position={[-0.05, 0.28, 0.2 * l]} geometry={esfera(0.11, 0)} material={pele} />)}
            <mesh position={[0.3, -0.08, 0]} scale={[1.2, 0.8, 1]} geometry={esfera(0.15, 0)} material={claro} />
            <mesh position={[0.45, -0.04, 0]} geometry={esfera(0.05, 0)} material={mat("#111")} />
            {[1, -1].map((l) => <mesh key={l} position={[0.24, 0.1, 0.15 * l]} geometry={esfera(0.035, 0)} material={mat("#111")} />)}
            {ataca && <mesh position={[0.32, -0.2, 0]} geometry={caixa(0.14, 0.06, 0.16)} material={mat("#3a1414")} />}
          </group>
          {/* patas da frente: a direita dá a patada quando ataca */}
          {[1, -1].map((l) => (
            <group key={l} position={[0.5, 0.6, 0.3 * l]} rotation-z={ataca && l === 1 ? -1.2 + Math.sin(t * 6) * 0.8 : 0}>
              <mesh position-y={-0.3} geometry={cilindro(0.15, 0.13, 0.6, 6)} material={pele} />
            </group>
          ))}
        </group>
      </group>
      {[1, -1].map((l) => <mesh key={l} position={[-0.5, 0.3, 0.3 * l]} geometry={cilindro(0.16, 0.14, 0.6, 6)} material={pele} />)}
    </group>
  );
};

// ---------- moedas: três pilhas que crescem (ou encolhem com "cair") a partir de `quando` ----------
export const Moedas: React.FC<{ t: number; quando: number; cair?: boolean }> = ({ t, quando, cair }) => {
  const k = entre(t, quando, quando + 1.8);
  const f = cair ? 1 - 0.7 * k : 0.25 + 0.75 * k;
  const ouro = mat("#e8b730", { metal: 0.7, aspereza: 0.3 });
  return (
    <group>
      {[[-0.45, 10], [0, 16], [0.45, 22]].map(([x, n]) => {
        const m = Math.max(1, Math.round(n * f));
        return Array.from({ length: m }, (_, i) => <mesh key={`${x}${i}`} position={[x, 0.035 + i * 0.065, (i % 3) * 0.01]} geometry={cilindro(0.18, 0.18, 0.06, 12)} material={ouro} />);
      })}
    </group>
  );
};

// ---------- dinheiro: maços de notas; "chuva" faz cair notas do céu ----------
export const Dinheiro: React.FC<{ t: number; chuva?: boolean }> = ({ t, chuva }) => {
  const notas = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: 26 }, () => ({ x: (r() - 0.5) * 3, z: (r() - 0.5) * 1.6, f: r(), v: 0.18 + r() * 0.12, g: r() * 6 }));
  }, []);
  const verde = mat("#3f9a5a"), faixa = mat("#e9e2c8");
  return (
    <group>
      {[[-0.4, 0.35], [0.3, 0.55], [0.05, 0.25]].map(([x, h], i) => (
        <group key={i} position={[x, h / 2, i === 2 ? 0.4 : 0]} rotation-y={i * 0.4}>
          <mesh geometry={caixa(0.62, h, 0.3)} material={verde} />
          <mesh geometry={caixa(0.14, h + 0.01, 0.31)} material={faixa} />
        </group>
      ))}
      {chuva && notas.map((n, i) => {
        const fase = (n.f + t * n.v) % 1;
        return <mesh key={i} position={[n.x + Math.sin(t * 2 + n.g) * 0.3, 4 - fase * 4.2, n.z]} rotation={[t * 2 + n.g, n.g, Math.sin(t * 3 + n.g)]} geometry={caixa(0.3, 0.005, 0.14)} material={mat("#4fae68", { ladoDuplo: true })} />;
      })}
    </group>
  );
};

// ---------- empresa: um prédio feito de blocos; em `quando` divide-se em ações e algumas vão para o lado ----------
export const Empresa: React.FC<{ t: number; quando: number; cor: string; cor2: string }> = ({ t, quando, cor, cor2 }) => {
  const k = entre(t, quando, quando + 1), voa = entre(t, quando + 1, quando + 2);
  const blocos: [number, number, number][] = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) blocos.push([x - 1, y, z - 0.5]);
  const minhas = new Set([5, 12, 22]);
  return (
    <group>
      {blocos.map(([x, y, z], i) => {
        const sep = 1 + 0.35 * k;
        let px = x * 0.56 * sep, py = 0.28 + y * 0.56 * sep, pz = z * 0.56 * sep;
        const minha = minhas.has(i);
        if (minha) { const j = [...minhas].indexOf(i); px += voa * (2.4 - px); py += voa * (0.28 + j * 0.58 - py); pz += voa * (0.6 - pz); }
        return (
          <group key={i} position={[px, py, pz]}>
            <mesh geometry={caixa(0.54, 0.54, 0.54)} material={mat(minha && k > 0 ? cor2 : cor)} />
            <mesh position-z={0.272} geometry={caixa(0.36, 0.2, 0.01)} material={mat("#bfe6ff", { emissivo: "#9fd4ff", brilho: 0.25 })} />
          </group>
        );
      })}
      <mesh position={[0, 0.28 + 6 * 0.56 * (1 + 0.35 * k) + 0.05, 0]} geometry={caixa(1.2, 0.3, 0.2)} material={mat(cor2, { emissivo: cor2, brilho: 0.5 })} />
    </group>
  );
};

// ---------- cenário: pregão da bolsa ----------
// parede de ecrãs (gráfico ao vivo ao centro, cotações dos lados), faixa de LED com cotações a correr, mesas de corretores.
// variante: alta (tudo a verde, gráfico a subir) | queda (vermelho, gráfico a cair, luz de alarme) | sem variante: misto
export const Bolsa: React.FC<{ t: number; variante?: string; cor: string }> = ({ t, variante, cor }) => {
  const queda = variante === "queda";
  const pontos = useMemo(() => serie(28, queda ? "queda" : variante === "alta" ? "alta" : "volatil", 11), [queda, variante]);
  const r = useMemo(() => { const g = rng(8); return Array.from({ length: 40 }, () => g()); }, []);
  const corLinha = queda ? VERMELHO : VERDE;
  const visiveis = Math.max(2, Math.min(28, Math.floor(6 + t * 4)));
  const L = 3.2, A = 1.4;
  const sinal = (i: number) => (queda ? r[i % 40] < 0.8 : variante === "alta" ? r[i % 40] < 0.2 : r[i % 40] < 0.5) ? VERMELHO : VERDE;
  return (
    <group>
      <hemisphereLight args={["#cfe0ff", "#1a2030", 0.7]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3, 1]} intensity={12} distance={14} color="#e8f0ff" />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      {queda && <pointLight position={[0, 3, 0]} intensity={8 + 8 * Math.max(0, Math.sin(t * 5))} distance={12} color="#ff2a2a" />}
      {/* chão, paredes */}
      <mesh position={[0, 0, 0.6]} geometry={caixa(9, 0.04, 7.4)} material={mat("#1e2533")} />
      <mesh position={[0, 1.8, PAREDE]} geometry={caixa(9, 3.8, 0.12)} material={mat("#232a3a")} />
      {[-4.4, 4.4].map((x) => <mesh key={x} position={[x, 1.8, 0.6]} geometry={caixa(0.12, 3.8, 7.4)} material={mat("#20273a")} />)}
      {/* parede de ecrãs */}
      <group position={[0, 1.95, PAREDE + 0.09]}>
        <mesh geometry={caixa(8.2, 1.9, 0.06)} material={mat("#0a0e16")} />
        {/* gráfico ao vivo ao centro */}
        <group position-z={0.04}>
          <mesh geometry={caixa(L + 0.2, A + 0.2, 0.01)} material={mat("#0d1626", { emissivo: "#0d1626", brilho: 0.4 })} />
          {[0.25, 0.5, 0.75].map((y) => <mesh key={y} position={[0, -A / 2 + y * A, 0.01]} geometry={caixa(L, 0.008, 0.005)} material={mat("#24324d")} />)}
          {pontos.slice(0, visiveis).map((p, i) => {
            if (i === 0) return null;
            const q = pontos[i - 1];
            const x0 = -L / 2 + ((i - 1) / 27) * L, x1 = -L / 2 + (i / 27) * L, y0 = -A / 2 + q.f * A, y1 = -A / 2 + p.f * A;
            const len = Math.hypot(x1 - x0, y1 - y0);
            return <mesh key={i} position={[(x0 + x1) / 2, (y0 + y1) / 2, 0.02]} rotation-z={Math.atan2(y1 - y0, x1 - x0)} geometry={caixa(len, 0.035, 0.01)} material={mat(corLinha, { emissivo: corLinha, brilho: 1.4 })} />;
          })}
        </group>
        {/* cotações dos lados: nome, valor e a variação a verde ou vermelho (pisca de vez em quando) */}
        {[-1, 1].map((l) => Array.from({ length: 6 }, (_, j) => {
          const i = j + (l > 0 ? 6 : 0) + Math.floor(t * 0.7);
          return (
            <group key={`${l}${j}`} position={[l * 3.05, 0.65 - j * 0.26, 0.04]}>
              <mesh position-x={-0.5} geometry={caixa(0.45, 0.1, 0.01)} material={mat("#cbd5e1", { emissivo: "#cbd5e1", brilho: 0.4 })} />
              <mesh position-x={0.05} geometry={caixa(0.4, 0.1, 0.01)} material={mat("#94a3b8", { emissivo: "#94a3b8", brilho: 0.3 })} />
              <mesh position-x={0.55} geometry={caixa(0.38, 0.14, 0.01)} material={mat(sinal(i), { emissivo: sinal(i), brilho: 1.2 })} />
            </group>
          );
        }))}
      </group>
      {/* faixa de LED com as cotações a correr */}
      <group position={[0, 3.25, PAREDE + 0.12]}>
        <mesh geometry={caixa(8.6, 0.32, 0.05)} material={mat("#05070b")} />
        {Array.from({ length: 30 }, (_, i) => {
          const x = ((((i * 0.62 - t * 1.4) % 18.6) + 18.6) % 18.6) - 9.3;
          if (Math.abs(x) > 4.1) return null;
          return <mesh key={i} position={[x, 0, 0.03]} geometry={caixa(i % 2 ? 0.22 : 0.34, 0.12, 0.01)} material={mat(i % 2 ? sinal(i) : "#f8fafc", { emissivo: i % 2 ? sinal(i) : "#f8fafc", brilho: 1.3 })} />;
        })}
      </group>
      {/* mesas dos corretores com três monitores cada */}
      {[-3.1, 3.1].map((x) => (
        <group key={x} position={[x, 0, -1.3]} rotation-y={x > 0 ? -0.35 : 0.35}>
          <mesh position-y={0.74} geometry={caixa(1.6, 0.06, 0.8)} material={mat("#3a4258")} />
          <mesh position-y={0.37} geometry={caixa(1.5, 0.72, 0.7)} material={mat("#2a3146")} />
          {[-0.5, 0, 0.5].map((dx, k) => (
            <group key={dx} position={[dx, 1.05, -0.2]} rotation-y={-dx * 0.5}>
              <mesh geometry={caixa(0.46, 0.3, 0.03)} material={mat("#111")} />
              <mesh position-z={0.017} geometry={caixa(0.42, 0.26, 0.005)} material={mat("#0d1626", { emissivo: sinal(k + (x > 0 ? 3 : 0)), brilho: 0.35 + 0.15 * Math.sin(t * 2 + k) })} />
            </group>
          ))}
          <mesh position={[0, 0.79, 0.15]} geometry={caixa(0.5, 0.03, 0.16)} material={mat("#1b1f2a")} />
          <mesh position={[0.5, 0.8, 0.15]} geometry={cilindro(0.05, 0.04, 0.1, 6)} material={mat(cor)} />
        </group>
      ))}
    </group>
  );
};
