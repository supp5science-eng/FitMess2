/**
 * FitMess brand tokens — copied 1:1 from the app's dark theme
 * (claude-missions/src/app/globals.css `.dark`), so every video reads as
 * the same product world as the app itself.
 */
export const theme = {
  bg: "#0a0c0b", // --background
  bgCard: "#14181a", // --card
  fg: "#f3f7f5", // --foreground
  muted: "#a6b0ab", // --muted-foreground
  brand: "#17d1a8", // --primary / accent teal
  brandSoft: "#9ff0dd", // --accent-foreground
  brandDeep: "#04231c", // --primary-foreground (text on teal)
  macro: {
    protein: "#f9745f", // coral
    fat: "#f2c14e", // amber
    carbs: "#45c78d", // green
  },
  border: "rgba(255, 255, 255, 0.1)",
} as const;
