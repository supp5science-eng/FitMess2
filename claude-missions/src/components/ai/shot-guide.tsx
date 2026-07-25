import "./shot-guide.css";

/**
 * The two Prizma capture scenes, shown right before the shot they describe.
 *
 * Both scenes show the same thing from the same viewpoint -- a plate of food
 * with a fork beside it, and the phone above -- so the ONLY difference the eye
 * has to catch is the one that matters: how the phone is tilted. Scene `top`
 * holds the phone flat and drops its cone straight down; scene `angle` swings
 * it down a drawn 45° arc so the cone comes in from the side.
 *
 * The phone is drawn centred on the origin and positioned entirely from CSS,
 * which is what lets the whole camera -- body, lens and light cone together --
 * travel and rotate as one rigid piece.
 *
 * Presentational and hook-free, so the flow owns all state. Motion lives in
 * `shot-guide.css`, which parks each scene on its final, still-legible frame
 * under `prefers-reduced-motion`.
 */
export function ShotGuide({ variant }: { variant: "top" | "angle" }) {
  const isTop = variant === "top";

  return (
    <div className={`sg ${isTop ? "sg-top" : "sg-angle"}`}>
      <svg
        className="sg-svg"
        viewBox="0 0 320 220"
        role="img"
        aria-label={
          isTop
            ? "Animacija: telefon stoji ravno iznad tanjira i slika pravo odozgo, viljuška leži pored tanjira"
            : "Animacija: telefon se spušta po luku i naginje na 45 stepeni da uslika tanjir sa strane"
        }
      >
        {/* The table line, so the plate and fork read as lying on something. */}
        <line className="sg-table" x1="34" y1="196" x2="286" y2="196" />

        {/* --- the plate ------------------------------------------------- */}
        <g className="sg-plate">
          <ellipse className="sg-plate-rim" cx="150" cy="168" rx="68" ry="26" />
          <ellipse className="sg-plate-well" cx="150" cy="168" rx="52" ry="18" />

          {/* On the angled scene the food grows a visible side wall — the
              height is the entire reason for taking the second shot, so the
              picture should show it rather than only the caption saying it. */}
          {!isTop ? (
            <g className="sg-height">
              <path className="sg-wall-meat" d="M114 164a19 9 0 0 0 38 0v11a19 9 0 0 1-38 0z" />
              <path className="sg-wall-side" d="M152 162a15 7 0 0 0 30 0v9a15 7 0 0 1-30 0z" />
              <path className="sg-wall-greens" d="M141 176a13 6 0 0 0 26 0v7a13 6 0 0 1-26 0z" />
            </g>
          ) : null}

          {/* Food, in the app's macro colours: meat, side, greens. Three
              distinct shapes so it reads as "a meal" at a glance. */}
          <ellipse className="sg-food-meat" cx="133" cy="164" rx="19" ry="9" />
          <ellipse className="sg-food-side" cx="167" cy="162" rx="15" ry="7" />
          <ellipse className="sg-food-greens" cx="154" cy="176" rx="13" ry="6" />
        </g>

        {/* --- the fork, lying on the table beside the plate ---------------
            On the LEFT: the camera swings out to the right on the angled
            scene, so keeping the fork opposite stops the two from colliding
            and leaves both readable. Drawn as filled shapes (four tines, a
            shoulder that tapers into the neck, then the handle) rather than
            bare strokes -- at this size, lines just read as scratches. */}
        <g className="sg-fork">
          <rect className="sg-fork-part" x="48.5" y="133" width="3.4" height="21" rx="1.7" />
          <rect className="sg-fork-part" x="53.7" y="133" width="3.4" height="21" rx="1.7" />
          <rect className="sg-fork-part" x="58.9" y="133" width="3.4" height="21" rx="1.7" />
          <rect className="sg-fork-part" x="64.1" y="133" width="3.4" height="21" rx="1.7" />
          <path
            className="sg-fork-part"
            d="M47 150H69v9c0 6-7.5 6-7.5 12v17a3.2 3.2 0 0 1-6.5 0v-17c0-6-8-6-8-12z"
          />
        </g>

        {/* --- the 45° arc (angle scene only) ----------------------------- */}
        {!isTop ? (
          <>
            {/* Straight-up reference, so 45° has something to be 45° FROM. */}
            <line className="sg-ref" x1="150" y1="168" x2="150" y2="96" />
            <path className="sg-arc" d="M150 108 A 60 60 0 0 1 192 126" />
            <text className="sg-label" x="198" y="122">
              45°
            </text>
          </>
        ) : (
          <text className="sg-label" x="162" y="112">
            90°
          </text>
        )}

        {/* --- the camera: body, lens and light cone as one rigid piece --- */}
        <g className="sg-cam">
          {/* Light cone, pointing out of the lens. Reaches 120 units, which is
              exactly the lens-to-plate distance in BOTH resting poses — so the
              cone lands on the middle of the plate either way. */}
          <path className="sg-cone" d="M0 26 L-34 120 L34 120 Z" />
          <rect
            className="sg-phone-body"
            x="-22"
            y="-31"
            width="44"
            height="62"
            rx="9"
          />
          <rect
            className="sg-phone-screen"
            x="-16"
            y="-25"
            width="32"
            height="42"
            rx="5"
          />
          <circle className="sg-phone-lens" cx="0" cy="23" r="5" />
        </g>

        <rect className="sg-flash" x="0" y="0" width="320" height="220" />
      </svg>
    </div>
  );
}
