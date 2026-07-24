import { loadFont } from "@remotion/google-fonts/Inter";

// Inter across the weights the video uses. `fontFamily` is the string to pass
// to `style={{ fontFamily }}`. Google Fonts are bundled/loaded by Remotion, so
// text renders deterministically instead of falling back to a system font.
const inter = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"], // latin-ext covers š/č/ć/ž/đ
});

export const fontFamily = inter.fontFamily;
export const { waitUntilDone } = inter;
