import * as brush from "p5.brush/standalone";
import * as LUCIDE from "lucide-static";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONTES } from "../components/motion";
import { CenaPincel, ElementoPincel, PosPincel } from "../types";

// Cena "pincel": ilustração desenhada à mão, traço a traço, sobre papel (p5.brush, build standalone, MIT).
// O roteiro escolhe elementos (ícones da Lucide, setas, círculos, sublinhados, X, vistos, texto manuscrito,
// gráficos de barras e de linha) e cada um desenha-se no seu `quando`. Cada frame redesenha tudo do zero com a
// mesma semente, por isso o Remotion pode renderizar os frames por qualquer ordem. O traço "treme" de 6 em 6
// frames (line boil), como numa animação desenhada.

const PAPEIS = {
  papel: { fundo: "#f3ead6", tinta: "#2b2622", sombra: "#d9ccb0" },
  branco: { fundo: "#fbfbf8", tinta: "#1f2328", sombra: "#e4e4de" },
  caderno: { fundo: "#fdfdf8", tinta: "#1e2a4a", sombra: "#e2e6ee" },
  quadro: { fundo: "#24332b", tinta: "#f1f1ea", sombra: "#1a261f" },
} as const;
const PINCEIS: Record<string, [string, number]> = { caneta: ["pen", 1.1], lapis: ["2B", 1.3], marcador: ["marker", 1.0], carvao: ["charcoal", 1.2], giz: ["charcoal", 1.4] };
const CORES = ["#e0603a", "#3a7bd5", "#e8b730", "#4caf6a", "#9b59b6", "#e05a8a"];

// as pinceladas da biblioteca são pensadas para ~600 px: aumento-as uma vez (a função multiplica a cada chamada)
let escalado = false;
const prepararPinceis = () => { if (!escalado) { brush.scaleBrushes(3.2); escalado = true; } };

// ---------- ícones: o SVG da Lucide amostrado em pontos (geometria do próprio browser), em cache ----------
type Traco = { pts: [number, number][]; len: number };
const iconesCache = new Map<string, { tracos: Traco[]; total: number } | null>();
const pascal = (nome: string) => nome.trim().split(/[-_ ]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const icone = (nome: string) => {
  if (iconesCache.has(nome)) return iconesCache.get(nome)!;
  const svgTxt = (LUCIDE as Record<string, string>)[pascal(nome)];
  if (!svgTxt || typeof document === "undefined") { iconesCache.set(nome, null); return null; }
  const caixa = document.createElement("div");
  caixa.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
  caixa.innerHTML = svgTxt;
  document.body.appendChild(caixa);
  const tracos: Traco[] = [];
  caixa.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse").forEach((el) => {
    const g = el as SVGGeometryElement;
    const len = g.getTotalLength();
    if (!(len > 0)) return;
    const n = Math.max(2, Math.ceil(len / 0.35));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const p = g.getPointAtLength((i / n) * len); pts.push([p.x, p.y]); }
    tracos.push({ pts, len });
  });
  caixa.remove();
  const r = { tracos, total: tracos.reduce((s, t) => s + t.len, 0) };
  iconesCache.set(nome, r);
  return r;
};

// ---------- layout ----------
type Caixa = { x: number; y: number; w: number; h: number };
const POS: Record<string, [number, number]> = {
  centro: [0.5, 0.5], esquerda: [0.24, 0.5], direita: [0.76, 0.5], topo: [0.5, 0.2], baixo: [0.5, 0.8],
  topo_esquerda: [0.24, 0.2], topo_direita: [0.76, 0.2], baixo_esquerda: [0.24, 0.8], baixo_direita: [0.76, 0.8],
};
const AUTO: Record<number, string[]> = { 1: ["centro"], 2: ["esquerda", "direita"], 3: ["esquerda", "centro", "direita"], 4: ["topo_esquerda", "topo_direita", "baixo_esquerda", "baixo_direita"] };
const AUTO_VERTICAL: Record<number, string[]> = { 1: ["centro"], 2: ["topo", "baixo"], 3: ["topo", "centro", "baixo"], 4: ["topo_esquerda", "topo_direita", "baixo_esquerda", "baixo_direita"] };
const ocupa = (e: ElementoPincel) => ["icone", "texto", "barras", "linha"].includes(e.tipo);

// pontos de uma curva quadrática (para setas)
const curva = (a: [number, number], b: [number, number], dobra: number, n = 40) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  const c: [number, number] = [mx - dy * dobra, my + dx * dobra];
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as [number, number]; });
};
const parte = (pts: [number, number][], k: number) => pts.slice(0, Math.max(0, Math.round(pts.length * Math.min(1, k))));
const linha = (pts: [number, number][]) => { if (pts.length >= 2) brush.spline(pts, 0); };
const reta = (a: [number, number], b: [number, number], n = 24) => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as [number, number]);
const k01 = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));

type Resolvido = ElementoPincel & { cx: number; cy: number; lado: number; q: number; dur: number; corE: string };

export const PincelCena: React.FC<{ cena: CenaPincel; cor: string }> = ({ cena, cor }) => {
  const f = useCurrentFrame();
  const { fps, width: L, height: A } = useVideoConfig();
  const t = f / fps;
  const vertical = A > L;
  const papel = PAPEIS[cena.papel ?? "papel"] ?? PAPEIS.papel;
  const giz = cena.papel === "quadro";
  const ref = useRef<HTMLCanvasElement>(null);

  // área útil: abaixo do título e acima das legendas (terço de baixo no vertical)
  const area: Caixa = useMemo(() => {
    const y0 = (vertical ? 260 : 120) + (cena.titulo ? (vertical ? 170 : 130) : 0);
    const y1 = vertical ? A * 0.66 : A * 0.8;
    const x0 = vertical ? 80 : 140;
    return { x: x0, y: y0, w: L - x0 * 2, h: y1 - y0 };
  }, [vertical, A, L, cena.titulo]);

  const els: Resolvido[] = useMemo(() => {
    const lista = (cena.elementos ?? []).slice(0, 10);
    const livres = lista.filter((e) => ocupa(e) && e.posicao === undefined).length;
    const auto = (vertical ? AUTO_VERTICAL : AUTO)[Math.min(4, Math.max(1, livres))] ?? ["centro"];
    let iAuto = 0, relogio = 0.3;
    const out: Resolvido[] = [];
    lista.forEach((e, i) => {
      const p = e.posicao ?? (ocupa(e) ? auto[iAuto++ % auto.length] : "centro");
      const [fx, fy] = Array.isArray(p) ? p : POS[p] ?? POS.centro;
      const lado = (e.tamanho ?? 1) * Math.min(area.w, area.h) * (e.tipo === "barras" || e.tipo === "linha" ? 0.8 : livres > 1 ? 0.34 : 0.48);
      const dur = e.duracao ?? (e.tipo === "icone" ? 1.3 : e.tipo === "texto" ? Math.max(0.6, (e.texto ?? "").length * 0.045) : e.tipo === "barras" || e.tipo === "linha" ? 1.8 : 0.6);
      const q = e.quando ?? relogio;
      relogio = q + dur * 0.8;
      out.push({ ...e, cx: area.x + fx * area.w, cy: area.y + fy * area.h, lado, q, dur, corE: e.cor ?? (e.tipo === "x" ? "#d93a3a" : e.tipo === "visto" ? "#2f9e55" : CORES[i % CORES.length]) });
    });
    return out;
  }, [cena.elementos, area, vertical]);

  // alvo de setas, círculos, sublinhados, X e vistos: o índice de outro elemento ou uma posição
  const alvoDe = (v: PosPincel | number | undefined, padrao: Resolvido): [number, number, number] => {
    if (typeof v === "number" && els[v]) return [els[v].cx, els[v].cy, els[v].tipo === "texto" ? els[v].lado * 0.9 : els[v].lado];
    if (v !== undefined && typeof v !== "number") { const [fx, fy] = Array.isArray(v) ? v : POS[v] ?? POS.centro; return [area.x + fx * area.w, area.y + fy * area.h, padrao.lado]; }
    return [padrao.cx, padrao.cy, padrao.lado];
  };

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    try {
      brush.load(c);
      prepararPinceis();
      // o canvas leva a cor do papel (vazio fica branco opaco); a origem da biblioteca é o centro do canvas
      brush.clear(papel.fundo);
      brush.push();
      brush.translate(-L / 2, -A / 2);
      const tinta: string = papel.tinta;
      const tremor = cena.tremer === false ? 0 : Math.floor(f / 6);
      const pincel = (e: ElementoPincel, cor = tinta, peso = 1) => {
        const [nome, w] = PINCEIS[e.traco ?? (giz ? "giz" : "caneta")] ?? PINCEIS.caneta;
        brush.noFill(); brush.noHatch();
        brush.set(nome, cor, w * peso);
      };
      const aguarela = (cor: string, opacidade: number) => {
        brush.noStroke(); brush.noHatch();
        brush.fill(cor, opacidade); brush.fillBleed(0.25); brush.fillTexture(0.55, 0.45);
      };

      // sublinhado do título
      if (cena.titulo) {
        brush.seed(9 + tremor);
        const k = k01(t, 0.15, 0.6), yT = area.y - (vertical ? 40 : 30), larg = Math.min(L * 0.7, cena.titulo.length * (vertical ? 34 : 30));
        pincel({ tipo: "texto" }, cor, 1.6);
        linha(parte(Array.from({ length: 30 }, (_, i) => [L / 2 - larg / 2 + (i / 29) * larg, yT + Math.sin(i * 0.5) * 3] as [number, number]), k));
      }

      els.forEach((e, i) => {
        const k = k01(t, e.q, e.dur);
        if (k <= 0) return;
        const sFill = 1000 + i * 97, sTraco = sFill + 31 + tremor * 7;
        if (e.tipo === "icone") {
          const ic = icone(e.nome ?? "circle-help");
          const lado = e.lado;
          // mancha de aguarela por trás, a aparecer quando o contorno está quase feito
          const kf = k01(t, e.q + e.dur * 0.55, e.dur * 0.6);
          if (kf > 0 && e.cor !== "nenhuma") {
            brush.seed(sFill);
            aguarela(e.corE, 150 * kf);
            brush.circle(e.cx + lado * 0.06, e.cy + lado * 0.05, lado * 0.4, true);
            brush.noFill();
          }
          if (!ic) return;
          brush.seed(sTraco);
          pincel(e, tinta, 1.5);
          const s = lado / 24, ox = e.cx - lado / 2, oy = e.cy - lado / 2;
          let resto = k * ic.total;
          for (const tr of ic.tracos) {
            if (resto <= 0) break;
            const frac = Math.min(1, resto / tr.len);
            resto -= tr.len;
            linha(parte(tr.pts, frac).map(([x, y]) => [ox + x * s, oy + y * s]));
          }
        } else if (e.tipo === "seta") {
          const [ax, ay, la] = alvoDe(e.de ?? "esquerda", e), [bx, by, lb] = alvoDe(e.para ?? "direita", e);
          // começa e acaba fora dos elementos que liga
          const d = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / d, uy = (by - ay) / d;
          const a: [number, number] = [ax + ux * (typeof e.de === "number" ? la * 0.55 : 0), ay + uy * (typeof e.de === "number" ? la * 0.55 : 0)];
          const b: [number, number] = [bx - ux * (typeof e.para === "number" ? lb * 0.6 : 0), by - uy * (typeof e.para === "number" ? lb * 0.6 : 0)];
          const pts = curva(a, b, 0.18);
          brush.seed(sTraco);
          pincel(e, e.cor ?? tinta, 1.6);
          linha(parte(pts, k / 0.8));
          if (k > 0.8) {
            const [px, py] = pts[pts.length - 1], [qx, qy] = pts[pts.length - 4];
            const ang = Math.atan2(py - qy, px - qx), cab = Math.min(60, d * 0.15) * Math.min(1, (k - 0.8) / 0.2);
            for (const s of [0.5, -0.5]) linha([[px, py], [px - Math.cos(ang + s) * cab, py - Math.sin(ang + s) * cab]]);
          }
        } else if (e.tipo === "circulo" || e.tipo === "sublinhado" || e.tipo === "x" || e.tipo === "visto") {
          const [cx, cy, lado] = alvoDe(e.alvo ?? e.posicao, e);
          brush.seed(sTraco);
          pincel(e, e.corE, e.tipo === "circulo" || e.tipo === "sublinhado" ? 1.7 : 2.2);
          if (e.tipo === "circulo") {
            const rx = lado * 0.66, ry = lado * 0.6;
            linha(parte(Array.from({ length: 60 }, (_, j) => { const a = -0.6 + (j / 59) * (Math.PI * 2 + 0.5); const r = 1 + 0.05 * Math.sin(a * 3); return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r] as [number, number]; }), k));
          } else if (e.tipo === "sublinhado") {
            const w = lado * 0.9, y = cy + lado * 0.58;
            linha(parte(Array.from({ length: 30 }, (_, j) => [cx - w / 2 + (j / 29) * w, y + Math.sin(j * 0.6) * 4] as [number, number]), k));
          } else if (e.tipo === "x") {
            const r = lado * 0.42;
            linha(parte(reta([cx - r, cy - r], [cx + r, cy + r]), k * 2));
            if (k > 0.5) linha(parte(reta([cx + r, cy - r], [cx - r, cy + r]), (k - 0.5) * 2));
          } else {
            const r = lado * 0.4;
            linha(parte([[cx - r * 0.7, cy], [cx - r * 0.2, cy + r * 0.55], [cx + r * 0.8, cy - r * 0.6]].flatMap((p, j, arr) => j === 0 ? [p as [number, number]] : Array.from({ length: 10 }, (_, m) => { const [x0, y0] = arr[j - 1], [x1, y1] = p; return [x0 + ((x1 - x0) * (m + 1)) / 10, y0 + ((y1 - y0) * (m + 1)) / 10] as [number, number]; })), k));
          }
        } else if (e.tipo === "barras" || e.tipo === "linha") {
          const vals = (e.valores ?? [3, 5, 8]).slice(0, 8), n = vals.length, max = Math.max(...vals.map((v) => Math.abs(v)), 1e-6);
          const w = e.lado * (vertical ? 1.05 : 1.3), h = e.lado * 0.62, x0 = e.cx - w / 2, yB = e.cy + h / 2;
          brush.seed(sTraco);
          pincel(e, tinta, 1.4);
          const ke = k01(k, 0, 0.25);
          linha(parte(reta([x0, e.cy - h / 2 - 20], [x0, yB]), ke * 2));
          linha(parte(reta([x0, yB], [x0 + w, yB]), ke * 2 - 1));
          const passo = w / n;
          if (e.tipo === "barras") {
            vals.forEach((v, j) => {
              const kb = k01(k, 0.25 + (j * 0.6) / n, 0.6 / n + 0.1);
              if (kb <= 0) return;
              const bh = (Math.abs(v) / max) * h * kb, bx = x0 + passo * j + passo * 0.18, bw = passo * 0.64;
              brush.seed(sFill + j);
              aguarela(e.cores?.[j] ?? e.corE, 170);
              brush.rect(bx, yB - bh, bw, bh);
              brush.noFill();
              brush.seed(sTraco + j);
              pincel(e, tinta, 1.1);
              linha([[bx, yB], [bx, yB - bh], [bx + bw, yB - bh], [bx + bw, yB]]);
            });
          } else {
            const pts = vals.map((v, j) => [x0 + passo * (j + 0.5), yB - (Math.max(0, v) / max) * h] as [number, number]);
            const kl = k01(k, 0.25, 0.75);
            const denso = pts.flatMap((p, j) => j === 0 ? [p] : Array.from({ length: 12 }, (_, m) => [pts[j - 1][0] + ((p[0] - pts[j - 1][0]) * (m + 1)) / 12, pts[j - 1][1] + ((p[1] - pts[j - 1][1]) * (m + 1)) / 12] as [number, number]));
            pincel(e, e.corE, 2);
            linha(parte(denso, kl));
            pts.forEach((p, j) => { if (kl * (n - 1) + 0.01 >= j) { brush.seed(sFill + j); aguarela(e.corE, 220); brush.circle(p[0], p[1], 12, false); brush.noFill(); } });
          }
        }
      });
      brush.pop();
      brush.render();
    } catch (erro) {
      console.error("pincel:", erro);
    }
  });

  // textos (letra manuscrita): títulos, rótulos e valores; aparecem da esquerda para a direita
  const letra = FONTES.kalam, marcador = FONTES.marker;
  const revela = (k: number): React.CSSProperties => ({ clipPath: `inset(-20% ${(1 - k) * 100}% -20% -5%)` });
  const textos: React.ReactNode[] = [];
  els.forEach((e, i) => {
    const k = k01(t, e.q, e.dur);
    if (e.tipo === "texto" && k > 0) {
      textos.push(<div key={`t${i}`} style={{ position: "absolute", left: e.cx - area.w * 0.46, width: area.w * 0.92, top: e.cy, transform: "translateY(-50%)", textAlign: "center", fontFamily: letra, fontWeight: 700, fontSize: (e.tamanho ?? 1) * (vertical ? 78 : 64), lineHeight: 1.1, color: e.cor ?? papel.tinta, ...revela(k) }}>{e.texto}</div>);
    }
    if (e.tipo === "icone" && e.rotulo) {
      const kr = k01(t, e.q + e.dur * 0.8, 0.5);
      if (kr > 0) textos.push(<div key={`r${i}`} style={{ position: "absolute", left: e.cx - 300, width: 600, top: e.cy + e.lado * 0.55, textAlign: "center", fontFamily: letra, fontWeight: 700, fontSize: vertical ? 52 : 44, color: papel.tinta, ...revela(kr) }}>{e.rotulo}</div>);
    }
    if ((e.tipo === "barras" || e.tipo === "linha") && k > 0) {
      const vals = (e.valores ?? [3, 5, 8]).slice(0, 8), n = vals.length, w = e.lado * (vertical ? 1.05 : 1.3), h = e.lado * 0.62, x0 = e.cx - w / 2, yB = e.cy + h / 2, passo = w / n, max = Math.max(...vals.map((v) => Math.abs(v)), 1e-6);
      vals.forEach((v, j) => {
        const kb = e.tipo === "barras" ? k01(k, 0.25 + (j * 0.6) / n, 0.6 / n + 0.1) : k01(k, 0.25 + (0.75 * j) / Math.max(1, n - 1), 0.1);
        if (kb < 1) return;
        const xc = x0 + passo * (j + 0.5), yv = yB - (Math.abs(v) / max) * h;
        textos.push(<div key={`v${i}${j}`} style={{ position: "absolute", left: xc - 150, width: 300, top: yv - (vertical ? 66 : 56), textAlign: "center", fontFamily: letra, fontWeight: 700, fontSize: vertical ? 42 : 36, color: papel.tinta }}>{e.formatos?.[j] ?? String(v)}</div>);
        if (e.rotulos?.[j]) textos.push(<div key={`l${i}${j}`} style={{ position: "absolute", left: xc - passo / 2, width: passo, top: yB + 10, textAlign: "center", fontFamily: letra, fontSize: vertical ? 36 : 32, lineHeight: 1.05, color: papel.tinta }}>{e.rotulos[j]}</div>);
      });
    }
  });

  return (
    <div style={{ position: "absolute", inset: 0, background: papel.fundo, overflow: "hidden" }}>
      <canvas ref={ref} width={L} height={A} style={{ position: "absolute", inset: 0, width: L, height: A }} />
      {/* papel: grão e vinheta; caderno com linhas e margem; quadro com manchas de giz */}
      <div style={{ position: "absolute", inset: 0, opacity: giz ? 0.25 : 0.5, mixBlendMode: "multiply", pointerEvents: "none", backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  0 0 0 0.35 0'/></filter><rect width='300' height='300' filter='url(%23g)'/></svg>")` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 55%, ${papel.sombra} 130%)` }} />
      {cena.papel === "caderno" && (
        <>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 62px, #a9c4ea 62px, #a9c4ea 64px)", mixBlendMode: "multiply" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: vertical ? 110 : 160, width: 3, background: "#e58b8b" }} />
        </>
      )}
      {cena.titulo && (
        <div style={{ position: "absolute", left: 60, right: 60, top: area.y - (vertical ? 170 : 125), textAlign: "center", fontFamily: marcador, fontSize: vertical ? 92 : 80, lineHeight: 1.05, color: papel.tinta, ...revela(k01(t, 0, 0.5)) }}>
          {cena.titulo}
        </div>
      )}
      {textos}
    </div>
  );
};
