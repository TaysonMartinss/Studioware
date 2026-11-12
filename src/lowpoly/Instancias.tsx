import { useMemo } from "react";
import * as THREE from "three";

export type Inst = { p: [number, number, number]; s?: [number, number, number] | number; r?: number; cor?: string };

// Muitos objetos iguais (público, árvores, janelas, pedras) num único InstancedMesh: uma só chamada de desenho.
// `mover` (opcional) muda cada instância no tempo; sem ele as matrizes só se calculam uma vez.
export const Instancias: React.FC<{
  itens: Inst[]; geometria: THREE.BufferGeometry; material: THREE.Material; t?: number;
  mover?: (i: number, it: Inst, t: number, m: THREE.Object3D) => void;
}> = ({ itens, geometria, material, t = 0, mover }) => {
  const malha = useMemo(() => {
    const m = new THREE.InstancedMesh(geometria, material, Math.max(1, itens.length));
    m.count = itens.length;
    m.frustumCulled = false;
    const c = new THREE.Color();
    itens.forEach((it, i) => { if (it.cor) m.setColorAt(i, c.set(it.cor)); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  }, [itens, geometria, material]);

  const aux = useMemo(() => new THREE.Object3D(), []);
  const calcular = (tt: number) => {
    itens.forEach((it, i) => {
      aux.position.set(...it.p);
      aux.rotation.set(0, it.r ?? 0, 0);
      const s = it.s ?? 1;
      if (typeof s === "number") aux.scale.setScalar(s); else aux.scale.set(...s);
      mover?.(i, it, tt, aux);
      aux.updateMatrix();
      malha.setMatrixAt(i, aux.matrix);
    });
    malha.instanceMatrix.needsUpdate = true;
  };
  useMemo(() => calcular(t), [malha]); // eslint-disable-line react-hooks/exhaustive-deps
  if (mover) calcular(t);
  return <primitive object={malha} />;
};
