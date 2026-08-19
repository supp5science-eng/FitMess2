# Prijava sa Google u aplikaciji

Kako Google prijava radi *unutar ljuske*, i šta je od toga posao u konzoli koji
nijedan `git push` ne može da uradi.

## Zašto ne kao na vebu

Na vebu `signInWithOAuth` odvede browser na Google-ovu stranicu za pristanak i
vrati ga nazad. U ljusci to je **ugrađeni web view**, i Google svoju politiku o
ugrađenim web view-ima ne sprovodi odbijanjem prvog zahteva — sprovodi je
*unutar* toka: nema sačuvanih naloga, traži dodatnu verifikaciju. Mereno na
uređaju 19.08.2026; `curl` sa četiri UA-a to ne može da pokaže, jer sva četiri
dobiju običnu stranicu za prijavu.

Zato ljuska ne ide u web view nego u **sistemski izbor naloga**. On vrati
OpenID **ID token**, a Supabase ga primi direktno (`signInWithIdToken`). Nema
stranice za pristanak, nema izlaska iz app-a, nema deep linka nazad — i nalog na
koji je telefon već prijavljen stoji u listi.

Kod: `src/lib/auth/google-native.ts`, dugme `src/app/(auth)/google-sign-in-button.tsx`,
odluka o prikazivanju `src/app/(auth)/social-sign-in.tsx`.

## Prekidač

Dugme se u ljusci prikazuje **samo ako je `GOOGLE_IOS_CLIENT_ID` popunjen**
(`src/lib/auth/google-clients.ts`). Prazan id → nema dugmeta. To nije opreznost
nego pravilo naučeno u ovom krugu: **dugme koje pukne na tap gore je od dugmeta
kojeg nema.**

## Šta treba uraditi u konzoli (jedini ručni deo)

1. **Google Cloud Console** → isti projekat u kom već živi web client
   `1004641833797-cu2ibrlh0ad00l30a0b68gp6d8t61vri.apps.googleusercontent.com`
   → *APIs & Services* → *Credentials* → *Create credentials* → *OAuth client ID*
   → **Application type: iOS** → *Bundle ID:* `app.fitmess` → *Create*.
2. Prepiši dobijeni **iOS client ID** (oblik
   `1004641833797-nesto.apps.googleusercontent.com`).

Sve ostalo ide iz koda:

| Gde | Šta se upisuje |
|---|---|
| `src/lib/auth/google-clients.ts` | `GOOGLE_IOS_CLIENT_ID` |
| `ios/App/App/Info.plist` | `CFBundleURLTypes` sa **obrnutim** id-em: `com.googleusercontent.apps.1004641833797-nesto` |
| Supabase → Auth → Google → *Authorized Client IDs* | isti iOS client ID, pored web-ovog |

⚠️ Sva tri moraju da odu zajedno. ID token je izdat za **iOS** client, pa ga
Supabase odbija dok taj id nije na spisku — a Google SDK odbija da se pokrene
bez URL scheme-a u `Info.plist`. Svaka od tri rupe se vidi tek na uređaju, i
svaka košta pun build ciklus.

## Android — namerno nije uključen

`isIosNativeShellUserAgent` pušta dugme samo na iOS ljusci. Android koristi
Google Credential Manager, kome treba **po jedan Android OAuth client za svaki
sertifikat kojim se potpisuje build** — debug, upload i Play App Signing. Build
čiji sertifikat nije upisan pada na tap sa greškom koja optužuje konzolu
(`[28444] Developer console is not set up correctly`), ne kod. Kad se ti
otisci upišu, uključivanje je jedna izmena u `isIosNativeShellUserAgent`.

## Provera na uređaju (jedino što vredi)

1. Odjavi se u TestFlight buildu.
2. Tapni „Nastavi sa Google" — mora se otvoriti **sistemski list sa nalozima**,
   u aplikaciji, bez skoka u Safari.
3. Izaberi nalog → app se sam vrati na `/danas` (ili na upitnik, ako je nalog nov).
4. Ubij app i otvori ga ponovo — mora te pamtiti.

Ako se otvori Safari, kriv je `server.allowNavigation` (vidi `capacitor.config.ts`).
Ako list ne pusti nalog, kriv je jedan od tri upisa iz tabele gore.
