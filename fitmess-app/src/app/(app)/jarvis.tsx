import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { feedback } from "@/lib/feedback";
import { komponente } from "@/jarvis/alat";
import { odgovori, potvrdi, type OdgovorMozga, type Poruka } from "@/jarvis/mozak";
import { colors, radius, spacing } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * Jarvis.
 *
 * THE KEYBOARD IS THE POINT OF THIS FILE. In the web view the app had no say
 * over it: iOS decided when to scroll, by how much, and whether the field
 * ended up above the keyboard or behind it — the thing the owner described as
 * "napravi mi neku tastaturu koja je katastrofa". Every line below that looks
 * like fussing over layout is buying back that control:
 *
 *   - `KeyboardAvoidingView` lifts the composer by exactly the keyboard's
 *     height, measured, not guessed.
 *   - The list is `inverted`, so new messages appear at the bottom and the
 *     keyboard opening does not scroll the conversation away.
 *   - `keyboardDismissMode="interactive"` lets the keyboard follow the finger
 *     down, the way Messages and WhatsApp do.
 *   - The field grows with the text up to a cap instead of scrolling one line.
 *
 * Voice is not wired up yet; the microphone is the next piece (on-device
 * speech recognition, so the words appear while the user is still talking).
 * The plumbing it needs is already here: `posalji` takes a string and does not
 * care whether it was typed or spoken.
 */
export default function JarvisScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Poruka>>(null);

  const [poruke, setPoruke] = useState<Poruka[]>([]);
  const [unos, setUnos] = useState("");
  const [misli, setMisli] = useState(false);
  const [potvrda, setPotvrda] = useState<OdgovorMozga["cekaPotvrdu"]>(undefined);
  const [greska, setGreska] = useState<string | null>(null);

  const ctx = useMemo(
    () => ({
      korisnikId: session?.user.id ?? "",
      danas: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Belgrade" }).format(
        new Date()
      ),
    }),
    [session?.user.id]
  );

  const primeni = useCallback((odgovor: OdgovorMozga) => {
    setPoruke(odgovor.poruke);
    setPotvrda(odgovor.cekaPotvrdu);
    if (odgovor.cekaPotvrdu) feedback.warning();
  }, []);

  const posalji = useCallback(
    async (tekst: string) => {
      const ocisceno = tekst.trim();
      if (!ocisceno || misli) return;

      // Optimistic: the user's own words appear instantly. Waiting for the
      // server to echo them back is what makes a chat feel laggy even when the
      // reply is fast.
      const sledece: Poruka[] = [...poruke, { uloga: "korisnik", tekst: ocisceno }];
      setPoruke(sledece);
      setUnos("");
      setGreska(null);
      setMisli(true);

      try {
        primeni(await odgovori(sledece, ctx));
      } catch {
        feedback.error();
        setGreska("Ne mogu da dohvatim Jarvisa. Proveri vezu.");
      } finally {
        setMisli(false);
      }
    },
    [poruke, misli, ctx, primeni]
  );

  const odgovoriNaPotvrdu = useCallback(
    async (da: boolean) => {
      if (!potvrda) return;
      feedback.press();
      setPotvrda(undefined);
      setMisli(true);
      try {
        primeni(await potvrdi(poruke, potvrda, da, ctx));
      } catch {
        feedback.error();
        setGreska("Ne mogu da dohvatim Jarvisa. Proveri vezu.");
      } finally {
        setMisli(false);
      }
    },
    [potvrda, poruke, ctx, primeni]
  );

  // Newest first, because the list is inverted.
  const zaPrikaz = useMemo(() => [...poruke].reverse(), [poruke]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        // The header is outside the lifted area, so its height must be
        // subtracted or the composer floats above the keyboard by that much.
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <Text variant="heading">Jarvis</Text>
          <Text variant="caption">Reci šta ti treba.</Text>
        </View>

        <FlatList
          ref={listRef}
          data={zaPrikaz}
          inverted
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.lista}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Mehur poruka={item} />}
          ListHeaderComponent={
            misli ? <ActivityIndicator color={colors.inkBright} style={styles.misli} /> : null
          }
          ListFooterComponent={
            poruke.length === 0 ? (
              <View style={styles.prazno}>
                <Text variant="body" color={colors.mutedForeground}>
                  Na primer: „popio sam čašu vode", „koliko mi je ostalo danas".
                </Text>
              </View>
            ) : null
          }
        />

        {greska ? (
          <Text variant="caption" color={colors.destructive} style={styles.greska}>
            {greska}
          </Text>
        ) : null}

        {potvrda ? (
          <View style={styles.potvrda}>
            <Text variant="body">{potvrda.pitanje}</Text>
            <View style={styles.potvrdaDugmad}>
              <Button title="Ne" variant="secondary" onPress={() => void odgovoriNaPotvrdu(false)} />
              <Button title="Da, uradi" onPress={() => void odgovoriNaPotvrdu(true)} />
            </View>
          </View>
        ) : (
          <View style={[styles.kompozer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TextInput
              value={unos}
              onChangeText={setUnos}
              placeholder="Napiši ili reci…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.polje}
              multiline
              // Grows with the text, then scrolls. A single-line field that
              // scrolls sideways is the web-view tell.
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => void posalji(unos)}
              editable={!misli}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pošalji"
              onPressIn={() => feedback.tap()}
              onPress={() => void posalji(unos)}
              disabled={!unos.trim() || misli}
              style={[styles.posalji, !unos.trim() || misli ? styles.posaljiInert : null]}
            >
              <Text variant="label" color={colors.primaryForeground}>
                ↑
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** One line of the conversation. A tool turn renders the component the tool
 *  named — this is where an answer becomes a screen instead of a sentence. */
function Mehur({ poruka }: { poruka: Poruka }) {
  if (poruka.uloga === "alat") {
    const ekran = poruka.rezultat.ekran;
    if (!ekran) return null;
    const Komponenta = komponente[ekran.komponenta] as
      | ((props: Record<string, unknown>) => React.ReactElement)
      | undefined;
    // An unknown component name renders nothing rather than crashing the
    // conversation: an old install may not have a component a newer tool names.
    if (!Komponenta) return null;
    return (
      <View style={styles.ekran}>
        <Komponenta {...ekran.props} />
      </View>
    );
  }

  const moja = poruka.uloga === "korisnik";
  // A Jarvis turn that only carried a tool call has no words to show.
  if (!moja && !poruka.tekst) return null;

  return (
    <View style={[styles.mehur, moja ? styles.mehurMoj : styles.mehurNjegov]}>
      <Text
        variant="body"
        color={moja ? colors.primaryForeground : colors.ink}
        // The one place selectable text is deliberate: a reply the user may
        // genuinely want to copy. Everywhere else in the app it stays off.
        selectable={!moja}
      >
        {poruka.tekst}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: 2 },
  lista: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  misli: { alignSelf: "flex-start", marginLeft: spacing.sm, marginBottom: spacing.md },
  prazno: { paddingVertical: spacing.xl },
  greska: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  mehur: { maxWidth: "84%", borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  mehurMoj: { alignSelf: "flex-end", backgroundColor: colors.primary },
  mehurNjegov: {
    alignSelf: "flex-start",
    backgroundColor: colors.secondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ekran: { alignSelf: "stretch" },
  potvrda: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  potvrdaDugmad: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  kompozer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
  },
  polje: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.input,
    color: colors.ink,
    fontSize: 16,
  },
  posalji: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  posaljiInert: { opacity: 0.4 },
});
