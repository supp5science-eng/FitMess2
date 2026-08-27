import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { colors, lift, radius, spacing } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * What Jarvis shows when water is logged — the first example of an answer that
 * is a screen rather than a sentence.
 *
 * "Ukupno danas 1250 mililitara od cilja 2500" takes four seconds to say and
 * is gone the moment it is said. A bar that is half full is read in a glance
 * and is still there. Jarvis says the short half out loud ("upisano") and
 * hands the number to the eye.
 *
 * The fill ANIMATES from where it was to where it is, and that is the point of
 * the component rather than a decoration: the user's own contribution is the
 * part that moves, so they can see what their glass did.
 */

const CILJ_ML = 2500;

export function KarticaVode({ ml, promena }: { ml: number; promena: number }) {
  const udeo = Math.max(0, Math.min(1, ml / CILJ_ML));
  const prethodni = Math.max(0, Math.min(1, (ml - promena) / CILJ_ML));

  const napredak = useRef(new Animated.Value(prethodni)).current;

  useEffect(() => {
    Animated.timing(napredak, {
      toValue: udeo,
      duration: 520,
      // Width cannot run on the native driver, but this animates once, over
      // half a second, on a card that is alone on screen — the JS thread has
      // nothing else to do at that moment.
      useNativeDriver: false,
    }).start();
  }, [udeo, napredak]);

  const sirina = napredak.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text variant="heading">Voda</Text>
        <Text variant="caption">
          {ml} / {CILJ_ML} ml
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: sirina }]} />
      </View>

      <Text variant="caption">
        {promena > 0 ? `+${promena} ml upisano` : `${Math.abs(promena)} ml skinuto`}
      </Text>
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
    gap: spacing.md,
    ...lift,
  },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  track: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gaugeTrack,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.markWater },
});
