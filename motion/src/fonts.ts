import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadArchivo } from "@remotion/google-fonts/ArchivoBlack";

// Inter = body copy (matches the app's --font-sans).
export const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
});

// Archivo Black = the brand lockup / big display type (matches --font-display).
export const { fontFamily: archivoFamily } = loadArchivo("normal", {
  weights: ["400"],
});
