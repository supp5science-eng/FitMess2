import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { feedback } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import { nadjiAlat } from "@/jarvis/alat";
import { KarticaVode } from "@/jarvis/komponente/KarticaVode";
import { colors, spacing } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { Wordmark } from "@/ui/Wordmark";

/**
 * The proof screen.
 *
 * Not the final home — that becomes Jarvis. This exists to prove, on a real
 * phone with real data, that the chain works end to end without a web view
 * anywhere in it: keychain session → Supabase with RLS → a registered tool →
 * a component the tool named → the Taptic Engine.
 *
 * Every one of the five complaints that started the rebuild is answerable on
 * this screen:
 *   - it draws before the network answers (the JS is in the binary)
 *   - the button buzzes on press-in
 *   - a long press on any text raises nothing
 *   - the transitions are UIKit's, not a JS imitation
 *   - the keyboard, when Jarvis lands here, is ours to control
 */

/** Belgrade calendar day. The app owns what "danas" means — the same rule the
 *  tools rely on, so a tool never has to ask a model for the date. */
function danasUBeogradu(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Belgrade" }).format(new Date());
}

export default function PocetnaScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const korisnikId = session?.user.id ?? null;
  const danas = danasUBeogradu();

  const [ml, setMl] = useState<number | null>(null);
  const [promena, setPromena] = useState(0);
  const [radim, setRadim] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(async () => {
    if (!korisnikId) return;
    const { data, error } = await supabase
      .from("water_intake")
      .select("ml")
      .eq("user_id", korisnikId)
      .eq("day", danas)
      .maybeSingle();

    if (error) {
      setGreska("Nismo uspeli da učitamo dan.");
      return;
    }
    setGreska(null);
    setMl(data?.ml ?? 0);
  }, [korisnikId, danas]);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  /** Runs the real registered tool, exactly as Jarvis will run it — same
   *  entry point, same context, same result. The only thing missing here is
   *  the model that picks it. */
  const dodajCasu = async () => {
    if (!korisnikId || radim) return;
    const alat = nadjiAlat("dodajVodu");
    if (!alat) return;

    setRadim(true);
    const rezultat = await alat.izvrsi({ mera: "casa" }, { korisnikId, danas });
    setRadim(false);

    if (rezultat.greska) {
      feedback.error();
      setGreska("Nismo uspeli da upišemo vodu.");
      return;
    }

    feedback.success();
    setGreska(null);
    const noviMl = (rezultat.ekran?.props.ml as number) ?? 0;
    setPromena((rezultat.ekran?.props.promena as number) ?? 0);
    setMl(noviMl);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Wordmark size={30} />
          <Text variant="caption">{session?.user.email ?? ""}</Text>
        </View>

        <Text variant="title">Radi bez veba.</Text>
        <Text variant="body">
          Ovaj ekran je iscrtan iz koda koji je u samoj aplikaciji. Nema WebView-a, nema
          čekanja na mrežu pre prvog kadra. Dugme ispod poziva pravi alat iz Jarvisovog
          registra — isti onaj koji će Jarvis zvati kad mu kažeš da si popio vodu.
        </Text>

        {ml === null ? (
          <ActivityIndicator color={colors.inkBright} style={styles.loader} />
        ) : (
          <KarticaVode ml={ml} promena={promena} />
        )}

        {greska ? (
          <Text variant="caption" color={colors.destructive}>
            {greska}
          </Text>
        ) : null}

        <Button title="Čaša vode (250 ml)" onPress={dodajCasu} loading={radim} block />
        {/* Deliberately a button rather than a tab bar: which screens survive
            as screens is still an open question, and a tab bar would be a
            guess at the answer baked into navigation. */}
        <Button
          title="Otvori Jarvisa"
          variant="secondary"
          onPress={() => router.push("/(app)/jarvis")}
          block
        />
        <Button title="Odjavi se" variant="ghost" onPress={() => void signOut()} block />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  loader: { alignSelf: "flex-start" },
});
