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
  joints,
  SHIRTS,
  SHORTS,
  SKINS,
  torsoPath,
  VIEWBOX,
  Y,
  type AvatarParams,
} from "@/lib/avatar/figure";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Renderuje figuru iz parametara. Nema svoje stanje i ne zna odakle brojevi
 * dolaze -- u labu ih voze slajderi, u appu će ih voziti kilaža i trening.
 *
 * Redosled slojeva je bitan i ide kao papirna lutka, od pozadi ka napred:
 * noge → trup → definicija → šorc → majica → ruke → vrat → glava → lice →
 * naočare → kosa.
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
  const tankClip = `${uid}-tank`;
  const shortsClip = `${uid}-shorts`;

  // Visina skalira celu figuru oko stopala, da tlo ostane na mestu.
  const scale = 0.93 + Math.min(1, Math.max(0, params.height)) * 0.14;
  const groundY = Y.ankle + 14;

  const sides = [-1, 1] as const;
  const eyeX = h.rx * 0.4;
  const eyeY = h.cy + h.ry * 0.1;

  const hairD = hairPath(params.hair, h);
  const beardD = beardPath(params.beard, h);
  const glassD = glassesPaths(params.glasses, h);

  return (
    <svg
      viewBox={VIEWBOX}
      className={className}
      role="img"
      aria-label="Avatar figura"
    >
      <defs>
        <clipPath id={tankClip}>
          <rect
            x={0}
            y={r1(Y.shoulder + 17)}
            width={300}
            height={r1(Y.hip + 3 - (Y.shoulder + 17))}
          />
        </clipPath>
        <clipPath id={shortsClip}>
          <rect
            x={0}
            y={r1(Y.hip - 9)}
            width={300}
            height={r1(Y.crotch + 6 - (Y.hip - 9))}
          />
        </clipPath>
      </defs>

      <g
        transform={`translate(${CX} ${groundY}) scale(${r1(scale)}) translate(${-CX} ${-groundY})`}
      >
        {/* noge */}
        {sides.map((s) => (
          <g key={`noga${s}`}>
            <path
              d={`M ${r1(CX + s * j.hip[0])} ${r1(j.hip[1])} L ${r1(CX + s * j.knee[0])} ${r1(j.knee[1])}`}
              stroke={skin.base}
              strokeWidth={r1(g.limb.thigh * 2)}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M ${r1(CX + s * j.knee[0])} ${r1(j.knee[1])} L ${r1(CX + s * j.ankle[0])} ${r1(j.ankle[1])}`}
              stroke={skin.base}
              strokeWidth={r1(g.limb.calf * 2)}
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx={r1(CX + s * (j.ankle[0] + 3))}
              cy={r1(Y.ankle + 9)}
              rx={r1(g.limb.calf * 1.05)}
              ry={7}
              fill={skin.shade}
            />
          </g>
        ))}

        {/* trup */}
        <path d={torso} fill={skin.base} />

        {/* definicija -- grudi, trbušnjaci, stomak */}
        {d.pec > 0.02 && (
          <path
            d={`M ${r1(CX - g.w.chest * 0.66)} ${r1(Y.chest + 6)} Q ${r1(CX)} ${r1(Y.chest + 24)} ${r1(CX + g.w.chest * 0.66)} ${r1(Y.chest + 6)}`}
            stroke={skin.shade}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={r1(d.pec * 0.9)}
          />
        )}
        {d.abs > 0.02 && (
          <g
            stroke={skin.shade}
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={r1(d.abs * 0.85)}
          >
            <path
              d={`M ${r1(CX)} ${r1(Y.chest + 26)} L ${r1(CX)} ${r1(Y.belly - 4)}`}
            />
            {[1, 2, 3].map((k) => {
              const ay = Y.chest + 26 + (Y.belly - 4 - (Y.chest + 26)) * (k / 4);
              const aw = g.w.waist * (0.44 - k * 0.04);
              return (
                <path
                  key={k}
                  d={`M ${r1(CX - aw)} ${r1(ay)} L ${r1(CX + aw)} ${r1(ay)}`}
                />
              );
            })}
          </g>
        )}
        {d.belly > 0.02 && (
          <path
            d={`M ${r1(CX - g.w.belly * 0.6)} ${r1(Y.belly - 20)} Q ${r1(CX)} ${r1(Y.belly + 10)} ${r1(CX + g.w.belly * 0.6)} ${r1(Y.belly - 20)}`}
            stroke={skin.shade}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={r1(d.belly * 0.55)}
          />
        )}

        {/* šorc */}
        {sides.map((s) => (
          <path
            key={`sorc${s}`}
            d={`M ${r1(CX + s * j.hip[0])} ${r1(j.hip[1])} L ${r1(CX + s * (j.hip[0] + 1))} ${r1(Y.crotch + 46)}`}
            stroke={SHORTS.base}
            strokeWidth={r1(g.limb.thigh * 2 + 3)}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <path d={torso} fill={SHORTS.base} clipPath={`url(#${shortsClip})`} />

        {/* majica -- isti isečak kao trup, pa prati siluetu tela */}
        <path d={torso} fill={shirt.base} clipPath={`url(#${tankClip})`} />
        {sides.map((s) => (
          <path
            key={`bretela${s}`}
            d={`M ${r1(CX + s * g.w.shoulder * 0.56)} ${r1(Y.shoulder + 1)} Q ${r1(CX + s * g.w.chest * 0.7)} ${r1(Y.shoulder + 12)} ${r1(CX + s * g.w.chest * 0.76)} ${r1(Y.shoulder + 20)}`}
            stroke={shirt.base}
            strokeWidth={13}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <path
          d={`M ${r1(CX - g.w.chest * 0.4)} ${r1(Y.shoulder + 16)} Q ${r1(CX)} ${r1(Y.shoulder + 30)} ${r1(CX + g.w.chest * 0.4)} ${r1(Y.shoulder + 16)}`}
          stroke={shirt.shade}
          strokeWidth={2.5}
          fill="none"
          opacity={0.7}
        />

        {/* ruke */}
        {sides.map((s) => (
          <g key={`ruka${s}`}>
            <path
              d={`M ${r1(CX + s * j.shoulder[0])} ${r1(j.shoulder[1])} L ${r1(CX + s * j.elbow[0])} ${r1(j.elbow[1])}`}
              stroke={skin.base}
              strokeWidth={r1(g.limb.upperArm * 2)}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M ${r1(CX + s * j.elbow[0])} ${r1(j.elbow[1])} L ${r1(CX + s * j.wrist[0])} ${r1(j.wrist[1])}`}
              stroke={skin.base}
              strokeWidth={r1(g.limb.foreArm * 2)}
              strokeLinecap="round"
              fill="none"
            />
            <circle
              cx={r1(CX + s * (j.wrist[0] + 1))}
              cy={r1(j.wrist[1] + 9)}
              r={r1(g.limb.foreArm * 1.02)}
              fill={skin.shade}
            />
            {d.abs > 0.1 && (
              <path
                d={`M ${r1(CX + s * (j.shoulder[0] + 1))} ${r1(j.shoulder[1] + 16)} Q ${r1(CX + s * (j.shoulder[0] + g.limb.upperArm * 0.5))} ${r1(j.shoulder[1] + 26)} ${r1(CX + s * (j.shoulder[0] + 2))} ${r1(j.shoulder[1] + 38)}`}
                stroke={skin.shade}
                strokeWidth={2.2}
                strokeLinecap="round"
                fill="none"
                opacity={r1(d.abs * 0.7)}
              />
            )}
          </g>
        ))}

        {/* vrat */}
        <path
          d={`M ${r1(CX - g.w.neck)} ${r1(Y.chin - 6)} L ${r1(CX - g.w.neck)} ${r1(Y.neck + 8)} L ${r1(CX + g.w.neck)} ${r1(Y.neck + 8)} L ${r1(CX + g.w.neck)} ${r1(Y.chin - 6)} Z`}
          fill={skin.shade}
        />

        {/* glava + uši */}
        <ellipse
          cx={r1(h.cx)}
          cy={r1(h.cy)}
          rx={r1(h.rx)}
          ry={r1(h.ry)}
          fill={skin.base}
        />
        {sides.map((s) => (
          <ellipse
            key={`uvo${s}`}
            cx={r1(h.cx + s * h.rx * 0.98)}
            cy={r1(h.cy + h.ry * 0.12)}
            rx={4.5}
            ry={7}
            fill={skin.base}
          />
        ))}

        {/* lice */}
        {beardD && <path d={beardD} fill={hair} opacity={0.9} />}
        <g fill="#22303B">
          <ellipse cx={r1(CX - eyeX)} cy={r1(eyeY)} rx={3.4} ry={4.2} />
          <ellipse cx={r1(CX + eyeX)} cy={r1(eyeY)} rx={3.4} ry={4.2} />
        </g>
        <g
          stroke="#22303B"
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        >
          <path
            d={`M ${r1(CX - eyeX - 6)} ${r1(eyeY - 11)} L ${r1(CX - eyeX + 5)} ${r1(eyeY - 12.5)}`}
          />
          <path
            d={`M ${r1(CX + eyeX + 6)} ${r1(eyeY - 11)} L ${r1(CX + eyeX - 5)} ${r1(eyeY - 12.5)}`}
          />
        </g>
        <path
          d={`M ${r1(CX)} ${r1(h.cy + h.ry * 0.16)} L ${r1(CX + 2)} ${r1(h.cy + h.ry * 0.34)}`}
          stroke={skin.shade}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M ${r1(CX - 6)} ${r1(h.cy + h.ry * 0.52)} Q ${r1(CX)} ${r1(h.cy + h.ry * 0.62)} ${r1(CX + 6)} ${r1(h.cy + h.ry * 0.52)}`}
          stroke="#22303B"
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          opacity={0.8}
        />

        {/* naočare */}
        {glassD.map((p, i) => (
          <path
            key={`nao${i}`}
            d={p}
            stroke="#22303B"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* kosa -- poslednja, ide preko čela */}
        {hairD && <path d={hairD} fill={hair} />}
      </g>
    </svg>
  );
}
