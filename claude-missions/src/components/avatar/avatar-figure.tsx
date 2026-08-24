"use client";

import { useId } from "react";

import {
  beardPath,
  CX,
  detail,
  geom,
  glassesPaths,
  hairPath,
  HAIR_COLORS,
  head,
  INK,
  joints,
  OUTLINE,
  SHIRTS,
  SHORTS,
  SKINS,
  torsoPath,
  VIEWBOX,
  Y,
  type AvatarParams,
} from "@/lib/avatar/figure";

const r = (n: number) => Math.round(n * 10) / 10;

/**
 * Kapsula sa konturom -- ud. Crta se dvaput: prvo šira tamna, pa uža u boji.
 * Time svaki ud dobije svoju liniju i tamo gde prelazi preko dela iza sebe,
 * što je tačno ono po čemu se Bitmoji prepoznaje.
 */
function Limb({
  x1,
  y1,
  x2,
  y2,
  w,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  color: string;
}) {
  const d = `M ${r(x1)} ${r(y1)} L ${r(x2)} ${r(y2)}`;
  return (
    <>
      <path
        d={d}
        stroke={INK}
        strokeWidth={r(w * 2 + OUTLINE * 2)}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={d}
        stroke={color}
        strokeWidth={r(w * 2)}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

/** Puna forma sa konturom -- trup, glava, kosa, patika. */
function Shape({ d, color }: { d: string; color: string }) {
  return (
    <>
      <path
        d={d}
        fill={INK}
        stroke={INK}
        strokeWidth={OUTLINE * 2}
        strokeLinejoin="round"
      />
      <path d={d} fill={color} />
    </>
  );
}

/**
 * Renderuje figuru iz parametara. Nema svoje stanje i ne zna odakle brojevi
 * dolaze -- u labu ih voze slajderi, u appu će ih voziti kilaža i trening.
 *
 * Delovi idu od pozadi ka napred i SVAKI se crta odmah sa svojom konturom
 * (ink pa boja), a ne u dva odvojena prolaza -- inače nema linije tamo gde
 * ruka prelazi preko trupa, pa figura izgleda kao ravna nalepnica.
 */
export function AvatarFigure({
  params,
  className,
  hairColor = 0,
}: {
  params: AvatarParams;
  className?: string;
  hairColor?: number;
}) {
  const g = geom(params);
  const j = joints(g);
  const h = head(g);
  const d = detail(g);
  const skin = SKINS[params.skin] ?? SKINS[1];
  const shirt = SHIRTS[params.shirt] ?? SHIRTS[0];
  const hair = HAIR_COLORS[hairColor] ?? HAIR_COLORS[0];
  const torso = torsoPath(g);

  // Jedinstveni prefiks: na strani se renderuje šest figura odjednom, a
  // clipPath ID-jevi su globalni -- bez ovoga sve dele isti isečak.
  const uid = useId().replace(/:/g, "");
  const teeClip = `${uid}-tee`;
  const shortsClip = `${uid}-shorts`;

  const scale = 0.93 + Math.min(1, Math.max(0, params.height)) * 0.14;
  const groundY = Y.ankle + 16;

  const sides = [-1, 1] as const;
  const eyeX = h.rx * 0.36;
  const eyeY = h.cy + h.ry * 0.08;

  const hairD = hairPath(params.hair, h);
  const beardD = beardPath(params.beard, h);
  const glassD = glassesPaths(params.glasses, h);

  // Majica: donja ivica i izrez. Isečak prati siluetu tela, pa se forma vidi
  // kroz odeću -- profil uvek pokazuje fit verziju (outfiti su svoj ekran).
  const hemY = Y.hip + 2;
  const neckY = Y.chest - 4;

  return (
    <svg
      viewBox={VIEWBOX}
      className={className}
      role="img"
      aria-label="Avatar figura"
    >
      <defs>
        <clipPath id={teeClip}>
          <rect x={0} y={r(neckY)} width={300} height={r(hemY - neckY)} />
        </clipPath>
        <clipPath id={shortsClip}>
          <rect
            x={0}
            y={r(Y.hip - 9)}
            width={300}
            height={r(Y.crotch + 6 - (Y.hip - 9))}
          />
        </clipPath>
      </defs>

      <g
        transform={`translate(${CX} ${groundY}) scale(${r(scale)}) translate(${-CX} ${-groundY})`}
      >
        {/* noge */}
        {sides.map((s) => (
          <g key={`noga${s}`}>
            <Limb
              x1={CX + s * j.hip[0]}
              y1={j.hip[1]}
              x2={CX + s * j.knee[0]}
              y2={j.knee[1]}
              w={g.limb.thigh}
              color={skin.base}
            />
            <Limb
              x1={CX + s * j.knee[0]}
              y1={j.knee[1]}
              x2={CX + s * j.ankle[0]}
              y2={j.ankle[1]}
              w={g.limb.calf}
              color={skin.base}
            />
          </g>
        ))}

        {/* patike */}
        {sides.map((s) => {
          const bx = CX + s * j.ankle[0];
          const w = g.limb.calf;
          const x0 = bx - (s < 0 ? w * 1.3 : w * 0.9);
          const x1 = bx + (s < 0 ? w * 0.9 : w * 1.3);
          const yT = Y.ankle - 4;
          const yB = Y.ankle + 13;
          return (
            <Shape
              key={`patika${s}`}
              color="#FDF7E4"
              d={
                `M ${r(x0)} ${r(yT)}` +
                ` L ${r(x1)} ${r(yT)}` +
                ` L ${r(x1)} ${r(yB - 5)}` +
                ` Q ${r(x1)} ${r(yB)} ${r(x1 - 5)} ${r(yB)}` +
                ` L ${r(x0 + 5)} ${r(yB)}` +
                ` Q ${r(x0)} ${r(yB)} ${r(x0)} ${r(yB - 5)} Z`
              }
            />
          );
        })}

        {/* trup */}
        <Shape d={torso} color={skin.base} />

        {/* definicija -- grudi, trbušnjaci, stomak */}
        {d.pec > 0.02 && (
          <path
            d={`M ${r(CX - g.w.chest * 0.62)} ${r(Y.chest + 8)} Q ${r(CX)} ${r(Y.chest + 26)} ${r(CX + g.w.chest * 0.62)} ${r(Y.chest + 8)}`}
            stroke={INK}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
            opacity={r(d.pec * 0.55)}
          />
        )}
        {d.abs > 0.02 && (
          <g
            stroke={INK}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={r(d.abs * 0.5)}
          >
            <path
              d={`M ${r(CX)} ${r(Y.chest + 30)} L ${r(CX)} ${r(Y.belly - 6)}`}
            />
            {[1, 2, 3].map((k) => {
              const ay = Y.chest + 30 + (Y.belly - 6 - (Y.chest + 30)) * (k / 4);
              const aw = g.w.waist * (0.42 - k * 0.04);
              return (
                <path
                  key={k}
                  d={`M ${r(CX - aw)} ${r(ay)} L ${r(CX + aw)} ${r(ay)}`}
                />
              );
            })}
          </g>
        )}
        {d.belly > 0.02 && (
          <path
            d={`M ${r(CX - g.w.belly * 0.55)} ${r(Y.belly - 22)} Q ${r(CX)} ${r(Y.belly + 8)} ${r(CX + g.w.belly * 0.55)} ${r(Y.belly - 22)}`}
            stroke={INK}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
            opacity={r(d.belly * 0.4)}
          />
        )}

        {/* šorc -- isečak prati siluetu, pa kukovi ostaju tačni */}
        {sides.map((s) => (
          <Limb
            key={`sorc${s}`}
            x1={CX + s * j.hip[0]}
            y1={j.hip[1]}
            x2={CX + s * (j.hip[0] + 1)}
            y2={Y.crotch + 30}
            w={g.limb.thigh + 1}
            color={SHORTS.base}
          />
        ))}
        <path d={torso} fill={SHORTS.base} clipPath={`url(#${shortsClip})`} />

        {/* majica */}
        <path d={torso} fill={shirt.base} clipPath={`url(#${teeClip})`} />
        <path
          d={`M ${r(CX - g.w.hip)} ${r(hemY)} L ${r(CX + g.w.hip)} ${r(hemY)}`}
          stroke={INK}
          strokeWidth={OUTLINE * 0.8}
          strokeLinecap="round"
        />
        <path
          d={`M ${r(CX - g.w.chest * 0.9)} ${r(neckY)} Q ${r(CX)} ${r(neckY + 15)} ${r(CX + g.w.chest * 0.9)} ${r(neckY)}`}
          stroke={INK}
          strokeWidth={OUTLINE * 0.8}
          fill="none"
          strokeLinecap="round"
        />
        {sides.map((s2) => (
          <Limb
            key={`bretela${s2}`}
            x1={CX + s2 * g.w.shoulder * 0.52}
            y1={Y.shoulder + 2}
            x2={CX + s2 * g.w.chest * 0.62}
            y2={neckY + 6}
            w={5.5}
            color={shirt.base}
          />
        ))}

        {/* ruke, pa rukavi preko njih */}
        {sides.map((s) => {
          const sx = CX + s * j.shoulder[0];
          const ex = CX + s * j.elbow[0];
          const wx = CX + s * j.wrist[0];
          return (
            <g key={`ruka${s}`}>
              <Limb
                x1={sx}
                y1={j.shoulder[1]}
                x2={ex}
                y2={j.elbow[1]}
                w={g.limb.upperArm}
                color={skin.base}
              />
              <Limb
                x1={ex}
                y1={j.elbow[1]}
                x2={wx}
                y2={j.wrist[1]}
                w={g.limb.foreArm}
                color={skin.base}
              />
              <Limb
                x1={wx}
                y1={j.wrist[1]}
                x2={wx + s}
                y2={j.wrist[1] + 8}
                w={g.limb.foreArm * 1.05}
                color={skin.base}
              />
            </g>
          );
        })}

        {/* vrat */}
        <Limb
          x1={CX}
          y1={Y.chin - 8}
          x2={CX}
          y2={Y.neck + 10}
          w={g.w.neck}
          color={skin.shade}
        />

        {/* uši, pa glava preko njih */}
        {sides.map((s) => (
          <Shape
            key={`uvo${s}`}
            color={skin.base}
            d={
              `M ${r(h.cx + s * h.rx * 0.84)} ${r(h.cy + h.ry * 0.02)}` +
              ` a 6 8 0 1 ${s > 0 ? 1 : 0} 0 ${r(h.ry * 0.34)} Z`
            }
          />
        ))}
        <Shape
          color={skin.base}
          d={
            `M ${r(h.cx - h.rx)} ${r(h.cy)}` +
            ` a ${r(h.rx)} ${r(h.ry)} 0 1 1 ${r(h.rx * 2)} 0` +
            ` a ${r(h.rx)} ${r(h.ry)} 0 1 1 ${r(-h.rx * 2)} 0 Z`
          }
        />

        {/* lice */}
        {beardD && <path d={beardD} fill={hair} opacity={0.92} />}
        <g fill={INK}>
          <ellipse cx={r(CX - eyeX)} cy={r(eyeY)} rx={4} ry={5} />
          <ellipse cx={r(CX + eyeX)} cy={r(eyeY)} rx={4} ry={5} />
        </g>
        <g stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round">
          <path
            d={`M ${r(CX - eyeX - 7)} ${r(eyeY - 13)} Q ${r(CX - eyeX)} ${r(eyeY - 16)} ${r(CX - eyeX + 6)} ${r(eyeY - 13.5)}`}
          />
          <path
            d={`M ${r(CX + eyeX + 7)} ${r(eyeY - 13)} Q ${r(CX + eyeX)} ${r(eyeY - 16)} ${r(CX + eyeX - 6)} ${r(eyeY - 13.5)}`}
          />
        </g>
        <path
          d={`M ${r(CX - 1)} ${r(h.cy + h.ry * 0.2)} Q ${r(CX + 3)} ${r(h.cy + h.ry * 0.33)} ${r(CX - 1)} ${r(h.cy + h.ry * 0.38)}`}
          stroke={skin.shade}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M ${r(CX - 9)} ${r(h.cy + h.ry * 0.55)} Q ${r(CX)} ${r(h.cy + h.ry * 0.68)} ${r(CX + 9)} ${r(h.cy + h.ry * 0.55)}`}
          stroke={INK}
          strokeWidth={2.8}
          fill="none"
          strokeLinecap="round"
        />

        {/* naočare */}
        {glassD.map((p, i) => (
          <path
            key={`nao${i}`}
            d={p}
            stroke={INK}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* kosa -- poslednja, ide preko čela */}
        {hairD && <Shape d={hairD} color={hair} />}
      </g>
    </svg>
  );
}
