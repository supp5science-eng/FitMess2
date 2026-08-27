import { StyleSheet, View } from "react-native";

import { colors, lift, radius, spacing } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * The day, at a glance — Jarvis's answer to "kako mi ide".
 *
 * Everything here is a choice the spoken version could not make:
 *
 *   - The big number is what is LEFT, not what was eaten. "Ostalo ti je 680"
 *     is what the question is actually about; the total is context.
 *   - Going over target is stated plainly and drawn in the warm ochre
 *     (`chart-5`), never in `destructive`. Over is not an error, and the app
 *     does not tell the user off — the palette enforces that as much as the
 *     copy does.
 *   - Macros are three bars rather than six numbers, because the question is
 *     "am I short on protein", not "what is the exact gram count".
 */

type Props = {
  pojedeno: number;
  cilj: number | null;
  protein: number;
  ugljeni: number;
  masti: number;
  ciljProtein: number | null;
  ciljUgljeni: number | null;
  ciljMasti: number | null;
  obroci: { naziv: string; kcal: number }[];
};

export function KarticaDana({
  pojedeno,
  cilj,
  protein,
  ugljeni,
  masti,
  ciljProtein,
  ciljUgljeni,
  ciljMasti,
  obroci,
}: Props) {
  const ostalo = cilj !== null ? cilj - pojedeno : null;
  const preko = ostalo !== null && ostalo < 0;

  return (
    <View style={styles.card}>
      {ostalo !== null ? (
        <View style={styles.glavni}>
          <Text variant="figure" color={preko ? colors.markSatfat : colors.ink}>
            {Math.abs(ostalo)}
          </Text>
          <Text variant="caption">
            {preko ? "kcal preko cilja" : `kcal do cilja · pojedeno ${pojedeno} od ${cilj}`}
          </Text>
        </View>
      ) : (
        <View style={styles.glavni}>
          <Text variant="figure">{pojedeno}</Text>
          <Text variant="caption">kcal danas · cilj nije postavljen</Text>
        </View>
      )}

      <View style={styles.makroi}>
        <Makro naziv="Proteini" vrednost={protein} cilj={ciljProtein} boja={colors.macroProtein} />
        <Makro naziv="Ugljeni h." vrednost={ugljeni} cilj={ciljUgljeni} boja={colors.macroCarbs} />
        <Makro naziv="Masti" vrednost={masti} cilj={ciljMasti} boja={colors.macroFat} />
      </View>

      {obroci.length > 0 ? (
        <Text variant="caption">
          {obroci.length === 1 ? "1 obrok" : `${obroci.length} obroka`}:{" "}
          {obroci.map((o) => o.naziv).join(", ")}
        </Text>
      ) : (
        <Text variant="caption">Danas još nema upisanih obroka.</Text>
      )}
    </View>
  );
}

function Makro({
  naziv,
  vrednost,
  cilj,
  boja,
}: {
  naziv: string;
  vrednost: number;
  cilj: number | null;
  boja: string;
}) {
  // Clamped at 1: a bar that overflows its track reads as a rendering bug
  // rather than as information. Being over is said in the number beside it.
  const udeo = cilj && cilj > 0 ? Math.min(1, vrednost / cilj) : 0;

  return (
    <View style={styles.makro}>
      <View style={styles.makroRed}>
        <Text variant="caption">{naziv}</Text>
        <Text variant="caption">{cilj ? `${vrednost} / ${cilj} g` : `${vrednost} g`}</Text>
      </View>
      <View style={styles.traka}>
        <View style={[styles.punjenje, { width: `${udeo * 100}%`, backgroundColor: boja }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperRaised,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    ...lift,
  },
  glavni: { gap: 2 },
  makroi: { gap: spacing.md },
  makro: { gap: spacing.xs },
  makroRed: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  traka: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gaugeTrack,
    overflow: "hidden",
  },
  punjenje: { height: "100%", borderRadius: radius.full },
});
