/**
 * Regenerates `src/lib/share/pear-mark.ts` from the brand icon. One-off tool,
 * run by hand only when the logo changes:
 *
 *   npx --yes -p sharp node scripts/gen-pear-mark.cjs .
 *
 * `sharp` is deliberately NOT a project dependency -- nothing at runtime needs
 * it, and the generated file is checked in.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = process.argv[2];
const src = path.join(root, "public/brand/fitmess-icon.png");
const out = path.join(root, "src/lib/share/pear-mark.ts");

const HEADER = [
  "/**",
  " * The FitMess pear mark, inlined as a base64 PNG (128x128, ~5 KB).",
  " *",
  " * The share card is painted by satori (`next/og`), which can only draw an",
  " * image it already holds the bytes for: a `/brand/...` path would mean an HTTP",
  " * round-trip on every card, and reading out of `public/` is not reliable inside",
  " * a serverless function bundle. Inlining the mark keeps a card render entirely",
  " * network-free -- part of why a card is now fast enough to build up front.",
  " *",
  " * Source of truth is `public/brand/fitmess-icon.png`; this is that file",
  " * downscaled to what the signature actually paints (~56 px on a 1080-wide card,",
  " * so 128 px covers it at 2x). Regenerate with `scripts/gen-pear-mark.cjs` if the",
  " * logo ever changes.",
  " */",
  "export const PEAR_MARK_DATA_URI =",
  '  "data:image/png;base64," +',
  "",
].join("\n");

sharp(src)
  .resize(128, 128, { fit: "inside" })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer()
  .then((buf) => {
    const b64 = buf.toString("base64");
    const body =
      b64
        .match(/.{1,96}/g)
        .map((line) => `  "${line}"`)
        .join(" +\n") + ";\n";
    fs.writeFileSync(out, HEADER + body, "utf8");
    console.log("wrote", out, buf.length, "bytes ->", b64.length, "base64 chars");
  });
