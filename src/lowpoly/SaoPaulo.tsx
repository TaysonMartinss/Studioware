import { useMemo } from "react";
import * as THREE from "three";
import { Hora } from "./ambiente";
import { Cidade } from "./Cidade";
import { Instancias, Inst } from "./Instancias";
import { caixa, cilindro, cone, esfera, geo, mat } from "./util";

// Rua de São Paulo (vídeos sobre golpes e o dia a dia da cidade): a rua da cidade com carros e prédios, mais a
// calçada de pedra portuguesa preta e branca, o caixa eletrônico 24 h, o orelhão, a banca de jornal, a moto do
// motoboy parada junto ao meio-fio e uma antena de TV vermelha e branca no horizonte.
// As personagens ficam no passeio da frente (z ≈ 0), como na cidade; o meio-fio está em z ≈ -2.

// moto de entregas (também serve ao falso motoboy do golpe do cartão)
export const Moto: React.FC<{ cor?: string; noite?: boolean }> = ({ cor = "#c0392b", noite }) => {
  const roda = geo("roda-moto", () => new THREE.TorusGeometry(0.27, 0.07, 6, 14));
  return (
    <group>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0.34, 0]}>
          <mesh geometry={roda} material={mat("#16171b")} />
          <mesh rotation-x={Math.PI / 2} geometry={cilindro(0.12, 0.12, 0.06, 8)} material={mat("#9aa3ad", { metal: 0.7 })} />
        </group>
      ))}
      <mesh position={[0, 0.6, 0]} rotation-z={0.15} geometry={caixa(0.9, 0.25, 0.22)} material={mat(cor, { aspereza: 0.4, metal: 0.3 })} />
      <mesh position={[0.15, 0.78, 0]} geometry={caixa(0.42, 0.22, 0.3)} material={mat(cor, { aspereza: 0.4, metal: 0.3 })} />
      <mesh position={[-0.25, 0.86, 0]} geometry={caixa(0.55, 0.08, 0.26)} material={mat("#1a1a1e")} />
      <mesh position={[0.48, 0.9, 0]} rotation-z={-0.35} geometry={cilindro(0.025, 0.025, 0.55, 5)} material={mat("#3a3d44", { metal: 0.6 })} />
      <mesh position={[0.56, 1.14, 0]} rotation-x={Math.PI / 2} geometry={cilindro(0.02, 0.02, 0.6, 5)} material={mat("#1a1a1e")} />
      <mesh position={[0.66, 0.98, 0]} geometry={caixa(0.08, 0.14, 0.18)} material={mat("#fffbe0", { emissivo: "#fff2b0", brilho: noite ? 2 : 0.3 })} />
      <mesh position={[-0.35, 0.42, 0.12]} rotation-z={0.1} geometry={cilindro(0.04, 0.05, 0.5, 6)} material={mat("#9aa3ad", { metal: 0.8, aspereza: 0.3 })} />
      {/* baú de entregas */}
      <mesh position={[-0.6, 1.12, 0]} geometry={caixa(0.46, 0.42, 0.46)} material={mat("#e8b21b")} />
      <mesh position={[-0.6, 1.12, 0.235]} geometry={caixa(0.3, 0.12, 0.01)} material={mat("#c0392b")} />
    </group>
  );
};

// caixa eletrônico de rua (quiosque 24 h): ecrã azul, teclado, ranhura do cartão e saída das notas
const CaixaEletronico: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <mesh position-y={1.0} geometry={caixa(0.9, 2.0, 0.7)} material={mat("#c9ced6", { metal: 0.3, aspereza: 0.5 })} />
    <mesh position={[0, 2.08, 0]} geometry={caixa(0.96, 0.22, 0.76)} material={mat("#d9342b", { emissivo: "#d9342b", brilho: 0.35 })} />
    <mesh position={[0, 2.08, 0.385]} geometry={caixa(0.4, 0.1, 0.01)} material={mat("#ffffff", { emissivo: "#ffffff", brilho: 0.8 })} />
    <mesh position={[0, 1.45, 0.36]} rotation-x={-0.2} geometry={caixa(0.5, 0.36, 0.03)} material={mat("#123a6b", { emissivo: "#3f8cff", brilho: 0.7 + 0.15 * Math.sin(t * 2) })} />
    <mesh position={[0, 1.06, 0.4]} rotation-x={-0.9} geometry={caixa(0.4, 0.26, 0.06)} material={mat("#3a3d44")} />
    {Array.from({ length: 12 }, (_, k) => <mesh key={k} position={[-0.12 + (k % 3) * 0.12, 1.12 - Math.floor(k / 3) * 0.05, 0.45 - Math.floor(k / 3) * 0.04]} rotation-x={-0.9} geometry={caixa(0.08, 0.035, 0.02)} material={mat(k === 9 ? "#d9342b" : k === 11 ? "#3fa34d" : "#d7dbe0")} />)}
    <mesh position={[0.3, 1.2, 0.36]} geometry={caixa(0.12, 0.02, 0.03)} material={mat("#14161a", { emissivo: "#3fa34d", brilho: 0.8 })} />
    <mesh position={[0, 0.78, 0.36]} geometry={caixa(0.36, 0.04, 0.03)} material={mat("#14161a")} />
  </group>
);

// orelhão: a concha laranja em cima de um poste, com o telefone por dentro
const Orelhao: React.FC = () => {
  const concha = geo("orelhao", () => new THREE.SphereGeometry(0.5, 12, 8, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.62));
  return (
    <group>
      <mesh position-y={1.0} geometry={cilindro(0.05, 0.06, 2.0, 6)} material={mat("#7d8794", { metal: 0.4 })} />
      <mesh position-y={1.55} rotation-y={Math.PI} scale={[1, 1.25, 1]} geometry={concha} material={mat("#f07d1a", { ladoDuplo: true, aspereza: 0.5 })} />
      <mesh position={[0, 1.55, -0.2]} geometry={caixa(0.26, 0.42, 0.14)} material={mat("#c9ced6", { metal: 0.3 })} />
      <mesh position={[0.08, 1.6, -0.12]} rotation-z={0.2} geometry={caixa(0.06, 0.26, 0.06)} material={mat("#1c1f26")} />
    </group>
  );
};

// banca de jornal: caixote verde com toldo e as capas das revistas penduradas
const Banca: React.FC = () => (
  <group>
    <mesh position-y={1.05} geometry={caixa(1.9, 2.1, 1.2)} material={mat("#2f6b3a")} />
    <mesh position={[0, 2.2, 0.35]} rotation-x={0.25} geometry={caixa(2.1, 0.06, 1.0)} material={mat("#3f8a4a")} />
    <mesh position={[0, 1.05, 0.61]} geometry={caixa(1.6, 1.5, 0.02)} material={mat("#1b2a1e")} />
    {Array.from({ length: 15 }, (_, k) => <mesh key={k} position={[-0.6 + (k % 5) * 0.3, 1.55 - Math.floor(k / 5) * 0.45, 0.63]} geometry={caixa(0.24, 0.34, 0.01)} material={mat(["#e33b3b", "#f2c12e", "#2f6fd6", "#f2f2f2", "#d65aa8", "#3aa66a"][(k * 7) % 6])} />)}
  </group>
);

// antena de TV treliçada, em faixas vermelhas e brancas, com a luz de aviso a piscar no topo
const Antena: React.FC<{ t: number; altura?: number }> = ({ t, altura = 40 }) => {
  const n = 8, seg = altura / n;
  return (
    <group>
      {Array.from({ length: n }, (_, k) => <mesh key={k} position-y={seg * (k + 0.5)} geometry={cilindro(1.2 - k * 0.13, 1.3 - k * 0.13, seg, 4)} material={mat(k % 2 ? "#f2f2f2" : "#d9342b", { opacidade: 0.92 })} />)}
      <mesh position-y={altura + 2} geometry={cilindro(0.08, 0.15, 4, 4)} material={mat("#d9342b")} />
      <mesh position-y={altura + 4.1} geometry={esfera(0.35, 0)} material={mat("#ff3b30", { emissivo: "#ff2a1f", brilho: Math.sin(t * 3) > 0 ? 2.5 : 0.2, semNevoa: true })} />
    </group>
  );
};

export const RuaSP: React.FC<{ hora: Hora; t: number }> = ({ hora, t }) => {
  const noite = hora === "noite";
  // calçada de pedra portuguesa: ondas pretas sobre branco
  const mosaico = useMemo(() => {
    const it: Inst[] = [];
    const L = 0.2;
    for (let x = 0; x < 70; x++) for (let z = 0; z < 26; z++) {
      const px = -7 + x * L, pz = -1.85 + z * L;
      const onda = Math.sin(px * 0.9 + 2.2 * Math.sin(pz * 0.7)) > 0.45;
      it.push({ p: [px, 0.145, pz], cor: onda ? "#26262a" : "#ecebe6" });
    }
    return it;
  }, []);
  return (
    <group>
      <Cidade hora={hora} t={t} />
      <Instancias itens={mosaico} geometria={caixa(0.19, 0.012, 0.19)} material={mat("#ffffff", { aspereza: 0.6 })} />
      {/* meio-fio */}
      <mesh position={[0, 0.1, -2.0]} geometry={caixa(30, 0.2, 0.16)} material={mat("#9a968e")} />

      <group position={[-1.95, 0.14, -1.25]} rotation-y={0.2}><CaixaEletronico t={t} /></group>
      <group position={[-3.2, 0.14, -0.9]} rotation-y={0.45}><Orelhao /></group>
      <group position={[3.2, 0.14, -1.0]} rotation-y={-0.3}><Banca /></group>
      <group position={[1.55, 0.14, -1.55]} rotation-y={0.1}><Moto noite={noite} /></group>
      {/* lixeira laranja num poste, típica das ruas da cidade */}
      <group position={[-0.9, 0.14, -1.75]}>
        <mesh position-y={0.5} geometry={cilindro(0.03, 0.03, 1.0, 5)} material={mat("#5a5f68")} />
        <mesh position-y={0.85} geometry={cilindro(0.2, 0.17, 0.42, 8)} material={mat("#f07d1a")} />
      </group>
      {noite && <pointLight position={[-2.4, 1.6, -0.5]} intensity={2.5} distance={4} color="#5a9bff" />}

      {/* antena da avenida no horizonte */}
      <group position={[-14, 0, -32]}><Antena t={t} /></group>
      <group position={[12, 0, -38]}><Antena t={t + 0.5} altura={32} /></group>
      {/* cone de obra, que também aparece em qualquer esquina */}
      <mesh position={[0.55, 0.38, -1.8]} geometry={cone(0.18, 0.5, 8)} material={mat("#ff6a1f")} />
    </group>
  );
};
