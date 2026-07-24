import "./shot-guide.css";

/**
 * The two iPeach capture scenes, shown right before the shot they describe.
 *
 * `top` — the camera rises overhead and the plate opens from a side profile
 * into a full circle, with the fork sliding in beside it. Reads as: shoot
 * straight down, and put something next to the plate.
 *
 * `angle` — a 45° arc draws itself, the camera rides down it, and the food's
 * side wall lifts into view. Reads as: now from the side, so I can see how
 * tall it is.
 *
 * Presentational and hook-free, so the flow owns all state. Motion lives in
 * `shot-guide.css`, which holds each scene on its final, still-legible frame
 * under `prefers-reduced-motion`.
 */
export function ShotGuide({ variant }: { variant: "top" | "angle" }) {
  return (
    <div className={`sg ${variant === "top" ? "sg-top" : "sg-angle"}`}>
      <svg
        className="sg-svg"
        viewBox="0 0 300 200"
        role="img"
        aria-label={
          variant === "top"
            ? "Animacija: telefon se podiže iznad tanjira i slika pravo odozgo, viljuška je pored tanjira"
            : "Animacija: telefon se spušta po luku do ugla od 45 stepeni i slika tanjir sa strane"
        }
      >
        {variant === "top" ? (
          <>
            {/* Camera's line of sight, drawn straight down onto the plate. */}
            <line className="sg-beam" x1="150" y1="52" x2="150" y2="112" />

            <g className="sg-plate-group">
              <ellipse className="sg-plate-face" cx="150" cy="132" rx="66" ry="66" />
              <ellipse className="sg-plate-rim" cx="150" cy="132" rx="66" ry="66" />
              <circle className="sg-food" cx="150" cy="132" r="40" />
              {/* Fork: handle plus three tines, laid beside the plate. */}
              <g className="sg-fork-group">
                <path className="sg-fork" d="M236 108v48" />
                <path className="sg-fork" d="M230 108v14M236 108v14M242 108v14" />
              </g>
            </g>

            <g className="sg-phone-group">
              <rect
                className="sg-phone"
                x="136"
                y="16"
                width="28"
                height="40"
                rx="6"
              />
              <circle className="sg-phone-lens" cx="150" cy="36" r="6" />
            </g>
          </>
        ) : (
          <>
            {/* The swing path, from overhead down to 45°. */}
            <path className="sg-arc" d="M150 40 A 95 95 0 0 1 217 68" />

            <g>
              <ellipse className="sg-plate-face" cx="150" cy="140" rx="66" ry="20" />
              <ellipse className="sg-plate-rim" cx="150" cy="140" rx="66" ry="20" />
              {/* The height that only an angled shot reveals. */}
              <path
                className="sg-food-side"
                d="M110 140a40 12 0 0 0 80 0v-22a40 12 0 0 1-80 0z"
              />
              <ellipse className="sg-food" cx="150" cy="118" rx="40" ry="12" />
              <path className="sg-fork" d="M236 122v40" />
              <path className="sg-fork" d="M230 122v12M236 122v12M242 122v12" />
            </g>

            <text className="sg-label" x="196" y="104">
              45°
            </text>

            <g className="sg-phone-group">
              <rect
                className="sg-phone"
                x="136"
                y="22"
                width="28"
                height="40"
                rx="6"
              />
              <circle className="sg-phone-lens" cx="150" cy="42" r="6" />
            </g>
          </>
        )}

        <rect className="sg-flash" x="0" y="0" width="300" height="200" />
      </svg>
    </div>
  );
}
