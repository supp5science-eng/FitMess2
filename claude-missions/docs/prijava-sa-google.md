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
(popunjen 19.08.2026)
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
| Supabase → Auth → Google → *Client IDs* | **zarezom odvojena lista**: web id, pa iOS id |

⚠️ **Zamka u Supabase Management API-ju, plaćena 19.08.2026:** polje
`external_google_additional_client_ids` postoji u odgovoru, ali `PATCH` sa njim
**prepiše `external_google_client_id`** umesto da doda pored njega — web client
id nestane, a tajna ostane web-ova, pa Google prijava na sajtu pukne. Ispravno
je patch-ovati `external_google_client_id` kao listu `"<web>,<ios>"`; prvi u
listi je onaj uz koji ide secret i koji se koristi za redirect tok. Isti oblik
koji Apple provajder već ima (`app.fitmess.web,app.fitmess`). Posle svake izmene
proveri čime se authorize URL zaista predstavlja:

```bash
curl -s -o /dev/null -D - "https://femrzpfslejzqnvfsfoe.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Ffitmess.app%2Fauth%2Fcallback"   | grep -i ^location | grep -o "client_id=[^&]*"
```

⚠️ Google SDK odbija da se pokrene bez URL scheme-a u `Info.plist`, i to se vidi
tek na uređaju.

📏 **Mereno na uređaju 19.08.:** pošto je `iOSServerClientId` postavljen, ID token
dolazi sa `aud` = **web** client id, ne iOS. iOS id u Supabase listi je zato
pojas i tregeri, ne uslov. Ostaje na spisku jer ne košta ništa, a menjanje
`iOSServerClientId` bi ga učinilo obaveznim.

## Nonce — mesto na kom je ovo puklo

Prvi test na uređaju: list sa nalozima se otvori, izabereš mejl, i dobiješ
`Passed nonce and nonce in id_token should either both exist or not` (status 400).

Uzrok: **Google-ov iOS SDK sam napravi nonce kad mu ga pozivalac ne da.** Token
je stigao sa `nonce` claim-om koji naš kod nije mogao da zna, a Supabase odbija
claim koji nema sa čim da uporedi. „Ne šalji nonce" nije opcija — samo tako
izgleda.

Zato nonce sad pravimo mi i putuje na dve strane:

- **Google-u ide SHA-256 heš** — on u token upiše ono što dobije.
- **Supabase-u ide original** — on ga sam heširа i uporedi.

Taj oblik je ono što proveru čini smislenom: token preigran sa strane nosi heš
čiji original napadač nema.

⚠️ Uz nonce ide i **`forcePrompt: true`**, i to nije stvar ukusa. Kad SDK pamti
prethodnu prijavu, plugin preskače pravi tok i samo *obnovi* staru sesiju — a
token koji tako dobiješ nosi nonce ORIGINALNE prijave, ne onaj koji smo upravo
napravili. Palo bi tek od drugog tapa nadalje, što izgleda kao „nekad radi,
nekad ne".

## Cena koju plugin nosi sa sobom

`@capgo/capacitor-social-login` na iOS-u linkuje **GoogleSignIn, Alamofire i
Facebook SDK** — Facebook zato što isti plugin nudi i Facebook prijavu, koju mi
ne koristimo. Ne inicijalizujemo ga (`SocialLogin.initialize` dobija samo
`google`), pa je mrtav kod: ne čita `FacebookAppID`, ne skuplja ništa, ne javlja
se. Ostaje trošak u veličini binarnog fajla i još nekoliko SPM zavisnosti koje
build mora da razreši.

Vredelo je izmeriti pre nego što uđe u build, jer je alternativa (sistemski
browser + deep link nazad) izbegava, ali unosi četiri koraka koji mogu tiho da
puknu na uređaju. Izabran je manji broj pokretnih delova u toku prijave, po cenu
većeg broja zavisnosti u buildu.

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
