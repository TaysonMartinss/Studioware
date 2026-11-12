import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { staticFile } from "remotion";
import catalogo from "./modelos.json";

// Modelos low poly prontos (packs CC0 da Kenney em public/modelos/kenney/<pack>/<nome>.glb), usados pelo objeto `modelo`.
// O catálogo (scripts/catalogo_modelos.py) dá o tamanho de cada um em unidades do ficheiro; cada pack tem a sua
// escala, por isso converto para metros (o boneco tem ~1,8 m) com um fator por pack.

const CATALOGO = catalogo as unknown as Record<string, [number, number, number]>;

export const METROS_POR_UNIDADE: Record<string, number> = {
  "blaster-kit": 1.3, "blocky-characters": 0.67, "building-kit": 2, "car-kit": 1.75, "castle-kit": 4.5,
  "city-kit-commercial": 9, "city-kit-industrial": 8, "city-kit-roads": 8, "city-kit-suburban": 8, "cube-pets": 0.6,
  "factory-kit": 1.5, "fantasy-town-kit": 3, "food-kit": 0.45, "furniture-kit": 1.9, "graveyard-kit": 1.1,
  "hexagon-kit": 3, "holiday-kit": 1.6, "mini-arcade": 2.3, "mini-characters": 2.7, "mini-dungeon": 2.4,
  "mini-forest": 2.5, "mini-shop": 2.5, "modular-buildings": 8, "modular-dungeon-kit": 1, "modular-space-kit": 1,
  "nature-kit": 3.5, "pirate-kit": 2, "platformer-kit": 2, "racing-kit": 3.3, "retro-fantasy-kit": 3,
  "retro-urban-kit": 3, "space-kit": 2, "space-station-kit": 3, "survival-kit": 3.5, "tower-defense-kit": 3,
  "train-kit": 2.4, "watercraft-kit": 1.7,
};

const normal = (s: string) => s.toLowerCase().replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-");
const palavras = (s: string) => normal(s).split(/[-/.]+/).filter(Boolean);
const IDS = Object.keys(CATALOGO);
const POR_NOME = new Map<string, string>();
for (const id of IDS) { const n = normal(id.split("/")[1]); if (!POR_NOME.has(n)) POR_NOME.set(n, id); }

// "pirate-kit/ship-large", "ship-large" ou palavras parecidas ("ship large", "pirate ship") → id do catálogo
const cache = new Map<string, string | undefined>();
export const resolverModelo = (pedido?: string): string | undefined => {
  if (!pedido) return undefined;
  if (cache.has(pedido)) return cache.get(pedido);
  let id: string | undefined = CATALOGO[pedido] ? pedido : undefined;
  const [pack, nome] = pedido.includes("/") ? pedido.split("/", 2) : [undefined, pedido];
  if (!id && pack) id = IDS.find((i) => i.startsWith(pack + "/") && normal(i.split("/")[1]) === normal(nome));
  if (!id) id = POR_NOME.get(normal(nome));
  if (!id) {
    // a palavra mais parecida: conta as palavras pedidas que aparecem no id (o pack também conta); empate = nome mais curto
    const pedidas = palavras(pedido);
    let melhor = 0;
    for (const i of IDS) {
      const tem = palavras(i);
      const pontos = pedidas.reduce((s, p) => s + (tem.includes(p) ? 1 : tem.some((t) => t.startsWith(p) || p.startsWith(t)) ? 0.5 : 0), 0);
      if (pontos > melhor || (pontos === melhor && pontos > 0 && id && i.length < id.length)) { melhor = pontos; id = i; }
    }
  }
  cache.set(pedido, id);
  return id;
};

// tamanho em metros (largura, altura, profundidade)
export const dimsModelo = (id?: string): [number, number, number] => {
  if (!id || !CATALOGO[id]) return [1, 1, 1];
  const k = METROS_POR_UNIDADE[id.split("/")[0]] ?? 2;
  return CATALOGO[id].map((v) => Math.max(0.05, v * k)) as [number, number, number];
};

// o modelo assenta no chão (base em y = 0), centrado em x e z, à escala real
export const ModeloGlb: React.FC<{ id: string; t: number; girar?: boolean }> = ({ id, t, girar }) => {
  const { scene } = useGLTF(staticFile(`modelos/kenney/${id}.glb`));
  const { objeto, escala } = useMemo(() => {
    const o = new THREE.Group();
    const copia = scene.clone(true);
    copia.traverse((m) => {
      const malha = m as THREE.Mesh;
      if (!malha.isMesh) return;
      // materiais próprios por cópia, facetados como o resto do motor
      const mats = (Array.isArray(malha.material) ? malha.material : [malha.material]).map((mt) => {
        const c = (mt as THREE.MeshStandardMaterial).clone();
        c.flatShading = true; c.needsUpdate = true;
        return c;
      });
      malha.material = Array.isArray(malha.material) ? mats : mats[0];
    });
    o.add(copia);
    const caixa = new THREE.Box3().setFromObject(o);
    const centro = caixa.getCenter(new THREE.Vector3());
    copia.position.set(-centro.x, -caixa.min.y, -centro.z);
    return { objeto: o, escala: METROS_POR_UNIDADE[id.split("/")[0]] ?? 2 };
  }, [scene, id]);
  return <group scale={escala} rotation-y={girar ? t * 0.6 : 0}><primitive object={objeto} /></group>;
};
