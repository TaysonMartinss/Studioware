import { useMemo } from "react";
import * as THREE from "three";
import { Hora, LUZ, Estrelas } from "./ambiente";
import { Corpo } from "./Espaco";
import { caixa, cilindro, cone, esfera, mat, rng } from "./util";

// Interiores com o mesmo enquadramento do quarto e do laboratório: parede do fundo em z = -2,6, paredes laterais
// em x = ±4,4, as personagens à frente e viradas para a câmara.
const PAREDE = -2.6;

const Sala: React.FC<{ chao: string[]; parede: string; lateral?: string }> = ({ chao, parede, lateral }) => (
  <>
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-4.4 + i * 0.8, 0, 0.6]} geometry={caixa(0.78, 0.04, 7.4)} material={mat(chao[i % chao.length])} />)}
    <mesh position={[0, 1.6, PAREDE]} geometry={caixa(9, 3.4, 0.12)} material={mat(parede)} />
    <mesh position={[-4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat(lateral ?? parede)} />
    <mesh position={[4.4, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat(lateral ?? parede)} />
  </>
);
const Janela: React.FC<{ hora: Hora; x?: number }> = ({ hora, x = 4.33 }) => (
  <group position={[x, 1.75, 0.2]} rotation-y={x > 0 ? -Math.PI / 2 : Math.PI / 2}>
    <mesh geometry={caixa(1.7, 1.3, 0.04)} material={mat(LUZ[hora].horizonte, { emissivo: LUZ[hora].horizonte, brilho: hora === "noite" ? 0.3 : 0.8 })} />
    <mesh position-z={0.03} geometry={caixa(1.8, 0.06, 0.04)} material={mat("#e9e6df")} />
    <mesh position-z={0.03} geometry={caixa(0.06, 1.4, 0.04)} material={mat("#e9e6df")} />
  </group>
);
const Planta: React.FC<{ p: [number, number, number] }> = ({ p }) => (
  <group position={p}>
    <mesh position-y={0.25} geometry={cilindro(0.22, 0.17, 0.5, 6)} material={mat("#c76b4a")} />
    {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * 1.6) * 0.15, 0.75 + i * 0.12, Math.sin(i * 1.6) * 0.15]} geometry={esfera(0.22, 0)} material={mat(i % 2 ? "#3f8f3c" : "#4fa14a")} />)}
  </group>
);

// ---------- sala de aula ----------
export const SalaAula: React.FC<{ t: number; hora: Hora; cor: string }> = ({ t, hora, cor }) => {
  const seg = (t * 6) % 60;
  return (
    <group>
      <hemisphereLight args={["#fff6e8", "#6a5a48", 0.95]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 2.9, 0.8]} intensity={14} distance={14} color="#fff4e2" />
      <directionalLight position={[5, 5, 4]} intensity={0.9} />
      <Sala chao={["#b88a5a", "#c29462"]} parede="#efe6cf" />
      {/* quadro de giz com um triângulo, uma circunferência e "contas" */}
      <group position={[0, 1.75, PAREDE + 0.07]}>
        <mesh geometry={caixa(3.8, 1.5, 0.05)} material={mat("#6b4a2e")} />
        <mesh position-z={0.03} geometry={caixa(3.6, 1.3, 0.02)} material={mat("#2f5a3f")} />
        <group position-z={0.05}>
          {[[-1.2, 0.05, 0.9, 0], [-1.45, -0.3, 0.6, 1.05], [-0.95, -0.3, 0.6, -1.05]].map(([x, y, l, r], i) => <mesh key={i} position={[x, y, 0]} rotation-z={r} geometry={caixa(l, 0.025, 0.005)} material={mat("#f2f2ea")} />)}
          <mesh position={[0.05, -0.05, 0]}><torusGeometry args={[0.32, 0.012, 3, 24]} /><meshBasicMaterial color="#f2f2ea" /></mesh>
          {Array.from({ length: 4 }, (_, i) => <mesh key={i} position={[1.15, 0.35 - i * 0.22, 0]} geometry={caixa(0.7 - (i % 2) * 0.2, 0.025, 0.005)} material={mat("#f2f2ea")} />)}
        </group>
        <mesh position={[0, -0.72, 0.08]} geometry={caixa(3.6, 0.05, 0.12)} material={mat("#6b4a2e")} />
      </group>
      {/* relógio com o ponteiro a andar */}
      <group position={[2.8, 2.6, PAREDE + 0.08]}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.28, 0.28, 0.05, 12)} material={mat("#f4f4f4")} />
        <mesh position-z={0.04} rotation-z={-seg / 60 * Math.PI * 2} geometry={caixa(0.02, 0.22, 0.01)} material={mat("#222")} />
      </group>
      {/* secretária do professor com o globo */}
      <group position={[-2.8, 0, PAREDE + 0.9]}>
        <mesh position-y={0.76} geometry={caixa(1.6, 0.06, 0.8)} material={mat("#8a5e3c")} />
        <mesh position-y={0.38} geometry={caixa(1.5, 0.74, 0.7)} material={mat("#7a5232")} />
        <mesh position={[0.4, 0.95, 0]} geometry={cilindro(0.05, 0.08, 0.1, 6)} material={mat("#2a2a2a")} />
        <group position={[0.4, 1.18, 0]} rotation={[0.4, t * 0.6, 0]}><mesh geometry={esfera(0.2, 1)} material={mat("#3f8fe5")} /><mesh scale={1.01} geometry={esfera(0.2, 0)} material={mat("#4f9a42", { opacidade: 0.8 })} /></group>
        <mesh position={[-0.4, 0.83, 0]} geometry={caixa(0.3, 0.08, 0.22)} material={mat(cor)} />
      </group>
      {/* carteiras dos alunos dos lados */}
      {[-3.4, 3.4].map((x) => [-1.0, 0.6, 2.2].map((z) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position-y={0.72} geometry={caixa(0.9, 0.05, 0.6)} material={mat("#c9a26a")} />
          <mesh position-y={0.36} geometry={cilindro(0.04, 0.04, 0.72, 5)} material={mat("#555")} />
          <mesh position={[0, 0.45, 0.55]} geometry={caixa(0.45, 0.05, 0.45)} material={mat("#3a6fd6")} />
          <mesh position={[0, 0.72, 0.76]} geometry={caixa(0.45, 0.5, 0.05)} material={mat("#3a6fd6")} />
        </group>
      )))}
      {/* cartazes e mapa */}
      <mesh position={[-2.6, 2.3, PAREDE + 0.07]} geometry={caixa(1.0, 0.7, 0.02)} material={mat("#7fb3e5")} />
      <mesh position={[-2.6, 2.3, PAREDE + 0.085]} scale={[1.2, 0.8, 1]} geometry={esfera(0.2, 0)} material={mat("#5a9a4a")} />
      <mesh position={[2.6, 1.6, PAREDE + 0.07]} geometry={caixa(0.7, 0.9, 0.02)} material={mat(cor, { emissivo: cor, brilho: 0.15 })} />
      <Janela hora={hora} x={-4.33} />
    </group>
  );
};

// ---------- sala de estar ----------
// Quem estiver "sentado" senta-se no sofá (a cena não põe a cadeira gamer aqui).
export const SOFA_Z = -1.75;
export const SalaEstar: React.FC<{ t: number; hora: Hora; cor: string; cor2: string }> = ({ t, hora, cor, cor2 }) => {
  const tv = ["#3f8fe5", "#e5a33f", "#5ad98a", "#e55a8a"][Math.floor(t / 2.5) % 4];
  const noite = hora === "noite";
  return (
    <group>
      <hemisphereLight args={["#ffe9cf", "#4a3a2c", noite ? 0.5 : 0.85]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[-2.6, 1.9, -1.6]} intensity={noite ? 10 : 5} distance={8} color="#ffcf8a" />
      <pointLight position={[0.5, 2.8, 1]} intensity={noite ? 5 : 11} distance={12} color="#fff1dd" />
      <pointLight position={[-3.6, 1.2, 0.5]} intensity={4 + Math.sin(t * 7) * 1.5} distance={5} color={tv} />
      <directionalLight position={[3, 5, 6]} intensity={noite ? 0.3 : 0.9} />
      <Sala chao={["#8a5e3c", "#94673f"]} parede="#d9c7a8" />
      <mesh position={[0, 0.03, -0.3]} geometry={cilindro(2.2, 2.2, 0.02, 10)} material={mat(cor2)} />
      {/* sofá a todo o comprimento atrás das personagens */}
      <group position={[0, 0, SOFA_Z]}>
        <mesh position-y={0.25} geometry={caixa(3.6, 0.5, 0.95)} material={mat(cor)} />
        <mesh position={[0, 0.47, 0.05]} geometry={caixa(3.3, 0.12, 0.85)} material={mat(cor)} />
        <mesh position={[0, 0.8, -0.38]} geometry={caixa(3.6, 0.7, 0.22)} material={mat(cor)} />
        {[1.85, -1.85].map((x) => <mesh key={x} position={[x, 0.55, 0]} geometry={caixa(0.22, 0.6, 0.95)} material={mat(cor)} />)}
        <mesh position={[-1.3, 0.75, -0.15]} rotation-z={0.2} geometry={caixa(0.45, 0.4, 0.15)} material={mat(cor2)} />
        {/* gato a dormir no braço do sofá */}
        <group position={[1.85, 0.95, 0.1]}>
          <mesh scale={[1.4, 0.6, 0.8]} geometry={esfera(0.18, 1)} material={mat("#e09a4a")} />
          <mesh position={[0.22, 0.04 + 0.01 * Math.sin(t * 2), 0]} geometry={esfera(0.1, 1)} material={mat("#e09a4a")} />
          {[0.05, -0.05].map((z) => <mesh key={z} position={[0.27, 0.13, z]} geometry={cone(0.035, 0.07, 3)} material={mat("#e09a4a")} />)}
        </group>
      </group>
      {/* mesa de centro baixa */}
      <group position={[0, 0, -0.55]}>
        <mesh position-y={0.36} geometry={caixa(1.3, 0.06, 0.6)} material={mat("#5a3e28")} />
        {[[0.55, 0.22], [-0.55, 0.22], [0.55, -0.22], [-0.55, -0.22]].map(([x, z], i) => <mesh key={i} position={[x, 0.17, z]} geometry={caixa(0.05, 0.34, 0.05)} material={mat("#3a2a1e")} />)}
        <mesh position={[0.3, 0.45, 0]} geometry={cilindro(0.05, 0.04, 0.12, 6)} material={mat("#f2f2f2")} />
      </group>
      {/* televisão na parede da esquerda, a cintilar */}
      <group position={[-4.3, 1.5, 0.3]} rotation-y={Math.PI / 2}>
        <mesh geometry={caixa(1.9, 1.1, 0.06)} material={mat("#121418")} />
        <mesh position-z={0.035} geometry={caixa(1.8, 1.0, 0.01)} material={mat("#000", { emissivo: tv, brilho: 0.8 + 0.2 * Math.sin(t * 9) })} />
        <mesh position={[0, -1.0, 0.2]} geometry={caixa(1.8, 0.45, 0.4)} material={mat("#3a2a1e")} />
      </group>
      {/* candeeiro de pé, estante, quadros */}
      <group position={[-2.7, 0, SOFA_Z]}>
        <mesh position-y={0.8} geometry={cilindro(0.03, 0.03, 1.6, 5)} material={mat("#2a2a2a")} />
        <mesh position-y={1.75} geometry={cone(0.3, 0.4, 8)} material={mat("#f4e2bf", { emissivo: "#ffcf8a", brilho: noite ? 1 : 0.3 })} />
      </group>
      <group position={[2.9, 0, PAREDE + 0.3]}>
        <mesh position-y={1.1} geometry={caixa(1.2, 2.2, 0.4)} material={mat("#6b4a2e")} />
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.45 + (i % 6) * 0.17, 0.75 + Math.floor(i / 6) * 0.7, 0.12]} geometry={caixa(0.12, 0.45, 0.25)} material={mat(["#c0392b", "#2f6fd6", "#f2c12e", "#3aa66a", "#8a4fd1", "#ececec"][i % 6])} />)}
      </group>
      {[-1.2, 0.6].map((x, i) => <mesh key={x} position={[x, 2.05, PAREDE + 0.07]} geometry={caixa(0.9, 0.6, 0.03)} material={mat(i ? cor2 : "#e5a33f")} />)}
      <Planta p={[3.7, 0, 1.0]} />
      <Janela hora={hora} />
    </group>
  );
};

// ---------- hospital ----------
export const Hospital: React.FC<{ t: number; hora: Hora }> = ({ t, hora }) => {
  // linha do monitor cardíaco: um batimento a cada 0,9 s que corre da esquerda para a direita
  const linha = useMemo(() => new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#5aff8a" })), []);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = i / 60, fase = ((x * 2.4 - t / 0.9) % 1 + 1) % 1;
    const y = fase < 0.05 ? fase * 6 : fase < 0.09 ? 0.3 - (fase - 0.05) * 14 : fase < 0.12 ? -0.26 + (fase - 0.09) * 8.6 : 0;
    pts.push(new THREE.Vector3(x * 0.62 - 0.31, y * 0.35, 0));
  }
  linha.geometry.setFromPoints(pts);
  return (
    <group>
      <hemisphereLight args={["#f4fbff", "#6a7a80", 1]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 2.9, 0.6]} intensity={15} distance={14} color="#f4fbff" />
      <directionalLight position={[4, 5, 6]} intensity={0.8} />
      <Sala chao={["#c9d2d6", "#bcc6cb"]} parede="#dceeea" lateral="#d2e6e2" />
      {[-1.6, 1.6].map((x) => <mesh key={x} position={[x, 3.28, 0]} geometry={caixa(1.4, 0.04, 0.6)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 1.1 })} />)}
      {/* cama com o doente tapado */}
      <group position={[2.4, 0, -1.2]} rotation-y={-0.25}>
        <mesh position-y={0.55} geometry={caixa(1.0, 0.15, 2.1)} material={mat("#e9ecef")} />
        <mesh position-y={0.3} geometry={caixa(0.95, 0.06, 2.0)} material={mat("#9aa3ad", { metal: 0.5 })} />
        {[[0.42, 0.95], [-0.42, 0.95], [0.42, -0.95], [-0.42, -0.95]].map(([x, z], i) => <mesh key={i} position={[x, 0.15, z]} geometry={cilindro(0.03, 0.03, 0.3, 5)} material={mat("#9aa3ad")} />)}
        <mesh position={[0, 0.85, -1.02]} geometry={caixa(1.0, 0.7, 0.06)} material={mat("#9aa3ad", { metal: 0.4 })} />
        <mesh position={[0, 0.7, -0.75]} geometry={caixa(0.6, 0.14, 0.35)} material={mat("#ffffff")} />
        <mesh position={[0, 0.82, -0.72]} geometry={esfera(0.15, 1)} material={mat("#e0ab7f")} />
        <mesh position={[0, 0.72, 0.25 + 0.01 * Math.sin(t * 1.5)]} scale={[1, 0.35, 1]} geometry={caixa(0.95, 0.4, 1.4)} material={mat("#7fb8d6")} />
      </group>
      {/* monitor cardíaco e soro */}
      <group position={[3.6, 0, -2.0]} rotation-y={-0.6}>
        <mesh position-y={0.7} geometry={cilindro(0.03, 0.03, 1.4, 5)} material={mat("#9aa3ad")} />
        <mesh position-y={1.6} geometry={caixa(0.75, 0.5, 0.12)} material={mat("#2a2f38")} />
        <mesh position={[0, 1.6, 0.065]} geometry={caixa(0.68, 0.42, 0.01)} material={mat("#05140a")} />
        <group position={[0, 1.6, 0.075]}><primitive object={linha} /></group>
      </group>
      <group position={[1.4, 0, -2.1]}>
        <mesh position-y={1.0} geometry={cilindro(0.02, 0.02, 2.0, 5)} material={mat("#c9ced6")} />
        <mesh position={[0, 1.85, 0.05]} geometry={caixa(0.18, 0.28, 0.06)} material={mat("#dff3ff", { opacidade: 0.7 })} />
        <mesh position-y={0.02} geometry={cilindro(0.2, 0.2, 0.04, 6)} material={mat("#c9ced6")} />
      </group>
      {/* cortina, armário, caixote de luvas, cruz na parede */}
      <mesh position={[1.25, 1.5, -2.05]} rotation-y={Math.PI / 2} geometry={caixa(1.0, 2.6, 0.03)} material={mat("#9fd8d0", { opacidade: 0.85 })} />
      <mesh position={[-2.8, 0.9, PAREDE + 0.3]} geometry={caixa(1.4, 1.8, 0.5)} material={mat("#f4f6f8")} />
      <mesh position={[-2.8, 0.9, PAREDE + 0.56]} geometry={caixa(0.02, 1.6, 0.01)} material={mat("#c9ced6")} />
      <group position={[-1.0, 2.2, PAREDE + 0.07]}>
        <mesh geometry={caixa(0.5, 0.15, 0.02)} material={mat("#e5281f")} />
        <mesh geometry={caixa(0.15, 0.5, 0.02)} material={mat("#e5281f")} />
      </group>
      <Planta p={[-3.7, 0, 1.2]} />
      <Janela hora={hora} x={-4.33} />
    </group>
  );
};

// ---------- nave espacial (ponte de comando) ----------
export const Nave: React.FC<{ t: number; cor: string }> = ({ t, cor }) => {
  const botoes = useMemo(() => { const r = rng(14); return Array.from({ length: 40 }, () => ({ fase: r() * 6, cor: ["#ff3b30", "#34c759", "#ffcc00", "#3fa9ff"][Math.floor(r() * 4)] })); }, []);
  return (
    <group>
      <Estrelas n={1200} raio={300} t={t} todas />
      <hemisphereLight args={["#bcd4ff", "#1a1f2a", 0.7]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 2.8, 0.5]} intensity={12} distance={12} color="#dfe9ff" />
      <pointLight position={[0, 1.2, -2.2]} intensity={6} distance={6} color={cor} />
      <directionalLight position={[10, 4, -20]} intensity={2} color="#fff4e0" />
      {/* chão de painéis, paredes laterais com faixas de luz */}
      {Array.from({ length: 10 * 8 }, (_, i) => <mesh key={i} position={[(i % 10) * 0.9 - 4.05, 0, Math.floor(i / 10) * 0.9 - 2.4]} geometry={caixa(0.88, 0.04, 0.88)} material={mat((i + Math.floor(i / 10)) % 2 ? "#3a404c" : "#343a45", { metal: 0.4, aspereza: 0.5 })} />)}
      {[-4.4, 4.4].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.6, 0.6]} geometry={caixa(0.12, 3.4, 7.4)} material={mat("#2a2f3a", { metal: 0.4 })} />
          <mesh position={[x * 0.985, 2.4, 0.6]} geometry={caixa(0.03, 0.06, 7)} material={mat("#000", { emissivo: cor, brilho: 1.8 })} />
        </group>
      ))}
      <mesh position={[0, 3.3, 0.6]} geometry={caixa(9, 0.12, 7.4)} material={mat("#22262f", { metal: 0.4 })} />
      {/* parede do fundo com uma janela grande (aberta para as estrelas e a Terra) */}
      <mesh position={[0, 0.35, PAREDE]} geometry={caixa(9, 0.7, 0.2)} material={mat("#2a2f3a", { metal: 0.4 })} />
      <mesh position={[0, 3.05, PAREDE]} geometry={caixa(9, 0.6, 0.2)} material={mat("#2a2f3a", { metal: 0.4 })} />
      {[-3.6, 3.6].map((x) => <mesh key={x} position={[x, 1.7, PAREDE]} geometry={caixa(1.8, 2.1, 0.2)} material={mat("#2a2f3a", { metal: 0.4 })} />)}
      {[-1.35, 1.35].map((x) => <mesh key={x} position={[x, 1.7, PAREDE]} geometry={caixa(0.12, 2.1, 0.22)} material={mat("#1c2028")} />)}
      <Corpo nome="terra" raio={9} posicao={[6, -5, -40]} t={t} />
      {/* consolas com botões a piscar */}
      {[-2.7, 2.7].map((x, j) => (
        <group key={x} position={[x, 0, -1.6]} rotation-y={-x * 0.15}>
          <mesh position-y={0.45} geometry={caixa(1.3, 0.9, 0.7)} material={mat("#30353f", { metal: 0.4 })} />
          <mesh position={[0, 0.95, 0.05]} rotation-x={-0.6} geometry={caixa(1.3, 0.05, 0.6)} material={mat("#1c2028")} />
          {botoes.slice(j * 20, j * 20 + 20).map((b, i) => (
            <mesh key={i} position={[-0.5 + (i % 5) * 0.25, 0.98 + Math.floor(i / 5) * 0.08 * 0.6, 0.22 - Math.floor(i / 5) * 0.1]} rotation-x={-0.6} geometry={caixa(0.12, 0.03, 0.06)}
              material={mat(b.cor, { emissivo: b.cor, brilho: Math.sin(t * 3 + b.fase) > 0.2 ? 1.6 : 0.15 })} />
          ))}
          <mesh position={[0, 1.4, -0.25]} geometry={caixa(1.1, 0.6, 0.05)} material={mat("#0b1a2e", { emissivo: "#3fa9ff", brilho: 0.7 })} />
        </group>
      ))}
    </group>
  );
};

// ---------- abrigo nuclear ----------
// Betão, beliches, prateleiras com latas e garrafões, rádio, porta blindada redonda, símbolo da radiação
// e uma lâmpada pendurada que tremeluz (com um abanão de vez em quando, como se algo rebentasse lá fora).
export const Abrigo: React.FC<{ t: number }> = ({ t }) => {
  const treme = Math.sin(t * 0.9) > 0.97 ? 0.08 * Math.sin(t * 60) : 0;
  const luz = 7 + 2 * Math.sin(t * 23) * (Math.sin(t * 1.7) > 0.8 ? 1 : 0.15);
  return (
    <group>
      <hemisphereLight args={["#d8d2c0", "#2a2622", 0.35]} />
      <ambientLight intensity={0.18} />
      <pointLight position={[0.3, 2.4, 0.2]} intensity={luz} distance={9} color="#ffd9a0" />
      <Sala chao={["#5a5650", "#55514b"]} parede="#77736b" lateral="#6e6a62" />
      <mesh position={[0, 3.3, 0.6]} geometry={caixa(9, 0.12, 7.4)} material={mat("#5f5b54")} />
      {/* lâmpada pendurada a balançar */}
      <group position={[0.3, 3.25, 0.2]} rotation-z={0.05 * Math.sin(t * 1.3) + treme}>
        <mesh position-y={-0.4} geometry={cilindro(0.01, 0.01, 0.8, 4)} material={mat("#222")} />
        <mesh position-y={-0.85} geometry={esfera(0.08, 1)} material={mat("#fff1c8", { emissivo: "#ffd9a0", brilho: luz / 4 })} />
      </group>
      {/* beliches à esquerda */}
      <group position={[-3.3, 0, -0.6]}>
        {[0.45, 1.5].map((y) => (
          <group key={y}>
            <mesh position-y={y} geometry={caixa(0.95, 0.08, 2.0)} material={mat("#5a6a5a", { metal: 0.4 })} />
            <mesh position-y={y + 0.1} geometry={caixa(0.85, 0.12, 1.9)} material={mat("#7a8a6a")} />
            <mesh position={[0, y + 0.2, -0.75]} geometry={caixa(0.5, 0.1, 0.3)} material={mat("#d8d2c0")} />
          </group>
        ))}
        {[[0.45, 0.95], [-0.45, 0.95], [0.45, -0.95], [-0.45, -0.95]].map(([x, z], i) => <mesh key={i} position={[x, 0.95, z]} geometry={caixa(0.05, 1.9, 0.05)} material={mat("#4a554a", { metal: 0.4 })} />)}
      </group>
      {/* prateleiras com latas e garrafões */}
      <group position={[0.4, 0, PAREDE + 0.3]}>
        {[0.5, 1.1, 1.7, 2.3].map((y) => <mesh key={y} position-y={y} geometry={caixa(2.4, 0.05, 0.45)} material={mat("#6b6f75", { metal: 0.4 })} />)}
        {[-1.2, 1.2].map((x) => <mesh key={x} position={[x, 1.3, 0]} geometry={caixa(0.05, 2.6, 0.45)} material={mat("#5a5f68")} />)}
        {Array.from({ length: 30 }, (_, i) => {
          const y = [0.5, 1.1, 1.7][i % 3], x = -1.05 + Math.floor(i / 3) * 0.23;
          return <mesh key={i} position={[x, y + 0.11, 0]} geometry={cilindro(0.07, 0.07, 0.2, 7)} material={mat(["#c0392b", "#d9b34a", "#7f8c8d", "#3a6fd6"][i % 4], { metal: 0.5 })} />;
        })}
        {[-0.8, -0.3, 0.2, 0.7].map((x) => <mesh key={x} position={[x, 2.48, 0]} geometry={cilindro(0.16, 0.16, 0.36, 8)} material={mat("#3f8fe5", { opacidade: 0.8 })} />)}
      </group>
      {/* mesa com o rádio */}
      <group position={[2.2, 0, -1.5]}>
        <mesh position-y={0.74} geometry={caixa(1.2, 0.06, 0.7)} material={mat("#6b4a2e")} />
        {[[0.5, 0.28], [-0.5, 0.28], [0.5, -0.28], [-0.5, -0.28]].map(([x, z], i) => <mesh key={i} position={[x, 0.37, z]} geometry={caixa(0.05, 0.74, 0.05)} material={mat("#4a3420")} />)}
        <mesh position={[0, 0.92, 0]} geometry={caixa(0.55, 0.3, 0.25)} material={mat("#3a3d44")} />
        <mesh position={[-0.12, 0.92, 0.13]} rotation-x={Math.PI / 2} geometry={cilindro(0.08, 0.08, 0.02, 10)} material={mat("#1b1b1b")} />
        <mesh position={[0.15, 0.95, 0.13]} geometry={caixa(0.18, 0.08, 0.01)} material={mat("#1a0e05", { emissivo: "#ffb04a", brilho: 0.8 })} />
        <mesh position={[0.22, 1.25, -0.05]} rotation-z={-0.3} geometry={cilindro(0.008, 0.008, 0.5, 4)} material={mat("#9aa3ad")} />
      </group>
      {/* porta blindada redonda na parede da direita */}
      <group position={[4.3, 1.35, 0.4]} rotation-y={-Math.PI / 2}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(1.1, 1.1, 0.25, 20)} material={mat("#8a8f96", { metal: 0.7, aspereza: 0.35 })} />
        <mesh position-z={0.14} rotation-x={Math.PI / 2} geometry={cilindro(0.7, 0.7, 0.05, 20)} material={mat("#6b7078", { metal: 0.6 })} />
        <group position-z={0.2} rotation-z={0.3 * Math.sin(t * 0.2)}>
          {[0, 1, 2].map((i) => <mesh key={i} rotation-z={(i * Math.PI) / 3} geometry={caixa(0.9, 0.06, 0.06)} material={mat("#c9ced6", { metal: 0.8 })} />)}
        </group>
      </group>
      {/* símbolo da radiação e garrafões de água */}
      <group position={[-1.6, 2.2, PAREDE + 0.08]} scale={0.32}>
        <mesh rotation-x={Math.PI / 2} geometry={cilindro(1.2, 1.2, 0.08, 24)} material={mat("#ffd21a")} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} position-z={0.05} rotation-z={Math.PI / 2 + i * (Math.PI * 2 / 3) - Math.PI / 6}>
            <ringGeometry args={[0.28, 1.0, 12, 1, 0, Math.PI / 3]} />
            <meshStandardMaterial color="#151515" side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {[[-2.2, 0.3], [-1.8, 0.6]].map(([x, z], i) => <mesh key={i} position={[x, 0.3, z + 1.4]} geometry={cilindro(0.25, 0.25, 0.6, 8)} material={mat("#2f6fd6", { opacidade: 0.85 })} />)}
    </group>
  );
};
