/**
 * FitMess brand tokens — mirrored from the app's dark theme in
 * `claude-missions/src/app/globals.css`. Keep these in sync with the product
 * so the launch video always reads as on-brand.
 */
export const theme = {
  color: {
    // Surfaces (dark-first, like the app)
    bg: "#0a0c0b",
    bgSoft: "#0e1211",
    card: "#14181a",
    cardSoft: "#1a1f21",
    border: "#232a2c",

    // Text
    fg: "#f3f7f5",
    muted: "#a6b0ab",
    faint: "#6e7873",

    // Brand + accents
    brand: "#17d1a8", // teal — the signature color
    brandSoft: "#6fd9c4",
    brandDeep: "#04231c",
    gold: "#c9a24b", // warm over-target accent (never punitive red)

    // Macros (from the app)
    protein: "#f9745f",
    fat: "#f2c14e",
    carbs: "#45c78d",

    // Only used to *portray* the "shame" of other apps in the Problem scene
    shameRed: "#e5484d",
  },
  font: {
    // family strings are assigned after the fonts load (see fonts.ts)
    display: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
  radius: {
    sm: 12,
    md: 20,
    lg: 32,
    phone: 48,
  },
} as const;

export type Theme = typeof theme;
