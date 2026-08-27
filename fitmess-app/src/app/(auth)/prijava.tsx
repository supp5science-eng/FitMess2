import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { Wordmark } from "@/ui/Wordmark";
import { feedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing } from "@/theme/tokens";

/**
 * Sign in.
 *
 * The keyboard is the reason this screen is worth reading. In the web view the
 * app had no say over it: iOS decided when to scroll the page, how much, and
 * whether the field ended up behind the keyboard or above it — which is what
 * "napravi mi neku tastaturu koja je katastrofa" was describing. Here the
 * behaviour is declared: `KeyboardAvoidingView` lifts the content by exactly
 * the keyboard's height on iOS, the fields say what kind of keyboard they
 * want, and the return key moves to the next field instead of dismissing.
 */
export default function PrijavaScreen() {
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState<string | null>(null);
  const [saljem, setSaljem] = useState(false);

  const prijavi = async () => {
    if (saljem) return;
    setGreska(null);
    setSaljem(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: lozinka,
    });

    setSaljem(false);

    if (error) {
      feedback.error();
      // Supabase answers in English and lumps "no such user" together with
      // "wrong password" on purpose — telling them apart would let anyone
      // check which addresses have accounts. The Serbian copy keeps that.
      setGreska(
        error.message.toLowerCase().includes("invalid")
          ? "Pogrešan email ili lozinka."
          : "Nismo uspeli da te prijavimo. Pokušaj ponovo."
      );
      return;
    }

    feedback.success();
    // No navigation here: the root layout is watching the session and moves
    // the app itself, so there is exactly one place that decides which side of
    // the gate the user is on.
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Dragging the list dismisses the keyboard, the way every native
          // app does it and no web page can.
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <Wordmark size={34} />
            <Text variant="caption" style={styles.subtitle}>
              Prijavi se da nastaviš.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="ti@primer.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Field
              label="Lozinka"
              value={lozinka}
              onChangeText={setLozinka}
              placeholder="••••••••"
              secureTextEntry
              // Lets iOS and Android offer the saved password, and lets the
              // OS store a new one after a successful sign-in.
              autoComplete="current-password"
              textContentType="password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={prijavi}
            />

            {greska ? (
              <Text variant="caption" color={colors.destructive} style={styles.error}>
                {greska}
              </Text>
            ) : null}

            <Button title="Prijavi se" onPress={prijavi} loading={saljem} block />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function Field({ label, style, ...rest }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="caption" style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl2 },
  header: { alignItems: "center", gap: spacing.sm },
  subtitle: { textAlign: "center" },
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  fieldLabel: { marginLeft: spacing.xs },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.input,
    backgroundColor: colors.paperRaised,
    color: colors.ink,
    fontSize: 16,
  },
  error: { marginLeft: spacing.xs },
});
