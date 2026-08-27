import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { colors, gradients } from "@/theme/tokens";
import { Text } from "./Text";

/**
 * The FitMess lockup: "Fit" in flat ink, "Mess" in the overprint gradient.
 *
 * THE RULE, and it is the one that gets broken: the gradient belongs to the
 * LOCKUP, not to the word. "Mess" written inside a sentence — "u FitMess-u",
 * "FitMess ti predlaže" — is ordinary ink like every other word. Painting it
 * mid-paragraph turns a logo into a highlighter.
 *
 * RN has no `background-clip: text`, so the gradient is drawn as a rectangle
 * and a mask cuts the letterforms out of it. The mask is the same `<Text>` the
 * app uses everywhere, at the same size, so the two halves of the lockup share
 * a baseline and cannot drift apart when the type scale changes.
 */
export function Wordmark({ size = 28 }: { size?: number }) {
  const type = { fontSize: size, lineHeight: size * 1.15, fontWeight: "700" as const };

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="FitMess">
      <Text style={[type, styles.flat]} accessibilityElementsHidden importantForAccessibility="no">
        Fit
      </Text>
      <MaskedView
        // The mask must be measured before the gradient can be sized, so the
        // masked view is laid out by its own text rather than stretched.
        maskElement={
          <Text style={[type, styles.mask]} importantForAccessibility="no">
            Mess
          </Text>
        }
      >
        <LinearGradient
          colors={gradients.wordmark as unknown as [string, string, ...string[]]}
          locations={gradients.wordmarkLocations as unknown as [number, number, ...number[]]}
          // 112deg on the web: left-to-right with a slight downward drift.
          start={{ x: 0, y: 0.1 }}
          end={{ x: 1, y: 0.9 }}
        >
          {/* Invisible copy of the masked text: it is what gives the gradient
              its width and height. Without it the gradient has no intrinsic
              size and collapses to nothing. */}
          <Text style={[type, styles.spacer]} importantForAccessibility="no">
            Mess
          </Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline" },
  flat: { color: colors.ink, letterSpacing: -0.8 },
  mask: { color: "#000", letterSpacing: -0.8, backgroundColor: "transparent" },
  spacer: { opacity: 0, letterSpacing: -0.8 },
});
