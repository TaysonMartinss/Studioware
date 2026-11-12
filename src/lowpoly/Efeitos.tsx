import { useMemo } from "react";
import * as THREE from "three";
import { clamp01, rng } from "./util";

// Efeitos com partículas (explosão, fogo, fumo). Tudo é função do tempo: cada partícula nasce num instante
// fixo com valores aleatórios fixos (semente), por isso o mesmo frame dá sempre a mesma imagem.

type Particula = { nasce: number; vida: number; v: [number, number, number]; s0: number; s1: number; gravidade: number; cores: string[]; giro: number };

const Particulas: React.FC<{ lista: Particula[]; t: number; origem: [number, number, number]; geometria: THREE.BufferGeometry; aceso: boolean; escala: number }> = ({ lista, t, origem, geometria, aceso, escala }) => {
  const malha = useMemo(() => {
    // fogo e explosão: material sem luz (brilha com a própria cor); fumo: material normal (apanha a luz da cena)
    const material = aceso ? new THREE.MeshBasicMaterial({ color: "#ffffff" }) : new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1 });
    const m = new THREE.InstancedMesh(geometria, material, Math.max(1, lista.length));
    m.frustumCulled = false;
    return m;
  }, [lista, geometria, aceso]);
  const aux = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  let n = 0;
  for (const p of lista) {
    const idade = t - p.nasce;
    if (idade < 0 || idade > p.vida) continue;
    const k = idade / p.vida;
    aux.position.set(
      origem[0] + p.v[0] * idade * escala,
      origem[1] + (p.v[1] * idade - 0.5 * p.gravidade * idade * idade) * escala,
      origem[2] + p.v[2] * idade * escala,
    );
    if (aux.position.y < 0.05 && p.gravidade > 0) aux.position.y = 0.05;
    aux.rotation.set(idade * p.giro, idade * p.giro * 0.7, 0);
    aux.scale.setScalar(Math.max(0.001, (p.s0 + (p.s1 - p.s0) * k) * escala));
    aux.updateMatrix();
    malha.setMatrixAt(n, aux.matrix);
    // cor ao longo da vida (do primeiro tom ao último)
    const pos = k * (p.cores.length - 1), i = Math.floor(pos);
    c.set(p.cores[i]).lerp(new THREE.Color(p.cores[Math.min(p.cores.length - 1, i + 1)]), pos - i);
    malha.setColorAt(n, c);
    n++;
  }
  malha.count = n;
  malha.instanceMatrix.needsUpdate = true;
  if (malha.instanceColor) malha.instanceColor.needsUpdate = true;
  return <primitive object={malha} />;
};

const geoPedaco = new THREE.IcosahedronGeometry(1, 0);
const geoBola = new THREE.IcosahedronGeometry(1, 1);

export type TipoEfeito = "explosao" | "fogo" | "fumo";

export const Efeito: React.FC<{ tipo: TipoEfeito; t: number; quando?: number; duracao?: number; posicao: [number, number, number]; escala?: number; semente?: number }> = ({
  tipo, t, quando = 0, duracao = 99, posicao, escala = 1, semente = 1,
}) => {
  const lista = useMemo(() => {
    const r = rng(semente * 97 + tipo.length);
    const out: Particula[] = [];
    if (tipo === "explosao") {
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, el = r() * 1.2 + 0.15, v = 4 + r() * 7;
        out.push({ nasce: quando, vida: 0.9 + r() * 0.9, v: [Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v + 2, Math.sin(a) * Math.cos(el) * v], s0: 0.18 + r() * 0.25, s1: 0.02, gravidade: 9, cores: ["#fff6c8", "#ffb52a", "#ff5a14", "#3a2a24"], giro: 6 + r() * 8 });
      }
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, v = 0.8 + r() * 1.6;
        out.push({ nasce: quando + 0.05 + r() * 0.25, vida: 2 + r() * 1.5, v: [Math.cos(a) * v, 1.4 + r() * 1.6, Math.sin(a) * v], s0: 0.4, s1: 1.0 + r() * 0.5, gravidade: 0, cores: ["#ff8a2a", "#6a5a54", "#4a4442", "#3a3634"], giro: 1 });
      }
    } else {
      const passo = tipo === "fogo" ? 0.035 : 0.09;
      const fim = Math.min(duracao, 40);
      for (let k = 0; k * passo < fim; k++) {
        const nasce = quando + k * passo;
        if (tipo === "fogo") out.push({ nasce, vida: 0.55 + r() * 0.4, v: [(r() - 0.5) * 0.6, 1.6 + r() * 1.2, (r() - 0.5) * 0.6], s0: 0.32 + r() * 0.15, s1: 0.03, gravidade: 0, cores: ["#fff2a8", "#ffb02a", "#ff5414", "#b8240c"], giro: 3 });
        else out.push({ nasce, vida: 2.4 + r() * 1.2, v: [(r() - 0.5) * 0.5 + 0.25, 1.0 + r() * 0.6, (r() - 0.5) * 0.5], s0: 0.2, s1: 0.65 + r() * 0.4, gravidade: 0, cores: ["#d6d2cc", "#b9b5af", "#a29e98", "#8f8b86"], giro: 0.6 });
      }
    }
    return out;
  }, [tipo, quando, duracao, semente]);

  const flash = tipo === "explosao" ? clamp01(1 - (t - quando) / 0.45) * (t >= quando ? 1 : 0) : 0;
  const onda = tipo === "explosao" && t >= quando ? (t - quando) : -1;
  return (
    <group>
      <Particulas lista={lista} t={t} origem={posicao} geometria={tipo === "explosao" ? geoPedaco : geoBola} aceso={tipo !== "fumo"} escala={escala} />
      {flash > 0 && (
        <>
          <mesh position={posicao} scale={escala * (0.8 + (1 - flash) * 2.2)}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial color="#fff2c0" transparent opacity={flash * 0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <pointLight position={[posicao[0], posicao[1] + 1, posicao[2]]} intensity={300 * flash * escala} distance={40 * escala} color="#ffb060" />
        </>
      )}
      {onda >= 0 && onda < 1.2 && (
        <mesh position={[posicao[0], 0.06, posicao[2]]} rotation-x={-Math.PI / 2} scale={escala * (0.5 + onda * 9)}>
          <ringGeometry args={[0.85, 1, 32]} />
          <meshBasicMaterial color="#fff0d0" transparent opacity={0.6 * (1 - onda / 1.2)} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {tipo === "fogo" && t >= quando && t <= quando + duracao && (
        <pointLight position={[posicao[0], posicao[1] + 0.8 * escala, posicao[2]]} intensity={(40 + 12 * Math.sin(t * 23)) * escala} distance={12 * escala} color="#ff8a30" />
      )}
    </group>
  );
};
