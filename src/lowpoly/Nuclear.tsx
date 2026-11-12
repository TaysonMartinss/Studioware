import { useMemo } from "react";
import * as THREE from "three";
import { Efeito } from "./Efeitos";
import { caixa, cilindro, clamp01, cone, entre, esfera, mat, rng, sai, suave } from "./util";

// Pacote nuclear (para vídeos educativos "E se?"): o cogumelo atómico com clarão, bola de fogo, coluna, chapéu,
// anel de condensação, poeira no chão e onda de choque; a bomba (dois modelos históricos), o míssil no silo,
// o bombardeiro e o símbolo da radiação. Tudo animado a partir de `quando` (segundos desde o início da cena).

// ---------- tempos do cogumelo (partilhados com a cena: clarão no ecrã, tremor e prédios a cair) ----------
export const VELOCIDADE_ONDA = 55; // m/s à escala 1 (comprimido para caber num Short)
export const clarao = (t: number, quando: number) => {
  const k = t - quando;
  if (k < 0) return 0;
  return k < 0.12 ? 1 : Math.exp(-(k - 0.12) * 2.6);
};
export const raioOnda = (t: number, quando: number, escala: number) => Math.max(0, t - quando - 0.3) * VELOCIDADE_ONDA * escala;

type Baforada = { a: number; r: number; y: number; s: number; fase: number };

// ---------- cogumelo atómico ----------
export const Cogumelo: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const k = t - quando;
  const { chapeu, coluna, base } = useMemo(() => {
    const r = rng(1945);
    const cap: Baforada[] = Array.from({ length: 70 }, () => ({ a: r() * Math.PI * 2, r: 0.6 + r() * 0.5, y: (r() - 0.5) * 0.7, s: 0.45 + r() * 0.45, fase: r() * 6 }));
    const col: Baforada[] = Array.from({ length: 36 }, (_, i) => ({ a: r() * Math.PI * 2, r: r() * 0.35, y: i / 36, s: 0.3 + r() * 0.3, fase: r() * 6 }));
    const bas: Baforada[] = Array.from({ length: 48 }, () => ({ a: r() * Math.PI * 2, r: 0.85 + r() * 0.3, y: r() * 0.4, s: 0.5 + r() * 0.6, fase: r() * 6 }));
    return { chapeu: cap, coluna: col, base: bas };
  }, []);
  if (k < 0) return null;

  // a bola de fogo nasce, cresce e sobe; arrefece de branco a laranja e depois a castanho-fumo
  const R = 3 + 5 * sai(k / 1.2);
  const altura = R + 26 * suave((k - 0.6) / 7);
  const calor = Math.round(clamp01(1 - (k - 1.2) / 5) * 24) / 24; // em degraus: reaproveita materiais entre frames
  const corFogo = new THREE.Color("#5a4038").lerp(new THREE.Color(k < 0.6 ? "#fff8e0" : "#ff8a2a"), calor);
  const corFumo = new THREE.Color("#7a6a60").lerp(new THREE.Color("#c86a2a"), calor * 0.7);
  const abre = suave((k - 1.2) / 4); // o chapéu alarga-se e enrola
  const pesoBase = suave((k - 0.4) / 2.5);
  const condensa = k > 0.6 && k < 3.5 ? 1 - Math.abs(k - 1.6) / 1.9 : 0;
  const onda = raioOnda(t, quando, 1);
  return (
    <group>
      {/* bola de fogo (com um núcleo que brilha) */}
      <mesh position-y={altura} scale={R * (0.85 + 0.25 * abre)} geometry={esfera(1, 2)} material={mat(`#${corFogo.getHexString()}`, { emissivo: `#${corFogo.getHexString()}`, brilho: 0.4 + 2.2 * calor })} />
      {calor > 0.2 && <pointLight position-y={altura} intensity={4000 * calor} distance={400} decay={1.2} color="#ffb070" />}
      {/* chapéu: anel de baforadas que roda sobre si (vórtice) */}
      {k > 0.8 && chapeu.map((b, i) => {
        const rr = R * (0.7 + 1.3 * abre) * b.r;
        const rola = b.y + 0.25 * Math.sin(k * 1.4 + b.fase);
        return <mesh key={i} position={[Math.cos(b.a) * rr, altura + rola * R * 0.8 - abre * R * 0.2, Math.sin(b.a) * rr]} scale={R * b.s * (0.6 + 0.6 * abre)} geometry={esfera(1, 0)}
          material={mat(`#${corFumo.getHexString()}`, { emissivo: `#${corFogo.getHexString()}`, brilho: 0.3 * calor })} />;
      })}
      {/* coluna de fumo do chão até à bola */}
      {k > 0.5 && coluna.map((b, i) => {
        const y = b.y * (altura - R * 0.7);
        const larg = 1.6 + R * 0.25 * (1 - b.y) + 0.8 * Math.sin(k * 2 + b.fase) * 0.2;
        return <mesh key={i} position={[Math.cos(b.a) * b.r * larg, y, Math.sin(b.a) * b.r * larg]} scale={larg * b.s * 2.2} geometry={esfera(1, 0)} material={mat(`#${corFumo.getHexString()}`)} />;
      })}
      {/* poeira levantada no chão, a espalhar-se */}
      {pesoBase > 0 && base.map((b, i) => {
        const rr = (6 + Math.min(onda, 120) * 0.55) * b.r;
        return <mesh key={i} position={[Math.cos(b.a) * rr, b.y * 3 + 0.5, Math.sin(b.a) * rr]} scale={b.s * 3.5 * pesoBase} geometry={esfera(1, 0)} material={mat("#8a7462")} />;
      })}
      {/* anel de condensação (nuvem de Wilson) que passa pelo cogumelo */}
      {condensa > 0 && (
        <mesh position-y={altura * 0.75} rotation-x={Math.PI / 2} scale={R * (1.2 + k * 1.4)}>
          <torusGeometry args={[1, 0.08, 6, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55 * condensa} depthWrite={false} />
        </mesh>
      )}
      {/* onda de choque: cúpula de ar comprimido que cresce a partir do ponto zero */}
      {onda > 0 && onda < 260 && (
        <mesh scale={onda}>
          <sphereGeometry args={[1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color="#fff2e0" transparent opacity={0.22 * (1 - onda / 260)} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {onda > 0 && onda < 260 && (
        <mesh position-y={1.2} rotation-x={Math.PI / 2} scale={onda}>
          <torusGeometry args={[1, 0.02, 6, 48]} />
          <meshBasicMaterial color="#c9b49a" transparent opacity={0.7 * (1 - onda / 260)} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// ---------- bomba (dois modelos históricos, genéricos) ----------
// "redonda" (bojuda, com caixa de aletas) ou "comprida" (cilíndrica). Parada a rodar, ou a cair até `quando`.
export const Bomba: React.FC<{ t: number; variante?: string; quando: number; altura: number }> = ({ t, variante = "redonda", quando, altura }) => {
  const cai = quando >= 0;
  const k = cai ? entre(t, quando - 2.2, quando) : 0;
  const y = cai ? altura * (1 - k * k) : 0;
  const redonda = variante !== "comprida";
  const verde = mat(redonda ? "#c9b84a" : "#5a6a5a", { metal: 0.4, aspereza: 0.5 });
  if (cai && t > quando) return null;
  return (
    <group position-y={y} rotation={cai ? [0, 0, Math.PI / 2 + 0.05 * Math.sin(t * 6)] : [0.15, t * 0.5, Math.PI / 2]}>
      {redonda ? (
        <>
          <mesh scale={[1, 1.35, 1]} geometry={esfera(0.75, 2)} material={verde} />
          <mesh position-y={-1.35} geometry={caixa(1.0, 0.7, 1.0)} material={verde} />
          <mesh position-y={-1.35} geometry={caixa(1.05, 0.06, 1.05)} material={mat("#2a2a2a")} />
        </>
      ) : (
        <>
          <mesh geometry={cilindro(0.4, 0.4, 2.6, 10)} material={verde} />
          <mesh position-y={1.45} geometry={esfera(0.4, 1)} material={verde} />
          <mesh position-y={-1.55} geometry={cilindro(0.45, 0.3, 0.5, 8)} material={verde} />
          {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.45, -1.65, Math.sin(i * Math.PI / 2) * 0.45]} rotation-y={-i * Math.PI / 2} geometry={caixa(0.5, 0.5, 0.04)} material={verde} />)}
        </>
      )}
      <mesh position-y={redonda ? 0.2 : 0.4} geometry={cilindro(redonda ? 0.76 : 0.41, redonda ? 0.76 : 0.41, 0.08, 12)} material={mat("#d6362a")} />
    </group>
  );
};

// ---------- míssil balístico no silo ----------
export const alturaMissil = (t: number, quando: number) => { const d = Math.max(0, t - quando); return 2.2 * d * d; };
export const Missil: React.FC<{ t: number; quando: number }> = ({ t, quando }) => {
  const voo = Math.max(0, t - quando);
  const portas = entre(t, quando - 1.5, quando - 0.5);
  return (
    <group>
      {/* silo: anel de betão no chão e as duas portas que abrem */}
      <mesh position-y={0.15} geometry={cilindro(2.2, 2.4, 0.3, 12)} material={mat("#8a8d92")} />
      <mesh position-y={0.18} geometry={cilindro(1.5, 1.5, 0.31, 12)} material={mat("#111214")} />
      {[1, -1].map((l) => (
        <group key={l} position={[1.5 * l, 0.32, 0]} rotation-z={-l * portas * 1.7}>
          <mesh position-x={-0.75 * l} geometry={caixa(1.5, 0.15, 3.0)} material={mat("#6b6f75")} />
        </group>
      ))}
      <group position-y={-3 + alturaMissil(t, quando) + 3 * entre(t, quando - 0.5, quando)}>
        <mesh position-y={3.2} geometry={cilindro(0.55, 0.6, 6.4, 12)} material={mat("#eef0f2")} />
        {[1.2, 4.6].map((y) => <mesh key={y} position-y={y} geometry={cilindro(0.61, 0.61, 0.25, 12)} material={mat("#1b1b1b")} />)}
        <mesh position-y={7.0} geometry={cone(0.55, 1.4, 12)} material={mat("#eef0f2")} />
        {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.65, 0.5, Math.sin(i * Math.PI / 2) * 0.65]} rotation-y={-i * Math.PI / 2} geometry={caixa(0.5, 1.0, 0.06)} material={mat("#3a3d44")} />)}
        {voo > 0 && <mesh position-y={-1.2 - 0.3 * Math.sin(t * 40)} rotation-x={Math.PI} geometry={cone(0.5, 2.4 + 0.5 * Math.sin(t * 31), 8)}><meshBasicMaterial color="#ffb02a" transparent opacity={0.9} /></mesh>}
        {voo > 0 && <Efeito tipo="fogo" t={t} quando={quando} posicao={[0, -0.4, 0]} escala={1.1} />}
      </group>
      <Efeito tipo="fumo" t={t} quando={quando - 0.2} duracao={3} posicao={[0, 0.5, 0]} escala={1.6} semente={4} />
    </group>
  );
};

// ---------- bombardeiro (atravessa o céu; com variante "largar", larga a bomba ao passar pelo meio) ----------
export const Bombardeiro: React.FC<{ t: number; largar: boolean; altura: number }> = ({ t, largar, altura }) => {
  const v = 14, x = -45 + v * t; // passa pelo meio aos ~3,2 s
  const tLarga = 45 / v;
  const helice = t * 50;
  const corpo = mat("#b8bec6", { metal: 0.6, aspereza: 0.35 });
  return (
    <group>
      <group position={[x, altura, 0]}>
        <mesh rotation-z={Math.PI / 2} geometry={cilindro(0.55, 0.45, 9, 10)} material={corpo} />
        <mesh position-x={4.7} rotation-z={-Math.PI / 2} geometry={cone(0.55, 1.2, 10)} material={mat("#9fd8ff", { opacidade: 0.7, aspereza: 0.1 })} />
        <mesh position-x={0.6} geometry={caixa(1.6, 0.12, 14)} material={corpo} />
        <mesh position-x={-4} geometry={caixa(0.9, 0.08, 4.2)} material={corpo} />
        <mesh position={[-4.1, 1, 0]} geometry={caixa(1.2, 1.9, 0.08)} material={corpo} />
        {[-4.6, -2.3, 2.3, 4.6].map((z) => (
          <group key={z} position={[1.3, -0.1, z]}>
            <mesh rotation-z={Math.PI / 2} geometry={cilindro(0.25, 0.3, 1.1, 8)} material={mat("#5a5f68")} />
            <mesh position-x={0.6} rotation-x={helice} geometry={caixa(0.05, 1.6, 0.14)} material={mat("#22252c")} />
          </group>
        ))}
      </group>
      {largar && t > tLarga && (() => {
        const d = t - tLarga, y = altura - 0.5 - 4.9 * d * d;
        if (y < 0) return null;
        return <group position={[-45 + v * tLarga + v * 0.6 * d, y, 0]} rotation-z={-0.3 - d * 0.4} scale={0.6}><Bomba t={t} variante="redonda" quando={-1} altura={0} /></group>;
      })()}
    </group>
  );
};

// ---------- símbolo da radiação ----------
export const Radiacao: React.FC<{ t: number }> = ({ t }) => {
  const preto = mat("#151515");
  return (
    <group position-y={1.4} rotation-y={0.3 * Math.sin(t)}>
      <mesh rotation-x={Math.PI / 2} geometry={cilindro(1.2, 1.2, 0.08, 32)} material={mat("#ffd21a", { emissivo: "#ffd21a", brilho: 0.25 })} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position-z={0.05} rotation-z={Math.PI / 2 + i * (Math.PI * 2 / 3) - Math.PI / 6}>
          <ringGeometry args={[0.28, 1.0, 16, 1, 0, Math.PI / 3]} />
          <meshStandardMaterial color="#151515" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position-z={0.05} rotation-x={Math.PI / 2} geometry={cilindro(0.18, 0.18, 0.02, 16)} material={preto} />
    </group>
  );
};
