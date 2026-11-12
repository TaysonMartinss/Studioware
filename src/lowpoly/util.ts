import * as THREE from "three";

// Base do motor low poly: materiais facetados (flatShading) partilhados, aleatório com semente (o mesmo frame
// dá sempre a mesma imagem, como o Remotion exige), ruído para terrenos e funções de tempo.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const suave = (x: number) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
export const entre = (t: number, a: number, b: number) => suave((t - a) / (b - a));
export const sai = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// aleatório determinístico (mulberry32)
export const rng = (semente: number) => {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const sementeDe = (texto: string) => [...texto].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
export const escolher = <T,>(r: () => number, lista: T[]) => lista[Math.floor(r() * lista.length) % lista.length];

// ruído de valor 2D suave (para relevo) e fractal
const hash2 = (x: number, y: number, s: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const ruido = (x: number, y: number, s = 1) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
};
export const fractal = (x: number, y: number, s = 1, oitavas = 4) => {
  let soma = 0, amp = 0.5, f = 1, norma = 0;
  for (let i = 0; i < oitavas; i++) { soma += ruido(x * f, y * f, s + i * 17) * amp; norma += amp; amp *= 0.5; f *= 2; }
  return soma / norma;
};

// materiais partilhados por cor (o low poly vive de cores chapadas por face)
type OpcMat = { emissivo?: string; brilho?: number; opacidade?: number; aspereza?: number; metal?: number; ladoDuplo?: boolean; semNevoa?: boolean };
const MATS = new Map<string, THREE.Material>();
export const mat = (cor: string, o: OpcMat = {}): THREE.Material => {
  const chave = `${cor}|${o.emissivo ?? ""}|${o.brilho ?? 0}|${o.opacidade ?? 1}|${o.aspereza ?? 0.85}|${o.metal ?? 0}|${o.ladoDuplo ? 1 : 0}|${o.semNevoa ? 1 : 0}`;
  let m = MATS.get(chave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: cor, flatShading: true, roughness: o.aspereza ?? 0.85, metalness: o.metal ?? 0,
      emissive: o.emissivo ?? "#000000", emissiveIntensity: o.brilho ?? 0,
      transparent: (o.opacidade ?? 1) < 1, opacity: o.opacidade ?? 1, side: o.ladoDuplo ? THREE.DoubleSide : THREE.FrontSide,
      fog: !o.semNevoa,
    });
    MATS.set(chave, m);
  }
  return m;
};
// material com cores por vértice (terrenos e planetas)
export const MAT_VERTICES = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
// cor de luz neon que roda no tempo (RGB de setup gamer), quantizada para reaproveitar materiais
export const arcoIris = (t: number, desvio = 0) => {
  const h = Math.round((((t * 0.12 + desvio) % 1) + 1) % 1 * 36) / 36;
  return `#${new THREE.Color().setHSL(h, 0.9, 0.55).getHexString()}`;
};

// geometrias partilhadas (poucos segmentos = facetas visíveis)
const GEOS = new Map<string, THREE.BufferGeometry>();
export const geo = (chave: string, criar: () => THREE.BufferGeometry) => {
  let g = GEOS.get(chave);
  if (!g) { g = criar(); GEOS.set(chave, g); }
  return g;
};
export const caixa = (l: number, a: number, p: number) => geo(`b${l},${a},${p}`, () => new THREE.BoxGeometry(l, a, p));
export const cilindro = (rt: number, rb: number, a: number, s = 6) => geo(`c${rt},${rb},${a},${s}`, () => new THREE.CylinderGeometry(rt, rb, a, s));
export const cone = (r: number, a: number, s = 6) => geo(`k${r},${a},${s}`, () => new THREE.ConeGeometry(r, a, s));
export const esfera = (r: number, d = 0) => geo(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const pedra = (r: number) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));
