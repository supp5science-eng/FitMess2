/**
 * Avatar rig -- geometrija figure.
 *
 * Podela koja nosi ceo feature:
 *
 *   LICE  = slojevi koje bira korisnik (frizura, koža, brada, naočare).
 *           Identitet. Ne menja se sam.
 *   TELO  = NE crta se, nego se RAČUNA iz par brojeva (masnoća, mišićavost,
 *           visina). Podaci. Korisnik ga ne bira.
 *
 * Zato ovde nema nijednog nacrtanog tela: `torsoPath()` ispiše siluetu iz
 * širina koje `geom()` izvede iz parametara. Prelaz je kontinuiran -- struk
 * se pomeri za dva piksela kad se kilaža pomeri za kilogram -- što je tačno
 * ono što nacrtana biblioteka od N tela ne može.
 *
 * Modul je namerno čist (bez React-a, bez DOM-a): ulaz su brojevi, izlaz su
 * `d` atributi. Renderuje `src/app/admin/avatar/avatar-lab.tsx`.
 */

/** Podaci koji voze telo. Sve 0..1. */
export type BodyParams = {
  /** Masnoća -- vodi je kilaža. Širi struk i stomak. */
  fat: number;
  /** Mišićavost -- vodi je trening kroz vreme. Širi ramena i grudi. */
  muscle: number;
  /** Visina iz profila. Skalira celu figuru. */
  height: number;
  /** Ženska proporcija: uža ramena, širi kukovi. */
  fem: boolean;
};

/** Izbori koje pravi korisnik. Identitet -- app ih nikad ne menja sam. */
export type LookParams = {
  hair: HairId;
  beard: BeardId;
  glasses: GlassesId;
  skin: number;
  shirt: number;
};

export type AvatarParams = BodyParams & LookParams;

export const CX = 150;
export const VIEWBOX = "0 0 300 520";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* Glatka silueta                                                      */
/* ------------------------------------------------------------------ */

type Pt = readonly [number, number];

/**
 * Zatvorena Catmull-Rom kriva kroz tačke. Zbog nje silueta izgleda
 * organski iako je opisana sa svega petnaest tačaka -- bez ovoga bi telo
 * bilo poligon sa vidljivim uglovima na svakoj meri.
 */
function closedCurve(pts: readonly Pt[]): string {
  const n = pts.length;
  let d = `M ${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${r1(c1x)} ${r1(c1y)}, ${r1(c2x)} ${r1(c2y)}, ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d} Z`;
}

/* ------------------------------------------------------------------ */
/* Mere                                                                */
/* ------------------------------------------------------------------ */

/** Visine anatomskih tačaka. Fiksne -- menjaju se samo širine. */
export const Y = {
  headTop: 34,
  chin: 97,
  neck: 101,
  shoulder: 127,
  chest: 165,
  waist: 211,
  belly: 243,
  hip: 273,
  crotch: 305,
  knee: 391,
  ankle: 477,
} as const;

export type Geom = {
  /** Polu-širine na svakoj visini. */
  w: {
    neck: number;
    shoulder: number;
    chest: number;
    waist: number;
    belly: number;
    hip: number;
  };
  /** Polu-debljine udova. */
  limb: { upperArm: number; foreArm: number; thigh: number; calf: number };
  fat: number;
  muscle: number;
  fem: number;
};

/**
 * Cela figura iz četiri broja.
 *
 * Brojevi su nameštani tako da krajevi raspona budu jasno različiti:
 * na `fat=0, muscle=1` grudi su 58 a struk 25 (V), na `fat=1, muscle=0`
 * grudi su 53 a struk 60 (stomak izlazi ispred grudi).
 */
export function geom(p: BodyParams): Geom {
  const fat = clamp01(p.fat);
  const muscle = clamp01(p.muscle);
  const fem = p.fem ? 1 : 0;

  return {
    w: {
      neck: (12.5 + fat * 5 + muscle * 3) * (1 - fem * 0.13),
      shoulder: (45 + muscle * 25 + fat * 8) * (1 - fem * 0.14),
      chest: (40 + muscle * 17 + fat * 13) * (1 - fem * 0.07) + fem * 4,
      waist: (28 + fat * 32 - muscle * 4) * (1 - fem * 0.09),
      belly: (32 + fat * 36 - muscle * 2) * (1 - fem * 0.07),
      hip: (36 + fat * 20 + muscle * 3) * (1 + fem * 0.17),
    },
    limb: {
      upperArm: 9 + muscle * 9 + fat * 5.5,
      foreArm: 7.5 + muscle * 5.5 + fat * 3.5,
      thigh: 17 + fat * 11.5 + muscle * 8,
      calf: 11.5 + fat * 6 + muscle * 5,
    },
    fat,
    muscle,
    fem,
  };
}

/** Silueta trupa: vrat → rame → grudi → struk → stomak → kuk → prepone. */
export function torsoPath(g: Geom): string {
  const { w } = g;
  return closedCurve([
    [CX + w.neck, Y.neck],
    [CX + w.shoulder, Y.shoulder],
    [CX + w.chest, Y.chest],
    [CX + w.waist, Y.waist],
    [CX + w.belly, Y.belly],
    [CX + w.hip, Y.hip],
    [CX + w.hip * 0.82, Y.crotch],
    [CX, Y.crotch - 11],
    [CX - w.hip * 0.82, Y.crotch],
    [CX - w.hip, Y.hip],
    [CX - w.belly, Y.belly],
    [CX - w.waist, Y.waist],
    [CX - w.chest, Y.chest],
    [CX - w.shoulder, Y.shoulder],
    [CX - w.neck, Y.neck],
  ]);
}

/** Glava: širi se sa masnoćom, malo se skraćuje (okruglije lice). */
export function head(g: Geom) {
  const rx = 29 + g.fat * 7.5 - g.fem * 1.5;
  const ry = 33 - g.fat * 1.5;
  return { cx: CX, cy: Y.chin - ry + 2, rx, ry };
}

/**
 * Vidljivost detalja.
 *
 * `abs` namerno pada sa masnoćom: definicija = mišići MINUS salo. Nije
 * dekoracija -- to je jedina stvar u rigu koja korisniku pokaže da sam
 * trening ne pokazuje ništa dok se masnoća ne skine.
 */
export function detail(g: Geom) {
  return {
    abs: clamp01((g.muscle - 0.42) / 0.58) * (1 - clamp01(g.fat / 0.55)),
    pec: clamp01((g.muscle - 0.28) / 0.72) * (1 - clamp01(g.fat / 0.75)),
    belly: clamp01((g.fat - 0.42) / 0.58),
  };
}

/** Zglobovi za udove -- izvedeni iz širina, da ruka uvek stoji na ramenu. */
export function joints(g: Geom) {
  const shoulderX = g.w.shoulder - g.limb.upperArm * 0.52;
  const hipX = g.w.hip * 0.46;
  return {
    shoulder: [shoulderX, Y.shoulder + 7] as const,
    elbow: [shoulderX + 5, Y.waist + 8] as const,
    wrist: [shoulderX + 10, Y.hip + 26] as const,
    hip: [hipX, Y.crotch - 16] as const,
    knee: [hipX + 2, Y.knee] as const,
    ankle: [hipX + 3, Y.ankle] as const,
  };
}

/* ------------------------------------------------------------------ */
/* Palete                                                              */
/* ------------------------------------------------------------------ */

export type Tone = { id: string; base: string; shade: string };

export const SKINS: readonly Tone[] = [
  { id: "koza-1", base: "#F5D3B8", shade: "#DFB595" },
  { id: "koza-2", base: "#E9BA92", shade: "#CE9A72" },
  { id: "koza-3", base: "#D3956A", shade: "#B0754A" },
  { id: "koza-4", base: "#A5673D", shade: "#844E2A" },
  { id: "koza-5", base: "#6B3E23", shade: "#502C17" },
];

export const SHIRTS: readonly Tone[] = [
  { id: "majica-crna", base: "#2C3A46", shade: "#1E2932" },
  { id: "majica-crvena", base: "#B5442F", shade: "#8E3323" },
  { id: "majica-plava", base: "#3D7A8C", shade: "#2C5C6B" },
  { id: "majica-bela", base: "#E9ECEF", shade: "#C6CBD1" },
  { id: "majica-zelena", base: "#6B7A3A", shade: "#525E2B" },
];

export const HAIR_COLORS: readonly string[] = [
  "#2A2118",
  "#4A3320",
  "#7B5427",
  "#B98C4A",
  "#8C8C8C",
];

export const SHORTS: Tone = { id: "sorc", base: "#33414D", shade: "#25313A" };

export type HairId = "cela" | "kratka" | "talasasta" | "kovrdzava" | "duga";
export type BeardId = "bez" | "malje" | "brada" | "brkovi";
export type GlassesId = "bez" | "uglaste" | "okrugle";

export const HAIRS: readonly { id: HairId; label: string }[] = [
  { id: "cela", label: "Ćelav" },
  { id: "kratka", label: "Kratka" },
  { id: "talasasta", label: "Talasasta" },
  { id: "kovrdzava", label: "Kovrdžava" },
  { id: "duga", label: "Duga" },
];

export const BEARDS: readonly { id: BeardId; label: string }[] = [
  { id: "bez", label: "Bez" },
  { id: "malje", label: "Malje" },
  { id: "brada", label: "Brada" },
  { id: "brkovi", label: "Brkovi" },
];

export const GLASSES: readonly { id: GlassesId; label: string }[] = [
  { id: "bez", label: "Bez" },
  { id: "uglaste", label: "Uglaste" },
  { id: "okrugle", label: "Okrugle" },
];

/* ------------------------------------------------------------------ */
/* Slojevi lica                                                        */
/* ------------------------------------------------------------------ */

type Head = ReturnType<typeof head>;

/** Frizura kao jedan `path` preko glave. Prazan string = ćelav. */
export function hairPath(kind: HairId, h: Head): string {
  const { cx, cy, rx, ry } = h;
  const top = cy - ry;

  switch (kind) {
    case "cela":
      return "";
    case "kratka":
      return (
        `M ${cx - rx * 1.02} ${cy - ry * 0.12}` +
        ` C ${cx - rx * 1.08} ${top - ry * 0.3}, ${cx + rx * 1.08} ${top - ry * 0.3}, ${cx + rx * 1.02} ${cy - ry * 0.12}` +
        ` C ${cx + rx * 0.8} ${cy - ry * 0.52}, ${cx - rx * 0.8} ${cy - ry * 0.52}, ${cx - rx * 1.02} ${cy - ry * 0.12} Z`
      );
    case "talasasta":
      return (
        `M ${cx - rx * 1.06} ${cy + ry * 0.1}` +
        ` C ${cx - rx * 1.18} ${top - ry * 0.34}, ${cx + rx * 1.18} ${top - ry * 0.34}, ${cx + rx * 1.06} ${cy + ry * 0.1}` +
        ` C ${cx + rx * 0.96} ${cy - ry * 0.3}, ${cx + rx * 0.52} ${cy - ry * 0.4}, ${cx + rx * 0.1} ${cy - ry * 0.3}` +
        ` C ${cx - rx * 0.34} ${cy - ry * 0.2}, ${cx - rx * 0.78} ${cy - ry * 0.24}, ${cx - rx * 1.06} ${cy + ry * 0.1} Z`
      );
    case "kovrdzava":
      return (
        `M ${cx - rx * 1.14} ${cy - ry * 0.14}` +
        ` C ${cx - rx * 1.4} ${top - ry * 0.62}, ${cx - rx * 0.44} ${top - ry * 0.72}, ${cx} ${top - ry * 0.34}` +
        ` C ${cx + rx * 0.44} ${top - ry * 0.72}, ${cx + rx * 1.4} ${top - ry * 0.62}, ${cx + rx * 1.14} ${cy - ry * 0.14}` +
        ` C ${cx + rx * 0.86} ${cy - ry * 0.62}, ${cx - rx * 0.86} ${cy - ry * 0.62}, ${cx - rx * 1.14} ${cy - ry * 0.14} Z`
      );
    case "duga":
      return (
        `M ${cx - rx * 1.1} ${cy + ry * 1.24}` +
        ` C ${cx - rx * 1.34} ${cy + ry * 0.2}, ${cx - rx * 1.26} ${top - ry * 0.4}, ${cx} ${top - ry * 0.4}` +
        ` C ${cx + rx * 1.26} ${top - ry * 0.4}, ${cx + rx * 1.34} ${cy + ry * 0.2}, ${cx + rx * 1.1} ${cy + ry * 1.24}` +
        ` C ${cx + rx * 0.96} ${cy + ry * 0.3}, ${cx + rx} ${cy - ry * 0.3}, ${cx + rx * 0.2} ${cy - ry * 0.34}` +
        ` C ${cx - rx * 0.6} ${cy - ry * 0.38}, ${cx - rx} ${cy - ry * 0.2}, ${cx - rx * 1.1} ${cy + ry * 1.24} Z`
      );
  }
}

/** Brada / brkovi kao `path` preko donje polovine lica. */
export function beardPath(kind: BeardId, h: Head): string {
  const { cx, cy, rx, ry } = h;

  switch (kind) {
    case "bez":
      return "";
    case "brkovi":
      return (
        `M ${cx - rx * 0.3} ${cy + ry * 0.42}` +
        ` Q ${cx} ${cy + ry * 0.34} ${cx + rx * 0.3} ${cy + ry * 0.42}` +
        ` Q ${cx} ${cy + ry * 0.54} ${cx - rx * 0.3} ${cy + ry * 0.42} Z`
      );
    case "malje":
    case "brada": {
      const drop = kind === "brada" ? 1.2 : 1.0;
      const w = kind === "brada" ? 0.98 : 0.9;
      return (
        `M ${cx - rx * w} ${cy + ry * 0.1}` +
        ` C ${cx - rx * w} ${cy + ry * drop}, ${cx + rx * w} ${cy + ry * drop}, ${cx + rx * w} ${cy + ry * 0.1}` +
        ` C ${cx + rx * 0.7} ${cy + ry * 0.5}, ${cx - rx * 0.7} ${cy + ry * 0.5}, ${cx - rx * w} ${cy + ry * 0.1} Z`
      );
    }
  }
}

/** Naočare: okvir + most, kao stroke preko očiju. */
export function glassesPaths(kind: GlassesId, h: Head): string[] {
  if (kind === "bez") return [];
  const { cx, cy, rx, ry } = h;
  const ex = rx * 0.4;
  const ey = cy + ry * 0.1;
  const w = rx * 0.32;

  if (kind === "okrugle") {
    return [
      `M ${cx - ex - w} ${ey} a ${w} ${w} 0 1 0 ${w * 2} 0 a ${w} ${w} 0 1 0 ${-w * 2} 0`,
      `M ${cx + ex - w} ${ey} a ${w} ${w} 0 1 0 ${w * 2} 0 a ${w} ${w} 0 1 0 ${-w * 2} 0`,
      `M ${cx - ex + w} ${ey} L ${cx + ex - w} ${ey}`,
    ];
  }
  const hh = w * 0.82;
  return [
    `M ${cx - ex - w} ${ey - hh} h ${w * 2} v ${hh * 2} h ${-w * 2} Z`,
    `M ${cx + ex - w} ${ey - hh} h ${w * 2} v ${hh * 2} h ${-w * 2} Z`,
    `M ${cx - ex + w} ${ey} L ${cx + ex - w} ${ey}`,
  ];
}

/* ------------------------------------------------------------------ */
/* Ocena                                                               */
/* ------------------------------------------------------------------ */

/**
 * Kratka reč za trenutno stanje. Namerno OPISNA, ne ocenjivačka --
 * app kaže gde si, ne šta valjaš (vidi poslovni cilj: instrument, ne sudija).
 */
export function stateLabel(fat: number, muscle: number): string {
  const score = (1 - clamp01(fat)) * 0.55 + clamp01(muscle) * 0.45;
  if (score > 0.78) return "vrhunski";
  if (score > 0.62) return "trenirano";
  if (score > 0.46) return "u formi";
  if (score > 0.3) return "prosečno";
  return "neaktivno";
}

/** Presetovi za traku poređenja -- isti čovek, pet stanja. */
export const PRESETS: readonly { label: string; fat: number; muscle: number }[] =
  [
    { label: "neaktivno", fat: 0.88, muscle: 0.12 },
    { label: "prosečno", fat: 0.6, muscle: 0.3 },
    { label: "u formi", fat: 0.38, muscle: 0.52 },
    { label: "trenirano", fat: 0.2, muscle: 0.76 },
    { label: "vrhunski", fat: 0.09, muscle: 1.0 },
  ];

export const DEFAULT_AVATAR: AvatarParams = {
  fat: 0.55,
  muscle: 0.3,
  height: 0.5,
  fem: false,
  hair: "talasasta",
  beard: "bez",
  glasses: "bez",
  skin: 1,
  shirt: 0,
};
